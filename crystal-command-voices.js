/* Original command chatter, synthesized with the device's available voices. */
(()=>{'use strict';
const lines={
 human:{build:['Blueprint locked. Breaking ground.','Tools up. Construction underway.','New foundation, new possibilities.'],built:['Construction complete. Built to last.','Structure online. Make it count.','Final bolt secured. Ready for orders.'],move:['On the move, Commander.','Route confirmed. Rolling out.','Point us there. We will handle the road.'],attack:['Weapons ready. Moving to engage.','Let us make some space.','Target marked. Squad, advance.'],mine:['Those crystals will not mine themselves.','Drills ready. Let us earn our keep.','Crystal crew, back to work.']},
 prism:{build:['Aligning the lattice.','A new pattern takes shape.','Light becomes structure.'],built:['The lattice is complete.','Another node joins the harmony.','Perfect alignment. Structure ready.'],move:['Following the brightest path.','Our vectors converge.','Shifting into position.'],attack:['Focus the light.','Refract. Advance. Overwhelm.','Their defenses have a fracture.'],mine:['Gathering the scattered light.','Every crystal strengthens the pattern.','Resonance harvest underway.']},
 verdant:{build:['Planting the next stronghold.','Roots down. Let it grow.','The colony takes new ground.'],built:['Fully grown. The colony thrives.','New roots. New strength.','The hive has room to flourish.'],move:['The swarm follows.','Through soil and shadow.','New ground calls to us.'],attack:['The colony strikes as one.','Let our roots break their walls.','The hunt begins.'],mine:['Feeding the heart of the colony.','Gather. Grow. Repeat.','The harvest feeds us all.']}
};
const ready={worker:['Tools ready. Where are the crystals?','Fresh hands for the harvest.'],scout:['Eyes up. I will find the way.','The unknown is my territory.'],laser:['Locked, loaded, and listening.','Point me toward the trouble.'],siege:['Heavy firepower has arrived.','Big problems need bigger solutions.'],raider:['Fast feet. Faster reactions.','Give me a gap and I am through.'],medic:['Stay together. I will keep you standing.','A little support goes a long way.'],guardian:['Your skies are under my watch.','Nothing flies past us.'],interceptor:['Clear skies are my specialty.','Air patrol, ready to launch.'],bomber:['Payload secure. Show me the target.','Making an entrance from above.'],cruiser:['The storm has arrived.','Heavy support, at your command.']};
const common={train:['Training queued. Reinforcements on the way.','A fresh recruit is in the works.','Preparing your next squad member.'],rally:['Rally point confirmed.','Reinforcements will meet you there.'],stop:['Holding position.','Standing by for your next order.'],upgrade:['Research underway. Think ahead, win ahead.','Putting bright minds to work.'],researched:['Research complete. Your army just got stronger.','Upgrade ready. Time to put it to use.'],crystals:['More crystals needed. Keep those workers busy.','A little more mining and we can afford it.'],supply:['Army capacity reached. Build a {relay}.','Room for reinforcements? We need a {relay}.'],start:['Command channel online. Let us build something great.','Commander on deck. Mine, build, and make your move.']};
function create({enabled=()=>true,caption=()=>{},engine=window.CrystalCommand,now=()=>performance.now(),random=Math.random}={}){
 let faction='human',previous=null,levels=null,queue=[],active=null,timer=null,captionTimer=null,unlocked=false;
 const recent=new Map(),lastLine=new Map();
 function stop(){queue=[];clearTimeout(timer);clearTimeout(captionTimer);active=null;try{window.speechSynthesis?.cancel()}catch{}caption('')}
 function choose(key,choices){let index=Math.min(choices.length-1,Math.floor(random()*choices.length));if(choices.length>1&&index===lastLine.get(key))index=(index+1)%choices.length;lastLine.set(key,index);return choices[index]}
 function pump(){
  if(active||!queue.length)return;
  const item=queue.shift();if(now()-item.at>6500){pump();return}
  clearTimeout(captionTimer);caption(item.text);captionTimer=setTimeout(()=>caption(''),4500);
  if(!enabled()||document.hidden||!unlocked||!window.speechSynthesis||!window.SpeechSynthesisUtterance){pump();return}
  try{
   const utterance=new SpeechSynthesisUtterance(item.text),voices=speechSynthesis.getVoices().filter(v=>/^en(?:-|_|$)/i.test(v.lang));
   const available=voices.filter(v=>v.localService);const pool=available.length?available:voices;
   const index=({human:0,prism:1,verdant:2}[faction]||0)+(item.role==='unit'?1:item.role==='engineer'?2:0);
   if(pool.length)utterance.voice=pool[index%pool.length];utterance.lang='en-US';utterance.rate=faction==='prism'?1.02:.98;utterance.pitch=faction==='verdant'?.78:faction==='prism'?1.15:item.role==='unit'?.9:1;utterance.volume=.8;
   active=utterance;const done=()=>{if(active!==utterance)return;active=null;clearTimeout(timer);pump()};utterance.onend=done;utterance.onerror=done;
   timer=setTimeout(()=>{if(active!==utterance)return;active=null;speechSynthesis.cancel();pump()},8500);
   speechSynthesis.speak(utterance);
  }catch{active=null;clearTimeout(timer)}
 }
 function say(key,choices,{priority=1,role='command',cooldown=1200}={}){
  if(!choices?.length||document.hidden||now()-(recent.get(key)??-Infinity)<cooldown)return;
  recent.set(key,now());const text=choose(key,choices).replaceAll('{relay}',engine.typeFor('relay',faction).name);
  queue=queue.filter(e=>e.key!==key);queue.push({key,text,priority,role,at:now()});queue.sort((a,b)=>b.priority-a.priority||a.at-b.at);queue=queue.slice(0,3);pump();
 }
 function unlock(nextFaction){faction=Object.hasOwn(lines,nextFaction)?nextFaction:'human';if(unlocked||!enabled())return;unlocked=true;try{if(enabled()&&window.speechSynthesis&&window.SpeechSynthesisUtterance){const prime=new SpeechSynthesisUtterance('Ready');prime.volume=0;speechSynthesis.speak(prime)}}catch{}}
 function reset(view,side){stop();recent.clear();previous=new Map(view.entities.filter(e=>e.side===side).map(e=>[e.id,{type:e.type,build:e.build}]));levels=[view.player.upgrade,view.player.armor];faction=view.player.faction;say('start',common.start,{cooldown:3000});}
 function observe(view,side){
  if(!previous){reset(view,side);return}faction=view.player.faction;
  const next=new Map();
  for(const entity of view.entities){if(entity.side!==side)continue;const before=previous.get(entity.id),d=engine.typeFor(entity.type,faction);next.set(entity.id,{type:entity.type,build:entity.build});
   if(!before&&d.supply){const phrases=ready[entity.type]||['Ready for your command.'];say('ready:'+entity.type,phrases.map(text=>d.name+' ready. '+text),{priority:2,role:'unit',cooldown:500})}
   else if(!before&&entity.build>0)say('build',lines[faction].build.map(text=>d.name+'. '+text),{role:'engineer'});
   else if(before?.build>0&&!entity.build)say('built:'+entity.type,lines[faction].built.map(text=>d.name+'. '+text),{priority:2,role:'engineer',cooldown:500});
  }
  if(levels&&(view.player.upgrade>levels[0]||view.player.armor>levels[1]))say('researched',common.researched,{priority:2});
  levels=[view.player.upgrade,view.player.armor];previous=next;
 }
 function command(command,pending=false){if(pending){say('request',['Order transmitted. Awaiting confirmation.'],{priority:0,cooldown:2000});return}const type=command.type;if(type==='build')return;say(type,lines[faction][type]||common[type],{priority:['move','attack','mine','stop','rally'].includes(type)?0:1,role:['move','attack','mine','stop'].includes(type)?'unit':'command',cooldown:1800})}
 function warning(message){if(/crystals needed/i.test(message))say('crystals',common.crystals,{priority:3,cooldown:7000});else if(/troop space|ARMY FULL/i.test(message))say('supply',common.supply,{priority:3,cooldown:7000});else if(/^(Complete a |Build a |Grow a |Move a |Power lost|Select a completed|That unit needs)/.test(message))say('requirement',[message],{priority:3,cooldown:5000})}
 return{unlock,reset,observe,command,warning,stop,say};
}
window.CrystalVoices={create,lines,ready,common};
})();
