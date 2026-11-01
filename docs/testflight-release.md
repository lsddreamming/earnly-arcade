# TestFlight release checklist

## Before upload

1. Require passing PR checks at the exact head before merge. Require passing main QA, native compilation, and an actual Pages publication at the exact candidate commit before upload.
2. Review encryption changes, including linked SDKs. The current declaration follows the owner's approved **None of the algorithms mentioned above** response. App code uses platform HTTPS/WebCrypto for networking/authentication and StoreKit for purchases; it does not implement custom encryption. Reassess this classification when those capabilities or dependencies change.
3. `scripts/configure-ios.mjs` inserts the Boolean `ITSAppUsesNonExemptEncryption = false` after every generated iOS project. A conflicting declaration stops configuration for review.
4. The active 1.10 upload workflow checks the signed archive and exported IPA for this value. The native workflow also checks the generated plist. Do not bypass a failed check or set the value merely to silence Apple.

## After upload — required completion steps

1. Open Earnly Arcade in App Store Connect → TestFlight and locate the exact version/build uploaded by this run.
2. Wait for Apple's processing result. If **Missing Compliance** appears, open **Manage**, select **None of the algorithms mentioned above** (the bottom option in the current form), then **Save**, while the reviewed encryption use still qualifies. The owner explicitly requested this step as part of every release.
3. Verify the compliance warning is gone. Check that the build is assigned to the owner's existing test group and that its testing status allows installation. External testing may also require beta review.
4. Only then report that the build is available to test, with its exact version and build number. Otherwise distinguish **uploaded**, **processing**, **compliance pending**, and **testing**. If sign-in blocks verification, use the supported secure authentication flow and explain the blocker; do not claim the compliance form was completed.

An upload or TestFlight release is not a public App Store submission. Public submission remains on hold until separately approved.

## Apple references

- [Complying with encryption export regulations](https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations)
- [ITSAppUsesNonExemptEncryption](https://developer.apple.com/documentation/bundleresources/information-property-list/itsappusesnonexemptencryption)
- [Export compliance documentation for encryption](https://developer.apple.com/help/app-store-connect/reference/app-information/export-compliance-documentation-for-encryption/)

Existing uploaded builds cannot acquire a new Info.plist value. Clear their compliance state in App Store Connect if necessary; this packaging change applies to subsequent builds.
