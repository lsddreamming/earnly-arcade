import Capacitor
import ARKit
import UIKit

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
            #if targetEnvironment(simulator) || targetEnvironment(macCatalyst)
            call.reject("Alien Invasion AR is available only on a physical iPhone."); return
            #else
            guard UIDevice.current.userInterfaceIdiom == .phone,
                  !ProcessInfo.processInfo.isiOSAppOnMac else {
                call.reject("Alien Invasion AR is available only on iPhone. Computers and iPads are not supported."); return
            }
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
            #endif
        }
    }
}
