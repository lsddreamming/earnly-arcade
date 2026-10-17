/** Delivery boundary: only the verified commerce handler may supply evidence. */
export async function deliverFurniture(db: any, evidence: any) {
  if (!evidence) return null;
  const result = await db.rpc('arcade_pass_furniture_award', {
    p_user_id:evidence.userId, p_provider:evidence.provider,
    p_transaction_id:evidence.transactionId, p_subscription_id:evidence.subscriptionId,
    p_period_start:evidence.periodStart, p_period_end:evidence.periodEnd,
  });
  if (result.error) throw result.error;
  return result.data;
}
