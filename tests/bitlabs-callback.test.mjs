import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { verifyCallback, parseCallback } from '../backend/bitlabs/callback.mjs';

const endpoint = 'https://publisher.com/complete';
const secret = 'test-only-secret';
const base = `${endpoint}?uid=8cc877ee-af19-488d-b28d-216fb866b996&tx=tx-1&val=300&raw=5.00&activity=COMPLETE`;
const sign = url => `${url}&hash=${createHmac('sha1', secret).update(url).digest('hex')}`;

test('accepts the independently published BitLabs signature vector', async () => {
  const url = `${endpoint}?uid=8cc877ee-af19-488d-b28d-216fb866b996&val=500&hash=dbcd6bb8ca677344592842a52b4fca9bec36cd4b`;
  assert.equal(await verifyCallback(url, 'JLOIAUNMHFli7ZJOQVEzm98rzqnm9', endpoint), true);
});
test('rejects tampered amount, wrong secret, host and unsigned callbacks', async () => {
  assert.equal(await verifyCallback(sign(base), secret, endpoint), true);
  for (const url of [base, sign(base).replace('val=300', 'val=999'), sign(base).replace('publisher.com', 'attacker.com')]) {
    assert.equal(await verifyCallback(url, secret, endpoint), false);
  }
  assert.equal(await verifyCallback(sign(base), 'wrong', endpoint), false);
  assert.equal(await verifyCallback(sign(base), '', endpoint), false);
});
test('rejects duplicate parameters and data appended after the signature', async () => {
  assert.equal(await verifyCallback(sign(base + '&val=999'), secret, endpoint), false);
  assert.equal(await verifyCallback(sign(base) + '&val=999', secret, endpoint), false);
});
test('preserves URL encoding when checking signatures', async () => {
  const encoded = sign(base.replace('tx-1', 'tx%2F1'));
  assert.equal(await verifyCallback(encoded, secret, endpoint), true);
  assert.equal(await verifyCallback(encoded.replace('%2F', '/'), secret, endpoint), false);
});
test('keeps exact decimal values and a stable provider transaction ID', () => {
  const event = parseCallback(sign(base));
  assert.equal(event.publisherUsd, '5.00');
  assert.equal(event.rewardUnits, '300');
  assert.equal(event.transactionId, 'tx-1');
});
test('recognizes positive, zero and negative reconciliations by activity and reference', () => {
  for (const value of ['-3.00', '0', '1.25']) {
    const url = base.replace('activity=COMPLETE', 'activity=RECONCILIATION&ref=original-tx').replace('raw=5.00', `raw=${value}`);
    assert.equal(parseCallback(sign(url)).reference, 'original-tx');
    assert.equal(parseCallback(sign(url)).publisherUsd, value);
  }
  assert.throws(() => parseCallback(sign(base.replace('COMPLETE', 'RECONCILIATION'))));
});
test('rejects malformed amounts, missing identity and unsupported activity', () => {
  for (const url of [base.replace('raw=5.00', 'raw=NaN'), base.replace('val=300', 'val=-1'),
    base.replace('activity=COMPLETE', 'activity=UNKNOWN'), base.replace(/uid=[^&]+&/, ''),
    base.replace('val=300', 'val=1e6')]) assert.throws(() => parseCallback(sign(url)));
});
