import UIKit
import WebKit

/// iOS shell: one full-screen web view that shows the web game from the files
/// packed into the app. Nothing is loaded from the network.
final class GameViewController: UIViewController {

    // The packed files are served under an address of their own (instead of
    // file://) so modules load and saved progress has a stable home.
    // Changing this address would orphan everyone's saved progress.
    static let scheme = "app"
    static let host = "dormice"
    private static let home = URL(string: "\(scheme)://\(host)/index.html")!

    private var web: WKWebView!
    private var darkPage = false
    private let buzz = UIImpactFeedbackGenerator(style: .light)

    // What the page is told about the shell, before any of its own code runs:
    // - navigator.vibrate, which iOS lacks, becomes a short haptic tap;
    // - the shell hears whether the page shows its light or its dark theme,
    //   so the clock and battery in the status bar stay readable.
    private static let bridge = """
    (function () {
      var post = function (name, body) { window.webkit.messageHandlers[name].postMessage(body); };
      navigator.vibrate = function () { post('buzz', 0); return true; };
      var tell = function () { post('theme', document.documentElement.dataset.theme || 'light'); };
      new MutationObserver(tell).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      document.addEventListener('DOMContentLoaded', tell);
      var style = document.createElement('style');
      style.textContent = '* { -webkit-touch-callout: none; }';
      document.documentElement.appendChild(style);
    })();
    """

    override func loadView() {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(PackedFiles(), forURLScheme: Self.scheme)
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        config.userContentController.addUserScript(
            WKUserScript(source: Self.bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        let ears = Ears(self)
        config.userContentController.add(ears, name: "buzz")
        config.userContentController.add(ears, name: "theme")

        web = WKWebView(frame: .zero, configuration: config)
        web.navigationDelegate = self
        web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = false
        web.allowsLinkPreview = false
        // The page lays itself out around the notch and the home indicator
        // (viewport-fit=cover), so it gets the whole screen.
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.scrollView.bounces = false
        web.scrollView.alwaysBounceVertical = false
        let paper = UIColor(named: "Paper") ?? .systemBackground
        web.isOpaque = false
        web.backgroundColor = paper
        web.scrollView.backgroundColor = paper
        web.underPageBackgroundColor = paper
        view = web
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        web.load(URLRequest(url: Self.home))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle {
        darkPage ? .lightContent : .darkContent
    }

    fileprivate func heard(_ name: String, _ body: Any) {
        switch name {
        case "buzz":
            buzz.impactOccurred()
        case "theme":
            darkPage = (body as? String) == "dark"
            setNeedsStatusBarAppearanceUpdate()
        default:
            break
        }
    }
}

// MARK: - Links that leave the game

extension GameViewController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = navigationAction.request.url else { return decisionHandler(.cancel) }
        if url.scheme == Self.scheme && url.host == Self.host { return decisionHandler(.allow) }
        if url.scheme == "about" { return decisionHandler(.allow) }
        openOutside(url)
        decisionHandler(.cancel)
    }

    // Links marked to open in a new window (the two on the About sheet) go to the browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url { openOutside(url) }
        return nil
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // The board has its own pinch-to-zoom; the page as a whole should not zoom.
        webView.scrollView.pinchGestureRecognizer?.isEnabled = false
    }

    // If iOS had to stop the page to free memory, bring the game back.
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        webView.load(URLRequest(url: Self.home))
    }

    private func openOutside(_ url: URL) {
        guard url.scheme == "https" || url.scheme == "http" else { return }
        UIApplication.shared.open(url)
    }
}

// MARK: - Messages from the page

/// Passes page messages on without keeping the view controller alive.
private final class Ears: NSObject, WKScriptMessageHandler {
    private weak var owner: GameViewController?
    init(_ owner: GameViewController) { self.owner = owner }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.heard(message.name, message.body)
    }
}

// MARK: - Serving the packed game

private final class PackedFiles: NSObject, WKURLSchemeHandler {
    private let root = Bundle.main.bundleURL.appendingPathComponent("www", isDirectory: true).standardizedFileURL

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url, url.host == GameViewController.host else { return answer(task, 404) }
        var path = url.path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        if path.isEmpty { path = "index.html" }
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else { return answer(task, 404) }
        answer(task, 200, data, mime(file.pathExtension))
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func answer(_ task: WKURLSchemeTask, _ status: Int, _ data: Data = Data(), _ type: String = "text/plain") {
        let headers = ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-store"]
        guard let url = task.request.url,
              let response = HTTPURLResponse(url: url, statusCode: status, httpVersion: "HTTP/1.1", headerFields: headers)
        else { return task.didFailWithError(URLError(.badURL)) }
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }

    private func mime(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "json": return "application/json"
        case "webmanifest": return "application/manifest+json"
        default: return "application/octet-stream"
        }
    }
}
