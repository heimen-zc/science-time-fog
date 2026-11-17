import Foundation

public enum RingPhysics {
  public static let switchSeconds = 0.28
  public static let transientSeconds = 2.8
  public static let holdSeconds = 1.5
  public static let peakTime = log(0.62 / 0.12) / (1 / 0.12 - 1 / 0.62)
  public static func duration(_ action: ExperimentAction) -> Double {
    action == .hold ? holdSeconds : transientSeconds + (action == .connect ? switchSeconds : 0)
  }
  public static func frame(action: ExperimentAction, polarity: Polarity, time: Double)
    -> ScienceFrame
  {
    let age = time.isFinite ? max(0, time) : 0
    if action == .connect && age < switchSeconds {
      return ScienceFrame(closed: age / switchSeconds)
    }
    let t = action == .connect ? age - switchSeconds : age
    let steady = action == .hold || t >= transientSeconds
    let closing = action != .disconnect
    let decay = steady ? 0 : exp(-max(0, t) / 0.34)
    let sign = polarity.sign * (closing ? 1 : -1)
    let normalizer = exp(-peakTime / 0.62) - exp(-peakTime / 0.12)
    let pointer = steady ? 0 : (exp(-max(0, t) / 0.62) - exp(-max(0, t) / 0.12)) / normalizer
    return ScienceFrame(
      closed: closing ? 1 : max(0, 1 - age / switchSeconds),
      flux: polarity.sign * (closing ? 1 - decay : decay), signal: sign * decay,
      needle: max(-1, min(1, sign * pointer)))
  }
}
public enum MagnetPhysics {
  public static func bounded(_ value: Double) -> Double {
    value.isFinite ? max(0, min(1, value)) : 0
  }
  public static func flux(_ position: Double) -> Double {
    let distance = 2.8 - bounded(position) * 2.4
    let near = pow(0.36 / (0.36 + 0.4 * 0.4), 1.5)
    return pow(0.36 / (0.36 + distance * distance), 1.5) / near
  }
  public static func initial(_ position: Double = 0) -> ScienceFrame {
    ScienceFrame(position: bounded(position), flux: flux(position))
  }
  public static func sample(previous: ScienceFrame, position: Double, delta: Double) -> ScienceFrame
  {
    guard delta.isFinite, delta > 0, previous.finite, position.isFinite else { return previous }
    let x = bounded(position)
    let phi = flux(x)
    let signal = (phi - previous.flux) / delta * 0.32
    let target = signal / (0.6 + abs(signal))
    let needle = previous.needle + (target - previous.needle) * (1 - exp(-delta / 0.065))
    return ScienceFrame(
      position: x, flux: phi, signal: signal,
      needle: abs(needle) < 0.0001 && abs(signal) < 0.0001 ? 0 : needle)
  }
  public static func follow(previous: ScienceFrame, target: Double, delta: Double) -> ScienceFrame {
    guard delta.isFinite, delta > 0, target.isFinite else { return previous }
    let dt = max(1 / 240, min(1 / 20, delta))
    let gap = bounded(target) - previous.position
    let step = max(-3 * dt, min(3 * dt, gap * (1 - exp(-dt / 0.065))))
    let x = abs(gap) < 0.0001 ? bounded(target) : previous.position + step
    return sample(previous: previous, position: x, delta: dt)
  }
}
public enum EvidenceValidator {
  public static func validate(_ observation: ExperimentRecord) throws {
    let r = observation
    guard r.modelVersion == 1, r.configuration == Configuration(kind: r.kind), r.samples.count >= 2,
      r.samples.count <= 1200,
      let first = r.samples.first, abs(first.time) < 0.000001, r.duration > 0, r.duration <= 60
    else {
      throw DomainError.invalidObservation("观察还不完整，请完整做完当前动作。")
    }
    var previous: Sample?
    for sample in r.samples {
      let f = sample.frame
      guard sample.time.isFinite, sample.time >= 0, f.finite, (0...1).contains(f.position),
        (-1.001...1.001).contains(f.needle)
      else { throw DomainError.invalidObservation("观察值无效，请重新做这一步。") }
      if let p = previous {
        let dt = sample.time - p.time
        guard dt > 0, dt <= 0.051 else {
          throw DomainError.invalidObservation("观察中断了，请重新完成连续的这一段。")
        }
        if r.kind == .magnet {
          let expected = MagnetPhysics.sample(previous: p.frame, position: f.position, delta: dt)
          guard close(f.flux, expected.flux), close(f.signal, expected.signal),
            close(f.needle, expected.needle), abs(f.position - p.frame.position) <= 3.001 * dt
          else { throw DomainError.invalidObservation("这份轨迹和仪器响应不一致，不能当作证据。") }
        }
      }
      if r.kind == .ring {
        guard [.connect, .hold, .disconnect].contains(r.action), f.position == 0 else {
          throw DomainError.invalidObservation("感应环的动作不匹配。")
        }
        let expected = RingPhysics.frame(action: r.action, polarity: r.polarity, time: sample.time)
        guard close(f.closed, expected.closed), close(f.flux, expected.flux),
          close(f.signal, expected.signal), close(f.needle, expected.needle)
        else { throw DomainError.invalidObservation("这条记录不是当前动作的真实模型轨迹。") }
      } else {
        guard [.approach, .hold, .withdraw].contains(r.action), r.polarity == .normal,
          close(f.flux, MagnetPhysics.flux(f.position)), f.closed == 0
        else { throw DomainError.invalidObservation("无电池装置的条件不匹配。") }
      }
      previous = sample
    }
    if r.kind == .ring {
      guard r.duration + 0.000001 >= RingPhysics.duration(r.action),
        abs(r.samples.last!.frame.needle) < 0.02
      else { throw DomainError.invalidObservation("再等一会儿，让这次偏转完整归零。") }
    } else {
      guard first.frame.signal == 0 else { throw DomainError.invalidObservation("观察必须从安全的静止状态开始。") }
      switch r.action {
      case .approach:
        guard first.frame.position < 0.025, r.samples.last!.frame.position > 0.999,
          r.signedPeak > 0, r.peak > 0.01
        else { throw DomainError.invalidObservation("从远处沿轨道靠近，直到到达线圈旁。") }
      case .hold:
        guard r.duration + 0.000001 >= 1.5,
          r.samples.allSatisfy({
            $0.frame.position > 0.975 && abs($0.frame.signal) < 0.015 && abs($0.frame.needle) < 0.02
          })
        else { throw DomainError.invalidObservation("需要磁铁仍在近处、指针稳定归零的完整观察。") }
      case .withdraw:
        guard first.frame.position > 0.975, r.samples.last!.frame.position < 0.001,
          r.signedPeak < 0, r.peak > 0.01
        else { throw DomainError.invalidObservation("沿原路把磁铁拉回远端，完成最后一段。") }
      default: throw DomainError.invalidObservation("磁铁动作不匹配。")
      }
    }
  }
  static func close(_ a: Double, _ b: Double) -> Bool { abs(a - b) <= 0.00002 * max(1, abs(b)) }
}
