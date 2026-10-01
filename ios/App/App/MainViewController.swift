import UIKit
import Capacitor

class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(GameCenterPlugin())
        bridge?.registerPluginInstance(StorePlugin())
        bridge?.registerPluginInstance(AchievementsPlugin())
        bridge?.registerPluginInstance(SharePlugin())
        bridge?.registerPluginInstance(MatchPlugin())
        bridge?.registerPluginInstance(CloudSavePlugin())
    }
}
