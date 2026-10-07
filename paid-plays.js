/* Extra plays are account entitlements; all coin debits happen on the server.
 * A paid run is prepared online before the existing synchronous game start.
 * If a response is lost, the same request ID recovers that run on retry.
 */
(() => {
  const arcade=typeof Arcade!=='undefined'?Arcade:null;
  if(!arcade||location.protocol==='capacitor:'||window.Capacitor?.isNativePlatform?.())return;
  const endpoint='https://zdwziebtbpuolusztede.supabase.co/functions/v1/coin-shop';
  let userId=null,credits={},epoch=0,loading=null;
  const preparing=new Set();
  const keyFor=game=>'earnly-paid-run:'+userId+':'+game;
  const read=game=>{try{return JSON.parse(localStorage.getItem(keyFor(game))||'null');}catch{return null;}};
  async function request(path,body,key){
    const session=await window.EarnlyCloud?.session?.();if(!session||session.user.id!==userId)throw new Error('Sign in to prepare your play.');
    const headers={Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'};if(key)headers['Idempotency-Key']=key;
    const response=await fetch(endpoint+path,{method:body?'POST':'GET',headers,body:body?JSON.stringify(body):undefined,cache:'no-store'});
    const data=await response.json();if(!response.ok)throw new Error(data.error?.message||'Could not prepare your play.');return data;
  }
  async function refresh(){
    if(loading)return loading;
    loading=(async()=>{
      const session=await window.EarnlyCloud?.session?.(),next=session?.user?.id||null;
      if(next!==userId){++epoch;userId=next;credits={};}
      if(!userId)return;
      const current=epoch;
      const data=await request('/plays');if(current!==epoch)return;
      credits=Object.fromEntries(data.credits.map(c=>[c.game,c.remaining]));
      window.dispatchEvent(new CustomEvent('earnly-paid-plays-change'));
    })().catch(()=>{}).finally(()=>{loading=null;});return loading;
  }
  function remaining(game){return userId?(credits[game]||0)+(read(game)?.ready?1:0):0;}
  function tryConsume(game){
    if(!userId)return false;
    const record=read(game);
    if(record?.ready){localStorage.removeItem(keyFor(game));window.dispatchEvent(new CustomEvent('earnly-paid-plays-change'));return true;}
    if(preparing.has(game))return false;
    preparing.add(game);const current=epoch,storageKey=keyFor(game),key=record?.key||crypto.randomUUID();
    localStorage.setItem(storageKey,JSON.stringify({key,ready:false}));
    arcade.toast('Preparing your extra play…');
    request('/plays/consume',{game},key).then(data=>{
      if(current!==epoch)return;
      credits[game]=data.remaining;localStorage.setItem(storageKey,JSON.stringify({key,ready:true}));
      arcade.toast('Extra play ready! Tap Play again to start.');window.dispatchEvent(new CustomEvent('earnly-paid-plays-change'));
    }).catch(error=>{if(current===epoch)arcade.toast(error.message);}).finally(()=>preparing.delete(game));
    return false;
  }
  window.EarnlyPaidPlays={refresh,remaining,tryConsume};
  function bind(){window.EarnlyCloud?.client?.auth?.onAuthStateChange?.(event=>{
    if(event==='SIGNED_OUT'||event==='SIGNED_IN'){++epoch;userId=null;credits={};}
    if(event!=='TOKEN_REFRESHED')setTimeout(refresh,0);
  });refresh();}
  window.addEventListener('earnly-cloud-ready',bind,{once:true});
  window.addEventListener('online',refresh);
  window.addEventListener('focus',refresh);
  if(window.EarnlyCloud)bind();
})();
