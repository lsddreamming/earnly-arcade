// Sandbox harness for an explicitly compiled iOS sandbox build.
// Production bridge returns no Studio products. Never finish before verified delivery.
export async function verifyStudioSandboxPurchase(bridge,client,signedTransaction) {
  const {data,error}=await client.functions.invoke('studio-commerce/apple',{body:{signedTransaction}});
  if(error || !data?.sandbox || !data.recorded || !data.transactionId) throw Error('Studio sandbox verification unavailable');
  await bridge.finish({transactionId:data.transactionId});
  return data;
}
export async function restoreStudioSandbox(bridge,client) {
  const current=await bridge.restore({store:'studio'});
  const pending=await bridge.pending({store:'studio'});
  for(const signed of new Set([...current.transactions,...pending.transactions]))
    await verifyStudioSandboxPurchase(bridge,client,signed);
}
