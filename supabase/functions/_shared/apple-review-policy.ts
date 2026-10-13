/** A Sandbox receipt can only grant to a separately provisioned test account.
 * Callers supply cryptographic verifiers, never a client-declared environment.
 */
export function appleReviewPolicy({production,sandboxVerifier,sandboxClient,isTestAccount}:any){
 const allowSandboxTransaction=async(t:any)=>t.environment==='Sandbox'&&
  typeof t.appAccountToken==='string'&&await isTestAccount(t.appAccountToken)===true;
 return {
  allowSandboxTransaction,
  verifyTransaction:async(signed:string)=>{
   let original;
   try{original=await production.verifyTransaction(signed);}
   catch(error){
    if(!sandboxVerifier||!sandboxClient)throw error;
    original=await sandboxVerifier.verifyAndDecodeTransaction(signed);
    if(!await allowSandboxTransaction(original))throw new Error('SANDBOX_TEST_ACCOUNT_REQUIRED');
    if(!original.transactionId)throw new Error('MISSING_TRANSACTION');
    const current=await sandboxClient.getTransactionInfo(original.transactionId);
    const t=await sandboxVerifier.verifyAndDecodeTransaction(current.signedTransactionInfo);
    if(t.environment!=='Sandbox'||t.bundleId!=='com.earnly.arcade'||
       t.transactionId!==original.transactionId||t.appAccountToken!==original.appAccountToken||
       t.productId!==original.productId||t.originalTransactionId!==original.originalTransactionId)
     throw new Error('TRANSACTION_MISMATCH');
    return {...t,revocationDate:original.revocationDate??t.revocationDate};
   }
   // Dedicated test accounts can never accumulate paid production purchases.
   if(original.environment!=='Production'||await isTestAccount(original.appAccountToken))
    throw new Error('PRODUCTION_ACCOUNT_REQUIRED');
   return original;
  },
  verifyNotification:async(signed:string)=>{
   try{return await production.verifyNotification(signed);}
   catch(error){if(!sandboxVerifier)throw error;return await sandboxVerifier.verifyAndDecodeNotification(signed);}
  }
 };
}
