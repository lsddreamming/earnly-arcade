import XCTest
@testable import InvasionCore

final class PortalInteractionTests: XCTestCase {
    private func room() -> InvasionWorld {
        let w = InvasionWorld(); w.player = V3(0,1.5,0)
        w.entrances = [Entrance(position:V3(0,1.5,-3),kind:.door),Entrance(position:V3(2,1.5,-3),kind:.air)]
        w.update(0.01); return w
    }
    func testShotApertureMatchesShapeAndRejectsRaysBehindPlayer() {
        let p = PortalPlacement(center:V3(0,0,-3),right:V3(1,0,0),up:V3(0,1,0),width:2,height:2)
        XCTAssertEqual(p.hitDistance(origin:.zero,direction:V3(0,0,-2),kind:.air)!,3,accuracy:0.0001)
        XCTAssertNil(p.hitDistance(origin:.zero,direction:V3(0,0,1),kind:.door))
        XCTAssertNil(p.hitDistance(origin:.zero,direction:V3(0.85,0.85,-3),kind:.air))
        XCTAssertNotNil(p.hitDistance(origin:.zero,direction:V3(0.85,0.85,-3),kind:.door))
        XCTAssertNil(p.hitDistance(origin:.zero,direction:V3(0.98,0.98,-3),kind:.window))
        XCTAssertEqual(p.apertureCoordinates(V3(0.5,0.5,-3)),SIMD2(0.75,0.25))
        for kind in PortalKind.allCases {
            for i in 0..<48 {
                let c = PortalPlacement.contour(Float(i)*2 * .pi/48,kind:kind)*0.999
                XCTAssertNotNil(p.hitDistance(origin:.zero,direction:V3(c.x,c.y,-3),kind:kind))
            }
        }
    }
    func testPortalBlocksEnemiesBehindItButFrontEnemyStillTakesOneShot() {
        let w = room(); w.spawn(at:w.entrances[0],kind:.armor)
        w.aliens[0].position = V3(0,1.5,-4)
        XCTAssertNil(w.shoot(origin:w.player,direction:V3(0,0,-1),maximumDistance:3))
        XCTAssertEqual(w.ammo,23); XCTAssertEqual(w.aliens[0].hp,5)
        w.cooldown=0; w.aliens[0].position = V3(0,1.5,-2)
        XCTAssertNotNil(w.shoot(origin:w.player,direction:V3(0,0,-1),maximumDistance:3))
        XCTAssertEqual(w.ammo,22); XCTAssertEqual(w.aliens[0].hp,4)
    }
    func testThreeHitsDelayOnlyTheChargingPortalOnceAndNeverAwardPoints() {
        let w = room(), id = w.pendingSpawn!.entrance.id
        XCTAssertFalse(w.disruptPortal(w.entrances[1].id,weapon:.zapper))
        XCTAssertEqual(w.pendingSpawn?.disruptionHits,0)
        XCTAssertFalse(w.disruptPortal(id,weapon:.plasma))
        XCTAssertFalse(w.disruptPortal(id,weapon:.plasma))
        XCTAssertTrue(w.disruptPortal(id,weapon:.plasma))
        let before = w.pendingSpawn!.remaining
        w.update(0.5)
        XCTAssertEqual(w.pendingSpawn?.remaining,before)
        XCTAssertFalse(w.disruptPortal(id,weapon:.zapper))
        XCTAssertEqual(w.pendingSpawn?.suppressionRemaining,0.75)
        w.update(0.8)
        XCTAssertEqual(w.pendingSpawn!.remaining,before-0.05,accuracy:0.0001)
        XCTAssertEqual(w.score,0); XCTAssertEqual(w.spawned,0); XCTAssertEqual(w.kills,0)
    }
    func testZapperDelayFreezesDuringPauseAndResetClearsIt() {
        let w = room(), id = w.pendingSpawn!.entrance.id
        XCTAssertFalse(w.disruptPortal(id,weapon:.zapper))
        XCTAssertTrue(w.disruptPortal(id,weapon:.zapper))
        w.paused=true; w.update(10)
        XCTAssertEqual(w.pendingSpawn?.suppressionRemaining,1.25)
        XCTAssertFalse(w.disruptPortal(id,weapon:.plasma))
        w.paused=false
        for _ in 0..<200 { w.update(1/60); if !w.aliens.isEmpty { break } }
        XCTAssertEqual(w.spawned,1); XCTAssertEqual(w.aliens.first?.entranceID,id)
        w.reset(); XCTAssertNil(w.pendingSpawn); XCTAssertEqual(w.ammunition,[24,8])
    }
    func testDelayingEveryBreachStillCompletesAllThreeWaves() {
        let w = room(); var delayed = Set<UUID>()
        for _ in 0..<30000 {
            w.update(1/60)
            if let cue = w.pendingSpawn, !cue.wasDisrupted {
                w.disruptPortal(cue.entrance.id,weapon:.zapper)
                if w.disruptPortal(cue.entrance.id,weapon:.zapper) { delayed.insert(cue.id) }
            }
            if let a = w.aliens.first, a.age > 0.9 {
                w.weapon = .zapper; w.cooldown=0; w.ammunition=[24,8]
                w.shoot(origin:w.player,direction:a.position-w.player)
            }
            if w.finished { break }
        }
        XCTAssertTrue(w.won); XCTAssertEqual(w.kills,27); XCTAssertEqual(delayed.count,27)
        XCTAssertEqual(w.threatsRemaining,0)
    }
}
