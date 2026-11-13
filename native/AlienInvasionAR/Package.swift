// swift-tools-version: 5.9
import PackageDescription
let package = Package(name: "InvasionCore", products: [.library(name:"InvasionCore",targets:["InvasionCore"])], targets: [
    .target(name:"InvasionCore",path:"Sources",exclude:["App.swift","GameViewController.swift"]),
    .testTarget(name:"InvasionCoreTests",dependencies:["InvasionCore"],path:"Tests")
])
