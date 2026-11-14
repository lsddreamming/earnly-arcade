import UIKit
import SceneKit

/// Cosmetic poses live below the simulation node. They never move an anchor,
/// change an enemy's hit sphere, or depend on whether the enemy is onscreen.
@available(iOS 17.0, *)
final class AlienVisual {
    let node = SCNNode()
    let color: UIColor
    private let pose = SCNNode(), head = SCNNode()
    private var legs: [SCNNode] = [], arms: [SCNNode] = [], wings: [SCNNode] = []
    private var eyes: [SCNNode] = []
    private let skin: SCNMaterial
    private var previousPosition: V3?
    private var previousWindup: Float = 0
    private var hitRemaining: Float = 0
    private var attackRemaining: Float = 0

    init(kind: AlienKind) {
        color = [UIColor.systemGreen, .systemPurple, .systemOrange, .systemTeal][kind.rawValue]
        skin = AlienArt.material(color)
        let dark = AlienArt.material(UIColor(red: 0.06, green: 0.09, blue: 0.17, alpha: 1))
        let white = AlienArt.material(.white)
        let glow = AlienArt.material(kind == .brute ? .systemYellow : .cyan, glow: true)
        let armor = AlienArt.material(UIColor(red: 0.24, green: 0.17, blue: 0.39, alpha: 1))
        let r = kind.radius
        node.addChildNode(pose)
        let body = AlienArt.sphere(r * 0.68, skin, at: V3(0, -r * 0.05, 0), in: pose)
        body.scale = SCNVector3(kind == .brute ? 1.18 : 0.88, 1.08, 0.83)
        pose.addChildNode(head); head.position.y = r * 0.45
        let face = AlienArt.sphere(r * 0.57, skin, at: V3(0, 0, r * 0.09), in: head)
        face.scale = SCNVector3(1.12, 0.90, 0.85)
        for side: Float in [-1, 1] {
            let eye = AlienArt.sphere(r * 0.20, white, at: V3(side * r * 0.27, r * 0.04, r * 0.50), in: head)
            eye.scale = SCNVector3(1, 1.22, 0.55); eyes.append(eye)
            _ = AlienArt.sphere(r * 0.095, dark, at: V3(0, 0, r * 0.16), in: eye)
            _ = AlienArt.sphere(r * 0.032, white, at: V3(-r * 0.025, r * 0.04, r * 0.24), in: eye)
            let brow = AlienArt.box(V3(r * 0.38, r * 0.07, r * 0.10), dark,
                                    at: V3(side * r * 0.27, r * 0.26, r * 0.47), in: head)
            brow.eulerAngles.z = side * (kind == .brute ? 0.35 : -0.15)
            let leg = SCNNode(); leg.position = SCNVector3(side * r * 0.36, -r * 0.46, 0)
            pose.addChildNode(leg); legs.append(leg)
            let shin = AlienArt.sphere(r * 0.19, skin, at: V3(0, -r * 0.18, 0), in: leg)
            shin.scale = SCNVector3(0.85, 1.5, 0.85)
            _ = AlienArt.box(V3(r * 0.40, r * 0.23, r * 0.55), dark,
                             at: V3(0, -r * 0.42, r * 0.11), in: leg)
            let arm = SCNNode(); arm.position = SCNVector3(side * r * 0.65, r * 0.20, 0)
            pose.addChildNode(arm); arms.append(arm)
            let forearm = AlienArt.sphere(r * 0.18, skin, at: V3(side * r * 0.08, -r * 0.26, 0), in: arm)
            forearm.scale = SCNVector3(1, 1.8, 1)
            _ = AlienArt.sphere(r * (kind == .brute ? 0.30 : 0.21), skin,
                                at: V3(side * r * 0.10, -r * 0.48, r * 0.04), in: arm)
            if kind == .armor || kind == .brute {
                _ = AlienArt.box(V3(r * 0.55, r * 0.40, r * 0.65), armor, at: .zero, in: arm)
            }
            if kind == .brute {
                let horn = SCNCone(topRadius: 0, bottomRadius: CGFloat(r * 0.13), height: CGFloat(r * 0.43))
                horn.radialSegmentCount = 8; horn.firstMaterial = white
                let h = SCNNode(geometry: horn); h.position = SCNVector3(side * r * 0.44, r * 0.49, 0)
                h.eulerAngles.z = -side * 0.4; head.addChildNode(h)
            }
            if kind == .flyer {
                let wing = SCNNode(); wing.position = SCNVector3(side * r * 0.55, r * 0.16, -r * 0.12)
                pose.addChildNode(wing); wings.append(wing)
                let fin = AlienArt.sphere(r * 0.65, glow, at: V3(side * r * 0.56, 0, 0), in: wing)
                fin.scale = SCNVector3(1.2, 0.09, 0.55)
                leg.isHidden = true
            }
        }
        let mouth = AlienArt.sphere(r * 0.15, dark, at: V3(0, -r * 0.22, r * 0.52), in: head)
        mouth.scale = SCNVector3(1.3, 0.46, 0.25)
        if kind == .armor || kind == .brute {
            _ = AlienArt.box(V3(r * 0.88, r * 0.64, r * 0.15), armor, at: V3(0, -r * 0.07, r * 0.53), in: pose)
            _ = AlienArt.box(V3(r * 0.15, r * 0.36, r * 0.07), glow, at: V3(0, -r * 0.07, r * 0.64), in: pose)
        } else {
            _ = AlienArt.box(V3(r * 0.08, r * 0.32, r * 0.08), dark, at: V3(0, r * 0.59, 0), in: head)
            _ = AlienArt.sphere(r * 0.12, glow, at: V3(0, r * 0.78, 0), in: head)
        }
        // Layered suits and species markings keep silhouettes readable at room scale.
        for side: Float in [-1,1] {
            for stripe in 0..<3 {
                let mark = AlienArt.box(V3(r*0.21,r*0.035,r*0.025),glow,
                                        at:V3(side*r*0.30,-r*0.12-Float(stripe)*r*0.11,r*0.56),in:pose)
                mark.opacity = 0.65
            }
            let pack = AlienArt.sphere(r*0.20,armor,at:V3(side*r*0.38,r*0.02,-r*0.53),in:pose)
            pack.scale = SCNVector3(0.8,1.5,0.8)
            _ = AlienArt.sphere(r*0.085,glow,at:V3(0,-r*0.21,0),in:pack)
        }
        if kind == .runner {
            // Low, quick chittering posture with two extra forelimbs.
            for side: Float in [-1,1] {
                let claw = SCNNode(); claw.position = SCNVector3(side*r*0.53,-r*0.24,r*0.24)
                pose.addChildNode(claw); arms.append(claw)
                let limb = AlienArt.sphere(r*0.13,skin,at:V3(side*r*0.14,-r*0.28,r*0.04),in:claw)
                limb.scale = SCNVector3(0.7,2,0.7)
            }
        }
    }

    func hit() { hitRemaining = 0.18 }

    func update(_ alien: Alien, player: V3, dt: Float) {
        let moving = previousPosition.map { length(alien.position - $0) > 0.00001 } ?? true
        previousPosition = alien.position
        if previousWindup > 0 && alien.attackWindup == 0 && alien.attackCooldown > 1.5 && alien.stagger == 0 { attackRemaining = 0.28 }
        previousWindup = alien.attackWindup
        hitRemaining = max(0, hitRemaining - dt); attackRemaining = max(0, attackRemaining - dt)
        node.simdPosition = alien.position
        let delta = player - alien.position
        node.eulerAngles.y = atan2(delta.x, delta.z)
        let gait = sin(alien.age * (alien.kind == .runner ? 13 : 7)) * (moving ? Float(0.55) : 0)
        for (i, leg) in legs.enumerated() { leg.eulerAngles.x = (i == 0 ? gait : -gait) }
        let windup = alien.attackProgress
        let strike = sin((1 - attackRemaining / 0.28) * .pi) * 1.2
        let anticipation = sin(windup * .pi / 2) * 0.9
        for (i, arm) in arms.enumerated() { arm.eulerAngles.x = (i == 0 ? -gait : gait) * 0.65 - strike + anticipation }
        for (i, wing) in wings.enumerated() { wing.eulerAngles.z = sin(alien.age * 24) * (i == 0 ? 0.4 : -0.4) }
        // Only a small cosmetic bob; the actor root stays at its exact hit position.
        pose.position.y = sin(alien.age * (alien.kind == .flyer ? 5 : 14)) * (moving ? 0.012 : 0.004)
        pose.eulerAngles.z = hitRemaining > 0 ? sin(hitRemaining * 65) * 0.13 : 0
        let squash = hitRemaining / 0.18
        let emerge: Float = alien.emergenceOrigin == nil ? 1 : min(1,0.25+alien.age*1.1)
        pose.scale = SCNVector3((1+squash*0.08)*emerge,(1-squash*0.10)*emerge,emerge)
        pose.eulerAngles.x = (alien.kind == .runner ? Float(0.22) : 0) - anticipation*0.18
        skin.emission.contents = hitRemaining > 0 ? UIColor(white: 0.55, alpha: 1) : alien.attackWindup > 0 ? UIColor(red:CGFloat(windup)*0.55,green:0.08,blue:0,alpha:1) : UIColor.black
        head.eulerAngles.z = sin(alien.age * 2.3) * 0.05
        let blink = alien.age.truncatingRemainder(dividingBy: 3.7) > 3.55
        for eye in eyes { eye.scale.y = blink ? 0.12 : 1.22 }
    }

    func defeat() {
        // Animate the visual child, leaving the last authoritative position intact.
        pose.runAction(.sequence([
            .group([.scale(to: 1.15, duration: 0.08), .moveBy(x: 0, y: 0.06, z: 0, duration: 0.08)]),
            .group([.scale(to: 0.01, duration: 0.28), .rotateBy(x: 0, y: 2.5, z: 1.5, duration: 0.28)])
        ]))
        node.runAction(.sequence([.wait(duration: 0.38), .removeFromParentNode()]))
    }
}

@available(iOS 17.0, *)
enum AlienArt {
    static func material(_ color: UIColor, glow: Bool = false) -> SCNMaterial {
        let m = SCNMaterial(); m.diffuse.contents = color; m.lightingModel = .physicallyBased
        m.roughness.contents = 0.38; m.metalness.contents = 0.25
        if glow { m.emission.contents = color }; return m
    }
    @discardableResult static func sphere(_ radius: Float, _ material: SCNMaterial, at p: V3, in parent: SCNNode) -> SCNNode {
        let g = SCNSphere(radius: CGFloat(radius)); g.segmentCount = 12; g.firstMaterial = material
        let n = SCNNode(geometry: g); n.simdPosition = p; parent.addChildNode(n); return n
    }
    @discardableResult static func box(_ size: V3, _ material: SCNMaterial, at p: V3, in parent: SCNNode) -> SCNNode {
        let g = SCNBox(width: CGFloat(size.x), height: CGFloat(size.y), length: CGFloat(size.z), chamferRadius: CGFloat(min(size.x, min(size.y, size.z)) * 0.2))
        g.chamferSegmentCount = 2; g.firstMaterial = material
        let n = SCNNode(geometry: g); n.simdPosition = p; parent.addChildNode(n); return n
    }
}

@available(iOS 17.0, *)
final class AlienWeaponVisual {
    let node = SCNNode(), muzzle = SCNNode()
    let color: UIColor
    private let flash: SCNNode
    private let battery = SCNNode()
    private var kick: Float = 0

    init(weapon: Weapon) {
        color = weapon == .plasma ? .cyan : .green
        let dark = AlienArt.material(UIColor(red: 0.08, green: 0.12, blue: 0.22, alpha: 1))
        let trim = AlienArt.material(UIColor(white: 0.55, alpha: 1))
        let energy = AlienArt.material(color, glow: true)
        flash = AlienArt.sphere(0.025, energy, at: .zero, in: muzzle)
        flash.scale = SCNVector3(1, 1, 2.5); flash.isHidden = true
        _ = AlienArt.box(V3(0.09, 0.075, 0.20), dark, at: .zero, in: node)
        let grip = AlienArt.box(V3(0.042, 0.10, 0.055), dark, at: V3(0, -0.065, 0.05), in: node)
        grip.eulerAngles.x = -0.3
        _ = AlienArt.box(V3(0.038, 0.018, 0.075), energy, at: V3(0, 0.044, 0.012), in: node)
        for side: Float in [-1, 1] {
            _ = AlienArt.box(V3(0.008, 0.020, 0.13), energy, at: V3(side * 0.048, 0, 0), in: node)
            for i in 0..<4 {
                _ = AlienArt.box(V3(0.012,0.027,0.008),trim,at:V3(side*0.049,0.012,Float(i)*0.025-0.04),in:node)
            }
        }
        node.addChildNode(battery); battery.position = SCNVector3(0,-0.036,0.015)
        _ = AlienArt.box(V3(0.038,0.065,0.06),trim,at:.zero,in:battery)
        _ = AlienArt.box(V3(0.040,0.034,0.037),energy,at:V3(0,-0.004,0),in:battery)
        _ = AlienArt.box(V3(0.045,0.025,0.025),trim,at:V3(0,0.057,-0.04),in:node)
        let barrelOffsets: [Float] = weapon == .plasma ? [0] : [-0.025, 0.025]
        for x in barrelOffsets {
            let barrel = SCNCylinder(radius: weapon == .plasma ? 0.020 : 0.013, height: 0.14)
            barrel.radialSegmentCount = 12; barrel.firstMaterial = trim
            let b = SCNNode(geometry: barrel); b.eulerAngles.x = .pi / 2
            b.position = SCNVector3(x, 0, -0.14); node.addChildNode(b)
            for z: Float in [-0.11, -0.17, -0.205] {
                let ring = SCNTorus(ringRadius: weapon == .plasma ? 0.022 : 0.015, pipeRadius: 0.004)
                ring.ringSegmentCount = 12; ring.pipeSegmentCount = 6; ring.firstMaterial = energy
                let coil = SCNNode(geometry: ring); coil.eulerAngles.x = .pi / 2
                coil.position = SCNVector3(x, 0, z); node.addChildNode(coil)
            }
        }
        muzzle.position.z = -0.23; node.addChildNode(muzzle)
        update(dt: 0, reload: 0)
    }

    func fire() { kick = 1 }

    func update(dt: Float, reload: Float) {
        kick = max(0, kick - dt * 9)
        let dip = reload > 0 ? sin(min(1, reload / 1.2) * .pi) : 0
        node.position = SCNVector3(0.07, -0.09 - dip * 0.10, -0.36 + kick * 0.035)
        node.eulerAngles = SCNVector3(kick * 0.13, 0, -dip * 0.5)
        battery.position.y = -0.036-dip*0.08
        battery.eulerAngles.z = dip*0.25
        flash.isHidden = kick < 0.65
    }
}

/// Every animation stays below this node and the fixed placement transform.
/// A bounded mesh set and one small shader plane per portal are reused throughout.
@available(iOS 17.0, *)
final class AlienPortalVisual {
    let node = SCNNode()
    let color: UIColor
    private let kind: PortalKind
    private let opening = SCNNode(), rings = SCNNode(), sparks = SCNNode(), shadow = SCNNode()
    private let pulse = SCNNode(), cracks = SCNNode(), lightNode = SCNNode()
    private let energy: SCNMaterial, interior: SCNMaterial
    private var handles: [SCNNode] = [], orbiters: [SCNNode] = [], arcNodes: [SCNNode] = []
    private var ringNodes: [SCNNode] = []
    private var time: Float = 0, arrivalTime: Float = 0, activation: Float = 0
    private var charge: Float = 0
    private var event = BreachEvent.normal
    private var editing = false, invasionStarted = false

    init(kind: PortalKind) {
        self.kind = kind
        switch kind {
        case .air: color = UIColor(red:0.65,green:0.30,blue:1,alpha:1)
        case .door: color = UIColor(red:0.28,green:1,blue:0.68,alpha:1)
        case .window: color = UIColor(red:0.25,green:0.65,blue:1,alpha:1)
        case .wall: color = UIColor(red:1,green:0.45,blue:0.18,alpha:1)
        case .ceiling: color = UIColor(red:0.15,green:0.94,blue:1,alpha:1)
        }
        energy = AlienArt.material(color, glow:true)
        energy.lightingModel = .constant; energy.isDoubleSided = true
        interior = SCNMaterial(); interior.lightingModel = .constant
        interior.diffuse.contents = color; interior.isDoubleSided = true
        interior.writesToDepthBuffer = false
        // Local UV distortion only: never changes a world vertex or anchor.
        interior.shaderModifiers = [.fragment: Self.vortexShader]
        interior.setValue(NSNumber(value:0),forKey:"portalTime")
        interior.setValue(NSNumber(value:0),forKey:"portalCharge")
        interior.setValue(NSNumber(value:kind == .door || kind == .window ? 1 : 0),forKey:"portalSquare")
        node.addChildNode(opening)
        let plane = SCNPlane(width:0.98,height:0.98); plane.firstMaterial = interior
        let core = SCNNode(geometry:plane); core.position.z = -0.025; opening.addChildNode(core)
        [rings,sparks,shadow,pulse,cracks,lightNode].forEach { opening.addChildNode($0) }

        let metal = AlienArt.material(UIColor(red:0.10,green:0.14,blue:0.24,alpha:1))
        metal.metalness.contents = 0.75
        if kind == .door || kind == .window {
            // Real doorway silhouette with inset energy rails and alien circuitry.
            for side: Float in [-1,1] {
                _ = AlienArt.box(V3(0.075,1.05,0.10),metal,at:V3(side*0.51,0,0),in:opening)
                _ = AlienArt.box(V3(0.016,0.98,0.025),energy,at:V3(side*0.475,0,0.065),in:opening)
                for i in 0..<5 {
                    let glyph = AlienArt.box(V3(0.038,0.018,0.014),energy,at:V3(side*0.52,Float(i)*0.18-0.36,0.065),in:opening)
                    glyph.eulerAngles.z = side*0.4
                }
                _ = AlienArt.box(V3(1.07,0.065,0.10),metal,at:V3(0,side*0.51,0),in:opening)
                _ = AlienArt.box(V3(0.94,0.012,0.025),energy,at:V3(0,side*0.475,0.065),in:opening)
            }
        } else {
            let rim = Self.ring(radius:0.50,thickness:0.017,material:energy)
            opening.addChildNode(rim)
            let backing = Self.ring(radius:0.525,thickness:0.027,material:metal)
            opening.addChildNode(backing)
        }
        for i in 0..<3 {
            let carrier = SCNNode(); rings.addChildNode(carrier)
            let ring = Self.ring(radius:CGFloat(0.35+Float(i)*0.09),thickness:i == 2 ? 0.008 : 0.004,material:energy)
            carrier.addChildNode(ring); carrier.position.z = -Float(2-i)*0.065
            carrier.opacity = i == 2 ? 0.85 : 0.40; ringNodes.append(carrier)
            for j in 0..<4 {
                let a = Float(j) * .pi/2+Float(i)*0.4
                let mark = AlienArt.box(V3(0.035,0.065,0.012),energy,at:V3(sin(a)*0.53,cos(a)*0.53,0),in:carrier)
                mark.eulerAngles.z = -a
            }
        }
        // Short jagged arcs rotate around the perimeter, with no particle emitter.
        for i in 0..<3 {
            let arc = SCNNode(); opening.addChildNode(arc); arcNodes.append(arc)
            for j in 0..<7 {
                let a = Float(j)*0.09, b = Float(j+1)*0.09
                let ra: Float = j % 2 == 0 ? 0.49 : 0.54
                let rb: Float = j % 2 == 0 ? 0.54 : 0.49
                Self.segment(from:V3(sin(a)*ra,cos(a)*ra,0.06),to:V3(sin(b)*rb,cos(b)*rb,0.06),material:energy,in:arc)
            }
            arc.eulerAngles.z = Float(i)*2 * .pi/3
        }
        let moteGeometry = SCNSphere(radius:0.009); moteGeometry.segmentCount = 6; moteGeometry.firstMaterial = energy
        for _ in 0..<12 {
            let mote = SCNNode(geometry:moteGeometry); sparks.addChildNode(mote); orbiters.append(mote)
        }
        if kind == .wall || kind == .window {
            for i in 0..<8 {
                let a = Float(i)*2 * .pi/8
                let start = V3(sin(a)*0.49,cos(a)*0.49,0.02)
                let bend = V3(sin(a+0.12)*0.62,cos(a+0.12)*0.62,0.02)
                let end = V3(sin(a-0.05)*0.79,cos(a-0.05)*0.79,0.02)
                Self.segment(from:start,to:bend,material:energy,in:cracks)
                Self.segment(from:bend,to:end,material:energy,in:cracks)
                if kind == .window {
                    let shard = AlienArt.box(V3(0.055,0.12,0.018),energy,at:bend,in:cracks)
                    shard.eulerAngles = SCNVector3(0.4,a,0.5); shard.opacity = 0.7
                }
            }
        }
        cracks.opacity = 0
        let silhouette = AlienArt.material(UIColor(red:0.015,green:0.025,blue:0.05,alpha:1))
        silhouette.lightingModel = .constant
        let head = AlienArt.sphere(0.105,silhouette,at:V3(0,0.1,0),in:shadow)
        head.scale = SCNVector3(1.2,0.85,0.35)
        let body = AlienArt.sphere(0.10,silhouette,at:V3(0,-0.07,0),in:shadow)
        body.scale = SCNVector3(0.9,1.3,0.4)
        for side: Float in [-1,1] {
            let eye = AlienArt.sphere(0.022,energy,at:V3(side*0.046,0.11,0.045),in:shadow)
            eye.scale = SCNVector3(1,0.55,0.3)
        }
        shadow.position.z = 0.015; shadow.opacity = 0
        pulse.addChildNode(Self.ring(radius:0.5,thickness:0.01,material:energy)); pulse.opacity = 0
        let light = SCNLight(); light.type = .omni; light.color = color
        light.intensity = 0; light.attenuationStartDistance = 0; light.attenuationEndDistance = 2
        light.castsShadow = false; lightNode.light = light; lightNode.position.z = 0.16
        let handleMaterial = AlienArt.material(.cyan,glow:true)
        for _ in 0..<4 { handles.append(AlienArt.sphere(0.045,handleMaterial,at:.zero,in:node)) }
    }

    func update(width: Float, height: Float, editing: Bool) {
        opening.scale = SCNVector3(width,height,1); self.editing = editing
        let corners: [SIMD2<Float>] = [SIMD2(-1,-1),SIMD2(-1,1),SIMD2(1,-1),SIMD2(1,1)]
        for (i,handle) in handles.enumerated() {
            handle.position = SCNVector3(corners[i].x*width/2,corners[i].y*height/2,0.08)
            handle.isHidden = !editing
        }
    }
    func beginInvasion() {
        guard !invasionStarted else { return }
        invasionStarted = true; activation = 0.001; arrival()
    }
    func chargeUp(_ cue: SpawnCue?) {
        charge = cue.map { 0.15+$0.progress*0.85 } ?? 0
        event = cue?.event ?? .normal
    }
    func arrival() { arrivalTime = 0.55 }
    func animate(dt: Float, reducedEffects: Bool) {
        time += dt; arrivalTime = max(0,arrivalTime-dt)
        if activation > 0 { activation = min(1,activation+dt*1.5) }
        let tint: UIColor = editing ? .cyan : event == .overload ? .systemRed : color
        energy.diffuse.contents = tint; energy.emission.contents = tint; interior.diffuse.contents = tint
        interior.setValue(NSNumber(value:time),forKey:"portalTime")
        interior.setValue(NSNumber(value:charge),forKey:"portalCharge")
        for (i,ring) in ringNodes.enumerated() {
            ring.eulerAngles.z = time*(i % 2 == 0 ? 0.34 : -0.45)
            ring.eulerAngles.x = kind == .air ? sin(time*0.6+Float(i))*0.22 : 0
            ring.eulerAngles.y = kind == .air ? cos(time*0.5+Float(i))*0.2 : 0
            let swell: Float = 1+charge*0.08+(event == .heavy ? charge*0.16 : 0)
            ring.scale = SCNVector3(swell,swell,1)
        }
        for (i,arc) in arcNodes.enumerated() {
            arc.eulerAngles.z = Float(i)*2 * .pi/3-time*(1.1+charge)
            arc.opacity = CGFloat(0.45+0.45*abs(sin(time*4+Float(i)*2)))
            arc.isHidden = reducedEffects && i > 0
        }
        for (i,mote) in orbiters.enumerated() {
            let a = Float(i)*2 * .pi/12+time*0.45
            let radius: Float = 0.54+sin(time*1.2+Float(i))*0.04
            mote.position = SCNVector3(sin(a)*radius,cos(a)*radius,sin(time+Float(i))*0.10)
            mote.opacity = CGFloat(0.4+0.5*abs(sin(time+Float(i))))
            mote.isHidden = reducedEffects && i % 2 == 0
        }
        cracks.opacity = CGFloat(activation*(0.55+charge*0.45))
        let shadowScale: Float = 0.5+charge*0.6
        shadow.scale = SCNVector3(shadowScale,shadowScale,1); shadow.opacity = CGFloat(charge*0.9)
        pulse.opacity = CGFloat(arrivalTime/0.55)
        let burst: Float = 1+(1-arrivalTime/0.55)*0.35
        pulse.scale = SCNVector3(burst,burst,1)
        lightNode.light?.color = tint
        lightNode.light?.intensity = reducedEffects ? 0 : CGFloat(charge*90+arrivalTime*120)
    }

    private static func segment(from start: V3,to end: V3,material: SCNMaterial,in parent: SCNNode) {
        let delta = end-start
        let bar = AlienArt.box(V3(0.007,length(delta),0.009),material,at:(start+end)/2,in:parent)
        bar.eulerAngles.z = -atan2(delta.x,delta.y)
    }
    private static func ring(radius: CGFloat,thickness: CGFloat,material: SCNMaterial) -> SCNNode {
        let shape = SCNTorus(ringRadius:radius,pipeRadius:thickness)
        shape.ringSegmentCount = 48; shape.pipeSegmentCount = 6; shape.firstMaterial = material
        let node = SCNNode(geometry:shape); node.eulerAngles.x = .pi/2; return node
    }
    private static let vortexShader = """
    #pragma arguments
    float portalTime;
    float portalCharge;
    float portalSquare;
    #pragma transparent
    #pragma body
    float2 p = _surface.diffuseTexcoord * 2.0 - 1.0;
    float r = length(p);
    float edge = mix(r, max(abs(p.x), abs(p.y)), portalSquare);
    float mask = 1.0 - smoothstep(0.90, 1.0, edge);
    float angle = atan2(p.y, p.x);
    float swirl = sin(angle * 5.0 + r * 18.0 - portalTime * 2.2);
    float wisps = pow(max(0.0, swirl), 5.0);
    float ripple = 0.5 + 0.5 * sin(r * 32.0 - portalTime * 3.0 + swirl);
    float rim = pow(clamp(edge, 0.0, 1.0), 6.0);
    float3 tint = _output.color.rgb;
    float3 deep = float3(0.008, 0.012, 0.032);
    float strength = (0.12 + wisps * 0.50 + ripple * 0.12 + rim * 0.55) * (0.7 + portalCharge * 0.6);
    _output.color = float4((deep + tint * strength) * mask, mask * 0.92);
    """
}
