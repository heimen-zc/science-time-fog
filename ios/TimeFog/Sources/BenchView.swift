import SwiftUI
import TimeFogCore

private struct RawBench: Decodable {
  struct RawPath: Decodable {
    var d: String
    var stroke: Bool
    var color: String
    var width: Double
    var opacity: Double
  }
  struct Item: Decodable {
    var name: String
    var key: Double
    var lift: Double
    var moving: Bool
    var paths: [RawPath]
  }
  struct Lever: Decodable {
    var pivot: [Double]
    var basis: [[Double]]
  }
  var items: [Item]
  var travel: [Double]
  var gauge: [Double]
  var lever: Lever?
}
private struct DrawPath {
  var path: CGPath
  var stroke: Bool
  var color: CGColor
  var width: Double
  var opacity: Double
}
private struct DrawItem {
  var name: String
  var key: Double
  var lift: Double
  var moving: Bool
  var paths: [DrawPath]
}
@MainActor private final class BenchAtlas {
  static let ring = BenchAtlas("induction")
  static let magnet = BenchAtlas("magnet")
  let items: [DrawItem]
  let raw: RawBench
  private var images: [String: UIImage] = [:]
  private var order: [String] = []
  init(_ name: String) {
    let url = Bundle.main.url(
      forResource: name + "-geometry", withExtension: "json", subdirectory: "Content")!
    raw = try! JSONDecoder().decode(RawBench.self, from: Data(contentsOf: url))
    items = raw.items.map { i in
      DrawItem(
        name: i.name, key: i.key, lift: i.lift, moving: i.moving,
        paths: i.paths.map {
          DrawPath(
            path: Self.parse($0.d), stroke: $0.stroke, color: UIColor(hex: $0.color).cgColor,
            width: $0.width, opacity: $0.opacity)
        })
    }
  }
  func image(position: Double, closed: Double) -> UIImage {
    let key = "\(position)-\(closed)"
    if let image = images[key] { return image }
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    format.opaque = false
    let renderer = UIGraphicsImageRenderer(size: CGSize(width: 960, height: 540), format: format)
    let image = renderer.image { context in
      let cg = context.cgContext
      let sorted =
        raw.travel[0] != 0
        ? items.sorted { $0.key + $0.lift * position < $1.key + $1.lift * position } : items
      for item in sorted {
        cg.saveGState()
        if item.moving { cg.translateBy(x: raw.travel[0] * position, y: raw.travel[1] * position) }
        for (index, p) in item.paths.enumerated() {
          let path =
            raw.lever != nil && ["switch.blade", "switch.grip"].contains(item.name)
            ? leverPath(item.name, index, closed) ?? p.path : p.path
          cg.setAlpha(p.opacity)
          cg.addPath(path)
          if p.stroke {
            cg.setStrokeColor(p.color)
            cg.setLineWidth(p.width)
            cg.strokePath()
          } else {
            cg.setFillColor(p.color)
            cg.fillPath()
          }
        }
        cg.restoreGState()
      }
    }
    if order.count >= 4 { images.removeValue(forKey: order.removeFirst()) }
    order.append(key)
    images[key] = image
    return image
  }
  static func parse(_ text: String) -> CGPath {
    let regex = try! NSRegularExpression(
      pattern: "[MLZ]|-?(?:[0-9]*\\.)?[0-9]+(?:[eE][-+]?[0-9]+)?")
    let tokens = regex.matches(in: text, range: NSRange(text.startIndex..., in: text)).map {
      String(text[Range($0.range, in: text)!])
    }
    let path = CGMutablePath()
    var i = 0
    while i < tokens.count {
      let command = tokens[i]
      i += 1
      if command == "Z" {
        path.closeSubpath()
        continue
      }
      guard i + 1 < tokens.count, let x = Double(tokens[i]), let y = Double(tokens[i + 1]) else {
        break
      }
      if command == "M" {
        path.move(to: CGPoint(x: x, y: y))
      } else {
        path.addLine(to: CGPoint(x: x, y: y))
      }
      i += 2
    }
    return path
  }
  func leverPath(_ name: String, _ face: Int, _ closed: Double) -> CGPath? {
    guard let lever = raw.lever, face < 3 else { return nil }
    let blade = name == "switch.blade"
    let from = blade ? 0.0 : 50
    let to = blade ? 54.0 : 69
    let width = blade ? 3.0 : 5.5
    let bottom = blade ? 0.0 : 1.6
    let top = blade ? 1.6 : 6.6
    let points: [[(Double, Double, Double)]] = [
      [(from, -width, top), (to, -width, top), (to, width, top), (from, width, top)],
      [(from, width, bottom), (to, width, bottom), (to, width, top), (from, width, top)],
      [(to, -width, bottom), (to, width, bottom), (to, width, top), (to, -width, top)],
    ]
    let angle = (1 - closed) * Double.pi * 0.29
    let result = CGMutablePath()
    for (index, p) in points[face].enumerated() {
      let x = p.0 * cos(angle) - p.2 * sin(angle)
      let z = p.0 * sin(angle) + p.2 * cos(angle)
      let point = CGPoint(
        x: lever.pivot[0] + x * lever.basis[0][0] + p.1 * lever.basis[1][0] + z * lever.basis[2][0],
        y: lever.pivot[1] + x * lever.basis[0][1] + p.1 * lever.basis[1][1] + z * lever.basis[2][1])
      if index == 0 { result.move(to: point) } else { result.addLine(to: point) }
    }
    result.closeSubpath()
    return result
  }
}
extension UIColor {
  convenience init(hex: String) {
    let value =
      UInt64(hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted), radix: 16) ?? 0
    self.init(
      red: CGFloat((value >> 16) & 255) / 255, green: CGFloat((value >> 8) & 255) / 255,
      blue: CGFloat(value & 255) / 255, alpha: 1)
  }
}
struct BenchView: View {
  var kind: Apparatus
  var frame: ScienceFrame
  var interactive = false
  var switchAction: (() -> Void)?
  var magnetTarget: ((Double) -> Void)?
  var body: some View {
    GeometryReader { g in
      let atlas = kind == .ring ? BenchAtlas.ring : BenchAtlas.magnet
      ZStack {
        Canvas { context, size in
          let art = atlas.image(position: frame.position, closed: frame.closed)
          context.draw(Image(uiImage: art), in: CGRect(origin: .zero, size: size))
          context.withCGContext { cg in
            cg.scaleBy(x: size.width / 960, y: size.height / 540)
            let m = atlas.raw.gauge
            cg.concatenate(
              CGAffineTransform(a: m[0], b: m[1], c: m[2], d: m[3], tx: m[4], ty: m[5]))
            cg.rotate(by: frame.needle * 55 * Double.pi / 180)
            let needle = CGMutablePath()
            needle.move(to: CGPoint(x: -1.7, y: 8))
            needle.addLines(between: [
              CGPoint(x: -0.9, y: -32), CGPoint(x: 0, y: -37), CGPoint(x: 0.9, y: -32),
              CGPoint(x: 1.7, y: 8),
            ])
            needle.closeSubpath()
            cg.addPath(needle)
            cg.setFillColor(UIColor(hex: "#14515A").cgColor)
            cg.fillPath()
          }
        }.accessibilityHidden(true)
        if interactive && kind == .ring {
          Button {
            switchAction?()
          } label: {
            Image(systemName: "hand.tap.fill").font(.title2).foregroundStyle(Theme.gold).frame(
              width: 64, height: 64
            ).background(Theme.gold.opacity(0.12), in: Circle()).overlay(
              Circle().stroke(Theme.gold, lineWidth: 2))
          }
          .position(x: g.size.width * 0.248, y: g.size.height * 0.411)
          .accessibilityLabel(frame.closed > 0.5 ? "抬起开关" : "合上开关").accessibilityIdentifier(
            "bench.switch")
        }
        if interactive && kind == .magnet {
          let far = CGPoint(x: g.size.width * 0.2934269173, y: g.size.height * 0.6197950633)
          let near = CGPoint(x: g.size.width * 0.4605174628, y: g.size.height * 0.4917396003)
          Color.clear.contentShape(Rectangle()).frame(width: 100, height: 80)
            .position(
              x: far.x + (near.x - far.x) * frame.position,
              y: far.y + (near.y - far.y) * frame.position
            )
            .gesture(
              DragGesture(minimumDistance: 0, coordinateSpace: .named("bench")).onChanged { v in
                let dx = near.x - far.x
                let dy = near.y - far.y
                let projection =
                  ((v.location.x - far.x) * dx + (v.location.y - far.y) * dy) / (dx * dx + dy * dy)
                magnetTarget?(Double(projection))
              }
            )
            .accessibilityLabel("可拖动的磁铁").accessibilityValue(
              frame.position > 0.975 ? "近处" : frame.position < 0.025 ? "远处" : "轨道中间"
            )
            .accessibilityAdjustableAction { direction in
              magnetTarget?(direction == .increment ? 1 : 0)
            }
            .accessibilityIdentifier("bench.magnet")
        }
      }.coordinateSpace(name: "bench")
    }.aspectRatio(16 / 9, contentMode: .fit)
  }
}
struct MeterView: View {
  var needle: Double
  var compact = false
  var body: some View {
    VStack(spacing: 4) {
      Canvas { context, size in draw(context: context, size: size) }.frame(
        width: compact ? 80 : 105, height: compact ? 70 : 95)
      Text(readout).font(.caption.weight(.semibold))
    }.accessibilityElement(children: .ignore).accessibilityLabel("检流计").accessibilityValue(readout)
  }
  private var readout: String { abs(needle) < 0.02 ? "指针归零" : needle > 0 ? "向右偏转" : "向左偏转" }
  private func draw(context: GraphicsContext, size: CGSize) {
    let center = CGPoint(x: size.width / 2, y: size.height * 0.51)
    let radius: CGFloat = min(size.width * 0.44, size.height * 0.46)
    var dial = Path()
    dial.addEllipse(
      in: CGRect(x: center.x - radius, y: center.y - radius, width: radius * 2, height: radius * 2))
    context.fill(dial, with: .color(Color(hex: "F5E8C8")))
    context.stroke(dial, with: .color(Theme.gold), lineWidth: 4)
    for i in -5...5 {
      let angle: CGFloat = CGFloat(i) * CGFloat.pi / 15 - CGFloat.pi / 2
      let x = cos(angle)
      let y = sin(angle)
      var tick = Path()
      tick.move(to: CGPoint(x: center.x + x * radius * 0.75, y: center.y + y * radius * 0.75))
      tick.addLine(to: CGPoint(x: center.x + x * radius * 0.9, y: center.y + y * radius * 0.9))
      context.stroke(tick, with: .color(Theme.ink.opacity(0.5)), lineWidth: 1)
    }
    let angle: CGFloat = CGFloat(max(-1, min(1, needle))) * CGFloat.pi * 0.32 - CGFloat.pi / 2
    let tip = CGPoint(
      x: center.x + cos(angle) * radius * 0.76, y: center.y + sin(angle) * radius * 0.76)
    var pointer = Path()
    pointer.move(to: center)
    pointer.addLine(to: tip)
    context.stroke(
      pointer, with: .color(Theme.teal), style: StrokeStyle(lineWidth: 3, lineCap: .round))
    context.draw(
      Text("0").font(.caption2).foregroundStyle(Theme.ink),
      at: CGPoint(x: center.x, y: center.y - radius * 0.45))
  }
}
struct TraceView: View {
  var records: [ExperimentRecord]
  var checkpoint: Double? = nil
  var body: some View {
    Canvas { ctx, size in
      let mid = size.height / 2
      var axis = Path()
      axis.move(to: CGPoint(x: 0, y: mid))
      axis.addLine(to: CGPoint(x: size.width, y: mid))
      ctx.stroke(
        axis, with: .color(Theme.muted.opacity(0.4)),
        style: StrokeStyle(lineWidth: 1, dash: [3, 4]))
      for (i, r) in records.enumerated() {
        var path = Path()
        for (index, s) in r.samples.enumerated() {
          let point = CGPoint(
            x: s.time / max(0.001, r.duration) * size.width,
            y: mid - s.frame.needle * size.height * 0.42)
          if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
        }
        ctx.stroke(path, with: .color(i == 0 ? Theme.teal : Theme.amber), lineWidth: 2.5)
      }
      if let checkpoint {
        var p = Path()
        p.move(to: CGPoint(x: size.width * checkpoint, y: 0))
        p.addLine(to: CGPoint(x: size.width * checkpoint, y: size.height))
        ctx.stroke(p, with: .color(Theme.orange), lineWidth: 2)
      }
    }.frame(height: 90).accessibilityLabel("实验记录曲线").accessibilityValue(
      "共 \(records.count) 条真实观察记录")
  }
}
