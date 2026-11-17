import QuartzCore
import SwiftUI
import TimeFogCore

struct LabView: View {
  @Environment(AppModel.self) private var model
  @Environment(\.dismiss) private var dismiss
  @State private var showPause = false
  @State private var showHistory = false
  private let clock = Timer.publish(every: 1 / 60, on: .main, in: .common).autoconnect()
  var body: some View {
    @Bindable var model = model
    ScrollViewReader { proxy in
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          Text(eyebrow).font(.caption.weight(.bold)).foregroundStyle(Theme.teal).id("step-top")
          Text(model.step.title).font(.system(.title, design: .rounded, weight: .bold))
            .accessibilityIdentifier("stage.\(model.step.rawValue)")
          if let entry = model.latestReward { RewardCard(entry: entry, compact: true) }
          stageContent
          if !model.message.isEmpty {
            Text(model.message).font(.body).foregroundStyle(Theme.teal).padding(16).frame(
              maxWidth: .infinity, alignment: .leading
            ).background(Theme.mint, in: RoundedRectangle(cornerRadius: 16))
              .accessibilityIdentifier("lab.feedback")
          }
          if model.step.isRing || model.step.isMagnet {
            GuideCard(title: "这一步，只做一件事", message: model.guide)
          }
          if model.step.isRing || model.step.isMagnet || model.step == .ringOverlay {
            HStack {
              Button("先看动作示范", systemImage: "play.rectangle") { model.showingHelp = true }
                .accessibilityIdentifier("lab.help")
              Spacer()
              Button("给我一点提示", systemImage: "lightbulb") { model.requestHint() }
            }.font(.subheadline).foregroundStyle(Theme.teal).frame(minHeight: 44)
          }
          Text("有效证据才会发奖 · 重试和提示不扣分").font(.caption).foregroundStyle(Theme.muted).frame(
            maxWidth: .infinity)
        }.padding(22)
      }.onChange(of: model.step) { _, _ in proxy.scrollTo("step-top", anchor: .top) }
    }.paper().navigationTitle("1831 · 电磁感应").navigationBarTitleDisplayMode(.inline)
      .navigationBarBackButtonHidden()
      .toolbar(.hidden, for: .tabBar)
      .toolbar {
        ToolbarItem(placement: .topBarLeading) {
          Button {
            showPause = true
            model.paused = true
          } label: {
            Image(systemName: "chevron.left").frame(width: 44, height: 44)
          }.accessibilityLabel("暂停实验")
        }
        ToolbarItem(placement: .topBarTrailing) { StarCount(count: model.snapshot.stars) }
      }
      .safeAreaInset(edge: .bottom) { bottomBar }
      .onAppear { model.labVisible = true }
      .onDisappear { model.leaveLab() }
      .onReceive(clock) { _ in model.tick(now: CACurrentMediaTime()) }
      .sheet(isPresented: $model.showingHelp) {
        HelpFilmView(step: model.step).presentationDetents([.large]).presentationDragIndicator(
          .visible)
      }
      .confirmationDialog("完整记录与奖励已经保存", isPresented: $showPause, titleVisibility: .visible) {
        Button("回首页，下次继续") {
          model.paused = false
          dismiss()
        }
        Button("继续当前实验", role: .cancel) { model.paused = false }
      } message: {
        Text("未完成的这一次观察会从安全起点重做，已获得的 \(model.snapshot.stars) 研究星不受影响。")
      }
      .onChange(of: showPause) { _, value in if !value { model.paused = false } }
      .navigationDestination(isPresented: $showHistory) { HistoryView() }
  }
  private var eyebrow: String {
    switch model.step {
    case .brief: "任务来信 / 回到问题尚未解开的过去"
    case .ringConnect, .ringZero, .ringDisconnect, .ringOverlay, .ringFlip, .reversedConnect,
      .reversedZero, .reversedDisconnect, .ringCompare:
      "第一幕 / 一闪而过的电"
    case .magnetIntro, .magnetApproach, .magnetHold, .magnetWithdraw: "第二幕 / 没有电池的线索"
    case .cases, .proofJolt, .proofLeak, .proofStatic: "第三幕 / 用证据穿过解释迷雾"
    case .completed: "章节完成 / 发现的方法"
    }
  }
  @ViewBuilder private var stageContent: some View {
    switch model.step {
    case .brief:
      Art(name: "LighthouseDark").clipShape(RoundedRectangle(cornerRadius: 24))
      GuideCard(title: "雾灯的任务来信", message: "灯塔暗了。回到法拉第的实验室，亲手找出怎样让电出现，再把发现带回今天。")
      Text("先做一件事：合上开关，观察另一侧的指针。").font(.headline)
    case .ringFlip:
      HStack {
        Image(systemName: "battery.100").font(.system(size: 60)).foregroundStyle(Theme.amber)
        Image(systemName: "arrow.left.arrow.right").font(.largeTitle).foregroundStyle(Theme.teal)
        Text("−  ＋").font(.largeTitle.bold())
      }.frame(maxWidth: .infinity).padding(.vertical, 45).background(
        Theme.mint, in: RoundedRectangle(cornerRadius: 24))
      Label("保持不变：线圈、接线、开关动作", systemImage: "lock.fill").font(.body).foregroundStyle(Theme.muted)
      Text("反接后，也要亲手完成接通、保持和断开。六次完整观察，才构成公平对照。").font(.body)
    case .ringOverlay: OverlayPanel()
    case .ringCompare, .proofJolt, .proofLeak, .proofStatic: ProofPanel()
    case .magnetIntro:
      Art(name: "Comparator").frame(maxWidth: 230).frame(maxWidth: .infinity)
      Text("回放对照镜已解锁").font(.title2.bold()).foregroundStyle(Theme.teal)
      Text("两份记录可以同步放映。接下来换一套没有电池的装置，看看磁铁能带来什么。").font(.body)
      BenchView(kind: .magnet, frame: MagnetPhysics.initial()).padding(12).background(
        Theme.deep, in: RoundedRectangle(cornerRadius: 24))
    case .cases: CasesPanel()
    case .completed: CompletionPanel()
    default:
      InstrumentPanel()
    }
  }
  private var bottomBar: some View {
    VStack(spacing: 10) {
      if model.isObserving {
        ProgressView(value: model.observationProgress).tint(Theme.teal).accessibilityLabel("有效观察进度")
        Text(model.step == .magnetHold ? "磁铁在近处，正在保存安静的这一段" : "正在完整记录，不用连点").font(.caption)
          .foregroundStyle(Theme.muted)
      }
      if model.pendingSave {
        Button("重试保存") { model.retrySave() }.buttonStyle(PrimaryStyle())
      } else {
        Button(primaryTitle) { primaryAction() }.buttonStyle(PrimaryStyle()).disabled(
          model.busy || model.loadingFailed || model.step == .magnetHold
        ).opacity(model.busy ? 0.65 : 1).accessibilityIdentifier("lab.primary")
      }
    }.padding(.horizontal, 22).padding(.top, 12).padding(.bottom, 8).background(
      Theme.paper.opacity(0.97))
  }
  private var primaryTitle: String {
    if model.busy { return "正在观察…" }
    return switch model.step {
    case .brief: "到法拉第实验室"
    case .ringConnect, .reversedConnect: "合上开关"
    case .ringZero, .reversedZero: "再观察一会儿"
    case .ringDisconnect, .reversedDisconnect: "抬起开关"
    case .ringOverlay: "叠合两条记录"
    case .ringFlip: "只反转电池"
    case .ringCompare: "定格对照，验证发现"
    case .magnetIntro: "带工具，去试试磁铁"
    case .magnetApproach: "点按移到靠近位"
    case .magnetHold: "松手，等待观察完成"
    case .magnetWithdraw: "沿原路移到远端"
    case .cases: "进入下一团解释迷雾"
    case .proofJolt, .proofLeak, .proofStatic: "定格这一瞬间"
    case .completed: "打开真实历史档案"
    }
  }
  private func primaryAction() {
    switch model.step {
    case .brief, .magnetIntro, .cases: model.advance()
    case .ringFlip: model.flip()
    case .ringOverlay: model.overlay()
    case .ringCompare: model.submitComparison()
    case .magnetApproach: model.setMagnetTarget(1)
    case .magnetWithdraw: model.setMagnetTarget(0)
    case .proofJolt, .proofLeak, .proofStatic: model.submitProof()
    case .completed: showHistory = true
    default: model.beginRing()
    }
  }
}
struct InstrumentPanel: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    @Bindable var model = model
    VStack(spacing: 9) {
      HStack {
        Label(
          model.step.isMagnet ? "没有电池 · 只移动磁铁" : "两组线圈绝缘 · 右侧没有电池",
          systemImage: model.step.isMagnet
            ? "battery.0percent" : "point.3.connected.trianglepath.dotted"
        ).font(.caption.weight(.semibold))
        Spacer()
      }.foregroundStyle(Theme.mint)
      if !model.step.isMagnet {
        Text(model.polarity == .normal ? "＋ − 正接电池" : "− ＋ 反接电池").font(.caption.weight(.bold))
          .foregroundStyle(Theme.gold).frame(maxWidth: .infinity, alignment: .leading)
      }
      BenchView(
        kind: model.step.isMagnet ? .magnet : .ring, frame: model.frame,
        interactive: (!model.busy || model.step.isMagnet) && !model.snapshot.preferences.tapAssist,
        switchAction: { model.beginRing() },
        magnetTarget: { model.setMagnetTarget($0) })
      HStack {
        VStack(alignment: .leading, spacing: 7) {
          Text(
            model.step.isMagnet ? positionLabel : model.frame.closed > 0.98 ? "电池回路接通" : "电池回路断开"
          ).font(.headline).foregroundStyle(Theme.mint)
          Text(model.frame.needle.magnitude < 0.02 ? "观察零结果，也是在前进" : "留意短暂的偏转").font(.subheadline)
            .foregroundStyle(Theme.mint)
        }
        Spacer()
        MeterView(needle: model.frame.needle).foregroundStyle(Theme.mint)
      }
    }.padding(17).background(Theme.deep, in: RoundedRectangle(cornerRadius: 25))
    if model.step.isMagnet {
      VStack(spacing: 6) {
        Slider(
          value: Binding(get: { model.frame.position }, set: { model.setMagnetTarget($0) }),
          in: 0...1
        ).tint(Theme.teal).accessibilityLabel("磁铁位置").accessibilityIdentifier("magnet.position")
        HStack {
          Text("远处")
          Spacer()
          Text("线圈旁")
        }.font(.caption).foregroundStyle(Theme.muted)
      }
    }
  }
  private var positionLabel: String {
    model.frame.position > 0.975 ? "磁铁仍在近处" : model.frame.position < 0.025 ? "磁铁在远处" : "磁铁在轨道中"
  }
}
struct OverlayPanel: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    let pair = EvidenceJudge.normalOverlay(model.records) ?? []
    VStack(spacing: 20) {
      ForEach(pair) { r in
        VStack(alignment: .leading, spacing: 10) {
          Text(r.title).font(.headline)
          TraceView(records: [r])
        }.padding(18).background(.white, in: RoundedRectangle(cornerRadius: 22))
      }
      Image(systemName: "arrow.up.to.line.compact").font(.title).foregroundStyle(Theme.teal)
      GuideCard(title: "把断开胶片，拖到接通胶片上", message: "也可以点下面的叠合按钮。只有同一套装置的两条个人记录，才会得到奖励。")
    }.gesture(
      DragGesture(minimumDistance: 25).onEnded { v in
        if v.translation.height < -30 { model.overlay() }
      })
  }
}
struct ProofPanel: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    @Bindable var model = model
    let kind = model.proofKind
    VStack(alignment: .leading, spacing: 16) {
      if model.step == .ringCompare || kind == .jolt {
        HStack(spacing: 12) {
          slot(model.selectedA, "A", model: model)
          slot(model.selectedB, "B", model: model)
        }
        Text("保留 A，给 B 装入同样动作、相反极性的胶片。").font(.subheadline).foregroundStyle(Theme.muted)
        ForEach(model.ringCandidates.filter { $0.id != model.selectedA }) { record in
          Button {
            model.select(record)
          } label: {
            HStack {
              Image(systemName: model.selectedB == record.id ? "checkmark.circle.fill" : "film")
              Text(record.title)
              Spacer()
              Text("装入 B")
            }.padding(13).frame(minHeight: 48).background(
              model.selectedB == record.id ? Theme.mint : .white,
              in: RoundedRectangle(cornerRadius: 14))
          }.buttonStyle(.plain).foregroundStyle(Theme.teal).accessibilityIdentifier(
            "candidate.\(record.polarity.rawValue).\(record.action.rawValue)")
        }
      } else if kind == .leak {
        Button {
          model.batteryRemoved.toggle()
        } label: {
          HStack(spacing: 16) {
            Image(systemName: model.batteryRemoved ? "battery.0percent" : "battery.100percent")
              .font(.largeTitle)
            VStack(alignment: .leading, spacing: 5) {
              Text(model.batteryRemoved ? "解释中的电池已移开" : "先移开解释中的电池").font(.headline)
              Text("真实胶片本来就没有电池").font(.caption)
            }
          }.frame(maxWidth: .infinity, alignment: .leading).padding(18).background(
            Theme.mint, in: RoundedRectangle(cornerRadius: 18))
        }.buttonStyle(.plain).accessibilityIdentifier("proof.removeBattery")
        if let record = model.records.last(where: { $0.action == .approach }) {
          singleReplay(record)
        }
      } else {
        HStack {
          ForEach(["靠近", "近处停住", "远离"].indices, id: \.self) { i in
            Text(["靠近", "近处停住", "远离"][i]).font(.caption.weight(.semibold)).frame(
              maxWidth: .infinity, minHeight: 40
            ).background(
              min(2, Int(model.checkpoint * 3)) == i ? Theme.mint : .white,
              in: RoundedRectangle(cornerRadius: 12))
          }
        }
        if let cycle = EvidenceJudge.cycle(model.records) {
          let index = min(2, Int(model.checkpoint * 3))
          let local = model.checkpoint * 3 - Double(index)
          replayFrame(cycle[index], local)
        }
      }
      VStack(alignment: .leading, spacing: 10) {
        Text("同步放映光标").font(.subheadline.bold()).foregroundStyle(Theme.teal)
        Slider(value: $model.checkpoint, in: 0...1).tint(Theme.teal).accessibilityLabel("放映光标")
          .accessibilityIdentifier("proof.timeline")
        Button("免费辅助：定位关键帧", systemImage: "scope") { model.showKeyFrame() }.buttonStyle(SoftStyle())
          .accessibilityIdentifier("proof.keyframe")
      }.padding(16).background(.white, in: RoundedRectangle(cornerRadius: 20))
      Text(model.verdict.message).font(.body).foregroundStyle(
        model.verdict.ok ? Theme.teal : Theme.muted
      ).accessibilityIdentifier("proof.verdict")
    }
  }
  private func slot(_ id: UUID?, _ label: String, model: AppModel) -> some View {
    VStack(spacing: 8) {
      if let id, let r = model.records.first(where: { $0.id == id }) {
        Text(label + " · " + r.title).font(.caption.weight(.semibold)).fixedSize(
          horizontal: false, vertical: true)
        BenchView(kind: .ring, frame: EvidenceJudge.frame(r, at: model.checkpoint))
        MeterView(needle: EvidenceJudge.frame(r, at: model.checkpoint).needle, compact: true)
      } else {
        Text(label + " 胶片槽").font(.headline)
        Image(systemName: "film.stack").font(.largeTitle).frame(height: 90)
        Text("从下面装入胶片").font(.caption)
      }
    }.foregroundStyle(Theme.mint).frame(maxWidth: .infinity, minHeight: 205).padding(10).background(
      Theme.deep, in: RoundedRectangle(cornerRadius: 21))
  }
  private func singleReplay(_ record: ExperimentRecord) -> some View {
    replayFrame(record, model.checkpoint)
  }
  private func replayFrame(_ record: ExperimentRecord, _ progress: Double) -> some View {
    VStack(spacing: 10) {
      Text(record.title).font(.caption.bold()).frame(maxWidth: .infinity, alignment: .leading)
      BenchView(kind: record.kind, frame: EvidenceJudge.frame(record, at: progress))
      MeterView(needle: EvidenceJudge.frame(record, at: progress).needle)
    }.foregroundStyle(Theme.mint).padding(16).background(
      Theme.deep, in: RoundedRectangle(cornerRadius: 24))
  }
}
struct CasesPanel: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    VStack(spacing: 16) {
      Text("每穿过一团雾，都要留下一份经得起检验的证据。奖励是方法，不只是答案。").font(.body).foregroundStyle(Theme.muted)
      ForEach(CaseID.allCases, id: \.self) { kind in
        let done = model.snapshot.proofs.contains { $0.kind == kind }
        HStack(spacing: 17) {
          Image(systemName: done ? "checkmark.seal.fill" : "cloud.fog.fill").font(.system(size: 37))
            .foregroundStyle(done ? Theme.teal : Theme.gold)
          VStack(alignment: .leading, spacing: 7) {
            Text(kind.title).font(.headline)
            Text(done ? "已排除 · \(kind.seal)" : "完成检验 · +10 星与方法印章").font(.caption)
          }
          Spacer()
        }.padding(22).frame(maxWidth: .infinity, alignment: .leading).foregroundStyle(
          done ? Theme.ink : .white
        ).background(done ? Theme.mint : Theme.deep, in: RoundedRectangle(cornerRadius: 24))
      }
      GuideCard(title: "一次，只检验一个解释", message: "发现不公平对照会告诉你哪里变了。换好胶片再试，已有研究星不会消失。")
    }
  }
}
struct CompletionPanel: View {
  @Environment(AppModel.self) private var model
  var body: some View {
    VStack(spacing: 20) {
      Art(name: "LighthouseLit").clipShape(RoundedRectangle(cornerRadius: 25))
      Text("100").font(.system(size: 61, weight: .bold, design: .rounded)).foregroundStyle(
        Theme.teal)
      Text("研究星 · 观察学徒 → 发现者").font(.subheadline).foregroundStyle(Theme.muted)
      HStack {
        Art(name: "SealControl")
        Art(name: "SealAlternative")
        Art(name: "SealZero")
      }.frame(height: 100)
      Text("你做出了公平对照，排除了替代解释，也留下了关键的零结果。").font(.body)
      GuideCard(title: "回到真实的历史", message: "刚才是你的重建历程。接下来，去看看法拉第留下的真实装置与机构记录。")
      Button("重玩本章，挑战自己的解释") { model.replay() }.buttonStyle(SoftStyle())
      Text("重玩保留收藏，不重复加星。").font(.caption).foregroundStyle(Theme.muted)
    }
  }
}
