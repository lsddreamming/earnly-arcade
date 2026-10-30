import type {DialogueRequest} from './resident-ai.ts';

type Voice='jax'|'blitz'|'mochi'|'zippy'|'default';
type Intent='relaxing'|'reaction'|'agreement'|'change';
export const casualLines:Record<Intent,Record<Voice,string[]>>={
 relaxing:{
  jax:['A strong doing-nothing strategy. Very difficult to overcomplicate.','Just chilling is a complete plan. No presentation required.','An uneventful moment. Finally, something I am qualified to supervise.'],
  blitz:['A break between rounds counts as a plan.','Low-pressure hangout mode. I can work with that.','No score to chase right now. We can just chat.'],
  mochi:['That sounds nice. We can keep things easygoing.','A quiet moment with a little company is enough.','No big topic needed. I’m happy to chat a little.'],
  zippy:['A little chill time! I can slow down for that.','Nothing major happening? We can keep it light.','Easygoing hangout it is. No rush to pick an activity.'],
  default:['Just hanging out is a perfectly good plan.','We can keep the chat relaxed.','A quiet break does not need a big agenda.']},
 reaction:{
  jax:['That definitely earned a pause in the conversation.','A small plot twist for our very low-budget talk show.','That is one way to keep a conversation interesting.'],
  blitz:['That gives us something to think about.','Worth a second look, for sure.','An interesting little twist.'],
  mochi:['Yeah, that part stands out to me too.','There is a bit more to it than it first seems.','It is the little details that make it interesting.'],
  zippy:['Right? That detail changes the whole idea.','That part caught my attention too!','Now we have something interesting to talk about.'],
  default:['That is an interesting part of it.','It does give the idea a different feel.','There is more to that detail than it first seems.']},
 agreement:{
  jax:['We have reached an agreement without forming a committee.','Two votes for that idea. A very efficient meeting.','A rare peaceful conclusion to an extremely important debate.'],
  blitz:['Sounds like we are on the same page.','That is a solid choice to build on.','We seem to favor the same approach.'],
  mochi:['Nice, we see that similarly.','It is good when an idea clicks for both people.','That sounds like a shared preference.'],
  zippy:['Same page! That makes the next choice easier.','Then we have a starting point!','That idea seems to fit both of us.'],
  default:['Sounds like we agree on that part.','That gives us a shared starting point.','We seem to see that similarly.']},
 change:{
  jax:['New topic. The imaginary meeting agenda has been dramatically revised.','Sure. That subject has left the stage.','Switching topics is free. Convenient for both of us.'],
  blitz:['Sure. We can switch gears.','Different topic, fresh start.','No problem. We do not have to stick to that subject.'],
  mochi:['Of course. We can leave that topic there.','That is fine. You can choose something else.','A change of subject is okay.'],
  zippy:['New topic it is! What are you in the mood for?','Sure! We can go in a different direction.','Let’s switch it up. Games, music, or something else?'],
  default:['Sure. What would you rather talk about?','We can change the subject.','No problem. Pick a different topic whenever you like.']}
};
export const casualAuthoredLines=Object.values(casualLines).flatMap(voices=>Object.values(voices).flat());
export const isCasualBridge=(text:string)=>[...Object.values(casualLines.reaction).flat(),...Object.values(casualLines.agreement).flat()].includes(text);
/** Whole-message social cues only; never flatten a mixed or sensitive message to a keyword. */
export function casualResidentReply(r:DialogueRequest,text:string,knownTopic=false):string|null{
 let intent:Intent|undefined;
 if(/^(?:not much|nothing much|nm|just chilling|just chillin|chilling|chillin|just hanging out|just relaxing|same old|nothing really|i(?:'m| am|m) just (?:chilling|chillin|relaxing|hanging out))$/.test(text))intent='relaxing';
 else if(/^(?:change (?:the )?(?:topic|subject)|let'?s (?:change (?:the )?(?:topic|subject)|talk about something else)|something else please|new topic please)$/.test(text))intent='change';
 else if(knownTopic&&/^(?:that'?s crazy|that is crazy|wow|oh wow|no way|really|for real|wild|that'?s wild)$/.test(text))intent='reaction';
 else if(knownTopic&&/^(?:same|same here|me too|yeah same|i agree|agreed|true|fair|fair enough|exactly)$/.test(text))intent='agreement';
 if(!intent)return null;
 const voice:Voice=['jax','blitz','mochi','zippy'].includes(r.residentId)?r.residentId as Voice:'default';
 const recent=[...r.context.map(l=>l.text),...(r.avoidReplies??[])];
 const options=casualLines[intent][voice].filter(line=>!recent.includes(line));
 return options.length?options[Math.floor(Math.random()*options.length)]:null;
}
export const fallbackGapNames=['short_followup','casual_phrase','topic_request','game_question','room_question','other'] as const;
export type FallbackGap=typeof fallbackGapNames[number];
/** Fixed labels only. Do not store message text, names, topics, or player identifiers. */
export function fallbackGap(text:string):FallbackGap{
 const normalized=text.toLowerCase().replace(/[’‘]/g,"'").replace(/[!?.,]+$/g,'').trim();
 if(/^(?:why|how come|really|what about you|and you|wbu|hbu|yes|no|maybe|tell me more)$/.test(normalized))return 'short_followup';
 if(/^(?:not much|nm|just chilling|same|same here|that'?s crazy|lol|idk|fair enough)$/.test(normalized))return 'casual_phrase';
 if(/^(?:let'?s talk about|tell me about|what do you think (?:of|about)|do you like) /.test(normalized))return 'topic_request';
 if(/^(?:how|what|why|can|does|is)\b/.test(normalized)&&/\b(?:snake|bubble pop|tap rush|neon slice|coin catch|game)\b/.test(normalized))return 'game_question';
 if(/^(?:how|what|why|can|does|is)\b/.test(normalized)&&/\b(?:room|furniture|chair|sofa|decorat\w*)\b/.test(normalized))return 'room_question';
 return 'other';
}
