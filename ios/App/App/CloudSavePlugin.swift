import Capacitor
import Foundation

@objc(CloudSavePlugin)
public class CloudSavePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "CloudSavePlugin"
    public let jsName = "CloudSave"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "status", returnType: CAPPluginReturnPromise)
    ]

    private let store = NSUbiquitousKeyValueStore.default
    private var observer: NSObjectProtocol?

    override public func load() {
        observer = NotificationCenter.default.addObserver(
            forName: NSUbiquitousKeyValueStore.didChangeExternallyNotification,
            object: store,
            queue: .main
        ) { [weak self] note in
            let reason = (note.userInfo?[NSUbiquitousKeyValueStoreChangeReasonKey] as? Int) ?? -1
            let keys = (note.userInfo?[NSUbiquitousKeyValueStoreChangedKeysKey] as? [String]) ?? []
            self?.notifyListeners("changed", data: ["reason": reason, "keys": keys])
        }
        store.synchronize()
    }

    deinit {
        if let observer = observer { NotificationCenter.default.removeObserver(observer) }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty else {
            call.reject("key is required")
            return
        }
        store.synchronize()
        var result: [String: Any] = ["key": key]
        if let value = store.string(forKey: key) {
            result["value"] = value
        } else {
            result["value"] = NSNull()
        }
        call.resolve(result)
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let key = call.getString("key"), !key.isEmpty, let value = call.getString("value") else {
            call.reject("key and value are required")
            return
        }
        guard value.utf8.count <= 900_000 else {
            call.reject("value exceeds the iCloud key-value size limit")
            return
        }
        store.set(value, forKey: key)
        call.resolve(["key": key, "synchronized": store.synchronize()])
    }

    @objc func status(_ call: CAPPluginCall) {
        call.resolve(["available": FileManager.default.ubiquityIdentityToken != nil])
    }
}
