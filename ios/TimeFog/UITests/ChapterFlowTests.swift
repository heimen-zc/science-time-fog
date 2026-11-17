import XCTest

@MainActor final class ChapterFlowTests: XCTestCase {
  let app = XCUIApplication()
  override func setUpWithError() throws {
    continueAfterFailure = false
    app.launchArguments = ["--uitesting", "--fresh"]
    app.launch()
  }
  private func step(_ id: String, _ timeout: Double = 20) {
    XCTAssertTrue(
      app.staticTexts["stage." + id].waitForExistence(timeout: timeout), "Expected step \(id)")
  }
  private func primary() {
    let b = app.buttons["lab.primary"]
    XCTAssertTrue(b.waitForExistence(timeout: 10))
    b.tap()
  }
  private func tap(_ identifier: String) {
    let b = app.buttons[identifier]
    XCTAssertTrue(b.waitForExistence(timeout: 10))
    for _ in 0..<5 where !b.isHittable { app.swipeUp() }
    b.tap()
  }
  private func capture(_ name: String) {
    let a = XCTAttachment(screenshot: app.screenshot())
    a.name = name
    a.lifetime = .keepAlways
    add(a)
  }
  private func begin() {
    tap("home.start")
    tap("map.chapter")
    step("brief")
    primary()
    step("ringConnect")
  }
  private func stars(_ count: Int) {
    XCTAssertEqual(app.staticTexts["stars.total"].firstMatch.label, "\(count) 研究星")
  }
  func testCompleteChapterAndRelaunch() throws {
    capture("01-首页")
    begin()
    capture("02-合闸实验台")
    primary()
    step("ringZero")
    stars(10)
    primary()
    step("ringDisconnect")
    stars(20)
    primary()
    step("ringOverlay")
    primary()
    step("ringFlip")
    stars(30)
    primary()
    step("reversedConnect")
    primary()
    step("reversedZero")
    primary()
    step("reversedDisconnect")
    primary()
    step("ringCompare")
    tap("candidate.reversed.disconnect")
    XCTAssertTrue(app.staticTexts["lab.feedback"].label.contains("动作也变了"))
    capture("03-对照纠错")
    tap("candidate.reversed.connect")
    tap("proof.keyframe")
    primary()
    step("magnetIntro")
    stars(45)
    capture("04-工具解锁")
    primary()
    step("magnetApproach")
    capture("05-磁铁操作台")
    let magnet = app.otherElements["bench.magnet"]
    if magnet.waitForExistence(timeout: 5) {
      let start = magnet.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
      start.press(
        forDuration: 0.2, thenDragTo: start.withOffset(CGVector(dx: 105, dy: -55)),
        withVelocity: .slow, thenHoldForDuration: 0.1)
    } else {
      primary()
    }
    step("magnetWithdraw")
    stars(65)
    capture("06-近处零结果")
    primary()
    step("cases")
    stars(70)
    primary()
    step("proofJolt")
    tap("candidate.reversed.connect")
    tap("proof.keyframe")
    primary()
    step("cases")
    stars(80)
    capture("07-方法印章")
    primary()
    step("proofLeak")
    tap("proof.removeBattery")
    tap("proof.keyframe")
    primary()
    step("cases")
    stars(90)
    primary()
    step("proofStatic")
    tap("proof.keyframe")
    primary()
    step("completed")
    stars(100)
    capture("08-灯塔修复")
    primary()
    XCTAssertTrue(app.staticTexts["法拉第的研究手记"].waitForExistence(timeout: 10))
    capture("09-真实历史")
    app.terminate()
    app.launchArguments = ["--uitesting"]
    app.launch()
    XCTAssertTrue(app.buttons["home.start"].waitForExistence(timeout: 10))
    stars(100)
    capture("10-重启保留成果")
    app.tabBars.buttons["收藏"].tap()
    XCTAssertTrue(app.staticTexts["我的发现收藏"].waitForExistence(timeout: 10))
    capture("12-发现收藏")
    let firstReward = app.buttons["reward.R01"]
    if firstReward.exists {
      for _ in 0..<5 where !firstReward.isHittable { app.swipeUp() }
      firstReward.tap()
      XCTAssertTrue(app.staticTexts["这份奖励，来自这些观察"].waitForExistence(timeout: 10))
      capture("13-奖励证据回放")
    }
  }
  func testHelpDoesNotAwardAndResumeCheckpointPersists() throws {
    begin()
    tap("lab.help")
    tap("film.play")
    capture("11-动作GIF示范")
    tap("film.play")
    tap("film.close")
    step("ringConnect")
    stars(0)
    primary()
    step("ringZero")
    stars(10)
    app.terminate()
    app.launchArguments = ["--uitesting"]
    app.launch()
    tap("home.start")
    step("ringZero")
    stars(10)
  }
  func testSettingsAndParentCancellation() throws {
    app.tabBars.buttons["我的"].tap()
    XCTAssertTrue(app.staticTexts["我的与易用性设置"].waitForExistence(timeout: 10))
    let largeText = app.switches["更大的文字"]
    XCTAssertTrue(largeText.waitForExistence(timeout: 10))
    largeText.tap()
    capture("14-大字设置")
    let parent = app.buttons["家长区与原始资料"]
    for _ in 0..<5 where !parent.isHittable { app.swipeUp() }
    parent.tap()
    XCTAssertTrue(app.staticTexts["先请家长过来一下"].waitForExistence(timeout: 10))
    capture("15-家长辅助")
    let cancel = app.buttons["取消，留在 App"]
    for _ in 0..<5 where !cancel.isHittable { app.swipeUp() }
    cancel.tap()
    XCTAssertTrue(app.staticTexts["我的与易用性设置"].waitForExistence(timeout: 10))
    let assist = app.switches["优先使用点按辅助"]
    for _ in 0..<5 where !assist.isHittable { app.swipeDown() }
    assist.tap()
    app.switches["减弱动态效果"].tap()
    app.tabBars.buttons["历险"].tap()
    begin()
    XCTAssertFalse(app.buttons["bench.switch"].exists)
    capture("16-点按辅助")
    primary()
    step("ringZero")
    stars(10)
  }
}
