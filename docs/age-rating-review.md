# Age-rating review — 2026-11-08

## Release boundary

App Store version 1.12 build 1002 was submitted with the previous Harbor mechanics and the existing 18+ questionnaire. Do not lower its rating based on this branch. A replacement native build must contain these changes, pass the release checklist, and be checked on an iPhone before reassessing the questionnaire. Regional ratings and Apple's review determine the final result; 13+ is a target, not an approved rating.

## Findings and changes

- Harbor previously allowed repeated gunfire at human pedestrians, vehicle impacts with ragdolls, and explosive vehicle damage affecting nearby people. These were substantive reasons to review realistic violence, even without blood.
- Pulse tags now produce sparkle feedback without reducing pedestrian health or knocking them down. Moving vehicles brake before approaching bystanders, including drivers who have stepped out. Vehicle shields temporarily recharge without explosion, fire, or nearby injury.
- Recorded gunshots and screams have been removed from the packaged audio. Original sine-wave pulse/pop tones replace them; real engine and brake recordings remain.
- Vehicle borrowing no longer triggers forced ejection or a crime alert. The driver steps out upright. Missions describe a rally and chase-tag, with colorful marshal vehicles and quieter musical cues. Existing job IDs/names are retained for server and save compatibility.
- Optional live combat is presented as pulse-tag with shields and round resets. Server-side hit validation, reward limits and account controls are unchanged. Do not describe the entire app as containing no combat or weapons.
- Native rewarded advertising now requests a maximum ParentalGuidance content rating. ATT, UMP consent and existing non-child-directed settings are unchanged. This is not age verification and is not a Kids Category declaration.

## Other app content reviewed

- Neon Breach uses robot-wave arena combat; Crystal Command contains stylized strategy battles. Continue to declare frequent cartoon/fantasy violence and weapons rather than zero violence.
- Arcade competitions still justify frequent contests. Purchased randomized collectible packs still require the loot-box declaration. Coins and items have no real-money redemption; the current no-gambling declaration must not be interpreted as no randomized purchases.
- Arcade chat has server-side report/block/rules acceptance and text filtering, documented in `docs/arcade-chat.md`. World AI residents use public chat, input/output moderation and a no-sexual-content prompt (`world-server/src/resident-ai.ts`, `docs/world-ai-residents.md`). This source review does not certify all user-generated conversations; UGC, messaging and advertising declarations remain yes. Human moderation still requires ongoing operation.
- No dating/romantic-companion feature was found in the resident source search. Do not remove social/UGC disclosures merely to lower a rating.

## Questionnaire recommendation after revised-build validation

Reassess frequent realistic violence and frequent mature themes against the revised behavior, including every other game and live/social content. Apple defines real-world crime as a possible mature theme; changing text alone would not suffice. Preserve the existing infrequent alcohol/substance answer until all scene props and catalog content have been visually reviewed. Do not assert a lower answer or submit a lower rating before that review is complete.

Apple's current table permits frequent cartoon/fantasy violence, frequent weapons and frequent contests at 13+. Frequent mature themes maps to 16+, and frequent realistic violence to 18+. Ratings can differ by region and OS version.

Official references (checked 2026-11-08):
- https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/
- https://developer.apple.com/help/app-store-connect/manage-app-information/set-an-app-age-rating/

## Validation

Passed locally: Harbor movement/combat, jump/roof, audio, online and map/sandbox simulations; 23 native advertising consent/content-cap tests; and 20 page source contracts. Web cache version was advanced so existing installs refresh the revised assets. Browser CI and on-device visual/listening checks remain release gates. Specifically verify harmless pedestrian tags, forward/reverse safety stops, shield recharge, simultaneous run/jump, toy audio, and optional live tag rounds.
