(() => {
  const params = new URLSearchParams(location.search);
  const key = params.get('game') || 'blockGrid';

  const configs = {
    blockGrid:{icon:'🧩',name:'Block Grid',scoreLabel:'Score',secondaryLabel:'Lines',help:'Place pieces on the 8×8 board. Full rows and columns disappear.',reward:v=>Math.min(25,Math.floor(v/40)+(v>=250?3:0)+(v>=500?5:0))},
    mergeRush:{icon:'🔢',name:'Merge Rush',scoreLabel:'Score',secondaryLabel:'High Tile',help:'Swipe matching numbers together. Arrow keys work on computer.',reward:v=>Math.min(25,Math.floor(v/180)+(v>=1000?3:0)+(v>=2500?5:0))},
    perfectDrop:{icon:'🎯',name:'Perfect Drop',scoreLabel:'Hits',secondaryLabel:'Streak',help:'Tap when the moving ball is above the glowing target.',reward:v=>Math.min(25,Math.floor(v/2)+(v>=10?3:0)+(v>=20?5:0))},
    spiralDrop:{icon:'🌀',name:'Spiral Drop',scoreLabel:'Rings',secondaryLabel:'Level',help:'Move left or right so the ball falls through each opening.',reward:v=>Math.min(25,Math.floor(v/2)+(v>=10?2:0)+(v>=20?5:0))},
    shapeFit:{icon:'🧠',name:'Shape Fit',scoreLabel:'Correct',secondaryLabel:'Streak',help:'Study the silhouette and choose the matching piece.',reward:v=>Math.min(25,Math.floor(v/2)+(v>=10?3:0)+(v>=20?5:0))},
    bounceRun:{icon:'⚪',name:'Bounce Run',scoreLabel:'Distance',secondaryLabel:'Cleared',help:'Hold to dive faster. Release to float and clear obstacles.',reward:v=>Math.min(25,Math.floor(v/15)+(v>=120?3:0)+(v>=220?5:0))},
    trafficEscape:{icon:'🚦',name:'Traffic Escape',scoreLabel:'Cars',secondaryLabel:'Level',help:'Tap cars with a clear path to drive them off the board.',reward:v=>Math.min(25,Math.floor(v/2)+(v>=10?3:0)+(v>=20?5:0))}
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
  document.getElementById('scoreLabel').textContent = config.scoreLabel;
  document.getElementById('secondaryLabel').textContent = config.secondaryLabel;
  helpEl.textContent = config.help;

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
        for (let y=0;y<8;y++) for (let x=0;x<8;x++) if (canPlace(piece,x,y)) return true;
        return false;
      });
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
        b.className='piece-button' + (idx===selected ? ' selected' : '');
        b.disabled=!alive;
        b.setAttribute('aria-label',(idx===selected?'Selected ':'Select ') + piece.length + '-block piece');

        const preview=document.createElement('span');
        preview.className='piece-preview';
        for(let py=0;py<4;py++)for(let px=0;px<4;px++){
          const dot=document.createElement('span');
          dot.className='piece-preview-cell' + (piece.some(([dx,dy])=>dx===px&&dy===py) ? ' on' : '');
          preview.append(dot);
        }

        const caption=document.createElement('small');
        caption.textContent=idx===selected?'SELECTED':'TAP TO PICK';
        b.append(preview,caption);
        b.addEventListener('click',()=>{selected=idx;Arcade.feedback('move');render()});
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
      tray[selected]=randomPiece();
      selected=0;
      render();
      if (!anyMove()) {
        alive=false;
        finish(score,lines,['🧩 Lines cleared: '+lines,'Leave open space for larger pieces.'],'Board Full');
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
    let board=Array(16).fill(0), score=0, alive=false, startX=0, startY=0;
    const grid=document.createElement('div');
    grid.className='merge-grid';
    surface.replaceChildren(grid);

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
      ui(score,high());
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

    grid.addEventListener('pointerdown',e=>{startX=e.clientX;startY=e.clientY});
    grid.addEventListener('pointerup',e=>{
      const dx=e.clientX-startX, dy=e.clientY-startY;
      if(Math.max(Math.abs(dx),Math.abs(dy))<18)return;
      move(Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up'));
    });

    const onKey=e=>{
      if(!alive)return;
      const dir={ArrowLeft:'left',ArrowRight:'right',ArrowUp:'up',ArrowDown:'down'}[e.key];
      if(dir){e.preventDefault();move(dir)}
    };
    document.addEventListener('keydown',onKey);

    return {
      start(){board=Array(16).fill(0);score=0;alive=true;spawn();spawn();render()},
      stop(){alive=false;document.removeEventListener('keydown',onKey)}
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
    let x=40,dir=1,speed=3,targetX=110,targetW=140,hits=0,streak=0,lives=3,drop=null,alive=false,raf=null;

    function next() {
      targetW=Math.max(45,140-hits*5);
      targetX=20+Math.random()*(320-targetW);
      speed=Math.min(8,3+hits*.22);
      x=dir>0?30:330;
      drop=null;
    }

    function draw() {
      ctx.fillStyle='#101c2e';ctx.fillRect(0,0,360,430);
      ctx.fillStyle='#163a2a';ctx.fillRect(targetX,360,targetW,38);
      ctx.fillStyle='#4ade80';ctx.fillRect(targetX+6,360,targetW-12,6);
      ctx.strokeStyle='#475569';ctx.beginPath();ctx.moveTo(20,95);ctx.lineTo(340,95);ctx.stroke();
      ctx.beginPath();ctx.fillStyle='#f8fafc';ctx.arc(drop?drop.x:x,drop?drop.y:85,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#94a3b8';ctx.font='12px Arial';ctx.textAlign='center';ctx.fillText('Lives: '+lives,180,410);
    }

    function act() {
      if(!alive||drop)return;
      drop={x,y:85};
    }

    function loop() {
      if(!alive)return;
      if(drop){
        drop.y+=8;
        if(drop.y>=350){
          const hit=drop.x>=targetX&&drop.x<=targetX+targetW;
          if(hit){
            hits++;streak++;
            Arcade.feedback('perfect');
            if(streak===5)Arcade.milestone('🎯 5 perfect drops!','perfect');
          }else{
            lives--;streak=0;Arcade.feedback('fail');
          }
          ui(hits,streak);
          if(lives<=0){
            alive=false;
            finish(hits,streak,['🎯 Hits: '+hits,'Center the ball for safer drops.'],'Drop Run Over');
            return;
          }
          next();
        }
      } else {
        x+=speed*dir;
        if(x>=330){x=330;dir=-1}
        else if(x<=30){x=30;dir=1}
      }
      draw();
      raf=requestAnimationFrame(loop);
    }

    c.addEventListener('pointerdown',e=>{e.preventDefault();act()});
    const onKey=e=>{if(alive&&(e.code==='Space'||e.key==='Enter')){e.preventDefault();act()}};
    document.addEventListener('keydown',onKey);

    return {
      start(){hits=0;streak=0;lives=3;alive=true;next();ui(0,0);raf=requestAnimationFrame(loop)},
      stop(){alive=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',onKey)}
    };
  }

  function makeSpiralDrop() {
    const [c,ctx]=canvasBase();
    let ballX=180,rings=[],score=0,alive=false,raf=null,last=0;

    function resetRings() {
      rings=[];
      for(let i=0;i<7;i++)rings.push({y:150+i*62,gap:55+Math.random()*250,w:76,checked:false});
    }

    function draw() {
      ctx.fillStyle='#0d1727';ctx.fillRect(0,0,360,430);
      rings.forEach(r=>{
        ctx.fillStyle='#7c3aed';
        ctx.fillRect(15,r.y,Math.max(0,r.gap-r.w/2-15),14);
        ctx.fillRect(r.gap+r.w/2,r.y,Math.max(0,345-(r.gap+r.w/2)),14);
      });
      ctx.beginPath();ctx.fillStyle='#f8fafc';ctx.arc(ballX,110,10,0,Math.PI*2);ctx.fill();
    }

    function shift(dx){ballX=Math.max(25,Math.min(335,ballX+dx))}

    function loop(t) {
      if(!alive)return;
      const dt=Math.min(32,t-(last||t))/16.67;last=t;
      const speed=1.9+Math.min(3.3,score*.08);
      rings.forEach(r=>r.y-=speed*dt);

      for(const r of rings){
        if(!r.checked&&r.y<=120&&r.y>=98){
          r.checked=true;
          if(Math.abs(ballX-r.gap)>r.w/2-8){
            alive=false;
            finish(score,1+Math.floor(score/5),['🌀 Rings passed: '+score,'Move toward the next opening early.'],'Hit the Ring');
            return;
          }
          score++;
          Arcade.feedback('score');
          ui(score,1+Math.floor(score/5));
        }
      }

      while(rings.length&&rings[0].y<-20)rings.shift();
      while(rings.length<7){
        const y=(rings.length?rings[rings.length-1].y:400)+62;
        rings.push({y,gap:55+Math.random()*250,w:Math.max(48,76-score*.6),checked:false});
      }
      draw();
      raf=requestAnimationFrame(loop);
    }

    c.addEventListener('pointerdown',e=>{
      e.preventDefault();
      if(!alive)return;
      const r=c.getBoundingClientRect();
      shift(e.clientX-r.left<r.width/2?-32:32);
    });

    const onKey=e=>{
      if(!alive)return;
      if(e.key==='ArrowLeft'){e.preventDefault();shift(-28)}
      if(e.key==='ArrowRight'){e.preventDefault();shift(28)}
    };
    document.addEventListener('keydown',onKey);

    return {
      start(){ballX=180;score=0;alive=true;last=0;resetRings();ui(0,1);raf=requestAnimationFrame(loop)},
      stop(){alive=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',onKey)}
    };
  }

  const SHAPES = [
    {name:'L',cells:[[0,0],[0,1],[0,2],[1,2]]},
    {name:'T',cells:[[0,0],[1,0],[2,0],[1,1]]},
    {name:'Square',cells:[[0,0],[1,0],[0,1],[1,1]]},
    {name:'Z',cells:[[0,0],[1,0],[1,1],[2,1]]},
    {name:'Line',cells:[[0,0],[1,0],[2,0],[3,0]]}
  ];

  function makeShapeFit() {
    let score=0,streak=0,lives=3,answer=null,alive=false;
    const wrap=document.createElement('div');
    wrap.className='fit-wrap';
    const title=document.createElement('div');
    title.className='mini-help';
    const target=document.createElement('div');
    target.className='fit-shape';
    const answers=document.createElement('div');
    answers.className='fit-answers';
    wrap.append(title,target,answers);
    surface.replaceChildren(wrap);

    function round() {
      answer=SHAPES[Math.floor(Math.random()*SHAPES.length)];
      title.textContent='Which piece matches this silhouette?  •  Lives '+lives;
      target.replaceChildren();
      for(let y=0;y<4;y++)for(let x=0;x<4;x++){
        const d=document.createElement('div');
        d.className='fit-dot'+(answer.cells.some(([cx,cy])=>cx===x&&cy===y)?' on':'');
        target.append(d);
      }
      const opts=[answer];
      while(opts.length<4){
        const s=SHAPES[Math.floor(Math.random()*SHAPES.length)];
        if(!opts.includes(s))opts.push(s);
      }
      opts.sort(()=>Math.random()-.5);
      answers.replaceChildren();
      opts.forEach(s=>{
        const b=document.createElement('button');
        b.type='button';b.className='fit-answer';b.textContent=s.name;
        b.addEventListener('click',()=>choose(s));
        answers.append(b);
      });
    }

    function choose(s) {
      if(!alive)return;
      if(s===answer){
        score++;streak++;Arcade.feedback('match');
        if(streak===7)Arcade.milestone('🧠 7 correct in a row!','perfect');
      }else{
        lives--;streak=0;Arcade.feedback('fail');
      }
      ui(score,streak);
      if(lives<=0){
        alive=false;
        finish(score,streak,['🧠 Correct fits: '+score,'Study the silhouette before choosing.'],'Puzzle Run Over');
      }else round();
    }

    return {
      start(){score=0;streak=0;lives=3;alive=true;ui(0,0);round()},
      stop(){alive=false}
    };
  }

  function makeBounceRun() {
    const [c,ctx]=canvasBase();
    let y=300,vy=-8,dive=false,obstacles=[],distance=0,cleared=0,alive=false,raf=null,last=0,spawn=0;

    function draw() {
      ctx.fillStyle='#0e1d2f';ctx.fillRect(0,0,360,430);
      ctx.fillStyle='#1f2937';ctx.fillRect(0,360,360,70);
      ctx.fillStyle='#22c55e';obstacles.forEach(o=>ctx.fillRect(o.x,330,o.w,30));
      ctx.beginPath();ctx.fillStyle='#f8fafc';ctx.arc(80,y,11,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#94a3b8';ctx.font='11px Arial';ctx.textAlign='center';ctx.fillText('HOLD = DIVE',285,405);
    }

    function loop(t) {
      if(!alive)return;
      const dt=Math.min(32,t-(last||t))/16.67;last=t;
      distance+=.18*dt;spawn-=dt;
      vy+=(dive?1.05:.48)*dt;
      y+=vy*dt;

      if(spawn<=0){
        obstacles.push({x:390,w:28+Math.random()*28});
        spawn=80+Math.random()*55;
      }

      obstacles.forEach(o=>o.x-=3.5*dt);
      obstacles=obstacles.filter(o=>{
        if(o.x+o.w<0){cleared++;Arcade.feedback('score');return false}
        return true;
      });

      const hit=obstacles.some(o=>o.x<92&&o.x+o.w>68&&y+11>330);
      if(hit||y>430){
        alive=false;
        finish(Math.floor(distance),cleared,['⚪ Obstacles cleared: '+cleared,'Hold briefly to dive; release to float.'],'Bounce Run Over');
        return;
      }

      if(y+11>=360){y=349;vy=-9.4}
      if(y<20){y=20;vy=1}
      ui(Math.floor(distance),cleared);
      draw();
      raf=requestAnimationFrame(loop);
    }

    const down=e=>{if(alive){e.preventDefault();dive=true}};
    const up=e=>{if(alive){e.preventDefault();dive=false}};
    c.addEventListener('pointerdown',down);
    c.addEventListener('pointerup',up);
    c.addEventListener('pointercancel',up);

    const onDown=e=>{if(alive&&(e.code==='Space'||e.key==='ArrowDown')){e.preventDefault();dive=true}};
    const onUp=e=>{if(e.code==='Space'||e.key==='ArrowDown')dive=false};
    document.addEventListener('keydown',onDown);
    document.addEventListener('keyup',onUp);

    return {
      start(){y=300;vy=-8;dive=false;obstacles=[];distance=0;cleared=0;spawn=50;last=0;alive=true;ui(0,0);raf=requestAnimationFrame(loop)},
      stop(){alive=false;cancelAnimationFrame(raf);document.removeEventListener('keydown',onDown);document.removeEventListener('keyup',onUp)}
    };
  }

  const TRAFFIC_LEVELS = [
    [
      {x:0,y:0,len:2,h:true,dir:1},{x:3,y:0,len:2,h:false,dir:1},
      {x:1,y:2,len:2,h:true,dir:-1},{x:4,y:3,len:2,h:false,dir:1},
      {x:0,y:5,len:2,h:true,dir:-1}
    ],
    [
      {x:0,y:1,len:3,h:true,dir:1},{x:2,y:0,len:2,h:false,dir:-1},
      {x:4,y:1,len:2,h:false,dir:1},{x:1,y:4,len:2,h:true,dir:1},
      {x:5,y:3,len:2,h:false,dir:-1},{x:0,y:5,len:2,h:true,dir:-1}
    ],
    [
      {x:0,y:0,len:2,h:true,dir:1},{x:2,y:0,len:3,h:false,dir:1},
      {x:3,y:2,len:2,h:true,dir:-1},{x:0,y:3,len:3,h:true,dir:1},
      {x:5,y:2,len:2,h:false,dir:-1},{x:1,y:5,len:2,h:true,dir:-1},
      {x:4,y:4,len:2,h:false,dir:1}
    ]
  ];

  function makeTrafficEscape() {
    let cars=[],cleared=0,level=1,alive=false;
    const wrap=document.createElement('div');
    const grid=document.createElement('div');
    grid.className='traffic-grid';
    wrap.append(grid);
    surface.replaceChildren(wrap);
    const cell=55;

    function loadLevel() {
      const source=TRAFFIC_LEVELS[(level-1)%TRAFFIC_LEVELS.length];
      cars=source.map((c,i)=>({...c,id:i}));
      render();
    }

    function occupiedByOther(car, x, y) {
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

    function tapCar(car) {
      if(!alive)return;
      if(!canExit(car)){Arcade.feedback('fail');return}
      Arcade.feedback('score');
      cleared++;
      cars=cars.filter(c=>c!==car);
      ui(cleared,level);
      render();
      if(!cars.length){
        Arcade.milestone('🚦 Level '+level+' cleared!','perfect');
        level++;
        if(level>9){
          alive=false;
          finish(cleared,level-1,['🚦 Levels cleared: '+(level-1),'You cleared every traffic board!'],'Traffic Master');
          return;
        }
        setTimeout(()=>{if(alive)loadLevel()},350);
      }
    }

    function render() {
      grid.replaceChildren();
      cars.forEach((car,idx)=>{
        const b=document.createElement('button');
        b.type='button';b.className='traffic-car';
        b.style.left=(car.x*cell+3)+'px';
        b.style.top=(car.y*cell+3)+'px';
        b.style.width=((car.h?car.len:1)*cell-6)+'px';
        b.style.height=((car.h?1:car.len)*cell-6)+'px';
        b.style.background=['#2563eb','#16a34a','#dc2626','#9333ea','#d97706','#0891b2'][idx%6];
        b.textContent=car.h?(car.dir>0?'🚗→':'←🚗'):(car.dir>0?'🚙↓':'↑🚙');
        b.addEventListener('click',()=>tapCar(car));
        grid.append(b);
      });
    }

    return {
      start(){cleared=0;level=1;alive=true;ui(0,1);loadLevel()},
      stop(){alive=false}
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