import Capacitor
import GameKit

@objc(GameCenterPlugin)
public class GameCenterPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameCenterPlugin"
    public let jsName = "GameCenter"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "loadScores", returnType: CAPPluginReturnPromise)
    ]

    private var pendingSignIns: [CAPPluginCall] = []
    private var handlerInstalled = false
    private var authFinished = false

    @objc func signIn(_ call: CAPPluginCall) {
        let player = GKLocalPlayer.local
        if player.isAuthenticated {
            call.resolve(playerInfo(player))
            return
        }
        DispatchQueue.main.async {
            if self.authFinished {
                call.resolve(self.playerInfo(player))
                return
            }
            self.pendingSignIns.append(call)
            if self.handlerInstalled { return }
            self.handlerInstalled = true
            player.authenticateHandler = { [weak self] viewController, error in
                guard let self = self else { return }
                if let viewController = viewController {
                    self.bridge?.viewController?.present(viewController, animated: true)
                    return
                }
                self.authFinished = true
                let calls = self.pendingSignIns
                self.pendingSignIns.removeAll()
                var info = self.playerInfo(player)
                if let error = error { info["error"] = error.localizedDescription }
                calls.forEach { $0.resolve(info) }
            }
        }
    }

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId"), let score = call.getInt("score") else {
            call.reject("leaderboardId and score are required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Not signed in to Game Center")
            return
        }
        let context = max(0, call.getInt("context") ?? 0)
        GKLeaderboard.submitScore(score, context: context, player: GKLocalPlayer.local, leaderboardIDs: [leaderboardId]) { error in
            if let error = error { call.reject(error.localizedDescription) } else { call.resolve() }
        }
    }

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            let controller: GKGameCenterViewController
            if let leaderboardId = call.getString("leaderboardId") {
                controller = GKGameCenterViewController(leaderboardID: leaderboardId, playerScope: .global, timeScope: .allTime)
            } else {
                controller = GKGameCenterViewController(state: .leaderboards)
            }
            controller.gameCenterDelegate = self
            self.bridge?.viewController?.present(controller, animated: true)
            call.resolve()
        }
    }

    @objc func loadScores(_ call: CAPPluginCall) {
        guard let leaderboardId = call.getString("leaderboardId") else {
            call.reject("leaderboardId is required")
            return
        }
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Not signed in to Game Center")
            return
        }
        let count = max(1, min(call.getInt("count") ?? 10, 100))
        let scope: GKLeaderboard.PlayerScope = call.getString("scope") == "friends" ? .friendsOnly : .global
        GKLeaderboard.loadLeaderboards(IDs: [leaderboardId]) { boards, error in
            guard let board = boards?.first else {
                call.reject(error?.localizedDescription ?? "Leaderboard not found")
                return
            }
            board.loadEntries(for: scope, timeScope: .allTime, range: NSRange(location: 1, length: count)) { local, entries, total, error in
                if let error = error {
                    call.reject(error.localizedDescription)
                    return
                }
                var result: [String: Any] = [
                    "total": total,
                    "entries": (entries ?? []).map(self.entryInfo)
                ]
                if let local = local { result["player"] = self.entryInfo(local) }
                call.resolve(result)
            }
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }

    private func playerInfo(_ player: GKLocalPlayer) -> [String: Any] {
        return [
            "authenticated": player.isAuthenticated,
            "displayName": player.isAuthenticated ? player.displayName : ""
        ]
    }

    private func entryInfo(_ entry: GKLeaderboard.Entry) -> [String: Any] {
        return [
            "rank": entry.rank,
            "score": entry.score,
            "context": entry.context,
            "name": entry.player.displayName,
            "isLocal": entry.player.gamePlayerID == GKLocalPlayer.local.gamePlayerID
        ]
    }
}
