(() => {
  const params = new URLSearchParams(location.search);
  const requested = params.get('game');
  if (!requested || requested === 'blockGrid') { location.replace('neondrift.html'); return; }
  const key = ['mergeRush','perfectDrop','spiralDrop','shapeFit','bounceRun','trafficEscape'].includes(requested) ? requested : 'mergeRush';

  const configs = {
    mergeRush:{icon:'🔢',name:'Merge Rush',scoreLabel:'Score',secondaryLabel:'High Tile',help:'Make 64 in 48 swipes. Equal numbers merge. Clear targets to score.',reward:v=>Arcade.gameReward('mergeRush',v)},
    perfectDrop:{icon:'🎯',name:'Perfect Drop',scoreLabel:'Hits',secondaryLabel:'Level',help:'🎯 Tap to drop. Land inside green. Reach Level 5 at 20 hits. Three misses ends the run. 🪙 Run Reward is paid when the game ends.',reward:v=>Arcade.gameReward('perfectDrop',v)},
    spiralDrop:{icon:'🌀',name:'Spiral Drop',scoreLabel:'Rows',secondaryLabel:'Level',help:'Move left or right so the ball falls through each opening.',reward:v=>Arcade.gameReward('spiralDrop',v)},
    shapeFit:{icon:'🧠',name:'Shape Fit',scoreLabel:'Correct',secondaryLabel:'Streak',help:'The target can rotate. Find the same shape in a different direction before time runs out. Three mistakes ends the run.',reward:v=>Arcade.gameReward('shapeFit',v)},
    bounceRun:{icon:'⚪',name:'Bounce Run',scoreLabel:'Distance',secondaryLabel:'Cleared',help:'Tap anywhere to jump. Time each jump to clear the red obstacles.',reward:v=>Arcade.gameReward('bounceRun',v)},
    trafficEscape:{icon:'🚦',name:'Traffic Escape',scoreLabel:'Cars',secondaryLabel:'Level',help:'Tap only cars with a clear arrow path. Every cleared road raises density and tightens the timer. Three crashes ends the run.',reward:v=>Arcade.gameReward('trafficEscape',v)}
  };

  const config = configs[key] || configs.mergeRush;
  const surface = document.getElementById('surface');
  const scoreEl = document.getElementById('score');
  const secondaryEl = document.getElementById('secondary');
  const rewardEl = document.getElementById('rewardPreview');
  const runRewardPill = document.getElementById('runRewardPill');
  const playsEl = document.getElementById('plays');
  const balanceEl = document.getElementById('balance');
  const statusEl = document.getElementById('gameStatus');
  const startButton = document.getElementById('startButton');
  const helpEl = document.getElementById('miniHelp');

  const publicGuide = document.getElementById('miniPublicGuide');
  if (publicGuide) {
    publicGuide.href = 'game-guides.html#' + key;
    publicGuide.textContent = 'How to play ' + config.name + ' · guide & tips';
  }
  document.title = config.name + ' - Online Arcade Game | Earnly Arcade';
  const pageDescription = document.querySelector('meta[name="description"]');
  if (pageDescription) pageDescription.content = 'Play ' + config.name + ' in your browser. ' + config.help.replace(/[🎯🪙]/gu, '').trim();
  const canonical = document.createElement('link');
  canonical.rel = 'canonical';
  canonical.href = 'https://earnlyarcade.com/mini.html?game=' + key;
  document.head.append(canonical);
  document.getElementById('gameIcon').textContent = config.icon;
  document.getElementById('gameTitle').textContent = config.name;
  surface.setAttribute('aria-label', config.name + ' play area');
  document.getElementById('scoreLabel').textContent = config.scoreLabel;
  document.getElementById('secondaryLabel').textContent = config.secondaryLabel;
  helpEl.textContent = config.help;
  document.body.classList.toggle('mini-traffic', key === 'trafficEscape');
  document.body.classList.toggle('mini-mergeRush', key === 'mergeRush');
  document.body.classList.toggle('mini-perfectDrop', key === 'perfectDrop');
  document.body.classList.toggle('mini-spiralDrop', key === 'spiralDrop');
  document.body.classList.toggle('mini-shapeFit', key === 'shapeFit');
  document.body.classList.toggle('mini-bounceRun', key === 'bounceRun');

  let running = false;
  let starting = false;
  let finished = false;
  let engine = null;
  let runStartedAt = 0;
  let totalPausedMs = 0;
  let pauseStartedAt = 0;
  let miniPaused = false;
  let resultShowing = false;

  function setStatus(text, mode) {
    statusEl.textContent = text;
    statusEl.className = 'game-status' + (mode ? ' ' + mode : '');
    document.body.classList.toggle('game-active', mode === 'running');
  }

  let lastRewardPreview = 0;
  function ui(score = 0, secondary = 0) {
    score = Math.max(0, Math.floor(Number(score) || 0));
    scoreEl.textContent = String(score);
    secondaryEl.textContent = String(secondary);
    const reward = config.reward(score);
    rewardEl.textContent = String(reward);
    if (running && reward > lastRewardPreview && runRewardPill) {
      runRewardPill.classList.remove('reward-bump');
      void runRewardPill.offsetWidth;
      runRewardPill.classList.add('reward-bump');
    }
    lastRewardPreview = reward;
  }

  function refreshChrome() {
    playsEl.textContent = Arcade.remaining(key);
    balanceEl.textContent = Arcade.number('points').toLocaleString();
  }

  function showIdle() {
    surface.replaceChildren();
    const box = document.createElement('div');
    box.style.cssText = 'height:390px;display:grid;place-items:center;padding:28px;text-align:center;';
    box.innerHTML = '<div><div style="font-size:50px;margin-bottom:12px">' + config.icon +
      '</div><strong style="display:block;font-size:24px;margin-bottom:8px">' + config.name +
      '</strong><span style="color:#94a3b8;font-size:13px">Tap here to start</span></div>';
    if(key==='bounceRun'){
      box.className='bounce-idle';
      box.innerHTML='<div class="bounce-idle-sun" aria-hidden="true"></div><div class="bounce-idle-island" aria-hidden="true"></div><div class="bounce-idle-ball" aria-hidden="true"><i></i><i></i></div><div class="bounce-idle-copy"><span class="bounce-idle-tag">CLOUD GARDENS</span><strong>Bounce Run</strong><p>One tap. One jump.<br>How far can you roll?</p><span class="bounce-idle-start">Tap to roll →</span></div>';
    }
    surface.append(box);
  }

  function finish(metric, secondary, extra = [], title, badgeText = '') {
    if (finished) return;
    finished = true;
    running = false;
    miniPaused = false;
    pauseStartedAt = 0;

    // Shut the engine down before any reward/storage/result work. This makes
    // Game Over an immediate hard boundary: no RAF, timer, pointer, or delayed
    // gameplay callback can keep changing state behind the result dialog.
    const finishedEngine = engine;
    engine = null;
    if (finishedEngine && finishedEngine.stop) {
      try { finishedEngine.stop(); } catch (err) { console.error('Earnly game cleanup failed', err); }
    }

    const clean = Math.max(0, Math.floor(Number(metric) || 0));
    const elapsedSeconds = runStartedAt ? Math.max(0, Math.round((performance.now()-runStartedAt-totalPausedMs)/1000)) : 0;
    const elapsedLabel = elapsedSeconds >= 60 ? Math.floor(elapsedSeconds/60)+'m '+String(elapsedSeconds%60).padStart(2,'0')+'s' : elapsedSeconds+'s';
    const resultExtra = (Array.isArray(extra) ? extra : [extra]).filter(Boolean);
    resultExtra.push('⏱️ Time played: '+elapsedLabel);
    const coins = config.reward(clean);
    let result = { best:{ display:String(clean) }, newBest:false, xpAward:0 };
    // A storage/cloud bookkeeping problem must never prevent the player from
    // seeing how the run ended. Finish the visual flow even if persistence fails.
    try { Arcade.earn(coins, config.name, { kind:'game', game:key, metric:clean }); } catch (err) { console.error('Earnly reward save failed', err); }
    try { result = Arcade.recordResult(key, clean) || result; } catch (err) { console.error('Earnly result save failed', err); }
    try { Arcade.feedback(clean > 0 ? 'success' : 'fail'); } catch {}

    ui(clean, secondary);
    try { refreshChrome(); } catch (err) { console.error('Earnly chrome refresh failed', err); }
    setStatus('Complete', 'over');
    startButton.disabled = false;
    startButton.textContent = 'Play Again';
    resultShowing = true;

    let playsLeft = 0;
    try { playsLeft = Arcade.remaining(key); } catch (err) { console.error('Earnly plays lookup failed', err); }

    Arcade.gameResult({
      icon:key==='bounceRun'?'✦':config.icon,
      title:title || (badgeText ? config.name + ' — Run Over' : config.name + ' Complete'),
      scoreLabel:config.scoreLabel,
      score:clean,
      best:result?.best?.display || String(clean),
      coins,
      result,
      playsLeft,
      game:key,
      badgeText,
      outcome:key==='bounceRun'?(secondary>0?'You cleared '+secondary+' obstacle'+(secondary===1?'':'s')+'. Keep that rhythm!':'Every great run starts with one jump.'):'',
      tip:key==='bounceRun'?'Tap a little before the crystals. A close pair takes one jump.':'',
      extra:resultExtra,
      onReplay:()=>{ resultShowing=false; startGame(); },
      onMorePlays:()=>{ resultShowing=false; Arcade.out(key, refreshChrome); }
    });
  }

  function pauseAwareDelay(callback, delay=0) {
    let remaining=Math.max(0,delay);
    let lastChecked=performance.now();
    const wait=()=>{
      if(!running) return;
      const now=performance.now();
      if(miniPaused){
        // Freeze delayed transitions while paused. Without this, a long pause
        // could silently consume a celebration/mismatch delay and fire the
        // callback immediately on resume.
        lastChecked=now;
        setTimeout(wait,Math.min(80,Math.max(16,remaining)));
        return;
      }
      remaining-=Math.max(0,now-lastChecked);
      lastChecked=now;
      if(remaining<=0){
        callback();
        return;
      }
      setTimeout(wait,Math.min(80,Math.max(16,remaining)));
    };
    setTimeout(wait,Math.min(80,Math.max(0,remaining)));
  }

  function makeMergeRush() {
    let game=null,state=null,alive=false,startX=0,startY=0;
    const wrap=document.createElement('div');wrap.className='merge-wrap';
    const rules=document.createElement('div');rules.className='merge-rules';
    rules.innerHTML='<span>Swipe to slide every tile</span><span>Equal numbers merge</span><span>Make 64 in 48 swipes</span><span>Only cleared targets score</span>';
    const grid=document.createElement('div');grid.className='merge-grid';grid.style.touchAction='none';
    const progress=document.createElement('div');progress.className='merge-progress';
    const callout=document.createElement('div');callout.className='merge-callout';callout.setAttribute('aria-live','polite');
    const goal=document.createElement('div');goal.className='merge-goal';
    goal.innerHTML='<strong>Make 64</strong><span>Only targets score · every swipe costs 1 move</span><i><b></b></i>';
    wrap.append(rules,progress,callout,grid,goal);surface.replaceChildren(wrap);
    const high=()=>Math.max(0,...state.board);
    function render(){
      grid.replaceChildren();state.board.forEach(v=>{
        const d=document.createElement('div');d.className='merge-tile';d.textContent=v||'';
        if(v){const power=Math.log2(v),hue=(212-power*23+360)%360,light=Math.min(64,30+power*4.5);d.dataset.value=String(v);d.style.background='linear-gradient(145deg,hsl('+hue+' 82% '+(light+7)+'%),hsl('+hue+' 78% '+Math.max(22,light-6)+'%))';d.style.borderColor='hsl('+hue+' 72% '+Math.min(78,light+16)+'%)';d.style.boxShadow='inset 0 1px 0 rgba(255,255,255,.18),0 8px 18px hsla('+hue+',80%,45%,.14)';}
        grid.append(d);
      });
      const filled=state.board.filter(Boolean).length;wrap.classList.toggle('merge-danger',filled>=13||state.left<=8);
      progress.innerHTML='<span><strong>'+state.target+'</strong><small>target tile</small></span><span><strong>'+state.left+'</strong><small>swipes left</small></span><span><strong>'+state.next+'</strong><small>next tile</small></span><span><strong>'+state.cleared+'</strong><small>targets cleared</small></span>';
      wrap.dataset.swipes=String(state.left);wrap.dataset.target=String(state.target);
      goal.querySelector('strong').textContent='Make '+state.target+' · earn '+(100*Math.pow(2,state.cleared))+' points';
      goal.querySelector('i b').style.width=Math.max(3,Math.min(100,high()/state.target*100))+'%';
      ui(state.score,high());
    }
    function move(dir){
      if(!alive||miniPaused)return;
      const previous=state;state=game.move(dir);render();
      goal.classList.remove('merge-pop','merge-shake');
      callout.className='merge-callout';
      if(state.clearedNow){callout.classList.add('hot');callout.textContent='🎯 '+previous.target+' made! +'+(state.score-previous.score)+' points · new swipe budget';goal.classList.add('merge-pop');Arcade.feedback('perfect');}
      else if(!state.changed){callout.textContent='No tiles moved · 1 swipe used';goal.classList.add('merge-shake');Arcade.feedback('fail');}
      else if(state.left<=8){callout.classList.add('danger');callout.textContent=state.left+' swipes left — make '+state.target;Arcade.feedback(state.biggest?'score':'move');}
      else if(state.board.filter(Boolean).length>=13){callout.classList.add('danger');callout.textContent='⚠️ Board almost full — make space!';Arcade.feedback(state.biggest?'score':'move');}
      else{callout.textContent='Swipe to slide every tile. Equal numbers merge.';Arcade.feedback(state.biggest>=32?'perfect':state.biggest?'score':'move');}
      if(state.over){alive=false;finish(state.score,high(),['🎯 Targets cleared: '+state.cleared,'🔢 Highest tile: '+high(),'👆 Swipes used: '+state.moves,'Next target: '+state.target,'Points come from cleared targets. Keep your largest tile in a corner.'],state.reason);}
    }
    let swipePointer=null;
    function beginSwipe(e){
      if(!alive || miniPaused || swipePointer!==null)return;
      if(e.isPrimary===false || (e.pointerType==='mouse' && e.button!==0))return;
      e.preventDefault();
      swipePointer=e.pointerId;
      try{grid.setPointerCapture?.(e.pointerId)}catch{}
      startX=e.clientX;
      startY=e.clientY;
    }
    function endSwipe(e){
      if(!alive || miniPaused || swipePointer!==e.pointerId)return;
      const dx=e.clientX-startX, dy=e.clientY-startY;
      swipePointer=null;
      const distance=Math.max(Math.abs(dx),Math.abs(dy));
      if(distance<18)return;
      e.preventDefault();
      move(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
    }

    grid.addEventListener('pointerdown',beginSwipe,{passive:false});
    grid.addEventListener('pointerup',endSwipe,{passive:false});
    grid.addEventListener('pointercancel',e=>{if(swipePointer===e.pointerId)swipePointer=null});
    grid.addEventListener('lostpointercapture',e=>{if(swipePointer===e.pointerId)swipePointer=null});
    grid.addEventListener('click',e=>{if(alive)e.preventDefault()});

    const onWideSwipeDown=e=>{
      if(miniPaused || swipePointer!==null || grid.contains(e.target) || !Arcade.inExpandedGameZone(e,surface,120))return;
      e.preventDefault();
      beginSwipe(e);
    };
    const onWideSwipeUp=e=>endSwipe(e);
    document.addEventListener('pointerdown',onWideSwipeDown,{passive:false});
    document.addEventListener('pointerup',onWideSwipeUp,{passive:false});

    const onKey=e=>{
      if(!alive)return;
      const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];
      if(dir){e.preventDefault();move(dir)}
    };
    document.addEventListener('keydown',onKey);

    return {
      start(){game=MergeRushRules.create();state=game.snapshot();alive=true;callout.className='merge-callout';callout.textContent='Swipe to slide every tile. Equal numbers merge.';render()},
      adjustPauseTime(){if(miniPaused)swipePointer=null;},
      stop(){alive=false;swipePointer=null;startX=0;startY=0;goal.classList.remove('merge-pop','merge-shake');document.removeEventListener('keydown',onKey);document.removeEventListener('pointerdown',onWideSwipeDown);document.removeEventListener('pointerup',onWideSwipeUp);}
    };
  }

  function canvasBase() {
    const c=document.createElement('canvas');
    c.width=360;c.height=430;c.className='mini-canvas';
    surface.replaceChildren(c);
    return [c,c.getContext('2d')];
  }

  function makePerfectDrop() {
    const [c,ctx]=canvasBase();
    let x=40,dir=1,speed=3,targetX=110,targetW=150,hits=0,streak=0,lives=3,drop=null,alive=false,raf=null;
    let flashText='',flashFrames=0,goalCelebrated=false,roundDeadline=0,roundLimit=0,bestStreak=0,perfects=0,perfectPauseAt=0;

    function level(){
      return Math.min(9,1+Math.floor(hits/5));
    }

    function stageName(){
      const lv=level();
      return lv<=1?'Warm-up':lv<=3?'Timing Zone':lv<=5?'Fast Drop':'Precision Master';
    }

    function next() {
      const lv=level();
      targetW=Math.max(44,150-(lv-1)*16-hits*1.2);
      targetX=20+Math.random()*(320-targetW);
      speed=Math.min(9.2,3+(lv-1)*.65+hits*.08);
      x=dir>0?30:330;
      drop=null;
      // Give the player a few rail passes to line up a drop, but never let
      // them wait forever. Later levels tighten the decision window.
      roundLimit=Math.max(3200,6200-(lv-1)*350);
      roundDeadline=performance.now()+roundLimit;
    }

    function roundedRect(x,y,w,h,r,fill,stroke) {
      ctx.beginPath();
      ctx.roundRect(x,y,w,h,r);
      if(fill){ctx.fillStyle=fill;ctx.fill()}
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=2;ctx.stroke()}
    }

    function draw() {
      const lv=level();
      const progress=hits%5;
      const bg=ctx.createLinearGradient(0,0,0,430);
      bg.addColorStop(0,'#0d1728');
      bg.addColorStop(1,'#142640');
      ctx.fillStyle=bg;ctx.fillRect(0,0,360,430);

      // Rule strip.
      roundedRect(14,14,332,48,12,'#0b1524','#334155');
      ctx.textAlign='left';ctx.textBaseline='middle';
      ctx.fillStyle='#dbeafe';ctx.font='700 12px Arial';
      ctx.fillText('👆 TAP TO DROP',28,31);
      ctx.fillStyle='#94a3b8';ctx.font='700 10px Arial';
      ctx.fillText('Land inside green before time runs out · 3 misses ends run',28,48);

      // Level + lives row.
      ctx.textAlign='center';
      roundedRect(22,77,112,36,12,'#111c2d','#334155');
      ctx.fillStyle='#93c5fd';ctx.font='800 13px Arial';ctx.fillText('LEVEL '+lv,78,91);ctx.fillStyle='#94a3b8';ctx.font='700 8px Arial';ctx.fillText(stageName().toUpperCase(),78,104);
      roundedRect(226,77,112,36,12,'#111c2d','#334155');
      ctx.fillStyle='#fca5a5';ctx.font='800 13px Arial';
      ctx.fillText('❤'.repeat(lives)+'♡'.repeat(3-lives),282,95);

      // Progress toward next level.
      ctx.fillStyle='#243244';ctx.fillRect(98,128,164,9);
      const progWidth=164*Math.min(1,progress/5);
      ctx.fillStyle='#3b82f6';ctx.fillRect(98,128,progWidth,9);
      ctx.fillStyle='#94a3b8';ctx.font='700 10px Arial';
      ctx.fillText(progress+'/5 to Level '+Math.min(9,lv+1),180,151);

      // Per-drop pressure timer. It pauses once the player commits to a drop.
      const timeLeft=drop?Math.max(0,roundDeadline-performance.now()):Math.max(0,roundDeadline-performance.now());
      const timerRatio=roundLimit?Math.max(0,Math.min(1,timeLeft/roundLimit)):1;
      // Give the pressure timer its own clear lane so the moving ball never
      // covers the countdown text on small phone screens.
      ctx.fillStyle='#243244';ctx.fillRect(98,158,164,7);
      ctx.fillStyle=timeLeft<=1500?'#ef4444':timeLeft<=2800?'#f59e0b':'#22c55e';
      ctx.fillRect(98,158,164*timerRatio,7);
      ctx.fillStyle=timeLeft<=1500?'#fca5a5':'#cbd5e1';ctx.font='800 10px Arial';
      ctx.fillText('⏱ DROP IN '+(timeLeft/1000).toFixed(1)+'s',180,177);

      // Ball rail sits lower than the timer lane.
      ctx.strokeStyle='#475569';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(20,207);ctx.lineTo(340,207);ctx.stroke();
      ctx.fillStyle='rgba(148,163,184,.18)';
      ctx.fillRect(20,198,320,18);

      const ballX=drop?drop.x:x;
      const ballY=drop?drop.y:195;
      const ballGlow=ctx.createRadialGradient(ballX-4,ballY-5,2,ballX,ballY,18);
      ballGlow.addColorStop(0,'#ffffff');
      ballGlow.addColorStop(.55,'#dbeafe');
      ballGlow.addColorStop(1,'#60a5fa');
      ctx.beginPath();ctx.fillStyle=ballGlow;ctx.arc(ballX,ballY,12,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#bfdbfe';ctx.lineWidth=2;ctx.stroke();

      // Target + perfect center.
      const targetY=344;
      roundedRect(targetX,targetY,targetW,42,10,'#14532d','#22c55e');
      const perfectW=Math.max(18,targetW*.34);
      const perfectX=targetX+(targetW-perfectW)/2;
      roundedRect(perfectX,targetY+5,perfectW,32,8,'#22c55e','#86efac');
      ctx.fillStyle='#dcfce7';ctx.font='800 9px Arial';
      ctx.fillText('PERFECT',targetX+targetW/2,targetY+21);

      // Guide line while ball is falling.
      if(drop){
        ctx.setLineDash([5,5]);
        ctx.strokeStyle='rgba(147,197,253,.38)';
        ctx.beginPath();ctx.moveTo(drop.x,203);ctx.lineTo(drop.x,targetY);ctx.stroke();
        ctx.setLineDash([]);
      }

      // Hit streak.
      ctx.fillStyle='#aab6c8';ctx.font='700 11px Arial';
      ctx.fillText('🔥 Streak '+streak,180,408);

      if(flashFrames>0){
        ctx.save();
        ctx.globalAlpha=Math.min(1,flashFrames/10);
        roundedRect(92,244,176,54,14,'rgba(15,23,42,.92)',flashText==='PERFECT!'?'#fbbf24':'#22c55e');
        ctx.fillStyle=flashText==='PERFECT!'?'#fde68a':'#bbf7d0';
        ctx.font='900 22px Arial';ctx.fillText(flashText,180,271);
        ctx.restore();
        flashFrames--;
      }
    }

    function act() {
      if(!alive||drop||miniPaused)return;
      drop={x,y:195};
      Arcade.feedback('move');
    }

    function handleLanding() {
      const landedX=drop.x;
      const hit=landedX>=targetX&&landedX<=targetX+targetW;
      const perfectW=Math.max(18,targetW*.34);
      const perfectX=targetX+(targetW-perfectW)/2;
      const perfect=landedX>=perfectX&&landedX<=perfectX+perfectW;

      if(hit){
        hits++;
        streak++;
        bestStreak=Math.max(bestStreak,streak);
        if(perfect)perfects++;
        flashText=perfect?'PERFECT!':'NICE!';
        flashFrames=26;
        Arcade.feedback(perfect?'perfect':'score');

        // The landing itself already gives perfect feedback. Avoid firing
        // a second identical effect on every third perfect streak.
        if(hits>=20&&!goalCelebrated){
          // The landing already gives perfect feedback. Mark the Level 5 goal
          // without stacking another effect on that same successful drop.
          goalCelebrated=true;
        }
      }else{
        lives--;
        streak=0;
        flashText='MISS';
        flashFrames=24;
        Arcade.feedback('fail');
      }

      ui(hits,level());

      if(lives<=0){
        alive=false;
        finish(
          hits,
          level(),
          [
            '🎯 Level reached: '+level(),
            '✨ Perfect drops: '+perfects,
            '🔥 Best streak: '+bestStreak,
            hits>=20?'🏆 You reached the Level 5 goal!':'Reach 20 hits to conquer Level 5.'
          ],
          'Perfect Drop Run Over'
        );
        return;
      }

      next();
    }

    function loop() {
      if(!alive)return;
      if(miniPaused){
        if(!perfectPauseAt) perfectPauseAt=performance.now();
        raf=requestAnimationFrame(loop);
        return;
      }
      if(perfectPauseAt){
        roundDeadline+=performance.now()-perfectPauseAt;
        perfectPauseAt=0;
      }

      if(drop){
        drop.y+=9.2;
        if(drop.y>=333) handleLanding();
      }else{
        if(performance.now()>=roundDeadline){
          lives--;
          streak=0;
          flashText='TOO SLOW!';
          flashFrames=28;
          Arcade.feedback('fail');
          ui(hits,level());
          if(lives<=0){
            alive=false;
            finish(hits,level(),['🎯 Level reached: '+level(),'✨ Perfect drops: '+perfects,'🔥 Best streak: '+bestStreak,'⏱️ Keep an eye on the drop timer.'],'Perfect Drop Run Over');
            return;
          }
          next();
        }
        x+=speed*dir;
        if(x>=330){x=330;dir=-1}
        else if(x<=30){x=30;dir=1}
      }

      draw();
      raf=requestAnimationFrame(loop);
    }

    let dropPointer=null;
    const triggerDrop=e=>{
      if(!alive || miniPaused || dropPointer!==null)return;
      if(e.isPrimary===false || (e.pointerType==='mouse' && e.button!==0))return;
      e.preventDefault();
      dropPointer=e.pointerId;
      act();
      requestAnimationFrame(()=>{ if(dropPointer===e.pointerId) dropPointer=null; });
    };
    c.addEventListener('pointerdown',triggerDrop,{passive:false});

    const onWidePointer=e=>{
      if(!alive || miniPaused || dropPointer!==null || e.target===c || !Arcade.inExpandedGameZone(e,c,140))return;
      triggerDrop(e);
    };
    document.addEventListener('pointerdown',onWidePointer,{passive:false});

    const onKey=e=>{
      if(alive&&(e.code==='Space'||e.key==='Enter')){
        e.preventDefault();
        act();
      }
    };
    document.addEventListener('keydown',onKey);

    return {
      start(){
        hits=0;streak=0;bestStreak=0;perfects=0;perfectPauseAt=0;lives=3;alive=true;goalCelebrated=false;flashText='';flashFrames=0;
        next();ui(0,1);draw();raf=requestAnimationFrame(loop);
      },
      adjustPauseTime(){ dropPointer=null; },
      stop(){
        alive=false;
        dropPointer=null;
        drop=null;
        roundDeadline=0;
        perfectPauseAt=0;
        flashFrames=0;
        cancelAnimationFrame(raf);
        raf=null;
        document.removeEventListener('keydown',onKey);
        document.removeEventListener('pointerdown',onWidePointer);
      }
    };
  }

  function makeSpiralDrop() {
    const [c,ctx]=canvasBase();
    let ballX=180,rows=[],score=0,alive=false,raf=null,last=0,readyUntil=0;
    let controlPointer=null,levelFlash='',levelFlashFrames=0,bestLevel=1;
    let pointerStartClientX=0;
    let pointerStartBallX=180;
    let spiralPauseAt=0;

    function level(){return 1+Math.floor(score/5)}
    function stageName(){
      const lv=level();
      return lv<=1?'Warm-up':lv<=3?'Spiral Zone':lv<=6?'Fast Fall':'Expert Drop';
    }

    function openingWidth(){
      // Smooth difficulty curve: openings tighten steadily instead of
      // suddenly becoming punishing late in a good run.
      if(score<10)return Math.max(88,126-score*2.2);
      if(score<25)return Math.max(64,104-(score-10)*2.1);
      if(score<45)return Math.max(50,73-(score-25)*1.15);
      return Math.max(42,52-(score-45)*.32);
    }

    function fallSpeed(){
      if(score<10)return .92+score*.045;
      if(score<25)return 1.37+(score-10)*.04;
      if(score<45)return 1.97+(score-25)*.03;
      if(score<70)return 2.57+(score-45)*.018;
      return Math.min(3.35,3.02+(score-70)*.008);
    }

    function ringColor(r){
      // Color communicates urgency as a ring approaches the ball.
      if(r.y<165)return '#ef4444';
      if(r.y<235)return '#f59e0b';
      if(r.y<315)return '#22c55e';
      return '#7c3aed';
    }

    function randomGap(width){
      const half=width/2;
      const edge=half+28;
      const min=edge,max=360-edge;
      const recent=rows.slice(-5).map(r=>r.gap);
      if(!recent.length)return 180;

      const previous=recent[recent.length-1];
      const before=recent.length>1?recent[recent.length-2]:null;
      const before2=recent.length>2?recent[recent.length-3]:null;
      const minMove=Math.max(score>=45?68:score>=20?58:46,width*(score>=45?.62:.46));
      const maxMove=Math.max(minMove+18,Math.min(138,(max-min)*.78));
      const candidates=[];

      for(let attempt=0;attempt<40;attempt++){
        // Use many possible step sizes instead of forcing opposite edges.
        const direction=Math.random()<.5?-1:1;
        const distance=minMove+Math.random()*(maxMove-minMove);
        let candidate=previous+direction*distance;

        // Reflect naturally off an edge rather than snapping to the opposite edge.
        if(candidate<min)candidate=min+(min-candidate)*.55;
        if(candidate>max)candidate=max-(candidate-max)*.55;
        candidate=Math.max(min,Math.min(max,candidate));

        const move=Math.abs(candidate-previous);
        if(move<minMove*.82)continue;

        // Block obvious A-B-A and A-B-A-B grooves, but do not over-constrain
        // the board into a forced left/right ping-pong pattern.
        if(before!==null&&Math.abs(candidate-before)<26)continue;
        if(before2!==null&&Math.abs(candidate-before2)<20)continue;

        // Prefer fresh positions while keeping several choices random.
        const clearance=Math.min(...recent.map(g=>Math.abs(candidate-g)));
        candidates.push({candidate,quality:clearance+Math.random()*42});
      }

      if(candidates.length){
        candidates.sort((a,b)=>b.quality-a.quality);
        return candidates[Math.floor(Math.random()*Math.min(8,candidates.length))].candidate;
      }

      // Gentle fallback: move away from the previous opening without creating
      // a hard edge-to-edge rhythm.
      const roomLeft=previous-min,roomRight=max-previous;
      const dir=roomRight>roomLeft?1:-1;
      return Math.max(min,Math.min(max,previous+dir*Math.min(Math.max(48,minMove),Math.max(roomLeft,roomRight)*.7)));
    }

    function resetRings() {
      rows=[];
      const firstWidth=140;

      // First opening is intentionally centered and farther away so a new
      // player can see the ball, understand the goal, and make a move.
      rows.push({y:238,gap:180,w:firstWidth,checked:false,first:true});

      let y=338;
      for(let i=1;i<6;i++){
        const width=i===1?126:openingWidth();
        rows.push({
          y,
          gap:randomGap(width),
          w:width,
          checked:false,
          first:false
        });
        y+=88;
      }
    }

    function draw() {
      const bg=ctx.createLinearGradient(0,0,0,430);
      bg.addColorStop(0,'#0a1424');
      bg.addColorStop(1,'#101c31');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,360,430);

      // A single short cue leaves the upcoming opening easy to see.
      ctx.textAlign='center';
      if(score<2){
        ctx.fillStyle='#c4dcf5';
        ctx.font='700 12px Arial';
        ctx.fillText(matchMedia('(pointer:coarse)').matches ? 'Slide toward the gap' : 'Drag or use ← →',180,34);
      }

      rows.forEach(r=>{
        const safe=r.first && !r.checked;
        const color=safe?'#2563eb':ringColor(r);
        ctx.fillStyle=color;
        ctx.shadowColor=safe?'rgba(59,130,246,.55)':color;
        ctx.shadowBlur=safe?10:4;
        for(const [x,width] of [[15,Math.max(0,r.gap-r.w/2-15)],[r.gap+r.w/2,Math.max(0,345-(r.gap+r.w/2))]]){
          if(width<=0)continue;
          ctx.fillStyle=color;
          ctx.beginPath();ctx.roundRect(x,r.y,width,14,4);ctx.fill();
          ctx.shadowBlur=0;
          ctx.fillStyle='rgba(255,255,255,.3)';
          ctx.fillRect(x+3,r.y+2,Math.max(0,width-6),2);
        }

        if(safe){
          ctx.shadowBlur=0;
          ctx.fillStyle='#93c5fd';
          ctx.font='800 9px Arial';
          ctx.fillText('↓',r.gap,r.y-9);
        }
      });
      ctx.shadowBlur=0;

      // Score and level already live in the page HUD.
      ctx.textAlign='center';

      if(levelFlashFrames>0){
        // Small center HUD between LEVEL and ROWS: noticeable without making
        // the player look away from the next gap.
        ctx.save();
        const fade=Math.min(1,levelFlashFrames/8,(34-levelFlashFrames)/6);
        ctx.globalAlpha=Math.max(0,fade);
        ctx.fillStyle='rgba(15,23,42,.92)';
        ctx.beginPath();ctx.roundRect(137,17,86,28,14);ctx.fill();
        ctx.strokeStyle='#f59e0b';ctx.lineWidth=1.25;ctx.stroke();
        ctx.fillStyle='#fef3c7';ctx.font='900 10px Arial';ctx.textAlign='center';
        ctx.fillText('⬆ '+levelFlash,180,35);
        ctx.restore();
        levelFlashFrames--;
      }

      // Ball with a glow so it is always easy to find.
      const glow=ctx.createRadialGradient(ballX-4,106,2,ballX,110,18);
      glow.addColorStop(0,'#ffffff');
      glow.addColorStop(.55,'#dbeafe');
      glow.addColorStop(1,'#60a5fa');
      ctx.beginPath();
      ctx.fillStyle=glow;
      ctx.arc(ballX,110,11,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#bfdbfe';
      ctx.lineWidth=2;
      ctx.stroke();

      if(performance.now()<readyUntil){
        ctx.setLineDash([5,5]);
        ctx.strokeStyle='rgba(147,197,253,.42)';
        ctx.beginPath();
        ctx.moveTo(ballX,126);
        ctx.lineTo(ballX,220);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle='rgba(15,23,42,.9)';
        ctx.beginPath();
        ctx.roundRect(105,152,150,44,12);
        ctx.fill();
        ctx.strokeStyle='#3b82f6';
        ctx.stroke();
        ctx.fillStyle='#bfdbfe';
        ctx.font='900 14px Arial';
        ctx.fillText('LOOK FIRST 👀',180,174);
        ctx.fillStyle='#94a3b8';
        ctx.font='700 9px Arial';
        ctx.fillText('Movement starts in a moment',180,188);
      }
    }

    function setBallFromDrag(clientX){
      const rect=c.getBoundingClientRect();
      const scale=360/Math.max(1,rect.width);
      const delta=(Number(clientX)-pointerStartClientX)*scale;
      ballX=Math.max(25,Math.min(335,pointerStartBallX+delta));
    }

    function nudge(dx){
      ballX=Math.max(25,Math.min(335,ballX+dx));
    }

    function loop(t) {
      if(!alive)return;
      if(miniPaused){
        if(!spiralPauseAt)spiralPauseAt=t;
        heldKeys.clear();
        controlPointer=null;
        last=t;
        raf=requestAnimationFrame(loop);
        return;
      }
      if(spiralPauseAt){
        readyUntil+=t-spiralPauseAt;
        spiralPauseAt=0;
      }
      const dt=Math.min(32,t-(last||t))/16.67;
      last=t;

      // Keyboard movement is frame-based so holding an arrow feels like a
      // normal desktop game and works even when browser key-repeat is disabled.
      if(heldKeys.has('left')&&!heldKeys.has('right'))nudge(-5.2*dt);
      if(heldKeys.has('right')&&!heldKeys.has('left'))nudge(5.2*dt);

      // Give the player time after GO to locate the ball and first opening.
      const warmingUp=t<readyUntil;
      const speed=warmingUp ? 0 : fallSpeed();

      rows.forEach(r=>r.y-=speed*dt);

      for(const r of rows){
        if(!r.checked&&r.y<=120&&r.y>=98){
          r.checked=true;
          r.first=false;

          if(Math.abs(ballX-r.gap)>r.w/2-8){
            alive=false;
            finish(
              score,
              level(),
              [
                '🎯 Level reached: '+level(),
                '⚡ Stage: '+stageName()
              ],
              'Spiral Drop'
            );
            return;
          }

          score++;
          bestLevel=Math.max(bestLevel,level());
          Arcade.feedback('score');
          ui(score,level());

          if(score>0&&score%5===0){
            // Keep level feedback inside the player's focal area. The persistent
            // LEVEL card updates immediately, so a large page-level toast only
            // pulls attention away from the next opening at higher speeds.
            levelFlash='LEVEL '+level();
            levelFlashFrames=34;
          }
        }
      }

      while(rows.length&&rows[0].y<-20)rows.shift();
      while(rows.length<6){
        const rowSpacing=Math.max(64,88-Math.floor(score/12)*4);
        const y=(rows.length?rows[rows.length-1].y:430)+rowSpacing;
        const width=openingWidth();
        rows.push({
          y,
          gap:randomGap(width),
          w:width,
          checked:false,
          first:false
        });
      }

      draw();
      raf=requestAnimationFrame(loop);
    }

    function beginPointer(e){
      if(!alive || miniPaused || controlPointer!==null)return;
      if(e.isPrimary===false || (e.pointerType==='mouse' && e.button!==0))return;
      controlPointer=e.pointerId;
      pointerStartClientX=e.clientX;
      pointerStartBallX=ballX;
      try{c.setPointerCapture?.(e.pointerId)}catch{}
    }

    function movePointer(e){
      if(!alive||miniPaused||controlPointer!==e.pointerId)return;
      e.preventDefault();
      setBallFromDrag(e.clientX);
    }

    function endPointer(e){
      if(controlPointer!==e.pointerId)return;
      controlPointer=null;
      pointerStartClientX=0;
      pointerStartBallX=ballX;
    }

    const spiralZone=document.createElement('div');
    spiralZone.className='spiral-control-zone';
    spiralZone.innerHTML='<span>↔ Slide to steer</span>';
    c.insertAdjacentElement('afterend',spiralZone);

    c.style.touchAction='none';
    c.style.userSelect='none';
    c.style.webkitUserSelect='none';
    c.addEventListener('pointerdown',e=>{
      e.preventDefault();
      beginPointer(e);
    });
    c.addEventListener('pointermove',movePointer,{passive:false});
    c.addEventListener('pointerup',endPointer);
    c.addEventListener('pointercancel',endPointer);
    c.addEventListener('lostpointercapture',endPointer);
    spiralZone.addEventListener('pointerdown',e=>{e.preventDefault();beginPointer(e)},{passive:false});
    spiralZone.addEventListener('pointermove',movePointer,{passive:false});
    spiralZone.addEventListener('pointerup',endPointer);
    spiralZone.addEventListener('pointercancel',endPointer);

    const onWideDown=e=>{
      if(miniPaused||controlPointer!==null||e.target===c||spiralZone.contains(e.target)||!Arcade.inExpandedGameZone(e,c,180))return;
      e.preventDefault();
      beginPointer(e);
    };
    const onWideMove=e=>{
      if(controlPointer!==e.pointerId)return;
      e.preventDefault();
      setBallFromDrag(e.clientX);
    };
    const onWideUp=e=>endPointer(e);

    document.addEventListener('pointerdown',onWideDown,{passive:false});
    document.addEventListener('pointermove',onWideMove,{passive:false});
    document.addEventListener('pointerup',onWideUp,{passive:true});
    document.addEventListener('pointercancel',onWideUp,{passive:true});

    // Desktop controls: support both key names and key codes because some
    // browsers report arrow keys differently. Holding a key now moves smoothly
    // instead of relying on browser key-repeat timing.
    const heldKeys=new Set();
    const arrowName=e=>e.key||e.code||'';
    const onKeyDown=e=>{
      if(!alive)return;
      const key=arrowName(e);
      if(key==='ArrowLeft'||e.code==='ArrowLeft'||e.keyCode===37){
        e.preventDefault();heldKeys.add('left');
      }
      if(key==='ArrowRight'||e.code==='ArrowRight'||e.keyCode===39){
        e.preventDefault();heldKeys.add('right');
      }
    };
    const onKeyUp=e=>{
      const key=arrowName(e);
      if(key==='ArrowLeft'||e.code==='ArrowLeft'||e.keyCode===37)heldKeys.delete('left');
      if(key==='ArrowRight'||e.code==='ArrowRight'||e.keyCode===39)heldKeys.delete('right');
    };
    document.addEventListener('keydown',onKeyDown,{capture:true});
    document.addEventListener('keyup',onKeyUp,{capture:true});

    return {
      start(){
        ballX=180;
        score=0;bestLevel=1;
        alive=true;
        last=0;
        controlPointer=null;
        pointerStartClientX=0;
        pointerStartBallX=180;
        levelFlash='';levelFlashFrames=0;spiralPauseAt=0;
        resetRings();
        ui(0,1);
        readyUntil=performance.now()+1250;
        draw();
        raf=requestAnimationFrame(loop);
      },
      adjustPauseTime(){
        controlPointer=null;
        pointerStartClientX=0;
        pointerStartBallX=ballX;
        heldKeys.clear();
      },
      stop(){
        alive=false;
        controlPointer=null;
        readyUntil=0;
        spiralPauseAt=0;
        levelFlashFrames=0;
        pointerStartClientX=0;
        pointerStartBallX=ballX;
        cancelAnimationFrame(raf);
        raf=null;
        document.removeEventListener('keydown',onKeyDown,{capture:true});
        document.removeEventListener('keyup',onKeyUp,{capture:true});
        heldKeys.clear();
        document.removeEventListener('pointerdown',onWideDown);
        document.removeEventListener('pointermove',onWideMove);
        document.removeEventListener('pointerup',onWideUp);
        document.removeEventListener('pointercancel',onWideUp);
      }
    };
  }

  // Each entry must be a genuinely different shape even after rotation.
  // J is a rotation of L, and S is a rotation of Z, so listing them as
  // separate answers could show two visually valid matches while only one
  // was accepted. Keep one representative from each rotation family.
  const SHAPES = [
    {name:'L',cells:[[0,0],[0,1],[0,2],[1,2]]},
    {name:'T',cells:[[0,0],[1,0],[2,0],[1,1]]},
    {name:'Square',cells:[[0,0],[1,0],[0,1],[1,1]]},
    {name:'Zigzag',cells:[[0,0],[1,0],[1,1],[2,1]]},
    {name:'Line',cells:[[0,0],[1,0],[2,0],[3,0]]},
    {name:'Corner',cells:[[0,0],[0,1],[1,1]]}
  ];
  function rotateCells(cells,turns=1){let out=cells.map(([x,y])=>[x,y]);for(let t=0;t<turns;t++)out=out.map(([x,y])=>[3-y,x]);const minX=Math.min(...out.map(p=>p[0])),minY=Math.min(...out.map(p=>p[1]));return out.map(([x,y])=>[x-minX,y-minY])}
  function makeShapeFit(){
    let score=0,streak=0,lives=3,answer=null,alive=false,locked=false,timer=null,timeLeft=0,roundNo=0,bestStreak=0,lastStage='';
    const wrap=document.createElement('div');wrap.className='fit-wrap';const title=document.createElement('div');title.className='fit-title';const target=document.createElement('div');target.className='fit-shape';const hint=document.createElement('div');hint.className='fit-hint';hint.setAttribute('aria-live','polite');const answers=document.createElement('div');answers.className='fit-answers';wrap.append(title,target,hint,answers);surface.replaceChildren(wrap);
    // Keep every Shape Fit choice reachable without requiring the player to
    // find a tiny strip beside the board to scroll the page on mobile.
    wrap.style.touchAction='pan-y';
    answers.style.touchAction='pan-y';
    answers.style.overscrollBehavior='contain';
    answers.style.webkitOverflowScrolling='touch';
    answers.addEventListener('touchmove',e=>e.stopPropagation(),{passive:true});
    function key(cells){return cells.map(p=>p.join(',')).sort().join('|')} function variant(shape,turns){return{name:shape.name,cells:rotateCells(shape.cells,turns),base:shape}}
    function preview(shape,className){const p=document.createElement('span');p.className=className;for(let y=0;y<4;y++)for(let x=0;x<4;x++){const d=document.createElement('span');d.className='fit-preview-dot'+(shape.cells.some(([cx,cy])=>cx===x&&cy===y)?' on':'');p.append(d)}return p}
    function draw(shape){target.replaceChildren();for(let y=0;y<4;y++)for(let x=0;x<4;x++){const d=document.createElement('div');d.className='fit-dot'+(shape.cells.some(([cx,cy])=>cx===x&&cy===y)?' on':'');target.append(d)}}
    function stopTimer(){if(timer){clearInterval(timer);timer=null}}
    function stage(){return roundNo<=3?'Warm-up':roundNo<=8?'Rotation challenge':roundNo<=15?'Quick Match':'Expert Shapes'}
    function header(){
      const pct=Math.max(0,Math.min(100,(timeLeft/(roundNo<=3?7000:Math.max(2800,6600-(roundNo-3)*220)))*100));
      title.innerHTML='<div class="fit-stage"><strong>'+stage()+'</strong><small>Round '+roundNo+' · '+'❤️'.repeat(lives)+'♡'.repeat(3-lives)+'</small></div><div class="fit-clock"><span>⏱️ '+(timeLeft/1000).toFixed(1)+'s</span><i><b style="width:'+pct+'%"></b></i></div>';
      title.classList.toggle('urgent',timeLeft<=1800);
    }
    function miss(msg){if(locked||!alive)return;locked=true;stopTimer();lives--;streak=0;hint.textContent=msg+' · '+lives+' '+(lives===1?'life':'lives')+' left';Arcade.feedback('fail');ui(score,streak);if(lives<=0){alive=false;pauseAwareDelay(()=>finish(score,bestStreak,['🧠 Correct matches: '+score,'🔥 Best streak: '+bestStreak,'🎯 Round reached: '+roundNo,'Rotations, choices, and the timer get harder as you advance.'],'Shape Fit Run Over'),350);return}pauseAwareDelay(()=>{if(alive)round()},520)}
    function round(){stopTimer();locked=false;roundNo++;const currentStage=stage();if(lastStage&&currentStage!==lastStage)Arcade.feedback('perfect');lastStage=currentStage;const base=SHAPES[Math.floor(Math.random()*SHAPES.length)],targetTurns=roundNo<4?0:Math.floor(Math.random()*4);answer=variant(base,targetTurns);target.dataset.base=base.name;draw(answer);const count=roundNo<=3?3:roundNo<=7?4:roundNo<=13?6:8;wrap.classList.toggle('many-choices',count>4);const correctTurns=roundNo<4?targetTurns:(targetTurns+1+Math.floor(Math.random()*3))%4,correct=variant(base,correctTurns),opts=[correct],used=new Set([base.name+':'+key(correct.cells)]);while(opts.length<count){const sh=SHAPES[Math.floor(Math.random()*SHAPES.length)];if(sh===base)continue;const v=variant(sh,Math.floor(Math.random()*4)),k=sh.name+':'+key(v.cells);if(!used.has(k)){used.add(k);opts.push(v)}}opts.sort(()=>Math.random()-.5);answers.replaceChildren();opts.forEach(shape=>{const b=document.createElement('button');b.type='button';b.className='fit-answer';b.dataset.base=shape.base.name;b.setAttribute('aria-label','Choose shape');b.append(preview(shape,'fit-answer-preview'));const n=document.createElement('small');n.textContent=roundNo<4?shape.base.name:'ROTATED';b.append(n);b.addEventListener('click',()=>choose(shape,b));answers.append(b)});timeLeft=roundNo<=3?7000:Math.max(2800,6600-(roundNo-3)*220);header();hint.textContent=roundNo<4?'👆 Tap the shape that matches the target exactly':(count>4?'🔄 Find the same shape — rotation does not matter · '+count+' choices · swipe up for more':'🔄 Find the same shape — rotation does not matter');let lastTick=performance.now();timer=setInterval(()=>{const now=performance.now();if(miniPaused){lastTick=now;return}const elapsed=Math.max(0,now-lastTick);lastTick=now;timeLeft-=elapsed;header();if(timeLeft<=0){stopTimer();miss('⏰ Too slow')}},100)}
    function choose(shape,b){
      if(!alive||locked||miniPaused)return;
      // Lock immediately for both correct and wrong answers so a rapid
      // double-tap can never score twice or remove two lives in one round.
      locked=true;
      stopTimer();
      if(shape.base===answer.base){
        score++;streak++;bestStreak=Math.max(bestStreak,streak);
        b.classList.add('correct');wrap.classList.add('fit-success');
        pauseAwareDelay(()=>wrap.classList.remove('fit-success'),220);
        hint.textContent=streak>=5?'🔥 '+streak+' streak!':'✅ Correct!';
        Arcade.feedback(streak>=5?'perfect':'match');ui(score,streak);
        pauseAwareDelay(()=>{if(alive)round()},300);
      }else{
        b.classList.add('wrong');wrap.classList.add('fit-miss');
        pauseAwareDelay(()=>wrap.classList.remove('fit-miss'),260);
        [...answers.children].forEach(node=>{if(node.dataset.base===answer.base.name)node.classList.add('correct')});
        locked=false;
        miss('❌ Wrong shape');
      }
    }
    return{
      start(){score=0;streak=0;bestStreak=0;lives=3;roundNo=0;lastStage='';timeLeft=0;answer=null;alive=true;locked=false;wrap.classList.remove('fit-success','fit-miss','many-choices');ui(0,0);round()},
      stop(){alive=false;locked=true;stopTimer();timeLeft=0;answer=null;wrap.classList.remove('fit-success','fit-miss','many-choices')}
    };
  }

  function makeBounceRun() {
    const [c,ctx]=canvasBase();
    const bounceZone=document.createElement('div');
    bounceZone.className='bounce-tap-zone';
    bounceZone.innerHTML='<span class="bounce-jump-icon" aria-hidden="true">↑</span><span>JUMP <small>Tap anywhere</small></span>';
    surface.insertAdjacentElement('afterend',bounceZone);
    // These controls are installed before the dynamically created canvas.
    // Keep them in normal flow instead of floating over the phone jump area.
    const controls=document.createElement('div');
    controls.className='bounce-session-controls';
    bounceZone.insertAdjacentElement('afterend',controls);
    const parked=[];
    if(matchMedia('(max-width:600px)').matches){
      for(const id of ['earnlyPauseButton','earnlyQuitButton']){
        const button=document.getElementById(id);
        if(button){const marker=document.createComment('bounce control home');button.before(marker);parked.push({button,marker});controls.append(button);}
      }
    }

    let y=349,vy=0,obstacles=[],distance=0,cleared=0,alive=false,raf=null,last=0,readyUntil=0,queuedJump=false,lastClearAt=0,combo=0,bestCombo=0,levelFlashUntil=0,levelFlashText='',trail=[];

    function runLevel(){return 1+Math.floor(cleared/5)}
    function stageName(){
      const l=runLevel();
      return l<=3?'Cloud Gardens':l<=6?'Sunset Peaks':l<=9?'Moonlit Valley':'Aurora Heights';
    }

    const physics=BounceRunEngine.create();
    let accum=0,landAt=0,clearAt=0,jumpAt=0;
    const calm=()=>Arcade.reducedMotionEnabled?.()||matchMedia('(prefers-reduced-motion: reduce)').matches;

    function draw() {
      // Artwork is deterministic and bounded; the physics owns every hitbox.
      const reduced=calm(),now=performance.now(),travel=physics.state.travel,motion=reduced?0:travel;
      bounceZone.classList.toggle('bounce-jumping',!reduced&&jumpAt>0&&now-jumpAt<180);
      const themes=[
        {sky:'#2675bd',horizon:'#b5f2ed',sun:'#fff1b4',far:'#78bbcd',near:'#398caa',grass:'#80ebaf',rock:'#255675'},
        {sky:'#63509e',horizon:'#ffd4b2',sun:'#fff0c3',far:'#b597c1',near:'#786b9d',grass:'#b8e8ac',rock:'#49496f'},
        {sky:'#182f65',horizon:'#719dbb',sun:'#e1f7ff',far:'#537c9e',near:'#345e7f',grass:'#8ae8d4',rock:'#253f65'},
        {sky:'#254b78',horizon:'#a7e5cf',sun:'#f1ffcb',far:'#65a5ac',near:'#347f90',grass:'#9cf3bc',rock:'#245a71'}
      ];
      const theme=themes[Math.min(3,Math.floor((runLevel()-1)/3))];
      const fill=(color,x,yy,w,h,r=0)=>{ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,yy,w,h,r);ctx.fill();};
      const ellipse=(color,x,yy,rx,ry)=>{ctx.fillStyle=color;ctx.beginPath();ctx.ellipse(x,yy,rx,ry,0,0,Math.PI*2);ctx.fill();};
      const sky=ctx.createLinearGradient(0,0,0,360);
      sky.addColorStop(0,theme.sky);sky.addColorStop(1,theme.horizon);
      ctx.fillStyle=sky;ctx.fillRect(0,0,360,430);
      // A soft sun and slow clouds give the course depth without obscuring hazards.
      ellipse(theme.sun+'18',278,112,62,62);ellipse(theme.sun+'25',278,112,47,47);
      ellipse(theme.sun,278,112,30,30);
      for(let i=0;i<5;i++){
        const x=((i*101-motion*.18)%460+460)%460-60,cy=100+(i*47)%130;
        ellipse('#ffffff33',x,cy,42,8);ellipse('#ffffff55',x-10,cy-5,19,12);ellipse('#ffffff55',x+12,cy-3,24,10);
      }
      // Distant floating islands, then close ridges and tiny garden trees.
      for(let i=0;i<4;i++){
        const x=((i*139-motion*.3)%540+540)%540-90,yy=230+(i%2)*33;
        ctx.fillStyle=theme.far;ctx.beginPath();ctx.moveTo(x,yy);ctx.lineTo(x+72,yy);ctx.lineTo(x+48,yy+42);ctx.lineTo(x+30,yy+57);ctx.closePath();ctx.fill();
        ellipse('#c3f6d4',x+36,yy,36,7);
        fill('#527b83',x+34,yy-23,4,23,2);
        ellipse(theme.near,x+29,yy-27,11,12);ellipse(theme.near,x+42,yy-28,12,13);ellipse(theme.near,x+36,yy-38,12,13);
        ellipse('#b0efd44d',x+33,yy-41,6,5);
        fill('#ffffff38',x+36,yy+16,3,15,1);
        // Waterfalls and hanging leaves stay behind the playable track.
        fill('#d4fff34d',x+50,yy+5,5,35,2);
        fill('#efffff88',x+51,yy+8+(motion*.25)%10,1,16,1);
        ctx.strokeStyle='#d2f7ed55';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+17,yy+10);ctx.lineTo(x+30,yy+25);ctx.lineTo(x+26,yy+37);ctx.stroke();
        for(let j=0;j<3;j++){fill('#7fcdb3',x+12+j*17,yy-5,2,6,1);ellipse(j%2?'#ffe4aa':'#ffe2de',x+13+j*17,yy-6,3,2);}

      }
      ctx.fillStyle=theme.near;ctx.beginPath();ctx.moveTo(0,340);
      for(let i=-1;i<5;i++){const x=i*140-(motion*.65)%140;ctx.quadraticCurveTo(x+45,268,x+140,328);}
      ctx.lineTo(360,370);ctx.lineTo(0,370);ctx.closePath();ctx.fill();
      // Small garden details form a quiet middle layer, clear of the jump arc.
      for(let i=0;i<6;i++){
        const x=((i*83-motion*.85)%470+470)%470-50,base=337+(i%2)*5;
        ctx.strokeStyle='#245e70';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,base);ctx.quadraticCurveTo(x-3,base-9,x+2,base-18);ctx.stroke();
        ellipse('#9ee4c1',x-4,base-8,5,2);ellipse('#9ee4c1',x+5,base-12,5,2);
        ellipse(i%2?'#ffe0a2':'#ffc7c4',x+2,base-19,4,3);
      }
      for(let i=0;i<3;i++){
        const x=((i*137-motion*.4)%440+440)%440-40,yy=153+i*37+(reduced?0:Math.sin(motion*.035+i)*6);
        const wing=reduced?4:2+Math.abs(Math.sin(motion*.15+i))*3;
        ellipse('#ffe4a7bb',x-3,yy,3,wing);ellipse('#fff0c7cc',x+3,yy,3,wing);
        fill('#547d82',x-.5,yy-2,1,5,1);
      }
      // A real illustrated track: turf edge, soil strata, stone inlays and vines.
      fill(theme.rock,0,356,360,74);
      fill('#153d5a',0,377,360,53);
      fill(theme.grass,0,354,360,6);fill('#dcffe2',0,354,360,2);
      const scroll=motion%48;
      for(let x=-scroll-48;x<408;x+=48){
        fill('#8bcaaf',x+4,361,31,6,3);fill('#e4b59044',x+11,374,21,5,2);
        fill('#97b0b533',x+2,393,14,7,3);fill('#6b93a044',x+27,411,24,5,2);
        ctx.strokeStyle='#60bba3';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+40,360);ctx.quadraticCurveTo(x+36,374,x+43,387);ctx.stroke();
        ellipse('#88d5b3',x+39,374,4,2);ellipse('#88d5b3',x+43,383,4,2);
      }
      // Turf markers move at the same speed as incoming hazards. The ball
      // remains near the left edge while the course travels underneath it.
      for(let x=-(motion%24);x<384;x+=24){
        fill('#efffcb',x,354,7,2,1);
        fill('#438c78',x+12,358,4,2,1);
      }
      // Glass course card and five clear pips, readable over every sky palette.
      fill('#123452dc',14,14,182,60,16);fill('#9ee6d833',24,26,3,34,2);
      ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='900 15px system-ui';ctx.fillText(stageName(),35,36);
      ctx.fillStyle='#bce2ef';ctx.font='800 9px system-ui';ctx.fillText('LEVEL '+runLevel()+'  ·  NEXT IN '+(5-cleared%5)+' CLEARS',35,51);
      for(let i=0;i<5;i++)fill(i<cleared%5?'#9bffcd':'#ffffff30',35+i*28,60,22,4,2);
      // Red crystal hazards share the exact existing obstacle footprint.
      obstacles.forEach(o=>{
        ellipse('#102a4e44',o.x+o.w/2,358,o.w/2+4,3);
        const grd=ctx.createLinearGradient(o.x,320,o.x+o.w,356);
        grd.addColorStop(0,'#ffb184');grd.addColorStop(.45,'#ff6678');grd.addColorStop(1,'#a93569');
        ctx.fillStyle=grd;ctx.beginPath();ctx.roundRect(o.x,330,o.w,26,4);ctx.fill();
        ctx.strokeStyle='#ffb59f';ctx.lineWidth=1;ctx.stroke();
        for(let sx=o.x;sx<o.x+o.w;sx+=10){
          const right=Math.min(sx+10,o.x+o.w),mid=(sx+right)/2;
          ctx.fillStyle='#ff8d91';ctx.beginPath();ctx.moveTo(sx,331);ctx.lineTo(mid,320);ctx.lineTo(right,331);ctx.fill();
          ctx.fillStyle='#ffdab7';ctx.beginPath();ctx.moveTo(sx,331);ctx.lineTo(mid,320);ctx.lineTo(mid,331);ctx.fill();
        }
        fill('#ffceb088',o.x+3,335,Math.max(2,o.w-6),3,1);
        ctx.strokeStyle='#812b5999';ctx.beginPath();ctx.moveTo(o.x+o.w*.55,340);ctx.lineTo(o.x+o.w*.35,348);ctx.lineTo(o.x+o.w*.7,354);ctx.stroke();
      });
      trail.forEach((p,index)=>{
        const alpha=(index+1)/(trail.length+1)*.3;
        const px=p.x-(travel-p.travel);
        ellipse('rgba(210,255,242,'+alpha+')',px,p.y,3+index*.4,3+index*.4);
      });
      const height=349-y,landingAge=now-landAt;
      if(!reduced&&height<2&&physics.state.alive&&physics.state.ticks>0){
        // A fixed number of short dust puffs makes ground contact readable.
        for(let i=0;i<4;i++){
          const age=((travel+i*11)%44)/44;
          ctx.globalAlpha=(1-age)*.45;
          ellipse('#e8ffdb',68-age*35,354-Math.sin(age*Math.PI)*5,1+age*3,1+age);
        }
        ctx.globalAlpha=1;
      }
      ellipse('#112c4e55',80,355,Math.max(6,14-height*.045),3);
      if(jumpAt&&now-jumpAt<260&&!reduced){
        const age=(now-jumpAt)/260;
        ctx.globalAlpha=1-age;ctx.strokeStyle='#fff0bb';ctx.lineWidth=2;
        ctx.beginPath();ctx.ellipse(80,355,10+age*20,2+age*3,0,0,Math.PI*2);ctx.stroke();ctx.globalAlpha=1;
      }
      if(landAt&&landingAge<320&&!reduced){
        const age=landingAge/320;
        ctx.globalAlpha=1-age;
        for(let i=0;i<6;i++){const side=i<3?-1:1,k=i%3;ellipse('#e3ffe0',80+side*(9+age*(18+k*9)),354-Math.sin(age*Math.PI)*(3+k*3),3-age*2,2-age);}
        ctx.globalAlpha=1;
      }
      // Bold rotating panels show a rolling sphere; the face stays readable.
      ctx.save();ctx.translate(80,y-6);
      const squash=!reduced&&landAt&&landingAge<150?Math.sin(landingAge/150*Math.PI)*.18:0;
      const stretch=!reduced&&vy<0?Math.min(.11,-vy*.012):0;
      ctx.scale(1+squash-stretch*.5,1-squash+stretch);
      const ball=ctx.createRadialGradient(-4,-5,1,0,0,12);
      ball.addColorStop(0,'#fffce9');ball.addColorStop(.55,'#ffdf76');ball.addColorStop(1,'#ed9c44');
      ctx.beginPath();ctx.fillStyle=ball;ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#fff3bf';ctx.lineWidth=1;ctx.stroke();
      ctx.save();ctx.rotate(reduced?0:travel/11);
      for(let i=0;i<3;i++){
        const angle=i*Math.PI*2/3;
        ctx.fillStyle='#c67b32';ctx.beginPath();ctx.arc(Math.cos(angle)*7,Math.sin(angle)*7,2.3,0,Math.PI*2);ctx.fill();
      }
      ctx.strokeStyle='#b97739aa';ctx.lineWidth=1.5;ctx.beginPath();ctx.ellipse(0,0,5,10,0,0,Math.PI*2);ctx.stroke();ctx.restore();
      const blink=!reduced&&Math.floor(now%4100)>3940;
      ellipse('#33344f',2,-2,1.5,blink?.5:2.3);ellipse('#33344f',7,-2,1.5,blink?.5:2.3);ellipse('#ff957d',0,2,2,1);
      if(!physics.state.alive){
        ctx.strokeStyle='#68473b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(4,5,2,Math.PI,Math.PI*2);ctx.stroke();
      }else if(vy<-2){ellipse('#68473b',4,3,1.7,2);}
      else{ctx.strokeStyle='#68473b';ctx.lineWidth=1;ctx.beginPath();ctx.arc(4,1,2,0,Math.PI);ctx.stroke();}
      ctx.restore();
      ctx.textAlign='center';
      if(clearAt&&now-clearAt<650){
        const age=(now-clearAt)/650;ctx.globalAlpha=1-age;
        fill('#113e56e6',32,278-(reduced?0:age*15),96,24,12);
        ctx.fillStyle='#baffd5';ctx.font='900 11px system-ui';ctx.fillText(combo>=3?'ON A ROLL!':'NICE!',80,294-(reduced?0:age*15));
        if(!reduced)for(let i=0;i<7;i++){
          const angle=i*Math.PI*2/7,radius=12+age*27;
          fill(i%2?'#ffde8c':'#baffd5',80+Math.cos(angle)*radius,310+Math.sin(angle)*radius,3,3,1);
        }
        ctx.globalAlpha=1;
      }

      if(combo>=2){
        ctx.fillStyle='#fef3c7';
        ctx.font='900 12px Arial';
        ctx.fillText(combo+' CLEAR STREAK',180,100);
      }

      if(performance.now()<levelFlashUntil){
        ctx.fillStyle='rgba(15,23,42,.82)';
        ctx.beginPath();
        ctx.roundRect(76,122,208,52,14);
        ctx.fill();
        ctx.strokeStyle='#60a5fa';
        ctx.stroke();
        ctx.fillStyle='#dbeafe';
        ctx.font='900 16px Arial';
        ctx.fillText(levelFlashText,180,144);
        ctx.fillStyle='#93c5fd';
        ctx.font='800 10px Arial';
        ctx.fillText('NEW STRETCH · KEEP ROLLING',180,162);
      }

      if(performance.now()<readyUntil){
        ctx.fillStyle='rgba(15,23,42,.94)';
        ctx.beginPath();
        ctx.roundRect(34,166,292,78,14);
        ctx.fill();
        ctx.strokeStyle='#3b82f6';
        ctx.lineWidth=2;
        ctx.stroke();

        ctx.fillStyle='#bfdbfe';
        ctx.font='900 15px Arial';
        ctx.fillText('READY TO JUMP?',180,192);
        ctx.fillStyle='#94a3b8';
        ctx.font='700 10px Arial';
        ctx.fillText('Tap anywhere on the game to jump',180,213);
        ctx.fillText('Close pairs take one jump · 5 clears = level up',180,229);

        const countdown=Math.max(1,Math.ceil((readyUntil-performance.now())/650));
        ctx.fillStyle='#ffffff';
        ctx.font='900 24px Arial';
        ctx.fillText(String(countdown),180,154);
      }
    }

    function loop(t) {
      if(!alive)return;
      if(miniPaused){last=t;raf=requestAnimationFrame(loop);return;}
      const elapsed=last?Math.min(100,t-last):0;
      last=t;
      const warming=t<readyUntil;
      if(!warming&&queuedJump){queuedJump=false;jump();}
      if(!warming){
        accum+=elapsed;
        while(accum>=BounceRunEngine.STEP&&physics.state.alive){
          const before=physics.state.cleared,jumps=physics.state.jumps,lands=physics.state.lands;
          physics.step();accum-=BounceRunEngine.STEP;
          if(physics.state.jumps>jumps){jumpAt=t;Arcade.feedback('hop');}
          if(physics.state.lands>lands)landAt=t;
          if(physics.state.cleared>before){
            const now=performance.now();clearAt=now;
            combo=lastClearAt&&now-lastClearAt<4000?combo+1:1;
            bestCombo=Math.max(bestCombo,combo);lastClearAt=now;
            const leveledUp=Math.floor(physics.state.cleared/5)>Math.floor(before/5);
            Arcade.feedback(leveledUp?'perfect':'score');
            if(leveledUp){levelFlashText='LEVEL '+(1+Math.floor(physics.state.cleared/5));levelFlashUntil=now+1250;}
          }
        }
      }
      ({y,vy,obstacles,distance,cleared}=physics.state);
      if(!physics.state.alive){
        alive=false;draw();
        finish(Math.floor(distance),cleared,
          ['⚪ Obstacles cleared: '+cleared,'🏁 Level reached: '+runLevel(),'🔥 Best clear combo: '+bestCombo,'⚡ Stage: '+stageName(),'Tap once to clear a single obstacle or a close pair.'],
          'Bounce Run Over');
        return;
      }
      if(combo>0&&lastClearAt&&t-lastClearAt>=4000)combo=0;
      if(!warming&&!calm()&&y<347){trail.push({x:80,y:y-6,travel:physics.state.travel});if(trail.length>7)trail.shift();}else trail=[];

      ui(Math.floor(distance),cleared);
      draw();
      raf=requestAnimationFrame(loop);
    }

    function jump(e){
      if(!alive||miniPaused)return;
      if(e && e.preventDefault)e.preventDefault();
      if(performance.now()<readyUntil){
        queuedJump=true;
        return;
      }
      if(physics.jump()){jumpAt=performance.now();Arcade.feedback('hop');}
    }

    const onPointer=e=>{
      if(!alive||e.isPrimary===false||(e.pointerType==='mouse'&&e.button!==0))return;
      const rect=c.getBoundingClientRect();
      if(e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom)return;
      jump(e);
    };
    const blockGesture=e=>{
      if(alive)e.preventDefault();
    };
    const onKey=e=>{
      if(alive&&!e.repeat&&(e.code==='Space'||e.code==='Enter'||e.key==='ArrowUp'))jump(e);
    };
    c.style.touchAction='none';
    c.style.userSelect='none';
    c.style.webkitUserSelect='none';
    c.style.webkitTouchCallout='none';
    const onWideJump=e=>{
      if(!alive)return;
      if(e.target===c || bounceZone.contains(e.target))return;
      const nav=e.target.closest&&e.target.closest('.bottom-nav,.game-pause-control,button,a,input,select,textarea');
      if(nav)return;
      const rect=c.getBoundingClientRect();
      if(e.clientY<rect.top)return;
      jump(e);
    };
    c.addEventListener('pointerdown',onPointer,{passive:false});
    bounceZone.addEventListener('pointerdown',jump,{passive:false});
    document.addEventListener('pointerdown',onWideJump,{passive:false});
    c.addEventListener('touchstart',blockGesture,{passive:false});
    c.addEventListener('gesturestart',blockGesture,{passive:false});
    document.addEventListener('keydown',onKey);

    return {
      start(){
        y=349;vy=0;obstacles=[];distance=0;cleared=0;lastClearAt=0;combo=0;bestCombo=0;levelFlashUntil=0;levelFlashText='';trail=[];queuedJump=false;last=0;alive=true;accum=0;landAt=0;clearAt=0;
        jumpAt=0;
        readyUntil=performance.now()+1900;
        ui(0,0);
        draw();
        raf=requestAnimationFrame(loop);
      },
      adjustPauseTime(ms){
        const pausedFor=Math.max(0,Number(ms)||0);
        if(readyUntil) readyUntil+=pausedFor;
        if(levelFlashUntil) levelFlashUntil+=pausedFor;
        if(lastClearAt) lastClearAt+=pausedFor;
        last=0;accum=0;
        if(landAt)landAt+=pausedFor;if(clearAt)clearAt+=pausedFor;if(jumpAt)jumpAt+=pausedFor;
      },
      stop(){
        alive=false;
        physics.state.alive=false;
        queuedJump=false;
        vy=0;
        obstacles=[];
        trail=[];
        readyUntil=0;
        levelFlashUntil=0;
        cancelAnimationFrame(raf);
        raf=null;
        c.removeEventListener('pointerdown',onPointer);
        bounceZone.removeEventListener('pointerdown',jump);
        bounceZone.remove();
        for(const {button,marker} of parked){marker.replaceWith(button);}
        controls.remove();
        document.removeEventListener('pointerdown',onWideJump);
        c.removeEventListener('touchstart',blockGesture);
        c.removeEventListener('gesturestart',blockGesture);
        document.removeEventListener('keydown',onKey);
      }
    };
  }

  // Traffic Escape boards are generated fresh each road. Candidates are
  // accepted only when a solver proves every car can eventually leave.
  // This prevents memorizing a tiny set of authored layouts while preserving
  // the core clear-path rule.
  const TRAFFIC_GRID_SIZE = 6;


  // Traffic Escape uses the app's normal feedback sounds only.
  // The synthesized engine/crash effects were too loud on phones.
  function trafficSound(){ /* intentionally quiet */ }

  function makeTrafficEscape() {
    let cars=[],cleared=0,level=1,alive=false,locked=false,strikes=0,boardInLevel=1,timeLeft=0,timerId=null,boardStartedAt=0,fastClears=0,bestRoadTime=null;

    const wrap=document.createElement('div');
    wrap.className='traffic-wrap';

    const guide=document.createElement('div');
    guide.className='traffic-guide';
    guide.innerHTML='<strong>🚦 Clear the road</strong><span>Tap only cars with a clear arrow path. 💥 3 crashes ends the run.</span>';

    const levelLine=document.createElement('div');
    levelLine.className='traffic-level-line';
    levelLine.setAttribute('aria-live','polite');

    const grid=document.createElement('div');
    grid.className='traffic-grid';

    wrap.append(guide,levelLine,grid);
    surface.replaceChildren(wrap);

    const cell=55;
    // One solved road advances the level. The previous 2–7 roads per level
    // allowed skilled players to clear 200+ cars before seeing the full curve.
    const boardsNeeded=()=>1;
    const roundSeconds=()=>[0,16,14,12,10,9,8,7][Math.min(7,level)];

    function stopTimer(){
      if(timerId){clearInterval(timerId);timerId=null;}
    }

    function timerText(){
      return '⏱️ '+timeLeft+'s';
    }

    function startTimer(){
      stopTimer();
      timeLeft=roundSeconds();
      boardStartedAt=performance.now();
      let lastTickAt=boardStartedAt;
      render();
      timerId=setInterval(()=>{
        if(!alive||miniPaused){lastTickAt=performance.now();return;}
        const now=performance.now();
        const elapsed=Math.max(0,now-lastTickAt);
        if(elapsed<900)return;
        const ticks=Math.max(1,Math.floor(elapsed/1000));
        lastTickAt+=ticks*1000;
        timeLeft-=ticks;
        if(timeLeft<=0){
          stopTimer();
          alive=false;
          locked=true;
          levelLine.textContent='⏰ Time up! Run over';
          Arcade.feedback('fail');
          pauseAwareDelay(()=>finish(
            cleared,
            level,
            ['🚗 Cars cleared: '+cleared,'🚦 Level reached: '+level,'⏰ Time expired','Clear each road before the timer hits zero.'],
            cleared>=70?'Traffic Pro':'',
            '⏰ TIME EXPIRED'
          ),260);
          return;
        }
        renderLevelLine();
      },1000);
    }

    function trafficCells(car){
      const out=[];
      for(let n=0;n<car.len;n++)out.push([
        car.x+(car.h?n:0),
        car.y+(car.h?0:n)
      ]);
      return out;
    }

    function trafficOverlap(a,b){
      const occupied=new Set(trafficCells(a).map(([x,y])=>x+','+y));
      return trafficCells(b).some(([x,y])=>occupied.has(x+','+y));
    }

    function trafficCanExitFrom(list,car){
      const blocked=(x,y)=>list.some(other=>
        other!==car&&trafficCells(other).some(([ox,oy])=>ox===x&&oy===y)
      );
      if(car.h){
        if(car.dir>0){
          for(let x=car.x+car.len;x<TRAFFIC_GRID_SIZE;x++)if(blocked(x,car.y))return false;
        }else{
          for(let x=car.x-1;x>=0;x--)if(blocked(x,car.y))return false;
        }
      }else if(car.dir>0){
        for(let y=car.y+car.len;y<TRAFFIC_GRID_SIZE;y++)if(blocked(car.x,y))return false;
      }else{
        for(let y=car.y-1;y>=0;y--)if(blocked(car.x,y))return false;
      }
      return true;
    }

    function trafficSolvable(list){
      const memo=new Map();
      function solve(remaining){
        if(!remaining.length)return true;
        const key=remaining.map(c=>c.seedId).sort((a,b)=>a-b).join(',');
        if(memo.has(key))return memo.get(key);
        const exits=remaining.filter(car=>trafficCanExitFrom(remaining,car));
        for(const car of exits){
          if(solve(remaining.filter(other=>other!==car))){
            memo.set(key,true);
            return true;
          }
        }
        memo.set(key,false);
        return false;
      }
      return solve(list);
    }

    function trafficSignature(list){
      return list.map(c=>[c.x,c.y,c.len,c.h?1:0,c.dir].join(':')).sort().join('|');
    }

    let recentTrafficSignatures=[];

    function randomTrafficBoard(){
      const targetCars=[0,6,7,8,9,9,10,10][Math.min(7,level)];
      const minBlocked=Math.min(targetCars-1,[0,4,5,6,7,7,8,8][Math.min(7,level)]);
      const maxInitiallyFree=2;

      for(let attempt=0;attempt<400;attempt++){
        const candidate=[];
        for(let id=0;id<targetCars;id++){
          let placed=false;
          for(let tries=0;tries<100&&!placed;tries++){
            const h=Math.random()<.5;
            const len=Math.random()<(level>=4?.46:level>=2?.30:.18)?3:2;
            const x=Math.floor(Math.random()*(TRAFFIC_GRID_SIZE-(h?len:1)+1));
            const y=Math.floor(Math.random()*(TRAFFIC_GRID_SIZE-(h?1:len)+1));
            const car={x,y,len,h,dir:Math.random()<.5?-1:1,seedId:id};
            if(candidate.every(other=>!trafficOverlap(car,other))){
              candidate.push(car);
              placed=true;
            }
          }
          if(!placed)break;
        }
        if(candidate.length!==targetCars)continue;

        const initiallyBlocked=candidate.filter(car=>!trafficCanExitFrom(candidate,car)).length;
        const initiallyFree=targetCars-initiallyBlocked;
        if(initiallyBlocked<minBlocked||initiallyFree<1||initiallyFree>maxInitiallyFree)continue;
        if(!trafficSolvable(candidate))continue;

        const sig=trafficSignature(candidate);
        if(recentTrafficSignatures.includes(sig))continue;
        recentTrafficSignatures.push(sig);
        if(recentTrafficSignatures.length>12)recentTrafficSignatures.shift();
        return candidate.map(({seedId,...car})=>car);
      }

      // Extremely unlikely fallback. Early levels keep a simpler road, while
      // later levels fall back to a dense, solver-verified 10-car board so
      // generator exhaustion never becomes an accidental easy round.
      const fallback=level>=4?[
        {x:3,y:3,len:3,h:false,dir:-1},
        {x:4,y:5,len:2,h:true,dir:-1},
        {x:0,y:1,len:2,h:false,dir:1},
        {x:0,y:4,len:2,h:true,dir:1},
        {x:2,y:2,len:2,h:true,dir:1},
        {x:5,y:0,len:3,h:false,dir:-1},
        {x:5,y:3,len:2,h:false,dir:-1},
        {x:1,y:0,len:3,h:true,dir:1},
        {x:4,y:3,len:2,h:false,dir:1},
        {x:0,y:3,len:3,h:true,dir:1}
      ]:[
        {x:0,y:0,len:2,h:true,dir:-1},
        {x:3,y:0,len:2,h:false,dir:-1},
        {x:1,y:2,len:2,h:true,dir:1},
        {x:4,y:2,len:2,h:false,dir:1},
        {x:0,y:5,len:2,h:true,dir:-1}
      ];
      return fallback.map(car=>({...car}));
    }

    function levelSource(){
      return randomTrafficBoard();
    }

    function loadLevel() {
      locked=false;
      const source=levelSource();
      cars=source.map((car,i)=>({...car,id:i}));
      render();
      startTimer();
    }

    function occupiedByOther(car,x,y) {
      return cars.some(other=>{
        if(other===car)return false;
        for(let n=0;n<other.len;n++){
          const ox=other.x+(other.h?n:0);
          const oy=other.y+(other.h?0:n);
          if(ox===x&&oy===y)return true;
        }
        return false;
      });
    }

    function canExit(car) {
      if(car.h){
        if(car.dir>0){
          const edge=car.x+car.len;
          for(let x=edge;x<6;x++)if(occupiedByOther(car,x,car.y))return false;
        }else{
          for(let x=car.x-1;x>=0;x--)if(occupiedByOther(car,x,car.y))return false;
        }
      }else{
        if(car.dir>0){
          const edge=car.y+car.len;
          for(let y=edge;y<6;y++)if(occupiedByOther(car,car.x,y))return false;
        }else{
          for(let y=car.y-1;y>=0;y--)if(occupiedByOther(car,car.x,y))return false;
        }
      }
      return true;
    }

    function exitTransform(car) {
      if(car.h)return 'translateX('+(car.dir>0?'380px':'-380px')+')';
      return 'translateY('+(car.dir>0?'380px':'-380px')+')';
    }

    function tapCar(car,button) {
      if(!alive||locked||miniPaused)return;

      if(!canExit(car)){
        strikes++;
        button.classList.remove('blocked');
        void button.offsetWidth;
        button.classList.add('blocked');
        Arcade.feedback('fail');
        trafficSound('crash');

        if(strikes>=3){
          alive=false;
          locked=true;
          stopTimer();
          levelLine.textContent='💥 Crash! 3 mistakes — run over';
          pauseAwareDelay(()=>finish(
            cleared,
            level,
            ['🚗 Cars cleared: '+cleared,'🚦 Level reached: '+level,'💥 Crashes: 3/3','Reach a clear arrow path before tapping.'],
            cleared>=70?'Traffic Pro':'',
            '💥 3 CRASHES — RUN OVER'
          ),260);
          return;
        }

        levelLine.textContent='💥 Blocked lane! '+strikes+'/3 mistakes · '+(3-strikes)+' left';
        button.setAttribute('aria-label',(button.getAttribute('aria-label')||'Car')+' · blocked');
        pauseAwareDelay(()=>{if(alive&&!locked)renderLevelLine()},650);
        return;
      }

      locked=true;
      levelLine.textContent='✅ Clear path!';
      button.classList.add('escaping');
      button.style.transform=exitTransform(car);
      Arcade.feedback('score');
      trafficSound('exit');

      pauseAwareDelay(()=>{
        cleared++;
        cars=cars.filter(item=>item!==car);
        ui(cleared,level);

        if(!cars.length){
          const roadTime=Math.max(0,(performance.now()-boardStartedAt)/1000);
          bestRoadTime=bestRoadTime===null?roadTime:Math.min(bestRoadTime,roadTime);
          const quick=roadTime<=Math.max(6,roundSeconds()*.58);
          if(quick)fastClears++;
          const needed=boardsNeeded();
          if(boardInLevel<needed){
            stopTimer();
            locked=true;
            const clearedRoad=boardInLevel;
            boardInLevel++;
            grid.replaceChildren();
            levelLine.textContent=(quick?'⚡ Fast clear · '+roadTime.toFixed(1)+'s! · ':'🎉 ')+ 'Road '+clearedRoad+'/'+needed+' cleared · '+(needed-clearedRoad)+' more to Level '+level;
            Arcade.feedback(quick?'perfect':'score');
            // Keep the board empty during the celebration. The next board and
            // its timer begin together, so transition time never costs play time.
            pauseAwareDelay(()=>{if(alive)loadLevel()},700);
            return;
          }

          stopTimer();
          Arcade.feedback('perfect');
          level++;
          boardInLevel=1;

          if(level>7){
            alive=false;
            stopTimer();
            finish(
              cleared,
              level-1,
              ['🚦 Levels cleared: '+(level-1),'🚗 Cars cleared: '+cleared,'⚡ Fast roads: '+fastClears,'🏁 Best road: '+(bestRoadTime===null?'—':bestRoadTime.toFixed(1)+'s'),'You cleared every traffic board!'],
              'Traffic Master'
            );
            return;
          }

          locked=true;
          grid.replaceChildren();
          levelLine.textContent=(quick?'⚡ '+roadTime.toFixed(1)+'s road · ':'🎉 ')+'Level '+(level-1)+' cleared · Level '+level+' next';
          // Reveal the next road only after the level celebration finishes.
          // loadLevel starts the fresh timer at the same moment.
          pauseAwareDelay(()=>{if(alive)loadLevel()},850);
          return;
        }

        locked=false;
        render();
      },210);
    }

    function renderLevelLine(){
      const needed=boardsNeeded();
      const road=needed>1?' · Road '+boardInLevel+'/'+needed:'';
      levelLine.textContent='Level '+level+road+' · '+cars.length+' car'+(cars.length===1?'':'s')+' left · '+timerText()+' · 💥 '+strikes+'/3';
      levelLine.classList.toggle('urgent',timeLeft>0&&timeLeft<=5);
    }

    function render() {
      renderLevelLine();
      grid.replaceChildren();

      cars.forEach((car,idx)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='traffic-car';
        b.style.left=(car.x*cell+3)+'px';
        b.style.top=(car.y*cell+3)+'px';
        b.style.width=((car.h?car.len:1)*cell-6)+'px';
        b.style.height=((car.h?1:car.len)*cell-6)+'px';
        b.style.background=['#2563eb','#16a34a','#dc2626','#9333ea','#d97706','#0891b2'][idx%6];

        const arrow=car.h ? (car.dir>0?'→':'←') : (car.dir>0?'↓':'↑');
        b.innerHTML='<span class="traffic-emoji">🚗</span><span class="traffic-arrow">'+arrow+'</span>';
        const directionName=({'→':'right','←':'left','↑':'up','↓':'down'}[arrow]||arrow);
        b.setAttribute('aria-label','Car pointing '+directionName);
        b.addEventListener('click',()=>tapCar(car,b));
        grid.append(b);
      });
    }

    return {
      start(){cleared=0;level=1;boardInLevel=1;strikes=0;boardStartedAt=0;fastClears=0;bestRoadTime=null;alive=true;locked=false;ui(0,1);loadLevel()},
      stop(){
        alive=false;
        locked=true;
        stopTimer();
        timeLeft=0;
        boardStartedAt=0;
        cars=[];
        grid.replaceChildren();
        levelLine.classList.remove('urgent');
      },
      adjustPauseTime(ms){if(boardStartedAt)boardStartedAt+=Math.max(0,Number(ms)||0)}
    };
  }

  const factories = {
    mergeRush:makeMergeRush,
    perfectDrop:makePerfectDrop,
    spiralDrop:makeSpiralDrop,
    shapeFit:makeShapeFit,
    bounceRun:makeBounceRun,
    trafficEscape:makeTrafficEscape
  };

  function startGame() {
    if(running||starting||resultShowing)return;
    starting=true;

    if(!Arcade.consume(key)){
      starting=false;
      Arcade.out(key,refreshChrome);
      return;
    }

    if(engine&&engine.stop){
      try { engine.stop(); } catch (err) { console.error('Earnly previous-run cleanup failed', err); }
    }
    engine=null;
    finished=false;
    resultShowing=false;
    running=false;
    ui(0,key==='mergeRush'?2:1);
    refreshChrome();
    setStatus('Get Ready');
    startButton.disabled=true;
    startButton.textContent='Get Ready…';

    Arcade.countdown(()=>{
      starting=false;
      runStartedAt=performance.now();
      totalPausedMs=0;
      pauseStartedAt=0;
      miniPaused=false;
      running=true;
      setStatus('Running','running');
      // Active-game layouts remove/reflow pre-game chrome. Always anchor the
      // player back at the gameplay HUD instead of letting iPhone Safari keep
      // the old scroll offset and appear to jump down the page.
      if(key!=='trafficEscape'){
        requestAnimationFrame(()=>window.scrollTo({top:0,left:0,behavior:'auto'}));
      }
      startButton.textContent='Game Running';
      engine=(factories[key]||makeMergeRush)();
      engine.start();
    });
  }

  Arcade.installPauseControl({
    isRunning:()=>running,
    pause:()=>{
      miniPaused=true;
      pauseStartedAt=performance.now();
    },
    resume:()=>{
      if(pauseStartedAt){
        const pausedFor=performance.now()-pauseStartedAt;
        totalPausedMs+=pausedFor;
        // Timed mini games use performance.now() for per-round stats.
        // Shift that clock forward too so pausing never makes a road/round
        // look slower than it actually was.
        if(engine && typeof engine.adjustPauseTime==='function'){
          engine.adjustPauseTime(pausedFor);
        }
      }
      pauseStartedAt=0;
      miniPaused=false;
    }
  });

  startButton.addEventListener('click',startGame);
  surface.addEventListener('pointerdown',e=>{
    // One physical primary tap should be the only thing that can launch a run.
    // This avoids multi-touch or a secondary mouse button consuming a play.
    if(e.isPrimary===false || (e.pointerType==='mouse' && e.button!==0))return;
    if(!running&&!starting&&!resultShowing){
      // The start tap must not reach the jump listener installed by startGame.
      if(key==='bounceRun')e.stopPropagation();
      startGame();
    }
  },{capture:true});

  document.addEventListener('keydown',e=>{
    if((e.key==='Enter'||e.code==='Space')&&!running&&!starting&&!resultShowing){
      e.preventDefault();
      startGame();
    }
  });

  showIdle();
  ui(0,key==='mergeRush'?2:1);
  refreshChrome();
})();

