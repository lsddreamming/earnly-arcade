import SceneKit

@available(iOS 17.0, *)
enum AlienCue: String, CaseIterable {
    case zap, laser, hit, pop, portal, reload, ready, `switch`, wave, win, lose
    case runner, armor, brute, flyer, hurt, empty

    var positional: Bool {
        switch self {
        case .hit, .pop, .portal, .runner, .armor, .brute, .flyer: return true
        default: return false
        }
    }
    static func voice(_ kind: AlienKind) -> AlienCue { [.runner, .armor, .brute, .flyer][kind.rawValue] }
}

/// Cached clips with a hard voice cap. Sound nodes live in the same anchor space
/// as enemies; listener rotation changes their direction, never their position.
@available(iOS 17.0, *)
final class AlienAudio {
    let node = SCNNode()
    var muted = UserDefaults.standard.bool(forKey: "alienARSoundMuted") {
        didSet {
            UserDefaults.standard.set(muted, forKey: "alienARSoundMuted")
            if muted { stop() }
        }
    }
    private var sources: [AlienCue: SCNAudioSource] = [:]
    private var prepared = false
    private var cooldowns: [AlienCue: Float] = [:]

    func prepare() {
        guard !prepared else { return }; prepared = true
        for cue in AlienCue.allCases {
            guard let source = SCNAudioSource(fileNamed: "\(cue.rawValue).wav") ??
                    SCNAudioSource(fileNamed: "public/alien-ar-\(cue.rawValue).wav") else { continue }
            source.isPositional = cue.positional; source.loops = false
            source.volume = cue == .zap || cue == .laser ? 0.32 : 0.24
            source.reverbBlend = cue.positional ? 0.12 : 0
            source.load(); sources[cue] = source
        }
    }
    func update(_ dt: Float) {
        for cue in Array(cooldowns.keys) { cooldowns[cue] = max(0, (cooldowns[cue] ?? 0) - dt) }
    }
    func play(_ cue: AlienCue, at position: V3) {
        guard !muted, (cooldowns[cue] ?? 0) == 0 else { return }
        prepare()
        guard let source = sources[cue] else { return }
        cooldowns[cue] = cue == .portal ? 0.35 : (cue == .empty ? 0.5 : 0.06)
        if node.childNodes.count >= 10, let oldest = node.childNodes.first {
            oldest.removeAllAudioPlayers(); oldest.removeAllActions(); oldest.removeFromParentNode()
        }
        let voice = SCNNode(); voice.simdPosition = position; node.addChildNode(voice)
        voice.addAudioPlayer(SCNAudioPlayer(source: source))
        // Every clip is shorter than one second. Cleanup is independent of enemies
        // dying and portals being removed; paused/reset sessions explicitly stop all.
        voice.runAction(.sequence([.wait(duration: 1.05), .run { n in n.removeAllAudioPlayers() }, .removeFromParentNode()]))
    }
    func stop() {
        for voice in node.childNodes {
            voice.removeAllAudioPlayers(); voice.removeAllActions(); voice.removeFromParentNode()
        }
        cooldowns.removeAll()
    }
}
