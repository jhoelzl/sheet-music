import Capacitor
import UIKit
import WebKit

class AppBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(YouTubePlayerPlugin())
    }
}

@objc(YouTubePlayerPlugin)
public class YouTubePlayerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "YouTubePlayerPlugin"
    public let jsName = "YouTubePlayer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]

    @objc func open(_ call: CAPPluginCall) {
        guard let videoId = call.getString("videoId"),
              videoId.range(of: "^[A-Za-z0-9_-]{6,}$", options: .regularExpression) != nil else {
            call.reject("Invalid YouTube video ID")
            return
        }
        guard let bundleId = Bundle.main.bundleIdentifier,
              let baseURL = URL(string: "https://\(bundleId.lowercased())/") else {
            call.reject("Unable to identify the app to YouTube")
            return
        }
        let title = call.getString("title") ?? "Video"
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("Unable to open the video player")
                return
            }
            let player = YouTubePlayerViewController(videoId: videoId, baseURL: baseURL)
            player.title = title
            let navigation = UINavigationController(rootViewController: player)
            navigation.modalPresentationStyle = .pageSheet
            presenter.present(navigation, animated: true) {
                call.resolve()
            }
        }
    }
}

private final class YouTubePlayerViewController: UIViewController {
    private let videoId: String
    private let baseURL: URL
    private var hasLoadedPlayer = false
    private lazy var webView: WKWebView = {
        let configuration = WKWebViewConfiguration()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        return WKWebView(frame: .zero, configuration: configuration)
    }()

    init(videoId: String, baseURL: URL) {
        self.videoId = videoId
        self.baseURL = baseURL
        super.init(nibName: nil, bundle: nil)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) is not supported")
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .systemBackground
        navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .close, target: self, action: #selector(close))

        webView.translatesAutoresizingMaskIntoConstraints = false
        webView.isOpaque = false
        webView.backgroundColor = .systemBackground
        view.addSubview(webView)
        NSLayoutConstraint.activate([
            webView.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            webView.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
        ])
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !hasLoadedPlayer else { return }
        hasLoadedPlayer = true

        let html = """
        <!doctype html>
        <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta name="referrer" content="strict-origin-when-cross-origin">
        <style>
        html, body { margin: 0; height: 100%; background: #000; }
        body { display: flex; align-items: center; }
        iframe { width: 100%; aspect-ratio: 16 / 9; min-height: 200px; border: 0; }
        </style></head><body>
        <iframe src="https://www.youtube-nocookie.com/embed/\(videoId)?autoplay=1&amp;playsinline=1"
          title="YouTube video" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
        </body></html>
        """
        webView.loadHTMLString(html, baseURL: baseURL)
    }

    @objc private func close() {
        dismiss(animated: true)
    }
}
