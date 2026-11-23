import {balance,venues,chains} from './spuds-kitchen-data.mjs';
export const spaces=s=>Math.min(80,46+2*s.level);
export const slots=s=>4+Math.floor(s.level/4);
export const goal=l=>20+l*7;
export function fresh(now=Date.now()){
 const board=Array(80).fill(null);[0,0,10,10].forEach((x,i)=>board[18+i]=x);
 return {version:1,board,seen:[0,10],orders:[[1],[11],[0,10]],energy:100,tick:now,money:0,xp:0,level:1,venue:0,bag:[],ranks:Array(chains.length).fill(1),decor:Array(venues.length).fill(0),served:0,day:'',undo:null};
}
export function refill(s,now){
 if(now<s.tick)return;
 const n=Math.floor((now-s.tick)/balance.regen);
 s.energy=Math.min(balance.maxEnergy,s.energy+n);
 s.tick=s.energy===balance.maxEnergy?now:s.tick+n*balance.regen;
}
export function discover(s,id){if(!s.seen.includes(id))s.seen.push(id);}
export const empty=s=>s.board.slice(0,spaces(s)).indexOf(null);
export function generate(s,c,now=Date.now(),random=Math.random){
 refill(s,now);const at=empty(s);
 if(at<0||s.energy<1||!venues[s.venue].chains.includes(c))return false;
 const tier=random()<0.16*(s.ranks[c]-1)?1:0;
 s.energy--;s.board[at]=10*c+tier;discover(s,s.board[at]);return true;
}
export function move(s,a,b){
 if(!Number.isInteger(a)||!Number.isInteger(b)||Math.min(a,b)<0||Math.max(a,b)>=spaces(s)||a===b||s.board[a]===null)return '';
 const id=s.board[a];
 if(id===s.board[b]&&id%10<9){s.board[a]=null;s.board[b]++;discover(s,id+1);return 'Merged';}
 [s.board[a],s.board[b]]=[s.board[b],id];return 'Moved';
}
export function order(s,r=Math.random){
 const pool=venues[s.venue].chains, item=()=>10*pool[Math.floor(r()*pool.length)]+Math.floor(r()*Math.min(10,2+Math.floor(s.level/3)));
 return Array.from({length:r()<0.35?2:1},item);
}
export function indices(s,items){
 const taken=[];for(const id of items){const i=s.board.findIndex((v,i)=>v===id&&!taken.includes(i));if(i<0)return null;taken.push(i);}return taken;
}
export const price=items=>items.reduce((v,id)=>v+4+2**(id%10),0);
export function serve(s,i){
 const items=s.orders[i],used=items&&indices(s,items);if(!used)return false;
 const pay=price(items);used.forEach(j=>s.board[j]=null);s.money+=pay;s.xp+=pay;s.served++;
 while(s.level<balance.maxLevel&&s.xp>=goal(s.level)){s.xp-=goal(s.level++);s.energy=Math.min(100,s.energy+12);}
 s.orders[i]=order(s);return true;
}
export function travel(s,v){if(!venues[v]||s.level<venues[v].level||s.venue===v)return false;s.venue=v;s.orders=s.orders.map(()=>order(s));return true;}
