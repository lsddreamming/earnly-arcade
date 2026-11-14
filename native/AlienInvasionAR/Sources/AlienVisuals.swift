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
    private let reactor = SCNNode()
    private let skin: SCNMaterial
    private var previousPosition: V3?
    private var previousAttack: Float = 1
    private var hitRemaining: Float = 0
    private var attackRemaining: Float = 0

    init(kind: AlienKind) {
        color = [UIColor.systemGreen, .systemPurple, .systemOrange, .systemTeal][kind.rawValue]
        skin = AlienArt.material(color)
        let dark = AlienArt.material(UIColor(red: 0.06, green: 0.09, blue: 0.17, alpha: 1))
        let white = AlienArt.material(.white)
        let glow = AlienArt.material(kind == .brute ? .systemYellow : .cyan, glow: true)
        let armor = AlienArt.material(UIColor(red: 0.24, green: 0.17, blue: 0.39, alpha: 1))
        let trim = AlienArt.material(UIColor(red: 0.65, green: 0.78, blue: 0.90, alpha: 1))
        armor.metalness.contents = 0.65
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
        // Silhouette and surface detail use small cached meshes, not lights or
        // screen-space overlays. They all remain children of the actor pose.
        for side: Float in [-1, 1] {
            if kind == .runner {
                let ear = AlienArt.sphere(r * 0.23, skin, at: V3(side * r * 0.61, r * 0.12, 0), in: head)
                ear.scale = SCNVector3(1.55, 0.65, 0.35); ear.eulerAngles.z = side * 0.35
                for i in 0..<3 {
                    _ = AlienArt.sphere(r * 0.035, glow,
                        at: V3(side * r * (0.30 + Float(i) * 0.07), -r * 0.13, r * 0.47), in: head)
                }
            } else if kind == .armor || kind == .brute {
                let plate = AlienArt.box(V3(r * 0.27, r * 0.12, r * 0.06), trim,
                    at: V3(side * r * 0.28, r * 0.17, r * 0.63), in: pose)
                plate.eulerAngles.z = side * 0.25
                for i in 0..<2 {
                    _ = AlienArt.box(V3(r * 0.18, r * 0.045, r * 0.06), glow,
                        at: V3(side * r * 0.30, -r * (0.12 + Float(i) * 0.12), r * 0.63), in: pose)
                }
                _ = AlienArt.sphere(r * 0.075, trim, at: V3(side * r * 0.66, r * 0.25, r * 0.34), in: pose)
            } else {
                let pod = AlienArt.sphere(r * 0.21, dark, at: V3(side * r * 0.46, -r * 0.30, -r * 0.12), in: pose)
                pod.scale = SCNVector3(0.65, 1.25, 0.8)
                let exhaust = AlienArt.sphere(r * 0.13, glow, at: V3(0, -r * 0.23, 0), in: pod)
                exhaust.scale = SCNVector3(0.8, 1.7, 0.8)
            }
        }
        reactor.position = SCNVector3(0, -r * 0.04, r * 0.66); pose.addChildNode(reactor)
        let core = AlienArt.sphere(r * 0.105, glow, at: .zero, in: reactor)
        core.scale.z = 0.4
        let collar = SCNTorus(ringRadius: CGFloat(r * 0.15), pipeRadius: CGFloat(r * 0.022))
        collar.ringSegmentCount = 12; collar.pipeSegmentCount = 6; collar.firstMaterial = trim
        let ring = SCNNode(geometry: collar); ring.eulerAngles.x = .pi / 2; reactor.addChildNode(ring)
        if kind == .brute {
            for i in -1...1 {
                let crest = AlienArt.box(V3(r * 0.13, r * 0.20, r * 0.27), armor,
                    at: V3(Float(i) * r * 0.19, r * 0.50, -r * 0.02), in: head)
                crest.eulerAngles.z = -Float(i) * 0.14
            }
        }
    }

    func hit() { hitRemaining = 0.18 }

    func update(_ alien: Alien, player: V3, dt: Float) {
        let moving = previousPosition.map { length(alien.position - $0) > 0.00001 } ?? true
        previousPosition = alien.position
        if alien.attackCooldown > previousAttack + 0.1 { attackRemaining = 0.28 }
        previousAttack = alien.attackCooldown
        hitRemaining = max(0, hitRemaining - dt); attackRemaining = max(0, attackRemaining - dt)
        node.simdPosition = alien.position
        let delta = player - alien.position
        node.eulerAngles.y = atan2(delta.x, delta.z)
        let gait = sin(alien.age * (alien.kind == .runner ? 13 : 7)) * (moving ? Float(0.55) : 0)
        for (i, leg) in legs.enumerated() { leg.eulerAngles.x = (i == 0 ? gait : -gait) }
        let strike = sin((1 - attackRemaining / 0.28) * .pi) * 1.2
        for (i, arm) in arms.enumerated() { arm.eulerAngles.x = (i == 0 ? -gait : gait) * 0.65 - strike }
        for (i, wing) in wings.enumerated() { wing.eulerAngles.z = sin(alien.age * 24) * (i == 0 ? 0.4 : -0.4) }
        // Only a small cosmetic bob; the actor root stays at its exact hit position.
        pose.position.y = sin(alien.age * (alien.kind == .flyer ? 5 : 14)) * (moving ? 0.012 : 0.004)
        pose.eulerAngles.z = hitRemaining > 0 ? sin(hitRemaining * 65) * 0.13 : 0
        let squash = hitRemaining / 0.18
        let arrival = min(1, max(0.05, alien.age / 0.24))
        pose.scale = SCNVector3((1 + squash * 0.08) * arrival, (1 - squash * 0.10) * arrival, arrival)
        skin.emission.contents = hitRemaining > 0 ? UIColor.white : color
        skin.emission.intensity = hitRemaining > 0 ? 0.55 : 0.08
        let pulse = 1 + sin(alien.age * 4) * 0.10
        reactor.scale = SCNVector3(pulse, pulse, 1)
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
    private var kick: Float = 0
    private let rotor = SCNNode()
    private var cells: [SCNNode] = []
    private var age: Float = 0

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
            _ = AlienArt.box(V3(0.012, 0.043, 0.09), trim, at: V3(side * 0.048, -0.008, 0.028), in: node)
            for i in 0..<3 {
                _ = AlienArt.box(V3(0.014, 0.005, 0.024), dark,
                    at: V3(side * 0.055, -0.018 + Float(i) * 0.012, 0.03), in: node)
            }
        }
        _ = AlienArt.box(V3(0.065, 0.028, 0.048), trim, at: V3(0, 0.043, 0.065), in: node)
        for i in 0..<6 {
            cells.append(AlienArt.box(V3(0.009, 0.004, 0.018), energy,
                at: V3(-0.027 + Float(i) * 0.011, 0.060, 0.065), in: node))
        }
        rotor.position = SCNVector3(0, 0.045, -0.055); node.addChildNode(rotor)
        let chamber = AlienArt.sphere(0.024, energy, at: .zero, in: rotor)
        chamber.scale = SCNVector3(0.7, 0.7, 1.3)
        for side: Float in [-1, 1] {
            _ = AlienArt.box(V3(0.008, 0.045, 0.045), trim, at: V3(side * 0.027, 0, 0), in: rotor)
        }
        for i in 0..<3 {
            let ray = AlienArt.box(V3(0.006, 0.065, 0.004), energy, at: .zero, in: flash)
            ray.eulerAngles.z = Float(i) * .pi / 3
        }
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

    func update(dt: Float, reload: Float, charge: Float = 1) {
        age += dt
        kick = max(0, kick - dt * 9)
        let dip = reload > 0 ? sin(min(1, reload / 1.2) * .pi) : 0
        node.position = SCNVector3(0.10, -0.14 - dip * 0.10 + sin(age * 2) * 0.002, -0.30 + kick * 0.035)
        node.eulerAngles = SCNVector3(kick * 0.13, 0, -dip * 0.5)
        flash.isHidden = kick < 0.65
        rotor.eulerAngles.z += dt * (reload > 0 ? 7 : 1.5 + kick * 8)
        for (i, cell) in cells.enumerated() {
            cell.opacity = Float(i) < charge * Float(cells.count) ? 1 : 0.10
        }
    }
}

/// All moving light and breach details are children of the fixed portal plane.
/// Resizing reuses geometry; it never restarts animations or changes its anchor.
@available(iOS 17.0, *)
final class AlienPortalVisual {
    let node = SCNNode()
    let color: UIColor
    private let opening = SCNNode(), orbit = SCNNode(), cracks = SCNNode()
    private let rim: SCNNode, pulse: SCNNode
    private let energy: SCNMaterial
    private var handles: [SCNNode] = []
    private var crackSegments: [SCNNode] = []
    private var invasionStarted = false

    init(kind: PortalKind) {
        switch kind {
        case .air: color = .systemPurple
        case .door: color = .systemGreen
        case .window: color = .systemBlue
        case .wall: color = .systemOrange
        case .ceiling: color = .systemTeal
        }
        energy = AlienArt.material(color, glow: true)
        rim = Self.ring(radius: 0.5, thickness: 0.012, material: energy)
        pulse = Self.ring(radius: 0.5, thickness: 0.008, material: energy)
        node.addChildNode(opening); opening.addChildNode(rim); opening.addChildNode(pulse)
        pulse.opacity = 0; pulse.position.z = 0.02
        let void = SCNCylinder(radius: 0.48, height: 0.006)
        void.radialSegmentCount = 40
        let dark = AlienArt.material(UIColor(red: 0.025, green: 0.015, blue: 0.07, alpha: 1))
        dark.lightingModel = .constant; void.firstMaterial = dark
        let disk = SCNNode(geometry: void); disk.eulerAngles.x = .pi / 2
        disk.position.z = -0.012; opening.addChildNode(disk)
        // Concentric glow and orbiting sparks suggest depth without video,
        // imported assets, lights, shaders, or a growing particle system.
        for i in 0..<3 {
            let ring = Self.ring(radius: CGFloat(0.16 + Float(i) * 0.10), thickness: 0.003, material: energy)
            ring.opacity = CGFloat(0.12 + Float(i) * 0.08)
            ring.position.z = 0.004; opening.addChildNode(ring)
        }
        opening.addChildNode(orbit); orbit.position.z = 0.012
        for i in 0..<8 {
            let angle = Float(i) * .pi / 4
            let spark = AlienArt.box(V3(0.012, 0.045, 0.006), energy,
                                     at: V3(sin(angle) * 0.42, cos(angle) * 0.42, 0), in: orbit)
            spark.eulerAngles.z = -angle
        }
        orbit.runAction(.repeatForever(.rotateBy(x: 0, y: 0, z: .pi * 2, duration: 9)))
        rim.runAction(.repeatForever(.sequence([.fadeOpacity(to: 0.6, duration: 0.9), .fadeOpacity(to: 1, duration: 0.9)])))
        opening.addChildNode(cracks); cracks.isHidden = true
        if kind == .wall {
            for i in 0..<7 {
                let a = Float(i) * 2 * .pi / 7
                let start = V3(sin(a) * 0.50, cos(a) * 0.50, 0.008)
                let bend = V3(sin(a + 0.13) * 0.62, cos(a + 0.13) * 0.62, 0.008)
                let end = V3(sin(a - 0.06) * 0.77, cos(a - 0.06) * 0.77, 0.008)
                addCrack(from: start, to: bend); addCrack(from: bend, to: end)
                addCrack(from: bend, to: V3(sin(a + 0.32) * 0.71, cos(a + 0.32) * 0.71, 0.008))
            }
        }
        let handleMaterial = AlienArt.material(.cyan, glow: true)
        for _ in 0..<4 { handles.append(AlienArt.sphere(0.045, handleMaterial, at: .zero, in: node)) }
    }

    func update(width: Float, height: Float, editing: Bool) {
        opening.scale = SCNVector3(width, height, 1)
        energy.diffuse.contents = editing ? UIColor.cyan : color
        energy.emission.contents = editing ? UIColor.cyan : color
        let corners: [SIMD2<Float>] = [SIMD2(-1, -1), SIMD2(-1, 1), SIMD2(1, -1), SIMD2(1, 1)]
        for (i, handle) in handles.enumerated() {
            handle.position = SCNVector3(corners[i].x * width / 2, corners[i].y * height / 2, 0.035)
            handle.isHidden = !editing
        }
    }

    func beginInvasion() {
        guard !invasionStarted else { return }; invasionStarted = true
        cracks.isHidden = false
        for (i, segment) in crackSegments.enumerated() {
            segment.scale = SCNVector3(1, 0.001, 1)
            let grow = SCNAction.customAction(duration: 0.18) { node, time in
                node.scale.y = max(0.001, Float(time / 0.18))
            }
            segment.runAction(.sequence([.wait(duration: Double(i % 3) * 0.10 + Double(i / 3) * 0.025), grow]))
        }
        arrival()
    }

    func arrival() {
        // Reuse one pulse mesh per portal, including rapid diagnostic spawns.
        pulse.removeAction(forKey: "arrival"); pulse.scale = SCNVector3(1, 1, 1); pulse.opacity = 1
        pulse.runAction(.group([.scale(to: 1.25, duration: 0.40), .fadeOut(duration: 0.40)]), forKey: "arrival")
    }

    private func addCrack(from start: V3, to end: V3) {
        let delta = end - start, size = length(delta)
        let segment = SCNNode(); segment.simdPosition = start
        segment.eulerAngles.z = -atan2(delta.x, delta.y); cracks.addChildNode(segment)
        _ = AlienArt.box(V3(0.008, size, 0.006), energy, at: V3(0, size / 2, 0), in: segment)
        crackSegments.append(segment)
    }

    private static func ring(radius: CGFloat, thickness: CGFloat, material: SCNMaterial) -> SCNNode {
        let shape = SCNTorus(ringRadius: radius, pipeRadius: thickness)
        shape.ringSegmentCount = 40; shape.pipeSegmentCount = 6; shape.firstMaterial = material
        let node = SCNNode(geometry: shape); node.eulerAngles.x = .pi / 2; return node
    }
}
