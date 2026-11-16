import XCTest
@testable import InvasionCore

final class WorldTests: XCTestCase {
    func testSpawnRemembersExactEntranceAfterMovementAndPause() {
        let w = InvasionWorld(); w.spawned = w.waveTarget; w.player = V3(0, 1.6, 0)
        let wall = Entrance(position: V3(0, 1.8, -3), kind: .wall)
        let air = Entrance(position: V3(0, 2.4, -3), kind: .air)
        w.spawn(at: wall, kind: .runner); w.spawn(at: air, kind: .brute)
        XCTAssertEqual(w.aliens.map(\.entranceID), [wall.id, air.id])
        XCTAssertEqual(w.aliens[0].position.y, AlienKind.runner.radius)
        XCTAssertEqual(w.aliens[1].kind, .flyer)
        let before = w.aliens.map(\.position)
        for _ in 0..<180 { w.update(1 / 60) }
        XCTAssertNotEqual(w.aliens.map(\.position), before)
        XCTAssertEqual(w.aliens.map(\.entranceID), [wall.id, air.id])
        w.paused = true; w.update(3)
        XCTAssertEqual(w.aliens.map(\.entranceID), [wall.id, air.id])
        w.reset(); XCTAssertTrue(w.aliens.isEmpty)
    }
    func testMovementGuardAllowsArmHeldTurnAndRejectsLeavingArea() {
        let origin = V3(0,1.6,-0.5)
        // Phone held half a metre ahead, then rotated with the stationary player.
        XCTAssertTrue(isWithinStationaryCombatArea(V3(0.5,1.6,0),origin:origin))
        XCTAssertTrue(isWithinStationaryCombatArea(V3(0,1.6,0.5),origin:origin))
        XCTAssertTrue(isWithinStationaryCombatArea(V3(0,2.1,-0.5),origin:origin))
        XCTAssertFalse(isWithinStationaryCombatArea(V3(1.25,1.6,-0.5),origin:origin))
        XCTAssertFalse(isWithinStationaryCombatArea(V3(1,1.6,0.5),origin:origin))
    }
    func testTurnAwayWaitTurnBackRetainsThreeAliens() {
        let w = InvasionWorld(); w.spawned = w.waveTarget
        w.player = V3(0,1.5,0)
        for x in [Float(-0.6),0,0.6] { w.spawn(at:Entrance(position:V3(x,0,-3),kind:.door),kind:.runner) }
        let ids = w.aliens.map(\.id), before = w.aliens.map(\.position)
        // Camera turns 180 degrees. Forward ray points away from all three.
        XCTAssertNil(w.target(origin:V3(0,0.22,0),direction:V3(0,0,1)))
        for _ in 0..<180 { w.update(1/60) }
        XCTAssertEqual(w.aliens.map(\.id),ids)
        for i in 0..<3 {
            XCTAssertGreaterThan(w.aliens[i].position.z,before[i].z)
            XCTAssertEqual(w.aliens[i].hp,2)
        }
        // Turn back. Aim in real 3D; existing enemies can still be defeated.
        for id in ids {
            for _ in 0..<2 {
                let alien = w.aliens.first(where:{$0.id == id})!
                w.cooldown = 0
                XCTAssertEqual(w.shoot(origin:w.player,direction:alien.position-w.player)?.0,id)
            }
        }
        XCTAssertEqual(w.kills,3); XCTAssertTrue(w.aliens.isEmpty)
    }
    func testOffscreenAttacksAndTrackingPause() {
        let w=InvasionWorld(); w.spawned=w.waveTarget; w.player=V3(0,0.22,0)
        w.spawn(at:Entrance(position:V3(0,0,0.7),kind:.wall),kind:.runner)
        for _ in 0..<120 { w.update(1/60) }
        XCTAssertLessThan(w.health,100)
        let hp=w.health, p=w.aliens[0].position
        w.paused=true; w.update(20)
        XCTAssertEqual(w.health,hp); XCTAssertEqual(w.aliens[0].position,p)
    }
    func testRayHitsNearestInThreeDimensions() {
        let w=InvasionWorld(); w.spawned=w.waveTarget
        w.spawn(at:Entrance(position:V3(0,2,-2),kind:.ceiling),kind:.runner)
        w.spawn(at:Entrance(position:V3(0,2,-4),kind:.ceiling),kind:.runner)
        XCTAssertNil(w.target(origin:.zero,direction:V3(0,0,-1)))
        XCTAssertEqual(w.target(origin:V3(0,2,0),direction:V3(0,0,-1))?.0,w.aliens[0].id)
    }
    func testAllThreeWavesCanBeWonAndRestarted() {
        let w=InvasionWorld(); w.entrances=[Entrance(position:V3(0,0,-4),kind:.wall)]; w.player=V3(0,1.5,0)
        for _ in 0..<20000 {
            w.update(1/60)
            if let a=w.aliens.first { w.cooldown=0; w.ammunition=[24,8]; w.weapon = .zapper; w.shoot(origin:w.player,direction:a.position-w.player) }
            if w.finished { break }
        }
        XCTAssertTrue(w.won); XCTAssertEqual(w.kills,27)
        w.reset(); XCTAssertFalse(w.finished); XCTAssertEqual(w.health,100); XCTAssertEqual(w.wave,1)
    }
    func testReloadWeaponAndGameOver() {
        let w=InvasionWorld(); w.spawned=w.waveTarget; w.ammunition=[0,8]
        w.beginReload(); w.update(1.3); XCTAssertEqual(w.ammo,24)
        w.switchWeapon(); XCTAssertEqual(w.weapon,.zapper)
        w.spawn(at:Entrance(position:.zero,kind:.wall),kind:.brute)
        for _ in 0..<3000 { w.update(1/60) }
        XCTAssertTrue(w.finished); XCTAssertFalse(w.won); XCTAssertEqual(w.health,0)
    }
}
