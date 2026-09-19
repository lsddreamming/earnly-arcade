(() => {
  const params = new URLSearchParams(location.search);
  const key = params.get('game') || 'blockGrid';

  const configs = {
    blockGrid:{icon:'🧩',name:'Block Grid',scoreLabel:'Score',secondaryLabel:'Lines',help:'Place pieces on the 8×8 board. Full rows and columns disappear.',reward:v=>Math.min(25,Math.floor(v/40)+(v>=250?3:0)+(v>=500?5:0))},
    mergeRush:{icon:'🔢',name:'Merge Rush',scoreLabel:'Score',secondaryLabel:'High Tile',help:'🪙 Run Reward is paid when the game ends.',reward:v=>Math.min(25,(v>=50?Math.max(1,Math.floor(v/100)):0)+(v>=500?2:0)+(v>=1000?3:0)+(v>=2500?5:0))},
    perfectDrop:{icon:'🎯',name:'Perfect Drop',scoreLabel:'Hits',secondaryLabel:'Level',help:'🎯 Tap to drop. Land inside green. Reach Level 5 at 20 hits. Three misses ends the run. 🪙 Run Reward is paid when the game ends.',reward:v=>Math.min(25,(v>=1?Math.ceil(v/3):0)+(v>=5?1:0)+(v>=10?2:0)+(v>=15?3:0)+(v>=20?5:0))},
    spiralDrop:{icon:'🌀',name:'Spiral Drop',scoreLabel:'Rings',secondaryLabel:'Level',help:'Move left or right so the ball falls through each opening.',reward:v=>Math.min(25,Math.floor(v/4)+(v>=10?1:0)+(v>=20?2:0)+(v>=35?3:0)+(v>=50?4:0)+(v>=70?5:0))},
    shapeFit:{icon:'🧠',name:'Shape Fit',scoreLabel:'Correct',secondaryLabel:'Streak',help:'The target can rotate. Find the same shape in a different direction before time runs out. Three mistakes ends the run.',reward:v=>Math.min(25,Math.floor(v/3)+(v>=15?3:0)+(v>=30?5:0)+(v>=50?5:0))},
    bounceRun:{icon:'⚪',name:'Bounce Run',scoreLabel:'Distance',secondaryLabel:'Cleared',help:'Tap anywhere to jump. Time each jump to clear the red obstacles.',reward:v=>Math.min(25,Math.floor(v/80)+(v>=500?2:0)+(v>=900?3:0)+(v>=1400?4:0)+(v>=1900?5:0))},
    trafficEscape:{icon:'🚦',name:'Traffic Escape',scoreLabel:'Cars',secondaryLabel:'Level',help:'Tap a car only when its arrow path is clear. Later levels take multiple boards and tighter traffic to clear.',reward:v=>Math.min(25,Math.floor(v/6)+(v>=20?1:0)+(v>=40?2:0)+(v>=70?3:0)+(v>=100?3:0))}
  };

  const config = configs[key] || configs.blockGrid;
  const surface = document.getElementById('surface');
  const scoreEl = document.getElementById('score');
  const secondaryEl = document.getElementById('secondary');
  const rewardEl = document.getElementById('rewardPreview');
  const playsEl = document.getElementById('plays');
  const balanceEl = document.getElementById('balance');
  const statusEl = document.getElementById('gameStatus');
  const startButton = document.getElementById('startButton');
  const helpEl = document.getElementById('miniHelp');

  document.title = 'Earnly ' + config.name;
  document.getElementById('gameIcon').textContent = config.icon;
  document.getElementById('gameTitle').textContent = config.name;
  surface.setAttribute('aria-label', config.name + ' play area');
  document.getElementById('scoreLabel').textContent = config.scoreLabel;
  document.getElementById('secondaryLabel').textContent = config.secondaryLabel;
  helpEl.textContent = config.help;
  document.body.classList.toggle('mini-traffic', key === 'trafficEscape');

  let running = false;
  let starting = false;
  let finished = false;
  let engine = null;

  function setStatus(text, mode) {
    statusEl.textContent = text;
    statusEl.className = 'game-status' + (mode ? ' ' + mode : '');
  }

  function ui(score = 0, secondary = 0) {
    score = Math.max(0, Math.floor(Number(score) || 0));
    scoreEl.textContent = String(score);
    secondaryEl.textContent = String(secondary);
    rewardEl.textContent = String(config.reward(score));
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
    surface.append(box);
  }

  function finish(metric, secondary, extra = [], title) {
    if (finished) return;
    finished = true;
    running = false;
    if (engine && engine.stop) engine.stop();

    const clean = Math.max(0, Math.floor(Number(metric) || 0));
    const coins = config.reward(clean);
    Arcade.earn(coins, config.name, { kind:'game', game:key, metric:clean });
    const result = Arcade.recordResult(key, clean);
    Arcade.feedback(clean > 0 ? 'success' : 'fail');

    ui(clean, secondary);
    refreshChrome();
    setStatus('Complete', 'over');
    startButton.disabled = false;
    startButton.textContent = '👆 Tap Game to Play Again';

    Arcade.gameResult({
      icon:config.icon,
      title:title || config.name + ' Complete',
      scoreLabel:config.scoreLabel,
      score:clean,
      best:result.best.display,
      coins,
      result,
      playsLeft:Arcade.remaining(key),
      game:key,
      extra:Array.isArray(extra) ? extra : [extra],
      onReplay:startGame,
      onMorePlays:()=>Arcade.out(key, refreshChrome)
    });
  }

  const PIECES = [
    [[0,0]], [[0,0],[1,0]], [[0,0],[0,1]], [[0,0],[1,0],[2,0]],
    [[0,0],[0,1],[0,2]], [[0,0],[1,0],[0,1]], [[0,0],[1,0],[1,1]],
    [[0,0],[0,1],[1,1]], [[0,0],[1,0],[0,1],[1,1]]
  ];

  function makeBlockGrid() {
    let board, tray, selected, score, lines, alive;
    const wrap = document.createElement('div');
    const grid = document.createElement('div');
    const trayEl = document.createElement('div');
    grid.className = 'mini-grid';
    grid.style.gridTemplateColumns = 'repeat(8,1fr)';
    trayEl.className = 'piece-tray';
    wrap.append(grid, trayEl);
    surface.replaceChildren(wrap);

    const randomPiece = () => PIECES[Math.floor(Math.random() * PIECES.length)].map(p => [...p]);

    function canPlace(piece, x, y) {
      return piece.every(([dx,dy]) => x+dx < 8 && y+dy < 8 && !board[y+dy][x+dx]);
    }

    function anyMove() {
      return tray.some(piece => {
        if (!piece) return false;
        for (let y=0;y<8;y++) for (let x=0;x<8;x++) if (canPlace(piece,x,y)) return true;
        return false;
      });
    }

    function refillTray() {
      tray=[randomPiece(),randomPiece(),randomPiece()];
      selected=0;
      Arcade.milestone('✨ New set of 3','score');
    }

    function selectNextPiece() {
      const next=tray.findIndex(Boolean);
      selected=next>=0?next:0;
    }

    function clearLines() {
      const rows=[], cols=[];
      for (let y=0;y<8;y++) if (board[y].every(Boolean)) rows.push(y);
      for (let x=0;x<8;x++) if (board.every(row => row[x])) cols.push(x);
      rows.forEach(y => board[y].fill(0));
      cols.forEach(x => board.forEach(row => row[x]=0));
      const count = rows.length + cols.length;
      if (count) {
        lines += count;
        score += count * 25;
        Arcade.feedback(count > 1 ? 'perfect' : 'score');
        if (count > 1) Arcade.milestone('🧩 Combo clear ×' + count, 'perfect');
      }
    }

    function render() {
      grid.replaceChildren();
      for (let y=0;y<8;y++) for (let x=0;x<8;x++) {
        const cell = document.createElement('button');
        cell.type='button';
        cell.className='mini-cell' + (board[y][x] ? ' filled' : '');
        cell.disabled=!alive;
        cell.addEventListener('click',()=>place(x,y));
        grid.append(cell);
      }
      trayEl.replaceChildren();
      tray.forEach((piece,idx)=>{
        const b=document.createElement('button');
        b.type='button';
        b.className='piece-button' + (piece && idx===selected ? ' selected' : '') + (!piece ? ' used' : '');
        b.disabled=!alive || !piece;

        const preview=document.createElement('span');
        preview.className='piece-preview';
        for(let py=0;py<4;py++)for(let px=0;px<4;px++){
          const dot=document.createElement('span');
          dot.className='piece-preview-cell' + (piece && piece.some(([dx,dy])=>dx===px&&dy===py) ? ' on' : '');
          preview.append(dot);
        }

        const caption=document.createElement('small');
        if(!piece){
          b.setAttribute('aria-label','Piece already used');
          caption.textContent='✓ USED';
        }else{
          b.setAttribute('aria-label',(idx===selected?'Selected ':'Select ') + piece.length + '-block piece');
          caption.textContent=idx===selected?'SELECTED':'TAP TO PICK';
          b.addEventListener('click',()=>{selected=idx;Arcade.feedback('move');render()});
        }

        b.append(preview,caption);
        trayEl.append(b);
      });
      ui(score, lines);
    }

    function place(x,y) {
      if (!alive || !tray[selected] || !canPlace(tray[selected],x,y)) {
        Arcade.feedback('fail');
        return;
      }
      const piece=tray[selected];
      piece.forEach(([dx,dy])=>board[y+dy][x+dx]=1);
      score += piece.length * 3;
      clearLines();
      tray[selected]=null;

      if (tray.every(piece=>!piece)) {
        refillTray();
      } else {
        selectNextPiece();
      }

      render();
      if (!anyMove()) {
        alive=false;
        finish(score,lines,['🧩 Lines cleared: '+lines,'Save room for the pieces still in your tray.'],'Board Full');
      }
    }

    return {
      start() {
        board=Array.from({length:8},()=>Array(8).fill(0));
        tray=[randomPiece(),randomPiece(),randomPiece()];
        selected=0;score=0;lines=0;alive=true;
        render();
      },
      stop(){alive=false}
    };
  }

  function makeMergeRush() {
    let board=Array(16).fill(0), score=0, alive=false, startX=0, startY=0, celebrated128=false;
    const wrap=document.createElement('div');
    wrap.className='merge-wrap';

    const rules=document.createElement('div');
    rules.className='merge-rules';
    rules.innerHTML =
      '<span>1️⃣ Swipe the whole board</span>' +
      '<span>2️⃣ Equal tiles that touch merge</span>' +
      '<span>🎯 Goal: reach <strong>128</strong></span>' +
      '<span>🏁 Ends when no moves remain</span>';

    const grid=document.createElement('div');
    grid.className='merge-grid';

    const goal=document.createElement('div');
    goal.className='merge-goal';
    goal.innerHTML='<strong>Next target: 128</strong><span>2 + 2 = 4 · 4 + 4 = 8 · 8 + 8 = 16…</span>';

    wrap.append(rules,grid,goal);
    surface.replaceChildren(wrap);

    function spawn() {
      const empty=board.map((v,i)=>v ? null : i).filter(v=>v!==null);
      if (!empty.length) return;
      board[empty[Math.floor(Math.random()*empty.length)]] = Math.random()<.9 ? 2 : 4;
    }

    const high=()=>Math.max(0,...board);

    function render() {
      grid.replaceChildren();
      board.forEach(v=>{
        const d=document.createElement('div');
        d.className='merge-tile';
        d.textContent=v||'';
        if (v) {
          const light=Math.min(68,25+Math.log2(v)*5);
          d.style.background='hsl('+(225-Math.log2(v)*12)+' 72% '+light+'%)';
        }
        grid.append(d);
      });
      const highTile=high();
      ui(score,highTile);
      const nextTarget = highTile < 128 ? 128 : Math.pow(2, Math.ceil(Math.log2(highTile + 1)));
      goal.querySelector('strong').textContent =
        highTile < 128 ? 'Next target: 128' : 'Next target: ' + nextTarget;
      goal.classList.toggle('goal-hit', highTile >= 128);

      if (highTile >= 128 && !celebrated128) {
        celebrated128=true;
        Arcade.milestone('🎉 128 reached! Keep going for 256','perfect');
      }
    }

    function compress(line) {
      const a=line.filter(Boolean);
      for (let i=0;i<a.length-1;i++) {
        if (a[i]===a[i+1]) {
          a[i]*=2;
          score+=a[i];
          a.splice(i+1,1);
        }
      }
      while(a.length<4)a.push(0);
      return a;
    }

    function canMove() {
      if (board.some(v=>!v)) return true;
      for(let y=0;y<4;y++)for(let x=0;x<4;x++){
        const v=board[y*4+x];
        if(x<3 && board[y*4+x+1]===v) return true;
        if(y<3 && board[(y+1)*4+x]===v) return true;
      }
      return false;
    }

    function move(dir) {
      if(!alive)return;
      const old=[...board], next=Array(16).fill(0);
      for(let n=0;n<4;n++){
        let line=[];
        for(let k=0;k<4;k++){
          let x,y;
          if(dir==='left'){x=k;y=n}
          if(dir==='right'){x=3-k;y=n}
          if(dir==='up'){x=n;y=k}
          if(dir==='down'){x=n;y=3-k}
          line.push(board[y*4+x]);
        }
        line=compress(line);
        for(let k=0;k<4;k++){
          let x,y;
          if(dir==='left'){x=k;y=n}
          if(dir==='right'){x=3-k;y=n}
          if(dir==='up'){x=n;y=k}
          if(dir==='down'){x=n;y=3-k}
          next[y*4+x]=line[k];
        }
      }
      const changed=old.some((v,i)=>v!==next[i]);
      board=next;
      if(changed){spawn();Arcade.feedback('move');render()}
      if(!canMove()){
        alive=false;
        finish(score,high(),['🔢 Highest tile: '+high(),'Combine matching numbers to stay alive.'],'No More Moves');
      }
    }

    let swipePointer=null;
    function beginSwipe(e){
      if(!alive)return;
      swipePointer=e.pointerId;
      startX=e.clientX;
      startY=e.clientY;
    }
    function endSwipe(e){
      if(!alive || swipePointer!==e.pointerId)return;
      const dx=e.clientX-startX, dy=e.clientY-startY;
      swipePointer=null;
      if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
      e.preventDefault();
      move(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
    }

    grid.addEventListener('pointerdown',beginSwipe);
    grid.addEventListener('pointerup',endSwipe);

    const onWideSwipeDown=e=>{
      if(grid.contains(e.target) || !Arcade.inExpandedGameZone(e,surface,120))return;
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
      start(){board=Array(16).fill(0);score=0;alive=true;celebrated128=false;spawn();spawn();render()},
      stop(){
        alive=false;
        swipePointer=null;
        document.removeEventListener('keydown',onKey);
        document.removeEventListener('pointerdown',onWideSwipeDown);
        document.removeEventListener('pointerup',onWideSwipeUp);
      }
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
    let flashText='',flashFrames=0,goalCelebrated=false,roundDeadline=0,roundLimit=0;

    function level(){
      return Math.min(9,1+Math.floor(hits/5));
    }

    function nextLevelAt(){
      return level()*5;
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
      ctx.fillStyle='#93c5fd';ctx.font='800 13px Arial';ctx.fillText('LEVEL '+lv,78,95);
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
      ctx.fillStyle='#243244';ctx.fillRect(98,160,164,8);
      ctx.fillStyle=timeLeft<=1500?'#ef4444':timeLeft<=2800?'#f59e0b':'#22c55e';
      ctx.fillRect(98,160,164*timerRatio,8);
      ctx.fillStyle=timeLeft<=1500?'#fca5a5':'#cbd5e1';ctx.font='800 10px Arial';
      ctx.fillText('⏱ DROP IN '+(timeLeft/1000).toFixed(1)+'s',180,176);

      // Ball rail.
      ctx.strokeStyle='#475569';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(20,190);ctx.lineTo(340,190);ctx.stroke();
      ctx.fillStyle='rgba(148,163,184,.18)';
      ctx.fillRect(20,181,320,18);

      const ballX=drop?drop.x:x;
      const ballY=drop?drop.y:178;
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
      if(!alive||drop)return;
      drop={x,y:178};
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
        flashText=perfect?'PERFECT!':'NICE!';
        flashFrames=26;
        Arcade.feedback(perfect?'perfect':'score');

        if(perfect && streak%3===0) {
          Arcade.milestone('🔥 '+streak+' hit streak!','perfect');
        }
        if(hits===5) Arcade.milestone('🎯 Level 2 unlocked!','score');
        if(hits===10) Arcade.milestone('🎯 Level 3 unlocked!','score');
        if(hits===15) Arcade.milestone('🎯 Level 4 unlocked!','score');
        if(hits>=20&&!goalCelebrated){
          goalCelebrated=true;
          Arcade.milestone('🏆 Level 5 reached! Keep going!','perfect');
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
            '🔥 Final streak: '+streak,
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
            finish(hits,level(),['🎯 Level reached: '+level(),'⏱️ Keep an eye on the drop timer.'],'Perfect Drop Run Over');
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

    c.addEventListener('pointerdown',e=>{e.preventDefault();act()});

    const onWidePointer=e=>{
      if(!alive || e.target===c || !Arcade.inExpandedGameZone(e,c,140))return;
      e.preventDefault();
      act();
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
        hits=0;streak=0;lives=3;alive=true;goalCelebrated=false;flashText='';flashFrames=0;
        next();ui(0,1);draw();raf=requestAnimationFrame(loop);
      },
      stop(){
        alive=false;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown',onKey);
        document.removeEventListener('pointerdown',onWidePointer);
      }
    };
  }

  function makeSpiralDrop() {
    const [c,ctx]=canvasBase();
    let ballX=180,rings=[],score=0,alive=false,raf=null,last=0,readyUntil=0;
    let controlPointer=null;
    let pointerStartClientX=0;
    let pointerStartBallX=180;

    function level(){
      return 1+Math.floor(score/5);
    }

    function openingWidth(){
      return Math.max(66,132-score*.95);
    }

    function randomGap(width){
      const half=width/2;
      return half+28+Math.random()*(360-(half+28)*2);
    }

    function resetRings() {
      rings=[];
      const firstWidth=140;

      // First opening is intentionally centered and farther away so a new
      // player can see the ball, understand the goal, and make a move.
      rings.push({y:238,gap:180,w:firstWidth,checked:false,first:true});

      let y=318;
      for(let i=1;i<7;i++){
        const width=i===1?126:openingWidth();
        rings.push({
          y,
          gap:randomGap(width),
          w:width,
          checked:false,
          first:false
        });
        y+=72;
      }
    }

    function draw() {
      const bg=ctx.createLinearGradient(0,0,0,430);
      bg.addColorStop(0,'#0a1424');
      bg.addColorStop(1,'#101c31');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,360,430);

      // Small tutorial that stays out of the play area.
      ctx.fillStyle='rgba(15,23,42,.9)';
      ctx.fillRect(18,14,324,42);
      ctx.strokeStyle='#334155';
      ctx.strokeRect(18,14,324,42);
      ctx.textAlign='center';
      ctx.fillStyle='#dbeafe';
      ctx.font='800 11px Arial';
      ctx.fillText('◀ DRAG TO MOVE ▶',180,30);
      ctx.fillStyle='#94a3b8';
      ctx.font='700 9px Arial';
      ctx.fillText(score===0?'First opening starts centered for you':'Line up with the next opening',180,45);

      rings.forEach(r=>{
        const safe=r.first && !r.checked;
        ctx.fillStyle=safe?'#2563eb':'#7c3aed';
        ctx.shadowColor=safe?'rgba(59,130,246,.55)':'rgba(124,58,237,.22)';
        ctx.shadowBlur=safe?10:4;
        ctx.fillRect(15,r.y,Math.max(0,r.gap-r.w/2-15),14);
        ctx.fillRect(r.gap+r.w/2,r.y,Math.max(0,345-(r.gap+r.w/2)),14);

        if(safe){
          ctx.shadowBlur=0;
          ctx.fillStyle='#93c5fd';
          ctx.font='800 9px Arial';
          ctx.fillText('FIRST GAP',r.gap,r.y-7);
        }
      });
      ctx.shadowBlur=0;

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
      const dt=Math.min(32,t-(last||t))/16.67;
      last=t;

      // Give the player time after GO to locate the ball and first opening.
      const warmingUp=t<readyUntil;
      const speed=warmingUp ? 0 : Math.min(2.65,.92+score*.043);

      rings.forEach(r=>r.y-=speed*dt);

      for(const r of rings){
        if(!r.checked&&r.y<=120&&r.y>=98){
          r.checked=true;
          r.first=false;

          if(Math.abs(ballX-r.gap)>r.w/2-8){
            alive=false;
            finish(
              score,
              level(),
              [
                '🌀 Rings passed: '+score,
                'Tap or drag toward the opening before it reaches the ball.'
              ],
              'Hit the Ring'
            );
            return;
          }

          score++;
          Arcade.feedback('score');
          ui(score,level());

          if(score===1) Arcade.milestone('🌀 First ring cleared!','score');
          if(score>0&&score%5===0) Arcade.milestone('⬆️ Level '+level()+'!','perfect');
        }
      }

      while(rings.length&&rings[0].y<-20)rings.shift();
      while(rings.length<7){
        const y=(rings.length?rings[rings.length-1].y:410)+Math.max(64,72-Math.floor(score/18)*2);
        const width=openingWidth();
        rings.push({
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
      if(!alive)return;
      controlPointer=e.pointerId;
      pointerStartClientX=e.clientX;
      pointerStartBallX=ballX;
      try{c.setPointerCapture?.(e.pointerId)}catch{}
    }

    function movePointer(e){
      if(!alive||controlPointer!==e.pointerId)return;
      e.preventDefault();
      setBallFromDrag(e.clientX);
    }

    function endPointer(e){
      if(controlPointer!==e.pointerId)return;
      controlPointer=null;
      pointerStartClientX=0;
      pointerStartBallX=ballX;
    }

    c.addEventListener('pointerdown',e=>{
      e.preventDefault();
      beginPointer(e);
    });
    c.addEventListener('pointermove',movePointer,{passive:false});
    c.addEventListener('pointerup',endPointer);
    c.addEventListener('pointercancel',endPointer);

    const onWideDown=e=>{
      if(e.target===c||!Arcade.inExpandedGameZone(e,c,135))return;
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

    const onKey=e=>{
      if(!alive)return;
      if(e.key==='ArrowLeft'){e.preventDefault();nudge(-20)}
      if(e.key==='ArrowRight'){e.preventDefault();nudge(20)}
    };
    document.addEventListener('keydown',onKey);

    return {
      start(){
        ballX=180;
        score=0;
        alive=true;
        last=0;
        controlPointer=null;
        pointerStartClientX=0;
        pointerStartBallX=180;
        resetRings();
        ui(0,1);
        readyUntil=performance.now()+1250;
        draw();
        raf=requestAnimationFrame(loop);
      },
      stop(){
        alive=false;
        controlPointer=null;
        pointerStartClientX=0;
        pointerStartBallX=ballX;
        cancelAnimationFrame(raf);
        document.removeEventListener('keydown',onKey);
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
    let score=0,streak=0,lives=3,answer=null,alive=false,locked=false,timer=null,timeLeft=0,roundNo=0;
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
    function stopTimer(){if(timer){clearInterval(timer);timer=null}} function header(){title.innerHTML='<strong>'+(roundNo<4?'Warm-up':'Rotation challenge')+'</strong><span>'+'❤️'.repeat(lives)+'♡'.repeat(3-lives)+' · ⏱️ '+(timeLeft/1000).toFixed(1)+'s</span>'}
    function miss(msg){if(locked||!alive)return;locked=true;stopTimer();lives--;streak=0;hint.textContent=msg+' · '+lives+' '+(lives===1?'life':'lives')+' left';Arcade.feedback('fail');ui(score,streak);if(lives<=0){alive=false;setTimeout(()=>finish(score,streak,['🧠 Correct matches: '+score,'Rotations and the timer get harder as you advance.'],'Shape Fit Run Over'),350);return}setTimeout(()=>{if(alive)round()},520)}
    function round(){stopTimer();locked=false;roundNo++;const base=SHAPES[Math.floor(Math.random()*SHAPES.length)],targetTurns=roundNo<4?0:Math.floor(Math.random()*4);answer=variant(base,targetTurns);draw(answer);const count=roundNo<6?4:roundNo<14?6:8;wrap.classList.toggle('many-choices',count>4);const correctTurns=roundNo<4?targetTurns:(targetTurns+1+Math.floor(Math.random()*3))%4,correct=variant(base,correctTurns),opts=[correct],used=new Set([base.name+':'+key(correct.cells)]);while(opts.length<count){const sh=SHAPES[Math.floor(Math.random()*SHAPES.length)],v=variant(sh,Math.floor(Math.random()*4)),k=sh.name+':'+key(v.cells);if(!used.has(k)){used.add(k);opts.push(v)}}opts.sort(()=>Math.random()-.5);answers.replaceChildren();opts.forEach(shape=>{const b=document.createElement('button');b.type='button';b.className='fit-answer';b.dataset.base=shape.base.name;b.setAttribute('aria-label','Choose shape');b.append(preview(shape,'fit-answer-preview'));const n=document.createElement('small');n.textContent=roundNo<4?shape.base.name:'ROTATED';b.append(n);b.addEventListener('click',()=>choose(shape,b));answers.append(b)});timeLeft=Math.max(2600,6500-Math.max(0,roundNo-3)*180);header();hint.textContent=roundNo<4?'Warm-up: tap the exact matching shape':(count>4?'🔄 Same shape, any rotation · '+count+' choices · swipe up for more':'🔄 Same shape, any rotation counts as correct');timer=setInterval(()=>{timeLeft-=100;header();if(timeLeft<=0){stopTimer();miss('⏰ Too slow')}},100)}
    function choose(shape,b){if(!alive||locked)return;if(shape.base===answer.base){locked=true;stopTimer();score++;streak++;b.classList.add('correct');hint.textContent=streak>=5?'🔥 '+streak+' streak!':'✅ Correct!';Arcade.feedback(streak>=5?'perfect':'match');ui(score,streak);if(streak===10)Arcade.milestone('🧠 10-shape streak!','perfect');setTimeout(()=>{if(alive)round()},300)}else{b.classList.add('wrong');[...answers.children].forEach(node=>{if(node.dataset.base===answer.base.name)node.classList.add('correct')});miss('❌ Wrong shape')}}
    return{start(){score=0;streak=0;lives=3;roundNo=0;alive=true;locked=false;ui(0,0);round()},stop(){alive=false;locked=true;stopTimer()}};
  }

  function makeBounceRun() {
    const [c,ctx]=canvasBase();
    let y=349,vy=0,obstacles=[],distance=0,cleared=0,alive=false,raf=null,last=0,spawn=0,readyUntil=0,queuedJump=false;

    function runLevel(){
      return 1+Math.floor(cleared/5);
    }

    function obstacleSpeed(){
      // Friendly tutorial opening, then a noticeable difficulty ramp every few clears.
      if(cleared<5)return 1.35+cleared*.16;
      if(cleared<10)return 2.9+(cleared-5)*.24;
      if(cleared<20)return 4.1+(cleared-10)*.22;
      if(cleared<35)return 6.3+(cleared-20)*.10;
      return Math.min(10.0,7.8+(cleared-35)*.045);
    }

    function nextSpawnDelay(){
      // Early levels teach the jump. Higher levels deliberately mix long gaps,
      // quick follow-ups, and occasional clusters so there is no fixed rhythm.
      if(cleared<5)return 175+Math.random()*35;
      const r=Math.random();
      if(cleared<10)return r<.20 ? 48+Math.random()*18 : 92+Math.random()*58;
      if(cleared<20)return r<.34 ? 34+Math.random()*20 : r<.48 ? 135+Math.random()*45 : 68+Math.random()*55;
      if(cleared<35)return r<.42 ? 28+Math.random()*18 : r<.58 ? 125+Math.random()*55 : 55+Math.random()*58;
      return r<.48 ? 24+Math.random()*18 : r<.65 ? 118+Math.random()*62 : 46+Math.random()*60;
    }

    function obstacleWidth(){
      // Vary obstacle size within each difficulty band so runs require timing,
      // not memorizing one jump rhythm. Early obstacles remain forgiving.
      if(cleared<5)return 16+Math.random()*7;
      if(cleared<10)return 26+Math.random()*15;
      if(cleared<20)return 32+Math.random()*25;
      if(cleared<35)return 38+Math.random()*35;
      return 44+Math.random()*Math.min(52,24+(cleared-35)*1.2);
    }

    function draw() {
      const bg=ctx.createLinearGradient(0,0,0,430);
      bg.addColorStop(0,'#0d1728');
      bg.addColorStop(1,'#13243a');
      ctx.fillStyle=bg;
      ctx.fillRect(0,0,360,430);

      ctx.fillStyle='#1f2937';
      ctx.fillRect(0,360,360,70);
      ctx.fillStyle='#334155';
      ctx.fillRect(0,356,360,4);

      ctx.fillStyle='rgba(15,23,42,.9)';
      ctx.fillRect(18,14,324,42);
      ctx.strokeStyle='#334155';
      ctx.strokeRect(18,14,324,42);
      ctx.textAlign='center';
      ctx.fillStyle='#dbeafe';
      ctx.font='800 11px Arial';
      ctx.fillText('TAP THE GAME BOX = JUMP',180,31);
      ctx.fillStyle='#94a3b8';
      ctx.font='700 9px Arial';
      ctx.fillText('Jump obstacles · 5 clears = level up',180,46);

      obstacles.forEach(o=>{
        const grd=ctx.createLinearGradient(o.x,330,o.x+o.w,360);
        grd.addColorStop(0,'#dc2626');
        grd.addColorStop(1,'#7f1d1d');
        ctx.fillStyle=grd;
        ctx.fillRect(o.x,330,o.w,30);

        ctx.fillStyle='#fca5a5';
        for(let sx=o.x+5;sx<o.x+o.w-4;sx+=10){
          ctx.beginPath();
          ctx.moveTo(sx,330);
          ctx.lineTo(sx+5,320);
          ctx.lineTo(sx+10,330);
          ctx.fill();
        }
      });

      const glow=ctx.createRadialGradient(76,y-4,2,80,y,18);
      glow.addColorStop(0,'#fff');
      glow.addColorStop(.6,'#dbeafe');
      glow.addColorStop(1,'#60a5fa');
      ctx.beginPath();
      ctx.fillStyle=glow;
      ctx.arc(80,y,11,0,Math.PI*2);
      ctx.fill();
      ctx.strokeStyle='#bfdbfe';
      ctx.lineWidth=2;
      ctx.stroke();

      ctx.fillStyle='#94a3b8';
      ctx.font='700 10px Arial';
      ctx.fillText('LEVEL '+runLevel()+'  ·  '+cleared+' cleared',180,405);

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
        ctx.fillText('Tap anywhere in this game box to start',180,213);
        ctx.fillText('Then tap again to jump each red obstacle',180,229);
      }
    }

    function loop(t) {
      if(!alive)return;
      const dt=Math.min(32,t-(last||t))/16.67;
      last=t;
      const warming=t<readyUntil;

      if(!warming&&queuedJump){queuedJump=false;jump();}

      if(!warming){
        distance+=.18*dt;
        spawn-=dt;
      }

      // Softer gravity near the top creates a rounded arcade-style jump arc.
      // Falling accelerates gradually instead of snapping straight back down.
      const gravity=vy<0?.40:.46;
      vy+=gravity*dt;
      y+=vy*dt;

      if(!warming&&spawn<=0){
        // Width and spacing vary independently so later runs do not settle into
        // a single repeated jump cadence.
        const speed=obstacleSpeed();
        const jitter=cleared<5?0:(Math.random()-.5)*Math.min(2.6,.55+cleared*.045);
        obstacles.push({x:390,w:obstacleWidth(),speed:Math.max(1.2,speed+jitter)});

        // At higher levels, some waves become doubles/triples. The extra
        // obstacles are separated enough to remain jumpable, but force the
        // player to react instead of repeating one perfectly timed hop.
        if(cleared>=10){
          // Keep clusters challenging but readable. Doubles arrive first;
          // triples are reserved for deep runs and use wider spacing. Cluster
          // members stay close in speed so they cannot collapse into an
          // effectively impossible wall while approaching the player.
          const clusterChance=cleared<20?.12:cleared<35?.20:.27;
          if(Math.random()<clusterChance){
            const triple=cleared>=40&&Math.random()<.18;
            const count=triple?2:1;
            const baseGap=triple ? 78+Math.random()*18 : 68+Math.random()*20;
            for(let i=1;i<=count;i++){
              const gap=baseGap*i;
              const followSpeed=Math.max(1.2,speed+(Math.random()-.5)*.42);
              obstacles.push({x:390+gap,w:Math.max(18,obstacleWidth()*.72),speed:followSpeed});
            }
          }
        }
        spawn=nextSpawnDelay();
      }

      obstacles.forEach(o=>o.x-=(o.speed||obstacleSpeed())*dt);
      obstacles=obstacles.filter(o=>{
        if(o.x+o.w<0){
          cleared++;
          Arcade.feedback('score');
          if(cleared%5===0)Arcade.milestone('⚪ Level '+runLevel()+'!','perfect');
          return false;
        }
        return true;
      });

      const hit=obstacles.some(o=>o.x<90&&o.x+o.w>70&&y+6>327);
      if(hit||y>430){
        alive=false;
        finish(
          Math.floor(distance),
          cleared,
          ['⚪ Obstacles cleared: '+cleared,'Tap to jump over each obstacle.'],
          'Bounce Run Over'
        );
        return;
      }

      if(y+11>=360){y=349;vy=0}
      if(y<70){y=70;vy=1}

      ui(Math.floor(distance),cleared);
      draw();
      raf=requestAnimationFrame(loop);
    }

    function jump(e){
      if(!alive)return;
      if(e && e.preventDefault)e.preventDefault();
      if(performance.now()<readyUntil){
        queuedJump=true;
        return;
      }
      if(y>=347){
        vy=-9.6;
        Arcade.feedback('hop');
      }
    }

    const onPointer=e=>{
      if(!alive)return;
      const rect=c.getBoundingClientRect();
      if(e.clientX<rect.left || e.clientX>rect.right || e.clientY<rect.top || e.clientY>rect.bottom)return;
      jump(e);
    };
    const blockGesture=e=>{
      if(alive)e.preventDefault();
    };
    const onKey=e=>{
      if(alive&&(e.code==='Space'||e.code==='Enter'||e.key==='ArrowUp'))jump(e);
    };
    c.style.touchAction='none';
    c.style.userSelect='none';
    c.style.webkitUserSelect='none';
    c.style.webkitTouchCallout='none';
    c.addEventListener('pointerdown',onPointer,{passive:false});
    c.addEventListener('pointerup',onPointer,{passive:false});
    c.addEventListener('touchstart',blockGesture,{passive:false});
    c.addEventListener('gesturestart',blockGesture,{passive:false});
    document.addEventListener('keydown',onKey);

    return {
      start(){
        y=349;vy=0;obstacles=[];distance=0;cleared=0;queuedJump=false;spawn=205;last=0;alive=true;
        readyUntil=performance.now()+1900;
        ui(0,0);
        draw();
        raf=requestAnimationFrame(loop);
      },
      stop(){
        alive=false;
        cancelAnimationFrame(raf);
        c.removeEventListener('pointerdown',onPointer);
        c.removeEventListener('pointerup',onPointer);
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


  let trafficAudioCtx=null;
  function trafficSound(kind){
    try{
      const AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      const ctx=trafficAudioCtx||(trafficAudioCtx=new AC());
      if(ctx.state==='suspended')ctx.resume();
      const now=ctx.currentTime;

      const makeNoise=(seconds)=>{
        const src=ctx.createBufferSource();
        const buf=ctx.createBuffer(1,Math.floor(ctx.sampleRate*seconds),ctx.sampleRate);
        const d=buf.getChannelData(0);
        for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
        src.buffer=buf;
        return src;
      };

      if(kind==='exit'){
        // Forward acceleration: engine pitch rises naturally instead of a game-like chirp.
        const master=ctx.createGain(), low=ctx.createBiquadFilter();
        master.gain.setValueAtTime(.0001,now);
        master.gain.exponentialRampToValueAtTime(.42,now+.04);
        master.gain.setValueAtTime(.36,now+.48);
        master.gain.exponentialRampToValueAtTime(.0001,now+1.05);
        low.type='lowpass'; low.frequency.value=720;
        low.connect(master); master.connect(ctx.destination);

        [0,1,2].forEach(i=>{
          const o=ctx.createOscillator(), g=ctx.createGain();
          o.type=i===0?'sawtooth':'triangle';
          const mult=[1,2,3][i];
          o.frequency.setValueAtTime(62*mult,now);
          o.frequency.exponentialRampToValueAtTime(138*mult,now+.78);
          g.gain.value=[.55,.22,.10][i];
          o.connect(g); g.connect(low); o.start(now); o.stop(now+1.06);
        });

        const road=makeNoise(.9), rg=ctx.createGain(), rf=ctx.createBiquadFilter();
        rf.type='lowpass'; rf.frequency.value=360;
        rg.gain.setValueAtTime(.025,now); rg.gain.exponentialRampToValueAtTime(.11,now+.65);
        rg.gain.exponentialRampToValueAtTime(.0001,now+.9);
        road.connect(rf); rf.connect(rg); rg.connect(ctx.destination); road.start(now);
      }else{
        // Tire skid, then a noisy metal impact and low thud. Avoid pure-tone "beeps".
        const skid=makeNoise(.48), sf=ctx.createBiquadFilter(), sg=ctx.createGain();
        sf.type='bandpass'; sf.frequency.setValueAtTime(3200,now);
        sf.frequency.exponentialRampToValueAtTime(1050,now+.42); sf.Q.value=2.4;
        sg.gain.setValueAtTime(.0001,now); sg.gain.exponentialRampToValueAtTime(.34,now+.025);
        sg.gain.setValueAtTime(.28,now+.25); sg.gain.exponentialRampToValueAtTime(.0001,now+.47);
        skid.connect(sf); sf.connect(sg); sg.connect(ctx.destination); skid.start(now);

        const hitAt=now+.34;
        const crash=makeNoise(.34), cf=ctx.createBiquadFilter(), cg=ctx.createGain();
        cf.type='lowpass'; cf.frequency.value=1500;
        cg.gain.setValueAtTime(.52,hitAt); cg.gain.exponentialRampToValueAtTime(.0001,hitAt+.32);
        crash.connect(cf); cf.connect(cg); cg.connect(ctx.destination); crash.start(hitAt);

        const thud=ctx.createOscillator(), tg=ctx.createGain();
        thud.type='sine'; thud.frequency.setValueAtTime(72,hitAt);
        thud.frequency.exponentialRampToValueAtTime(28,hitAt+.25);
        tg.gain.setValueAtTime(.48,hitAt); tg.gain.exponentialRampToValueAtTime(.0001,hitAt+.28);
        thud.connect(tg); tg.connect(ctx.destination); thud.start(hitAt); thud.stop(hitAt+.3);
      }
    }catch(_){}
  }

  function makeTrafficEscape() {
    let cars=[],cleared=0,level=1,alive=false,locked=false,strikes=0,boardInLevel=1,timeLeft=0,timerId=null;

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
    const boardsNeeded=()=>level===1?2:level===2?3:level===3?4:level===4?5:level===5?6:7;
    const roundSeconds=()=>Math.max(9,20-Math.max(0,level-1)*2);

    function stopTimer(){
      if(timerId){clearInterval(timerId);timerId=null;}
    }

    function timerText(){
      return '⏱️ '+timeLeft+'s';
    }

    function startTimer(){
      stopTimer();
      timeLeft=roundSeconds();
      render();
      timerId=setInterval(()=>{
        if(!alive||locked)return;
        timeLeft--;
        if(timeLeft<=0){
          stopTimer();
          alive=false;
          locked=true;
          levelLine.textContent='⏰ Time up! Run over';
          Arcade.feedback('fail');
          setTimeout(()=>finish(
            cleared,
            level,
            ['🚗 Cars cleared: '+cleared,'🚦 Level reached: '+level,'⏰ Time expired','Clear each road before the timer hits zero.'],
            cleared>=70?'Traffic Pro':''
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
      const targetCars=Math.min(9,level<=1?5:level===2?6:level<=4?7:8);
      const minBlocked=Math.min(targetCars-1,level<=1?2:level===2?3:level<=4?4:5);

      for(let attempt=0;attempt<240;attempt++){
        const candidate=[];
        for(let id=0;id<targetCars;id++){
          let placed=false;
          for(let tries=0;tries<100&&!placed;tries++){
            const h=Math.random()<.5;
            const len=Math.random()<(level>=4?.34:.18)?3:2;
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
        if(initiallyBlocked<minBlocked||initiallyFree<1||initiallyFree>Math.max(2,Math.ceil(targetCars*.45)))continue;
        if(!trafficSolvable(candidate))continue;

        const sig=trafficSignature(candidate);
        if(recentTrafficSignatures.includes(sig))continue;
        recentTrafficSignatures.push(sig);
        if(recentTrafficSignatures.length>12)recentTrafficSignatures.shift();
        return candidate.map(({seedId,...car})=>car);
      }

      // Extremely unlikely fallback: build a different simple solvable road
      // rather than reusing one recognizable authored pattern.
      const fallback=[
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
      if(!alive||locked)return;

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
          setTimeout(()=>finish(
            cleared,
            level,
            ['🚗 Cars cleared: '+cleared,'🚦 Level reached: '+level,'💥 Crashes: 3/3','Reach a clear arrow path before tapping.'],
            cleared>=70?'Traffic Pro':''
          ),260);
          return;
        }

        levelLine.textContent='💥 Crash! '+strikes+'/3 mistakes · '+(3-strikes)+' left';
        return;
      }

      locked=true;
      levelLine.textContent='✅ Clear path!';
      button.classList.add('escaping');
      button.style.transform=exitTransform(car);
      Arcade.feedback('score');
      trafficSound('exit');

      setTimeout(()=>{
        cleared++;
        cars=cars.filter(item=>item!==car);
        ui(cleared,level);

        if(!cars.length){
          const needed=boardsNeeded();
          if(boardInLevel<needed){
            stopTimer();
            locked=true;
            const clearedRoad=boardInLevel;
            boardInLevel++;
            grid.replaceChildren();
            levelLine.textContent='🎉 Road '+clearedRoad+'/'+needed+' cleared · '+(needed-clearedRoad)+' more to clear Level '+level;
            Arcade.milestone('🚦 Road '+clearedRoad+'/'+needed+' cleared','score');
            // Keep the board empty during the celebration. The next board and
            // its timer begin together, so transition time never costs play time.
            setTimeout(()=>{if(alive)loadLevel()},700);
            return;
          }

          stopTimer();
          Arcade.milestone('🚦 Level '+level+' cleared!','perfect');
          level++;
          boardInLevel=1;

          if(level>7){
            alive=false;
            stopTimer();
            finish(
              cleared,
              level-1,
              ['🚦 Levels cleared: '+(level-1),'🚗 Cars cleared: '+cleared,'You cleared every traffic board!'],
              'Traffic Master'
            );
            return;
          }

          locked=true;
          grid.replaceChildren();
          levelLine.textContent='🎉 Level '+(level-1)+' cleared · Level '+level+' next';
          // Reveal the next road only after the level celebration finishes.
          // loadLevel starts the fresh timer at the same moment.
          setTimeout(()=>{if(alive)loadLevel()},850);
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
        b.setAttribute('aria-label','Car pointing '+({'→':'right','←':'left','↑':'up','↓':'down'}[arrow]||arrow));
        b.addEventListener('click',()=>tapCar(car,b));
        grid.append(b);
      });
    }

    return {
      start(){cleared=0;level=1;boardInLevel=1;strikes=0;alive=true;locked=false;ui(0,1);loadLevel()},
      stop(){alive=false;locked=true;stopTimer()}
    };
  }

  const factories = {
    blockGrid:makeBlockGrid,
    mergeRush:makeMergeRush,
    perfectDrop:makePerfectDrop,
    spiralDrop:makeSpiralDrop,
    shapeFit:makeShapeFit,
    bounceRun:makeBounceRun,
    trafficEscape:makeTrafficEscape
  };

  function startGame() {
    if(running||starting)return;
    starting=true;

    if(!Arcade.consume(key)){
      starting=false;
      Arcade.out(key,refreshChrome);
      return;
    }

    if(engine&&engine.stop)engine.stop();
    finished=false;
    running=false;
    ui(0,key==='mergeRush'?2:1);
    refreshChrome();
    setStatus('Get Ready');
    startButton.disabled=true;
    startButton.textContent='Get Ready…';

    Arcade.countdown(()=>{
      starting=false;
      running=true;
      setStatus('Running','running');
      startButton.textContent='Game Running';
      engine=(factories[key]||makeBlockGrid)();
      engine.start();
    });
  }

  startButton.addEventListener('click',startGame);
  surface.addEventListener('pointerdown',()=>{
    if(!running&&!starting)startGame();
  },{capture:true});

  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!running&&!starting){
      e.preventDefault();
      startGame();
    }
  });

  showIdle();
  ui(0,key==='mergeRush'?2:1);
  refreshChrome();
})();