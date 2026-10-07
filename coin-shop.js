/* Website-only hosted checkout. A redirect never grants currency. */
(() => {
  const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/coin-shop';
  const $=id=>document.getElementById(id);
  const arcade=typeof Arcade!=='undefined'?Arcade:null;
  const native=window.Capacitor?.isNativePlatform?.()||location.protocol==='capacitor:';
  if(native){$('coin-shop').hidden=true;$('get-coins-link').hidden=true;return;}
  const fallback=[{id:'starter',coins:500,priceCents:199},{id:'plus',coins:1500,priceCents:499},{id:'vault',coins:4000,priceCents:999}];
  let available=false,busy=false,configSequence=0;
  const pending=new Map();
  const message=(text,error=false)=>{$('coin-status').textContent=text;$('coin-status').className=error?'error':'';};
  async function api(path,options={}) {
    const session=await window.EarnlyCloud?.session?.();
    if(options.account && session?.user?.id!==options.account)throw new Error('Your account changed. Try again after signing in.');
    const headers={'Content-Type':'application/json'};
    if(session)headers.Authorization='Bearer '+session.access_token;
    if(options.key)headers['Idempotency-Key']=options.key;
    const response=await fetch(endpoint+path,{method:options.body?'POST':'GET',headers,body:options.body?JSON.stringify(options.body):undefined,cache:'no-store'});
    const data=await response.json();
    if(!response.ok){const error=new Error(data.error?.message||'Could not complete the request.');error.code=data.error?.code;throw error;}
    return data;
  }
  function render(packs) {
    $('coin-packs').replaceChildren();
    for(const pack of packs) {
      const card=document.createElement('article');card.className='coin-pack';
      const amount=document.createElement('div');amount.className='coin-amount';amount.textContent='◈ '+pack.coins.toLocaleString();
      const note=document.createElement('p');note.textContent='Arcade Coins';
      const button=document.createElement('button');button.type='button';button.textContent=available?'$'+(pack.priceCents/100).toFixed(2)+' · Buy':'$'+(pack.priceCents/100).toFixed(2)+' · Soon';
      button.disabled=!available||busy;button.setAttribute('aria-label',`Buy ${pack.coins} Arcade Coins for $${(pack.priceCents/100).toFixed(2)}`);
      button.addEventListener('click',async()=>{
        if(busy)return;
        const session=await window.EarnlyCloud?.session?.();if(!session){$('auth-modal').showModal();return;}
        busy=true;render(packs);message('Opening secure card checkout…');
        const key=pending.get(pack.id)||crypto.randomUUID();pending.set(pack.id,key);
        try {
          const data=await api('/checkout',{body:{packId:pack.id},key,account:session.user.id});
          if((await window.EarnlyCloud?.session?.())?.user?.id!==session.user.id)throw new Error('Your account changed. Return to your account to check this order.');
          if(data.fulfilled){pending.delete(pack.id);location.assign('avatars.html?coin_order='+encodeURIComponent(data.orderId)+'#coin-shop');return;}
          const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Checkout could not open.');
          location.assign(url.href);
        } catch(error){if(error.code==='CHECKOUT_EXPIRED')pending.delete(pack.id);message(error.message,true);busy=false;render(packs);}
      });
      card.append(amount,note,button);$('coin-packs').append(card);
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
          if(data.wallet)arcade?.applyServerWallet?.(data.wallet);
          $('refresh-button').click();
          message(Number.isSafeInteger(data.coins)&&data.coins>0
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
      const data=await api('/plays/buy',{body:{game},key:playKey.key,account:session.user.id});playKey=null;
      if((await window.EarnlyCloud?.session?.())?.user?.id!==session.user.id)throw new Error('Your account changed. Return to your account to check your extra plays.');
      arcade?.applyServerWallet?.(data.wallet);$('refresh-button').click();
      await window.EarnlyPaidPlays?.refresh();
      $('play-status').textContent=`${data.remaining} extra plays ready for ${arcade.names[game]}.`; $('play-status').className='';
    }catch(error){$('play-status').textContent=error.message;$('play-status').className='error';}
    finally{button.disabled=false;}
  });
  render(fallback);
  async function init(){const sequence=++configSequence;try{const config=await api('/config');if(sequence!==configSequence)return;available=config.available;render(config.packs);message(available?'Secure card checkout · one-time purchase':'Card purchases are coming soon. Free coins and cosmetic unlocks are available now.');}catch{available=false;render(fallback);message('Card purchases are coming soon. Keep earning free coins by playing.');}await refreshAccount();await checkOrder();window.EarnlyCloud?.client?.auth?.onAuthStateChange?.(event=>{if(event!=='TOKEN_REFRESHED')setTimeout(()=>{refreshAccount();checkOrder();},0);});}
  window.addEventListener('earnly-cloud-ready',init,{once:true});
  window.addEventListener('earnly-cosmetics-change',refreshAccount);
  if(window.EarnlyCloud)init();
})();
