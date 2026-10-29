import {spudDefinition} from './spud-residents.ts';
import type {SpudId} from './spud-residents.ts';
export function residentGreeting(id:SpudId){return ({jax:'Hey! Taking a couch-potato break?',blitz:'Hey! Good luck with your next run.',mochi:'Oh… hi. Nice to see you.',zippy:'Hey! Hope you’re having fun exploring!'} as Record<string,string>)[id]??'Hello! Nice to see you around.';}
export type ResidentMemory={friend:boolean;remember:boolean;visits:number;favoriteGame?:string;topics?:string[];roomVisits?:string[];achievements?:{game:string;score:string}[]};
export function residentReply(id:SpudId,topic:string,memory?:ResidentMemory,furniture?:string){
 const d=spudDefinition(id)!;
 const lines:Record<string,Record<string,string>>={
  jax:{hello:'Jax here. A potato walked into an arcade… and forgot why. That was me.',games:'My high score is mostly confidence. What do you like playing?',room:'I’m testing these seats for maximum couch-potato potential.',joke:'Why did the Spud bring a ladder? To reach the next level.',bye:'Catch you later. I’ll be here working on my material.'},
  blitz:{hello:'Blitz here. Taking a breather between games. Ready for your next personal best?',games:'Chasing your own best score is the real competition. Which game is your favorite?',room:'Good room layout. Plenty of space to plan the next challenge.',joke:'My warm-up round needed its own warm-up round.',bye:'Good luck with your next run!'},
  mochi:{hello:'Oh… hi. I’m Mochi. It’s nice to have a quiet place to hang out.',games:'I like taking my time with games. Do you have a favorite?',room:'I’m looking for a cozy corner. The little details make a room feel welcoming.',joke:'I practiced saying “hi” three times. I think that counts as a combo.',bye:'See you around… it was nice chatting.'},
  zippy:{hello:'Hey! I’m Zippy! Just exploring, dancing, and seeing what’s new.',games:'One more game, then a dance break! What’s your favorite?',room:'I’m doing a tiny room tour. So much to look at!',joke:'My dance moves are all hot potato. Very on-brand!',bye:'See you next time! Time for another little wander.'}
 };
 if(topic==='welcome'&&memory?.remember&&memory.visits>0)return `Welcome back! ${memory.favoriteGame?'I remember you like '+memory.favoriteGame+'.':'Nice to see you again.'}`;
 if(topic==='room'&&furniture)return ({jax:`That ${furniture} has excellent couch-potato energy.`,blitz:`That ${furniture} looks like a good place for a post-game break.`,mochi:`I like your ${furniture}… it makes this space feel cozy.`,zippy:`Ooh, your ${furniture}! Great room-tour find!`} as Record<string,string>)[id]??`I noticed your ${furniture}. Nice detail!`;
 if(topic==='games'&&memory?.remember&&memory.achievements?.length){const a=memory.achievements[0];return `I remember your ${a.game} score of ${a.score}. ${memory.favoriteGame?'Your favorite is '+memory.favoriteGame+'.':'Which game is your favorite?'}`;}
 if(topic==='memory')return memory?.remember?`You can inspect and forget everything I remember in Resident privacy. ${memory.favoriteGame?'Your saved favorite game is '+memory.favoriteGame+'.':'I haven’t saved a favorite game yet.'}`:'Memory is off. Our conversation stays in this session.';
 return lines[id]?.[topic]??(topic==='games'?`I’m ${d.name}, the ${d.personality} Spud. What game do you enjoy?`:topic==='bye'?'See you around Earnly World!':`I’m ${d.name}, a ${d.personality} Spud. I like exploring the room at my own pace.`);
}
type State={quiet:boolean;next:number;residents:Map<string,number>;lastChat:number;seen:number};
/** Shared across runtimes: one greeting per player per 3 min AND one per room per
 * 30s, plus a 10–15 min per-resident/player cooldown. Server clock only.
 */
export class NaturalSocial{
 #players=new Map<string,State>();#rooms=new Map<string,number>();#random:()=>number;
 constructor(random:()=>number=Math.random){this.#random=random;}
 #state(user:string,now:number){let s=this.#players.get(user);if(!s){if(this.#players.size>=2000){const oldest=this.#players.keys().next().value!;this.#players.delete(oldest);}s={quiet:false,next:now+30000+this.#random()*60000,residents:new Map(),lastChat:-Infinity,seen:now};this.#players.set(user,s);}s.seen=now;return s;}
 setQuiet(user:string,quiet:boolean,now:number){this.#state(user,now).quiet=quiet;}
 ready(user:string,room:string,now:number){const s=this.#state(user,now);return !s.quiet&&now>=s.next&&now>=(this.#rooms.get(room)??0);}
 quiet(user:string,now:number){return this.#state(user,now).quiet;}
 greeting(user:string,room:string,resident:SpudId,now:number){
  const s=this.#state(user,now);if(s.quiet||now<s.next||now<(s.residents.get(resident)??0)||now<(this.#rooms.get(room)??0))return false;
  s.next=now+180000;s.residents.set(resident,now+600000+this.#random()*300000);
  if(this.#rooms.size>=1000)this.#rooms.delete(this.#rooms.keys().next().value!);this.#rooms.set(room,now+30000);return true;
 }
 chat(user:string,now:number){const s=this.#state(user,now);if(now-s.lastChat<2000)throw new Error('Give this AI resident a moment to reply');s.lastChat=now;}
}

/** Public replies never receive private memories or repeat a player's input. */
export function publicResidentTopic(text:string){
 const t=text.toLowerCase();
 if(/\b(bye|goodbye|later)\b/.test(t))return 'bye';
 if(/\b(remember|memory|forget)\b/.test(t))return 'memory';
 if(/\b(joke|funny|laugh)\b/.test(t))return 'joke';
 if(/\b(game|games|favorite|play|playing|score|snake|bubble|arcade|tap rush|neon slice)\b/.test(t))return 'games';
 if(/\b(room|rooms|furniture|sofa|couch|chair|decorate|decorating)\b/.test(t))return 'room';
 if(/\b(hi|hey|hello|how are you|what.s up)\b/.test(t))return 'hello';
 return 'other';
}
export function publicResidentReply(id:SpudId,topic:string,turn:number){
 if(topic==='memory')return 'Saved memories are private. You can inspect or change them from my profile.';
 if(topic==='other')return ['I’m a scripted resident, so games, rooms and little jokes are my best topics.','Anyone nearby can join in. What have you been playing?'][turn%2];
 if(turn%2===0||topic==='bye')return residentReply(id,topic);
 const d=spudDefinition(id)!;
 if(topic==='hello')return ({jax:'Hey, everyone! Is this a hangout or a very relaxed potato convention?',blitz:'Hey! Anyone chasing a personal best today?',mochi:'Hi… it’s nice having a little group to talk with.',zippy:'Hey, nearby Spuds! Game break or dance break?'} as Record<string,string>)[id]??`Hey, everyone! ${d.name} here. How’s your arcade day going?`;
 if(topic==='games')return ({jax:'My best strategy is looking confident while pressing the wrong button.',blitz:'Pick one game and try to beat your own best. Anyone can join the challenge.',mochi:'A game feels more fun when there’s no rush… and someone to chat with after.',zippy:'One quick round, then everyone gets a victory dance!'} as Record<string,string>)[id]??'What’s more your style: a quick arcade round or decorating a cozy room?';
 if(topic==='room')return 'A few cozy seats and clear walking space make a good place for a group chat.';
 return 'Why are potatoes good at arcade games? They always bring their best mash-up of moves.';
}
export function residentExchange(first:SpudId,second:SpudId,round:number){
 const b=spudDefinition(second)!;
 const pairs=[
  [`${b.name}, game break or dance break?`,'One quick game, then a little dance break. Anyone nearby can join!'],
  [`${b.name}, what makes a hangout feel cozy?`,'A good seat, a little space, and some friendly conversation.'],
  [`${b.name}, I’m taking a couch-potato break.`,'That sounds like a very professional potato activity.'],
  [`${b.name}, ready for another arcade round?`,'Always happy to try a new personal best. What’s everyone playing?']
 ];return pairs[round%pairs.length];
}
