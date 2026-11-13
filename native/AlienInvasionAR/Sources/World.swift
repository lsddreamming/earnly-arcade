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
    var waveTarget: Int { [6, 9, 12][min(2, wave-1)] }
    var ammo: Int { ammunition[weapon.rawValue] }

    func reset() {
        aliens.removeAll(); health = 100; score = 0; kills = 0; wave = 1
        spawned = 0; spawnTimer = 0; waveBreak = 0; reload = 0; cooldown = 0
        ammunition = [24,8]; weapon = .plasma; finished = false; won = false; paused = false
    }
    func spawn(at portal: Entrance, kind: AlienKind) {
        var p = portal.position
        let actual: AlienKind = portal.kind == .ceiling || portal.kind == .air ? .flyer : kind
        if actual != .flyer { p.y = actual.radius }
        aliens.append(Alien(kind: actual, position: p, hp: actual.hp))
    }
    func update(_ dt: Float) {
        guard !paused, !finished else { return }
        cooldown = max(0,cooldown-dt)
        if reload > 0 {
            reload = max(0,reload-dt)
            if reload == 0 { ammunition[weapon.rawValue] = weapon.capacity }
        }
        if waveBreak > 0 { waveBreak = max(0,waveBreak-dt); return }
        spawnTimer -= dt
        if spawned < waveTarget, spawnTimer <= 0, !entrances.isEmpty {
            let kind: AlienKind = wave == 1 ? (spawned == 5 ? .armor : .runner) : AlienKind(rawValue:(spawned + wave) % 4)!
            spawn(at: entrances[spawned % entrances.count], kind: kind)
            spawned += 1; spawnTimer = max(0.7, 1.9-Float(wave)*0.3)
        }
        for i in aliens.indices {
            aliens[i].age += dt
            var destination = player
            destination.y = aliens[i].kind == .flyer ? player.y : aliens[i].kind.radius
            let d = destination - aliens[i].position
            let distance = length(d)
            // Stop short of the player; no physical movement is required.
            if distance > 0.75 {
                aliens[i].position += normalized(d) * min(distance-0.75, aliens[i].kind.speed*dt)
            } else {
                aliens[i].attackCooldown -= dt
                if aliens[i].attackCooldown <= 0 {
                    health = max(0, health-aliens[i].kind.damage)
                    aliens[i].attackCooldown = 1.6
                }
            }
        }
        if health <= 0 { finished = true; return }
        if spawned == waveTarget && aliens.isEmpty {
            if wave == 3 { finished = true; won = true }
            else { wave += 1; spawned = 0; waveBreak = 2.5; health = min(100,health+15); ammunition = [24,8] }
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
        if aliens[i].hp <= 0 {
            score += 100*(aliens[i].kind.rawValue+1); kills += 1; aliens.remove(at:i)
        }
        return hit
    }
}
