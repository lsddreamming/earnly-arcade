import ARKit
import ImageIO
import CoreImage
import Vision
import RoomPlan
import AVFoundation
import Capacitor
import UIKit

@objc(EarnlyRealmsPlugin)
public class EarnlyRealmsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "EarnlyRealmsPlugin"
    public let jsName = "EarnlyRealms"
    public let pluginMethods: [CAPPluginMethod] = ["removeSeat", "identify", "scanRoom", "open", "frame", "place", "saveMap", "close"].compactMap {
        CAPPluginMethod(name: $0, returnType: CAPPluginReturnPromise)
    }
    private var cameraView: ARSCNView?
    private var placement: ARAnchor?
    private var wallFinish: ARAnchor?
    private var seats = [UUID:ARAnchor]()
    private var floorPlacement: ARAnchor?
    private var candidate: ARPlaneAnchor?
    @objc func removeSeat(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let value=call.getString("id"),let id=UUID(uuidString:value),
                  let seat=self.seats.removeValue(forKey:id),let view=self.cameraView else {call.reject("Select a placed seat.");return}
            view.session.remove(anchor:seat);call.resolve()
        }
    }
    @objc func identify(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let view=self.cameraView,let frame=view.session.currentFrame,
                  let orientation=view.window?.windowScene?.interfaceOrientation else {call.reject("Camera is starting.");return}
            let touch=CGPoint(x:call.getDouble("x") ?? 0.5,y:call.getDouble("y") ?? 0.5)
            let p=touch.applying(frame.displayTransform(for:orientation,viewportSize:view.bounds.size).inverted())
            // Work in raw sensor coordinates; crop before applying image orientation.
            let image=CIImage(cvPixelBuffer:frame.capturedImage),bounds=image.extent
            let radius=min(bounds.width,bounds.height)*0.16
            let rect=CGRect(x:p.x*bounds.width-radius,y:(1-p.y)*bounds.height-radius,width:radius*2,height:radius*2).intersection(bounds)
            guard !rect.isEmpty else {call.reject("Tap an object inside the camera view.");return}
            let direction: CGImagePropertyOrientation
            switch orientation {case .portrait: direction = .right
            case .portraitUpsideDown: direction = .left
            case .landscapeLeft: direction = .up
            default: direction = .down}
            let crop=image.cropped(to:rect).oriented(direction)
            DispatchQueue.global(qos:.userInitiated).async {
                let request=VNClassifyImageRequest()
                do {
                    try VNImageRequestHandler(ciImage:crop,options:[:]).perform([request])
                    let suggestions=(request.results ?? []).filter{$0.confidence>=0.45}.prefix(3).map{$0.identifier.replacingOccurrences(of:"_",with:" ")}
                    call.resolve(["suggestions":suggestions])
                } catch {call.reject("Could not identify this object.")}
            }
        }
    }
    @objc func scanRoom(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard #available(iOS 16.0, *), RoomCaptureSession.isSupported,
                  let parent = self.bridge?.viewController, self.cameraView == nil, parent.presentedViewController == nil else {
                call.reject("Room recognition requires a LiDAR-capable iPhone."); return
            }
            AVCaptureDevice.requestAccess(for:.video) { allowed in
                DispatchQueue.main.async {
                    guard allowed else { call.reject("Allow Camera in Settings."); return }
                    let scanner = RealmsRecognitionController()
                    scanner.modalPresentationStyle = .fullScreen
                    scanner.finished = { items in call.resolve(["items":items]) }
                    parent.present(scanner,animated:true)
                }
            }
        }
    }
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
                if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
                    config.frameSemantics.insert(.sceneDepth)
                }
                if let value = call.getString("id"), let id = UUID(uuidString:value) {
                    let folder = FileManager.default.urls(for:.applicationSupportDirectory,in:.userDomainMask)[0]
                    try? FileManager.default.createDirectory(at:folder,withIntermediateDirectories:true)
                    let url = folder.appendingPathComponent("realm-" + id.uuidString + ".armap")
                    self.mapURL = url
                    if let data = try? Data(contentsOf:url),
                       let map = try? NSKeyedUnarchiver.unarchivedObject(ofClass:ARWorldMap.self,from:data) {
                        config.initialWorldMap = map
                        self.wallFinish=map.anchors.first(where:{ $0.name == "earnly-wall" })
                        for seat in map.anchors where seat.name == "earnly-seat" { self.seats[seat.identifier]=seat }
                        self.floorPlacement = map.anchors.first(where:{ $0.name == "earnly-floor" })
                        self.placement = map.anchors.first(where: { $0.name == "earnly-realm" })
                    }
                }
                self.cameraView = view
                view.session.run(config)
                call.resolve(["restoring":self.placement != nil || self.floorPlacement != nil || self.wallFinish != nil || !self.seats.isEmpty, "hasDepth":config.frameSemantics.contains(.sceneDepth)])
            }
        }
    }
    private func numbers(_ m: simd_float4x4) -> [Double] {
        (0..<4).flatMap { column in (0..<4).map { row in Double(m[column][row]) } }
    }
    // Encode the current camera's optical-axis depth in centimetres, in viewport order.
    // Zero denotes an unavailable sample. The web renderer uses the same frame's projection.
    private func viewportDepth(_ f: ARFrame, _ orientation: UIInterfaceOrientation, _ size: CGSize) -> String? {
        guard let image = f.sceneDepth?.depthMap else { return nil }
        let inverse = f.displayTransform(for: orientation, viewportSize: size).inverted()
        let w = CVPixelBufferGetWidth(image), h = CVPixelBufferGetHeight(image)
        CVPixelBufferLockBaseAddress(image,.readOnly)
        defer { CVPixelBufferUnlockBaseAddress(image,.readOnly) }
        guard let base = CVPixelBufferGetBaseAddress(image) else { return nil }
        let stride = CVPixelBufferGetBytesPerRow(image)/MemoryLayout<Float>.size
        let pixels=base.assumingMemoryBound(to:Float.self)
        var out=[UInt8](repeating:0,count:96*96*2)
        for y in 0..<96 {
            for x in 0..<96 {
                let uv=CGPoint(x:(CGFloat(x)+0.5)/96,y:(CGFloat(y)+0.5)/96).applying(inverse)
                let v=pixels[max(0,min(h-1,Int(uv.y*CGFloat(h))))*stride+max(0,min(w-1,Int(uv.x*CGFloat(w))))]
                guard v.isFinite, v>0.1, v<30 else { continue }
                let cm=Int(v*100), offset=(y*96+x)*2
                out[offset]=UInt8(cm & 255);out[offset+1]=UInt8(cm >> 8)
            }
        }
        return Data(out).base64EncodedString()
    }
    @objc func frame(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let view = self.cameraView, let f = view.session.currentFrame,
                  let orientation = view.window?.windowScene?.interfaceOrientation else { call.resolve(["tracking":false]); return }
            let c = f.camera
            var result: JSObject = ["projection": self.numbers(c.projectionMatrix(for: orientation, viewportSize: view.bounds.size, zNear: 0.03, zFar: 50)),
                                    "view": self.numbers(c.viewMatrix(for: orientation)),
                                    "light": Double(f.lightEstimate?.ambientIntensity ?? 1000)]
            if let depth=self.viewportDepth(f,orientation,view.bounds.size) {result["depth"]=depth}
            var seats=[String:[Double]]()
            for anchor in f.anchors {
                if self.seats[anchor.identifier] != nil { seats[anchor.identifier.uuidString]=self.numbers(anchor.transform) }
                if anchor.identifier == self.wallFinish?.identifier {result["wallAnchor"]=self.numbers(anchor.transform)}
            }
            result["seats"]=seats
            if let id = self.placement?.identifier, let a = f.anchors.first(where: { $0.identifier == id }) {
                result["anchor"] = self.numbers(a.transform)
            }
            if let id = self.floorPlacement?.identifier, let a = f.anchors.first(where: { $0.identifier == id }) { result["floorAnchor"] = self.numbers(a.transform) }
            if case .normal = c.trackingState { result["tracking"] = true } else { result["tracking"] = false }
            call.resolve(result)
        }
    }
    @objc func place(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let view = self.cameraView, let frame = view.session.currentFrame else { call.reject("Camera is starting."); return }
            guard case .normal = frame.camera.trackingState else {call.reject("Move slowly until tracking settles.");return}
            let p = CGPoint(x:view.bounds.width * CGFloat(call.getDouble("x") ?? 0.5),y:view.bounds.height * CGFloat(call.getDouble("y") ?? 0.5))
            if call.getString("surface") == "seat" {
                guard self.seats.count<12 else {call.reject("This room already has twelve seats.");return}
                guard let orientation=view.window?.windowScene?.interfaceOrientation,
                      let depth=frame.sceneDepth?.depthMap else {call.reject("Chair replacement requires LiDAR depth.");return}
                let uv=CGPoint(x:p.x/view.bounds.width,y:p.y/view.bounds.height).applying(frame.displayTransform(for:orientation,viewportSize:view.bounds.size).inverted())
                guard uv.x>=0,uv.x<1,uv.y>=0,uv.y<1 else {call.reject("Tap the seat cushion.");return}
                let w=CVPixelBufferGetWidth(depth),h=CVPixelBufferGetHeight(depth)
                CVPixelBufferLockBaseAddress(depth,.readOnly)
                defer {CVPixelBufferUnlockBaseAddress(depth,.readOnly)}
                guard let base=CVPixelBufferGetBaseAddress(depth) else {call.reject("Depth unavailable.");return}
                let z=base.assumingMemoryBound(to:Float.self)[Int(uv.y*CGFloat(h))*CVPixelBufferGetBytesPerRow(depth)/4+Int(uv.x*CGFloat(w))]
                guard z.isFinite,z>0.15,z<5 else {call.reject("Move closer to the seat.");return}
                let k=frame.camera.intrinsics, resolution=frame.camera.imageResolution
                let local=SIMD4<Float>((Float(uv.x*resolution.width)-k.columns.2.x)*z/k.columns.0.x,
                                       -(Float(uv.y*resolution.height)-k.columns.2.y)*z/k.columns.1.y,-z,1)
                let point=frame.camera.transform*local
                let forward=frame.camera.transform.columns.3-point
                guard simd_length(SIMD2<Float>(forward.x,forward.z))>0.05 else {call.reject("Face the front of the chair.");return}
                let n=simd_normalize(SIMD3<Float>(forward.x,0,forward.z))
                var transform=matrix_identity_float4x4
                transform.columns.0=SIMD4<Float>(simd_cross(SIMD3<Float>(0,1,0),n),0)
                transform.columns.2=SIMD4<Float>(n,0);transform.columns.3=point
                let seat=ARAnchor(name:"earnly-seat",transform:transform)
                self.seats[seat.identifier]=seat;view.session.add(anchor:seat);call.resolve(["id":seat.identifier.uuidString]);return
            }
            let horizontal = call.getString("surface") == "floor"
            if horizontal && call.getBool("confirm") == true {
                guard let plane = self.candidate, frame.anchors.contains(where:{$0.identifier == plane.identifier}) else {call.reject("Scan the floor again.");return}
                let anchor = ARAnchor(name:"earnly-floor",transform:plane.transform)
                if let old = self.floorPlacement { view.session.remove(anchor:old) }
                view.session.add(anchor:anchor);self.floorPlacement=anchor;self.candidate=nil;call.resolve();return
            }
            let alignment: ARRaycastQuery.TargetAlignment = horizontal ? .horizontal : .vertical
            var pose: simd_float4x4
            if let q = view.raycastQuery(from:p, allowing:.existingPlaneGeometry, alignment:alignment),
               let hit = view.session.raycast(q).first {
                if horizontal {
                    guard let plane = hit.anchor as? ARPlaneAnchor,
                          plane.classification == .floor || (plane.classification == .none && plane.transform.columns.3.y < frame.camera.transform.columns.3.y - 0.55)
                    else {call.reject("Aim at the floor and scan its edges.");return}
                    self.candidate=plane
                    let geometry=plane.geometry
                    let vertices=geometry.vertices.flatMap { [Double($0.x),Double($0.y)+0.004,Double($0.z)] }
                    call.resolve(["pose":self.numbers(plane.transform),"vertices":vertices,"indices":geometry.triangleIndices.map { Int($0) }]);return
                }
                if call.getString("surface") == "wallFinish", let plane=hit.anchor as? ARPlaneAnchor {
                    let geometry=plane.geometry
                    let anchor=ARAnchor(name:"earnly-wall",transform:plane.transform)
                    if let old=self.wallFinish {view.session.remove(anchor:old)}
                    self.wallFinish=anchor;view.session.add(anchor:anchor)
                    call.resolve(["vertices":geometry.vertices.flatMap { [Double($0.x),Double($0.y)+0.006,Double($0.z)] },
                                  "indices":geometry.triangleIndices.map {Int($0)}]);return
                }
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
            } else if !horizontal && call.getBool("manual") == true {
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
                  self.placement != nil || self.floorPlacement != nil || self.wallFinish != nil || !self.seats.isEmpty else { call.reject("Place an item first."); return }
            let required=Set([self.placement,self.floorPlacement,self.wallFinish].compactMap{$0?.identifier}).union(self.seats.keys)
            session.getCurrentWorldMap { map, _ in
                guard let map = map, required.isSubset(of:Set(map.anchors.map{$0.identifier})) else {
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
                self.floorPlacement=nil; self.candidate=nil;self.wallFinish=nil;self.seats.removeAll()
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

@available(iOS 16.0, *)
private final class RealmsRecognitionController: UIViewController, RoomCaptureSessionDelegate {
    let capture = RoomCaptureView(frame:.zero)
    let summary = UILabel()
    var items = [String:Int]()
    var finished: (([String:Int])->Void)?
    override func viewDidLoad(){
        super.viewDidLoad()
        capture.frame=view.bounds;capture.autoresizingMask=[.flexibleWidth,.flexibleHeight];view.addSubview(capture)
        capture.captureSession.delegate=self
        let done=UIButton(type:.system);done.setTitle("Finish room scan",for:.normal)
        done.addTarget(self,action:#selector(endScan),for:.touchUpInside)
        summary.text="Move slowly around walls and furniture.";summary.numberOfLines=3
        summary.textColor = .white;summary.textAlignment = .center
        let bar=UIStackView(arrangedSubviews:[summary,done]);bar.axis = .vertical;bar.backgroundColor = .black.withAlphaComponent(0.8)
        bar.translatesAutoresizingMaskIntoConstraints=false;view.addSubview(bar)
        NSLayoutConstraint.activate([bar.leadingAnchor.constraint(equalTo:view.leadingAnchor),bar.trailingAnchor.constraint(equalTo:view.trailingAnchor),bar.bottomAnchor.constraint(equalTo:view.safeAreaLayoutGuide.bottomAnchor)])
    }
    override func viewDidAppear(_ animated:Bool){super.viewDidAppear(animated);capture.captureSession.run(configuration:RoomCaptureSession.Configuration())}
    func captureSession(_ session:RoomCaptureSession,didUpdate room:CapturedRoom){
        var counts=["walls":room.walls.count,"doors":room.doors.count,"windows":room.windows.count]
        if #available(iOS 17.0, *) {counts["floors"]=room.floors.count}
        for object in room.objects {counts[String(describing:object.category),default:0]+=1}
        let result=counts.filter{$0.value>0}
        DispatchQueue.main.async {self.items=result;self.summary.text=result.keys.sorted().map{"\(result[$0] ?? 0) \($0)"}.joined(separator:" · ")}
    }
    @objc private func endScan(){capture.captureSession.stop();dismiss(animated:true){self.finished?(self.items)}}
}
