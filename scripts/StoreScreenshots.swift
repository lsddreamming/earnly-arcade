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
        XCTAssertTrue(link.waitForExistence(timeout: 15), app.debugDescription)
        link.tap()
        XCTAssertTrue(search.waitForExistence(timeout: 15), app.debugDescription)
    }

    func openGame(_ name: String) {
        games()
        let search = app.searchFields["Search games"]
        search.tap()
        search.typeText(name)
        let link = app.links["Play " + name]
        XCTAssertTrue(link.waitForExistence(timeout: 10), app.debugDescription)
        link.tap()
    }

    func start(_ text: String) {
        let button = app.buttons[text]
        XCTAssertTrue(button.waitForExistence(timeout: 15), app.debugDescription)
        button.tap()
    }

    func test01Catalog() {
        games()
        capture("01-Arcade-Games")
    }

    func test02NeonSlice() {
        openGame("Neon Slice")
        start("Play")
        // Wait for the first natural food wave, then make a normal swipe.
        Thread.sleep(forTimeInterval: 1.2)
        let a = app.coordinate(withNormalizedOffset: CGVector(dx: 0.22, dy: 0.62))
        let b = app.coordinate(withNormalizedOffset: CGVector(dx: 0.78, dy: 0.48))
        a.press(forDuration: 0.05, thenDragTo: b)
        capture("02-Neon-Slice")
    }

    func test03MemoryMatch() {
        openGame("Memory Match")
        start("👆 Tap the Cards to Start")
        let card = app.buttons["Hidden card 1"]
        XCTAssertTrue(card.waitForExistence(timeout: 10), app.debugDescription)
        card.tap()
        capture("03-Memory-Match")
    }

    func test04TowerStack() {
        openGame("Tower Stack")
        start("👆 Tap the Tower to Start")
        Thread.sleep(forTimeInterval: 3.5)
        capture("04-Tower-Stack")
    }

    func test05ColorMatch() {
        openGame("Color Match")
        start("👆 Tap the Game to Start")
        Thread.sleep(forTimeInterval: 3.5)
        capture("05-Color-Match")
    }

    func test06BlockDrop() {
        openGame("Block Drop")
        start("Start Block Drop")
        Thread.sleep(forTimeInterval: 3.5)
        capture("06-Block-Drop")
    }
}
