import Capacitor
import UserNotifications

@objc(NotifyPlugin)
public class NotifyPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NotifyPlugin"
    public let jsName = "Notify"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "request", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "schedule", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "cancelAll", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearDelivered", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pending", returnType: CAPPluginReturnPromise)
    ]

    private let center = UNUserNotificationCenter.current()

    private func name(_ status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized: return "authorized"
        case .denied: return "denied"
        case .provisional: return "provisional"
        case .ephemeral: return "ephemeral"
        default: return "notDetermined"
        }
    }

    @objc func status(_ call: CAPPluginCall) {
        center.getNotificationSettings { settings in
            call.resolve(["status": self.name(settings.authorizationStatus)])
        }
    }

    @objc func request(_ call: CAPPluginCall) {
        center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            self.center.getNotificationSettings { settings in
                call.resolve(["granted": granted, "status": self.name(settings.authorizationStatus)])
            }
        }
    }

    @objc func schedule(_ call: CAPPluginCall) {
        let list = call.getArray("notifications") ?? []
        let now = Date().timeIntervalSince1970
        var ids: [String] = []
        for raw in list {
            guard let item = raw as? JSObject,
                  let id = item["id"] as? String, !id.isEmpty,
                  let title = item["title"] as? String,
                  let body = item["body"] as? String else { continue }
            let at = ((item["at"] as? NSNumber)?.doubleValue ?? (item["at"] as? Double) ?? 0) / 1000
            if at <= now + 5 { continue }
            let content = UNMutableNotificationContent()
            content.title = title
            content.body = body
            content.sound = .default
            let date = Date(timeIntervalSince1970: at)
            let components = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute, .second], from: date)
            let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: false)
            center.add(UNNotificationRequest(identifier: id, content: content, trigger: trigger))
            ids.append(id)
        }
        call.resolve(["scheduled": ids])
    }

    @objc func cancelAll(_ call: CAPPluginCall) {
        center.removeAllPendingNotificationRequests()
        call.resolve()
    }

    @objc func clearDelivered(_ call: CAPPluginCall) {
        center.removeAllDeliveredNotifications()
        call.resolve()
    }

    @objc func pending(_ call: CAPPluginCall) {
        center.getPendingNotificationRequests { requests in
            call.resolve(["ids": requests.map { $0.identifier }])
        }
    }
}
