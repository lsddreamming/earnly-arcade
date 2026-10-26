(() => {
  'use strict';
  const $=id=>document.getElementById(id),canvas=$('sliceCanvas'),ctx=canvas.getContext('2d'),game=new NeonSliceEngine.Game();
  const colors=['#83dc65','#ff705b','#d9a3ff','#79bd59','#ffd45b','#ed6251','#ffd964','#ffc56c','#ef87b4','#e8b978','#f5cf59','#bf7041'];
  let best=0,pointer=null,lastPoint=null,trail=[],comboUntil=0,lastFrame=0,offered=false,keys=new Set(),blade={x:180,y:300};
  try{best=Math.max(0,Number(localStorage.getItem('neonSlicePreviewBest'))||0);}catch{}
  $('sliceBest').textContent=best;
  const reduced=()=>window.Arcade?.reducedMotionEnabled?.()||matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hud(){$('sliceScore').textContent=game.score;$('sliceMisses').textContent=Math.min(3,game.misses)+' / 3';}
  function overlay(title,message,label){$('sliceHeading').textContent=title;$('sliceMessage').textContent=message;$('sliceStart').textContent=label;$('sliceOverlay').hidden=false;}
  function resetInput(){pointer=null;lastPoint=null;keys.clear();trail=[];game.endStroke();}
  function result(){document.body.classList.remove("slice-running");if(offered)return;offered=true;resetInput();if(game.score>best){best=game.score;try{localStorage.setItem('neonSlicePreviewBest',String(best));}catch{}}$('sliceBest').textContent=best;overlay(game.reason,`${game.score} points · Best combo: ${game.bestCombo} items. Try a longer swipe to catch a whole group.`,'Play again');$('slicePause').disabled=true;$('sliceQuit').disabled=true;$('sliceContinue').hidden=game.continued||!(window.EarnlyNativeAds?.isNative||window.EarnlyWebAds?.enabled);}
  function start(){document.body.classList.add("slice-running");resetInput();game.start();offered=false;$('sliceContinue').hidden=true;$('sliceOverlay').hidden=true;$('slicePause').disabled=false;$('slicePause').textContent='Pause';$('sliceQuit').disabled=false;$('sliceCombo').textContent='';hud();canvas.focus();}
  function pause(){if(game.state!=='running')return;resetInput();game.pause();overlay('Paused','Your ingredients and score are waiting.','Resume');$('sliceContinue').hidden=true;$('slicePause').textContent='Resume';}
  function resume(){game.resume();$('sliceOverlay').hidden=true;$('slicePause').textContent='Pause';canvas.focus();}
  $('sliceStart').onclick=()=>game.state==='paused'?resume():start();
  $('slicePause').onclick=()=>game.state==='paused'?resume():pause();
  $('sliceQuit').onclick=()=>{pause();if(confirm('Quit this run? Your current score will not be saved.')){game.reset();document.body.classList.remove("slice-running");resetInput();overlay('Make your first cut','Slice ingredients, catch bonus burgers, and avoid bombs.','Play free');$('slicePause').disabled=true;$('sliceQuit').disabled=true;hud();}};
  $('sliceContinue').onclick=()=>{if(game.state!=='over'||game.continued)return;$('sliceContinue').disabled=true;const finish=()=>{$('sliceContinue').disabled=false;};const opened=Arcade.offerAdContinue({message:'Keep your score and clear the arena. One bonus chance per run.',onFinish:finish,onContinue:()=>{if(game.continue()){document.body.classList.add("slice-running");offered=false;$('sliceOverlay').hidden=true;$('sliceContinue').hidden=true;$('slicePause').disabled=false;$('sliceQuit').disabled=false;hud();canvas.focus();}finish();}});if(!opened){finish();$('sliceMessage').textContent='Ads are unavailable right now. You can start another free run.';}};
  function point(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)*360/r.width,y:(e.clientY-r.top)*540/r.height};}
  function cut(a,b){const hits=game.slice(a,b);trail.push({...b,life:.16});trail=trail.slice(-22);hud();if(hits.some(x=>x.type===7&&!x.bomb)){$('sliceCombo').textContent='Bonus burger! +50';comboUntil=performance.now()+1100;}if(hits.some(x=>x.bomb))result();}
  function finishStroke(){const combo=game.endStroke();if(combo){$('sliceCombo').textContent=`${combo.hits} item combo! +${combo.bonus}`;comboUntil=performance.now()+900;hud();}pointer=null;lastPoint=null;}
  canvas.addEventListener('pointerdown',e=>{if(game.state!=='running'||pointer!==null||e.button>0)return;e.preventDefault();pointer=e.pointerId;canvas.setPointerCapture(e.pointerId);lastPoint=point(e);cut(lastPoint,lastPoint);});
  canvas.addEventListener('pointermove',e=>{if(e.pointerId!==pointer||game.state!=='running')return;e.preventDefault();for(const sample of e.getCoalescedEvents?.()||[e]){const p=point(sample);cut(lastPoint,p);lastPoint=p;if(game.state!=='running')break;}});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerId===pointer)finishStroke();});
  canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)){e.preventDefault();keys.add(e.key);}if(e.key==='Escape')pause();});
  canvas.addEventListener('keyup',e=>{keys.delete(e.key);if(e.key===' ')finishStroke();});
  canvas.addEventListener('blur',()=>{if(keys.size)pause();keys.clear();});
  document.querySelectorAll('a[href]').forEach(link=>link.addEventListener('click',e=>{if(game.state==='running'||game.state==='paused'){pause();if(!confirm('Leave this run? Your current score will not be saved.'))e.preventDefault();}}));
  // Mobile browser chrome can blur the window during a swipe without hiding the game.
  // Pause for actual backgrounding, not transient focus changes.
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});
  window.addEventListener('pagehide',pause);
  // Original diner artwork, drawn in logical coordinates so split halves match whole snacks.
  function snack(o,half){
    ctx.save();ctx.translate(o.x,o.y);ctx.rotate(o.angle||0);const r=o.r||25;
    if(half){ctx.beginPath();ctx.rect(half<0?-r:0,-r-5,r,2*r+10);ctx.clip();}
    ctx.scale(r/25,r/25);
    const oval=(x,y,rx,ry,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill();};
    const bar=(x,y,w,h,color)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
    if(o.bomb){
      const g=ctx.createRadialGradient(-8,-10,2,0,0,25);g.addColorStop(0,'#738395');g.addColorStop(1,'#182638');
      oval(0,0,25,25,g);ctx.strokeStyle='#f58c80';ctx.lineWidth=2;ctx.stroke();
      ctx.strokeStyle='#ffc16e';ctx.beginPath();ctx.moveTo(0,-25);ctx.quadraticCurveTo(6,-42,15,-37);ctx.stroke();oval(15,-37,3,3,'#ffd38c');
      ctx.strokeStyle='#ffbaae';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-7,-7);ctx.lineTo(7,7);ctx.moveTo(7,-7);ctx.lineTo(-7,7);ctx.stroke();
    }else if(o.type===7){
      // Rare whole burger: golden halo and +50 badge distinguish it from ingredients.
      ctx.shadowColor='#ffd56b';ctx.shadowBlur=12;oval(0,0,25,25,'#ffc45430');ctx.shadowBlur=0;
      oval(0,14,24,8,'#b9692c');bar(-24,8,48,7,'#e9a249');
      oval(0,7,24,6,'#693722');bar(-23,1,46,5,'#ffd35b');
      for(let x=-18;x<=18;x+=9)oval(x,-2,8,4,'#79c954');
      bar(-22,-7,44,4,'#ef6d52');oval(0,-13,24,13,'#edb666');bar(-24,-13,48,8,'#edb666');
      for(const [x,y] of [[-13,-17],[-3,-21],[9,-18],[16,-12],[-7,-11]]){ctx.save();ctx.translate(x,y);ctx.rotate(-.4);oval(0,0,2,1,'#fff0b1');ctx.restore();}
      if(!half){ctx.fillStyle='#ffe6a0';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText('+50',0,-32);}
    }else if(o.type===0){
      // Ruffled lettuce leaf.
      for(let i=0;i<7;i++){const a=i*Math.PI*2/7;oval(Math.cos(a)*13,Math.sin(a)*13,11,11,'#65bc52');}
      oval(0,0,17,19,'#8bdd6b');ctx.strokeStyle='#d1f8a2';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,20);ctx.lineTo(0,-17);
      for(const y of [-9,0,9]){ctx.moveTo(0,y+5);ctx.lineTo(-11,y-3);ctx.moveTo(0,y+5);ctx.lineTo(11,y-3);}ctx.stroke();
    }else if(o.type===1){
      // Tomato cross-section.
      oval(0,0,24,24,'#d94a39');oval(0,0,20,20,'#ff8060');oval(0,0,5,5,'#ffb482');
      for(let i=0;i<5;i++){const a=i*Math.PI*2/5;oval(Math.cos(a)*13,Math.sin(a)*13,5,6,'#d9533e');oval(Math.cos(a)*12,Math.sin(a)*12,1.7,3,'#ffe1a0');}
    }else if(o.type===2){
      // Purple onion rings.
      for(const [r,c] of [[24,'#ac68c2'],[21,'#f9e6ff'],[17,'#cf8ce0'],[14,'#f9e6ff'],[10,'#cf8ce0'],[7,'#f9e6ff'],[3,'#cf8ce0']])oval(0,0,r,r,c);
    }else if(o.type===3){
      // Ridged pickle chip.
      oval(0,0,21,24,'#477b3c');oval(0,0,17,21,'#a4cb68');
      ctx.strokeStyle='#71a44e';ctx.lineWidth=2;for(let x=-10;x<=10;x+=5){ctx.beginPath();ctx.moveTo(x,-15);ctx.lineTo(x,15);ctx.stroke();}
      for(const y of [-10,0,10])oval(0,y,2,3,'#e2e8a0');
    }else if(o.type===4){
      // Cheese square with small holes.
      bar(-21,-21,42,42,'#d99932');bar(-21,-23,42,40,'#ffdb60');
      for(const [x,y,r] of [[-11,-12,4],[10,-5,5],[-4,9,3]])oval(x,y,r,r,'#eab242');
    }else if(o.type===8){
      oval(0,2,24,22,'#b76e35');oval(0,-1,24,21,'#efb774');oval(0,-4,22,18,'#ef87b4');
      oval(0,-2,8,8,'#98542d');oval(0,-4,6,6,'#0c1d2c');
      for(const [x,y,c] of [[-14,-8,'#fff1ba'],[13,-10,'#a7ffef'],[2,-17,'#fff1ba'],[-12,8,'#a7ffef'],[13,7,'#fff1ba']]){ctx.save();ctx.translate(x,y);ctx.rotate(.6);bar(-3,-1,6,2,c);ctx.restore();}
    }else if(o.type===9){
      oval(0,2,24,23,'#ad6831');oval(0,-2,24,22,'#e8b978');
      for(const [x,y] of [[-12,-12],[5,-15],[15,-2],[-15,3],[0,0],[5,13],[-9,14]])oval(x,y,3.5,3,'#66402d');
    }else if(o.type===10){
      // Grilled corn with individual golden kernels and green husks.
      oval(0,0,14,25,'#c99935');
      for(let y=-18;y<=18;y+=7)for(let x=-8;x<=8;x+=8)oval(x,y,3.5,3,'#ffe27c');
      ctx.fillStyle='#79b65a';ctx.beginPath();ctx.moveTo(-3,25);ctx.quadraticCurveTo(-27,11,-19,-10);ctx.quadraticCurveTo(-11,10,-3,25);ctx.fill();
      ctx.beginPath();ctx.moveTo(3,25);ctx.quadraticCurveTo(27,11,19,-10);ctx.quadraticCurveTo(11,10,3,25);ctx.fill();
    }else if(o.type===11){
      // Hot dog in a toasted bun with a mustard zigzag.
      oval(0,0,16,25,'#ce8a43');oval(-5,0,9,23,'#f0c078');oval(5,0,9,23,'#f0c078');oval(0,0,8,23,'#b95037');
      ctx.strokeStyle='#ffd75a';ctx.lineWidth=3;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-3,-17);for(let y=-11,i=0;y<=18;y+=6,i++)ctx.lineTo(i%2?-3:3,y);ctx.stroke();
    }else{
      // Unbranded ketchup and mustard squeeze bottles.
      const color=o.type===5?'#ed6251':'#ffd964';
      bar(-5,-29,10,10,'#f2e2c5');bar(-9,-20,18,6,color);bar(-14,-14,28,32,color);oval(0,18,14,5,color);
      bar(-14,-12,4,27,'#ffffff30');bar(-11,-2,22,14,'#fff0ce');
      ctx.fillStyle=o.type===5?'#bd4034':'#ae7d21';ctx.font='bold 12px system-ui';ctx.textAlign='center';ctx.fillText(o.type===5?'K':'M',0,9);
    }
    ctx.restore();
  }
  function draw(dt,now){const dpr=Math.min(devicePixelRatio||1,2),r=canvas.getBoundingClientRect();if(canvas.width!==Math.round(r.width*dpr)||canvas.height!==Math.round(r.height*dpr)){canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}ctx.setTransform(canvas.width/360,0,0,canvas.height/540,0,0);ctx.fillStyle='#0c1d2c';ctx.fillRect(0,0,360,540);ctx.strokeStyle='#18384b';ctx.lineWidth=1;for(let x=0;x<=360;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,540);ctx.stroke();}for(let y=0;y<=540;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(360,y);ctx.stroke();}if(!reduced())for(const e of game.effects){ctx.globalAlpha=Math.max(0,e.life/.7);if(e.half)snack(e,e.half);else{ctx.fillStyle=colors[e.type];ctx.beginPath();ctx.arc(e.x,e.y,3,0,7);ctx.fill();}}ctx.globalAlpha=1;for(const o of game.items)snack(o);trail=trail.filter(p=>(p.life-=dt)>0);if(trail.length){ctx.lineCap='round';ctx.lineJoin='round';ctx.strokeStyle='#94fff1';ctx.lineWidth=4;ctx.beginPath();trail.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}if(keys.size){ctx.strokeStyle='#ffffff';ctx.beginPath();ctx.arc(blade.x,blade.y,10,0,7);ctx.stroke();}if(now>comboUntil)$('sliceCombo').textContent='';}
  function frame(now){const dt=Math.min(.04,(now-lastFrame)/1000||0);lastFrame=now;if(game.state==='running'){const before={...blade};blade.x=Math.max(0,Math.min(360,blade.x+((keys.has('ArrowRight')?1:0)-(keys.has('ArrowLeft')?1:0))*360*dt));blade.y=Math.max(0,Math.min(540,blade.y+((keys.has('ArrowDown')?1:0)-(keys.has('ArrowUp')?1:0))*360*dt));if(keys.has(' '))cut(before,blade);game.step(dt);hud();if(game.state==='over')result();}draw(dt,now);requestAnimationFrame(frame);}requestAnimationFrame(frame);
})();
