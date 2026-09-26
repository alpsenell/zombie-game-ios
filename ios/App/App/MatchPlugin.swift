import Capacitor
import GameKit

@objc(MatchPlugin)
public class MatchPlugin: CAPPlugin, CAPBridgedPlugin, GKMatchmakerViewControllerDelegate, GKMatchDelegate, GKLocalPlayerListener {
    public let identifier = "MatchPlugin"
    public let jsName = "Match"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "findMatch", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "send", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "disconnect", returnType: CAPPluginReturnPromise)
    ]

    private var match: GKMatch?
    private var pendingCall: CAPPluginCall?
    private var announced = false
    private var listening = false
    private var authObserver: NSObjectProtocol?

    override public func load() {
        authObserver = NotificationCenter.default.addObserver(forName: .GKPlayerAuthenticationDidChangeNotificationName, object: nil, queue: .main) { [weak self] _ in
            self?.registerListener()
        }
        DispatchQueue.main.async { self.registerListener() }
    }

    deinit {
        if let authObserver = authObserver { NotificationCenter.default.removeObserver(authObserver) }
    }

    private func registerListener() {
        guard !listening, GKLocalPlayer.local.isAuthenticated else { return }
        listening = true
        GKLocalPlayer.local.register(self)
    }

    @objc func findMatch(_ call: CAPPluginCall) {
        guard GKLocalPlayer.local.isAuthenticated else {
            call.reject("Sign in to Game Center to play co-op")
            return
        }
        let minPlayers = max(2, min(4, call.getInt("minPlayers") ?? 2))
        let maxPlayers = max(minPlayers, min(4, call.getInt("maxPlayers") ?? 4))
        let invite = call.getBool("invite") ?? false
        DispatchQueue.main.async {
            self.registerListener()
            let request = GKMatchRequest()
            request.minPlayers = minPlayers
            request.maxPlayers = maxPlayers
            request.defaultNumberOfPlayers = minPlayers
            request.inviteMessage = "Hold the line with me in Last Stand: Deadzone"
            guard let controller = GKMatchmakerViewController(matchRequest: request) else {
                call.reject("Matchmaking is unavailable")
                return
            }
            controller.matchmakingMode = invite ? .inviteOnly : .default
            controller.canStartWithMinimumPlayers = true
            self.showMatchmaker(controller, call: call)
        }
    }

    @objc func send(_ call: CAPPluginCall) {
        guard let match = match else {
            call.reject("Not in a match")
            return
        }
        guard let text = call.getString("data") else {
            call.reject("data is required")
            return
        }
        let payload: Data
        if call.getBool("base64") ?? false {
            guard let decoded = Data(base64Encoded: text) else {
                call.reject("data is not valid base64")
                return
            }
            payload = decoded
        } else {
            payload = Data(text.utf8)
        }
        let mode: GKMatch.SendDataMode = (call.getBool("reliable") ?? true) ? .reliable : .unreliable
        do {
            if let ids = call.getArray("to", String.self), !ids.isEmpty {
                let targets = match.players.filter { ids.contains($0.gamePlayerID) }
                if !targets.isEmpty { try match.send(payload, to: targets, dataMode: mode) }
            } else {
                try match.sendData(toAllPlayers: payload, with: mode)
            }
            call.resolve()
        } catch {
            call.reject(error.localizedDescription)
        }
    }

    @objc func disconnect(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.leaveMatch()
            call.resolve()
        }
    }

    private func showMatchmaker(_ controller: GKMatchmakerViewController, call: CAPPluginCall?) {
        controller.matchmakerDelegate = self
        pendingCall?.resolve(["status": "cancelled"])
        pendingCall = call
        guard let root = bridge?.viewController else {
            pendingCall?.reject("No view controller to present matchmaking")
            pendingCall = nil
            return
        }
        (root.presentedViewController ?? root).present(controller, animated: true)
    }

    private func leaveMatch() {
        match?.delegate = nil
        match?.disconnect()
        match = nil
        announced = false
    }

    private func adopt(_ newMatch: GKMatch) {
        if match !== newMatch { leaveMatch() }
        match = newMatch
        announced = false
        newMatch.delegate = self
        announceIfReady()
    }

    private func announceIfReady() {
        guard let match = match, !announced, match.expectedPlayerCount == 0 else { return }
        announced = true
        let local = GKLocalPlayer.local
        var players: [[String: Any]] = [["id": local.gamePlayerID, "name": local.displayName]]
        for player in match.players {
            players.append(["id": player.gamePlayerID, "name": player.displayName])
        }
        notifyListeners("matchFound", data: ["players": players, "localId": local.gamePlayerID], retainUntilConsumed: true)
    }

    public func matchmakerViewControllerWasCancelled(_ viewController: GKMatchmakerViewController) {
        viewController.dismiss(animated: true)
        pendingCall?.resolve(["status": "cancelled"])
        pendingCall = nil
    }

    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFailWithError error: Error) {
        viewController.dismiss(animated: true)
        if let call = pendingCall {
            call.reject(error.localizedDescription)
            pendingCall = nil
        } else {
            notifyListeners("error", data: ["message": error.localizedDescription])
        }
    }

    public func matchmakerViewController(_ viewController: GKMatchmakerViewController, didFind match: GKMatch) {
        viewController.dismiss(animated: true)
        adopt(match)
        pendingCall?.resolve(["status": "found"])
        pendingCall = nil
    }

    public func match(_ match: GKMatch, didReceive data: Data, fromRemotePlayer player: GKPlayer) {
        guard match === self.match else { return }
        let text = String(data: data, encoding: .utf8) ?? data.base64EncodedString()
        notifyListeners("data", data: ["from": player.gamePlayerID, "data": text])
    }

    public func match(_ match: GKMatch, player: GKPlayer, didChange state: GKPlayerConnectionState) {
        guard match === self.match else { return }
        switch state {
        case .connected:
            if announced {
                notifyListeners("playerState", data: ["id": player.gamePlayerID, "name": player.displayName, "connected": true])
            } else {
                announceIfReady()
            }
        case .disconnected:
            notifyListeners("playerState", data: ["id": player.gamePlayerID, "name": player.displayName, "connected": false])
        default:
            break
        }
    }

    public func match(_ match: GKMatch, didFailWithError error: Error?) {
        guard match === self.match else { return }
        notifyListeners("error", data: ["message": error?.localizedDescription ?? "Match connection failed"])
    }

    public func player(_ player: GKPlayer, didAccept invite: GKInvite) {
        DispatchQueue.main.async {
            guard let controller = GKMatchmakerViewController(invite: invite) else { return }
            self.showMatchmaker(controller, call: nil)
        }
    }

    public func player(_ player: GKPlayer, didRequestMatchWithRecipients recipientPlayers: [GKPlayer]) {
        DispatchQueue.main.async {
            let request = GKMatchRequest()
            request.minPlayers = 2
            request.maxPlayers = 4
            request.recipients = recipientPlayers
            guard let controller = GKMatchmakerViewController(matchRequest: request) else { return }
            self.showMatchmaker(controller, call: nil)
        }
    }
}
