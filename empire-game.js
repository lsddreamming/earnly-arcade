'use strict';
const venues=[
 ['Neighborhood Arcade','Star Patrol','Pinball Alley','Plush Crane'],['Retro Gaming Center','Pixel Racer','Vector Arena','Rhythm Room'],['Modern Gaming Lounge','Drift Pods','Dance Stage','Tournament Booth'],['Bowling & Arcade Center','Cosmic Lanes','Strike Lounge','Prize Wall'],['Virtual Reality Center','Orbit Pods','Holo Maze','Flight Deck'],['Family Entertainment Complex','Mini Golf','Kart Track','Laser Tag'],['Indoor Amusement Park','Carousel','Drop Tower','Sky Swings'],['Water Park','Wave Pool','Splash Flume','Surf School'],['Mega Theme Park','Comet Coaster','Ferris Wheel','River Rapids'],['Luxury Entertainment Resort','Cabana Club','Lagoon Stage','Sky Suites'],['International Entertainment Empire','Tokyo Dome','Paris Pavilion','Sydney Harbor'],['Space Entertainment Center','Lunar Lanes','Zero-G Rink','Nebula Theater']
];
const names=['Attractions','Attendants','Floor manager','Waiting lounge','Night shift'];
const key='earnly.empire.guest.v1';
const fresh=()=>({venue:0,levels:[1,0,0,0,0],cash:0,lifetime:0,served:0,stamp:0,claimed:0,sound:false,nextInvestor:0,boostStart:0,boostUntil:0,offlineOffer:null});
let state=fresh();
try{const s=JSON.parse(localStorage.getItem(key));if(s&&venues[s.venue]&&s.levels?.length===5&&s.levels.every(n=>Number.isInteger(n)&&n>=0&&n<=50)&&Number.isFinite(s.cash)&&Number.isFinite(s.lifetime))state={...state,...s}}catch{}
state.studio=studioSave(state.studio);
const BOOST_MS=10*60*1000;
const safeTime=n=>Number.isFinite(n)&&n>=0?n:0;
state.nextInvestor=safeTime(state.nextInvestor);
state.boostStart=safeTime(state.boostStart);
state.boostUntil=safeTime(state.boostUntil);
if(!state.boostStart||state.boostUntil-state.boostStart!==BOOST_MS)state.boostStart=state.boostUntil=0;
const restoredOffer=state.offlineOffer;
state.offlineOffer=restoredOffer&&typeof restoredOffer.id==='string'&&Number.isFinite(restoredOffer.amount)&&restoredOffer.amount>0&&Number.isFinite(restoredOffer.seconds)&&restoredOffer.seconds>=60?
 {id:restoredOffer.id,amount:restoredOffer.amount,seconds:restoredOffer.seconds}:null;
let offlineClaimInFlight=false;
const $=s=>document.querySelector(s), fmt=n=>new Intl.NumberFormat('en',{notation:n>=10000?'compact':'standard',maximumFractionDigits:0}).format(n);
const unit=()=>8**state.venue;
const price=i=>Math.ceil(unit()*[22,30,150,48,65][i]*1.55**state.levels[i]);
const ticket=()=>unit()*(3+state.levels[0]*2+state.levels[3]);
const rate=()=>ticket()*state.levels[1]*(1+state.levels[2]*.15)/24;
const expansion=()=>unit()*14000*(1+state.venue*.6);
let tab='Floor',zoom=1,lastSale=-20,lastTick=performance.now(),serverBase=0,baseTick=0,settling=false,paused=false;
function save(){try{localStorage.setItem(key,JSON.stringify(state));return true}catch{$('#notice').textContent='Storage unavailable. Progress lasts for this visit.';return false}}
// Commit the claim and its payout together. Do not display a successful reward if storage failed.
function commitReward(mutate){
 const previous={...state};
 if(!mutate())return false;
 if(save())return true;
 Object.assign(state,previous);return false;
}
function profitMultiplier(now=Date.now()){return now>=state.boostStart&&now<state.boostUntil?2:1}
function boostActive(now=Date.now()){return state.boostUntil>now}
function beginProfitBoost(now=Date.now()){
 return commitReward(()=>{if(boostActive(now))return false;state.boostStart=now;state.boostUntil=now+BOOST_MS;return true});
}
function addOfflineOffer(amount,seconds){
 const old=state.offlineOffer;
 // Keep the same ID when another settlement occurs while an ad is in flight.
 state.offlineOffer={id:old?.id||String(state.stamp),amount:(old?.amount||0)+amount,seconds:(old?.seconds||0)+seconds};
}
function claimOfflineBonus(offer){
 return commitReward(()=>{
  const current=state.offlineOffer;
  if(!offer||!current||current.id!==offer.id||!Number.isFinite(offer.amount)||offer.amount<=0||current.amount<offer.amount)return false;
  credit(offer.amount);
  const remaining=current.amount-offer.amount;
  // A later settlement must not be included in an ad that advertised a smaller reward.
  state.offlineOffer=remaining>0?{id:String(state.stamp)+':next',amount:remaining,seconds:Math.max(60,current.seconds-offer.seconds)}:null;
  return true;
 });
}
function presentOffline(){
 const offer=state.offlineOffer;if(!offer)return;
 $('#away').textContent=fmt(offer.seconds/60)+' minutes away earned $'+fmt(offer.amount)+' for your arcade. Your base profits are already collected.';
 if(!offlineClaimInFlight&&!$('dialog').open&&!document.hidden)$('dialog').showModal();
}
function dismissOffline(){
 if(!offlineClaimInFlight){state.offlineOffer=null;save()}
 if($('dialog').open)$('dialog').close();
}
function credit(n){state.cash+=n;state.lifetime+=n}
function ding(){if(!state.sound)return;try{const ctx=ding.ctx||=new AudioContext();ctx.resume().catch(()=>{});const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(620,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(940,ctx.currentTime+.09);g.gain.setValueAtTime(.045,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.14);o.start();o.stop(ctx.currentTime+.15)}catch{}}
function action(msg){save();ding();$('#notice').textContent=msg;render()}
function row(title,detail,label,fn,disabled=false){const r=document.createElement('div');r.className='row line';const d=document.createElement('div'),b=document.createElement('strong'),s=document.createElement('small');b.textContent=title;s.textContent=detail;d.append(b,s);r.append(d);if(label){const btn=document.createElement('button');btn.textContent=label;btn.disabled=disabled;btn.onclick=fn;r.append(btn)}$('#panel').append(r)}
let studioFraction=0, lastShift=-10;
function runStudio(seconds){
 if(!state.studio.rooms)return 0;
 const elapsed=studioFraction+seconds,ticks=Math.floor(elapsed);
 studioFraction=elapsed-ticks;
 return staffStudio(state.studio,ticks)*120;
}
// Double revenue, not staffing ticks, and honor activation/expiry inside a tick.
function activeIncome(seconds,now=Date.now()){
 const start=now-seconds*1000, from=Math.max(start,state.boostStart), to=Math.min(now,state.boostUntil);
 if(to<=from)return rate()*seconds+runStudio(seconds);
 const before=(from-start)/1000, during=(to-from)/1000, after=Math.max(0,seconds-before-during);
 return rate()*(seconds+during)+runStudio(before)+2*runStudio(during)+runStudio(after);
}
function renderStudio(){
 const studio=state.studio;
 row('Studio director','Ship 25 campaigns to win the studio contract · '+studio.deals+' / 25');
 if(studio.deals>=25)row('Studio contract won','Your team keeps producing campaigns.');
 const output=['builds ready','tested apps ready','campaigns sold'];
 studioJobs.forEach((job,i)=>{
   if(i>=studio.rooms){
     const count=i===0?state.served:studio.stock[i-1];
     const need=i===0?'counter sales':output[i-1];
     row(job.room,'Open after '+job.goal+' '+need+' · '+count+' ready','$'+fmt(job.cost),()=>{
       if(studio.rooms!==i || (i===0?state.served:studio.stock[i-1])<job.goal || state.cash<job.cost)return;
       state.cash-=job.cost;studio.rooms++;action(job.room+' is staffed and open');
     },i!==studio.rooms||count<job.goal||state.cash<job.cost);
     return;
   }
   const total=i===2?studio.deals:studio.stock[i];
   const blocked=i<2&&studio.stock[i]>=40 || i>0&&!studio.stock[i-1];
   row(job.room+' · '+job.role,total+' '+output[i]+' · '+(blocked?'Waiting for '+(i>0&&!studio.stock[i-1]?'input':'space'):studio.work[i]+' / '+job.time+'s')+(i===2?' · $120 per campaign':''),'Work shift',()=>{
     if(performance.now()/1000-lastShift<5 || i>0&&!studio.stock[i-1] || i<2&&studio.stock[i]>=40)return;
     lastShift=performance.now()/1000;studio.work[i]=Math.min(job.time-1,studio.work[i]+8);
     action(job.role+' shift · project advanced');
   },blocked||performance.now()/1000-lastShift<5);
 });
}
function render(){
 $('#cash').textContent='$'+fmt(state.cash);$('#rate').textContent='$'+fmt(rate()*60*profitMultiplier())+'/min';$('#location').textContent=venues[state.venue][0];$('#sound').textContent=state.sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',state.sound);
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===tab));
 $('#panel').replaceChildren();
 if(tab==='Studio'){renderStudio();return}
 if(tab==='Empire'){
 row('Lifetime business earnings','$'+fmt(state.lifetime)+' · '+fmt(state.served)+' customers served by hand');
 const goal=25*2**state.claimed;row('Customer milestone',fmt(state.served)+' / '+fmt(goal)+' served','Collect',()=>{if(state.served<goal)return;state.claimed++;credit(ticket()*15);action('Milestone bonus collected')},state.served<goal);
 const next=venues[state.venue+1];if(next)row('Open '+next[0],'Start a fresh floor with 8× base ticket value.','$'+fmt(expansion()),()=>{if(state.cash<expansion())return;state.cash-=expansion();state.venue++;state.levels=[1,0,0,0,0];action('Your new location is open!')},state.cash<expansion());
 venues.forEach((v,i)=>row(v[0],i<=state.venue?v.slice(1).join(' · '):'Unlock after '+venues[i-1][0]));return}
 const details=['Higher ticket value · new machines at levels 4 and 8','Automatically serves paying customers','Increases attendant income by 15% per level','More seats and higher ticket value','Adds 30 minutes of offline capacity'];
 for(const i of tab==='Floor'?[0,3,4]:[1,2]){const level=state.levels[i],cost=price(i);row(names[i]+' · '+level,details[i],level===50?'Max':'$'+fmt(cost),()=>{if(level>=50||state.cash<cost)return;state.cash-=cost;state.levels[i]++;action(names[i]+' upgraded')},level>=50||state.cash<cost)}
}
$('#serve').onclick=()=>{if(paused||performance.now()/1000-lastSale<1.5)return;const revenue=ticket()*profitMultiplier();credit(revenue);state.served++;lastSale=performance.now()/1000;const register=$('#serve');register.disabled=true;register.textContent='Serving…';setTimeout(()=>{register.disabled=false;register.textContent='Serve a customer'},1500);action('+$'+fmt(revenue)+' at the register')};
$('#sound').onclick=()=>{state.sound=!state.sound;action(state.sound?'Sound on':'Sound off')};
$('#zoom').onclick=()=>{zoom=zoom===1?1.2:1;$('#zoom').textContent=zoom+'×'};
document.querySelector('nav').onclick=e=>{if(e.target.dataset.tab){tab=e.target.dataset.tab;render()}};
function checkpoint(){if(serverBase&&!paused)state.stamp=Math.max(state.stamp,serverBase+performance.now()-baseTick);save()}
async function syncClock(){if(settling)return;settling=true;try{
 let time;
 if(window.Capacitor?.isNativePlatform?.()){
  // Bundled Capacitor asset responses need not have an HTTP Date header.
  // Guest business cash is local-only and retains the existing offline cap.
  time=Date.now();
 }else{
  const response=await fetch('games.html',{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(5000)});
  time=Date.parse(response.headers.get('Date'));if(!response.ok)return;
 }
 if(!Number.isFinite(time)||document.hidden)return;
 serverBase=time;baseTick=performance.now();const hadStamp=state.stamp>0;const seconds=Math.max(0,(time-state.stamp)/1000),profit=state.stamp?Math.floor(Math.min(seconds,1800*(1+state.levels[4]))*rate()):0;state.stamp=Math.max(time,state.stamp);
 const awayProfit=profit+(seconds>=60&&hadStamp?runStudio(Math.min(seconds,1800*(1+state.levels[4]))):0);
 if(seconds>=60&&awayProfit>0){credit(awayProfit);addOfflineOffer(awayProfit,seconds)}
 save();presentOffline();
 }catch{}finally{settling=false;paused=document.hidden;lastTick=performance.now();render()}}
$('#collect').onclick=dismissOffline;
$('dialog').addEventListener('cancel',event=>{event.preventDefault();dismissOffline()});
document.addEventListener('visibilitychange',()=>{if(document.hidden){checkpoint();paused=true}else syncClock()});
window.addEventListener('pagehide',checkpoint);
setInterval(()=>{const now=performance.now();if(!paused&&!document.hidden&&!settling){const seconds=Math.min(5,(now-lastTick)/1000);credit(activeIncome(seconds));checkpoint();render()}lastTick=now},1000);
render();presentOffline();syncClock();
