// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "TimeFogCore",
  platforms: [.iOS(.v17), .macOS(.v13)],
  products: [.library(name: "TimeFogCore", targets: ["TimeFogCore"])],
  targets: [
    .target(name: "TimeFogCore"),
    .testTarget(name: "TimeFogCoreTests", dependencies: ["TimeFogCore"]),
  ]
)
