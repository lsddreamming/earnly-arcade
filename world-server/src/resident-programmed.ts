import {spudDefinition} from './spud-residents.ts';
import {basicResidentReply} from './resident-basic.ts';
import {topics,followups} from './resident-topics.ts';
import type {DialogueRequest} from './resident-ai.ts';

/** High-confidence whole-message rules only. Null means ask AI, never guess from one keyword. */
export function programmedResidentReply(r:DialogueRequest):string|null{
 if(r.ambient)return null;
 const name=spudDefinition(r.residentId)!.name;
 const previous=r.context.at(-2);
 if(!r.addressed&&!r.engaged&&previous?.speaker!==name&&!/^(?:does anyone know|anyone know|can anyone|hey everyone|hi everyone|hello everyone)\b/i.test(r.context.at(-1)?.text??''))return null;
 const raw=r.context.at(-1)?.text??'';
 if(raw.length>200)return null;
 let text=raw.toLowerCase().replace(/[’‘]/g,"'").replace(new RegExp('\\b'+name.toLowerCase()+'\\b','g'),'').replace(/[!?.,]+$/g,'').replace(/[,]/g,' ').replace(/\s+/g,' ').trim();
 text=text.replace(/^(hi|hey|hello) everyone$/, '$1').replace(/^(?:does anyone know|anyone know) how to play /,'how do i play ');
 if(text==='hru'||text==='how r u')text='how are you';
 if(text==='wyd')text='what are you doing';
 const recent=[...r.context.filter(l=>l.speaker===name).map(l=>l.text),...(r.avoidReplies??[]).slice(-12)];
 const pick=(lines:string[])=>lines.find(line=>!recent.includes(line))??null;
 const basic=()=>basicResidentReply({...r,addressed:true,context:[...r.context.slice(0,-1),{speaker:r.context.at(-1)?.speaker??'Player',text}]});
 if(/^(?:hi|hey|hello|hiya|yo|good morning|good evening)(?: there)?(?: how (?:are you|is it going|'s it going))?$/.test(text)||/^(?:how are you|how's it going|hows it going|how is it going)$/.test(text))return basic()??pick(['Hi! Nice to have a little company.','Hey there. I’m happy to chat for a bit.']);
 if(/^(?:are you (?:an? )?(?:ai|bot|robot|real person|human)|what are you|is this scripted)$/.test(text))return 'I’m an AI resident. I use programmed replies for familiar chats, with AI helping when a conversation needs more understanding.';
 if(/^(?:can you hear me|can you hear me from (?:here|over here)|am i close enough|can we talk from here)$/.test(text))return 'Yes, I can hear you here. We can use public room chat without moving closer.';
 if(/^(?:what(?: is|'s) your name|who are you)$/.test(text))return `I’m ${name}, an AI resident in Earnly World. Nice to meet you.`;
 if(/^(?:how old are you|what(?: is|'s) your age|where are you from)$/.test(text))return 'I’m an AI resident in Earnly World, so I don’t have a human age or hometown.';
 if(/^(?:are we friends|can we be friends|will you be my friend)$/.test(text))return 'You can add me as an AI resident friend from my profile. Our chats stay here in Earnly World.';
 if(/^(?:what(?: is|'s) your favou?rite game|what game do you like|what do you like to play)$/.test(text)){
  const favorites:Record<string,string>={jax:'Bubble Pop',blitz:'Snake',mochi:'Bubble Pop',zippy:'Tap Rush',fern:'Coin Catch',nova:'Bubble Pop',pip:'Neon Slice',rio:'Tap Rush',sage:'Snake',bea:'Coin Catch'};
  return `I’d pick ${favorites[r.residentId]}. Which Earnly game do you like?`;
 }
 if(/^(?:what(?: is|'s) your favou?rite colou?r|what colou?r do you like)$/.test(text)){
  const colors:Record<string,string>={jax:'warm orange',blitz:'blue',mochi:'soft lavender',zippy:'bright green',fern:'leafy green',nova:'deep purple',pip:'pink',rio:'golden orange',sage:'sage green',bea:'warm yellow'};
  return `I like ${colors[r.residentId]} for a room idea. What color would you choose?`;
 }
 if(/^(?:what do you like|what do you do for fun|what are your hobbies)$/.test(text)){
  const interests:Record<string,string>={jax:'playful jokes and silly room ideas',blitz:'friendly game challenges and a little strategy talk',mochi:'quiet chats and cozy room ideas',zippy:'dance breaks and energetic game talk',fern:'plants and peaceful garden ideas',nova:'starry room themes and a little daydreaming',pip:'colors and creative decorating ideas',rio:'music ideas and dance breaks',sage:'stories and thoughtful little puzzles',bea:'interesting furniture details and room themes'};
  return `I enjoy ${interests[r.residentId]}. What do you like talking about?`;
 }
 if(/^(?:show|clear|forget|review|delete)(?: me)? (?:my |your )?(?:memory|memories)$/.test(text)||/^what do you remember(?: about me)?$/.test(text))return 'Your saved memories stay private. You can review or clear them in Resident privacy.';
 if(/^(?:i'?m|i am|i feel|feeling) (?:not good|not great|sad|down|upset|a bit sad|a little sad)$/.test(text))return pick(['Sorry it’s a rough moment. Would you prefer a light chat or a little space?','That sounds difficult. We can keep the conversation gentle.','You don’t have to put on a cheerful mood here. Would a quiet topic help?']);
 if(/^(?:i'?m|i am|i feel|feeling) (?:good|great|fine|happy|okay|ok|pretty good|really good)(?: thanks| thank you)?$/.test(text))return pick(['Glad to hear it. Are you in the mood for games or decorating?','Nice! What sounds fun to talk about?','Good to hear. A relaxed hangout sounds nice.','Glad you’re having a good moment. Want to talk about an Earnly game?']);
 if(/^(?:i'?m|i am|i feel|feeling) (?:tired|sleepy|a bit tired)$/.test(text))return pick(['A quiet break sounds reasonable. No need to rush the chat.','We can keep things easygoing. Would a calm room topic suit you?','There’s no pressure to keep up a conversation if you want a rest.']);
 if(/^(?:lol|haha|hahaha|hehe|that'?s funny|that was funny)$/.test(text))return pick(['Glad that got a smile.','A little laugh is a good arcade break.','I’ll take that as a friendly review of the joke.']);
 if(/^(?:nice|cool|awesome|that'?s cool|that sounds nice|sounds good|same|me too|yeah same|fair|true|nice one)$/.test(text))return pick(['Glad that sounds good to you.','Nice. We can keep exploring that idea.','A small idea can be a good starting point.']);
 if(/^(?:no thanks|nah|not really|i don'?t want to)$/.test(text))return pick(['No problem. We can change the subject.','That’s fine—no pressure.','All good. We don’t have to stick with that idea.']);
 if(/^(?:yes|yeah|yep|sure|okay|ok|maybe|no|nope)$/.test(text)){
  const prior=previous?.speaker===name?previous.text.toLowerCase():'';
  // Only resolve yes/no when the preceding resident actually offered a known activity.
  if(/(?:would you like|want|would .* welcome).*joke/.test(prior)&&!/^(?:no|nope|maybe)$/.test(text))return basicResidentReply({...r,addressed:true,context:[...r.context.slice(0,-1),{speaker:'Player',text:'tell me a joke'}]});
  if(/\?$/.test(prior)&&/^(?:no|nope|maybe)$/.test(text))return pick(['No rush. We can choose a different topic.','That’s okay. We can just hang out for a bit.']);
  return null;
 }
 const query=text.match(/^(?:what do you think (?:about|of)|tell me about|let'?s talk about|can we talk about|i (?:really )?(?:like|love|prefer)|my favou?rite(?: food|colou?r|hobby|genre|thing)? is) (.+)$/);
 const candidates=query?[text,query[1],'i like '+query[1]]:[text];
 const topic=topics.find(card=>candidates.some(candidate=>card.pattern.test(candidate)));
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
