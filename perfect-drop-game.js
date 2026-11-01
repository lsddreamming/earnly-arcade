(function(){
 'use strict';
 const goals=[5,10,20,30,40,60,80,100];
 function goal(hits,best=0){const n=goals.find(n=>n>hits)||Math.ceil((hits+1)/25)*25;return best>hits&&best<n?best+1:n;}
 function idle(){return '<div class="perfect-idle"><div class="perfect-idle-ring" aria-hidden="true"></div><div class="perfect-idle-orb" aria-hidden="true"></div><div class="perfect-idle-copy"><span>SKYFORGE</span><strong>Drop into your rhythm.</strong><p>Green catches the orb.<br>Gold makes it perfect.</p><small>One tap to release · Three lives to master it</small></div></div>';}
 function create({surface,ui,finish,isPaused}){
  const E=PerfectDropEngine,game=E.create(),s=game.state,reduced=Arcade.reducedMotionEnabled?.()||false,oldBest=Number(Arcade.best('perfectDrop')?.value)||0;
  const canvas=document.createElement('canvas');canvas.className='mini-canvas perfect-canvas';canvas.setAttribute('aria-label','Perfect Drop launch rail and green landing pad');const ctx=canvas.getContext('2d');
  const panel=document.createElement('div');panel.className='perfect-console';panel.innerHTML='<div><strong class="perfect-zone">Sky Dock</strong><span class="perfect-lives" aria-label="Lives remaining">♥ ♥ ♥</span></div><div><span class="perfect-cue" role="status">Line up with green</span><span class="perfect-pattern">STEADY</span></div><progress class="perfect-clock" aria-label="Time left to release" value="1" max="1"></progress><div><span class="perfect-time"></span><span class="perfect-goal"></span></div><div class="perfect-charge"><span>GOLD CENTER → PERFECT</span><strong>SKYFIRE ○ ○ ○</strong></div>';
  surface.replaceChildren(canvas,panel);
  const action=document.createElement('button');action.type='button';action.className='perfect-drop-action';action.textContent='↓ DROP';action.setAttribute('aria-label','Drop the orb');surface.after(action);
  const dock=document.createElement('div');dock.className='perfect-session-controls';action.after(dock);const parked=[];
  for(const id of ['earnlyPauseButton','earnlyQuitButton']){const button=document.getElementById(id);if(button){const marker=document.createComment('perfect control home');button.before(marker);parked.push({button,marker});dock.append(button);}}
  const zoneEl=panel.querySelector('.perfect-zone'),livesEl=panel.querySelector('.perfect-lives'),cueEl=panel.querySelector('.perfect-cue'),patternEl=panel.querySelector('.perfect-pattern'),clock=panel.querySelector('progress'),timeEl=panel.querySelector('.perfect-time'),goalEl=panel.querySelector('.perfect-goal'),charge=panel.querySelector('.perfect-charge strong');
  let H=480,alive=false,raf=null,last=0,pointer=null,cueUntil=0,lastHud='',lastTick=-1,lastZone='',pbShown=false,ended=false,particles=[],trail=[],lastImpact=-10;
  const rail=()=>Math.max(35,H*.19),pad=()=>Math.min(H*.78,H-38);
  function cue(text,duration=1){cueEl.textContent=text;cueUntil=s.time+duration;}
  function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(2,devicePixelRatio||1);H=Math.max(1,360*r.height/Math.max(1,r.width));trail=[];particles=[];canvas.width=Math.round(360*d);canvas.height=Math.round(H*d);ctx.setTransform(d,0,0,d,0,0);draw();}
  const observer=new ResizeObserver(resize);observer.observe(canvas);
  function update(){
   const hud=s.hits+':'+s.lives+':'+s.phase+':'+s.perfectChain;
   if(hud!==lastHud){lastHud=hud;ui(s.hits,Math.min(9,1+Math.floor(s.hits/5)));livesEl.textContent='♥ '.repeat(s.lives)+'♡ '.repeat(3-s.lives);livesEl.setAttribute('aria-label',s.lives+' lives remaining');patternEl.textContent=s.round.type;goalEl.textContent='GOAL · '+goal(s.hits,oldBest)+' HITS';charge.textContent='SKYFIRE '+Array.from({length:3},(_,i)=>i<s.perfectChain?'●':'○').join(' ');action.setAttribute('aria-disabled',String(s.phase!=='aim'));action.textContent=s.phase==='aim'?'↓ DROP':s.phase==='flight'?'DROPPING…':s.lastOutcome;}
   const tick=Math.floor(s.time*10);
   if(tick!==lastTick){lastTick=tick;const remaining=Math.max(0,s.round.limit-s.aimTime);clock.value=s.phase==='aim'?remaining/s.round.limit:0;timeEl.textContent=s.phase==='aim'?'RELEASE IN '+remaining.toFixed(1)+'s':s.phase==='flight'?'POSITION LOCKED':'NEXT DROP IN A MOMENT';panel.classList.toggle('perfect-urgent',s.phase==='aim'&&remaining<1.2);}
   const z=E.zone(s.hits);if(z.name!==lastZone){lastZone=z.name;zoneEl.textContent=z.name;surface.style.setProperty('--perfect-color',z.color);}
   if(s.time>=cueUntil){const text=s.phase==='aim'?'Green catches · Gold is perfect':s.phase==='flight'?'Watch it land':s.lastOutcome;if(cueEl.textContent!==text)cueEl.textContent=text;}
  }
  function burst(perfect,miss){if(reduced)return;for(let i=0;i<(perfect?24:12);i++){const a=i*2.399;particles.push({x:s.dropX,y:pad(),dx:Math.cos(a)*(20+i*2.5),dy:-35-Math.abs(Math.sin(a))*75,at:s.time,color:miss?'#ff9d97':perfect?'#ffe39a':'#8bffcf'});}if(particles.length>80)particles.splice(0,particles.length-80);}
  function rounded(x,y,w,h,r,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function draw(){
   if(!canvas.width)return;const r=s.round,z=E.zone(s.hits),y0=rail(),targetY=pad(),f=s.phase==='flight'?s.fall:s.phase==='feedback'?1:0,x=s.phase==='aim'?s.x:s.dropX,y=y0+(targetY-y0-12)*f;
   const bg=ctx.createLinearGradient(0,0,360,H);bg.addColorStop(0,z.dark);bg.addColorStop(.6,'#0a233e');bg.addColorStop(1,'#06172d');ctx.fillStyle=bg;ctx.fillRect(0,0,360,H);
   ctx.strokeStyle=z.color+'19';ctx.lineWidth=1;
   for(let i=0;i<5;i++){ctx.beginPath();ctx.ellipse(180,H*.5,105+i*34,Math.max(15,H*.2+i*12),-.16,0,Math.PI*2);ctx.stroke();}
   ctx.fillStyle='#b5edff66';for(let i=0;i<20;i++){const px=18+(i*83%320),py=15+(i*59%Math.max(20,H-35));ctx.fillRect(px,py,i%3===0?2:1,1);}
   // A suspended gantry makes the moving launch position unmistakable.
   rounded(12,y0-7,336,18,7,'#071c32');const metal=ctx.createLinearGradient(0,y0-7,0,y0+10);metal.addColorStop(0,'#b7e9ef');metal.addColorStop(.3,'#447d9b');metal.addColorStop(1,'#183b59');rounded(14,y0-6,332,14,5,metal);ctx.strokeStyle='#dbfaff66';ctx.beginPath();ctx.moveTo(22,y0-4);ctx.lineTo(338,y0-4);ctx.stroke();
   for(const px of [18,342]){rounded(px-5,Math.max(5,y0-28),10,38,3,'#274d68');ctx.fillStyle=z.color;ctx.fillRect(px-2,y0-20,4,8);}
   const aligned=E.landing(r,s.phase==='aim'?s.x:s.dropX).hit;
   ctx.setLineDash([3,7]);ctx.strokeStyle=aligned?'#8bffcf77':'#a2d2e633';ctx.beginPath();ctx.moveTo(x,y0+18);ctx.lineTo(x,targetY-20);ctx.stroke();ctx.setLineDash([]);
   const ty=targetY+(!reduced&&s.phase==='feedback'?Math.sin(Math.min(1,s.phaseTime/.25)*Math.PI)*4:0),left=r.center-r.w/2;
   ctx.fillStyle='#010b1b55';ctx.beginPath();ctx.ellipse(r.center,ty+35,r.w*.68,10,0,0,Math.PI*2);ctx.fill();
   rounded(left-7,ty+8,r.w+14,26,10,'#0c3450');rounded(left-3,ty+2,r.w+6,25,8,'#245a6d');
   const target=ctx.createLinearGradient(0,ty-3,0,ty+16);target.addColorStop(0,'#b4ffde');target.addColorStop(.35,'#33d9a1');target.addColorStop(1,'#137b75');rounded(left,ty-3,r.w,20,7,target);
   const gold=Math.max(8,r.w*.12)*2;rounded(r.center-gold/2,ty-2,gold,16,4,'#ffe1a0');ctx.strokeStyle='#edfff3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(left,ty-8);ctx.lineTo(left,ty+16);ctx.moveTo(left+r.w,ty-8);ctx.lineTo(left+r.w,ty+16);ctx.stroke();
   ctx.textAlign='center';ctx.fillStyle='#b9ebdd';ctx.font='800 9px system-ui';ctx.fillText('GOLD = PERFECT',r.center,Math.min(H-8,ty+50));
   if(!reduced){for(let i=0;i<trail.length;i++){const p=trail[i];ctx.globalAlpha=.2*i/trail.length;ctx.fillStyle=s.flareUntil>s.time?'#ffe09c':'#92edf3';ctx.beginPath();ctx.arc(p.x,p.y,3+i/trail.length*6,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
   for(const p of particles){const age=s.time-p.at;if(age>.65)continue;ctx.globalAlpha=1-age/.65;ctx.fillStyle=p.color;ctx.fillRect(p.x+p.dx*age,p.y+p.dy*age+120*age*age,3,3);}ctx.globalAlpha=1;
   if(!reduced&&s.time-lastImpact<.4){const age=(s.time-lastImpact)/.4;ctx.strokeStyle=s.lastOutcome==='PERFECT'?'#ffe3a0':s.lastOutcome==='CLEAN LANDING'?'#8bffcf':'#ff9d97';ctx.globalAlpha=1-age;ctx.beginPath();ctx.ellipse(s.dropX,targetY,12+age*25,4+age*8,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;}
   if(s.phase!=='feedback'&&s.phase!=='over'){
    ctx.save();ctx.translate(x,y);if(s.flareUntil>s.time){ctx.strokeStyle='#ffdf8d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.stroke();}
    const orb=ctx.createRadialGradient(-4,-5,1,0,0,14);orb.addColorStop(0,'#fffef2');orb.addColorStop(.45,'#ffe5a0');orb.addColorStop(1,'#ed9c52');ctx.fillStyle=orb;ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(0,0,11.5,0,Math.PI*2);ctx.clip();ctx.rotate(reduced?0:x/40+f*2);ctx.strokeStyle='#b87639';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,5,14,0,0,Math.PI*2);ctx.stroke();ctx.restore();ctx.fillStyle='#fffce8';ctx.beginPath();ctx.ellipse(-4,-5,3.5,2,-.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff4c6';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,12,0,Math.PI*2);ctx.stroke();ctx.restore();
   }
   ctx.textAlign='center';ctx.fillStyle='#c8e7ef';ctx.font='800 9px system-ui';ctx.fillText(s.phase==='flight'?'COMMITTED':s.phase==='feedback'?s.lastOutcome:'LINE UP · TAP TO RELEASE',180,Math.max(17,y0-38));
  }
  function complete(){
   if(ended)return;ended=true;const medals=[10,20,40,60].filter(n=>s.hits>=n).map(n=>n+'-hit pilot');if(s.bestPerfectChain>=3)medals.push('Skyfire pilot');
   try{const old=JSON.parse(localStorage.getItem('perfectDropMedals')||'[]');localStorage.setItem('perfectDropMedals',JSON.stringify([...new Set([...(Array.isArray(old)?old:[]),...medals])]));}catch{}
   finish(s.hits,Math.min(9,1+Math.floor(s.hits/5)),['✨ Perfect drops: '+s.perfects,'🔥 Best perfect chain: '+s.bestPerfectChain,'🎯 Accuracy: '+(s.attempts?Math.round(s.hits/s.attempts*100):0)+'%','💫 Best hit streak: '+s.bestStreak,'🌤️ Zone: '+E.zone(s.hits).name,...(medals.length?['🏅 Medals: '+medals.join(' · ')]:[])],'Perfect Drop',s.bestPerfectChain>=3?'SKYFIRE PILOT':s.hits>=10?Math.floor(s.hits/10)*10+'-HIT PILOT':'FLIGHT COMPLETE');
  }
  function loop(t){
   if(!alive)return;const dt=Math.max(0,Math.min(.05,(t-(last||t))/1000));last=t;
   if(!isPaused()){
    const events=game.advance(dt);
    for(const e of events){if(e.type==='release'){trail=[];Arcade.feedback('move');}else if(e.type==='hit'||e.type==='miss'){lastImpact=e.timeout?-10:s.time;if(!e.timeout)burst(e.perfect,e.type==='miss');cue(e.type==='miss'?(e.timeout?'TOO LATE · ONE LIFE LOST':'MISS · LINE UP THE NEXT DROP'):e.chain>=3?'SKYFIRE ×'+e.chain:e.perfect?'PERFECT! · +1 HIT':'CLEAN LANDING · +1 HIT');Arcade.feedback(e.type==='miss'?'fail':e.perfect?'perfect':'score');if(e.type==='hit'&&s.hits>oldBest&&oldBest>0&&!pbShown){pbShown=true;cue('NEW PERSONAL BEST!',1.4);}else if(e.type==='hit'&&[10,20,40,60].includes(s.hits))cue(s.hits+'-HIT MEDAL!',1.4);}else if(e.type==='over'){complete();return;}}
    if(!reduced){if(s.phase==='aim'||s.phase==='flight'){trail.push({x:s.phase==='aim'?s.x:s.dropX,y:rail()+(pad()-rail()-12)*(s.phase==='flight'?s.fall:0)});if(trail.length>12)trail.shift();}else trail=[];}
    particles=particles.filter(p=>s.time-p.at<.7);update();draw();
   }
   raf=requestAnimationFrame(loop);
  }
  function act(){if(!alive||isPaused())return;game.commit();update();}
  function down(e){if(!alive||isPaused()||pointer!==null||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();pointer=e.pointerId;act();}
  function up(e){if(pointer===e.pointerId)pointer=null;}
  for(const el of [canvas,action])el.addEventListener('pointerdown',down,{passive:false});
  for(const name of ['pointerup','pointercancel'])document.addEventListener(name,up);
  const activation=e=>e.code==='Space'||e.code==='Enter'||e.key===' '||e.key==='Enter';
  const otherControl=e=>e.target!==action&&e.target?.closest?.('a,button,input,textarea,select,dialog');
  function key(e){if(!alive||!activation(e)||otherControl(e))return;e.preventDefault();if(!e.repeat)act();}
  function keyUp(e){if(alive&&activation(e)&&!otherControl(e))e.preventDefault();}
  function accessibleClick(e){if(e.detail===0)act();}action.addEventListener('click',accessibleClick);document.addEventListener('keydown',key);document.addEventListener('keyup',keyUp);
  return {start(){alive=true;resize();update();draw();raf=requestAnimationFrame(loop);},adjustPauseTime(){pointer=null;last=0;},stop(){alive=false;cancelAnimationFrame(raf);observer.disconnect();pointer=null;document.removeEventListener('keydown',key);document.removeEventListener('keyup',keyUp);for(const name of ['pointerup','pointercancel'])document.removeEventListener(name,up);for(const {button,marker} of parked)marker.replaceWith(button);action.remove();dock.remove();}};
 }
 window.PerfectDropGame={create,idle,goal};
})();
