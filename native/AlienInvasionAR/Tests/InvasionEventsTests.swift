import XCTest
@testable import InvasionCore

final class InvasionEventsTests: XCTestCase {
    private func room() -> InvasionWorld {
        let w = InvasionWorld(); w.player = V3(0,1.6,0)
        w.entrances = [Entrance(position:V3(-1,1.3,-4),kind:.door), Entrance(position:V3(1,2.5,-4),kind:.ceiling)]
        return w
    }
    func testChargePrecedesEmergenceAtExactEntrance() {
        let w=room(); w.update(1/60)
        let cue=w.pendingSpawn!
        XCTAssertTrue(w.aliens.isEmpty); XCTAssertEqual(cue.entrance.id,w.entrances[0].id)
        XCTAssertGreaterThan(cue.remaining,1)
        for _ in 0..<120 { w.update(1/60); if !w.aliens.isEmpty { break } }
        let a=w.aliens[0]
        XCTAssertEqual(a.entranceID,cue.entrance.id)
        XCTAssertEqual(a.position.x,cue.entrance.position.x,accuracy:0.001)
        XCTAssertEqual(a.position.z,cue.entrance.position.z,accuracy:0.001)
        XCTAssertGreaterThan(a.position.y,a.kind.radius)
        for _ in 0..<60 { w.update(1/60) }
        XCTAssertEqual(w.aliens[0].position.y,AlienKind.runner.radius,accuracy:0.001)
    }
    func testTrackingPauseFreezesCueReloadAndEmergence() {
        let w=room(); w.update(0.01); let cue=w.pendingSpawn!
        w.ammunition=[0,8]; w.beginReload(); w.paused=true; w.update(20)
        XCTAssertEqual(w.pendingSpawn?.remaining,cue.remaining); XCTAssertEqual(w.reload,1.2)
        XCTAssertTrue(w.aliens.isEmpty)
        w.paused=false
        for _ in 0..<120 { w.update(1/60); if !w.aliens.isEmpty { break } }
        let before=w.aliens[0]; w.paused=true; w.update(20)
        XCTAssertEqual(w.aliens[0].position,before.position); XCTAssertEqual(w.aliens[0].age,before.age)
        w.reset(); XCTAssertNil(w.pendingSpawn); XCTAssertTrue(w.aliens.isEmpty)
    }
    func testEventsUseExistingWaveBudgetAndCorrectEntrances() {
        let w=room(); var events=Set<String>(), entrances=Set<UUID>(); var maxActors=0
        for _ in 0..<30000 {
            w.update(1/60); maxActors=max(maxActors,w.aliens.count)
            if let cue=w.pendingSpawn { events.insert(cue.event.rawValue); entrances.insert(cue.entrance.id) }
            if let a=w.aliens.first, a.age > 0.9 {
                w.weapon = .zapper; w.cooldown=0; w.ammunition=[24,8]
                w.shoot(origin:w.player,direction:a.position-w.player)
            }
            if w.finished { break }
        }
        XCTAssertTrue(w.won); XCTAssertEqual(w.kills,27); XCTAssertEqual(w.threatsRemaining,0)
        XCTAssertEqual(events,Set(["normal","overload","swarm","heavy"]))
        XCTAssertEqual(entrances,Set(w.entrances.map(\.id)))
        XCTAssertLessThanOrEqual(maxActors,InvasionWorld.maximumAliens)
    }
    func testEnemyCapAndHeavyOverheadThreat() {
        let w=room(); w.wave=3; w.update(0.01)
        XCTAssertEqual(w.pendingSpawn?.event,.heavy)
        let ceiling=w.entrances[1]
        w.spawn(at:ceiling,kind:.brute,event:.heavy,emerging:true)
        XCTAssertEqual(w.aliens.last?.kind,.flyer); XCTAssertEqual(w.aliens.last?.hp,6)
        XCTAssertEqual(w.aliens.last?.position,ceiling.position)
        w.pendingSpawn=nil
        while w.aliens.count < InvasionWorld.maximumAliens { w.spawn(at:w.entrances[0],kind:.runner) }
        w.update(0.01); XCTAssertNil(w.pendingSpawn)
    }
    func testOverloadIsTemporaryAndDoesNotChangeWorldIdentity() {
        let normal=room(), fast=room()
        let entrance=normal.entrances[0]
        normal.spawned=normal.waveTarget; fast.spawned=fast.waveTarget
        normal.spawn(at:entrance,kind:.runner); fast.spawn(at:entrance,kind:.runner,event:.overload)
        let id=fast.aliens[0].id
        for _ in 0..<60 { normal.update(1/60); fast.update(1/60) }
        XCTAssertGreaterThan(fast.aliens[0].position.z,normal.aliens[0].position.z)
        for _ in 0..<400 { fast.update(1/60) }
        XCTAssertEqual(fast.aliens[0].empowered,0); XCTAssertEqual(fast.aliens[0].id,id)
        XCTAssertEqual(fast.aliens[0].entranceID,entrance.id)
    }
}
