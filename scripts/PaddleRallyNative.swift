import XCTest

// Exercises the packaged app through normal navigation and touch input.
// No JavaScript injection, fabricated saves, or altered gameplay assets.
final class PaddleRallyNative: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.earnly.arcade")

    override func setUpWithError() throws {
        continueAfterFailure = false
        XCUIDevice.shared.orientation = .portrait
        app.launch()
        let browse = app.buttons["Browse Games"]
        if browse.waitForExistence(timeout: 5) { browse.tap() }
    }

    func capture(_ name: String) {
        let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
    }

    func testPackagedPaddleRally() {
        let search = app.searchFields["Search games"]
        if !search.exists {
            let games = app.links.matching(NSPredicate(format: "label == 'Games' OR label == '← Games'")).firstMatch
            XCTAssertTrue(games.waitForExistence(timeout: 40), app.debugDescription)
            games.tap()
        }
        XCTAssertTrue(search.waitForExistence(timeout: 15), app.debugDescription)
        search.tap()
        search.typeText("Paddle Rally")
        let gameLink = app.links.matching(identifier: "Play Paddle Rally").firstMatch
        XCTAssertTrue(gameLink.waitForExistence(timeout: 10), app.debugDescription)
        gameLink.tap()
        let play = app.buttons["Play"]
        XCTAssertTrue(play.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(play.isHittable)
        capture("Paddle-Rally-Ready")

        play.tap()
        // Give WKWebView's countdown a chance to render before requesting
        // accessibility snapshots on heavily loaded hosted simulators.
        Thread.sleep(forTimeInterval: 3)
        let pause = app.buttons["Pause"]
        XCTAssertTrue(pause.waitForExistence(timeout: 120), app.debugDescription)
        // Check suspension early in a fresh rally. The former sequence waited
        // until after several unattended returns and could lose before Home.
        XCUIDevice.shared.press(.home)
        Thread.sleep(forTimeInterval: 2)
        app.activate()
        let resume = app.buttons["Resume"]
        XCTAssertTrue(resume.waitForExistence(timeout: 10), "Backgrounding must pause the rally. " + app.debugDescription)
        capture("Paddle-Rally-After-Background")

        resume.tap()
        pause.tap()
        XCTAssertTrue(resume.waitForExistence(timeout: 5), app.debugDescription)
        capture("Paddle-Rally-Paused")

        let strip = app.descendants(matching: .any).matching(NSPredicate(format: "label == 'Drag left or right here to move the paddle'")).firstMatch
        XCTAssertTrue(strip.exists, app.debugDescription)
        XCTAssertTrue(strip.isHittable)
        XCTAssertLessThanOrEqual(strip.frame.maxY, app.frame.maxY)
        resume.tap()
        strip.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
            .press(forDuration: 0.05, thenDragTo: strip.coordinate(withNormalizedOffset: CGVector(dx: 0.2, dy: 0.5)))
        // A drag moves the paddle away from the ball. Let the unattended
        // rally end instead of racing its result dialog with a Pause tap.
        let replay = app.buttons.matching(NSPredicate(format: "label BEGINSWITH '▶ Play Again'")).firstMatch
        XCTAssertTrue(replay.waitForExistence(timeout: 60), app.debugDescription)
        capture("Paddle-Rally-After-Touch-Result")
        replay.tap()
        Thread.sleep(forTimeInterval: 3)
        XCTAssertTrue(pause.waitForExistence(timeout: 120), app.debugDescription)
        pause.tap()
        XCTAssertTrue(resume.waitForExistence(timeout: 10), app.debugDescription)
        capture("Paddle-Rally-Replay-Paused")

        let quit = app.links["Quit game and return to Games"]
        XCTAssertTrue(quit.isHittable, app.debugDescription)
        quit.tap()
        let keep = app.buttons["Keep Playing"]
        XCTAssertTrue(keep.waitForExistence(timeout: 5), app.debugDescription)
        capture("Paddle-Rally-Quit-Confirmation")
        keep.tap()
        XCTAssertTrue(quit.waitForExistence(timeout: 5), app.debugDescription)
        quit.tap()
        app.buttons["Quit Game"].tap()
        XCTAssertTrue(search.waitForExistence(timeout: 15), app.debugDescription)
    }
}
