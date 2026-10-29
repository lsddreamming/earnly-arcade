/* One coin wallet. Both payment providers credit only after server verification. */
(() => {
  const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/coin-shop';
  const appleEndpoint=endpoint.replace('/coin-shop','/apple-coins');
  const apple=window.EarnlyApplePurchases;
  const $=id=>document.getElementById(id);
  const arcade=typeof Arcade!=='undefined'?Arcade:null;
  const native=window.Capacitor?.isNativePlatform?.()||location.protocol==='capacitor:';
  if(native)$('coin-pack-options').open=true;
  const fallback=[{id:'starter',coins:500,priceCents:99},{id:'plus',coins:1500,priceCents:299},{id:'vault',coins:4000,priceCents:499}];
  let available=false,busy=false,configSequence=0,verifiedPrices=false;
  const pending=new Map();
  window.EarnlyActivity?.track('shop_view');
  // Keep uncertain checkouts recoverable across refreshes, separately for each account.
  function checkoutKey(account,pack) {
    const name='earnly-coin-checkout:'+account+':'+pack;
    let key=pending.get(name);
    try{key=key||localStorage.getItem(name);}catch{}
    if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(key||''))key=crypto.randomUUID();
    pending.set(name,key);
    try{localStorage.setItem(name,key);}catch{}
    return key;
  }
  function clearCheckout(account,pack){const name='earnly-coin-checkout:'+account+':'+pack;pending.delete(name);try{localStorage.removeItem(name);}catch{}}
  const message=(text,error=false)=>{$('coin-status').textContent=text;$('coin-status').className=error?'error':'';};
  async function api(path,options={}) {
    const session=await window.EarnlyCloud?.session?.();
    if(options.account && session?.user?.id!==options.account)throw new Error('Your account changed. Try again after signing in.');
    const headers={'Content-Type':'application/json'};
    if(session)headers.Authorization='Bearer '+session.access_token;
    if(options.key)headers['Idempotency-Key']=options.key;
    const response=await fetch((options.apple?appleEndpoint:endpoint)+path,{method:options.body?'POST':'GET',headers,body:options.body?JSON.stringify(options.body):undefined,cache:'no-store'});
    const data=await response.json();
    if(!response.ok){const error=new Error(data.error?.message||'Could not complete the request.');error.code=data.error?.code;throw error;}
    return data;
  }
  function render(packs) {
    $('coin-packs').replaceChildren();
    const priced=packs.filter(p=>p.coins>0&&p.priceCents>0);
    const bestRate=Math.min(...priced.map(p=>p.priceCents/p.coins));
    for(const pack of packs) {
      const card=document.createElement('article');card.className='coin-pack';
      const heading=document.createElement('div');heading.className='pack-heading';
      const title=document.createElement('h3');title.textContent=({starter:'Starter stash',plus:'Style upgrade',vault:'Arcade vault'})[pack.id]||'Coin pack';
      heading.append(title);
      const art=document.createElement('img');art.className='coin-pack-art';art.alt='';art.width=280;art.height=170;
      art.src=({starter:'coin-pack-starter.svg',plus:'coin-pack-plus.svg',vault:'coin-pack-vault.svg'})[pack.id]||'coin-pack-starter.svg';
      if(verifiedPrices&&!native&&priced.length>1&&pack.priceCents/pack.coins===bestRate&&priced.some(p=>p.priceCents/p.coins>bestRate)){
        card.classList.add('best-value');
        const badge=document.createElement('span');badge.className='pack-value';badge.textContent='Best value';heading.append(badge);
      }
      const amount=document.createElement('div');amount.className='coin-amount';amount.textContent=pack.coins.toLocaleString();
      const note=document.createElement('p');note.textContent='Arcade Coins';
      const rate=document.createElement('p');rate.className='pack-rate';rate.textContent=!native&&pack.coins>0?'$'+(pack.priceCents/pack.coins).toFixed(2)+' per 100 coins':'';
      const button=document.createElement('button');button.type='button';button.textContent=available?'$'+(pack.priceCents/100).toFixed(2)+' · Buy':'$'+(pack.priceCents/100).toFixed(2)+' · Soon';
      if(native)button.textContent=pack.displayPrice?pack.displayPrice+' · '+(available?'Buy':'Soon'):'Coming soon';
      button.disabled=!available||busy||(native&&!pack.displayPrice);button.setAttribute('aria-label',`Buy ${pack.coins} Arcade Coins for $${(pack.priceCents/100).toFixed(2)}`);
      if(native)button.setAttribute('aria-label',`Buy ${pack.coins} Arcade Coins${pack.displayPrice?' for '+pack.displayPrice:''}`);
      button.addEventListener('click',async()=>{
        if(busy)return;
        const session=await window.EarnlyCloud?.session?.();if(!session){$('auth-modal').showModal();return;}
        window.EarnlyActivity?.track('purchase_attempt');
        if(native){await buyApple(pack,packs,session);return;}
        busy=true;render(packs);message('Opening secure card checkout…');
        const key=checkoutKey(session.user.id,pack.id);
        try {
          const data=await api('/checkout',{body:{packId:pack.id},key,account:session.user.id});
          if((await window.EarnlyCloud?.session?.())?.user?.id!==session.user.id)throw new Error('Your account changed. Return to your account to check this order.');
          if(data.fulfilled){clearCheckout(session.user.id,pack.id);location.assign('avatars.html?coin_order='+encodeURIComponent(data.orderId)+'#coin-shop');return;}
          const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Checkout could not open.');
          location.assign(url.href);
        } catch(error){if(error.code==='CHECKOUT_EXPIRED')clearCheckout(session.user.id,pack.id);message(error.message,true);busy=false;render(packs);}
      });
      card.append(heading,art,amount,note,rate,button);$('coin-packs').append(card);
    }
  }
  async function refreshAccount() {
    const session=await window.EarnlyCloud?.session?.();$('extra-plays').hidden=!session;
    if(window.EarnlyPaidPlays)await window.EarnlyPaidPlays.refresh();
  }
  async function checkOrder() {
    const params=new URLSearchParams(location.search),order=params.get('coin_order');
    if(params.has('coin_cancelled'))message('Checkout cancelled. Your coin balance is unchanged.');
    if(!order||!/^[0-9a-f-]{36}$/i.test(order))return;
    const session=await window.EarnlyCloud?.session?.();if(!session){message('Sign in to check your coin purchase.');return;}
    message('Checking your purchase…');
    for(let attempt=0;attempt<8;attempt++){
      try {
        const data=await api('/orders/'+order,{account:session.user.id});
        if((await window.EarnlyCloud?.session?.())?.user?.id!==session.user.id)throw new Error('Your account changed. Sign back in to check this purchase.');
        if(data.status==='fulfilled'){
          if(data.packId)clearCheckout(session.user.id,data.packId);
          if(data.wallet)arcade?.applyServerWallet?.(data.wallet);
          $('refresh-button').click();
          message(Number(data.refundedCoins)>0
            ? 'This purchase was fully or partly refunded. Your current balance is updated.'
            : Number.isSafeInteger(data.coins)&&data.coins>0
            ? `Purchase confirmed · ${data.coins.toLocaleString()} coins added. Enjoy your next unlock!`
            : 'Purchase confirmed. Your current balance is updated.');
          history.replaceState(null,'',location.pathname+'#coin-shop');return;
        }
      }catch(error){message(error.message,true);return;}
      await new Promise(resolve=>setTimeout(resolve,1500));
    }
    message('Your payment is still being confirmed. Refresh to check again; you will not be charged twice.');
  }
  let playKey=null;
  for(const [game,name] of Object.entries(arcade?.names||{})){const option=document.createElement('option');option.value=game;option.textContent=name;$('play-game').append(option);}
  $('buy-plays').addEventListener('click',async()=>{
    const session=await window.EarnlyCloud?.session?.();if(!session){$('auth-modal').showModal();return;}
    const button=$('buy-plays');button.disabled=true;const game=$('play-game').value;
    if(!playKey||playKey.game!==game)playKey={game,key:crypto.randomUUID()};
    try {
      await window.EarnlyCloud?.syncServerRewards?.();
      const data=await api('/plays/buy',{body:{game,cost:5000},key:playKey.key,account:session.user.id});playKey=null;
      if((await window.EarnlyCloud?.session?.())?.user?.id!==session.user.id)throw new Error('Your account changed. Return to your account to check your extra plays.');
      arcade?.applyServerWallet?.(data.wallet);$('refresh-button').click();
      await window.EarnlyPaidPlays?.refresh();
      $('play-status').textContent=`${data.remaining} extra plays ready for ${arcade.names[game]}.`; $('play-status').className='';
    }catch(error){$('play-status').textContent=error.message;$('play-status').className='error';}
    finally{button.disabled=false;}
  });
  const delivering=new Map();
  async function deliver(signedTransaction){
    if(delivering.has(signedTransaction))return delivering.get(signedTransaction);
    const task=(async()=>{
      const session=await window.EarnlyCloud?.session?.();if(!session)throw new Error('Sign in to complete your pending purchase.');
      const data=await api('/verify',{apple:true,account:session.user.id,body:{signedTransaction}});
      if((!['fulfilled','revoked'].includes(data.status)&&typeof data.active!=='boolean')||!/^\d+$/.test(data.transactionId))throw new Error('Purchase confirmation is incomplete. Reopen the shop to retry.');
      await apple.finish({transactionId:data.transactionId});
      if((await window.EarnlyCloud?.session?.())?.user?.id!==session.user.id)return;
      if(data.wallet)arcade?.applyServerWallet?.(data.wallet);$('refresh-button').click();
      if(typeof data.active==='boolean'){window.dispatchEvent(new Event('earnly-pass-recover'));message(data.active?'VIP restored.':'VIP subscription is inactive.');return;}
      message(data.status==='fulfilled'?'Purchase confirmed · your Arcade Coins are ready!':'This purchase was refunded. Your balance is updated.');
    })();
    delivering.set(signedTransaction,task);try{return await task;}finally{delivering.delete(signedTransaction);}
  }
  async function recover(){
    if(!native||!apple||!(await window.EarnlyCloud?.session?.()))return;
    try {
      let failed=0,restricted=0;
      for(const signed of (await apple.pending()).transactions||[]){
        try {await deliver(signed);}catch(error){if(['SANDBOX_TEST_ACCOUNT_REQUIRED','TRANSACTION_OWNER_MISMATCH'].includes(error.code))restricted++;else failed++;}
      }
      if(restricted&&!failed)message(restricted+' pending purchase'+(restricted===1?' belongs':'s belong')+' to another or ineligible test account. They remain pending. Any purchases confirmed for this account have been applied.',true);
      if(failed)message('Checked pending purchases. '+failed+' could not be verified and remain pending. Any confirmed purchases have been applied.',true);
    }
    catch(error){message(error.message,true);}
  }
  async function buyApple(pack,packs,session){
    busy=true;render(packs);message('Opening Apple purchase…');
    try{
      const result=await apple.purchase({productId:pack.productId,accountToken:session.user.id});
      if(result.status==='purchased')await deliver(result.signedTransaction);
      else if(result.status==='pending')message('Waiting for Apple approval. Your coins will arrive after confirmation.');
      else if(result.status==='cancelled')message('Purchase cancelled. Your balance is unchanged.');
      else throw new Error('Reopen the shop to check this purchase.');
    }catch(error){message(error.message,true);}finally{busy=false;render(packs);}
  }
  render(native?fallback.map(p=>({...p,priceCents:0})):fallback);
  let bound=false;
  async function init(){
    const sequence=++configSequence;
    try{
      if(native&&!apple)throw new Error('Apple purchases are not available in this build.');
      const config=await api('/config',{apple:native});
      let packs=config.packs;
      if(native){const products=(await apple.products()).products||[];packs=packs.map(p=>({...p,displayPrice:products.find(item=>item.id===p.productId)?.displayPrice}));}
      if(sequence!==configSequence)return;
      available=config.available;verifiedPrices=true;render(packs);
      message(native?(available?'Secure Apple purchase · one-time coin packs':'Apple coin packs are coming soon. Earn coins by playing.'):(available?'Secure card checkout · one-time purchase':'Card purchases are coming soon. Free coins and cosmetic unlocks are available now.'));
    }catch(error){available=false;verifiedPrices=false;render(native?fallback.map(p=>({...p,priceCents:0})):fallback);message(native?error.message:'Card purchases are coming soon. Keep earning free coins by playing.');}
    await refreshAccount();if(native)await recover();else await checkOrder();
    if(bound)return;bound=true;
    window.EarnlyCloud?.client?.auth?.onAuthStateChange?.(event=>{if(event!=='TOKEN_REFRESHED')setTimeout(()=>{refreshAccount();native?recover():checkOrder();},0);});
    if(native&&apple){await apple.addListener('transaction',event=>deliver(event.signedTransaction).catch(error=>message(error.message,true)));window.addEventListener('focus',recover);window.addEventListener('online',recover);}
  }
  window.addEventListener('earnly-cloud-ready',init,{once:true});
  window.addEventListener('earnly-cosmetics-change',refreshAccount);
  if(window.EarnlyCloud)init();
})();
