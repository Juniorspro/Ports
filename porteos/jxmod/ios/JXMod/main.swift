// JXMod para iPhone/iPad: el mismo juego web (index.html + pk.bin, adentro de la app) en una WKWebView a pantalla
// completa y apaisada. Lo arma ios/armar_ipa.sh en una Mac (GitHub Actions); la .ipa sale sin firmar y se instala con
// Sideloadly, AltStore, SideStore o eSign, que la firman con tu Apple ID.
//  - El juego se sirve por un esquema propio (jxmod://app/): así fetch() puede leer pk.bin y todo lo de al lado. Lo que no
//    viene en la app (rb/: mapas, personajes y sonidos; emotes/) se baja de githack la primera vez y queda guardado en la
//    caché de la app (después anda sin internet).
//  - El puente con el juego (window.webkit.messageHandlers.jx): cambiar el ícono de la app (los que vienen), abrir enlaces
//    afuera y guardar archivos.
import UIKit
import WebKit
import AVFoundation

// (como estáticos de un enum: se crean la primera vez que se usan, sin líos de hilos)
enum Conf {
    static let remoto = URL(string: "https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/")!
    static let iconos = ["noche", "dorado", "neon", "rojo", "blanco", "azul", "vhs"]
    // (lo que el juego «descarga» —fotos, mods exportados— con un <a download> de blob: en la WKWebView eso no hace
    // nada, así que se lee el archivo y se manda por el puente para guardarlo o compartirlo con el menú de iOS)
    static let guardarJS = """
    (function(){var c=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){var h=this.href||'',n=this.getAttribute('download');
    if(n!==null&&/^(blob:|data:)/.test(h)){fetch(h).then(function(r){return r.blob();}).then(function(b){var f=new FileReader();f.onload=function(){
    window.webkit.messageHandlers.jx.postMessage({k:'guardar',nombre:n||'archivo',b64:String(f.result).split(',')[1]||''});};f.readAsDataURL(b);});return;}
    return c.apply(this,arguments);};})();
    """
}

final class Esquema: NSObject, WKURLSchemeHandler {
    private let base = Bundle.main.resourceURL!.appendingPathComponent("www")
    private let cache: URL = {
        let c = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("jxmod", isDirectory: true)
        try? FileManager.default.createDirectory(at: c, withIntermediateDirectories: true)
        return c
    }()
    // (las tareas que WebKit ya canceló: responderles tira una excepción. Todo esto corre en el hilo principal)
    private var paradas = Set<ObjectIdentifier>()

    private func tipo(_ ruta: String) -> String {
        switch (ruta as NSString).pathExtension.lowercased() {
        case "html", "htm": return "text/html; charset=utf-8"
        case "js", "mjs": return "text/javascript; charset=utf-8"
        case "json", "webmanifest": return "application/json"
        case "css": return "text/css"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "webp": return "image/webp"
        case "svg": return "image/svg+xml"
        case "mp3": return "audio/mpeg"
        case "ogg": return "audio/ogg"
        case "wav": return "audio/wav"
        case "mp4": return "video/mp4"
        case "wasm": return "application/wasm"
        default: return "application/octet-stream"
        }
    }
    private func responder(_ t: WKURLSchemeTask, _ url: URL, _ d: Data, _ mime: String) {
        if paradas.remove(ObjectIdentifier(t)) != nil { return }
        let r = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": mime, "Content-Length": String(d.count), "Access-Control-Allow-Origin": "*", "Cache-Control": "no-cache"])!
        t.didReceive(r); t.didReceive(d); t.didFinish()
    }
    private func fallar(_ t: WKURLSchemeTask, _ url: URL, _ codigo: Int) {
        if paradas.remove(ObjectIdentifier(t)) != nil { return }
        let r = HTTPURLResponse(url: url, statusCode: codigo, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": "text/plain", "Access-Control-Allow-Origin": "*"])!
        t.didReceive(r); t.didReceive(Data()); t.didFinish()
    }
    func webView(_ webView: WKWebView, start t: WKURLSchemeTask) {
        guard let url = t.request.url else { return }
        var ruta = url.path.removingPercentEncoding ?? url.path
        if ruta.isEmpty || ruta == "/" { ruta = "/index.html" }
        if ruta.contains("..") { fallar(t, url, 403); return }
        let rel = String(ruta.dropFirst()), mime = tipo(rel)
        // 1. lo que viene en la app
        let local = base.appendingPathComponent(rel)
        if FileManager.default.fileExists(atPath: local.path), let d = try? Data(contentsOf: local, options: .alwaysMapped) { responder(t, url, d, mime); return }
        // 2. lo que ya se bajó una vez
        let guardado = cache.appendingPathComponent(rel)
        if FileManager.default.fileExists(atPath: guardado.path), let d = try? Data(contentsOf: guardado) { responder(t, url, d, mime); return }
        // 3. de internet (al lado del juego en githack), y se guarda
        var comp = URLComponents(url: Conf.remoto.appendingPathComponent(rel), resolvingAgainstBaseURL: false)!
        comp.query = url.query
        guard let remoto = comp.url else { fallar(t, url, 404); return }
        Task {
            let res = try? await URLSession.shared.data(from: remoto)
            await MainActor.run {
                guard let par = res, let h = par.1 as? HTTPURLResponse, h.statusCode == 200 else { self.fallar(t, url, (res?.1 as? HTTPURLResponse)?.statusCode ?? 404); return }
                let d = par.0
                try? FileManager.default.createDirectory(at: guardado.deletingLastPathComponent(), withIntermediateDirectories: true)
                try? d.write(to: guardado, options: .atomic)
                self.responder(t, url, d, h.value(forHTTPHeaderField: "Content-Type") ?? mime)
            }
        }
    }
    func webView(_ webView: WKWebView, stop t: WKURLSchemeTask) { paradas.insert(ObjectIdentifier(t)) }
}

final class Juego: UIViewController, WKScriptMessageHandler, WKUIDelegate, WKNavigationDelegate {
    var web: WKWebView!
    let esquema = Esquema()

    override func loadView() {
        let c = WKWebViewConfiguration()
        c.setURLSchemeHandler(esquema, forURLScheme: "jxmod")
        c.allowsInlineMediaPlayback = true
        c.mediaTypesRequiringUserActionForPlayback = []
        c.preferences.javaScriptCanOpenWindowsAutomatically = true
        c.userContentController.add(self, name: "jx")
        // (el juego sabe que es la app de iPhone: no muestra «Agregar a inicio» y usa el cambio de ícono de iOS)
        c.userContentController.addUserScript(WKUserScript(source: "window.JX_IOS_APP = 1;" + Conf.guardarJS, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        web = WKWebView(frame: .zero, configuration: c)
        web.isOpaque = false; web.backgroundColor = .black
        web.scrollView.isScrollEnabled = false; web.scrollView.bounces = false
        web.scrollView.contentInsetAdjustmentBehavior = .never
        web.uiDelegate = self; web.navigationDelegate = self
        if #available(iOS 16.4, *) { web.isInspectable = true }
        view = web
    }
    override func viewDidLoad() {
        super.viewDidLoad()
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .default, options: [.mixWithOthers])
        web.load(URLRequest(url: URL(string: "jxmod://app/index.html")!))
    }
    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }

    // el puente: { k: 'icono', id } · { k: 'abrir', url } · { k: 'guardar', nombre, b64 }
    func userContentController(_ u: WKUserContentController, didReceive m: WKScriptMessage) {
        guard let d = m.body as? [String: Any], let k = d["k"] as? String else { return }
        if k == "icono", let id = d["id"] as? String {
            guard UIApplication.shared.supportsAlternateIcons else { return }
            UIApplication.shared.setAlternateIconName(Conf.iconos.contains(id) ? id : nil) { _ in }
        } else if k == "abrir", let s = d["url"] as? String, let url = URL(string: s), ["http", "https"].contains(url.scheme ?? "") {
            UIApplication.shared.open(url)
        } else if k == "guardar", let n = d["nombre"] as? String, let b64 = d["b64"] as? String, let datos = Data(base64Encoded: b64) {
            let f = FileManager.default.temporaryDirectory.appendingPathComponent((n as NSString).lastPathComponent)
            try? datos.write(to: f)
            let a = UIActivityViewController(activityItems: [f], applicationActivities: nil)
            a.popoverPresentationController?.sourceView = view
            present(a, animated: true)
        }
    }
    // los enlaces de afuera (redes, tienda de Steam...) se abren en Safari
    func webView(_ w: WKWebView, decidePolicyFor a: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = a.request.url, let s = url.scheme, s == "http" || s == "https", a.targetFrame?.isMainFrame ?? true, a.navigationType == .linkActivated { UIApplication.shared.open(url); decisionHandler(.cancel); return }
        decisionHandler(.allow)
    }
    func webView(_ w: WKWebView, createWebViewWith c: WKWebViewConfiguration, for a: WKNavigationAction, windowFeatures f: WKWindowFeatures) -> WKWebView? {
        if let url = a.request.url { UIApplication.shared.open(url) }
        return nil
    }
    // micrófono (chat de voz por cercanía): se le pregunta al sistema una vez
    @available(iOS 15.0, *)
    func webView(_ w: WKWebView, requestMediaCapturePermissionFor o: WKSecurityOrigin, initiatedByFrame f: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) { decisionHandler(.grant) }
    func webView(_ w: WKWebView, runJavaScriptAlertPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: m, preferredStyle: .alert); a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); present(a, animated: true)
    }
    func webView(_ w: WKWebView, runJavaScriptConfirmPanelWithMessage m: String, initiatedByFrame f: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = UIAlertController(title: nil, message: m, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "Cancelar", style: .cancel) { _ in completionHandler(false) }); a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) }); present(a, animated: true)
    }
    // (si iOS mata el proceso de la página por memoria, se vuelve a abrir en vez de quedar en blanco)
    func webViewWebContentProcessDidTerminate(_ w: WKWebView) { w.reload() }
}

@objc(App) final class App: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    func application(_ a: UIApplication, didFinishLaunchingWithOptions o: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        window = UIWindow(frame: UIScreen.main.bounds)
        window!.rootViewController = Juego()
        window!.backgroundColor = .black
        window!.makeKeyAndVisible()
        return true
    }
    func application(_ a: UIApplication, supportedInterfaceOrientationsFor w: UIWindow?) -> UIInterfaceOrientationMask { .landscape }
}

_ = UIApplicationMain(CommandLine.argc, CommandLine.unsafeArgv, nil, NSStringFromClass(App.self))
