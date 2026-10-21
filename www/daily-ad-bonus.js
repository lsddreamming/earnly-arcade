/* Progress comes only from verified server receipts, never the SDK reward event. */
(() => {
  const root=document.getElementById('daily-furniture-boost');
  if(!root)return;
  let state=null,busy=false,pending=false,timer;
  root.innerHTML='<h2>Daily Furniture Boost</h2><p>Complete 5 rewarded ads today to earn <strong>100 Arcade Coins</strong> for your room.</p><progress max="5" value="0" aria-label="Verified ads today" style="width:100%"></progress><p data-progress></p><p data-status role="status" aria-live="polite"></p><button type="button" class="btn" data-watch>Watch ad · Build your boost</button><p><small>Extra-life and extra-play ads count too. One bonus per day. Each completed ad session counts once.</small></p><p data-reset></p>';
  const q=s=>root.querySelector(s),watch=q('[data-watch]'),status=q('[data-status]');
  const capable=()=>window.EarnlyNativeAds?.isNative&&window.EarnlyNativeAds?.supportsDailyBonus;
  function paint(){
    if(!state?.enabled){root.hidden=true;root.style.display='none';return;}
    root.hidden=false;root.style.display='block';
    q('progress').value=state.watched;
    q('[data-progress]').textContent=state.watched+' / 5 completed'+(state.awarded?' · 100 Coins earned!':'');
    watch.disabled=busy||pending||state.awarded||!capable();
    watch.textContent=busy?'Loading ad…':pending?'Verifying your reward…':state.awarded?'Today’s boost complete':'Watch ad · Build your boost';
    q('[data-reset]').textContent='Resets '+new Date(state.resetAt).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'})+'.';
    if(!capable())status.textContent='Use the latest iPhone app to watch rewarded ads.';
  }
  async function refresh(){
    try{
      const next=await window.EarnlyCloud.adBonus();
      const wasAwarded=state?.awarded;state=next;paint();
      if(next.awarded&&!wasAwarded){
        const wallet=await window.EarnlyCloud.walletInfo();
        if(wallet)window.Arcade?.applyServerWallet?.(wallet);
      }
      return next;
    }catch{if(!busy&&!pending)status.textContent='Could not refresh your boost. Please try again shortly.';return null;}
  }
  async function poll(previous,attempt=0){
    const next=await refresh();
    if(next&&(next.watched>previous||next.awarded)){
      pending=false;status.textContent=next.awarded?'100 Arcade Coins added to your account!':'Ad verified. You’re closer to your next furniture piece.';paint();return;
    }
    if(attempt>=10){pending=false;status.textContent='Your ad is still being verified. Your progress will update when confirmation arrives.';paint();return;}
    timer=setTimeout(()=>poll(previous,attempt+1),3000);
  }
  watch.onclick=async()=>{
    if(busy||pending||state?.awarded||!capable())return;
    busy=true;status.textContent='';paint();const before=state.watched;
    try{
      const result=await window.EarnlyNativeAds.showRewarded('bonusCoins');
      if(result.earned){pending=true;status.textContent='Confirming your completed ad…';poll(before);}
      else status.textContent=result.reason==='dismissed'?'Ad closed before completion. Your progress is unchanged.':'No bonus ad available right now. Please try again later.';
    }catch{status.textContent='The ad could not load. Your progress is unchanged.';}
    finally{busy=false;paint();}
  };
  window.addEventListener('earnly-native-ads-ready',paint);
  window.addEventListener('focus',()=>{if(!busy&&!pending)refresh();});
  window.addEventListener('pagehide',()=>clearTimeout(timer));
  refresh();
})();
