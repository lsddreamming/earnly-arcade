/* Subscription UI never grants entitlement. The server verifies both providers. */
(()=>{
 const $=id=>document.getElementById(id),native=window.Capacitor?.isNativePlatform?.()||location.protocol==='capacitor:',apple=window.EarnlyApplePurchases;
 const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/arcade-pass';
 let config={},busy=false,requestId=null;
 const say=text=>$('pass-status').textContent=text;
 async function api(path,body){const session=await window.EarnlyCloud?.session?.();const response=await fetch(endpoint+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(session?{Authorization:'Bearer '+session.access_token}:{}),...(requestId?{'Idempotency-Key':requestId}:{})},body:body?JSON.stringify(body):undefined,cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Pass service is unavailable.');return data;}
 async function refresh(){try{
  config=await api('/config');const session=await window.EarnlyCloud?.session?.();const state=session?await api('/me'):{active:false};state.furnitureAvailable=config.furnitureAvailable===true;state.giftMonth=config.giftMonth;window.EarnlyPass=state;
  const available=native?config.appleAvailable:config.webAvailable;
  let price='$4.99';if(native&&apple){const products=(await apple.products()).products||[];price=products.find(p=>p.id===config.productId)?.displayPrice||'';}
  $('pass-buy').disabled=!available||!price||busy||state.active;$('pass-buy').textContent=state.active?'VIP active':available&&price?price+' / month · Subscribe':'Coming soon';
  $('pass-disclosure').textContent=(available&&price?price+'/month':'$4.99/month when available')+', auto-renewing. Cancel anytime in subscription settings. Frame and effect last through your paid period. Paid-month furniture gifts stay after cancellation. No coins or cash-equivalent rewards.';
  document.querySelector('#vip-pass summary span').textContent='Cosmetic perks · '+(available&&price?price+'/month':'Coming soon');
  $('pass-manage').hidden=!state.provider;$('pass-manage').dataset.provider=state.provider||'';
  window.dispatchEvent(new Event('earnly-pass-change'));
 }catch(error){say(error.message+' Free play and your owned items remain available.');}}
 async function deliver(signedTransaction){const data=await api('/apple/verify',{signedTransaction});await apple.finish({transactionId:data.transactionId});return data;}
 $('pass-buy').onclick=async()=>{if(busy)return;if(!(await window.EarnlyCloud?.session?.())){$('auth-modal').showModal();return;}busy=true;$('pass-buy').disabled=true;
 try{if(native){const session=await window.EarnlyCloud.session();const result=await apple.purchase({productId:config.productId,accountToken:session.user.id});if(result.status==='purchased'){await deliver(result.signedTransaction);say('VIP activated. Your cosmetics are ready.');}else say(result.status==='pending'?'Waiting for Apple approval.':'Purchase cancelled.');}
 else {requestId||=crypto.randomUUID();const data=await api('/checkout',{});const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com')throw new Error('Invalid checkout address.');location.assign(url.href);}}
 catch(error){say(error.message);}finally{busy=false;await refresh();}};
 $('pass-restore').onclick=async()=>{if(busy)return;busy=true;try{if(native&&apple){const data=await apple.restore();for(const signed of data.transactions||[])await deliver(signed);}await refresh();say(window.EarnlyPass?.active?'VIP restored.':'Account ownership refreshed. Consumable coin balances restore by signing in; spent coins are not re-granted.');}catch(error){say(error.message);}finally{busy=false;}};
 $('pass-manage').onclick=async()=>{try{if($('pass-manage').dataset.provider==='apple'){if(native&&apple)await apple.manage();else location.assign('https://apps.apple.com/account/subscriptions');}else if(native){say('Your pass was purchased on the website. Manage it from your website account.');}else{const data=await api('/portal',{});const url=new URL(data.url);if(url.protocol!=='https:'||url.hostname!=='billing.stripe.com')throw new Error('Invalid management address.');location.assign(url.href);}}catch(error){say(error.message);}};
 window.addEventListener('earnly-pass-recover',refresh);window.addEventListener('focus',refresh);
 window.addEventListener('earnly-cloud-ready',refresh,{once:true});window.addEventListener('earnly-cloud-auth-change',refresh);if(window.EarnlyCloud)refresh();
})();
