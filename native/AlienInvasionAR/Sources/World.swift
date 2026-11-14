import Foundation

typealias V3 = SIMD3<Float>
func dot(_ a: V3, _ b: V3) -> Float { a.x*b.x + a.y*b.y + a.z*b.z }
func length(_ a: V3) -> Float { sqrt(dot(a,a)) }
func normalized(_ a: V3) -> V3 { a / max(0.0001, length(a)) }

/// Camera displacement includes the arc of an outstretched arm while the player
/// turns in place. This allowance is not body tracking or permission to walk.
func isWithinStationaryCombatArea(_ position: V3, origin: V3) -> Bool {
    let delta = position - origin
    let cameraAllowance: Float = 1.25
    return delta.x*delta.x + delta.z*delta.z < cameraAllowance*cameraAllowance
}

enum AlienKind: Int, CaseIterable {
    case runner, armor, brute, flyer
    var hp: Float { [2, 5, 10, 3][rawValue] }
    var speed: Float { [0.24, 0.13, 0.09, 0.2][rawValue] }
    var radius: Float { [0.22, 0.29, 0.38, 0.24][rawValue] }
    var damage: Float { [5, 8, 12, 5][rawValue] }
    var windupDuration: Float { [0.45, 0.65, 0.85, 0.55][rawValue] }
}
enum PortalKind: String, CaseIterable { case air = "Air", door = "Door", window = "Window", wall = "Wall", ceiling = "Ceiling" }
struct Entrance {
    let id = UUID()
    var position: V3
    var kind: PortalKind
}
struct Alien {
    let id = UUID()
    var kind: AlienKind
    var position: V3
    var hp: Float
    var age: Float = 0
    var attackCooldown: Float = 1
    var attackWindup: Float = 0
    var stagger: Float = 0
    var staggerImmunity: Float = 0
    var movementPhase: Float = 0
    var attackProgress: Float { attackWindup > 0 ? 1 - attackWindup / kind.windupDuration : 0 }
    // Presentation can signal the actual entrance without guessing from a
    // ground enemy's height-adjusted position or its later movement.
    var entranceID: UUID? = nil
    var emergenceOrigin: V3? = nil
    var empowered: Float = 0
}
enum BreachEvent: String { case normal, overload, swarm, heavy }
struct SpawnCue {
    let id = UUID()
    let entrance: Entrance
    let kind: AlienKind
    let event: BreachEvent
    let duration: Float
    var remaining: Float
    var progress: Float { 1 - remaining / duration }
}
enum Weapon: Int {
    case plasma, zapper
    var capacity: Int { self == .plasma ? 24 : 8 }
    var damage: Float { self == .plasma ? 1 : 4 }
    var interval: Float { self == .plasma ? 0.15 : 0.55 }
}

/// All simulation coordinates are metres relative to one ARAnchor. No camera
/// angle, projection, visibility, or frustum participates in simulation updates.
final class InvasionWorld {
    var aliens: [Alien] = []
    var entrances: [Entrance] = []
    var player = V3.zero
    var health: Float = 100
    var score = 0
    var kills = 0
    var wave = 1
    var spawned = 0
    var spawnTimer: Float = 0
    var waveBreak: Float = 0
    var weapon = Weapon.plasma
    var ammunition = [24, 8]
    var reload: Float = 0
    var cooldown: Float = 0
    var finished = false
    var won = false
    var paused = false
    var pendingSpawn: SpawnCue?
    static let maximumAliens = 8
    var threatsRemaining: Int { max(0, waveTarget-spawned) + aliens.count }
    var waveTarget: Int { [6, 9, 12][min(2, wave-1)] }
    var ammo: Int { ammunition[weapon.rawValue] }

    func reset() {
        aliens.removeAll(); health = 100; score = 0; kills = 0; wave = 1
        spawned = 0; spawnTimer = 0; waveBreak = 0; reload = 0; cooldown = 0
        ammunition = [24,8]; weapon = .plasma; finished = false; won = false; paused = false; pendingSpawn = nil
    }
    func spawn(at portal: Entrance, kind: AlienKind, event: BreachEvent = .normal, emerging: Bool = false) {
        var p = portal.position
        let actual: AlienKind = portal.kind == .ceiling || portal.kind == .air ? .flyer : kind
        if actual != .flyer && !emerging { p.y = actual.radius }
        let hp = actual.hp * (event == .heavy && actual == .flyer ? 2 : 1)
        let phase = Float(aliens.count % 8) * 2.399
        aliens.append(Alien(kind: actual, position: p, hp: hp, movementPhase: phase, entranceID: portal.id,
                            emergenceOrigin: emerging ? portal.position : nil,
                            empowered: event == .overload ? 6 : 0))
    }
    func update(_ dt: Float) {
        guard !paused, !finished else { return }
        cooldown = max(0,cooldown-dt)
        if reload > 0 {
            reload = max(0,reload-dt)
            if reload == 0 { ammunition[weapon.rawValue] = weapon.capacity }
        }
        if waveBreak > 0 { waveBreak = max(0,waveBreak-dt); return }
        if var cue = pendingSpawn {
            cue.remaining = max(0, cue.remaining-dt)
            pendingSpawn = cue
            if cue.remaining == 0 {
                spawn(at: cue.entrance, kind: cue.kind, event: cue.event, emerging: true)
                spawned += 1; pendingSpawn = nil
                spawnTimer = cue.event == .swarm ? 0.08 : max(0.5, 1.4-Float(wave)*0.25)
            }
        } else {
            spawnTimer -= dt
            if spawned < waveTarget, spawnTimer <= 0, !entrances.isEmpty, aliens.count < Self.maximumAliens {
                let event: BreachEvent = wave == 3 && spawned == 0 ? .heavy :
                    wave >= 2 && (3...5).contains(spawned) ? .swarm :
                    wave >= 2 && spawned % 6 == 1 ? .overload : .normal
                let kind: AlienKind = event == .heavy ? .brute : event == .swarm ? .runner :
                    wave == 1 ? (spawned == 5 ? .armor : .runner) : AlienKind(rawValue:(spawned + wave) % 4)!
                // Rotate the starting entrance each wave. The cue keeps the exact
                // entrance identity through charging, emergence and offscreen play.
                let entrance = entrances[(spawned + wave-1) % entrances.count]
                let duration: Float = event == .heavy ? 2 : event == .swarm ? 0.38 : spawned == 0 ? 1.8 : 0.9
                pendingSpawn = SpawnCue(entrance: entrance, kind: kind, event: event, duration: duration, remaining: duration)
            }
        }
        for i in aliens.indices {
            aliens[i].age += dt
            aliens[i].staggerImmunity = max(0, aliens[i].staggerImmunity-dt)
            aliens[i].empowered = max(0, aliens[i].empowered-dt)
            if aliens[i].stagger > 0 {
                aliens[i].stagger = max(0, aliens[i].stagger-dt)
                continue
            }
            if let start = aliens[i].emergenceOrigin {
                var end = start
                if aliens[i].kind != .flyer { end.y = aliens[i].kind.radius }
                let t = min(1, aliens[i].age / 0.8), smooth = t*t*(3-2*t)
                aliens[i].position = start + (end-start)*smooth
                if aliens[i].age < 0.8 { continue }
            }
            aliens[i].emergenceOrigin = nil
            var destination = player
            destination.y = aliens[i].kind == .flyer ? player.y : aliens[i].kind.radius
            let d = destination - aliens[i].position
            let distance = length(d)
            // Deterministic world-space steering: never depends on camera visibility.
            // Taper lateral motion near the player and bound total speed.
            if distance > 0.76 {
                aliens[i].attackWindup = 0
                let forward = normalized(d)
                let side = V3(-forward.z, 0, forward.x)
                let phase = aliens[i].age + aliens[i].movementPhase
                let taper = min(1, max(0, (distance-0.76)/0.8))
                let sway: Float = aliens[i].kind == .runner ? sin(phase*3)*0.55 :
                    aliens[i].kind == .flyer ? sin(phase*1.8)*0.7 : 0
                let rise: Float = aliens[i].kind == .flyer ? cos(phase*2.2)*0.22*taper : 0
                let heading = normalized(forward + side*sway*taper + V3(0,rise,0))
                let speed = aliens[i].kind.speed * (aliens[i].empowered > 0 ? 1.5 : 1)
                aliens[i].position += heading * min(distance-0.75, speed*dt)
            } else if aliens[i].attackWindup > 0 {
                aliens[i].attackWindup = max(0, aliens[i].attackWindup-dt)
                if aliens[i].attackWindup == 0 {
                    health = max(0, health-aliens[i].kind.damage)
                    aliens[i].attackCooldown = 1.6
                }
            } else {
                aliens[i].attackCooldown = max(0, aliens[i].attackCooldown-dt)
                if aliens[i].attackCooldown == 0 {
                    aliens[i].attackWindup = aliens[i].kind.windupDuration
                }
            }
        }
        if health <= 0 { finished = true; return }
        if spawned == waveTarget && aliens.isEmpty {
            if wave == 3 { finished = true; won = true }
            else { wave += 1; spawned = 0; spawnTimer = 0; waveBreak = 2.5; health = min(100,health+15); ammunition = [24,8] }
        }
    }
    func beginReload() { if reload == 0 && ammo < weapon.capacity { reload = 1.2 } }
    func switchWeapon() { if reload == 0 { weapon = weapon == .plasma ? .zapper : .plasma } }

    /// Ray/sphere intersections in the same 3D space as the tracked player.
    /// Nearest positive intersection wins; aliens behind the ray cannot be hit.
    func target(origin: V3, direction: V3) -> (UUID, Float)? {
        let ray = normalized(direction)
        var nearest: (UUID,Float)?
        for alien in aliens {
            let oc = origin-alien.position
            let b = dot(oc,ray)
            let c = dot(oc,oc)-alien.kind.radius*alien.kind.radius
            let discriminant = b*b-c
            guard discriminant >= 0 else { continue }
            let entry = -b-sqrt(discriminant), exit = -b+sqrt(discriminant)
            let t = entry >= 0 ? entry : exit
            if t >= 0 && t <= 15 && (nearest == nil || t < nearest!.1) { nearest = (alien.id,t) }
        }
        return nearest
    }
    @discardableResult func shoot(origin: V3, direction: V3) -> (UUID, Float)? {
        guard !paused, !finished, cooldown == 0, reload == 0, ammo > 0 else { return nil }
        ammunition[weapon.rawValue] -= 1; cooldown = weapon.interval
        guard let hit = target(origin:origin,direction:direction), let i = aliens.firstIndex(where:{$0.id == hit.0}) else { return nil }
        aliens[i].hp -= weapon.damage
        // Heavy enemies resist plasma interruption. A recovery window prevents
        // holding FIRE from indefinitely stun-locking an enemy.
        if aliens[i].staggerImmunity == 0 && (weapon == .zapper || aliens[i].kind == .runner || aliens[i].kind == .flyer) {
            aliens[i].stagger = weapon == .zapper ? 0.28 : 0.12
            aliens[i].staggerImmunity = 1.4
            aliens[i].attackWindup = 0
            aliens[i].attackCooldown = max(0.4, aliens[i].attackCooldown)
        }
        if aliens[i].hp <= 0 {
            score += 100*(aliens[i].kind.rawValue+1); kills += 1; aliens.remove(at:i)
        }
        return hit
    }
}
