import SwiftUI

@main struct TimeFogApp: App {
  @State private var model = AppModel()
  var body: some Scene {
    WindowGroup {
      RootView().environment(model).environment(\.locale, Locale(identifier: "zh_Hans_CN"))
        .preferredColorScheme(.light)
    }
  }
}
