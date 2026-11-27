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

const products={
 premium:'com.earnly.arcade.studio.premium.monthly',
 pro:'com.earnly.arcade.studio.pro.monthly',
 credits100:'com.earnly.arcade.studio.credits100'
};
export async function openSandboxStore(container,account){
  container.replaceChildren();
  if(!account?.app_metadata?.studio_billing_tester)return;
  const client=window.EarnlyCloud.client;
  const native=location.protocol==='capacitor:';
  const make=(tag,text)=>{const node=document.createElement(tag);node.textContent=text;return node;};
  const heading=make('h2','Sandbox storefront');
  const message=make('p','Test purchases use an isolated balance.');
  container.append(heading,message);
  const invoke=async(path,body={})=>{
    if((await window.EarnlyCloud.user())?.id!==account.id)throw Error('Account changed');
    const {data,error}=await client.functions.invoke('studio-commerce/'+path,{body});
    if(error||!data?.sandbox)throw Error('Sandbox unavailable');
    return data;
  };
  async function showBalance(){
    const data=await invoke('allowances');
    message.textContent='Test plan · '+data.plan+' · '+data.images+' images · '+data.videos+' videos · '+data.packCredits+' pack credits';
  }
  function action(label,fn){
    const button=make('button',label);button.type='button';container.append(button);
    button.onclick=async()=>{button.disabled=true;try{await fn();}catch{message.textContent='Test transaction unavailable. Restore to check a previous purchase.';}finally{button.disabled=false;}};
  }
  let bridge=window.EarnlyApplePurchases;
  if(native&&!bridge){
    await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='native-purchases.js';script.onload=resolve;script.onerror=reject;document.head.append(script);});
    bridge=window.EarnlyApplePurchases;
  }
  const prices=native?(await bridge.products({store:'studio'})).products:[];
  for(const [product,id] of Object.entries(products)){
    const price=prices.find(p=>p.id===id);
    if(native&&!price)continue;
    action('Test '+product+(price?' · '+price.displayPrice:''),async()=>{
      if(native){
        if((await window.EarnlyCloud.user())?.id!==account.id)throw Error('Account changed');
        const t=await bridge.purchase({productId:id,accountToken:account.id});
        if(t.status==='purchased'){await verifyStudioSandboxPurchase(bridge,client,t.signedTransaction);await showBalance();}
        return;
      }
      const key='studio-checkout:'+account.id+':'+product;
      const request=sessionStorage.getItem(key)||crypto.randomUUID();
      sessionStorage.setItem(key,request);
      const {url}=await invoke('checkout',{product,request_id:request});
      sessionStorage.removeItem(key);location.assign(url);
    });
  }
  action('Restore test purchases',async()=>{if(native)await restoreStudioSandbox(bridge,client);await showBalance();});
  action('Manage test subscription',async()=>{if(native)await bridge.manage();else location.assign((await invoke('portal')).url);});
  await showBalance();
}
