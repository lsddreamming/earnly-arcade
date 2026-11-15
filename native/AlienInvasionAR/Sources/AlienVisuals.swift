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

/// All geometry, light and UV animation stays below the fixed placement node.
/// Meshes and the impact membrane are built once; no emitters or per-shot nodes.
@available(iOS 17.0, *)
final class AlienPortalVisual {
    let node = SCNNode()
    let color: UIColor
    private let kind: PortalKind
    private let opening = SCNNode(), sparks = SCNNode(), shadow = SCNNode()
    private let pulse = SCNNode(), cracks = SCNNode(), lightNode = SCNNode()
    private let energy: SCNMaterial, interior: SCNMaterial
    private var handles: [SCNNode] = [], orbiters: [SCNNode] = [], arcNodes: [SCNNode] = []
    private var ringNodes: [SCNNode] = [], spirals: [SCNNode] = []
    private var time: Float = 0, arrivalTime: Float = 0, activation: Float = 0
    private var charge: Float = 0, previewTime: Float = 0, hitTime: Float = 0, editTime: Float = 0
    private var suppressed = false
    private var event = BreachEvent.normal
    private var editing = false, invasionStarted = false
    private var rectangular: Bool { kind == .door || kind == .window }

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
        interior.shaderModifiers = [.fragment: Self.vortexShader]
        for key in ["portalTime","portalCharge","portalHit","portalHitX","portalHitY"] {
            interior.setValue(NSNumber(value:0),forKey:key)
        }
        interior.setValue(NSNumber(value:kind == .door || kind == .window ? 1 : 0),forKey:"portalSquare")
        node.addChildNode(opening)
        [sparks,shadow,pulse,cracks,lightNode].forEach { opening.addChildNode($0) }

        let dark = AlienArt.material(UIColor(red:0.006,green:0.01,blue:0.035,alpha:1))
        dark.lightingModel = .constant; dark.isDoubleSided = true
        // A tapered, closed tunnel produces actual parallax when viewed obliquely.
        // It is simulated depth behind the aperture, never a change to the wall.
        let tunnel = Self.tunnel(kind:kind,material:dark); opening.addChildNode(tunnel)
        let plane = SCNPlane(width:1,height:1); plane.firstMaterial = interior
        let core = SCNNode(geometry:plane); core.position.z = 0.012
        core.renderingOrder = 10; opening.addChildNode(core)

        let metal = AlienArt.material(UIColor(red:0.065,green:0.095,blue:0.17,alpha:1))
        metal.metalness.contents = 0.85; metal.roughness.contents = 0.25
        let white = AlienArt.material(UIColor(red:0.7,green:1,blue:0.96,alpha:1),glow:true)
        white.lightingModel = .constant
        let halo = AlienArt.material(color,glow:true)
        halo.lightingModel = .constant; halo.transparency = 0.13
        halo.writesToDepthBuffer = false; halo.isDoubleSided = true
        if rectangular {
            for side: Float in [-1,1] {
                _ = AlienArt.box(V3(0.07,1.06,0.14),metal,at:V3(side*0.525,0,-0.025),in:opening)
                _ = AlienArt.box(V3(0.014,0.90,0.016),white,at:V3(side*0.49,0,0.05),in:opening)
                _ = AlienArt.box(V3(1.10,0.07,0.14),metal,at:V3(0,side*0.525,-0.025),in:opening)
                for i in 0..<6 {
                    let glyph = AlienArt.box(V3(0.025,0.012,0.015),energy,at:V3(side*0.53,Float(i)*0.14-0.35,0.055),in:opening)
                    glyph.eulerAngles.z = side*0.4
                }
                for x: Float in [-0.45,0.45] {
                    _ = AlienArt.box(V3(0.13,0.11,0.17),metal,at:V3(x,side*0.49,0),in:opening)
                    _ = AlienArt.box(V3(0.075,0.016,0.02),energy,at:V3(x,side*0.49,0.09),in:opening)
                }
            }
        } else {
            opening.addChildNode(Self.ring(radius:0.516,thickness:0.022,material:metal))
            for i in 0..<8 {
                let a = Float(i) * .pi/4
                let plate = AlienArt.box(V3(0.075,0.038,0.06),metal,at:V3(sin(a)*0.52,cos(a)*0.52,0),in:opening)
                plate.eulerAngles.z = -a
                let inset = AlienArt.box(V3(0.035,0.008,0.015),white,at:V3(0,0,0.035),in:plate)
                inset.opacity = 0.8
            }
        }
        opening.addChildNode(Self.contourRing(kind:kind,radius:0.49,width:0.010,z:0.025,material:energy))
        opening.addChildNode(Self.contourRing(kind:kind,radius:0.49,width:0.035,z:0.024,material:halo))
        // Receding, increasingly small rings make the dark center read as depth.
        for i in 0..<5 {
            let carrier = SCNNode(); opening.addChildNode(carrier); ringNodes.append(carrier)
            let radius = 0.46-Float(i)*0.046
            carrier.position.z = -0.07-Float(i)*0.115
            carrier.addChildNode(Self.contourRing(kind:kind,radius:radius,width:0.003,z:0,material:energy))
            carrier.addChildNode(Self.contourRing(kind:kind,radius:radius,width:0.018,z:0,material:halo))
            carrier.opacity = CGFloat(0.75-Float(i)*0.10)
        }
        if !rectangular {
            for i in 0..<3 {
                let spiral = Self.spiral(material:energy)
                spiral.eulerAngles.z = Float(i)*2 * .pi/3; opening.addChildNode(spiral); spirals.append(spiral)
            }
            if kind == .air {
                let orbit = Self.ring(radius:0.56,thickness:0.004,material:white)
                orbit.eulerAngles = SCNVector3(.pi/2+0.3,0.3,0); orbit.opacity = 0.6
                opening.addChildNode(orbit)
            }
        }
        // Prebuilt short arcs track the actual opening contour, including corners.
        for i in 0..<24 {
            let a = Float(i)*2 * .pi/24
            let arc = SCNNode()
            for j in 0..<3 {
                let aa = a+Float(j)*0.06, bb = aa+0.06
                let pa = PortalPlacement.contour(aa,kind:kind)*(j % 2 == 0 ? 0.493 : 0.516)
                let pb = PortalPlacement.contour(bb,kind:kind)*(j % 2 == 0 ? 0.516 : 0.493)
                Self.segment(from:V3(pa.x,pa.y,0.055),to:V3(pb.x,pb.y,0.055),material:white,in:arc)
            }
            let merged = arc.flattenedClone(); opening.addChildNode(merged); arcNodes.append(merged)
        }
        let moteGeometry = SCNSphere(radius:0.006); moteGeometry.segmentCount = 6; moteGeometry.firstMaterial = white
        for _ in 0..<12 {
            let mote = SCNNode(geometry:moteGeometry); sparks.addChildNode(mote); orbiters.append(mote)
        }
        if kind == .wall || kind == .window {
            for i in 0..<8 {
                let a = Float(i)*2 * .pi/8, c = PortalPlacement.contour(a,kind:kind)
                let start = V3(c.x*0.50,c.y*0.50,0.02)
                let bend = V3(c.x*0.61+0.025,c.y*0.61,0.02)
                let end = V3(c.x*0.72,c.y*0.72-0.025,0.02)
                Self.segment(from:start,to:bend,material:energy,in:cracks)
                Self.segment(from:bend,to:end,material:energy,in:cracks)
                if kind == .window {
                    let shard = AlienArt.box(V3(0.026,0.07,0.018),white,at:bend,in:cracks)
                    shard.eulerAngles = SCNVector3(0.4,a,0.5); shard.opacity = 0.65
                }
            }
        }
        cracks.opacity = 0
        let silhouette = AlienArt.material(UIColor(red:0.04,green:0.065,blue:0.11,alpha:1))
        silhouette.lightingModel = .constant
        let head = AlienArt.sphere(0.10,silhouette,at:V3(0,0.12,0),in:shadow)
        head.scale = SCNVector3(1.2,0.85,0.55)
        let body = AlienArt.sphere(0.09,silhouette,at:V3(0,-0.035,0),in:shadow)
        body.scale = SCNVector3(0.85,1.3,0.5)
        for side: Float in [-1,1] {
            let eye = AlienArt.sphere(0.022,white,at:V3(side*0.046,0.13,0.048),in:shadow)
            eye.scale = SCNVector3(1,0.45,0.3); eye.eulerAngles.z = side*0.25
            let arm = AlienArt.sphere(0.045,silhouette,at:V3(side*0.10,-0.04,0),in:shadow)
            arm.scale = SCNVector3(0.6,2,0.65); arm.eulerAngles.z = side*0.3
            let leg = AlienArt.sphere(0.045,silhouette,at:V3(side*0.045,-0.17,0),in:shadow)
            leg.scale = SCNVector3(0.7,1.6,0.65)
        }
        shadow.position.z = -0.10; shadow.opacity = 0
        pulse.addChildNode(Self.contourRing(kind:kind,radius:0.49,width:0.006,z:0.055,material:white)); pulse.opacity = 0
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
    @discardableResult func preview() -> Bool {
        guard previewTime == 0 else { return false }
        previewTime = 1.4; arrival(); return true
    }
    func edited() { editTime = 0.25 }
    func impact(at uv: SIMD2<Float>) {
        hitTime = 0.65
        interior.setValue(NSNumber(value:uv.x),forKey:"portalHitX")
        interior.setValue(NSNumber(value:uv.y),forKey:"portalHitY")
    }
    func chargeUp(_ cue: SpawnCue?) {
        suppressed = (cue?.suppressionRemaining ?? 0) > 0
        charge = suppressed ? 0 : cue.map { 0.15+$0.progress*0.85 } ?? 0
        event = cue?.event ?? .normal
    }
    func arrival() { arrivalTime = 0.55 }
    func animate(dt: Float, reducedEffects: Bool) {
        time += dt; arrivalTime = max(0,arrivalTime-dt)
        previewTime = max(0,previewTime-dt); hitTime = max(0,hitTime-dt); editTime = max(0,editTime-dt)
        if activation > 0 { activation = min(1,activation+dt*1.5) }
        let previewCharge = sin(previewTime/1.4 * .pi)*0.9
        let power = max(charge,previewCharge)
        let tint: UIColor = suppressed ? .cyan : event == .overload ? .systemRed : color
        energy.diffuse.contents = tint; energy.emission.contents = tint; interior.diffuse.contents = tint
        interior.setValue(NSNumber(value:time),forKey:"portalTime")
        interior.setValue(NSNumber(value:power),forKey:"portalCharge")
        interior.setValue(NSNumber(value:hitTime),forKey:"portalHit")
        for (i,ring) in ringNodes.enumerated() {
            ring.eulerAngles.z = rectangular ? 0 : time*(i % 2 == 0 ? 0.16 : -0.21)
            let swell: Float = 1+sin(time*1.8-Float(i)*0.7)*0.018+power*0.025
            ring.scale = SCNVector3(swell,swell,1)
            ring.isHidden = reducedEffects && i % 2 == 1
        }
        for (i,spiral) in spirals.enumerated() {
            spiral.eulerAngles.z = Float(i)*2 * .pi/3-time*0.4
            spiral.opacity = CGFloat(0.16+power*0.18); spiral.isHidden = reducedEffects && i > 0
        }
        for (i,arc) in arcNodes.enumerated() {
            let phase = Float(i)/24 * 2 * .pi+time*(1.7+power)
            let flash = pow(max(0,sin(phase*3)),12)
            arc.opacity = CGFloat(flash*(0.45+power*0.5))
            arc.isHidden = reducedEffects && i % 3 != 0
        }
        for (i,mote) in orbiters.enumerated() {
            let a = Float(i)*2 * .pi/12+time*0.35
            let point = PortalPlacement.contour(a,kind:kind)*(0.52+sin(time+Float(i))*0.025)
            mote.position = SCNVector3(point.x,point.y,sin(time+Float(i))*0.09)
            mote.opacity = CGFloat(0.3+0.6*abs(sin(time+Float(i))))
            mote.isHidden = reducedEffects && i % 2 == 0
        }
        for handle in handles {
            let size: Float = 1+editTime*0.7
            handle.scale = SCNVector3(size,size,size)
        }
        cracks.opacity = CGFloat((invasionStarted ? activation : 0.3)*(0.35+power*0.45))
        let shadowScale: Float = 0.5+power*0.65
        shadow.scale = SCNVector3(shadowScale,shadowScale,1)
        shadow.opacity = CGFloat(power*0.9); shadow.position.z = -0.28+power*0.23
        shadow.eulerAngles.z = sin(time*1.4)*0.045
        let heavyPulse: Float = event == .heavy ? power*0.55 : 0
        pulse.opacity = CGFloat(max(arrivalTime/0.55,heavyPulse))
        let burst: Float = arrivalTime > 0 ? 1+(1-arrivalTime/0.55)*0.20 : 1+heavyPulse*0.28
        pulse.scale = SCNVector3(burst,burst,1)
        lightNode.light?.color = tint
        lightNode.light?.intensity = reducedEffects ? 0 : CGFloat(power*75+arrivalTime*90)
    }

    private static func segment(from start: V3,to end: V3,material: SCNMaterial,in parent: SCNNode) {
        let delta = end-start
        let bar = AlienArt.box(V3(0.003,length(delta),0.005),material,at:(start+end)/2,in:parent)
        bar.eulerAngles.z = -atan2(delta.x,delta.y)
    }
    private static func ring(radius: CGFloat,thickness: CGFloat,material: SCNMaterial) -> SCNNode {
        let shape = SCNTorus(ringRadius:radius,pipeRadius:thickness)
        shape.ringSegmentCount = 64; shape.pipeSegmentCount = 6; shape.firstMaterial = material
        let node = SCNNode(geometry:shape); node.eulerAngles.x = .pi/2; return node
    }
    private static func mesh(_ vertices: [SCNVector3], _ indices: [Int32], material: SCNMaterial) -> SCNNode {
        let geometry = SCNGeometry(sources:[SCNGeometrySource(vertices:vertices)],elements:[SCNGeometryElement(indices:indices,primitiveType:.triangles)])
        geometry.firstMaterial = material; return SCNNode(geometry:geometry)
    }
    private static func contourRing(kind: PortalKind,radius: Float,width: Float,z: Float,material: SCNMaterial) -> SCNNode {
        var vertices: [SCNVector3] = [], indices: [Int32] = []
        for i in 0...96 {
            let p = PortalPlacement.contour(Float(i)*2 * .pi/96,kind:kind)
            vertices.append(SCNVector3(p.x*(radius-width/2),p.y*(radius-width/2),z))
            vertices.append(SCNVector3(p.x*(radius+width/2),p.y*(radius+width/2),z))
            if i < 96 { let k = Int32(i*2); indices += [k,k+1,k+2,k+1,k+3,k+2] }
        }
        material.isDoubleSided = true
        return mesh(vertices,indices,material:material)
    }
    private static func tunnel(kind: PortalKind,material: SCNMaterial) -> SCNNode {
        var vertices: [SCNVector3] = [SCNVector3(0,0,-0.66)], indices: [Int32] = []
        for i in 0...96 {
            let p = PortalPlacement.contour(Float(i)*2 * .pi/96,kind:kind)
            vertices.append(SCNVector3(p.x*0.49,p.y*0.49,-0.005))
            vertices.append(SCNVector3(p.x*0.23,p.y*0.23,-0.66))
            if i < 96 { let k = Int32(i*2+1); indices += [k,k+1,k+2,k+1,k+3,k+2,0,k+1,k+3] }
        }
        return mesh(vertices,indices,material:material)
    }
    private static func spiral(material: SCNMaterial) -> SCNNode {
        var vertices: [SCNVector3] = [], indices: [Int32] = []
        for i in 0...64 {
            let t = Float(i)/64, a = t*2 * .pi, r = 0.45-t*0.22
            let width: Float = 0.002+sin(t * .pi)*0.006
            vertices.append(SCNVector3(sin(a)*(r-width),cos(a)*(r-width),-0.04-t*0.56))
            vertices.append(SCNVector3(sin(a)*(r+width),cos(a)*(r+width),-0.04-t*0.56))
            if i < 64 { let k = Int32(i*2); indices += [k,k+1,k+2,k+1,k+3,k+2] }
        }
        return mesh(vertices,indices,material:material)
    }
    private static let vortexShader = """
    #pragma arguments
    float portalTime;
    float portalCharge;
    float portalSquare;
    float portalHit;
    float portalHitX;
    float portalHitY;
    #pragma transparent
    #pragma body
    float2 uv = _surface.diffuseTexcoord;
    float2 p = uv * 2.0 - 1.0;
    float r = length(p);
    float square = pow(pow(abs(p.x),6.0)+pow(abs(p.y),6.0),1.0/6.0);
    float edge = mix(r,square,portalSquare);
    float mask = 1.0-smoothstep(0.96,1.0,edge);
    float angle = atan2(p.y,p.x);
    float flow = angle*3.0+r*12.0-portalTime*1.3;
    float filament = pow(0.5+0.5*sin(flow+sin(r*9.0-portalTime)*0.6),18.0);
    float counter = pow(0.5+0.5*sin(angle*5.0-r*15.0+portalTime*0.8),28.0);
    float rim = pow(clamp(edge,0.0,1.0),10.0);
    float centerFade = smoothstep(0.18,0.78,r);
    float shimmer = 0.5+0.5*sin(edge*65.0-portalTime*3.0);
    float hitAge = 1.0-portalHit/0.65;
    float hitDistance = length(uv-float2(portalHitX,portalHitY));
    float impact = (1.0-smoothstep(0.012,0.05,abs(hitDistance-hitAge*0.8)))*portalHit/0.65;
    float strength = ((filament*0.55+counter*0.2)*centerFade+rim*(0.5+shimmer*0.2))*(0.65+portalCharge*0.55);
    float3 tint = _output.color.rgb;
    float3 glow = tint*strength+float3(0.65,0.95,1.0)*(impact*0.95+pow(filament,2.0)*centerFade*0.10);
    float alpha = (0.09+strength*0.60+impact*0.65)*mask;
    _output.color = float4(glow*mask,clamp(alpha,0.0,0.88));
    """
}
