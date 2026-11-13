import Capacitor
import ARKit

/// Optional game inside the existing com.earnly.arcade app. No separate app ID.
@objc(AlienInvasionPlugin)
public class AlienInvasionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "AlienInvasionPlugin"
    public let jsName = "AlienInvasion"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)
    ]
    private var presenting = false
    @objc func open(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self=self else { call.reject("AR game is unavailable."); return }
            guard #available(iOS 17.0, *), ARWorldTrackingConfiguration.isSupported else {
                call.reject("Room-tracked AR requires iOS 17 or later on a physical AR-capable iPhone."); return
            }
            guard !self.presenting, let parent=self.bridge?.viewController,
                  parent.presentedViewController == nil else {
                call.reject("Close the current screen before starting AR."); return
            }
            let game=GameViewController()
            game.modalPresentationStyle = .fullScreen
            game.onExit = { [weak self, weak game] in
                game?.dismiss(animated:true) { self?.presenting=false }
                self?.notifyListeners("closed",data:[:])
            }
            self.presenting=true
            parent.present(game,animated:true) { call.resolve(["opened":true]) }
        }
    }
}
