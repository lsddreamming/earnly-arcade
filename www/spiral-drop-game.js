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
    function resize(){const r=canvas.getBoundingClientRect();H=Math.max(1,360*r.height/Math.max(1,r.width));const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(360*dpr);canvas.height=Math.round(H*dpr);ctx.setTransform(dpr,0,0,dpr,0,0);if(!s.ticks)camera=-H*.25;draw();}
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
    function segment(x,w,y,color){if(w<=0)return;ctx.fillStyle='#061323';ctx.beginPath();ctx.roundRect(x,y+4,w,20,5);ctx.fill();const g=ctx.createLinearGradient(0,y,0,y+18);g.addColorStop(0,'#c8f3ff');g.addColorStop(.14,color);g.addColorStop(1,'#1a3f68');ctx.fillStyle=g;ctx.beginPath();ctx.roundRect(x,y,w,18,5);ctx.fill();ctx.fillStyle='#e5fcff99';ctx.fillRect(x+4,y+2,Math.max(0,w-8),2);ctx.strokeStyle=color+'66';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle='#06182c';for(const px of [x+7,x+w-7]){if(w>22){ctx.beginPath();ctx.arc(px,y+10,2,0,Math.PI*2);ctx.fill();}}}
    function draw(){
      if(!canvas.width)return;
      const zone=E.zone(s.score),color=zone.color,by=s.y-camera;
      ctx.clearRect(0,0,360,H);const bg=ctx.createLinearGradient(0,0,360,H);bg.addColorStop(0,zone.dark);bg.addColorStop(.55,'#081b33');bg.addColorStop(1,'#030b1a');ctx.fillStyle=bg;ctx.fillRect(0,0,360,H);
      // Recessed side walls and distance marks make descent legible without camera shake.
      for(const side of [0,1]){const x=side?338:0,g=ctx.createLinearGradient(x,0,x+22,0);g.addColorStop(0,side?'#030c1800':'#020914cc');g.addColorStop(1,side?'#020914cc':'#030c1800');ctx.fillStyle=g;ctx.fillRect(x,0,22,H);}
      ctx.font='600 7px system-ui';ctx.textAlign='left';
      for(let depth=Math.floor(camera/100)*100;depth<camera+H;depth+=100){if(depth<0)continue;const y=depth-camera;ctx.strokeStyle=color+'55';ctx.beginPath();ctx.moveTo(5,y);ctx.lineTo(13,y);ctx.moveTo(347,y);ctx.lineTo(355,y);ctx.stroke();ctx.fillStyle='#a4cce177';ctx.fillText(String(depth/10),17,y+3);}
      // Shaft ribs and the double helix move with depth, while farther walls move slowly.
      ctx.strokeStyle=color+'16';ctx.lineWidth=1;
      for(let i=-1;i<H/70+2;i++){const y=i*70-(reduced?0:(camera*.38)%70);ctx.beginPath();ctx.ellipse(180,y,174,38,0,0,Math.PI*2);ctx.stroke();}
      ctx.lineWidth=2;
      for(const side of [-1,1]){ctx.strokeStyle=color+'25';ctx.beginPath();for(let y=0;y<=H;y+=8){const x=180+side*(142+Math.sin((y+camera*.3)/95)*12);if(!y)ctx.moveTo(x,y);else ctx.lineTo(x,y);}ctx.stroke();ctx.fillStyle=color+'22';ctx.fillRect(side<0?8:349,0,3,H);}
      if(!reduced){ctx.strokeStyle=color+'46';for(let i=0;i<20;i++){const x=24+(i*83%312),y=((i*79-camera*1.25)%(H+50)+(H+50))%(H+50)-25;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+5+s.vy*.06);ctx.stroke();}}
      const next=s.rows.find(r=>!r.passed);
      if(next){const y=next.y-camera;ctx.fillStyle=color+'09';ctx.fillRect(next.gap-next.w/2,Math.max(0,by+14),next.w,Math.max(0,y-by-14));ctx.setLineDash([3,7]);ctx.strokeStyle=color+'44';ctx.beginPath();ctx.moveTo(next.gap,Math.max(by+25,y-65));ctx.lineTo(next.gap,y-12);ctx.stroke();ctx.setLineDash([]);}
      for(const row of s.rows){const y=row.y-camera;if(y<-35||y>H+20)continue;if(row.passed){
          // Cleared platforms remain behind the orb and scroll out naturally.
          ctx.globalAlpha=.42;segment(15,row.gap-row.w/2-15,y,'#42739a');segment(row.gap+row.w/2,345-row.gap-row.w/2,y,'#42739a');ctx.globalAlpha=1;
          ctx.strokeStyle='#8cf0cf88';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(row.gap-4,y+7);ctx.lineTo(row.gap-1,y+10);ctx.lineTo(row.gap+5,y+4);ctx.stroke();continue;
        }
        const col=row===next?color:'#42739a';segment(15,row.gap-row.w/2-15,y,col);segment(row.gap+row.w/2,345-row.gap-row.w/2,y,col);
        ctx.strokeStyle=row===next?'#f2faff':'#659bb8';ctx.lineWidth=2;for(const x of [row.gap-row.w/2,row.gap+row.w/2]){ctx.beginPath();ctx.moveTo(x,y-3);ctx.lineTo(x,y+20);ctx.stroke();}
        if(row===next){
          const aligned=Math.abs(s.x-row.gap)<=Math.min(12,(row.w/2-E.RADIUS)*.34);
          ctx.strokeStyle=aligned?'#b5ffe4':'#d9faff99';ctx.lineWidth=aligned?2:1;ctx.beginPath();ctx.ellipse(row.gap,y+9,13,5,0,0,Math.PI*2);ctx.stroke();
          ctx.fillStyle=aligned?'#b5ffe4':'#d9faff';ctx.font='800 9px system-ui';ctx.textAlign='center';ctx.fillText(aligned?'CENTER':'↓',row.gap,y-9);
        }
      }
      if(!reduced)for(const ring of rings){const age=s.time-ring.at;if(age<0||age>.65)continue;ctx.globalAlpha=(1-age/.65)*.6;ctx.strokeStyle=ring.color;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(ring.x,ring.y-camera,16+age*65,5+age*15,0,0,Math.PI*2);ctx.stroke();}ctx.globalAlpha=1;
      if(!reduced){for(let i=0;i<trail.length;i++){const p=trail[i];ctx.globalAlpha=(i/trail.length)*.25;ctx.fillStyle=s.flowUntil>s.time?'#ffdc91':color;ctx.beginPath();ctx.arc(p.x,p.y-camera,3+i/trail.length*7,0,Math.PI*2);ctx.fill();}ctx.globalAlpha=1;}
      for(const p of sparks){const age=s.time-p.at;if(age>.65)continue;ctx.globalAlpha=1-age/.65;ctx.fillStyle=p.color;ctx.fillRect(p.x+p.dx*age,p.y-camera+p.dy*age,3,3);}ctx.globalAlpha=1;
      ctx.save();ctx.translate(s.x,by);if(!reduced&&s.alive)ctx.scale(1,1+Math.min(.1,s.vy/1800));
      if(s.flowUntil>s.time){ctx.strokeStyle='#ffdb91';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,17+(reduced?0:Math.sin(s.time*8)*2),0,Math.PI*2);ctx.stroke();}
      const orb=ctx.createRadialGradient(-4,-5,1,0,0,13);orb.addColorStop(0,'#ffffff');orb.addColorStop(.4,'#bcf7ff');orb.addColorStop(1,'#347eb9');ctx.fillStyle=orb;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.save();ctx.beginPath();ctx.arc(0,0,10.5,0,Math.PI*2);ctx.clip();ctx.rotate(reduced?0:s.spin+s.y/50);ctx.strokeStyle='#126c9d';ctx.lineWidth=3;ctx.beginPath();ctx.ellipse(0,0,5,12,0,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#e6fbffbb';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(12,0);ctx.stroke();ctx.restore();ctx.fillStyle='#ffffffce';ctx.beginPath();ctx.ellipse(-3,-5,3.5,2,-.5,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#ecfcff';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.stroke();ctx.restore();
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
