import ImageIO
import LocalAuthentication
import QuartzCore
import SwiftUI
import TimeFogCore

private struct FilmInfo {
  var resource: String
  var title: String
  var instructions: [String]
  static func forStep(_ step: ChapterStep) -> FilmInfo {
    switch step {
    case .ringDisconnect:
      return .init(
        resource: "open-switch", title: "抬起同一个开关",
        instructions: ["电池方向和接线不变。", "抬起左前方开关。", "看右侧指针向相反方向偏转。"])
    case .ringFlip:
      return .init(
        resource: "flip-battery", title: "只反转电池",
        instructions: ["保持线圈和接线不动。", "交换电池方向。", "仍用同样的开关动作做对照。"])
    case .reversedConnect, .reversedZero:
      return .init(
        resource: "close-reversed", title: "反接后合闸",
        instructions: ["检查电池已反接。", "合上同一个开关。", "观察方向，再等待归零。"])
    case .reversedDisconnect:
      return .init(
        resource: "open-reversed", title: "反接后断开",
        instructions: ["保持反接，不换接线。", "抬起同一个开关。", "留下完整的反向响应。"])
    case .ringOverlay:
      return .init(
        resource: "overlay-traces", title: "把两份胶片叠起来",
        instructions: ["选同一套装置的通断记录。", "将断开胶片叠到接通胶片。", "沿同一时间轴比较方向。"])
    case .magnetApproach:
      return .init(
        resource: "magnet-approach", title: "磁铁沿导轨靠近",
        instructions: ["握住远处的磁铁。", "沿导轨拖到线圈旁。", "到近处松手，继续观察。"])
    case .magnetHold:
      return .init(
        resource: "magnet-hold", title: "松手，留在近处",
        instructions: ["磁铁仍在线圈旁。", "不要继续拖动。", "指针稳定归零，观察条才会推进。"])
    case .magnetWithdraw:
      return .init(
        resource: "magnet-away", title: "磁铁沿原路远离",
        instructions: ["磁极和接线不变。", "从近端沿原路拉回。", "看针偏如何反向。"])
    default:
      return .init(
        resource: "close-switch", title: "合上开关，盯住指针",
        instructions: ["只按下左前方开关。", "看右侧指针短暂偏转。", "开关不动，等待指针归零。"])
    }
  }
}
private final class GIFCanvas: UIView {
  let imageView = UIImageView()
  var source: CGImageSource?
  var count = 0, index = 0, replay = 0
  var duration = 0.0, last = 0.0
  var name = ""
  var link: CADisplayLink?
  var completed: (() -> Void)?
  override init(frame: CGRect) {
    super.init(frame: frame)
    imageView.contentMode = .scaleAspectFit
    addSubview(imageView)
  }
  required init?(coder: NSCoder) { fatalError("init(coder:) has not been implemented") }
  override func layoutSubviews() {
    super.layoutSubviews()
    imageView.frame = bounds
  }
  func configure(name: String, playing: Bool, replay: Int) {
    if self.name != name {
      stop()
      self.name = name
      index = 0
      if let url = Bundle.main.url(forResource: name, withExtension: "gif", subdirectory: "Content")
      {
        source = CGImageSourceCreateWithURL(url as CFURL, nil)
      }
      count = source.map { CGImageSourceGetCount($0) } ?? 0
      drawFrame()
    }
    if replay != self.replay {
      self.replay = replay
      index = 0
      duration = 0
      drawFrame()
    }
    if playing && link == nil && count > 0 {
      last = 0
      let link = CADisplayLink(target: self, selector: #selector(tick(_:)))
      link.add(to: .main, forMode: .common)
      self.link = link
    } else if !playing {
      stop()
    }
  }
  @objc private func tick(_ display: CADisplayLink) {
    guard last > 0 else {
      last = display.timestamp
      return
    }
    duration += display.timestamp - last
    last = display.timestamp
    guard let source, count > 0 else {
      stop()
      return
    }
    let props = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any]
    let gif = props?[kCGImagePropertyGIFDictionary] as? [CFString: Any]
    let delay = max(
      0.02,
      (gif?[kCGImagePropertyGIFUnclampedDelayTime] as? Double)
        ?? (gif?[kCGImagePropertyGIFDelayTime] as? Double) ?? 0.1)
    if duration >= delay {
      duration -= delay
      guard index + 1 < count else {
        stop()
        completed?()
        return
      }
      index += 1
      drawFrame()
    }
  }
  private func drawFrame() {
    guard let source, let image = CGImageSourceCreateImageAtIndex(source, index, nil) else {
      return
    }
    imageView.image = UIImage(cgImage: image)
  }
  func stop() {
    link?.invalidate()
    link = nil
    last = 0
  }
  deinit { link?.invalidate() }
}
private struct FilmPlayer: UIViewRepresentable {
  var resource: String
  var playing: Bool
  var replay: Int
  var completed: () -> Void
  func makeUIView(context: Context) -> GIFCanvas { GIFCanvas() }
  func updateUIView(_ view: GIFCanvas, context: Context) {
    view.completed = completed
    view.configure(name: resource, playing: playing, replay: replay)
  }
  static func dismantleUIView(_ view: GIFCanvas, coordinator: ()) { view.stop() }
}
struct HelpFilmView: View {
  @Environment(\.dismiss) private var dismiss
  @Environment(\.scenePhase) private var phase
  var step: ChapterStep
  @State private var playing = false
  @State private var replay = 0
  var body: some View {
    let film = FilmInfo.forStep(step)
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 22) {
          SectionHeading(eyebrow: "先看一遍 / 不记证据", title: film.title, subtitle: "看哪里、怎么做、何时继续，都在这里。")
          FilmPlayer(
            resource: film.resource, playing: playing, replay: replay,
            completed: { playing = false }
          ).aspectRatio(16 / 9, contentMode: .fit).background(
            Theme.deep, in: RoundedRectangle(cornerRadius: 20)
          ).clipShape(RoundedRectangle(cornerRadius: 20)).accessibilityLabel("当前动作教学示范")
          HStack {
            Button(playing ? "暂停示范" : "播放示范", systemImage: playing ? "pause.fill" : "play.fill") {
              playing.toggle()
            }.buttonStyle(SoftStyle()).accessibilityIdentifier("film.play")
            Button("重播", systemImage: "arrow.counterclockwise") {
              replay += 1
              playing = true
            }.buttonStyle(SoftStyle())
          }
          ForEach(film.instructions.indices, id: \.self) { i in
            HStack(alignment: .top, spacing: 13) {
              Text("\(i+1)").font(.headline).frame(width: 30, height: 30).background(
                Theme.mint, in: Circle())
              Text(film.instructions[i]).font(.body)
            }
          }
          Text("这是独立教学副本。你的实验已暂停，观看不产生记录或研究星。").font(.subheadline).foregroundStyle(Theme.muted)
          Button("轮到我了") {
            playing = false
            dismiss()
          }.buttonStyle(PrimaryStyle()).accessibilityIdentifier("film.close")
        }.padding(24)
      }.paper().navigationTitle("动作示范").navigationBarTitleDisplayMode(.inline).toolbar {
        ToolbarItem(placement: .topBarTrailing) {
          Button("关闭") {
            playing = false
            dismiss()
          }
        }
      }
    }.onChange(of: phase) { _, value in if value != .active { playing = false } }
  }
}

struct HistoryView: View {
  @State private var parent: ParentRequest?
  private let nodes: [(String, String, String)] = [
    ("真实研究背景", "从一个问题出发", "皇家研究院记载，法拉第在 1820 年代就试图探索怎样从磁获得电。发现之前，问题和尝试已经持续多年。"),
    ("已核验 · 1831 年 8 月 29 日", "两侧绝缘的感应环", "铜线绕在铁环两侧，并用棉线绝缘。一侧通入电流时，另一侧出现短暂电流。这个节点可在机构藏品页追查。"),
    ("方法回顾 · 你的实验重建", "别漏掉没有持续响应", "短暂偏转与保持时的零同样重要。把不同条件下的记录放在一起，才有解释可以接受检验。"),
    ("方法回顾 · 你的实验重建", "换装置，检验解释", "无电池的磁铁线圈实验帮助你检验漏电是否必需。这里的动手顺序是教学重建，不当作日记的逐字复现。"),
    ("真实藏品与后续研究", "装置也会继续发展", "皇家研究院还保存和介绍法拉第的发电机等装置。读藏品时区分观察、解释和能量输入，磁铁并不是无穷能源。"),
    ("可追查的科学", "把结果交给别人检验", "真实的报告、手稿和藏品让后来者能继续追问。手稿索引不等于本 App 已收录原件全文，具体引文需回到原始档案核验。"),
  ]
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 23) {
        SectionHeading(
          eyebrow: "回到真实历史", title: "法拉第的研究手记", subtitle: "你刚经历的是重建。现在把游戏里的发现，与真实的机构记录放在一起。")
        BenchView(
          kind: .ring, frame: RingPhysics.frame(action: .connect, polarity: .normal, time: 0.52)
        ).padding(16).background(Theme.deep, in: RoundedRectangle(cornerRadius: 24))
        Text("装置教学改绘 · 不是藏品照片或手稿扫描").font(.caption).foregroundStyle(Theme.muted)
        ForEach(nodes.indices, id: \.self) { i in
          VStack(alignment: .leading, spacing: 11) {
            Text(nodes[i].0).font(.caption.weight(.bold)).foregroundStyle(Theme.teal)
            Text(nodes[i].1).font(.title3.bold())
            Text(nodes[i].2).font(.body).foregroundStyle(Theme.muted)
          }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(
            .white, in: RoundedRectangle(cornerRadius: 22))
        }
        Button {
          parent = .source
        } label: {
          Label("请家长查看皇家研究院藏品来源", systemImage: "building.columns")
        }.buttonStyle(SoftStyle())
        Button {
          parent = .manuscript
        } label: {
          Label("请家长查看皇家学会手稿索引", systemImage: "doc.text.magnifyingglass")
        }.buttonStyle(SoftStyle())
        Text("留在 App 阅读不影响奖励。史料支持发现背景，不能代替每一项实验推理。").font(.subheadline).foregroundStyle(Theme.muted)
      }.padding(24)
    }.paper().navigationTitle("真实历史档案").navigationBarTitleDisplayMode(.inline).sheet(item: $parent)
    { ParentPanel(request: $0) }
  }
}
@MainActor final class ParentAccess {
  private var context: LAContext?
  func authorize(reason: String) async throws -> Bool {
    let context = LAContext()
    context.localizedCancelTitle = "留在 App"
    self.context = context
    var error: NSError?
    guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else {
      throw NSError(
        domain: "TimeFog.ParentAccess", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "这台设备暂时不能进行设备验证。请在系统设置中配置解锁方式；你仍可留在 App 阅读。"])
    }
    // @CfSecAICode 遵循消费金融安全编码 BE-AUTH-001 规范: 授权只取当前系统验证结果 不持久化身份声明。
    return try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
  }
  func cancel() {
    context?.invalidate()
    context = nil
  }
}
struct ParentPanel: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @Environment(\.openURL) private var openURL
  @Environment(\.scenePhase) private var phase
  var request: ParentRequest
  @State private var busy = false
  @State private var message = ""
  @State private var access = ParentAccess()
  @State private var resetConfirmed = false
  @State private var resetAuthorizedAt: TimeInterval?
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          SectionHeading(
            eyebrow: "家长辅助", title: request == .reset ? "确认清除本机进展" : "先请家长过来一下",
            subtitle: request == .reset ? "研究星、收藏和实验记录会从本机学习界面清除。" : "外部资料需要离开 App，先请家长确认。")
          Image(systemName: "lock.shield").font(.system(size: 76)).foregroundStyle(Theme.teal)
            .frame(maxWidth: .infinity).padding(.vertical, 18)
          Text("点击下方按钮会启动系统设备验证，可能使用 Face ID、Touch ID 或设备密码。应用不会取得密码或生物识别数据。").font(.body)
          Text("设备验证只确认解锁权限，不识别年龄或亲子身份。取消后仍能读历史摘要，也不影响奖励。").font(.subheadline).foregroundStyle(
            Theme.muted)
          if !message.isEmpty { Text(message).foregroundStyle(Theme.orange) }
          Button(busy ? "等待系统验证…" : "由家长进行设备验证") { authorize() }.buttonStyle(PrimaryStyle())
            .disabled(busy)
          Button("取消，留在 App") {
            access.cancel()
            dismiss()
          }.buttonStyle(SoftStyle())
        }.padding(24)
      }.paper().navigationTitle("家长区").navigationBarTitleDisplayMode(.inline)
    }
    .confirmationDialog("确认清除所有本机学习进展？", isPresented: $resetConfirmed, titleVisibility: .visible) {
      Button("确认清除", role: .destructive) {
        // @CfSecAICode 遵循消费金融安全编码 BE-AUTH-001 规范: 危险操作仅使用本次系统验证结果 不信任界面传入身份。
        guard phase == .active, let at = resetAuthorizedAt, CACurrentMediaTime() - at < 30 else {
          message = "验证已失效，请重新确认。"
          return
        }
        model.resetAfterParentVerification()
        dismiss()
      }
      Button("取消", role: .cancel) { resetAuthorizedAt = nil }
    }
    .onChange(of: phase) { _, value in
      if value == .background {
        access.cancel()
        resetAuthorizedAt = nil
        resetConfirmed = false
      }
    }
    .onDisappear {
      access.cancel()
      resetAuthorizedAt = nil
    }
  }
  private func authorize() {
    busy = true
    message = ""
    Task { @MainActor in
      do {
        let ok = try await access.authorize(
          reason: request == .reset ? "由家长确认清除本机学习进展" : "由家长确认查看外部科学史料")
        guard ok, phase == .active else {
          busy = false
          message = "操作已取消，请留在 App 或重新验证。"
          return
        }
        if request == .reset {
          resetAuthorizedAt = CACurrentMediaTime()
          resetConfirmed = true
        } else {
          // @CfSecAICode 遵循消费金融安全编码 BE-AUTH-001 规范: 系统验证后仅打开本次请求对应的固定 HTTPS 机构来源。
          let address =
            request == .source
            ? "https://www.rigb.org/explore-science/explore/collection/michael-faradays-ring-coil-apparatus"
            : "https://makingscience.royalsociety.org/items/pt_20_4/paper-experimental-researches-in-electricity-by-m-michael-faraday"
          if let url = URL(string: address) { openURL(url) }
          dismiss()
        }
        busy = false
      } catch {
        busy = false
        message = error.localizedDescription + " 记录和奖励不受影响，可以留在 App 继续阅读。"
      }
    }
  }
}
