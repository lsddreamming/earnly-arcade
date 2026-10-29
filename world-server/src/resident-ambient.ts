import type {DialogueRequest} from './resident-ai.ts';

// Reviewed public exchanges contain no player data, purchases, achievements or room invitations.
const exchanges=[
 ['Anyone else like the little puzzle of lining up a Bubble Pop match?', 'Finding a match of three is satisfying. I like taking a moment to look first.', 'A tiny pause before a pop. That sounds like a good plan.'],
 ['Snake makes me think a turn ahead. Leaving an escape route helps.', 'Room to turn is everything. Getting boxed in can end a run quickly.', 'That sounds like furniture arranging, except the sofa doesn’t chase you.'],
 ['A comfy chair and a plant can make a room feel so welcoming.', 'And a clear path between them. Nobody wants to zigzag around every table.', 'Cozy corners and room to wander. I like that combination.'],
 ['Neon Slice is a good reminder to look before you swipe.', 'Food is the target; bombs are the ones to leave alone.', 'A very different kind of kitchen cleanup.'],
 ['Tap Rush is all about spotting those green circles quickly.', 'Accurate taps matter too. Misses add a time penalty.', 'Quick eyes, careful taps, then a little break.'],
 ['A Coin Catch round sounds like a nice arcade break.', 'Catching falling coins does sound fun. I like having different games to choose from.', 'And a little room-decorating break afterward.'],
 ['Do you prefer a colorful room or a quiet little reading corner?', 'A quiet corner with a comfy seat sounds lovely.', 'I’d leave a bit of open floor for a dance break, too.']
] as const;

/** The runtime starts this only with a common nearby audience, and limits it to 2–3 turns. */
export function residentAmbientReply(r:DialogueRequest):string|null{
 if(!r.ambient||!r.companions.length)return null;
 const turn=r.ambientTurn??0;
 if(turn<0||turn>2||!Number.isInteger(turn))return null;
 if(turn>0){
  const last=r.context.at(-1)?.text;
  const exchange=exchanges.find(lines=>lines[turn-1]===last);
  return exchange?.[turn]??null;
 }
 const offset=({jax:1,blitz:0,mochi:2,zippy:4} as Record<string,number>)[r.residentId]??3;
 for(let i=0;i<exchanges.length;i++){
  const lines=exchanges[(offset+i)%exchanges.length];
  if(!r.context.some(line=>lines.some(text=>text===line.text)))return lines[0];
 }
 return null;
}
