import Cocoa
import WebKit
enum ObjC { static func catching(_ f: () -> Void) throws { var e: NSException? = nil; let ok = tryBlock(f, &e); if !ok { throw NSError(domain: e?.name.rawValue ?? "objc", code: 1, userInfo: [NSLocalizedDescriptionKey: e?.reason ?? "?"]) } } }
// usage: wkrun <url> <timeoutSeconds> [outFile]
final class H: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
  var out: FileHandle? = nil
  func userContentController(_ c: WKUserContentController, didReceive m: WKScriptMessage) {
    guard let s = m.body as? String else { return }
    if s == "__DONE__" { exit(0) }
    if s.hasPrefix("RESULT "), let o = out { o.write((String(s.dropFirst(7)) + "\n").data(using: .utf8)!); print("RESULT written"); fflush(stdout); return }
    print(s); fflush(stdout)
  }
  func webView(_ w: WKWebView, didFail n: WKNavigation!, withError e: Error) { print("NAV FAIL \(e)"); exit(3) }
  func webView(_ w: WKWebView, didFailProvisionalNavigation n: WKNavigation!, withError e: Error) { print("NAV FAIL \(e)"); exit(3) }
  func webViewWebContentProcessDidTerminate(_ w: WKWebView) { print("WEBCONTENT CRASHED"); exit(4) }
}
let args = CommandLine.arguments
let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let h = H()
if args.count > 3 { FileManager.default.createFile(atPath: args[3], contents: nil); h.out = FileHandle(forWritingAtPath: args[3]) }
let cfg = WKWebViewConfiguration()
cfg.userContentController.add(h, name: "log")
let prefs = cfg.preferences
for k in ["hiddenPageDOMTimerThrottlingEnabled", "hiddenPageDOMTimerThrottlingAutoIncreases", "pageVisibilityBasedProcessSuppressionEnabled"] {
  do { try ObjC.catching { prefs.setValue(false, forKey: k) } } catch { print("cannot set \(k)") }
}
if ProcessInfo.processInfo.environment["WK_NOACCEL"] == "1" {
  for k in ["canvasUsesAcceleratedDrawing", "acceleratedDrawingEnabled"] {
    do { try ObjC.catching { prefs.setValue(false, forKey: k) }; print("set \(k)=false -> \(String(describing: prefs.value(forKey: k)))") } catch { print("cannot set \(k): \(error)") }
  }
}
let rect = NSRect(x: 0, y: 0, width: 390, height: 844)
let wv = WKWebView(frame: rect, configuration: cfg)
wv.navigationDelegate = h
let win = NSWindow(contentRect: NSRect(x: 40, y: 40, width: 390, height: 844), styleMask: [.borderless], backing: .buffered, defer: false)
win.contentView = wv
win.alphaValue = 0.0
win.ignoresMouseEvents = true
win.level = .normal
win.orderBack(nil)
wv.load(URLRequest(url: URL(string: args[1])!))
let timeout = Double(args.count > 2 ? args[2] : "600") ?? 600
DispatchQueue.main.asyncAfter(deadline: .now() + timeout) { print("TIMEOUT"); exit(2) }
app.run()
