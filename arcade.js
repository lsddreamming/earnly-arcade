// Prototype storage only. Coins are non-redeemable; no real ad SDK is connected.
const Arcade = (() => {
  const names = {snake:'Snake',blockDrop:'Block Drop'};
  const day = () => {const d=new Date();return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
  const number = key => {const n=Number(localStorage.getItem(key));return Number.isFinite(n)&&n>=0?Math.floor(n):0;};
  function refresh(){if(localStorage.getItem('arcadePlayDay')!==day()){Object.keys(names).forEach(g=>localStorage.setItem(g+'GamesPlayed','0'));localStorage.setItem('arcadePlayDay',day());}}
  function remaining(g){refresh();return Math.max(0,3-number(g+'GamesPlayed'));}
  function consume(g){if(!remaining(g))return false;localStorage.setItem(g+'GamesPlayed',number(g+'GamesPlayed')+1);return true;}
  function earn(n){localStorage.setItem('points',number('points')+n);}
  const modal=document.createElement('dialog');document.body.append(modal);
  let busy=false;
  function panel(title,message,actions){modal.replaceChildren();const h=document.createElement('h2');h.textContent=title;const p=document.createElement('p');p.textContent=message;modal.append(h,p);actions.forEach(([label,fn])=>{const b=document.createElement('button');b.className='wide';b.textContent=label;b.onclick=()=>{modal.close();fn();};modal.append(b);});modal.showModal();}
  function toast(message){let t=document.getElementById('arcadeToast');if(!t){t=document.createElement('div');t.id='arcadeToast';t.className='toast';t.setAttribute('role','status');document.body.append(t);}t.textContent=message;t.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.hidden=true,2800);}
  function ad(g,done=()=>{}){
    if(busy||remaining(g)>0)return;busy=true;let timer;
    panel('Demo ad — +3 '+names[g]+' plays','This is a 3-second simulation, not a real advertisement. Finish to unlock three plays; cancel anytime.',[['Cancel',()=>{}]]);
    const progress=document.createElement('progress');progress.max=3;progress.value=0;modal.append(progress);
    let elapsed=0;
    const cancel=()=>{clearInterval(timer);busy=false;};modal.addEventListener('close',cancel,{once:true});
    timer=setInterval(()=>{progress.value=++elapsed;if(elapsed===3){clearInterval(timer);refresh();localStorage.setItem(g+'GamesPlayed',number(g+'GamesPlayed')-3);modal.close();busy=false;toast('+3 '+names[g]+' Plays');done();}},1000);
  }
  function out(g,done){panel('Out of '+names[g]+' plays','Watch a demo ad for 3 more plays, or come back tomorrow for your daily refill.',[['Watch demo ad · +3 plays',()=>ad(g,done)],['Back to Arcade',()=>location.href='games.html']]);}
  return {names,remaining,consume,earn,panel,toast,ad,out,number};
})();
