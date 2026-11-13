# Alien Invasion AR — Earnly Arcade playtest

The user-facing target is an **iPhone-only** small optional game inside the existing **Earnly Arcade** iOS app (`com.earnly.arcade`), distributed through its existing TestFlight record. Do not create a separate Apple app record. The standalone Xcode project below is only a developer harness.

The native bridge rejects iPad, Mac, Mac Catalyst and simulator launches before camera access. iPhone Safari retains the explicitly labeled camera-overlay preview; its desktop/tablet entry is blocked. True room tracking remains native-only.

The game has no ads, accounts, purchases, coins, network requests, camera recording, or uploads. Minimum iOS 17 and a physical ARKit-capable iPhone. RoomPlan is optional and gated by `RoomCaptureSession.isSupported`. Earnly's existing features are unchanged.

## Build inside Earnly Arcade

Set `EARNLY_ALIEN_AR_PREVIEW=1` for both `npm run native:web` and `node scripts/configure-ios.mjs`, with the usual `npx cap add ios` / `npx cap sync ios` between them. This flag packages a launcher, registers the native game plugin alongside StoreKit, and includes its camera purpose string. Exit dismisses the game, stops its camera and display loop, and returns to Earnly. Ordinary builds omit the launcher and native plugin. Generate a fresh `ios/` for every release.

The `earnly-integrated-game` CI job compiles the full Earnly app with this flag for the physical iPhone SDK, unsigned. It does not upload to Apple. Signed TestFlight delivery still requires the repository's exact-source release checks and existing signing workflow. An unsigned build is not installable; physical tracking is not verified by CI.

After approval and green PR/main checks, run **Earnly 1.13 TestFlight upload** on that main commit with `confirm_apple_upload=true` and `alien_ar_preview=true`. The latter defaults to false. It also requires the AR workflow, including the full-app compile job, to pass on that same main commit. This uploads a beta of the existing Earnly app; it does not submit a public App Store release. Follow `docs/testflight-release.md` through Apple processing, compliance and the owner's existing internal group before reporting it available.

## Run on your iPhone from a Mac

1. Download this branch or the `Alien-Invasion-AR-Xcode` CI artifact.
2. Run `python3 native/AlienInvasionAR/generate-project.py` from the repository root (the CI artifact already includes the generated project).
3. Open `native/AlienInvasionAR/AlienInvasionAR.xcodeproj` in Xcode.
4. Select **AlienInvasionAR → Signing & Capabilities → your Apple development team**. The separate bundle identifier is `com.earnlyarcade.alieninvasion.prototype`.
5. Connect the iPhone, enable Developer Mode if requested, select it as the run destination, and press Run.
6. Tap Play to grant camera access. Find a clear floor; aim at it and tap Mark floor. Choose **Air** to place a floating portal about 2m ahead, or choose Door/Window/Wall/Ceiling for a recognized surface. One portal is sufficient.
7. Drag the portal body to move it on its fixed 3D plane. Drag any cyan corner to change width and height independently, or pinch to resize. Air entrances also offer Closer/Farther buttons. Tap **Lock portal**, then defend. To edit a locked portal, select Edit / add entrances, tap the portal and choose Edit portal. Portals cannot be edited during combat.

No Apple signing identity is embedded. An unsigned CI compilation is **not** an installable build or TestFlight release. Physical camera/tracking tests cannot be replaced by the simulator.

## What the implementation does

- ARWorldTrackingConfiguration uses horizontal/vertical planes and 6DoF tracking. One explicit ARAnchor defines the game coordinate system. All enemy positions are metres in that anchor's local space; camera children are used only for the held weapon.
- A continuous simulation updates every enemy, independent of render visibility. Offscreen enemies retain UUIDs, health, position, animation age and attack cooldown.
- Ray/sphere 3D intersections hit the nearest alien along the physical camera aim direction. Four primitive 3D character types, two weapons, three waves, reload, score, health, defeat particles and positional audio are implemented.
- Optional RoomPlan uses the same ARSession and stops with `pauseARSession:false`. RoomPlan supplies floor/door/window/wall suggestions. Ceiling suggestions require an actual ARKit ceiling classification; missing ceilings are not invented. Manual surface portals require recognized plane geometry. Floating portals take a single tracked pose when placed and then remain children of the world anchor, not of the camera.
- Portal gestures cast touch rays into the fixed portal plane in anchor space. Opposite corners stay fixed while reshaping the opening. Width/height are bounded to 0.4–3m, and edited centers remain 0.8–8m from the phone. Explicit locks reject edits; all portals must be locked before combat. Air portals spawn flying aliens at their edited 3D position.
- Tracking loss, interruptions and camera movement of 1.25m or more horizontally from the combat origin freeze combat until explicitly resumed. The camera allowance accommodates turning in place with the phone held out; it does not track the player's body or permit walking. Session errors require a restart. Exiting stops camera capture.

## Mandatory physical acceptance test — not yet verified

1. Use a well-lit clear room. Mark floor and one doorway/wall portal about 2–3m away. Drag it across the opening, resize with the corner handles and pinch, and lock it. Move/rotate the phone without touching the portal: confirm it stays aligned with the room. Repeat with a floating Air portal and its depth controls.
2. Select **180° tracking test**. Three aliens spawn with stable identities (flying enemies for Air/Ceiling entrances).
3. Turn in place 180°. Wait at least three seconds while tracking remains normal.
4. Turn back. Confirm the same aliens have advanced from the doorway and stayed aligned with the room. The diagnostic reports ID continuity, which alone does not prove spatial accuracy.
5. Shoot all three. Confirm nearest-target hit detection, hit response and defeat.
6. Repeat with a ceiling portal, without LiDAR, denied camera, interrupted session, low light, background/foreground, pause/reload, all waves and both weapons.

## Known prototype limits

Physical AR alignment, tracking recovery, actual camera permissions, frame rate, sound direction and RoomPlan handoff require an iPhone playtest. This is not a verified room-scale release. Primitive models prioritize tracking. Ground enemies follow a straight line across the confirmed floor; real furniture avoidance/mesh occlusion is not implemented. Virtual wall cracks/holes are decorative meshes, not physical wall damage. Door/window portal placement is manual without RoomPlan. Session anchors persist during the run; saved maps and cross-launch room persistence are not implemented. No TestFlight distribution has occurred.

## Checks

`swift test` runs eleven deterministic core tests, including the movement guard during an arm-held turn, turn-away/offscreen persistence and attacks, 3D nearest-ray hits, all waves, reload/restart, fixed-plane dragging, independent corner resizing, pinch bounds, locked edit rejection, and floating spawn positions. CI compiles against the physical iOS SDK without signing. Passing these does not verify real room tracking or physical touch gestures.

Apple references: [world tracking](https://developer.apple.com/documentation/arkit/understanding-world-tracking), [RoomPlan shared sessions](https://developer.apple.com/documentation/roomplan/scanning-the-rooms-of-a-single-structure), [ceiling classification](https://developer.apple.com/documentation/arkit/arplaneanchor/classification-swift.enum/ceiling).
