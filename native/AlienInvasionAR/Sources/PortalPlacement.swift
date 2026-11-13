import Foundation

/// Metres in the game's AR-anchor space. Camera pose is only used to cast a
/// touch ray; it never becomes the portal's parent or a per-frame position.
struct PortalPlacement {
    var center: V3
    var right: V3
    var up: V3
    var width: Float = 0.9
    var height: Float = 1.4
    var locked = false
    static let minimum: Float = 0.4
    static let maximum: Float = 3
    var normal: V3 {
        normalized(V3(right.y*up.z-right.z*up.y, right.z*up.x-right.x*up.z, right.x*up.y-right.y*up.x))
    }
    func intersection(origin: V3, direction: V3) -> V3? {
        let ray=normalized(direction), denominator=dot(ray,normal)
        guard abs(denominator)>0.03 else{return nil}
        let distance=dot(center-origin,normal)/denominator
        guard distance>0, distance<=12 else{return nil}
        return origin+ray*distance
    }
    func contains(_ point: V3, margin: Float = 0.1) -> Bool {
        let offset=point-center
        return abs(dot(offset,right))<=width/2+margin && abs(dot(offset,up))<=height/2+margin
    }
    func moved(grab: V3, origin: V3, direction: V3) -> PortalPlacement? {
        guard !locked, let point=intersection(origin:origin,direction:direction) else{return nil}
        var result=self; result.center += point-grab; return result
    }
    /// Keep the opposite corner fixed while changing width and height separately.
    func resized(corner: SIMD2<Float>, point: V3) -> PortalPlacement? {
        guard !locked else{return nil}
        let opposite=center-right*corner.x*width/2-up*corner.y*height/2
        let offset=point-opposite
        var result=self
        result.width=Self.bound(dot(offset,right)*corner.x)
        result.height=Self.bound(dot(offset,up)*corner.y)
        result.center=opposite+right*corner.x*result.width/2+up*corner.y*result.height/2
        return result
    }
    func scaled(by factor: Float) -> PortalPlacement? {
        guard !locked, factor.isFinite, factor>0 else{return nil}
        var result=self
        result.width=Self.bound(width*factor); result.height=Self.bound(height*factor)
        return result
    }
    private static func bound(_ value: Float) -> Float { min(maximum,max(minimum,value)) }
}
