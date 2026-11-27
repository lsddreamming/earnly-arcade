(function(){
  'use strict';
  const goals=[10,25,50,100,150,200];
  function nextGoal(score,best){return best>score&&best<=(goals.find(n=>n>score)||Math.ceil((score+1)/50)*50)?{n:best+1,label:'BEAT YOUR BEST'}:{n:goals.find(n=>n>score)||Math.ceil((score+1)/50)*50,label:'NEXT DEPTH GOAL'};}
  function idle(){return '<div class="spiral-idle"><div class="spiral-idle-rings" aria-hidden="true"><i></i><i></i><i></i><b></b></div><div class="spiral-idle-copy"><span>PRISM DIVE</span><strong>Find your flow.</strong><p>Steer through the gaps.<br>Thread the center. Chase the deep.</p><small>Drag to steer · arrows on keyboard</small></div></div>';}
  function create({surface,ui,finish,isPaused}){
    const E=SpiralDropEngine,game=E.create(),s=game.state;
    const canvas=document.createElement('canvas');canvas.className='mini-canvas spiral-canvas';canvas.setAttribute('aria-label','Spiral Drop falling orb and incoming gaps');
    const ctx=canvas.getContext('2d');
    const progress=document.createElement('div');progress.className='spiral-route';progress.innerHTML='<div><strong class="spiral-zone">Prism Well</strong><span class="spiral-goal"></span></div><progress max="10" value="0" aria-label="Depth goal progress"></progress><div><span class="spiral-feedback" role="status">Slide toward the first gap</span><span class="spiral-best"></span></div><div class="spiral-flow" role="meter" aria-label="Centered drops toward Flow" aria-valuemin="0" aria-valuemax="3" aria-valuenow="0"><span class="spiral-flow-label">BUILD YOUR FLOW</span><span class="spiral-flow-pips" aria-hidden="true"><i></i><i></i><i></i></span><strong>0 / 3</strong></div>';
    surface.replaceChildren(canvas,progress);
    const pad=document.createElement('div');pad.className='spiral-control-zone';pad.innerHTML='<strong>↔ DRAG TO STEER</strong><small>Slide here or across the shaft</small><span class="spiral-steering-track" aria-hidden="true"><i></i></span>';surface.after(pad);
    const dock=document.createElement('div');dock.className='spiral-session-controls';pad.after(dock);
    const parked=[];
    for(const id of ['earnlyPauseButton','earnlyQuitButton']){const button=document.getElementById(id);if(button){const marker=document.createComment('spiral control home');button.before(marker);parked.push({button,marker});dock.append(button);}}
    let H=530,raf=null,last=0,alive=false,camera=-140,pointer=null,lastX=0,trail=[],sparks=[],rings=[],announcement=null,cue='Slide toward the first gap',cueUntil=0,lastScore=-1,lastZone='',oldBest=Number(Arcade.best('spiralDrop')?.value)||0,pbShown=false,finalized=false;
    const held=new Set(),reduced=Arcade.reducedMotionEnabled?.()||false;
    const zoneEl=progress.querySelector('.spiral-zone'),goalEl=progress.querySelector('.spiral-goal'),bar=progress.querySelector('progress'),feedback=progress.querySelector('.spiral-feedback'),bestEl=progress.querySelector('.spiral-best'),flowEl=progress.querySelector('.spiral-flow'),flowLabel=flowEl.querySelector('.spiral-flow-label'),flowCount=flowEl.querySelector('strong'),pips=[...flowEl.querySelectorAll('i')];
    let flowKey='';
    bestEl.textContent=oldBest?'BEST '+oldBest+' ROWS':'CENTER 3 IN A ROW FOR FLOW';
    function resize(){const r=canvas.getBoundingClientRect();H=Math.max(1,360*r.height/Math.max(1,r.width));const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(360*dpr);canvas.height=Math.round(H*dpr);lighting=null;ctx.setTransform(dpr,0,0,dpr,0,0);if(!s.ticks)camera=-H*.25;draw();}
    const observer=new ResizeObserver(resize);observer.observe(canvas);
    function label(text,seconds=1.1){cue=text;cueUntil=s.time+seconds;if(feedback.textContent!==text)feedback.textContent=text;}
    function update(){
      const flowing=s.flowUntil>s.time&&s.alive,key=s.streak+':'+flowing;
      if(flowKey!==key){flowKey=key;flowEl.dataset.active=String(flowing);flowEl.setAttribute('aria-valuenow',Math.min(3,s.streak));flowEl.setAttribute('aria-valuetext',flowing?'Flow active, '+s.streak+' centered drops':Math.min(3,s.streak)+' of 3 centered drops');flowLabel.textContent=flowing?'FLOW ACTIVE':s.streak>=3?'KEEP CENTERING':'BUILD YOUR FLOW';flowCount.textContent=s.streak>=3?'×'+s.streak:s.streak+' / 3';pips.forEach((p,i)=>p.classList.toggle('lit',i<s.streak));}
      pad.style.setProperty('--steering',((s.x-24)/312*100)+'%');
      if(lastScore!==s.score){ui(s.score,1+Math.floor(s.score/5));lastScore=s.score;const goal=nextGoal(s.score,oldBest);goalEl.textContent=(goal.label==='BEAT YOUR BEST'?'BEST':'GOAL')+' · '+goal.n+' ROWS';bar.max=goal.n;bar.value=s.score;}
      const zone=E.zone(s.score);if(zone.name!==lastZone){lastZone=zone.name;zoneEl.textContent=zone.name;surface.style.setProperty('--spiral-color',zone.color);if(s.score)label(zone.name.toUpperCase(),1.6);}
      if(s.time>cueUntil){const next=s.rows.find(r=>!r.passed),text=s.score<2?'Slide toward the gap':s.streak>=3?'CENTERED ×'+s.streak+' · KEEP YOUR FLOW':s.streak?'CENTERED ×'+s.streak+' · '+(3-s.streak)+' TO FLOW':next?'Next gap '+(next.gap<140?'← LEFT':next.gap>220?'RIGHT →':'↓ CENTER'):'Keep your flow';if(feedback.textContent!==text)feedback.textContent=text;}
    }
    function announce(title,detail){announcement={title,detail,at:s.time};}
    function burst(event){if(reduced)return;for(let i=0;i<(event.type==='crash'?20:12);i++){const a=i*2.399963;sparks.push({x:event.x,y:event.y,dx:Math.cos(a)*(25+i*3),dy:Math.sin(a)*45,at:s.time,color:event.type==='crash'?'#ff978e':event.flow?'#ffd486':E.zone(s.score).color});}if(sparks.length>100)sparks.splice(0,sparks.length-100);}
    // Depth is entirely visual: platform faces remain within the engine's 18px collision slab.
    // Cache the stationary lighting layer by zone and canvas height. No assets or WebGL required.
    let lighting=null;
    const TAU=Math.PI*2;
    function polygon(points,fill){ctx.fillStyle=fill;ctx.beginPath();ctx.moveTo(points[0][0],points[0][1]);for(let i=1;i<points.length;i++)ctx.lineTo(points[i][0],points[i][1]);ctx.closePath();ctx.fill();}
    function shaft(zone){
      const color=zone.color;
      if(!lighting||lighting.height!==H||lighting.color!==color){
        const base=ctx.createLinearGradient(0,0,360,H);base.addColorStop(0,zone.dark);base.addColorStop(.48,'#132b49');base.addColorStop(1,'#071020');
        const well=ctx.createRadialGradient(180,H*.36,12,180,H*.38,Math.max(205,H*.75));well.addColorStop(0,color+'40');well.addColorStop(.5,color+'18');well.addColorStop(1,'#020815a0');
        const side=ctx.createLinearGradient(0,0,360,0);side.addColorStop(0,'#030a19');side.addColorStop(.075,color+'33');side.addColorStop(.18,'#07122240');side.addColorStop(.5,'#07122200');side.addColorStop(.82,'#07122240');side.addColorStop(.925,color+'33');side.addColorStop(1,'#030a19');
        lighting={height:H,color,base,well,side};
      }
      for(const layer of [lighting.base,lighting.well,lighting.side]){ctx.fillStyle=layer;ctx.fillRect(0,0,360,H);}
      const phase=reduced?0:((camera*.34%106)+106)%106;
      // Wide architectural ribs behind the playable plane; quiet center, bright sidewalls.
      for(let y=-106-phase;y<H+106;y+=106){
        ctx.strokeStyle='#02091b66';ctx.lineWidth=10;ctx.beginPath();ctx.ellipse(180,y+5,166,32,0,0,TAU);ctx.stroke();
        ctx.strokeStyle=color+'2e';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(180,y,166,32,0,0,TAU);ctx.stroke();
        ctx.strokeStyle=color+'50';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(180,y,166,32,0,Math.PI*.12,Math.PI*.88);ctx.stroke();
        for(const side of [-1,1]){
          const x=180+side*158;
          polygon([[x-6,y-17],[x+6,y-9],[x+6,y+20],[x-6,y+12]],'#071525');
          ctx.fillStyle=color+'77';ctx.fillRect(x-2,y-6,3,13);
        }
      }
      for(const side of [-1,1]){
        const x=180+side*171;
        ctx.fillStyle='#050e1d';ctx.fillRect(x-5,0,10,H);
        ctx.fillStyle=color+'60';ctx.fillRect(x-1,0,2,H);
        ctx.fillStyle='#f5ffff32';ctx.fillRect(x+2,0,1,H);
        ctx.strokeStyle=color+'45';ctx.lineWidth=3;ctx.beginPath();
        for(let y=0;y<=H;y+=12){const px=180+side*(143+Math.sin((y+(reduced?0:camera*.22))/88)*9);if(!y)ctx.moveTo(px,y);else ctx.lineTo(px,y);}ctx.stroke();
      }
      if(!reduced){
        ctx.strokeStyle=color+'55';ctx.lineWidth=1.5;
        for(let i=0;i<24;i++){const x=23+(i*83%314),y=((i*97-camera*(i%2?.9:.45))%(H+60)+(H+60))%(H+60)-30;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+4+s.vy*.025);ctx.stroke();}
      }
    }
    function segment(x,w,y,color,active=false){
      if(w<=0)return;
      ctx.save();ctx.translate(x,y);
      // Clip beveled faces at the exact opening edges: cosmetic depth never closes a gap.
      ctx.beginPath();ctx.rect(0,0,w,18);ctx.clip();
      const steel=ctx.createLinearGradient(0,0,0,18);steel.addColorStop(0,'#e4fbff');steel.addColorStop(.22,color);steel.addColorStop(.33,'#385776');steel.addColorStop(.72,'#152b4a');steel.addColorStop(1,'#080f25');
      ctx.fillStyle=steel;ctx.fillRect(0,0,w,18);
      const bevel=Math.min(6,w/3);
      polygon([[0,0],[w,0],[w-bevel,5],[bevel,5]],active?'#e4ffffcc':'#94bbda99');
      polygon([[0,0],[bevel,5],[bevel,15],[0,18]],'#b9efff88');
      polygon([[w,0],[w-bevel,5],[w-bevel,15],[w,18]],'#050e24bb');
      ctx.fillStyle=color+(active?'ff':'88');ctx.fillRect(bevel,6,Math.max(0,w-2*bevel),2);
      ctx.fillStyle='#020a1a88';ctx.fillRect(bevel,12,Math.max(0,w-2*bevel),3);
      for(let px=12;px<w-9;px+=30){ctx.fillStyle='#050b18';ctx.fillRect(px,10,13,3);ctx.fillStyle=color+'55';ctx.fillRect(px,10,9,1);}
      if(w>22){for(const px of [6,w-6]){ctx.fillStyle='#061423';ctx.beginPath();ctx.arc(px,11,2.5,0,TAU);ctx.fill();ctx.fillStyle='#e7ffffaa';ctx.fillRect(px-1,9,2,1);}}
      ctx.restore();
    }
    function crystalOrb(color,flowing){
      const radius=E.RADIUS,energy=flowing?'#ffd580':color;
      if(flowing){
        ctx.strokeStyle='#ffe7a7';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,17+(reduced?0:Math.sin(s.time*8)*1.5),0,TAU);ctx.stroke();
        ctx.strokeStyle='#ffc86155';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,21,0,TAU);ctx.stroke();
      }
      const glow=ctx.createRadialGradient(0,0,radius*.7,0,0,24);glow.addColorStop(0,energy+'88');glow.addColorStop(1,energy+'00');ctx.fillStyle=glow;ctx.fillRect(-24,-24,48,48);
      const shell=ctx.createRadialGradient(-4,-5,0,0,0,radius+1);shell.addColorStop(0,'#ffffff');shell.addColorStop(.23,'#d9fdff');shell.addColorStop(.51,energy);shell.addColorStop(.8,'#3174ae');shell.addColorStop(1,'#102747');
      ctx.fillStyle=shell;ctx.beginPath();ctx.arc(0,0,radius,0,TAU);ctx.fill();
      ctx.save();ctx.beginPath();ctx.arc(0,0,radius-.5,0,TAU);ctx.clip();ctx.rotate(reduced?0:s.spin+s.y/65);
      polygon([[0,-12],[8,-5],[3,3],[-6,-1]],'#f6ffff95');
      polygon([[3,3],[8,-5],[13,6],[0,12]],'#154986aa');
      polygon([[-12,-5],[-6,-1],[3,3],[0,12],[-10,8]],'#3468b6aa');
      ctx.strokeStyle='#e9ffffb0';ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(0,-12);ctx.lineTo(3,3);ctx.lineTo(0,12);ctx.moveTo(-12,-5);ctx.lineTo(3,3);ctx.lineTo(13,6);ctx.stroke();ctx.restore();
      ctx.strokeStyle='#d9ffff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,radius-.5,0,TAU);ctx.stroke();
      ctx.fillStyle='#ffffffeb';ctx.beginPath();ctx.ellipse(-3.5,-5.3,3.4,1.8,-.45,0,TAU);ctx.fill();
    }
    function draw(){
      if(!canvas.width||!canvas.height)return;
      const zone=E.zone(s.score),color=zone.color,by=s.y-camera;
      ctx.clearRect(0,0,360,H);shaft(zone);
      ctx.font='600 7px system-ui';ctx.textAlign='left';ctx.lineWidth=1;
      for(let depth=Math.floor(camera/100)*100;depth<camera+H;depth+=100){if(depth<0)continue;const y=depth-camera;ctx.strokeStyle=color+'65';ctx.beginPath();ctx.moveTo(5,y);ctx.lineTo(13,y);ctx.moveTo(347,y);ctx.lineTo(355,y);ctx.stroke();ctx.fillStyle='#d6e8f699';ctx.fillText(String(depth/10),17,y+3);}
      const next=s.rows.find(r=>!r.passed);
      if(next){const y=next.y-camera;ctx.fillStyle=color+'09';ctx.fillRect(next.gap-next.w/2,Math.max(0,by+14),next.w,Math.max(0,y-by-14));ctx.setLineDash([3,7]);ctx.strokeStyle=color+'44';ctx.beginPath();ctx.moveTo(next.gap,Math.max(by+25,y-65));ctx.lineTo(next.gap,y-12);ctx.stroke();ctx.setLineDash([]);}
      for(const row of s.rows){const y=row.y-camera;if(y<-35||y>H+20)continue;if(row.passed){
          // Cleared platforms remain behind the orb and scroll out naturally.
          ctx.globalAlpha=.42;segment(15,row.gap-row.w/2-15,y,'#42739a');segment(row.gap+row.w/2,345-row.gap-row.w/2,y,'#42739a');ctx.globalAlpha=1;
          ctx.strokeStyle='#8cf0cf88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(row.gap-4,y+7);ctx.lineTo(row.gap-1,y+10);ctx.lineTo(row.gap+5,y+4);ctx.stroke();continue;
        }
        const col=row===next?color:'#42739a';segment(15,row.gap-row.w/2-15,y,col,row===next);segment(row.gap+row.w/2,345-row.gap-row.w/2,y,col,row===next);
        ctx.strokeStyle=row===next?'#f2faff':'#659bb8';ctx.lineWidth=2;for(const x of [row.gap-row.w/2,row.gap+row.w/2]){ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x,y+20);ctx.stroke();}
        if(row===next){
          const aligned=Math.abs(s.x-row.gap)<=Math.min(12,(row.w/2-E.RADIUS)*.34);
          ctx.strokeStyle=aligned?'#b5ffe4':'#d9faff99';ctx.lineWidth=aligned?2:1;ctx.beginPath();ctx.ellipse(row.gap,y+9,13,5,0,0,Math.PI*2);ctx.stroke();
          ctx.fillStyle=aligned?'#b5ffe4':'#d9faff';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.fillText(aligned?'CENTER':'↓',row.gap,y-9);
        }
      }
      if(!reduced)for(const ring of rings){const age=s.time-ring.at;if(age<0||age>.65)continue;ctx.globalAlpha=(1-age/.65)*.6;ctx.strokeStyle=ring.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(ring.x,ring.y-camera,16+age*65,5+age*15,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
      if(!reduced){
        const energy=s.flowUntil>s.time?'#ffdc91':color;
        for(let i=1;i<trail.length;i++){
          const p=trail[i],prev=trail[i-1],f=i/trail.length;
          ctx.globalAlpha=f*.24;ctx.strokeStyle=energy;ctx.lineWidth=2+f*13;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(prev.x,prev.y-camera);ctx.lineTo(p.x,p.y-camera);ctx.stroke();
          ctx.globalAlpha=f*.65;ctx.strokeStyle='#efffff';ctx.lineWidth=1+f*2;ctx.stroke();
        }
        ctx.lineCap='butt';ctx.globalAlpha=1;
      }
      for(const p of sparks){const age=s.time-p.at;if(age>.65)continue;ctx.globalAlpha=1-age/.65;ctx.fillStyle=p.color;ctx.fillRect(p.x+p.dx*age,p.y-camera+p.dy*age,3,3);}ctx.globalAlpha=1;
      ctx.save();ctx.translate(s.x,by);crystalOrb(color,s.flowUntil>s.time);ctx.restore();
      if(!s.alive){ctx.fillStyle='#ff8c8133';ctx.fillRect(0,0,360,H);}
      const showingAnnouncement=announcement&&s.time-announcement.at<1.6;
      if(showingAnnouncement){
        const age=s.time-announcement.at;ctx.save();ctx.globalAlpha=reduced?1:Math.min(1,age/.12,(1.6-age)/.3);ctx.fillStyle='#06182eea';ctx.beginPath();ctx.roundRect(65,8,230,42,12);ctx.fill();ctx.strokeStyle=color+'88';ctx.lineWidth=1;ctx.stroke();ctx.textAlign='center';ctx.fillStyle='#efffff';ctx.font='900 13px system-ui';ctx.fillText(announcement.title,180,26);ctx.fillStyle=color;ctx.font='600 9px system-ui';ctx.fillText(announcement.detail,180,41);ctx.restore();
      }
      if(!showingAnnouncement){ctx.fillStyle='#a4cce1';ctx.font='700 8px system-ui';ctx.textAlign='right';ctx.fillText('DEPTH '+String(Math.floor(s.y/10)).padStart(4,'0'),336,22);}
    }
    function complete(){
      if(finalized)return;finalized=true;
      const medals=[];for(const goal of [10,25,50,100])if(s.score>=goal)medals.push(goal+'-row diver');if(s.bestStreak>=3)medals.push('Flow navigator');
      try{const old=JSON.parse(localStorage.getItem('spiralDropMedals')||'[]');localStorage.setItem('spiralDropMedals',JSON.stringify([...new Set([...(Array.isArray(old)?old:[]),...medals])]));}catch{}
      finish(s.score,1+Math.floor(s.score/5),['💎 Centered drops: '+s.centered,'🔥 Best center streak: '+s.bestStreak,'🌌 Zone reached: '+E.zone(s.score).name,...(medals.length?['🏅 Dive medals: '+medals.join(' · ')]:[])],'Spiral Drop',s.bestStreak>=3?'FLOW NAVIGATOR':'DIVE COMPLETE');
    }
    function loop(t){
      if(!alive)return;const dt=Math.max(0,Math.min(.05,(t-(last||t))/1000));last=t;
      if(!isPaused()){
        const events=game.advance(dt,(held.has('right')?1:0)-(held.has('left')?1:0));
        for(const e of events){burst(e);if(e.type==='crash'){clearInput();label('Hull hit · dive complete');Arcade.feedback('fail');}else{
          if(!reduced)rings.push({x:e.x,y:e.y,at:s.time,color:e.flow?'#ffdc91':E.zone(s.score).color});
          label(e.flow?'FLOW ×'+s.streak:e.centered?'CENTERED!':'CLEAN DROP');Arcade.feedback(e.flow?'perfect':e.centered?'bonus':'score');
          if(s.streak===3)announce('FLOW ACTIVATED','Keep threading the center');
          if(goals.includes(s.score)||s.score>200&&s.score%50===0)announce(s.score+' ROWS CLEARED',E.zone(s.score).name+' · keep diving');
          if(oldBest>0&&s.score>oldBest&&!pbShown){pbShown=true;label('NEW PERSONAL BEST!',2);announce('NEW PERSONAL BEST',s.score+' rows · how deep can you go?');Arcade.feedback('success');}
        }}
        if(!reduced){trail.push({x:s.x,y:s.y-5});if(trail.length>20)trail.shift();}
        sparks=sparks.filter(p=>s.time-p.at<.7);rings=rings.filter(p=>s.time-p.at<.7);
        const desired=s.y-H*.25;camera+=Math.max(0,1-Math.exp(-dt*12))*(desired-camera);
        update();draw();if(!s.alive&&s.endAge>=.28){complete();return;}
      }
      raf=requestAnimationFrame(loop);
    }
    function clearInput(){pointer=null;held.clear();pad.classList.remove('steering');}
    function down(e){if(!alive||!s.alive||isPaused()||pointer!==null||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;e.preventDefault();pointer=e.pointerId;lastX=e.clientX;pad.classList.add('steering');try{e.currentTarget.setPointerCapture(e.pointerId);}catch{}}
    function move(e){if(pointer!==e.pointerId||isPaused()||!s.alive)return;e.preventDefault();const dx=(e.clientX-lastX)*360/Math.max(1,canvas.getBoundingClientRect().width);lastX=e.clientX;game.dragBy(dx);}
    function up(e){if(pointer===e.pointerId){pointer=null;pad.classList.remove('steering');}}
    for(const el of [canvas,pad]){el.addEventListener('pointerdown',down,{passive:false});el.addEventListener('pointermove',move,{passive:false});for(const name of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(name,up);}
    function onKey(e){if(!alive||isPaused()||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName))return;const dir=e.key==='ArrowLeft'?'left':e.key==='ArrowRight'?'right':null;if(dir){e.preventDefault();held.add(dir);}}
    function onUp(e){if(e.key==='ArrowLeft')held.delete('left');if(e.key==='ArrowRight')held.delete('right');}
    document.addEventListener('keydown',onKey);document.addEventListener('keyup',onUp);window.addEventListener('blur',clearInput);
    return {start(){alive=true;resize();update();draw();raf=requestAnimationFrame(loop);},adjustPauseTime(){last=0;clearInput();},stop(){alive=false;cancelAnimationFrame(raf);observer.disconnect();clearInput();document.removeEventListener('keydown',onKey);document.removeEventListener('keyup',onUp);window.removeEventListener('blur',clearInput);for(const {button,marker} of parked){marker.replaceWith(button);}pad.remove();dock.remove();}};
  }
  window.SpiralDropGame={create,idle,nextGoal};
})();
