import AVFoundation
import Capacitor
import UIKit
import VisionKit

@objc(DocumentScannerPlugin)
public class DocumentScannerPlugin: CAPPlugin, CAPBridgedPlugin, VNDocumentCameraViewControllerDelegate {
    public let identifier = "DocumentScannerPlugin"
    public let jsName = "DocumentScanner"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "scan", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readChunk", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "release", returnType: CAPPluginReturnPromise)
    ]

    private var pendingCall: CAPPluginCall?
    private var files: [String: URL] = [:]
    private let chunkSize = 512 * 1024
    private let directory = FileManager.default.temporaryDirectory.appendingPathComponent("sheet-music-document-scans", isDirectory: true)

    @objc override public func load() {
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            for url in try FileManager.default.contentsOfDirectory(at: directory, includingPropertiesForKeys: nil)
            where url.pathExtension == "pdf" && UUID(uuidString: url.deletingPathExtension().lastPathComponent) != nil {
                try FileManager.default.removeItem(at: url)
            }
        } catch {
            NSLog("Could not clean up temporary document scans: %@", error.localizedDescription)
        }
    }

    @objc func scan(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.pendingCall == nil else {
                call.reject("A document scan is already in progress.")
                return
            }
            guard VNDocumentCameraViewController.isSupported else {
                call.reject("Document scanning is not supported on this device. Use Take photo instead.")
                return
            }
            let authorization = AVCaptureDevice.authorizationStatus(for: .video)
            guard authorization != .denied && authorization != .restricted else {
                call.reject("Camera access is disabled. Enable it in iOS Settings to scan documents.")
                return
            }
            guard let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("Could not open the document scanner. Please try again.")
                return
            }
            self.pendingCall = call
            let scanner = VNDocumentCameraViewController()
            scanner.delegate = self
            scanner.modalPresentationStyle = .fullScreen
            presenter.present(scanner, animated: true)
        }
    }

    public func documentCameraViewControllerDidCancel(_ controller: VNDocumentCameraViewController) {
        controller.dismiss(animated: true)
        let call = pendingCall
        pendingCall = nil
        call?.resolve(["cancelled": true])
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFailWithError error: Error) {
        controller.dismiss(animated: true)
        let call = pendingCall
        pendingCall = nil
        call?.reject("Document scan failed: \(error.localizedDescription)")
    }

    public func documentCameraViewController(_ controller: VNDocumentCameraViewController, didFinishWith scan: VNDocumentCameraScan) {
        controller.dismiss(animated: true)
        guard let call = pendingCall else { return }
        guard scan.pageCount > 0 else {
            pendingCall = nil
            call.reject("The document scan has no pages.")
            return
        }
        let token = UUID().uuidString
        let url = directory.appendingPathComponent("\(token).pdf")
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true)
                let renderer = UIGraphicsPDFRenderer(bounds: CGRect(x: 0, y: 0, width: 595, height: 842))
                var invalidPage = false
                try renderer.writePDF(to: url) { context -> Void in
                    for index in 0..<scan.pageCount {
                        let valid = autoreleasepool { () -> Bool in
                            let image = scan.imageOfPage(at: index)
                            guard image.size.width > 0 && image.size.height > 0 else {
                                return false
                            }
                            let scale = 842 / max(image.size.width, image.size.height)
                            let bounds = CGRect(x: 0, y: 0, width: image.size.width * scale, height: image.size.height * scale)
                            context.beginPage(withBounds: bounds, pageInfo: [:])
                            image.draw(in: bounds)
                            return true
                        }
                        if !valid { invalidPage = true }
                    }
                }
                if invalidPage {
                    throw NSError(domain: "DocumentScanner", code: 2, userInfo: [NSLocalizedDescriptionKey: "A scanned page has no image data."])
                }
                let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
                guard let size = attributes[.size] as? NSNumber, size.intValue > 0 else {
                    throw NSError(domain: "DocumentScanner", code: 1, userInfo: [NSLocalizedDescriptionKey: "The generated PDF is empty."])
                }
                DispatchQueue.main.async {
                    self.files[token] = url
                    self.pendingCall = nil
                    call.resolve(["cancelled": false, "token": token, "size": size.intValue, "pages": scan.pageCount])
                }
            } catch {
                if FileManager.default.fileExists(atPath: url.path) {
                    do { try FileManager.default.removeItem(at: url) }
                    catch { NSLog("Could not remove a temporary document scan: %@", error.localizedDescription) }
                }
                DispatchQueue.main.async {
                    self.pendingCall = nil
                    call.reject("Could not create the scanned PDF: \(error.localizedDescription)")
                }
            }
        }
    }

    @objc func readChunk(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let token = call.getString("token"), let url = self.files[token],
                  let offset = call.getInt("offset"), offset >= 0 else {
                call.reject("Invalid scanned PDF request.")
                return
            }
            do {
                let handle = try FileHandle(forReadingFrom: url)
                defer {
                    do { try handle.close() }
                    catch { NSLog("Could not close the scanned PDF: %@", error.localizedDescription) }
                }
                try handle.seek(toOffset: UInt64(offset))
                let data = try handle.read(upToCount: self.chunkSize) ?? Data()
                call.resolve(["data": data.base64EncodedString()])
            } catch {
                call.reject("Could not read the scanned PDF: \(error.localizedDescription)")
            }
        }
    }

    @objc func release(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let token = call.getString("token"), let url = self.files[token] else {
                call.reject("Scanned PDF is no longer available.")
                return
            }
            do {
                try FileManager.default.removeItem(at: url)
                self.files.removeValue(forKey: token)
                call.resolve()
            } catch {
                call.reject("Could not remove the temporary scanned PDF: \(error.localizedDescription)")
            }
        }
    }
}
