/* Only server receipts can advance progress or update the wallet. */
(() => {
  const root=document.getElementById('daily-furniture-boost');
  if(!root)return;
  const availability=document.querySelector('.earn-ads-availability');
  let state=null,busy=false,pending=false,refreshFailed=false,refreshing=null,timer=0,epoch=0,suspended=false,receipt=null,polling=false,walletPending=false;
  root.innerHTML='<h3>Watch ads · Earn Coins</h3><p data-offer></p><progress max="5" value="0" aria-label="Verified ads today" style="width:100%"></progress><p data-progress></p><p data-status role="status" aria-live="polite"></p><button type="button" class="btn" data-watch hidden>Watch ad</button><button type="button" class="btn" data-retry hidden>Check rewards again</button><details><summary>How it works</summary><p>Completed extra-life and extra-play ads count too. Only server-verified ads count, once each. Rewards and daily limits are shown above.</p></details><p data-reset></p>';
  const q=s=>root.querySelector(s),watch=q('[data-watch]'),retry=q('[data-retry]'),status=q('[data-status]');
  const native=()=>!!window.EarnlyNativeAds?.isNative;
  const capable=()=>native()&&!!window.EarnlyNativeAds?.supportsDailyBonus&&typeof window.EarnlyNativeAds?.showRewarded==='function';
  const count=n=>Number.isFinite(Number(n))?Math.max(0,Math.floor(Number(n))):0;
  const earned=s=>count(s?.earnedCoins??(s?.awarded?s.coins:0));
  function paint(){
    const offered=state?.enabled===true&&capable(),shown=capable()&&(offered||refreshFailed);
    root.hidden=!shown;root.style.display=shown?'block':'none';root.setAttribute('aria-busy',String(busy||!!refreshing));
    if(availability){
      availability.hidden=shown;
      availability.textContent=!native()?'Video rewards are not available on this website yet. Claim your daily bonus or play to earn Coins.':refreshing?'Checking video rewards…':'Video rewards are not available right now. Your daily bonus and games are still available.';
    }
    for(const selector of ['[data-offer]','progress','[data-progress]','details','[data-reset]'])q(selector).hidden=!offered;
    watch.hidden=!offered;retry.hidden=!refreshFailed;retry.disabled=busy||!!refreshing;
    watch.disabled=!offered||busy||pending||!!refreshing||refreshFailed||!!state?.awarded;
    if(!offered)return;
    const goal=count(state.goal)||5,watched=Math.min(goal,count(state.watched)),perAd=count(state.perAdCoins),bonus=count(state.completionBonus),total=count(state.coins);
    q('progress').max=goal;q('progress').value=watched;
    q('[data-offer]').textContent=perAd?`+${perAd} Coins per verified ad${bonus?` · +${bonus} bonus after ${goal}`:''}.`:`Complete ${goal} verified ads${total?` for ${total} Coins`:''}.`;
    q('[data-progress]').textContent=`${watched} / ${goal} verified today · ${earned(state)} Coins earned`;
    watch.textContent=busy?'Loading ad…':pending?'Verifying reward…':refreshing?'Checking rewards…':state.awarded?'Today’s reward complete':perAd?`Watch ad · +${perAd} Coins${bonus&&watched===goal-1?` + ${bonus} bonus`:''}`:'Watch ad';
    const reset=new Date(state.resetAt);
    q('[data-reset]').textContent=Number.isFinite(reset.getTime())?'Resets '+reset.toLocaleString([], {weekday:'short',hour:'numeric',minute:'2-digit'})+'.':'';
  }
  function refresh(){
    if(refreshing)return refreshing;
    if(typeof window.EarnlyCloud?.adBonus!=='function'){paint();return Promise.resolve(null);}
    const generation=epoch;
    const task=Promise.resolve().then(()=>window.EarnlyCloud.adBonus()).then(async next=>{
      if(generation!==epoch)return null;
      if(!next||typeof next!=='object')throw Error('Rewards unavailable');
      const prior=earned(state),changedDay=!!state&&next.resetAt!==state.resetAt;state=next;refreshFailed=false;
      if(earned(next)>prior||(changedDay&&earned(next)>0)||walletPending){
        walletPending=true;
        status.textContent=next.awarded?`${earned(next)} Coins earned today.`:'Your verified reward progress updated.';
        try{const wallet=await window.EarnlyCloud.walletInfo();if(generation===epoch&&wallet){const arcade=typeof Arcade!=='undefined'?Arcade:window.Arcade;if(typeof arcade?.applyServerWallet!=='function')throw Error('Wallet unavailable');arcade.applyServerWallet(wallet);walletPending=false;}}catch{if(generation===epoch)status.textContent='Reward verified. Your wallet will refresh when the connection returns.';}
      }
      return generation===epoch?next:null;
    }).catch(()=>{
      if(generation===epoch){refreshFailed=true;status.textContent='Could not check rewards. Your Coins are unchanged. Please try again.';}
      return null;
    }).finally(()=>{if(generation===epoch&&refreshing===task){refreshing=null;paint();}});
    refreshing=task;paint();return task;
  }
  function clearPoll(){clearTimeout(timer);timer=0;}
  async function poll(attempt=0){
    clearPoll();
    if(!pending||!receipt||polling||suspended||document.hidden)return;
    const generation=epoch,before=receipt;polling=true;
    const next=await refresh();
    if(generation!==epoch)return;
    polling=false;
    if(!pending)return;
    if(next&&(count(next.watched)>before.watched||(next.resetAt!==before.resetAt&&count(next.watched)>0))){
      pending=false;receipt=null;status.textContent=next.awarded?`${earned(next)} Coins earned today!`:'Ad verified. Your reward progress is up to date.';paint();return;
    }
    if(attempt>=10){pending=false;receipt=null;status.textContent='Your ad is still being verified. Confirmed rewards will appear when you return.';paint();return;}
    if(!suspended&&!document.hidden)timer=setTimeout(()=>poll(attempt+1),3000);
  }
  watch.onclick=async()=>{
    if(busy||pending||refreshing||refreshFailed||state?.enabled!==true||state.awarded||!capable())return;
    const generation=epoch,before={watched:count(state.watched),resetAt:state.resetAt};
    busy=true;status.textContent='';paint();
    try{
      const result=await window.EarnlyNativeAds.showRewarded('bonusCoins');
      if(generation!==epoch)return;
      if(result?.earned){pending=true;receipt=before;status.textContent='Confirming your completed ad…';poll();}
      else status.textContent=result?.reason==='dismissed'?'Ad closed before completion. No reward was added.':'No video available right now. No reward was added.';
    }catch{if(generation===epoch)status.textContent='The video could not load. No reward was added.';}
    finally{if(generation===epoch){busy=false;paint();}}
  };
  retry.onclick=()=>{if(!busy)pending?poll():refresh();};
  function resume(){suspended=false;if(busy)return;pending?poll():refresh();}
  function accountChanged(){epoch++;clearPoll();state=null;receipt=null;refreshing=null;busy=false;pending=false;polling=false;walletPending=false;refreshFailed=false;status.textContent='';paint();refresh();}
  window.addEventListener('earnly-native-ads-ready',()=>{paint();refresh();});
  window.addEventListener('earnly-cloud-ready',refresh);
  window.addEventListener('earnly-cloud-auth-change',accountChanged);
  window.addEventListener('earnly-server-rewards-synced',resume);
  window.addEventListener('focus',resume);
  window.addEventListener('pageshow',resume);
  window.addEventListener('pagehide',()=>{suspended=true;clearPoll();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearPoll();else resume();});
  paint();refresh();
})();
