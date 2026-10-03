import Cocoa
import WebKit

final class ShelfApp: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    let window: NSWindow
    let webView: WKWebView

    override init() {
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .nonPersistent()
        webView = WKWebView(frame: .zero, configuration: config)
        window = NSWindow(
            contentRect: NSRect(x: 0, y: 0, width: 1100, height: 760),
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered,
            defer: false
        )
        window.title = "Shelf"
        window.contentView = webView
        window.minSize = NSSize(width: 720, height: 560)
        window.center()
        super.init()
        webView.navigationDelegate = self
    }

    func applicationDidFinishLaunching(_ notification: Notification) {
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
        guard
            let root = Bundle.main.resourceURL?.appendingPathComponent("ui", isDirectory: true),
            let index = Optional(root.appendingPathComponent("index.html")),
            FileManager.default.fileExists(atPath: index.path)
        else {
            let alert = NSAlert()
            alert.messageText = "Shelf could not find its page."
            alert.informativeText = "Build the app again from the mac folder."
            alert.runModal()
            NSApp.terminate(nil)
            return
        }
        webView.loadFileURL(index, allowingReadAccessTo: root)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        true
    }

    func webView(
        _ webView: WKWebView,
        decidePolicyFor navigationAction: WKNavigationAction,
        decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
    ) {
        if navigationAction.navigationType == .linkActivated,
           let url = navigationAction.request.url,
           url.isFileURL == false {
            NSWorkspace.shared.open(url)
            decisionHandler(.cancel)
            return
        }
        decisionHandler(.allow)
    }
}

let app = NSApplication.shared
let delegate = ShelfApp()
app.setActivationPolicy(.regular)
app.delegate = delegate
app.run()
