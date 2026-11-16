import XCTest

/// Smoke test in the simulator: start the app, open today's puzzle, tap the
/// board, go back. Screenshots land in the folder named by SHOTS_DIR (see
/// ci/smoke.sh) for a person to look at.
final class SmokeTests: XCTestCase {

    private let app = XCUIApplication()

    override func setUp() {
        continueAfterFailure = false
    }

    /// The first thing on screen whose label contains the text.
    private func thing(_ text: String) -> XCUIElement {
        app.webViews.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", text)).firstMatch
    }

    private func shot(_ name: String) {
        let png = XCUIScreen.main.screenshot().pngRepresentation
        let attachment = XCTAttachment(data: png, uniformTypeIdentifier: "public.png")
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        if let dir = ProcessInfo.processInfo.environment["SHOTS_DIR"] {
            try? png.write(to: URL(fileURLWithPath: dir).appendingPathComponent(name + ".png"))
        }
    }

    func testOpenTodaysGardenAndComeBack() {
        app.launch()

        XCTAssertTrue(thing("Free play").waitForExistence(timeout: 90), "the home screen never appeared")
        shot("1-home")

        thing("garden").tap()
        let gotIt = app.webViews.buttons["Got it"]
        if gotIt.waitForExistence(timeout: 10) {
            shot("2-rules")
            gotIt.tap()
        }
        XCTAssertTrue(thing("Back").waitForExistence(timeout: 20), "the puzzle never appeared")
        sleep(1)
        shot("3-game")

        app.webViews.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap()
        sleep(1)
        shot("4-tapped")

        thing("Back").tap()
        XCTAssertTrue(thing("Free play").waitForExistence(timeout: 20), "Back did not return to the home screen")
        shot("5-home-again")

        // Progress must survive a restart: the rules sheet was seen, so it must not come back.
        sleep(3) // give the web view time to write its storage to disk
        app.terminate()
        app.launch()
        XCTAssertTrue(thing("Free play").waitForExistence(timeout: 60))
        thing("garden").tap()
        XCTAssertFalse(app.webViews.buttons["Got it"].waitForExistence(timeout: 6), "saved progress was lost on restart")
        shot("6-after-restart")
    }
}
