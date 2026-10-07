/* This page connects only to the isolated testing project. */
(() => {
  'use strict';
  const $=id=>document.getElementById(id);
  const base='https://wphqfogbnpdsfkquvdsu.supabase.co';
  const key='sb_publishable_kyez8nhpp8htaPAdh7Hmfw_5NCyK6RI';
  let session=null,config=null,busy=false,epoch=0;
  const status=text=>{$('status').textContent=text;};
  if(!window.supabase){status('Could not load sign-in. Please reload this page.');return;}
  const client=window.supabase.createClient(base,key,{auth:{storageKey:'earnly-coin-sandbox-auth',detectSessionInUrl:true}});
  const orderId=new URLSearchParams(location.search).get('test_order');
  const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  async function api(path,options={}) {
    const {data,error}=await client.auth.getSession();if(error)throw error;
    const response=await fetch(base+'/functions/v1/coin-shop'+path,{...options,signal:AbortSignal.timeout(25000),headers:{apikey:key,...(data.session?{Authorization:'Bearer '+data.session.access_token}:{}),'Content-Type':'application/json',...options.headers}});
    const body=await response.json();if(!response.ok)throw new Error(body.error?.message||'The test shop could not complete this request.');return body;
  }
  function locks(){document.querySelectorAll('button').forEach(b=>{b.disabled=busy||(b.dataset.pack!==undefined&&(!session||!config?.available));});}
  async function run(action){if(busy)return;busy=true;locks();try{await action();}catch(e){status(e.message||'Please try again.');}finally{busy=false;locks();}}
  function renderPacks(){
    $('packs').replaceChildren();
    for(const pack of config?.packs||[]){const row=document.createElement('div');row.className='pack';const info=document.createElement('div');const title=document.createElement('strong');title.textContent=pack.coins.toLocaleString()+' coins';const price=document.createElement('small');price.textContent=new Intl.NumberFormat('en-US',{style:'currency',currency:pack.currency}).format(pack.priceCents/100)+' test payment';info.append(title,price);const button=document.createElement('button');button.textContent='Test purchase';button.dataset.pack=pack.id;button.onclick=()=>run(()=>checkout(pack.id));row.append(info,button);$('packs').append(row);}locks();
  }
  async function refresh(){
    if(!session)return;const current=epoch;let order;
    if(orderId&&uuid.test(orderId))order=await api('/orders/'+orderId);
    const result=await api('/wallet');if(current!==epoch)return;
    $('balance').textContent=Number(result.wallet.balance).toLocaleString();
    status(order?.status==='fulfilled'?'Payment verified. '+order.coins.toLocaleString()+' test coins credited. Refresh to confirm the balance stays the same.':order?'Payment is still pending. Refresh after checkout completes.':config?.available?'Ready for a sandbox purchase.':'Sandbox checkout is not enabled yet.');
  }
  async function checkout(packId){
    if(!session)throw new Error('Sign in to testing first.');
    const current=epoch,owner=session.user.id;const storage='earnly-sandbox-request:'+owner+':'+packId;
    let requestId=sessionStorage.getItem(storage);if(!requestId||!uuid.test(requestId)){requestId=crypto.randomUUID();sessionStorage.setItem(storage,requestId);}
    status('Opening Stripe sandbox checkout…');
    const result=await api('/checkout',{method:'POST',headers:{'Idempotency-Key':requestId},body:JSON.stringify({packId})});
    if(current!==epoch)return;
    if(result.fulfilled){sessionStorage.removeItem(storage);await refresh();return;}
    const url=new URL(result.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Unexpected checkout address.');
    // Keep the request ID on network failure, but allow a new purchase after a successful redirect.
    sessionStorage.removeItem(storage);location.assign(url.href);
  }
  function authState(next){session=next;epoch++;$('auth').hidden=!!next;$('shop').hidden=!next;$('account').textContent=next?'Signed in as '+next.user.email:'';$('balance').textContent='—';locks();}
  $('auth-form').onsubmit=event=>{event.preventDefault();const signup=event.submitter?.name==='signup';run(async()=>{
    const credentials={email:$('email').value.trim(),password:$('password').value};
    const {data,error}=signup?await client.auth.signUp({...credentials,options:{emailRedirectTo:'https://earnlyarcade.com/coin-sandbox.html'}}):await client.auth.signInWithPassword(credentials);
    if(error)throw error;$('password').value='';authState(data.session);
    if(data.session)await refresh();else status('Check your email and confirm the testing account. Then return to this page and sign in.');
  });};
  $('refresh').onclick=()=>run(refresh);
  $('signout').onclick=()=>run(async()=>{const {error}=await client.auth.signOut();if(error)throw error;authState(null);status('Signed out of testing.');});
  client.auth.onAuthStateChange((_event,next)=>{authState(next);});
  run(async()=>{config=await api('/config');renderPacks();const {data,error}=await client.auth.getSession();if(error)throw error;authState(data.session);if(session)await refresh();else status('Sign in or create your testing account to continue.');});
})();
