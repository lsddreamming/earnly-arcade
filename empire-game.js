'use strict';
const venues=[
 ['Neighborhood Arcade','Star Patrol','Pinball Alley','Plush Crane'],['Retro Gaming Center','Pixel Racer','Vector Arena','Rhythm Room'],['Modern Gaming Lounge','Drift Pods','Dance Stage','Tournament Booth'],['Bowling & Arcade Center','Cosmic Lanes','Strike Lounge','Prize Wall'],['Virtual Reality Center','Orbit Pods','Holo Maze','Flight Deck'],['Family Entertainment Complex','Mini Golf','Kart Track','Laser Tag'],['Indoor Amusement Park','Carousel','Drop Tower','Sky Swings'],['Water Park','Wave Pool','Splash Flume','Surf School'],['Mega Theme Park','Comet Coaster','Ferris Wheel','River Rapids'],['Luxury Entertainment Resort','Cabana Club','Lagoon Stage','Sky Suites'],['International Entertainment Empire','Tokyo Dome','Paris Pavilion','Sydney Harbor'],['Space Entertainment Center','Lunar Lanes','Zero-G Rink','Nebula Theater']
];
const names=['Attractions','Attendants','Floor manager','Waiting lounge','Night shift'];
const key='earnly.empire.guest.v1';
const fresh=()=>({venue:0,levels:[1,0,0,0,0],cash:0,lifetime:0,served:0,stamp:0,claimed:0,sound:false});
let state=fresh();
try{const s=JSON.parse(localStorage.getItem(key));if(s&&venues[s.venue]&&s.levels?.length===5&&s.levels.every(n=>Number.isInteger(n)&&n>=0&&n<=50)&&Number.isFinite(s.cash)&&Number.isFinite(s.lifetime))state={...state,...s}}catch{}
const $=s=>document.querySelector(s), fmt=n=>new Intl.NumberFormat('en',{notation:n>=10000?'compact':'standard',maximumFractionDigits:0}).format(n);
const unit=()=>8**state.venue;
const price=i=>Math.ceil(unit()*[14,18,80,32,40][i]*1.35**state.levels[i]);
const ticket=()=>unit()*(3+state.levels[0]*2+state.levels[3]);
const rate=()=>ticket()*state.levels[1]*(1+state.levels[2]*.3)/4;
const expansion=()=>unit()*2200;
let tab='Floor',zoom=1,lastSale=-20,lastTick=performance.now(),serverBase=0,baseTick=0,settling=false,paused=false;
function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{$('#notice').textContent='Storage unavailable. Progress lasts for this visit.'}}
function credit(n){state.cash+=n;state.lifetime+=n}
function ding(){if(!state.sound)return;try{const ctx=ding.ctx||=new AudioContext();ctx.resume().catch(()=>{});const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(620,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(940,ctx.currentTime+.09);g.gain.setValueAtTime(.045,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.14);o.start();o.stop(ctx.currentTime+.15)}catch{}}
function action(msg){save();ding();$('#notice').textContent=msg;render()}
function row(title,detail,label,fn,disabled=false){const r=document.createElement('div');r.className='row line';const d=document.createElement('div'),b=document.createElement('strong'),s=document.createElement('small');b.textContent=title;s.textContent=detail;d.append(b,s);r.append(d);if(label){const btn=document.createElement('button');btn.textContent=label;btn.disabled=disabled;btn.onclick=fn;r.append(btn)}$('#panel').append(r)}
function render(){
 $('#cash').textContent='$'+fmt(state.cash);$('#rate').textContent='$'+fmt(rate()*60)+'/min';$('#location').textContent=venues[state.venue][0];$('#sound').textContent=state.sound?'Sound on':'Sound off';$('#sound').setAttribute('aria-pressed',state.sound);
 document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===tab));
 $('#panel').replaceChildren();
 if(tab==='Empire'){
 row('Lifetime business earnings','$'+fmt(state.lifetime)+' · '+fmt(state.served)+' customers served by hand');
 const goal=25*2**state.claimed;row('Customer milestone',fmt(state.served)+' / '+fmt(goal)+' served','Collect',()=>{if(state.served<goal)return;state.claimed++;credit(ticket()*15);action('Milestone bonus collected')},state.served<goal);
 const next=venues[state.venue+1];if(next)row('Open '+next[0],'Start a fresh floor with 8× base ticket value.','$'+fmt(expansion()),()=>{if(state.cash<expansion())return;state.cash-=expansion();state.venue++;state.levels=[1,0,0,0,0];action('Your new location is open!')},state.cash<expansion());
 venues.forEach((v,i)=>row(v[0],i<=state.venue?v.slice(1).join(' · '):'Unlock after '+venues[i-1][0]));return}
 const details=['Higher ticket value · new machines at levels 4 and 8','Automatically serves paying customers','Increases attendant income by 30% per level','More seats and higher ticket value','Adds 30 minutes of offline capacity'];
 for(const i of tab==='Floor'?[0,3,4]:[1,2]){const level=state.levels[i],cost=price(i);row(names[i]+' · '+level,details[i],level===50?'Max':'$'+fmt(cost),()=>{if(level>=50||state.cash<cost)return;state.cash-=cost;state.levels[i]++;action(names[i]+' upgraded')},level>=50||state.cash<cost)}
}
$('#serve').onclick=()=>{if(paused)return;credit(ticket());state.served++;lastSale=performance.now()/1000;action('+$'+fmt(ticket())+' at the register')};
$('#sound').onclick=()=>{state.sound=!state.sound;action(state.sound?'Sound on':'Sound off')};
$('#zoom').onclick=()=>{zoom=zoom===1?1.2:1;$('#zoom').textContent=zoom+'×'};
document.querySelector('nav').onclick=e=>{if(e.target.dataset.tab){tab=e.target.dataset.tab;render()}};
function checkpoint(){if(serverBase&&!paused)state.stamp=Math.max(state.stamp,serverBase+performance.now()-baseTick);save()}
async function syncClock(){if(settling)return;settling=true;try{
 const response=await fetch('games.html',{method:'HEAD',cache:'no-store',signal:AbortSignal.timeout(5000)});const time=Date.parse(response.headers.get('Date'));if(!response.ok||!Number.isFinite(time)||document.hidden)return;
 serverBase=time;baseTick=performance.now();const seconds=Math.max(0,(time-state.stamp)/1000),profit=state.stamp?Math.floor(Math.min(seconds,1800*(1+state.levels[4]))*rate()):0;state.stamp=Math.max(time,state.stamp);
 if(seconds>=60&&profit>0){credit(profit);$('#away').textContent=fmt(seconds/60)+' minutes away earned $'+fmt(profit)+' for your arcade.';$('dialog').showModal()}save();
 }catch{}finally{settling=false;paused=document.hidden;lastTick=performance.now();render()}}
$('#collect').onclick=()=>$('dialog').close();
document.addEventListener('visibilitychange',()=>{if(document.hidden){checkpoint();paused=true}else syncClock()});
window.addEventListener('pagehide',checkpoint);
setInterval(()=>{const now=performance.now();if(!paused&&!document.hidden&&!settling){credit(rate()*Math.min(5,(now-lastTick)/1000));checkpoint();render()}lastTick=now},1000);
render();syncClock();
