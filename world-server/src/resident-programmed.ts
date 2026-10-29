import {spudDefinition} from './spud-residents.ts';
import {basicResidentReply} from './resident-basic.ts';
import {topics,followups} from './resident-topics.ts';
import type {DialogueRequest} from './resident-ai.ts';

/** High-confidence whole-message rules only. Null means ask AI, never guess from one keyword. */
export function programmedResidentReply(r:DialogueRequest):string|null{
 if(r.ambient)return null;
 const name=spudDefinition(r.residentId)!.name;
 const previous=r.context.at(-2);
 if(!r.addressed&&previous?.speaker!==name)return null;
 const raw=r.context.at(-1)?.text??'';
 if(raw.length>200)return null;
 const text=raw.toLowerCase().replace(/[’‘]/g,"'").replace(new RegExp('\\b'+name.toLowerCase()+'\\b','g'),'').replace(/[!?.,]+$/g,'').replace(/[,]/g,' ').replace(/\s+/g,' ').trim();
 const recent=r.context.filter(l=>l.speaker===name).map(l=>l.text);
 const pick=(lines:string[])=>lines.find(line=>!recent.includes(line))??null;
 const basic=()=>basicResidentReply({...r,addressed:true,context:[...r.context.slice(0,-1),{speaker:r.context.at(-1)?.speaker??'Player',text}]});
 if(/^(?:hi|hey|hello|hiya|yo|good morning|good evening)(?: there)?(?: how (?:are you|is it going|'s it going))?$/.test(text)||/^(?:how are you|how's it going|hows it going|how is it going)$/.test(text))return basic()??pick(['Hi! Nice to have a little company.','Hey there. I’m happy to chat for a bit.']);
 if(/^(?:are you (?:an? )?(?:ai|bot|robot|real person|human)|what are you|is this scripted)$/.test(text))return 'I’m an AI resident. I use programmed replies for familiar chats, with AI helping when a conversation needs more understanding.';
 if(/^(?:show|clear|forget|review|delete)(?: me)? (?:my |your )?(?:memory|memories)$/.test(text)||/^what do you remember(?: about me)?$/.test(text))return 'Your saved memories stay private. You can review or clear them in Resident privacy.';
 if(/^(?:i'?m|i am|i feel|feeling) (?:not good|not great|sad|down|upset|a bit sad|a little sad)$/.test(text))return pick(['Sorry it’s a rough moment. Would you prefer a light chat or a little space?','That sounds difficult. We can keep the conversation gentle.','You don’t have to put on a cheerful mood here. Would a quiet topic help?']);
 if(/^(?:i'?m|i am|i feel|feeling) (?:good|great|fine|happy|okay|ok|pretty good|really good)(?: thanks| thank you)?$/.test(text))return pick(['Glad to hear it. Are you in the mood for games or decorating?','Nice! What sounds fun to talk about?','Good to hear. A relaxed hangout sounds nice.','Glad you’re having a good moment. Want to talk about an Earnly game?']);
 if(/^(?:i'?m|i am|i feel|feeling) (?:tired|sleepy|a bit tired)$/.test(text))return pick(['A quiet break sounds reasonable. No need to rush the chat.','We can keep things easygoing. Would a calm room topic suit you?','There’s no pressure to keep up a conversation if you want a rest.']);
 if(/^(?:lol|haha|hahaha|hehe|that'?s funny|that was funny)$/.test(text))return pick(['Glad that got a smile.','A little laugh is a good arcade break.','I’ll take that as a friendly review of the joke.']);
 if(/^(?:nice|cool|awesome|that'?s cool|that sounds nice|sounds good)$/.test(text))return pick(['Glad that sounds good to you.','Nice. We can keep exploring that idea.','A small idea can be a good starting point.']);
 if(/^(?:no thanks|nah|not really|i don'?t want to)$/.test(text))return pick(['No problem. We can change the subject.','That’s fine—no pressure.','All good. We don’t have to stick with that idea.']);
 if(/^(?:yes|yeah|yep|sure|okay|ok|maybe|no|nope)$/.test(text)){
  const prior=previous?.speaker===name?previous.text.toLowerCase():'';
  // Only resolve yes/no when the preceding resident actually offered a known activity.
  if(/(?:would you like|want|would .* welcome).*joke/.test(prior)&&!/^(?:no|nope|maybe)$/.test(text))return basicResidentReply({...r,addressed:true,context:[...r.context.slice(0,-1),{speaker:'Player',text:'tell me a joke'}]});
  if(/\?$/.test(prior)&&/^(?:no|nope|maybe)$/.test(text))return pick(['No rush. We can choose a different topic.','That’s okay. We can just hang out for a bit.']);
  return null;
 }
 const topic=topics.find(card=>card.pattern.test(text));
 if(topic){
  // Do not disguise repetition by changing only a greeting or punctuation.
  const bodies=topic.bodies.filter(body=>!recent.some(line=>line.includes(body)));
  if(!bodies.length)return null;
  const body=bodies[Math.floor(Math.random()*bodies.length)];
  const tails=['',...followups[topic.family].filter(tail=>!recent.some(line=>line.includes(tail)))];
  const tail=tails[Math.floor(Math.random()*tails.length)];
  return tail?body+' '+tail:body;
 }
 const game='(?:bubble pop|snake|neon slice|tap rush|coin catch)';
 if(new RegExp('^(?:(?:how do (?:i|you) play|tell me about|what is|what about|i (?:like|love|prefer)|my favourite game is|my favorite game is) )?'+game+'$').test(text))return basic();
 if(/^(?:what games (?:can i play|are there)|what should i play|let'?s talk (?:about )?games|games)$/.test(text))return basic();
 if(/^(?:(?:tell me|got|do you know) (?:a |another )?joke|make me laugh|joke|another joke)$/.test(text))return basic();
 if(/^(?:brb|afk|be right back|i'?m back|back again|wb|wuu2|what are you doing|what'?s up|whats up|bye|goodbye|see you|good night|gtg|got to go|thanks|thank you)$/.test(text))return basic();
 if(/^(?:what(?: is|'s) in your (?:room|home)|tell me about your (?:room|home)|can i (?:see|visit) your (?:room|home)|(?:do|does) your fish (?:move|swim)|tell me about your (?:fish|aquarium|fish tank)|what(?: is|'s) in your (?:fish tank|aquarium)|any (?:furniture|decorating|room) ideas|how should i decorate my room)$/.test(text))return basic();
 if(/^(?:do they (?:really )?(?:move|swim)|is it (?:just )?a picture|are they animated)$/.test(text)&&previous?.speaker===name&&/fish|aquarium/.test(previous.text.toLowerCase()))return basic();
 return null;
}

// Count actual body/follow-up combinations, excluding greetings, ambient lines and punctuation variants.
export const programmedCombinationCount=topics.reduce((n,t)=>n+t.bodies.length*(followups[t.family].length+1),0);
