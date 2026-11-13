import XCTest
@testable import InvasionCore

final class PortalPlacementTests: XCTestCase {
    private func portal() -> PortalPlacement { PortalPlacement(center:V3(0,1,-3),right:V3(1,0,0),up:V3(0,1,0)) }
    private func near(_ a:V3,_ b:V3,file:StaticString=#filePath,line:UInt=#line) {
        XCTAssertLessThan(length(a-b),0.0001,file:file,line:line)
    }
    func testViewingFromAnotherPositionDoesNotMoveThePortal() {
        let p=portal(), center=p.center
        let first=p.intersection(origin:V3(0,1,0),direction:V3(0,0,-1))!
        let otherCamera=V3(1,1.7,0.3)
        near(p.intersection(origin:otherCamera,direction:center-otherCamera)!,first)
        XCTAssertNil(p.intersection(origin:otherCamera,direction:V3(0,0,1)))
        near(p.center,center)
    }
    func testDragRemainsOnOriginalWorldPlaneAndLockedPortalCannotMove() {
        let p=portal()
        let moved=p.moved(grab:p.center,origin:V3(0.5,1,0),direction:V3(0.5,0.3,-3))!
        near(moved.center,V3(1,1.3,-3))
        XCTAssertEqual(dot(moved.center-p.center,p.normal),0,accuracy:0.0001)
        var locked=moved; locked.locked=true
        XCTAssertNil(locked.moved(grab:locked.center,origin:.zero,direction:V3(0,0,-1)))
        XCTAssertNil(locked.scaled(by:2))
        XCTAssertNil(locked.resized(corner:SIMD2(1,1),point:V3(2,2,-3)))
    }
    func testCornerDragChangesOpeningAndKeepsOppositeCornerFixed() {
        let p=portal(), corner=SIMD2<Float>(1,1)
        let opposite=p.center-p.right*p.width/2-p.up*p.height/2
        let resized=p.resized(corner:corner,point:opposite+V3(1.6,2.3,0))!
        XCTAssertEqual(resized.width,1.6,accuracy:0.0001)
        XCTAssertEqual(resized.height,2.3,accuracy:0.0001)
        near(resized.center-resized.right*resized.width/2-resized.up*resized.height/2,opposite)
        let limited=p.resized(corner:corner,point:opposite+V3(99,-99,0))!
        XCTAssertEqual(limited.width,PortalPlacement.maximum)
        XCTAssertEqual(limited.height,PortalPlacement.minimum)
    }
    func testCeilingPlaneAndPinchKeepSpatialCenter() {
        let p=PortalPlacement(center:V3(0,2.5,-2),right:V3(1,0,0),up:V3(0,0,1))
        near(p.intersection(origin:V3(0,1,0),direction:V3(0,1.5,-2))!,p.center)
        let resized=p.scaled(by:1.5)!
        near(resized.center,p.center)
        XCTAssertEqual(resized.width,p.width*1.5,accuracy:0.0001)
        XCTAssertNil(p.intersection(origin:.zero,direction:V3(1,0,0)))
    }
    func testFloatingEntranceSpawnsFlyingAlienAtEditedLocation() {
        let p=portal(), w=InvasionWorld()
        let moved=p.moved(grab:p.center,origin:V3(0,1,0),direction:V3(0.6,0.5,-3))!
        w.spawn(at:Entrance(position:moved.center,kind:.air),kind:.runner)
        XCTAssertEqual(w.aliens[0].kind,.flyer)
        near(w.aliens[0].position,moved.center)
    }
}
