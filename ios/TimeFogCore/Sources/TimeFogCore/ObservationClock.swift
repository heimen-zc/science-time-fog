import Foundation

/// Only foreground observation time enters the simulation. A pause has no catch-up debt.
public struct ObservationClock {
  private var previous: Double?
  public init() {}
  public mutating func reset() { previous = nil }
  public mutating func step(now: Double, running: Bool) -> Double? {
    guard running, now.isFinite else {
      previous = nil
      return nil
    }
    guard let previous else {
      self.previous = now
      return nil
    }
    let elapsed = now - previous
    guard elapsed > 0, elapsed < 0.2 else {
      self.previous = now
      return nil
    }
    // Accumulate tiny callbacks instead of inventing a minimum amount of observed time.
    guard elapsed >= 1 / 240 else { return nil }
    self.previous = now
    return min(1 / 20, elapsed)
  }
}
