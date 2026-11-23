import ARKit
import AVFoundation
import Capacitor
import UIKit

@objc(EarnlyRealmsPlugin)
public class EarnlyRealmsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EarnlyRealmsPlugin"
    public let jsName = "EarnlyRealms"
    public let pluginMethods: [CAPPluginMethod] = ["open", "frame", "place", "saveMap", "close"].compactMap {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var cameraView: ARSCNView?
    private var placement: ARAnchor?
    private var mapURL: URL?
    private var previousBackground: UIColor?
    private var previousScrollBackground: UIColor?
    private var previousOpaque = true

    @objc func open(_ call: CAPPluginCall) {
        guard ARWorldTrackingConfiguration.isSupported else {
            call.reject("World tracking requires a supported physical iPhone."); return
        }
        AVCaptureDevice.requestAccess(for: .video) { allowed in
            DispatchQueue.main.async {
                guard allowed else { call.reject("Allow Camera in iPhone Settings to scan a wall."); return }
                guard self.cameraView == nil, let web = self.bridge?.webView, let parent = web.superview else {
                    call.reject("The camera view is unavailable."); return
                }
                let view = ARSCNView(frame: web.frame)
                view.autoresizingMask = [.flexibleWidth, .flexibleHeight]
                parent.insertSubview(view, belowSubview: web)
                self.previousOpaque = web.isOpaque
                self.previousBackground = web.backgroundColor
                self.previousScrollBackground = web.scrollView.backgroundColor
                web.isOpaque = false
                web.backgroundColor = .clear
                web.scrollView.backgroundColor = .clear
                let config = ARWorldTrackingConfiguration()
                config.planeDetection = [.horizontal, .vertical]
                config.isLightEstimationEnabled = true
                if let value = call.getString("id"), let id = UUID(uuidString:value) {
                    let folder = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0]
                    try? FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                    let url = folder.appendingPathComponent("realm-" + id.uuidString + ".armap")
                    self.mapURL = url
                    if let data = try? Data(contentsOf:url),
                       let map = try? NSKeyedUnarchiver.unarchivedObject(ofClass:ARWorldMap.self,from:data) {
                        config.initialWorldMap = map
                        self.placement = map.anchors.first(where: { $0.name == "earnly-realm" })
                    }
                }
                self.cameraView = view
                view.session.run(config)
                call.resolve(["restoring":self.placement != nil])
            }
        }
    }
    private func numbers(_ m: simd_float4x4) -> [Double] {
        (0..<4).flatMap { column in (0..<4).map { row in Double(m[column][row]) } }
    }
    @objc func frame(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let view = self.cameraView, let f = view.session.currentFrame,
                  let orientation = view.window?.windowScene?.interfaceOrientation else { call.resolve(["tracking":false]); return }
            let c = f.camera
            var result: JSObject = ["projection": self.numbers(c.projectionMatrix(for: orientation, viewportSize: view.bounds.size, zNear: 0.03, zFar: 50)),
                                    "view": self.numbers(c.viewMatrix(for: orientation)),
                                    "light": Double(f.lightEstimate?.ambientIntensity ?? 1000)]
            if let id = self.placement?.identifier, let a = f.anchors.first(where: { $0.identifier == id }) {
                result["anchor"] = self.numbers(a.transform)
            }
            if case .normal = c.trackingState { result["tracking"] = true } else { result["tracking"] = false }
            call.resolve(result)
        }
    }
    @objc func place(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let view = self.cameraView, let frame = view.session.currentFrame else { call.reject("Camera is starting."); return }
            let p = CGPoint(x:view.bounds.midX,y:view.bounds.midY)
            let horizontal = call.getString("surface") == "floor"
            let alignment: ARRaycastQuery.TargetAlignment = horizontal ? .horizontal : .vertical
            var pose: simd_float4x4
            if let q = view.raycastQuery(from:p, allowing:.existingPlaneGeometry, alignment:alignment),
               let hit = view.session.raycast(q).first {
                pose = hit.worldTransform
                if !horizontal {
                    // Build an upright wall basis with its front facing the viewer.
                    var n = SIMD3<Float>(pose.columns.1.x, 0, pose.columns.1.z)
                    guard simd_length(n) > 0.01 else { call.reject("Aim at a vertical wall."); return }
                    n = simd_normalize(n)
                    let delta = frame.camera.transform.columns.3 - pose.columns.3
                    if simd_dot(n, SIMD3<Float>(delta.x,delta.y,delta.z)) < 0 { n = -n }
                    let right = simd_cross(SIMD3<Float>(0,1,0), n)
                    pose.columns.0 = SIMD4<Float>(right,0)
                    pose.columns.1 = SIMD4<Float>(0,1,0,0)
                    pose.columns.2 = SIMD4<Float>(n,0)
                }
            } else if call.getBool("manual") == true {
                let c = frame.camera.transform
                pose = matrix_identity_float4x4
                let n = simd_normalize(SIMD3<Float>(sin(frame.camera.eulerAngles.y),0,cos(frame.camera.eulerAngles.y)))
                pose.columns.0 = SIMD4<Float>(simd_cross(SIMD3<Float>(0,1,0),n),0)
                pose.columns.2 = SIMD4<Float>(n,0)
                pose.columns.3 = c.columns.3 - c.columns.2 * 1.7
                pose.columns.3.w = 1
            } else { call.reject("Move slowly along the surface, then try again or choose manual placement."); return }
            if let old = self.placement { view.session.remove(anchor:old) }
            let anchor = ARAnchor(name:"earnly-realm",transform:pose)
            view.session.add(anchor:anchor)
            self.placement = anchor
            call.resolve()
        }
    }
    @objc func saveMap(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let session = self.cameraView?.session, let url = self.mapURL,
                  let placed = self.placement else { call.reject("Place an item first."); return }
            session.getCurrentWorldMap { map, _ in
                guard let map = map, map.anchors.contains(where:{ $0.identifier == placed.identifier }) else {
                    call.reject("Scan more of the room, then save again."); return
                }
                do {
                    let data = try NSKeyedArchiver.archivedData(withRootObject:map,requiringSecureCoding:true)
                    try data.write(to:url,options:[.atomic,.completeFileProtection])
                    call.resolve()
                } catch { call.reject("Could not save this room map.") }
            }
        }
    }
    @objc func close(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if let view = self.cameraView {
                view.session.pause()
                view.removeFromSuperview()
                self.cameraView = nil
                self.placement = nil
                self.mapURL = nil
                if let web = self.bridge?.webView {
                    web.isOpaque = self.previousOpaque
                    web.backgroundColor = self.previousBackground
                    web.scrollView.backgroundColor = self.previousScrollBackground
                }
            }
            call.resolve()
        }
    }
}
