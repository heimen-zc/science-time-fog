import SwiftUI
import TimeFogCore

enum Route: Hashable {
  case map, lab, history
  case reward(RewardID)
}
enum ParentRequest: String, Identifiable {
  case source, manuscript, reset
  var id: String { rawValue }
}

struct RootView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.scenePhase) private var scenePhase
  @Environment(\.dynamicTypeSize) private var systemType
  @State private var tab = 0
  var body: some View {
    @Bindable var model = model
    TabView(selection: $tab) {
      NavigationStack { HomeView() }.tabItem { Label("历险", systemImage: "map") }.tag(0)
      NavigationStack { CollectionView() }.tabItem { Label("收藏", systemImage: "books.vertical") }
        .tag(1)
      NavigationStack { SettingsView() }.tabItem { Label("我的", systemImage: "person.crop.circle") }
        .tag(2)
    }.tint(Theme.teal)
      .environment(
        \.dynamicTypeSize,
        model.snapshot.preferences.largeText ? max(systemType, .xxLarge) : systemType
      )
      .onChange(of: scenePhase) { _, phase in model.setSceneActive(phase == .active) }
      .alert(
        "先把这次保存好",
        isPresented: Binding(
          get: { model.errorMessage != nil }, set: { if !$0 { model.errorMessage = nil } })
      ) {
        Button(model.loadingFailed ? "重新读取" : "重试保存") {
          model.loadingFailed ? model.load() : model.retrySave()
        }
        Button("稍后再试", role: .cancel) {}
      } message: {
        Text(model.errorMessage ?? "")
      }
  }
}
struct HomeView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 23) {
        SectionHeading(
          eyebrow: "和雾灯一起找回发现的方法", title: model.snapshot.completed ? "灯塔亮了，是你找到的路" : "今天，亲手点亮一座灯塔",
          subtitle: "去做一件科学家做过的事，把自己的发现带回来。")
        Art(name: model.snapshot.completed ? "LighthouseLit" : "LighthouseDark").clipShape(
          RoundedRectangle(cornerRadius: 25))
        HStack {
          Text("1831 · 电磁感应").font(.caption.weight(.bold))
          Spacer()
          Text(model.snapshot.rank).font(.caption)
        }.foregroundStyle(Theme.teal)
        VStack(alignment: .leading, spacing: 15) {
          Text(model.snapshot.completed ? "这次发现，留下来了" : "这次能收获什么").font(.headline)
          HStack(spacing: 15) {
            Image(systemName: "star.fill").font(.title).foregroundStyle(Theme.gold)
            VStack(alignment: .leading, spacing: 5) {
              Text(model.snapshot.completed ? "100 研究星 · 已全部保存" : "100 研究星").font(.title3.bold())
              Text("3 枚方法印章 · 1 件回放工具").font(.subheadline).foregroundStyle(Theme.muted)
            }
            Spacer()
            Art(name: "Comparator").frame(width: 53, height: 53)
          }
          if model.snapshot.stars > 0 {
            ProgressView(value: Double(model.snapshot.stars), total: 100).tint(Theme.teal)
          }
        }.padding(18).background(.white, in: RoundedRectangle(cornerRadius: 22))
        if model.loadingFailed || model.pendingSave {
          GuideCard(
            title: "已有进展会保留",
            message: model.loadingFailed ? "存档暂时无法读取，先重试；需要时可请家长到设置中帮助处理。" : "上一次保存没有完成，重试成功后再继续。")
        }
        Text("提示、暂停和辅助操作，都不扣研究星。").font(.caption).foregroundStyle(Theme.muted).frame(
          maxWidth: .infinity)
      }.padding(24)
    }.paper().safeAreaInset(edge: .bottom) {
      Group {
        if model.loadingFailed || model.pendingSave {
          Button(model.loadingFailed ? "重新读取" : "重试保存") {
            model.loadingFailed ? model.load() : model.retrySave()
          }.buttonStyle(PrimaryStyle())
        } else {
          NavigationLink(
            value: model.snapshot.stars == 0 && model.step == .brief ? Route.map : Route.lab
          ) {
            Text(
              model.snapshot.completed
                ? "查看本章发现" : model.snapshot.stars > 0 || model.step != .brief ? "继续上次调查" : "进入历险")
          }.buttonStyle(PrimaryStyle()).accessibilityIdentifier("home.start")
        }
      }.padding(.horizontal, 24).padding(.top, 10).padding(.bottom, 12).background(Theme.paper)
    }.navigationTitle("时间迷雾").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .topBarTrailing) { StarCount(count: model.snapshot.stars) }
      }
      .navigationDestination(for: Route.self) { route in destination(route) }
  }
  @ViewBuilder private func destination(_ route: Route) -> some View {
    switch route {
    case .map: ChapterMapView()
    case .lab: LabView()
    case .history: HistoryView()
    case .reward(let id): RewardDetailView(eventID: id)
    }
  }
}
struct ChapterMapView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 28) {
        SectionHeading(eyebrow: "科学时间地图", title: "雾里藏着怎样的发现？", subtitle: "先从一座灯塔开始，沿着证据找回科学的道路。")
        NavigationLink(value: Route.lab) {
          HStack(spacing: 17) {
            Image(systemName: "lightbulb.max.fill").font(.largeTitle).foregroundStyle(Theme.amber)
              .frame(width: 70, height: 70).background(Theme.gold, in: Circle())
            VStack(alignment: .leading, spacing: 9) {
              Text("1831 电磁感应").font(.title3.bold())
              Text("修复灯塔 · 本章 100 星").font(.subheadline)
              Text("查看灯塔任务 →").font(.subheadline.bold())
            }
            Spacer()
          }.padding(20).background(.white, in: RoundedRectangle(cornerRadius: 24))
        }.tint(Theme.teal).accessibilityIdentifier("map.chapter")
        ForEach(["燃烧的秘密", "原子里有什么"], id: \.self) { title in
          HStack(spacing: 20) {
            Image(systemName: "lock.fill").font(.title2)
            VStack(alignment: .leading, spacing: 7) {
              Text(title).font(.headline)
              Text("后续章节规划").font(.subheadline)
            }
          }.foregroundStyle(Theme.muted).padding(22).frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.mint.opacity(0.4), in: RoundedRectangle(cornerRadius: 24))
        }
      }.padding(24)
    }.paper().navigationTitle("时间地图").navigationBarTitleDisplayMode(.inline)
  }
}
struct CollectionView: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        SectionHeading(
          eyebrow: "每份奖励，都能追到一份证据", title: "我的发现收藏",
          subtitle: "\(model.snapshot.stars) 星来自 \(model.snapshot.rewards.count) 次有效发现。")
        HStack(spacing: 14) {
          ForEach(CaseID.allCases, id: \.self) { kind in
            let earned = model.snapshot.rewards.contains {
              $0.eventID == (kind == .jolt ? .R08 : kind == .leak ? .R09 : .R10)
            }
            VStack {
              Art(
                name: kind == .jolt ? "SealControl" : kind == .leak ? "SealAlternative" : "SealZero"
              ).frame(maxWidth: 100).opacity(earned ? 1 : 0.25)
              Text(earned ? kind.seal : "待发现").font(.caption).foregroundStyle(
                earned ? Theme.teal : Theme.muted)
            }
          }
        }
        if model.snapshot.earned(.R04) {
          HStack {
            Art(name: "Comparator").frame(width: 78, height: 78)
            VStack(alignment: .leading, spacing: 7) {
              Text("回放对照镜").font(.headline)
              Text("打开藏品，回看赢得它的关键证据。").font(.subheadline).foregroundStyle(Theme.muted)
            }
          }.padding(18).background(Theme.mint, in: RoundedRectangle(cornerRadius: 22))
        }
        if model.snapshot.rewards.isEmpty {
          GuideCard(title: "第一张线索，等着你", message: "回历险页合上开关，完整观察那一下偏转。")
        }
        ForEach(model.snapshot.rewards) { entry in
          NavigationLink {
            RewardDetailView(eventID: entry.eventID)
          } label: {
            RewardCard(entry: entry, compact: true)
          }.buttonStyle(.plain)
        }
      }.padding(24)
    }.paper().navigationTitle("发现收藏").navigationBarTitleDisplayMode(.inline).toolbar {
      ToolbarItem(placement: .topBarTrailing) { StarCount(count: model.snapshot.stars) }
    }
  }
}
struct RewardDetailView: View {
  @Environment(AppModel.self) private var model
  var eventID: RewardID
  @State private var cursor = 0.0
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 22) {
        if let entry = model.snapshot.rewards.first(where: { $0.eventID == eventID }) {
          RewardCard(entry: entry)
          Text("这份奖励，来自这些观察").font(.headline)
          let records = entry.evidenceIDs.compactMap { id in
            model.snapshot.observations.first { $0.id == id }
          }
          ForEach(records) { record in
            VStack(alignment: .leading, spacing: 12) {
              Text(record.title).font(.headline)
              BenchView(kind: record.kind, frame: EvidenceJudge.frame(record, at: cursor))
              TraceView(records: [record], checkpoint: cursor)
              Text("真实保存 · \(record.samples.count) 个样本 · \(record.duration, specifier:"%.1f") 秒")
                .font(.caption).foregroundStyle(Theme.muted)
            }.padding(16).background(.white, in: RoundedRectangle(cornerRadius: 22))
          }
          Slider(value: $cursor).accessibilityLabel("证据回放光标")
          Button("定位保存的关键帧") {
            cursor =
              entry.proof?.checkpoint ?? records.first.map { EvidenceJudge.bestCheckpoint($0) } ?? 0
          }.buttonStyle(SoftStyle())
          Text("回看或重做不会重复加星，原始证据会一直保留。").font(.subheadline).foregroundStyle(Theme.muted)
        }
      }.padding(24)
    }.paper().navigationTitle("奖励的来路").navigationBarTitleDisplayMode(.inline)
  }
}
struct SettingsView: View {
  @Environment(AppModel.self) private var model
  @State private var parent: ParentRequest?
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        SectionHeading(eyebrow: "对探索者友好的工具", title: "我的与易用性设置", subtitle: "辅助操作不扣星，也不会降低称号。")
        VStack(spacing: 18) {
          setting("减弱动态效果", \.reduceMotion)
          setting("声音反馈", \.sound)
          setting("触觉反馈", \.haptics)
          setting("更大的文字", \.largeText)
          setting("优先使用点按辅助", \.tapAssist)
        }.padding(20).background(.white, in: RoundedRectangle(cornerRadius: 22))
        GuideCard(
          title: "本机保存，随时继续", message: "记录、线索和研究星保存在这台设备上。首版无需账户，不上传儿童操作记录。删除 App 可能一并删除本机进展。")
        Button {
          parent = .source
        } label: {
          Label("家长区与原始资料", systemImage: "lock.shield")
        }.buttonStyle(SoftStyle())
        Button("清除本机进展", role: .destructive) { parent = .reset }.frame(minHeight: 44)
        Text("时间迷雾 1.0 · 电磁感应首章\n装置为教学重绘，读数为放慢的无量纲模型。").font(.caption).foregroundStyle(Theme.muted)
      }.padding(24)
    }.paper().navigationTitle("我的").navigationBarTitleDisplayMode(.inline).sheet(item: $parent) {
      ParentPanel(request: $0)
    }
  }
  private func setting(_ title: String, _ key: WritableKeyPath<Preferences, Bool>) -> some View {
    Toggle(
      title,
      isOn: Binding(
        get: { model.snapshot.preferences[keyPath: key] },
        set: { value in
          var prefs = model.snapshot.preferences
          prefs[keyPath: key] = value
          model.setPreferences(prefs)
        })
    ).tint(Theme.teal)
  }
}
