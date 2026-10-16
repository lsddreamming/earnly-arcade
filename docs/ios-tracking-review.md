# Next iOS update: tracking permission

Apple reviewed 1.3 (107) on October 16, 2026 and reported Device ID tracking in the privacy label without an ATT prompt. The owner requested Apple’s offered bug-fix approval path; this code is for the next build, not a claim that 107 has changed.

The first optional Watch Ad action checks ATT, requests it only when not determined, waits for a resolved status, then initializes AdMob and completes UMP consent before loading the reward ad. Denied/restricted users can still use non-personalized ads without IDFA. Unresolved permission or API errors stop SDK initialization. No permission choice grants rewards.

The build generator and checked-in Info.plist both include NSUserTrackingUsageDescription. This project owns the ATT prompt: do not additionally publish an AdMob UMP IDFA explainer without migrating the flow. The installed 8.1 plugin requires initialization before showing its consent form.

Before the next Apple upload, test on a clean iPhone and iPad install: first Watch Ad shows the system prompt; Allow and Ask App Not to Track both complete without duplicate prompts; returning from background does not initialize while status is unresolved; UMP denial/errors do not load ads or grant plays. Verify the production archive contains the usage description. Audit actual SDK collection against App Store privacy labels; non-personalized ads alone do not prove no tracking.

Review notes after device verification: The ATT prompt appears on the first optional Watch Ad action, before initializing the advertising SDK. Declining tracking does not block ordinary gameplay.
