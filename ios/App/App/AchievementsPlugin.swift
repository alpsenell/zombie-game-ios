import Capacitor
import GameKit

@objc(AchievementsPlugin)
public class AchievementsPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "AchievementsPlugin"
    public let jsName = "Achievements"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "report", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadProgress", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "show", returnType: CAPPluginReturnPromise)
    ]

    @objc func report(_ call: CAPPluginCall) {
        guard let id = call.getString("id"), !id.isEmpty else {
            call.reject("id is required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Not signed in to Game Center")
            return
        }
        let percent = min(100.0, max(0.0, call.getDouble("percent") ?? 100.0))
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = percent
        achievement.showsCompletionBanner = call.getBool("banner") ?? false
        GKAchievement.report([achievement]) { error in
            if let error = error {
                call.reject(error.localizedDescription)
            } else {
                call.resolve(["id": id, "percent": percent])
            }
        }
    }

    @objc func loadProgress(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Not signed in to Game Center")
            return
        }
        GKAchievement.loadAchievements { achievements, error in
            if let error = error {
                call.reject(error.localizedDescription)
                return
            }
            let rows: [[String: Any]] = (achievements ?? []).map { achievement in
                let id: String? = achievement.identifier
                return [
                    "id": id ?? "",
                    "percent": achievement.percentComplete,
                    "completed": achievement.isCompleted
                ]
            }
            call.resolve(["achievements": rows])
        }
    }

    @objc func show(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let controller = GKGameCenterViewController(state: .achievements)
            controller.gameCenterDelegate = self
            self.bridge?.viewController?.present(controller, animated: true)
            call.resolve()
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }
}
