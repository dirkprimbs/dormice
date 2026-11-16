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
        sleep(2) // the text is known a moment before it is painted
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

        // A tap on a covered tile lays a leaf. Which tiles are covered changes with the
        // day's puzzle, so try a few spots until the picture changes.
        let before = XCUIScreen.main.screenshot().pngRepresentation
        var changed = false
        for spot in [CGVector(dx: 0.9, dy: 0.36), CGVector(dx: 0.1, dy: 0.36), CGVector(dx: 0.9, dy: 0.7), CGVector(dx: 0.1, dy: 0.7), CGVector(dx: 0.5, dy: 0.5)] {
            app.webViews.firstMatch.coordinate(withNormalizedOffset: spot).tap()
            sleep(1)
            if XCUIScreen.main.screenshot().pngRepresentation != before { changed = true; break }
        }
        XCTAssertTrue(changed, "tapping the board did nothing")
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
