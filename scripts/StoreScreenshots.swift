import XCTest

// Captures the real packaged app through ordinary guest navigation and play.
// No injected game state, fake balances, accounts, or altered game artwork.
final class StoreScreenshots: XCTestCase {
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

    func games() {
        let search = app.searchFields["Search games"]
        if search.exists { return }
        let link = app.links.matching(NSPredicate(format: "label == 'Games' OR label == '← Games'")).firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 40), app.debugDescription)
        link.tap()
        XCTAssertTrue(search.waitForExistence(timeout: 15), app.debugDescription)
    }

    func openGame(_ name: String) {
        games()
        let search = app.searchFields["Search games"]
        search.tap()
        search.typeText(name)
        // The accessible card and its visible Play link share the same label.
        let link = app.links.matching(identifier: "Play " + name).firstMatch
        XCTAssertTrue(link.waitForExistence(timeout: 10), app.debugDescription)
        link.tap()
    }

    func start(_ text: String) {
        let button = app.buttons[text]
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
    }

    func test04Catalog() {
        games()
        capture("04-Arcade-Games")
    }

    func test01NeonSlice() {
        openGame("Neon Slice")
        start("Play")
        // Wait for the first natural food wave, then make a normal swipe.
        Thread.sleep(forTimeInterval: 1.2)
        let a = app.coordinate(withNormalizedOffset: CGVector(dx: 0.22, dy: 0.62))
        let b = app.coordinate(withNormalizedOffset: CGVector(dx: 0.78, dy: 0.48))
        a.press(forDuration: 0.05, thenDragTo: b)
        capture("01-Neon-Slice")
        Thread.sleep(forTimeInterval: 0.4)
        capture("01-Neon-Slice-Alternate")
    }

    func test02BounceRun() {
        openGame("Bounce Run")
        start("👆 Tap Game to Start")
        // Allow both countdowns and the first crystal obstacle to enter view.
        Thread.sleep(forTimeInterval: 7.0)
        // Bounce Run accepts a tap anywhere in its live play area.
        app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        capture("02-Bounce-Run")
        Thread.sleep(forTimeInterval: 0.3)
        capture("02-Bounce-Run-Alternate")
    }

    func test03NeonBreach() {
        openGame("Neon Breach")
        start("▶ TAP TO START")
        // Let the first robot wave materialize through normal gameplay.
        Thread.sleep(forTimeInterval: 5.0)
        capture("03-Neon-Breach")
        let fire = app.buttons["Hold to fire blaster"]
        XCTAssertTrue(fire.waitForExistence(timeout: 10), app.debugDescription)
        fire.press(forDuration: 0.5)
        capture("03-Neon-Breach-Alternate")
    }

    func test05MemoryMatch() {
        openGame("Memory Match")
        start("👆 Tap the Cards to Start")
        let card = app.buttons["Hidden card 1"]
        XCTAssertTrue(card.waitForExistence(timeout: 10), app.debugDescription)
        let enabled = XCTNSPredicateExpectation(predicate: NSPredicate(format: "enabled == true"), object: card)
        XCTAssertEqual(XCTWaiter.wait(for: [enabled], timeout: 10), .completed)
        card.tap()
        capture("05-Memory-Match")
    }

    func test06TowerStack() {
        openGame("Tower Stack")
        start("👆 Tap the Tower to Start")
        Thread.sleep(forTimeInterval: 3.5)
        capture("06-Tower-Stack")
    }

    func test07ColorMatch() {
        openGame("Color Match")
        start("👆 Tap the Game to Start")
        Thread.sleep(forTimeInterval: 3.5)
        capture("07-Color-Match")
    }

    func test08BlockDrop() {
        openGame("Block Drop")
        start("Start Block Drop")
        Thread.sleep(forTimeInterval: 3.5)
        capture("08-Block-Drop")
    }
}
