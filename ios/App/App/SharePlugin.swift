import Capacitor
import UIKit

@objc(SharePlugin)
public class SharePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SharePlugin"
    public let jsName = "Share"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareImage", returnType: CAPPluginReturnPromise)
    ]

    /// `Share.share` and `Share.shareImage` are the same call; `features/runcard.js` uses `shareImage`.
    @objc func share(_ call: CAPPluginCall) {
        shareImage(call)
    }

    @objc func shareImage(_ call: CAPPluginCall) {
        guard let raw = call.getString("base64"), !raw.isEmpty else {
            call.reject("base64 is required")
            return
        }
        let payload = raw.components(separatedBy: ",").last ?? raw
        guard let data = Data(base64Encoded: payload, options: .ignoreUnknownCharacters), let image = UIImage(data: data) else {
            call.reject("Invalid image data")
            return
        }
        let text = call.getString("text") ?? ""

        DispatchQueue.main.async { [weak self] in
            guard var presenter = self?.bridge?.viewController else {
                call.reject("No view controller to present from")
                return
            }
            while let presented = presenter.presentedViewController, !presented.isBeingDismissed {
                presenter = presented
            }
            var items: [Any] = [image]
            if !text.isEmpty { items.append(text) }
            let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
            controller.completionWithItemsHandler = { activity, completed, _, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                call.resolve(["completed": completed, "activity": activity?.rawValue ?? ""])
            }
            if let popover = controller.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            presenter.present(controller, animated: true)
        }
    }
}
