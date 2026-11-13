import UIKit
import ARKit
import SceneKit
import RoomPlan
import AVFoundation
import simd

@available(iOS 17.0, *)
final class GameViewController: UIViewController, ARSessionDelegate, RoomCaptureSessionDelegate, UIGestureRecognizerDelegate {
    /// Set by Earnly's native bridge when this game is presented inside the arcade.
    var onExit: (() -> Void)?
    private let ar = ARSCNView()
    private let world = InvasionWorld()
    private let root = SCNNode()
    private var originAnchor: ARAnchor?
    private var nodes: [UUID:SCNNode] = [:]
    private var portalNodes: [UUID:SCNNode] = [:]
    private var portalPlacements: [UUID:PortalPlacement] = [:]
    private var selectedEntrance: UUID?
    private var portalDrag: (id:UUID, placement:PortalPlacement, grab:V3, corner:SIMD2<Float>?)?
    private var portalPinch: (id:UUID, placement:PortalPlacement)?
    private var roomCapture: RoomCaptureSession?
    private var room: CapturedRoom?
    private var clock: CADisplayLink?
    private var previous: CFTimeInterval = 0
    private var phase = "lobby"
    private var readyTracking = false
    private var sessionFailed = false
    private var safetyOrigin = V3.zero
    private var selectedPortal = PortalKind.air
    private var firing = false
    private var gun: SCNNode?
    private var flash: SCNNode?
    private var lastSound: Float = 0
    private var elapsed: Float = 0
    private var lastHealth: Float = 100
    private var verificationMode = false
    private var verificationIDs: [UUID] = []
    private var sawAway = false
    private var returned = false
    private var awayTime: Float = 0
    private var startForward = V3.zero

    private let stats = UILabel(), hint = UILabel(), threat = UILabel(), crosshair = UILabel()
    private let card = UIStackView(), controls = UIStackView(), top = UIStackView()
    private let primary = UIButton(type:.system), secondary = UIButton(type:.system)
    private let scanButton = UIButton(type:.system), placeButton = UIButton(type:.system)
    private let typeButton = UIButton(type:.system), testButton = UIButton(type:.system)
    private let fireButton = UIButton(type:.system), reloadButton = UIButton(type:.system)
    private let weaponButton = UIButton(type:.system), pauseButton = UIButton(type:.system)
    private let exitButton = UIButton(type:.system)
    private let lockButton=UIButton(type:.system), deletePortalButton=UIButton(type:.system)
    private let closerButton=UIButton(type:.system), fartherButton=UIButton(type:.system)
    private let editControls=UIStackView(), depthControls=UIStackView()
    private let titleLabel = UILabel(), bodyLabel = UILabel()

    override var prefersStatusBarHidden: Bool { true }
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .portrait }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = UIColor(red:0.025,green:0.035,blue:0.08,alpha:1)
        ar.frame=view.bounds; ar.autoresizingMask=[.flexibleWidth,.flexibleHeight]
        ar.scene=SCNScene(); ar.autoenablesDefaultLighting=true
        ar.automaticallyUpdatesLighting=true; ar.preferredFramesPerSecond=60
        ar.antialiasingMode = .multisampling2X
        ar.session.delegate=self; ar.scene.rootNode.addChildNode(root); view.addSubview(ar)
        buildUI()
        let tap=UITapGestureRecognizer(target:self,action:#selector(selectPortal(_:)))
        let pan=UIPanGestureRecognizer(target:self,action:#selector(dragPortal(_:))); pan.maximumNumberOfTouches=1
        let pinch=UIPinchGestureRecognizer(target:self,action:#selector(resizePortal(_:)))
        let gestures:[UIGestureRecognizer]=[tap,pan,pinch]
        for gesture in gestures { gesture.delegate=self; ar.addGestureRecognizer(gesture) }
        NotificationCenter.default.addObserver(self,selector:#selector(background),name:UIApplication.willResignActiveNotification,object:nil)
        NotificationCenter.default.addObserver(self,selector:#selector(foreground),name:UIApplication.didBecomeActiveNotification,object:nil)
        clock=CADisplayLink(target:self,selector:#selector(tick)); clock?.add(to:.main,forMode:.common)
        lobby()
    }
    deinit { clock?.invalidate(); ar.session.pause() }

    private func style(_ b:UIButton,_ text:String,_ action:Selector) {
        b.setTitle(text,for:.normal); b.titleLabel?.font = .systemFont(ofSize:15,weight:.bold)
        b.setTitleColor(.white,for:.normal); b.backgroundColor=UIColor(white:0.12,alpha:0.92)
        b.layer.cornerRadius=16; b.contentEdgeInsets=UIEdgeInsets(top:15,left:14,bottom:15,right:14)
        b.addTarget(self,action:action,for:.touchUpInside)
    }
    private func buildUI() {
        for label in [stats,hint,threat,crosshair,titleLabel,bodyLabel] {
            label.textColor = .white; label.numberOfLines=0; label.textAlignment = .center
            label.font = .systemFont(ofSize:15,weight:.semibold)
        }
        stats.font = .monospacedDigitSystemFont(ofSize:15,weight:.bold)
        hint.backgroundColor=UIColor(white:0,alpha:0.65); hint.layer.cornerRadius=12; hint.clipsToBounds=true
        threat.textColor = .systemOrange; crosshair.text="⊕"; crosshair.font = .systemFont(ofSize:40,weight:.ultraLight)
        titleLabel.font = .systemFont(ofSize:31,weight:.heavy)
        bodyLabel.font = .systemFont(ofSize:15,weight:.regular)
        style(primary,"Play · enable camera",#selector(primaryAction))
        primary.backgroundColor=UIColor(red:0.13,green:0.42,blue:0.95,alpha:1)
        style(secondary,"Resume",#selector(secondaryAction))
        style(scanButton,"Smart room scan",#selector(smartScan))
        style(placeButton,"Mark floor",#selector(place))
        style(typeButton,"Entrance: Air",#selector(nextType))
        style(testButton,"180° tracking test",#selector(startTest))
        style(fireButton,"FIRE",#selector(stopFire))
        fireButton.addTarget(self,action:#selector(startFire),for:.touchDown)
        fireButton.addTarget(self,action:#selector(stopFire),for:[.touchUpOutside,.touchCancel])
        fireButton.backgroundColor=UIColor(red:0.06,green:0.5,blue:0.9,alpha:0.95)
        style(reloadButton,"Reload",#selector(reloadGun)); style(weaponButton,"Plasma ⇄",#selector(changeWeapon))
        style(pauseButton,"Ⅱ",#selector(pauseGame)); style(exitButton,"Exit",#selector(exitGame))
        top.axis = .horizontal; top.spacing=8
        [exitButton,stats,pauseButton].forEach{top.addArrangedSubview($0)}
        stats.setContentHuggingPriority(.defaultLow,for:.horizontal)
        card.axis = .vertical; card.spacing=13; card.isLayoutMarginsRelativeArrangement=true
        card.layoutMargins=UIEdgeInsets(top:24,left:20,bottom:24,right:20)
        card.backgroundColor=UIColor(red:0.03,green:0.05,blue:0.12,alpha:0.94); card.layer.cornerRadius=24
        [titleLabel,bodyLabel,primary,secondary,scanButton,testButton].forEach{card.addArrangedSubview($0)}
        controls.axis = .vertical; controls.spacing=10
        let setup=UIStackView(arrangedSubviews:[typeButton,placeButton]); setup.spacing=8; setup.distribution = .fillEqually
        let combat=UIStackView(arrangedSubviews:[weaponButton,reloadButton,fireButton]); combat.spacing=8; combat.distribution = .fillEqually
        style(lockButton,"Lock portal",#selector(lockPortal)); style(deletePortalButton,"Remove",#selector(removePortal))
        style(closerButton,"Closer",#selector(movePortalCloser)); style(fartherButton,"Farther",#selector(movePortalFarther))
        for row in [editControls,depthControls] { row.spacing=8; row.distribution = .fillEqually; row.isHidden=true }
        [lockButton,deletePortalButton].forEach{editControls.addArrangedSubview($0)}
        [closerButton,fartherButton].forEach{depthControls.addArrangedSubview($0)}
        [setup,combat,editControls,depthControls].forEach{controls.addArrangedSubview($0)}
        for v in [top,hint,threat,crosshair,card,controls] { v.translatesAutoresizingMaskIntoConstraints=false; view.addSubview(v) }
        let s=view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            top.topAnchor.constraint(equalTo:s.topAnchor,constant:8),top.leadingAnchor.constraint(equalTo:s.leadingAnchor,constant:12),top.trailingAnchor.constraint(equalTo:s.trailingAnchor,constant:-12),
            hint.topAnchor.constraint(equalTo:top.bottomAnchor,constant:8),hint.leadingAnchor.constraint(equalTo:s.leadingAnchor,constant:16),hint.trailingAnchor.constraint(equalTo:s.trailingAnchor,constant:-16),hint.heightAnchor.constraint(greaterThanOrEqualToConstant:60),
            threat.topAnchor.constraint(equalTo:hint.bottomAnchor,constant:10),threat.centerXAnchor.constraint(equalTo:s.centerXAnchor),
            crosshair.centerXAnchor.constraint(equalTo:view.centerXAnchor),crosshair.centerYAnchor.constraint(equalTo:view.centerYAnchor),
            card.centerYAnchor.constraint(equalTo:s.centerYAnchor),card.leadingAnchor.constraint(equalTo:s.leadingAnchor,constant:20),card.trailingAnchor.constraint(equalTo:s.trailingAnchor,constant:-20),
            controls.bottomAnchor.constraint(equalTo:s.bottomAnchor,constant:-12),controls.leadingAnchor.constraint(equalTo:s.leadingAnchor,constant:12),controls.trailingAnchor.constraint(equalTo:s.trailingAnchor,constant:-12)
        ])
    }
    private func lobby() {
        phase="lobby"; titleLabel.text="ALIEN\nINVASION AR"
        bodyLabel.text="Scan your floor. Place a floating portal or one on a doorway or wall. Drag and resize its opening, then lock it in your room.\n\nStand in a clear spot and turn in place during combat. Camera and room data stay on this device."
        primary.setTitle("Play · enable camera",for:.normal); primary.isHidden=false
        secondary.isHidden=true; scanButton.isHidden=true; testButton.isHidden=true
        card.isHidden=false; controls.isHidden=true; top.isHidden=onExit == nil; hint.isHidden=true; crosshair.isHidden=true; threat.isHidden=true
        stats.text="AR PLAYTEST"; pauseButton.isHidden=true
    }
    @objc private func primaryAction() {
        if phase == "lobby" {
            guard ARWorldTrackingConfiguration.isSupported else { bodyLabel.text="This device does not support ARKit world tracking. Use a physical AR-capable iPhone. The simulator cannot test AR."; return }
            AVCaptureDevice.requestAccess(for:.video) { [weak self] allowed in
                DispatchQueue.main.async {
                    guard let self=self else{return}
                    if allowed { self.beginScan(reset:true) }
                    else {
                        let appName=Bundle.main.object(forInfoDictionaryKey:"CFBundleDisplayName") as? String ?? "Earnly Arcade"
                        self.bodyLabel.text="Camera access is off. Open Settings → Apps → \(appName) → Camera, then return and tap Play."
                    }
                }
            }
        } else if phase == "scanningRoom" { finishSmartScan() }
        else if phase == "scan" { startCombat(test:false) }
        else { beginScan(reset:true) }
    }
    private func config() -> ARWorldTrackingConfiguration {
        let c=ARWorldTrackingConfiguration(); c.planeDetection=[.horizontal,.vertical]
        c.environmentTexturing = .automatic
        return c
    }
    private func beginScan(reset:Bool) {
        roomCapture?.stop(); roomCapture=nil; room=nil; world.reset(); world.entrances=[]
        nodes.values.forEach{$0.removeFromParentNode()}; nodes.removeAll()
        portalNodes.values.forEach{$0.removeFromParentNode()}; portalNodes=[:]; portalPlacements=[:]; originAnchor=nil
        selectedEntrance=nil; portalDrag=nil; portalPinch=nil; editControls.isHidden=true; depthControls.isHidden=true
        root.simdTransform=matrix_identity_float4x4; root.isPaused=false
        gun?.removeFromParentNode(); gun=nil
        readyTracking=false; sessionFailed=false; phase="scan"; firing=false; previous=0
        ar.session.delegate=self; ar.session.run(config(),options:reset ? [.resetTracking,.removeExistingAnchors] : [])
        UIApplication.shared.isIdleTimerDisabled=true
        top.isHidden=false; hint.isHidden=false; crosshair.isHidden=false; controls.isHidden=false; threat.isHidden=true
        controls.arrangedSubviews[0].isHidden=false; controls.arrangedSubviews[1].isHidden=true
        titleLabel.text="Find your floor"
        bodyLabel.text="Slowly point at a clear floor until tracking is ready. Hide this card, aim the crosshair at the floor, then tap Mark floor."
        primary.isHidden=true; secondary.isHidden=false; secondary.setTitle("Show camera",for:.normal)
        scanButton.isHidden = !RoomCaptureSession.isSupported; scanButton.setTitle("Smart room scan · LiDAR",for:.normal)
        testButton.isHidden=true; card.isHidden=false; placeButton.setTitle("Mark floor",for:.normal)
        typeButton.isEnabled=false; pauseButton.isHidden=true
    }
    @objc private func secondaryAction() {
        if phase == "scan" { card.isHidden=true; refreshPortalEditor() }
        else if phase == "paused" {
            guard readyTracking, !sessionFailed, let frame=ar.session.currentFrame else { bodyLabel.text="Tracking is not ready. Slowly look at the scanned area, or restart the scan."; return }
            let p=frame.camera.transform.columns.3.xyz
            guard isWithinStationaryCombatArea(p,origin:safetyOrigin) else { bodyLabel.text="The phone moved outside the starting area. Restart the scan from a clear stationary spot."; return }
            phase="combat"; world.paused=false; root.isPaused=false; card.isHidden=true
        }
    }
    @objc private func nextType() {
        let all=PortalKind.allCases; let i=all.firstIndex(of:selectedPortal)!
        selectedPortal=all[(i+1)%all.count]; typeButton.setTitle("Entrance: \(selectedPortal.rawValue)",for:.normal)
    }
    @objc private func place() {
        guard phase == "scan", readyTracking, let frame=ar.session.currentFrame else { hint.text="Tracking needs more detail. Slowly look around a well-lit area."; return }
        guard world.entrances.count<6 else { hint.text="Six entrances placed. Tap a portal to edit it."; return }
        if originAnchor != nil && selectedPortal == .air {
            // Take one snapshot of the tracked pose. Never attach the portal to
            // the camera or update this transform just because the phone turns.
            var transform=frame.camera.transform
            transform.columns.3 -= SIMD4<Float>(transform.columns.2.xyz*2,0)
            addPortal(transform:transform,kind:.air,roomPlan:true,editable:true)
            return
        }
        let center=CGPoint(x:ar.bounds.midX,y:ar.bounds.midY)
        let alignment: ARRaycastQuery.TargetAlignment = originAnchor == nil || selectedPortal == .ceiling ? .horizontal : .vertical
        guard let q=ar.raycastQuery(from:center,allowing:.existingPlaneGeometry,alignment:alignment),
              let result=ar.session.raycast(q).first, let plane=result.anchor as? ARPlaneAnchor else { hint.text="No recognized surface here yet. Move the phone slowly, or choose Air after marking the floor."; return }
        let y=result.worldTransform.columns.3.y, cameraY=frame.camera.transform.columns.3.y
        if originAnchor == nil {
            switch plane.classification {
            case .floor: break
            case .none(_) where y < cameraY-0.7: break
            default:
                hint.text="Aim at a clear floor below you. Tables and other classified surfaces cannot be the floor."
                return
            }
            setOrigin(at:result.worldTransform.columns.3.xyz)
            hint.text="Floor confirmed. Choose Air to place a floating portal, or aim at a wall, doorway or window."
            placeButton.setTitle("Place portal",for:.normal); typeButton.isEnabled=true
        } else {
            if selectedPortal == .ceiling && !(plane.classification == .ceiling || y > cameraY+0.25) { hint.text="Aim overhead at a recognized ceiling surface."; return }
            var transform=result.worldTransform
            transform.columns.3 += SIMD4<Float>(transform.columns.1.xyz*0.015,0)
            addPortal(transform:transform,kind:selectedPortal,roomPlan:false,editable:true)
        }
    }
    private func setOrigin(at p:V3) {
        var transform=matrix_identity_float4x4; transform.columns.3=SIMD4<Float>(p,1)
        let anchor=ARAnchor(name:"invasion-world",transform:transform)
        originAnchor=anchor; root.simdTransform=transform; ar.session.add(anchor:anchor)
    }
    private func addPortal(transform:simd_float4x4,kind:PortalKind,roomPlan:Bool,editable:Bool=false) {
        guard originAnchor != nil, world.entrances.count<6 else{return}
        // Normalize every portal to its local XY plane, with Z as its normal.
        let facing=roomPlan ? transform : transform*simd_float4x4(simd_quatf(angle: -.pi/2,axis:V3(1,0,0)))
        let local=simd_inverse(root.simdTransform)*facing
        let p=local.columns.3.xyz
        if world.entrances.contains(where:{length($0.position-p)<0.6}) { hint.text="Move the aim away from the other entrance first."; return }
        let entrance=Entrance(position:p,kind:kind); world.entrances.append(entrance)
        let placement=PortalPlacement(center:p,right:normalized(local.columns.0.xyz),up:normalized(local.columns.1.xyz),width:0.9,height:kind == .ceiling ? 0.9 : 1.4,locked:!editable)
        portalPlacements[entrance.id]=placement
        let node=SCNNode(); root.addChildNode(node); portalNodes[entrance.id]=node
        if editable {
            let previous=selectedEntrance; selectedEntrance=entrance.id; card.isHidden=true
            if let previous=previous { renderPortal(previous) }
        }
        renderPortal(entrance.id); refreshPortalEditor(); burst(at:p,color:.systemPurple)
    }
    private func renderPortal(_ id:UUID) {
        guard let p=portalPlacements[id],let node=portalNodes[id] else{return}
        node.simdTransform=simd_float4x4(columns:(SIMD4<Float>(p.right,0),SIMD4<Float>(p.up,0),SIMD4<Float>(p.normal,0),SIMD4<Float>(p.center,1)))
        node.childNodes.forEach{$0.removeFromParentNode()}
        let editing=selectedEntrance == id && !p.locked
        let color:UIColor=editing ? .cyan : .systemPurple
        let opening=SCNNode(); opening.scale=SCNVector3(p.width,p.height,1); node.addChildNode(opening)
        let ring=SCNTorus(ringRadius:0.5,pipeRadius:0.018); ring.firstMaterial=material(color,glow:true)
        let r=SCNNode(geometry:ring); r.eulerAngles.x = .pi/2; opening.addChildNode(r)
        let hole=SCNCylinder(radius:0.48,height:0.006); hole.firstMaterial=material(UIColor(white:0.02,alpha:0.8))
        let h=SCNNode(geometry:hole); h.eulerAngles.x = .pi/2; opening.addChildNode(h)
        r.runAction(.repeatForever(.sequence([.fadeOpacity(to:0.55,duration:0.7),.fadeOpacity(to:1,duration:0.7)])))
        if world.entrances.first(where:{$0.id == id})?.kind == .wall {
            for i in 0..<7 {
                let a=Float(i)*2 * .pi/7
                let crack=SCNNode(geometry:SCNBox(width:0.018,height:0.24,length:0.008,chamferRadius:0.004))
                crack.geometry?.firstMaterial=material(color,glow:true)
                crack.position=SCNVector3(sin(a)*p.width*0.64,cos(a)*p.height*0.64,0); crack.eulerAngles.z = -a; node.addChildNode(crack)
            }
        }
        if editing {
            for x:Float in [-1,1] { for y:Float in [-1,1] {
                let handle=ball(0.045,.cyan,SCNVector3(x*p.width/2,y*p.height/2,0.035),node)
                handle.geometry?.firstMaterial=material(.cyan,glow:true)
            } }
        }
    }
    private func refreshPortalEditor() {
        guard phase == "scan",let id=selectedEntrance,let p=portalPlacements[id] else { editControls.isHidden=true; depthControls.isHidden=true; return }
        editControls.isHidden=false
        depthControls.isHidden=p.locked || world.entrances.first(where:{$0.id == id})?.kind != .air
        lockButton.setTitle(p.locked ? "Edit portal" : "Lock portal",for:.normal)
        hint.text=p.locked ? "Portal locked in your room. Tap Edit portal to change it." : String(format:"Drag body to move · drag corners or pinch to resize\n%.2f m × %.2f m · Lock when ready",p.width,p.height)
    }
    private func applyPortal(_ id:UUID,_ placement:PortalPlacement) {
        guard let i=world.entrances.firstIndex(where:{$0.id == id}),let frame=ar.session.currentFrame else{return}
        let camera=(simd_inverse(root.simdTransform)*frame.camera.transform).columns.3.xyz
        guard length(placement.center-camera)>=0.8,length(placement.center-camera)<=8 else { hint.text="Keep the entrance between 0.8 and 8 metres away."; return }
        portalPlacements[id]=placement
        world.entrances[i].position=placement.center
        renderPortal(id); refreshPortalEditor()
    }
    @objc private func lockPortal() {
        guard phase == "scan",readyTracking,let id=selectedEntrance,var p=portalPlacements[id] else{return}
        p.locked.toggle(); portalPlacements[id]=p; portalDrag=nil; portalPinch=nil
        renderPortal(id); refreshPortalEditor()
        if p.locked && portalPlacements.values.allSatisfy({$0.locked}) { showReady() }
    }
    @objc private func removePortal() {
        guard phase == "scan",let id=selectedEntrance else{return}
        portalNodes.removeValue(forKey:id)?.removeFromParentNode(); portalPlacements.removeValue(forKey:id)
        world.entrances.removeAll{$0.id == id}; selectedEntrance=nil; portalDrag=nil; portalPinch=nil
        refreshPortalEditor(); card.isHidden=true; hint.text="Choose an entrance type, then tap Place portal."
        if !world.entrances.isEmpty && portalPlacements.values.allSatisfy({$0.locked}) { showReady() }
    }
    @objc private func movePortalCloser() { shiftPortalDepth(0.25) }
    @objc private func movePortalFarther() { shiftPortalDepth(-0.25) }
    private func shiftPortalDepth(_ amount:Float) {
        guard phase == "scan",readyTracking,let id=selectedEntrance,var p=portalPlacements[id],!p.locked,
              world.entrances.first(where:{$0.id == id})?.kind == .air,let frame=ar.session.currentFrame else{return}
        let camera=(simd_inverse(root.simdTransform)*frame.camera.transform).columns.3.xyz
        p.center += normalized(camera-p.center)*amount
        applyPortal(id,p)
    }
    func gestureRecognizerShouldBegin(_ gestureRecognizer:UIGestureRecognizer)->Bool {
        phase == "scan" && readyTracking && originAnchor != nil && card.isHidden
    }
    private func touchRay(_ point:CGPoint)->(origin:V3,direction:V3) {
        let near=ar.unprojectPoint(SCNVector3(Float(point.x),Float(point.y),0))
        let far=ar.unprojectPoint(SCNVector3(Float(point.x),Float(point.y),1))
        let inverse=simd_inverse(root.simdTransform)
        let origin=(inverse*SIMD4<Float>(near.x,near.y,near.z,1)).xyz
        let target=(inverse*SIMD4<Float>(far.x,far.y,far.z,1)).xyz
        return (origin,normalized(target-origin))
    }
    private func portalHit(_ point:CGPoint)->(id:UUID,point:V3)? {
        let ray=touchRay(point)
        return portalPlacements.compactMap { id,p -> (id:UUID,point:V3)? in
            guard let hit=p.intersection(origin:ray.origin,direction:ray.direction),p.contains(hit) else{return nil}
            return (id,hit)
        }.min(by:{length($0.point-ray.origin)<length($1.point-ray.origin)})
    }
    private func selectEntrance(_ id:UUID) {
        let old=selectedEntrance; selectedEntrance=id
        if let old=old { renderPortal(old) }; renderPortal(id); refreshPortalEditor()
    }
    @objc private func selectPortal(_ gesture:UITapGestureRecognizer) {
        guard phase == "scan",readyTracking,let hit=portalHit(gesture.location(in:ar)) else{return}
        selectEntrance(hit.id)
    }
    @objc private func dragPortal(_ gesture:UIPanGestureRecognizer) {
        guard phase == "scan",readyTracking else { portalDrag=nil; return }
        let point=gesture.location(in:ar),ray=touchRay(point)
        if gesture.state == .began {
            guard let hit=portalHit(point),let p=portalPlacements[hit.id] else{return}
            selectEntrance(hit.id)
            guard !p.locked else{return}
            let offset=hit.point-p.center,x=dot(offset,p.right),y=dot(offset,p.up)
            let corner:SIMD2<Float>? = abs(x)>p.width*0.33 && abs(y)>p.height*0.33 ? SIMD2<Float>(x<0 ? -1:1,y<0 ? -1:1) : nil
            portalDrag=(hit.id,p,hit.point,corner)
        } else if gesture.state == .changed,let start=portalDrag {
            if let corner=start.corner,let hit=start.placement.intersection(origin:ray.origin,direction:ray.direction) {
                let halfWidth:Float=corner.x*start.placement.width/2
                let halfHeight:Float=corner.y*start.placement.height/2
                let horizontal:V3=start.placement.right*halfWidth
                let vertical:V3=start.placement.up*halfHeight
                let originalCorner:V3=start.placement.center+horizontal+vertical
                let adjustedTouch:V3=originalCorner+(hit-start.grab)
                if let resized=start.placement.resized(corner:corner,point:adjustedTouch) { applyPortal(start.id,resized) }
            } else if start.corner == nil,let moved=start.placement.moved(grab:start.grab,origin:ray.origin,direction:ray.direction) { applyPortal(start.id,moved) }
        } else if gesture.state == .ended || gesture.state == .cancelled || gesture.state == .failed { portalDrag=nil }
    }
    @objc private func resizePortal(_ gesture:UIPinchGestureRecognizer) {
        guard phase == "scan",readyTracking else { portalPinch=nil; return }
        if gesture.state == .began {
            if let hit=portalHit(gesture.location(in:ar)) { selectEntrance(hit.id) }
            guard let id=selectedEntrance,let p=portalPlacements[id],!p.locked else{return}
            portalPinch=(id,p); portalDrag=nil
        } else if gesture.state == .changed,let start=portalPinch,let resized=start.placement.scaled(by:Float(gesture.scale)) { applyPortal(start.id,resized) }
        else if gesture.state == .ended || gesture.state == .cancelled || gesture.state == .failed { portalPinch=nil }
    }
    private func showReady() {
        card.isHidden=false; titleLabel.text="\(world.entrances.count) entrance\(world.entrances.count == 1 ? "" : "s") ready"
        bodyLabel.text="Your entrances are locked in the room. They stay there when you turn the phone.\n\nStay in one clear spot. Turn to aim; hold FIRE. Add or edit entrances before combat."
        primary.isHidden=false; primary.setTitle("Defend · 3 waves",for:.normal)
        secondary.setTitle("Edit / add entrances",for:.normal); secondary.isHidden=false
        scanButton.isHidden=true; testButton.isHidden=false
    }
    @objc private func smartScan() {
        guard RoomCaptureSession.isSupported, phase == "scan" else{return}
        phase="scanningRoom"; card.isHidden=false; titleLabel.text="Scan your room"
        bodyLabel.text="Slowly sweep the floor, walls and openings from a clear area. Doors and windows are suggested automatically. Tap Finish scan when ready."
        primary.isHidden=false; primary.setTitle("Finish scan",for:.normal); secondary.isHidden=true; scanButton.isHidden=true; testButton.isHidden=true
        controls.isHidden=true
        let capture=RoomCaptureSession(arSession:ar.session); capture.delegate=self; roomCapture=capture
        capture.run(configuration:RoomCaptureSession.Configuration())
    }
    func captureSession(_ session:RoomCaptureSession,didUpdate room:CapturedRoom) {
        DispatchQueue.main.async { [weak self] in
            guard let self=self, self.phase == "scanningRoom" else{return}
            self.room=room; self.bodyLabel.text="Found \(room.doors.count) doors · \(room.windows.count) windows · \(room.walls.count) walls.\n\nContinue a slow sweep, then finish. Camera and room data stay on this device."
        }
    }
    func captureSession(_ session:RoomCaptureSession,didProvide instruction:RoomCaptureSession.Instruction) {
        DispatchQueue.main.async { [weak self] in self?.hint.text="Room scan: \(instruction). Move slowly in a well-lit space." }
    }
    func captureSession(_ session:RoomCaptureSession,didEndWith data:CapturedRoomData,error:Error?) {
        if error != nil { DispatchQueue.main.async { [weak self] in
            guard let self=self,self.phase == "scanningRoom" else{return}; self.finishSmartScan()
        } }
    }
    private func finishSmartScan() {
        // Preserve the exact ARSession and its world origin through handoff.
        phase="scan"; roomCapture?.stop(pauseARSession:false); roomCapture=nil
        ar.session.delegate=self; ar.session.run(config(),options:[])
        controls.isHidden=false; card.isHidden=true
        if let room=room {
            if originAnchor == nil, let floor=room.floors.first { setOrigin(at:floor.transform.columns.3.xyz) }
            if originAnchor != nil {
                for door in room.doors.prefix(2) { addPortal(transform:door.transform,kind:.door,roomPlan:true) }
                for window in room.windows.prefix(2) { addPortal(transform:window.transform,kind:.window,roomPlan:true) }
                if world.entrances.count<2, let wall=room.walls.first { addPortal(transform:wall.transform,kind:.wall,roomPlan:true) }
                // Ceiling is sourced only from a detected ARKit ceiling plane.
                if let ceiling=ar.session.currentFrame?.anchors.compactMap({$0 as? ARPlaneAnchor}).first(where:{$0.classification == .ceiling}) {
                    var t=ceiling.transform; t.columns.3=ceiling.transform*SIMD4<Float>(ceiling.center,1)
                    addPortal(transform:t,kind:.ceiling,roomPlan:false)
                }
            }
        }
        placeButton.setTitle(originAnchor == nil ? "Mark floor" : "Place portal",for:.normal); typeButton.isEnabled=originAnchor != nil
        if !world.entrances.isEmpty { showReady() }
        else { hint.text="Scan incomplete. Mark the floor and manually place a portal on a recognized wall or ceiling." }
    }
    @objc private func startTest() { startCombat(test:true) }
    private func startCombat(test:Bool) {
        guard readyTracking, originAnchor != nil, !world.entrances.isEmpty, portalPlacements.values.allSatisfy({$0.locked}), let frame=ar.session.currentFrame else { bodyLabel.text="Wait for stable tracking, place an entrance, and lock every portal before combat."; return }
        world.reset(); phase="combat"; card.isHidden=true; controls.isHidden=false; pauseButton.isHidden=false
        controls.arrangedSubviews[0].isHidden=true; controls.arrangedSubviews[1].isHidden=false
        editControls.isHidden=true; depthControls.isHidden=true; selectedEntrance=nil; portalDrag=nil; portalPinch=nil
        for id in portalNodes.keys { renderPortal(id) }
        safetyOrigin=frame.camera.transform.columns.3.xyz
        world.player=(simd_inverse(root.simdTransform)*SIMD4<Float>(safetyOrigin,1)).xyz
        verificationMode=test; verificationIDs=[]; sawAway=false; returned=false; awayTime=0
        startForward = -frame.camera.transform.columns.2.xyz
        if test {
            world.wave=3; world.spawned=world.waveTarget
            for i in 0..<3 {
                var entrance=world.entrances[0]; entrance.position.x += Float(i-1)*0.5
                world.spawn(at:entrance,kind:.armor)
            }
            verificationIDs=world.aliens.map(\.id)
        }
        hint.text=test ? "Turn 180°, wait 3 seconds, then turn back. The same 3 aliens keep moving." : "Stand still · turn to aim · hold FIRE · reload when empty"
        threat.isHidden=false; lastHealth=world.health; gun=nil; previous=0
    }
    @objc private func startFire() { firing=true }
    @objc private func stopFire() { firing=false }
    @objc private func reloadGun() { world.beginReload() }
    @objc private func changeWeapon() { world.switchWeapon(); gun?.removeFromParentNode(); gun=nil }
    @objc private func pauseGame() { pause("Paused. Stay aware of your surroundings.") }
    private func pause(_ reason:String) {
        guard phase == "combat" else{return}
        phase="paused"; world.paused=true; root.isPaused=true; firing=false; card.isHidden=false
        titleLabel.text="Invasion paused"; bodyLabel.text=reason
        primary.setTitle("Restart scan",for:.normal); primary.isHidden=false
        secondary.setTitle("Resume",for:.normal); secondary.isHidden=false; scanButton.isHidden=true; testButton.isHidden=true
    }
    @objc private func exitGame() {
        firing=false; roomCapture?.stop(); roomCapture=nil; ar.session.pause()
        world.reset(); root.childNodes.forEach{$0.removeFromParentNode()}; nodes.removeAll(); portalNodes=[:]; portalPlacements=[:]; selectedEntrance=nil
        gun?.removeFromParentNode(); gun=nil; UIApplication.shared.isIdleTimerDisabled=false
        if let onExit=onExit {
            clock?.invalidate(); clock=nil
            NotificationCenter.default.removeObserver(self)
            onExit()
        } else { lobby() }
    }
    @objc private func background() { pause("App interrupted. Resume after tracking recovers."); ar.session.pause(); previous=0 }
    @objc private func foreground() { if phase != "lobby" { ar.session.run(config(),options:[]); previous=0 } }
    func sessionWasInterrupted(_ session:ARSession) { DispatchQueue.main.async { [weak self] in self?.pause("Tracking interrupted. Look at the scanned room before resuming.") } }
    func sessionInterruptionEnded(_ session:ARSession) { DispatchQueue.main.async { [weak self] in guard let self=self else{return}; self.ar.session.run(self.config(),options:[]) } }
    func session(_ session:ARSession,didFailWithError error:Error) { DispatchQueue.main.async { [weak self] in
        guard let self=self else{return}; self.sessionFailed=true; self.readyTracking=false
        self.pause("AR tracking failed. Restart scan to recover."); self.hint.text="AR unavailable: \(error.localizedDescription)"
    } }
    @objc private func tick(_ link:CADisplayLink) {
        let dt=Float(min(0.05,previous == 0 ? 0 : link.timestamp-previous)); previous=link.timestamp
        guard phase != "lobby", let frame=ar.session.currentFrame else{return}
        if case .normal=frame.camera.trackingState { readyTracking = !sessionFailed } else { readyTracking=false }
        if let id=originAnchor?.identifier, let anchor=frame.anchors.first(where:{$0.identifier == id}) { root.simdTransform=anchor.transform }
        if phase == "scan" {
            if !readyTracking { portalDrag=nil; portalPinch=nil; hint.text="Tracking paused · slowly look at the scanned room. Portals stay locked." }
            else if selectedEntrance != nil { refreshPortalEditor() }
            else { hint.text=originAnchor == nil ? "Aim at the floor · tap Mark floor" : "Choose Air for a floating portal, or aim at a recognized surface." }
            return
        }
        guard phase == "combat" else{return}
        guard readyTracking else { pause("Tracking is limited. Stand still, improve lighting, and slowly look at the scanned room. Enemies are frozen until you resume."); return }
        let camera=frame.camera.transform, position=camera.columns.3.xyz
        guard isWithinStationaryCombatArea(position,origin:safetyOrigin) else { pause("The phone moved outside the starting area. Combat paused. Restart from a clear stationary position."); return }
        let inverse=simd_inverse(root.simdTransform)
        world.player=(inverse*SIMD4<Float>(position,1)).xyz
        let direction=normalized((inverse*SIMD4<Float>(-camera.columns.2.xyz,0)).xyz)
        if verificationMode && !returned {
            let facing=dot(-camera.columns.2.xyz,startForward)
            if facing < -0.8 { sawAway=true; awayTime += dt }
            if sawAway && awayTime>=3 && facing>0.8 {
                returned=true
                let same=Set(world.aliens.map(\.id)) == Set(verificationIDs)
                hint.text=same ? "Same 3 enemy IDs retained. Check their room positions, then shoot." : "Turn test incomplete: an enemy was defeated. Restart the test."
            }
        }
        world.update(dt); elapsed += dt
        if firing && world.cooldown == 0 && world.reload == 0 && world.ammo>0 {
            let hit=world.shoot(origin:world.player,direction:direction)
            let end=world.player+direction*(hit?.1 ?? 5)
            beam(to:end,color:world.weapon == .plasma ? .cyan : .green)
            if hit != nil { burst(at:end,color:world.weapon == .plasma ? .cyan : .green) }
            gun?.runAction(.sequence([.moveBy(x:0,y:0,z:0.04,duration:0.045),.moveBy(x:0,y:0,z:-0.04,duration:0.08)]))
            flash?.isHidden=false; flash?.runAction(.sequence([.wait(duration:0.05),.hide()]))
        }
        updateModels(); installGun()
        stats.text="♥ \(Int(world.health))   WAVE \(world.wave)/3\n\(world.score) PTS · \(world.kills) KILLS"
        fireButton.setTitle(world.reload>0 ? "Loading…" : "FIRE \(world.ammo)",for:.normal)
        weaponButton.setTitle(world.weapon == .plasma ? "Plasma ⇄" : "Zapper ⇄",for:.normal)
        if world.health<lastHealth { UIImpactFeedbackGenerator(style:.medium).impactOccurred(); lastHealth=world.health }
        updateThreats(camera:camera)
        if world.finished {
            phase="finished"; firing=false; card.isHidden=false; titleLabel.text=world.won ? "ROOM DEFENDED" : "INVASION WINS"
            bodyLabel.text="\(world.score) points · \(world.kills) aliens defeated\n\n"+(verificationMode ? "The debug test checks identity continuity. Visually confirm that aliens stayed aligned with the room." : "Three-wave prototype. Take a moment to check your surroundings.")
            primary.isHidden=false; primary.setTitle("Restart scan",for:.normal); secondary.isHidden=true; scanButton.isHidden=true; testButton.isHidden=true
        }
    }
    private func material(_ color:UIColor,glow:Bool=false)->SCNMaterial {
        let m=SCNMaterial(); m.diffuse.contents=color; m.lightingModel = .physicallyBased; m.roughness.contents=0.3
        m.metalness.contents=0.2; if glow { m.emission.contents=color }; return m
    }
    private func ball(_ radius:CGFloat,_ color:UIColor,_ at:SCNVector3,_ parent:SCNNode)->SCNNode {
        let shape=SCNSphere(radius:radius); shape.segmentCount=14; shape.firstMaterial=material(color)
        let n=SCNNode(geometry:shape); n.position=at; parent.addChildNode(n); return n
    }
    private func model(_ kind:AlienKind)->SCNNode {
        let n=SCNNode(); let colors:[UIColor]=[.systemGreen,.systemPurple,.systemOrange,.systemTeal]
        let color=colors[kind.rawValue]; let r=CGFloat(kind.radius)
        let body=ball(r*0.85,color,SCNVector3Zero,n); body.scale=SCNVector3(0.85,1.1,0.75)
        let face=ball(r*0.65,color,SCNVector3(0,Float(r*0.5),Float(r*0.35)),n)
        for sign:Float in [-1,1] {
            let eye=ball(r*0.23,.white,SCNVector3(sign*Float(r*0.28),Float(r*0.16),Float(r*0.5)),face)
            _=ball(r*0.11,UIColor(white:0.03,alpha:1),SCNVector3(0,0,Float(r*0.2)),eye)
            let leg=ball(r*0.3,color,SCNVector3(sign*Float(r*0.55),-Float(r*0.75),0),n); leg.name=sign<0 ? "leftLeg" : "rightLeg"
            let arm=ball(r*0.28,color,SCNVector3(sign*Float(r*0.9),0,0),n); arm.scale=SCNVector3(0.8,1.7,0.8)
            if kind == .armor || kind == .brute { _=ball(r*0.42,UIColor(white:0.23,alpha:1),SCNVector3(sign*Float(r*0.65),Float(r*0.32),0),n) }
            if kind == .flyer {
                let wing=ball(r*0.8,.cyan,SCNVector3(sign*Float(r*1.3),0,0),n); wing.scale=SCNVector3(1,0.15,0.8)
            }
        }
        let mouth=ball(r*0.17,UIColor(white:0.08,alpha:1),SCNVector3(0,0,Float(r*0.89)),n); mouth.scale=SCNVector3(1.5,0.45,0.3)
        let antenna=ball(r*0.12,.yellow,SCNVector3(0,Float(r*1.5),0),n); antenna.geometry?.firstMaterial?.emission.contents=UIColor.yellow
        return n
    }
    private func updateModels() {
        let ids=Set(world.aliens.map(\.id))
        for id in Array(nodes.keys) where !ids.contains(id) {
            if let n=nodes.removeValue(forKey:id) { n.runAction(.sequence([.group([.scale(to:0.01,duration:0.25),.rotateBy(x:0,y:3,z:1,duration:0.25)]),.removeFromParentNode()])) }
        }
        for a in world.aliens {
            if nodes[a.id] == nil { let n=model(a.kind); root.addChildNode(n); nodes[a.id]=n }
            guard let n=nodes[a.id] else{continue}
            n.simdPosition=a.position
            let d=world.player-a.position; n.eulerAngles.y=atan2(d.x,d.z)
            n.childNode(withName:"leftLeg",recursively:true)?.eulerAngles.x=sin(a.age*9)*0.65
            n.childNode(withName:"rightLeg",recursively:true)?.eulerAngles.x = -sin(a.age*9)*0.65
            if a.kind == .flyer { n.position.y += sin(a.age*5)*0.08 }
            n.scale=SCNVector3(1,1+sin(a.age*7)*0.03,1)
        }
    }
    private func installGun() {
        guard gun == nil, let camera=ar.pointOfView else{return}
        let n=SCNNode(); n.position=SCNVector3(0.10,-0.14,-0.30)
        let chassis=SCNBox(width:0.10,height:0.09,length:0.22,chamferRadius:0.018)
        chassis.firstMaterial=material(UIColor(white:0.2,alpha:1)); n.addChildNode(SCNNode(geometry:chassis))
        let color:UIColor=world.weapon == .plasma ? .cyan : .green
        let barrel=SCNCylinder(radius:0.025,height:0.18); barrel.firstMaterial=material(color,glow:true)
        let b=SCNNode(geometry:barrel); b.eulerAngles.x = .pi/2; b.position.z = -0.14; n.addChildNode(b)
        let f=ball(0.04,color,SCNVector3(0,0,-0.24),n); f.geometry?.firstMaterial=material(color,glow:true); f.isHidden=true
        flash=f; camera.addChildNode(n); gun=n; ar.audioListener=camera
    }
    private func beam(to end:V3,color:UIColor) {
        let start=world.player; let d=end-start
        let g=SCNCylinder(radius:0.009,height:CGFloat(length(d))); g.firstMaterial=material(color,glow:true)
        let n=SCNNode(geometry:g); n.simdPosition=(start+end)/2
        n.simdOrientation=simd_quatf(from:V3(0,1,0),to:normalized(d)); root.addChildNode(n)
        n.runAction(.sequence([.fadeOut(duration:0.1),.removeFromParentNode()]))
        playSound(at:gun)
    }
    private func burst(at p:V3,color:UIColor) {
        for i in 0..<10 {
            let n=ball(0.025,color,SCNVector3(p),root)
            let a=Float(i)*2 * .pi/10
            n.runAction(.sequence([.group([.moveBy(x:CGFloat(sin(a)*0.3),y:CGFloat(cos(a)*0.3),z:CGFloat(sin(a*2)*0.2),duration:0.3),.scale(to:0.01,duration:0.3)]),.removeFromParentNode()]))
        }
    }
    private func playSound(at node:SCNNode?) {
        guard let node=node, let source=SCNAudioSource(fileNamed:"zap.wav") ?? SCNAudioSource(fileNamed:"public/alien-ar-zap.wav") else{return}
        source.isPositional=true; source.volume=0.25; source.load()
        node.runAction(.playAudio(source,waitForCompletion:false))
    }
    private func updateThreats(camera:simd_float4x4) {
        let inverse=simd_inverse(camera)
        let outside=world.aliens.filter { a in
            let p=(inverse*root.simdTransform*SIMD4<Float>(a.position,1)).xyz
            return p.z>0 || abs(p.x)>abs(p.z)*0.65 || abs(p.y)>abs(p.z)*0.9
        }
        if let nearest=outside.min(by:{length($0.position-world.player)<length($1.position-world.player)}) {
            let local=(inverse*root.simdTransform*SIMD4<Float>(nearest.position,1)).xyz
            threat.text=local.z>0 ? "↶ \(outside.count) behind you" : local.x<0 ? "← Alien on your left" : "Alien on your right →"
            if elapsed-lastSound>2.5 { playSound(at:nodes[nearest.id]); lastSound=elapsed }
        } else { threat.text="" }
    }
}

private extension SIMD4 where Scalar == Float { var xyz:SIMD3<Float> { SIMD3(x,y,z) } }
