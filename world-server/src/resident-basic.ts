import {spudDefinition} from './spud-residents.ts';
import type {DialogueRequest} from './resident-ai.ts';
import {greetings,jokes,gameReplies} from './resident-basic-lines.ts';

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
  return home?.animatedFish?choose(['My aquarium has animated fish and bubbles. They really move; Reduce Motion can make the animations quieter.','The fish and bubbles are animated, rather than a still picture.','The aquarium has moving fish and bubbles. It’s a lovely little detail to watch.','Yes, the fish move! Accessibility settings can reduce their animation.']):'I can’t confirm an aquarium in my room right now.';
 }
 if(/\b(visit|see|show)\b/.test(latest)&&(/\b(room|home|place)\b/.test(latest)||/\b(room|aquarium)\b/.test(prior))){
  return home?(r.inOwnHome?'You’re already in my room—feel free to look around!':'You can open my profile and choose Visit room whenever you like.'):'My room details aren’t available right now.';
 }
 if(/\b(room|home|furniture|decorat\w*|sofa|chair|plant)\b/.test(latest)){
  if(home&&/\b(your|you|here)\b/.test(latest))return choose([`My room is ${home.name.slice(0,40)}. It has ${home.items.slice(0,2).map(s=>s.slice(0,64)).join(' and ')}.`,`You can see my room’s furnishings under About my room in my profile.`]);
  return choose(['A comfy seat, a plant, and clear walking space make a nice start for a cozy room.','I like leaving a little space between furniture so everyone can move around.','Picking a couple of colors first can help different pieces of furniture feel like they belong together.','A little open floor makes a room feel easier to explore.','One interesting corner can be enough; every tile doesn’t need furniture.','I like a mix of seating, a little greenery, and something fun to look at.']);
 }
 const game=gameReplies.find(([pattern])=>pattern.test(latest));
 if(game)return choose(game[1]);
 if(/\b(games?|play|favorite)\b/.test(latest))return choose(['You can play Bubble Pop, Snake, Neon Slice, Tap Rush, and Coin Catch in Earnly.','A short game and a little decorating make a nice arcade break.','For a puzzle mood, there’s Bubble Pop. For a careful-turns mood, there’s Snake.','Neon Slice and Tap Rush are good topics if you like talking quick reactions.','I like that there’s room for both playing games and just hanging out.']);
 if(/\b(joke|funny|laugh)\b/.test(latest))return choose(jokes[r.residentId]??['Why did the Spud bring a ladder? To reach the next level.','I told a chair a joke. It was a sitting ovation.','My decorating plan is very detailed. The first detail is making a plan.']);
 if(/\b(brb|afk|be right back)\b/.test(latest))return choose(['No rush—catch you when you’re back.','All good. Enjoy your break!','BRB breaks are part of a good hangout.']);
 if(/\b(wb|i.?m back|back again)\b/.test(latest))return choose(['WB! Ready to hang out a little?','Welcome back. Games or a bit of room chat?','Hey, WB! Hope your break was nice.']);
 if(/\b(wuu2|what are you doing|what.?s up|whats up)\b/.test(latest))return choose(['Just hanging out and taking a little arcade break.','A bit of room chat sounds good right now.','Thinking about games and cozy little corners.']);
 if(/\b(bye|goodbye|see you|good night|gtg|got to go)\b/.test(latest))return choose(['See you around Earnly World!','Catch you later. Thanks for stopping by.','Take care! Have a good rest of your day.','Bye for now. Enjoy your next arcade visit!']);
 if(/\b(thanks|thank you)\b/.test(latest))return choose(['You’re welcome!','Happy to help.','Any time—glad we could chat.']);
 if(/\b(hi|hey|hello|how are you|how’s it going|hows it going|how is it going)\b/.test(latest)){
  return choose(greetings[r.residentId]);
 }
 return choose(['I’m in basic chat mode until my AI allowance resets. I can still chat a little about games and decorating!','My scripted replies are a little limited right now. Full AI conversation will return when my allowance resets.']);
}
