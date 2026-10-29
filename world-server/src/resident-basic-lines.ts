import type {SpudId} from './spud-residents.ts';

export const greetings:Record<SpudId,string[]>={
 jax:['Hey! Doing well—taking a break from my very demanding career in potato jokes.','Good to see you! I’ve got a joke ready if you need one.','Hey hey. Just giving my comedy career a little sitting-down time.','o/ Nice to see you. The jokes are optional; the awkward pause is free.'],
 blitz:['Hey! Doing well and ready to talk games. What are you playing?','Hey there! Taking a little arcade break.','o/ How’s it going? I’m always up for some game talk.','Hey! A calm moment between games is part of the strategy.'],
 mochi:['Hi! I’m doing well. It’s nice to have someone to chat with.','Hey, it’s nice to see you. I’m enjoying a quiet moment.','Hi there. No rush—we can just hang out for a bit.','o/ A little wave felt easier than a big entrance. How are you?'],
 zippy:['Hey! Doing great—always happy to have some company!','Hi there! I’m ready for a chat and a little dance break.','o/ Hey! Games, furniture, or just hanging out—what sounds good?','Hi! I’ve got plenty of enthusiasm and absolutely no hurry.'],
 fern:['Hi! Doing well. A little greenery always puts me in a good mood.','o/ Nice to see you. Want to talk plants or room ideas?','Hey there. I’m enjoying a peaceful little break.','Hi! A cozy room and a good chat sound lovely.'],
 nova:['Hi! Doing well. I’m in a daydreaming kind of mood.','o/ Nice to see you. I like a room with a little sparkle.','Hey there. Taking a quiet moment to let my thoughts wander.','Hi! Sometimes a simple hello is a good place to start.'],
 pip:['Hey! Doing well. I’m thinking about colors and little room details.','o/ Nice to see you. Got any decorating ideas?','Hi! Mixing a few colors can be a whole afternoon of fun.','Hey there. I’m taking a creative little break.'],
 rio:['Hey! Doing well. Just enjoying the rhythm of the room.','o/ Good to see you. A little chat is always welcome.','Hi there. I’m in the mood for a relaxed hangout.','Hey! A seat, a chat, maybe a dance break later.'],
 sage:['Hello! Doing well. I’m enjoying a thoughtful little pause.','o/ Nice to see you. There’s no hurry here.','Hi there. A quiet conversation sounds nice.','Hello! I’m happy to talk games or cozy room ideas.'],
 bea:['Hey! Doing well. Little furniture details always catch my eye.','o/ Nice to see you. I like hearing room ideas.','Hi! There’s something satisfying about finding the right finishing touch.','Hey there. Taking a little break from thinking about decor.']
};
export const jokes:Partial<Record<SpudId,string[]>>={
 jax:['Why did the Spud bring a ladder? To reach the next level.','I tried to organize my jokes by quality. Now they’re all in the same tiny drawer.','My sofa and I have a lot in common. Mostly sitting around.','A potato’s favorite kind of room? One with plenty of mash-up potential.','My comedy timing is excellent. My clock disagrees.','I asked a chair for advice. It told me to take a seat.'],
 blitz:['My warm-up round needed its own warm-up round.','My strategy has three steps: focus, breathe, remember what step three was.','Even a good game plan needs a snack-break-sized pause.','I call it tactical sitting. It looks exactly like regular sitting.'],
 mochi:['I practiced saying “hi” three times. I think that counts as a combo.','My ideal surprise party comes with a very small surprise.','I told a plant a joke. Tough crowd, but a good listener.','I like quiet jokes. They give everyone a little room to smile.'],
 zippy:['My dance moves have two settings: enthusiastic and even more enthusiastic.','I scheduled a tiny dance break. The dance forgot to stay tiny.','I tried to sit still. Very exciting experiment.','I’ve got a plan! First, remember the plan.']
};
export const gameReplies:[RegExp,string[]][]=[
 [/\bbubble pop\b/,['Bubble Pop is about matching three, clearing levels, and earning stars.','With Bubble Pop, I like looking for a match before rushing into the next move.','Matching three is the heart of Bubble Pop. A little planning can help.','Bubble Pop is a nice choice when you feel like a colorful matching puzzle.']],
 [/\bsnake\b/,['In Snake, plan your turns and leave yourself space to avoid collisions.','For Snake, think about where your next turn will leave you.','A little open space can save a Snake run. Watch for places that could box you in.','Snake rewards keeping an eye on the path ahead, not just the tile in front of you.']],
 [/\bneon slice\b/,['Neon Slice is about slicing food while avoiding bombs.','For Neon Slice, spot the food first and leave the bombs alone.','A careful swipe is useful in Neon Slice. Not everything on screen should be sliced.','Neon Slice is a good choice if you like quick reactions and careful aim.']],
 [/\btap rush\b/,['Tap Rush has green circles to tap quickly. Missed taps add a time penalty.','In Tap Rush, look for the green circles and keep your taps accurate.','Tap Rush is a balance of speed and accuracy; rushing a missed tap costs time.','Those green circles are the targets in Tap Rush. Take a short breather if your aim gets rushed.']],
 [/\bcoin catch\b/,['Coin Catch is about catching falling coins.','With Coin Catch, keep an eye on where the falling coins are headed.','Coin Catch is a simple idea: follow the falling coins and try to catch them.','Coin Catch sounds good for a quick arcade break.']]
];
