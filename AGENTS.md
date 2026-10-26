# TestFlight release completion

The owner expects export compliance to be handled as part of every TestFlight release, not left for them after upload.

- Follow `docs/testflight-release.md`. A successful upload alone does not mean the build is available to testers.
- For the current approved encryption use, the generated app declares `ITSAppUsesNonExemptEncryption = false`. Reassess this declaration if encryption or linked SDKs change.
- If App Store Connect still shows **Missing Compliance**, open **Manage**, select **None of the algorithms mentioned above** (the bottom option in the current form), and **Save**, provided the app still matches that declaration. This routine step is already authorized by the owner.
- Verify processing, compliance, and the intended tester group before reporting a build ready to test. Report an authentication blocker or unverified status honestly.
- TestFlight distribution does not authorize public App Store submission. Public submission is on hold until the owner explicitly approves it.
