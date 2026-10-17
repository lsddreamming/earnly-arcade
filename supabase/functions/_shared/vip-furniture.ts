/** Normalize already server-verified payment evidence. Never accepts client claims. */
const DAY = 86_400_000;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function monthlyPeriod(start: unknown, end: unknown, now: number) {
  return Number.isSafeInteger(start) && Number.isSafeInteger(end) &&
    (start as number) <= now && (start as number) > 0 &&
    (end as number) - (start as number) >= 27 * DAY &&
    (end as number) - (start as number) <= 32 * DAY;
}

export function appleFurnitureEvidence(transaction: any, userId: string, now = Date.now()) {
  // Caller must first verify the JWS chain through the existing Apple verifier.
  const t = transaction;
  if (!t || t.environment !== 'Production' || t.bundleId !== 'com.earnly.arcade' ||
      t.productId !== 'com.earnly.arcade.vip.monthly' ||
      t.type !== 'Auto-Renewable Subscription' || t.inAppOwnershipType !== 'PURCHASED' ||
      t.quantity !== 1 || !uuid.test(userId) || !uuid.test(t.appAccountToken || '') ||
      t.appAccountToken.toLowerCase() !== userId.toLowerCase() ||
      !/^\d{1,32}$/.test(t.transactionId || '') || !/^\d{1,32}$/.test(t.originalTransactionId || '') ||
      !Number.isSafeInteger(t.price) || t.price <= 0 || !/^[A-Z]{3}$/.test(t.currency || '') ||
      t.revocationDate != null || t.isUpgraded === true ||
      !monthlyPeriod(t.purchaseDate, t.expiresDate, now)) return null;
  return {provider:'apple', userId:userId.toLowerCase(), transactionId:t.transactionId,
    subscriptionId:t.originalTransactionId, periodStart:new Date(t.purchaseDate).toISOString(),
    periodEnd:new Date(t.expiresDate).toISOString()};
}

export function stripeFurnitureEvidence(invoice: any, subscription: any, priceId: string,
    verifiedPaidAmount: number, paymentRevoked: boolean, now = Date.now()) {
  // Caller must verify the webhook and retrieve invoice, subscription and successful
  // PaymentIntent/charge evidence using the existing Stripe reconciliation path.
  const i = invoice, s = subscription;
  if (!i || !s || !priceId || i.livemode !== true || s.livemode !== true ||
      !uuid.test(s.metadata?.earnlyUser || '') || s.metadata?.earnlyProduct !== 'vip' ||
      !uuid.test(s.metadata?.earnlyRequest || '') ||
      !['active','past_due'].includes(s.status) || paymentRevoked ||
      i.status !== 'paid' || i.currency !== 'usd' || !Number.isSafeInteger(i.amount_paid) ||
      i.amount_paid < 499 || !Number.isSafeInteger(verifiedPaidAmount) || verifiedPaidAmount < i.amount_paid ||
      !['subscription_create','subscription_cycle'].includes(i.billing_reason) ||
      i.parent?.subscription_details?.subscription !== s.id || i.customer !== s.customer ||
      typeof i.id !== 'string' || !i.id.startsWith('in_') ||
      s.items?.has_more !== false || s.items.data?.length !== 1 ||
      s.items.data[0].price?.id !== priceId || s.items.data[0].quantity !== 1 ||
      i.lines?.has_more !== false || i.lines.data?.length !== 1) return null;
  const line = i.lines.data[0];
  if (line.pricing?.price_details?.price !== priceId || line.quantity !== 1 ||
      line.parent?.subscription_item_details?.proration !== false ||
      !Number.isSafeInteger(line.amount) || line.amount < 499 ||
      !Number.isSafeInteger(line.period?.start) || !Number.isSafeInteger(line.period?.end) ||
      !monthlyPeriod(line.period.start * 1000, line.period.end * 1000, now)) return null;
  return {provider:'stripe', userId:s.metadata.earnlyUser.toLowerCase(), transactionId:i.id,
    subscriptionId:s.id, periodStart:new Date(line.period.start*1000).toISOString(),
    periodEnd:new Date(line.period.end*1000).toISOString()};
}
