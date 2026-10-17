import ExpoModulesCore
import UIKit

public class ArcaneAppIconModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArcaneAppIcon")

    Constant("alternateIconNames") { () -> [String] in
      guard
        let icons = Bundle.main.object(forInfoDictionaryKey: "CFBundleIcons") as? [String: Any],
        let alternates = icons["CFBundleAlternateIcons"] as? [String: Any]
      else { return [] }
      return alternates.keys.sorted()
    }

    AsyncFunction("getSupportsAlternateIcons") { () -> Bool in
      UIApplication.shared.supportsAlternateIcons
    }
    .runOnQueue(.main)

    AsyncFunction("getAlternateIconName") { () -> String? in
      UIApplication.shared.alternateIconName
    }
    .runOnQueue(.main)

    AsyncFunction("setAlternateIconName") { (name: String?, promise: Promise) in
      UIApplication.shared.setAlternateIconName(name) { error in
        if let error {
          promise.reject("ERR_SET_ALTERNATE_ICON", error.localizedDescription)
        } else {
          promise.resolve(nil)
        }
      }
    }
    .runOnQueue(.main)
  }
}
