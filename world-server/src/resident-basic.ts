import {spudDefinition} from './spud-residents.ts';
import type {DialogueRequest} from './resident-ai.ts';

/** Budget-only, controlled public replies. Never reads private memory or echoes player text. */
export function basicResidentReply(r:DialogueRequest):string|null{
 if(r.ambient)return null;
 const name=spudDefinition(r.residentId)!.name;
 const latest=r.context.at(-1)?.text.toLowerCase().trim()??'';
 const previous=r.context.at(-2);
 if(!latest||(!r.addressed&&previous?.speaker!==name))return null;
 const home=r.home?.residentId===r.residentId?r.home:undefined;
 const prior=previous?.speaker===name?previous.text.toLowerCase():'';
 const choose=(lines:string[])=>lines.find(text=>!r.context.some(line=>line.speaker===name&&line.text===text))??null;
 if(/\b(remember|memory|private|secret|dm|personal information)\b/.test(latest))return 'Private memories stay private. You can review or clear yours in Resident privacy.';
 if(/\b(ai|bot|robot|scripted|real person|human)\b/.test(latest))return 'I’m an AI resident. My AI chat allowance is used up, so I’m using basic scripted replies for now.';
 if(/\b(fish|aquarium|tank)\b/.test(latest)||(/\b(move|moving|animated|picture|swim)\b/.test(latest)&&/\b(fish|aquarium)\b/.test(prior))){
  return home?.animatedFish?choose(['My aquarium has animated fish and bubbles. They really move; Reduce Motion can make the animations quieter.','The fish and bubbles are animated, rather than a still picture.']):'I can’t confirm an aquarium in my room right now.';
 }
 if(/\b(visit|see|show)\b/.test(latest)&&(/\b(room|home|place)\b/.test(latest)||/\b(room|aquarium)\b/.test(prior))){
  return home?(r.inOwnHome?'You’re already in my room—feel free to look around!':'You can open my profile and choose Visit room whenever you like.'):'My room details aren’t available right now.';
 }
 if(/\b(room|home|furniture|decorat\w*|sofa|chair|plant)\b/.test(latest)){
  if(home&&/\b(your|you|here)\b/.test(latest))return choose([`My room is ${home.name.slice(0,40)}. It has ${home.items.slice(0,2).map(s=>s.slice(0,64)).join(' and ')}.`,`You can see my room’s furnishings under About my room in my profile.`]);
  return choose(['A comfy seat, a plant, and clear walking space make a nice start for a cozy room.','I like leaving a little space between furniture so everyone can move around.']);
 }
 const games:[RegExp,string][]=[
  [/\bbubble pop\b/,'Bubble Pop is about matching three, clearing levels, and earning stars.'],
  [/\bsnake\b/,'In Snake, plan your turns and leave yourself space to avoid collisions.'],
  [/\bneon slice\b/,'Neon Slice is about slicing food while avoiding bombs.'],
  [/\btap rush\b/,'Tap Rush has green circles to tap quickly. Missed taps add a time penalty.'],
  [/\bcoin catch\b/,'Coin Catch is about catching falling coins.']
 ];
 const game=games.find(([pattern])=>pattern.test(latest));
 if(game)return choose([game[1]]);
 if(/\b(games?|play|favorite)\b/.test(latest))return choose(['You can play Bubble Pop, Snake, Neon Slice, Tap Rush, and Coin Catch in Earnly.','A short game and a little decorating make a nice arcade break.']);
 if(/\b(joke|funny|laugh)\b/.test(latest))return choose(['Why did the Spud bring a ladder? To reach the next level.','My warm-up round needed its own warm-up round.']);
 if(/\b(bye|goodbye|see you|good night)\b/.test(latest))return 'See you around Earnly World!';
 if(/\b(thanks|thank you)\b/.test(latest))return 'You’re welcome!';
 if(/\b(hi|hey|hello|how are you|how’s it going|hows it going|how is it going)\b/.test(latest)){
  const greetings:Record<string,string[]>={
   jax:['Hey! Doing well—taking a break from my very demanding career in potato jokes.','Good to see you! I’ve got a joke ready if you need one.'],
   blitz:['Hey! Doing well and ready to talk games. What are you playing?','Hey there! Taking a little arcade break.'],
   mochi:['Hi! I’m doing well. It’s nice to have someone to chat with.','Hey, it’s nice to see you. I’m enjoying a quiet moment.'],
   zippy:['Hey! Doing great—always happy to have some company!','Hi there! I’m ready for a chat and a little dance break.']
  };
  return choose(greetings[r.residentId]??['Hi! It’s nice to see you here.','Hey there! Enjoying a little break in Earnly World.']);
 }
 return choose(['I’m in basic chat mode until my AI allowance resets. I can still chat a little about games and decorating!','My scripted replies are a little limited right now. Full AI conversation will return when my allowance resets.']);
}
