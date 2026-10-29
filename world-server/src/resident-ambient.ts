import type {DialogueRequest} from './resident-ai.ts';
import {ambientExchanges} from './resident-ambient-lines.ts';
import {topics,followups} from './resident-topics.ts';

const subjects:Record<string,string>={cozy:'cozy rooms',colorful:'colorful rooms',blue:'blue room ideas',green:'green room ideas',pink:'pink room ideas',purple:'purple room ideas',red:'red room ideas',yellow:'yellow room ideas',neutral:'simple room colors',plants:'plants in a room',seating:'comfortable seating',corners:'little room corners',layout:'room layouts',matching:'mixing furniture styles',lighting:'lamps as decorations',ocean:'ocean-inspired rooms',stars:'starry room themes',puzzles:'puzzle games',fastgames:'quick reaction games',strategy:'thinking ahead in games',competition:'friendly competition',casualgames:'playing just for fun',practice:'practicing a game',break:'taking a little break',quiet:'quiet hangouts',energetic:'lively hangouts',dance:'a little dance break',books:'stories and reading',drawing:'drawing ideas',music:'music-inspired ideas',creativity:'creative ideas',imagining:'a little daydreaming',planning:'starting with a plan',experiment:'trying ideas as you go',simple:'keeping an idea simple',details:'little finishing details',hangout:'a relaxed chat',new:'getting familiar with a new place',undecided:'taking time to choose',bored:'finding a small change of pace'};
type Exchange={opening:string;responses:readonly string[];closings:readonly string[]};
const exchanges:Exchange[]=[
 ...ambientExchanges.map(([opening,response,closing])=>({opening,responses:[response],closings:[closing]})),
 ...topics.map(topic=>({opening:`What do you think about ${subjects[topic.id]}?`,responses:topic.bodies,closings:followups[topic.family].slice(5)}))
];
export const ambientCombinationCount=exchanges.reduce((n,e)=>n+e.responses.length*e.closings.length,0);

/** Only the runtime can start an exchange, with a common nearby audience and 2–3 turns. */
export function residentAmbientReply(r:DialogueRequest):string|null{
 if(!r.ambient||!r.companions.length)return null;
 const turn=r.ambientTurn??0;
 if(turn<0||turn>2||!Number.isInteger(turn))return null;
 const pick=(lines:readonly string[])=>{const available=lines.filter(text=>!r.context.some(line=>line.text===text));return available.length?available[Math.floor(Math.random()*available.length)]:null;};
 if(turn>0){
  const opening=r.context.at(-turn)?.text;
  const exchange=exchanges.find(e=>e.opening===opening);
  if(!exchange)return null;
  if(turn===2&&!exchange.responses.includes(r.context.at(-1)?.text??''))return null;
  return pick(turn===1?exchange.responses:exchange.closings);
 }
 const previous=[...r.context].reverse().map(line=>exchanges.findIndex(e=>e.opening===line.text)).find(index=>index>=0);
 const offset=previous!==undefined?(previous+1)%exchanges.length:Math.floor(Math.random()*exchanges.length);
 for(let i=0;i<exchanges.length;i++){
  const exchange=exchanges[(offset+i)%exchanges.length];
  if(!r.context.some(line=>line.text===exchange.opening))return exchange.opening;
 }
 return null;
}
