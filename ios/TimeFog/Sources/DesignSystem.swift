import SwiftUI
import TimeFogCore

enum Theme {
  static let paper = Color(hex: "F8F5ED"), ink = Color(hex: "193139"), teal = Color(hex: "086C69"),
    muted = Color(hex: "607573")
  static let mint = Color(hex: "D8EAE1"), gold = Color(hex: "E5B65F"), amber = Color(hex: "785218"),
    deep = Color(hex: "102C38"), orange = Color(hex: "C35E3A")
}
extension Color { init(hex: String) { self.init(uiColor: UIColor(hex: hex)) } }
@MainActor enum Illustration {
  static var cache: [String: UIImage] = [:]
  static func image(_ name: String) -> UIImage {
    if let image = cache[name] { return image }
    guard
      let url = Bundle.main.url(forResource: name, withExtension: "png", subdirectory: "Content"),
      let image = UIImage(contentsOfFile: url.path)
    else { return UIImage() }
    cache[name] = image
    return image
  }
}
struct Art: View {
  var name: String
  var body: some View {
    Image(uiImage: Illustration.image(name)).resizable().scaledToFit().accessibilityHidden(true)
  }
}
struct PrimaryStyle: ButtonStyle {
  func makeBody(configuration: SwiftUI.ButtonStyleConfiguration) -> some View {
    configuration.label.font(.body.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 54)
      .foregroundStyle(.white).background(
        Theme.teal.opacity(configuration.isPressed ? 0.7 : 1),
        in: RoundedRectangle(cornerRadius: 17))
  }
}
struct SoftStyle: ButtonStyle {
  func makeBody(configuration: SwiftUI.ButtonStyleConfiguration) -> some View {
    configuration.label.font(.subheadline.weight(.semibold)).padding(.horizontal, 16).frame(
      minHeight: 48
    )
    .foregroundStyle(Theme.teal).background(
      Theme.mint.opacity(configuration.isPressed ? 0.5 : 0.8),
      in: RoundedRectangle(cornerRadius: 14))
  }
}
struct StarCount: View {
  var count: Int
  var body: some View {
    HStack(spacing: 6) {
      Image(systemName: "star.fill").foregroundStyle(Theme.gold)
      Text("\(count)").font(.headline.monospacedDigit()).foregroundStyle(Theme.ink)
        .accessibilityIdentifier("stars.total")
    }
    .padding(.horizontal, 13).padding(.vertical, 8).background(.white, in: Capsule())
    .accessibilityLabel("\(count) 研究星")
  }
}
struct GuideCard: View {
  var title: String
  var message: String
  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      Art(name: "BrandLamp").frame(width: 52, height: 52)
      VStack(alignment: .leading, spacing: 6) {
        Text(title).font(.subheadline.weight(.bold)).foregroundStyle(Theme.teal)
        Text(message).font(.subheadline).foregroundStyle(Theme.muted).fixedSize(
          horizontal: false, vertical: true)
      }
    }
    .padding(16).frame(maxWidth: .infinity, alignment: .leading).background(
      .white, in: RoundedRectangle(cornerRadius: 22))
  }
}
struct RewardCard: View {
  var entry: RewardEntry
  var compact = false
  var body: some View {
    HStack(alignment: .top, spacing: 13) {
      Image(systemName: "star.fill").font(.title2).foregroundStyle(Theme.amber)
      VStack(alignment: .leading, spacing: 5) {
        Text(entry.definition.title).font(.headline)
        Text(entry.definition.reason).font(.subheadline)
        Text(entry.definition.unlock).font(.caption.weight(.semibold))
      }
      Spacer(minLength: 0)
      Text("+\(entry.definition.stars)").font(.title3.bold().monospacedDigit())
    }.foregroundStyle(Theme.amber).padding(compact ? 14 : 18).background(
      Color(hex: "F4E5BD"), in: RoundedRectangle(cornerRadius: 20)
    )
    .accessibilityElement(children: .combine).accessibilityIdentifier(
      "reward.\(entry.eventID.rawValue)")
  }
}
struct SectionHeading: View {
  var eyebrow: String
  var title: String
  var subtitle: String
  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text(eyebrow).font(.caption.weight(.bold)).foregroundStyle(Theme.teal)
      Text(title).font(.system(.largeTitle, design: .rounded, weight: .bold)).foregroundStyle(
        Theme.ink)
      if !subtitle.isEmpty { Text(subtitle).font(.body).foregroundStyle(Theme.muted) }
    }.frame(maxWidth: .infinity, alignment: .leading)
  }
}
struct PaperBackground: ViewModifier {
  func body(content: Content) -> some View {
    content.background(Theme.paper.ignoresSafeArea()).foregroundStyle(Theme.ink)
  }
}
extension View { func paper() -> some View { modifier(PaperBackground()) } }
