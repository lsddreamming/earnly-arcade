import XCTest
@testable import InvasionCore

final class CombatChoreographyTests: XCTestCase {
    private func room(_ kind: AlienKind, distance: Float = 0.7) -> InvasionWorld {
        let w = InvasionWorld(); w.spawned = w.waveTarget
        w.player = V3(0,kind.radius,0)
        w.spawn(at: Entrance(position: V3(0,kind.radius,-distance), kind: .door), kind: kind)
        return w
    }
    func testEachSpeciesTelegraphsBeforeDamageAndPauseFreezesWindup() {
        for kind in AlienKind.allCases {
            let w = room(kind)
            for _ in 0..<61 { w.update(1/60) }
            XCTAssertGreaterThan(w.aliens[0].attackWindup,0)
            XCTAssertEqual(w.health,100)
            let windup = w.aliens[0].attackWindup
            w.paused = true; w.update(10)
            XCTAssertEqual(w.aliens[0].attackWindup,windup)
            w.paused = false
            for _ in 0..<60 { w.update(1/60) }
            XCTAssertEqual(w.health,100-kind.damage)
        }
    }
    func testZapperInterruptsBruteButCannotRepeatedlyStunLock() {
        let w = room(.brute)
        for _ in 0..<61 { w.update(1/60) }
        w.weapon = .zapper
        w.shoot(origin:w.player,direction:w.aliens[0].position-w.player)
        XCTAssertEqual(w.aliens[0].attackWindup,0)
        XCTAssertGreaterThan(w.aliens[0].stagger,0)
        for _ in 0..<36 { w.update(1/60) }
        w.cooldown = 0
        w.shoot(origin:w.player,direction:w.aliens[0].position-w.player)
        XCTAssertEqual(w.aliens[0].stagger,0)
        XCTAssertEqual(w.health,100)
    }
    func testArmorResistsPlasmaInterruption() {
        let w = room(.armor)
        for _ in 0..<61 { w.update(1/60) }
        w.shoot(origin:w.player,direction:w.aliens[0].position-w.player)
        XCTAssertGreaterThan(w.aliens[0].attackWindup,0)
        XCTAssertEqual(w.aliens[0].stagger,0)
    }
    func testSpeciesPathsStayBoundedAndWorldIdentityPersists() {
        for kind in AlienKind.allCases {
            let w = room(kind,distance:4)
            let id = w.aliens[0].id
            var lateral: Float = 0
            for _ in 0..<180 {
                let previous = w.aliens[0].position
                w.update(1/60)
                XCTAssertLessThanOrEqual(length(w.aliens[0].position-previous),kind.speed/60+0.00001)
                lateral = max(lateral,abs(w.aliens[0].position.x))
                XCTAssertEqual(w.aliens[0].id,id)
                if kind != .flyer { XCTAssertEqual(w.aliens[0].position.y,kind.radius) }
            }
            XCTAssertGreaterThan(w.aliens[0].position.z,-4)
            if kind == .runner || kind == .flyer { XCTAssertGreaterThan(lateral,0.01) }
            else { XCTAssertEqual(lateral,0) }
        }
    }
}
