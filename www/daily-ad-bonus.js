/* Progress comes only from verified server receipts, never the SDK reward event. */
(() => {
  const root=document.getElementById('daily-furniture-boost');
  if(!root)return;
  let state=null,busy=false,pending=false,timer;
  root.innerHTML='<h3>Watch ads · Earn Coins</h3><p data-offer></p><progress max="5" value="0" aria-label="Verified ads today" style="width:100%"></progress><p data-progress></p><p data-status role="status" aria-live="polite"></p><button type="button" class="btn" data-watch>Watch ad · Build your boost</button><details><summary>How it works</summary><p>Extra-life and extra-play ads count too. Your first five verified ads earn daily rewards. Each ad counts once.</p></details><p data-reset></p>';
  const q=s=>root.querySelector(s),watch=q('[data-watch]'),status=q('[data-status]');
  const capable=()=>window.EarnlyNativeAds?.isNative&&window.EarnlyNativeAds?.supportsDailyBonus;
  function paint(){
    if(!state?.enabled){root.hidden=true;root.style.display='none';return;}
    root.hidden=false;root.style.display='block';
    q('progress').max=state.goal||5;
    q('progress').value=state.watched;
    const perAd=Number(state.perAdCoins||0),total=Number(state.coins||100);
    q('[data-offer]').textContent=perAd?`+${perAd} Coins each ad · +${state.completionBonus} bonus at 5. Up to ${total} Coins today.`:`Complete 5 rewarded ads today to earn ${total} Arcade Coins for your room.`;
    q('[data-progress]').textContent=state.watched+' / 5 completed · '+Number(state.earnedCoins??(state.awarded?state.coins||100:0))+' Coins earned';
    watch.disabled=busy||pending||state.awarded||!capable();
    watch.textContent=busy?'Loading ad…':pending?'Verifying your reward…':state.awarded?'Today’s boost complete':(perAd?`Watch ad · +${perAd} Coins${state.watched===4?` + ${state.completionBonus} bonus`:''}`:'Watch ad · Build your boost');
    q('[data-reset]').textContent='Resets '+new Date(state.resetAt).toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'})+'.';
    if(!capable())status.textContent='Use the latest iPhone app to watch rewarded ads.';
  }
  async function refresh(){
    try{
      const next=await window.EarnlyCloud.adBonus();
      const priorEarned=state?.earnedCoins??(state?.awarded?state.coins||100:0);
      const earned=next.earnedCoins??(next.awarded?next.coins||100:0);
      state=next;paint();
      if(earned>priorEarned){
        const wallet=await window.EarnlyCloud.walletInfo();
        if(wallet)window.Arcade?.applyServerWallet?.(wallet);
      }
      return next;
    }catch{if(!busy&&!pending)status.textContent='Could not refresh your boost. Please try again shortly.';return null;}
  }
  async function poll(previous,attempt=0){
    const next=await refresh();
    if(next&&(next.watched>previous||next.awarded)){
      pending=false;status.textContent=next.awarded?`${next.earnedCoins??next.coins??100} Arcade Coins earned today!`:next.perAdCoins?`${next.perAdCoins} Arcade Coins added to your account!`:'Ad verified. You’re closer to your next furniture piece.';paint();return;
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
