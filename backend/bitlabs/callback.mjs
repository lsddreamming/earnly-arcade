// Server-only preparation. This module does not credit wallets or expose an endpoint.
// https://developer.bitlabs.ai/docs/securing-callbacks-through-hashing
export async function verifyCallback(rawUrl, secret, expectedEndpoint) {
  if (!secret || !expectedEndpoint || typeof rawUrl !== 'string') return false;
  const match = rawUrl.match(/&hash=([a-f0-9]{40})$/);
  if (!match) return false;
  const unsigned = rawUrl.slice(0, match.index);
  let url;
  try { url = new URL(unsigned); } catch { return false; }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) return false;
  if (`${url.origin}${url.pathname}` !== expectedEndpoint) return false;
  const seen = new Set();
  for (const [name] of url.searchParams) {
    if (seen.has(name) || name === 'hash') return false;
    seen.add(name);
  }
  // Hash the original bytes, never a re-encoded URL or untrusted forwarded host.
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret),
    { name:'HMAC', hash:'SHA-1' }, false, ['verify']);
  const signature = Uint8Array.from(match[1].match(/../g), hex => parseInt(hex, 16));
  return crypto.subtle.verify('HMAC', key, signature, encoder.encode(unsigned));
}

// Call only after verification. Parameter names are part of our future callback configuration.
export function parseCallback(rawUrl) {
  const params = new URL(rawUrl).searchParams;
  const required = name => {
    const value = params.get(name);
    if (!value || value.length > 256 || params.getAll(name).length !== 1) {
      throw new Error(`Invalid ${name}`);
    }
    return value;
  };
  const userId = required('uid');
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(userId)) {
    throw new Error('Invalid user ID');
  }
  const transactionId = required('tx');
  const activity = required('activity');
  if (!['COMPLETE', 'RECONCILIATION'].includes(activity)) throw new Error('Unsupported activity');
  const reference = params.get('ref') || null;
  if (params.getAll('ref').length > 1 || (reference && reference.length > 256)) throw new Error('Invalid reference');
  if (activity === 'RECONCILIATION' && !reference) throw new Error('Missing reconciliation reference');
  // Keep decimal amounts as strings for database NUMERIC; no floating-point wallet arithmetic.
  const decimal = name => {
    const value = required(name);
    if (!/^-?\d{1,12}(?:\.\d{1,8})?$/.test(value)) throw new Error(`Invalid ${name}`);
    if (activity === 'COMPLETE' && value.startsWith('-')) throw new Error('Negative completion');
    return value;
  };
  return Object.freeze({ provider:'bitlabs', userId, transactionId, activity,
    reference, rewardUnits:decimal('val'), publisherUsd:decimal('raw') });
}
