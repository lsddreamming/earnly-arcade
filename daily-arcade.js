/* Daily goals are previews until the server confirms signed-in results. */
(() => {
  const root=document.getElementById('daily-arcade');
  if(!root)return;
  const games={
    spiralDrop:{name:'Spiral Drop',goal:8,unit:'rings',icon:'🌀',href:'mini.html?game=spiralDrop'},
    bounceRun:{name:'Bounce Run',goal:60,unit:'distance',icon:'⚪',href:'mini.html?game=bounceRun'},
    neonSlice:{name:'Neon Slice',goal:120,unit:'points',icon:'🍔',href:'neon-slice.html'},
    towerStack:{name:'Tower Stack',goal:8,unit:'floors',icon:'🏗️',href:'towerstack.html'},
    snake:{name:'Snake',goal:5,unit:'apples',icon:'🐍',href:'snake.html'},
    coinCatch:{name:'Coin Catch',goal:20,unit:'catches',icon:'🪙',href:'coincatch.html'}
  };
  let state=null,epoch=0,request=null,failed=false,previewKey='';
  const list=root.querySelector('[data-goals]'),message=root.querySelector('[data-message]'),retry=root.querySelector('[data-retry]');
  const make=(tag,text,cls)=>{const e=document.createElement(tag);if(text)e.textContent=text;if(cls)e.className=cls;return e;};
  function preview(){
    const offset=Math.floor((Date.now()-Date.UTC(2026,0,1))/86400000),keys=Object.keys(games);
    return Array.from({length:3},(_,i)=>{const game=keys[((offset+i)%6+6)%6];return {game,goal:games[game].goal,progress:0};});
  }
  function paint(){
    const goals=state?.goals||preview(),completed=goals.filter(g=>g.progress>=g.goal).length;
    root.querySelector('[data-count]').textContent=state?`${completed}/3 complete`:'3 quick goals';
    const summary=root.querySelector('[data-summary-status]');
    if(summary)summary.textContent=failed?'Progress unavailable · Tap to retry':request?'Checking progress…':state?.pending?'Collectible earned · Check Backpack':state&&completed===3?'Complete · Your daily stamp is saved':state?.dailyBonus?`3 games · +${state.dailyBonus} Arcade Coins`:'Three games · One daily stamp';
    list.replaceChildren();
    for(const goal of goals){
      const game=games[goal.game];if(!game)continue;
      const done=!!state&&goal.progress>=goal.goal,row=make('li',null,'daily-arcade-goal'+(done?' complete':''));
      const icon=make('span',done?'✓':game.icon,'daily-arcade-icon');icon.setAttribute('aria-hidden','true');
      const copy=make('div'),title=make('strong',game.name),detail=make('span',`Reach ${goal.goal} ${game.unit} in one run`);
      const progress=make('progress');progress.max=goal.goal;progress.value=state?Math.min(goal.goal,goal.progress):0;progress.setAttribute('aria-label',game.name+' challenge progress');
      copy.append(title,detail,progress);
      const link=make('a',done?'Done ✓':'Play →');link.href=game.href;link.setAttribute('aria-label',(done?'Play again: ':'Play ')+game.name);
      row.append(icon,copy,link);list.append(row);
    }
    const prize=state?.rewardPreview||{name:'Arcade All-Star Cup',sprite:'trophy',color:'#70dcff'};
    root.querySelector('[data-prize-name]').textContent=state?.reward||prize.name;
    const bonus=root.querySelector('[data-daily-bonus]');bonus.hidden=!state?.dailyBonus;
    bonus.textContent=state?.dailyBonusPaid?`✓ ${state.dailyBonus} Arcade Coins added for today’s challenge!`:`Finish all three today: +${state?.dailyBonus||0} Arcade Coins and one stamp.`;
    const next=root.querySelector('[data-next-reward]');next.hidden=!state?.nextReward;
    next.textContent=state?.nextReward?`Next week: ${state.nextReward} · Collect a new room item each week.`:'';
    const canvas=root.querySelector('[data-room-preview]');
    const key=JSON.stringify(prize);
    if(window.EarnlyWorldRenderer&&key!==previewKey){
      previewKey=key;
      const item={sprite:prize.sprite,color:prize.color,width:1,length:1,itemHeight:2};
      window.EarnlyWorldRenderer.decorPreview(canvas,item);
      const image=root.querySelector('.daily-arcade-prize img');
      const thumb=document.createElement('canvas');window.EarnlyWorldRenderer.thumbnail(thumb,item);
      image.src=thumb.toDataURL();image.alt=prize.name;
    }
    const days=state?.days||[];
    root.querySelector('[data-week-count]').textContent=`${Math.min(4,days.length)} / 4 days`;
    const weekSummary=root.querySelector('[data-week-summary]');
    if(weekSummary)weekSummary.textContent=`${Math.min(4,days.length)} / 4 days`;
    const stamps=root.querySelector('[data-stamps]');stamps.replaceChildren();
    for(let i=0;i<4;i++){const stamp=make('span',i<days.length?'✓':String(i+1),i<days.length?'earned':'');stamp.setAttribute('aria-hidden','true');stamps.append(stamp);}
    const reward=root.querySelector('[data-reward-status]');
    reward.textContent=state?.delivered?'Yours! Find your collectible in the World Backpack.':state?.pending?'Collectible earned! Make room in your Backpack, then check again.':'Complete all three goals on any four days this week. Missing a day never wipes your progress.';
    root.querySelector('[data-world]').hidden=!(state?.delivered||state?.pending||state?.totalAwards>0);
    root.querySelector('[data-signin]').hidden=!!state||!!request||failed;
    retry.hidden=!(failed||state?.pending);retry.disabled=!!request;
    message.textContent=failed?'Could not check your progress. Reconnect and try again; saved rewards stay yours.':request?'Checking saved progress…':state?(completed===3?'Today’s challenge complete! Your weekly stamp is saved.':'Your best saved result counts. Finish a run, then return here to see progress.'):'Sign in before playing to earn weekly stamps. You can try every game as a guest.';
    const reset=root.querySelector('[data-reset]');
    reset.textContent=state?`New goals ${new Date(state.resetAt).toLocaleString([],{weekday:'short',hour:'numeric',minute:'2-digit'})} · Week ends ${new Date(state.weekResetAt).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})}`:'New goals daily at midnight UTC · Weeks start Monday UTC';
    root.setAttribute('aria-busy',String(!!request));
  }
  function refresh(){
    if(request||document.hidden)return request;
    if(!window.EarnlyCloud?.arcadeChallenge){paint();return;}
    const generation=epoch;
    const task=Promise.resolve().then(()=>window.EarnlyCloud.arcadeChallenge()).then(next=>{
      if(generation!==epoch)return;
      if(next&&(!Array.isArray(next.goals)||next.goals.length!==3||next.goals.some(g=>!games[g.game]||!Number.isFinite(g.goal)||g.goal<=0||!Number.isFinite(g.progress))||!Array.isArray(next.days)||!Number.isFinite(Date.parse(next.resetAt))||!Number.isFinite(Date.parse(next.weekResetAt))))throw Error('Invalid challenge response');
      state=next;failed=false;
    }).catch(()=>{if(generation===epoch){state=null;failed=true;}}).finally(()=>{if(generation===epoch){request=null;paint();}});
    request=task;paint();return task;
  }
  retry.onclick=refresh;
  window.addEventListener('earnly-cloud-ready',refresh);
  window.addEventListener('earnly-server-rewards-synced',refresh);
  window.addEventListener('earnly-cloud-auth-change',()=>{epoch++;state=null;request=null;failed=false;paint();refresh();});
  window.addEventListener('pageshow',refresh);
  window.addEventListener('focus',refresh);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
  // Refresh across midnight, including devices left open on Home.
  setInterval(()=>{if(state&&Date.now()>=Date.parse(state.resetAt))refresh();},60000);
  paint();refresh();
})();
