import ExpoModulesCore
import ExpoUI
import SwiftUI
import UIKit

public class ArcaneSwiftUIExtrasModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ArcaneSwiftUIExtras")

    OnCreate {
      ViewModifierRegistry.register("symbolRenderingMode") { params, appContext, _ in
        try SymbolRenderingModeModifier(from: params, appContext: appContext)
      }
      ViewModifierRegistry.register("appAccentNavigationBar") { params, appContext, _ in
        try AppAccentNavigationBarModifier(from: params, appContext: appContext)
      }
    }

    OnDestroy {
      ViewModifierRegistry.unregister("symbolRenderingMode")
      ViewModifierRegistry.unregister("appAccentNavigationBar")
    }
  }
}

internal enum SymbolRenderingModeType: String, Enumerable {
  case monochrome
  case hierarchical
  case palette
  case multicolor

  var mode: SymbolRenderingMode {
    switch self {
    case .monochrome: return .monochrome
    case .hierarchical: return .hierarchical
    case .palette: return .palette
    case .multicolor: return .multicolor
    }
  }
}

internal struct SymbolRenderingModeModifier: ViewModifier, Record {
  @Field var mode: SymbolRenderingModeType = .monochrome

  func body(content: Content) -> some View {
    content.symbolRenderingMode(mode.mode)
  }
}

internal struct AppAccentNavigationBarModifier: ViewModifier, Record {
  @Field var color: Color = .accentColor

  func body(content: Content) -> some View {
    content
      .tint(color)
      .background(NavigationBarAccent(color: UIColor(color)).allowsHitTesting(false))
  }
}

private struct NavigationBarAccent: UIViewControllerRepresentable {
  let color: UIColor

  func makeUIViewController(context _: Context) -> AccentController {
    let controller = AccentController()
    controller.view.backgroundColor = .clear
    return controller
  }

  func updateUIViewController(_ controller: AccentController, context _: Context) {
    controller.color = color
    controller.applyAccent()
  }

  static func dismantleUIViewController(_ controller: AccentController, coordinator _: ()) {
    controller.deactivate()
  }

  final class AccentController: UIViewController {
    var color: UIColor = .tintColor
    private var isVisible = false
    private weak var bar: UINavigationBar?
    private var originalTint: UIColor?
    private var originalStandard: UINavigationBarAppearance?
    private var originalScrollEdge: UINavigationBarAppearance?
    private var originalCompact: UINavigationBarAppearance?
    private var originalCompactScrollEdge: UINavigationBarAppearance?
    private weak var item: UINavigationItem?
    private var originalItemStandard: UINavigationBarAppearance?
    private var originalItemScrollEdge: UINavigationBarAppearance?
    private var originalItemCompact: UINavigationBarAppearance?
    private var originalItemCompactScrollEdge: UINavigationBarAppearance?
    private weak var appliedItemStandard: UINavigationBarAppearance?

    override func viewWillAppear(_ animated: Bool) {
      super.viewWillAppear(animated)
      isVisible = true
      applyAccent()
    }

    override func viewDidAppear(_ animated: Bool) {
      super.viewDidAppear(animated)
      applyAccent()
    }

    override func viewWillDisappear(_ animated: Bool) {
      super.viewWillDisappear(animated)
      deactivate()
    }

    func applyAccent() {
      guard isVisible, let navigationBar = navigationController?.navigationBar else { return }
      if bar !== navigationBar {
        restoreAppearance()
        bar = navigationBar
        originalTint = navigationBar.tintColor
        originalStandard = navigationBar.standardAppearance
        originalScrollEdge = navigationBar.scrollEdgeAppearance
        originalCompact = navigationBar.compactAppearance
        originalCompactScrollEdge = navigationBar.compactScrollEdgeAppearance
      }
      guard let standard = originalStandard else { return }
      let indicator = standard.backIndicatorImage
        .withTintColor(color, renderingMode: .alwaysOriginal)
      func accented(_ original: UINavigationBarAppearance) -> UINavigationBarAppearance {
        let appearance = original.copy()
        appearance.setBackIndicatorImage(
          indicator, transitionMaskImage: standard.backIndicatorTransitionMaskImage)
        appearance.backButtonAppearance.normal.titleTextAttributes[.foregroundColor] = color
        appearance.backButtonAppearance.highlighted.titleTextAttributes[.foregroundColor] = color
        return appearance
      }
      navigationBar.tintColor = color
      navigationBar.standardAppearance = accented(standard)
      navigationBar.scrollEdgeAppearance = accented(originalScrollEdge ?? standard)
      navigationBar.compactAppearance = accented(originalCompact ?? standard)
      navigationBar.compactScrollEdgeAppearance = accented(originalCompactScrollEdge ?? standard)

      guard let navigationItem = owningNavigationItem() else { return }
      if item !== navigationItem || navigationItem.standardAppearance !== appliedItemStandard {
        if item !== navigationItem { restoreItemAppearance() }
        item = navigationItem
        originalItemStandard = navigationItem.standardAppearance
        originalItemScrollEdge = navigationItem.scrollEdgeAppearance
        originalItemCompact = navigationItem.compactAppearance
        originalItemCompactScrollEdge = navigationItem.compactScrollEdgeAppearance
      }
      guard let itemStandard = originalItemStandard else { return }
      let applied = accented(itemStandard)
      appliedItemStandard = applied
      navigationItem.standardAppearance = applied
      navigationItem.scrollEdgeAppearance = originalItemScrollEdge.map(accented)
      navigationItem.compactAppearance = originalItemCompact.map(accented)
      navigationItem.compactScrollEdgeAppearance = originalItemCompactScrollEdge.map(accented)
    }

    private func owningNavigationItem() -> UINavigationItem? {
      var controller: UIViewController? = self
      while let current = controller, let parent = current.parent {
        if parent is UINavigationController { return current.navigationItem }
        controller = parent
      }
      return nil
    }

    private func restoreItemAppearance() {
      guard let item else { return }
      item.standardAppearance = originalItemStandard
      item.scrollEdgeAppearance = originalItemScrollEdge
      item.compactAppearance = originalItemCompact
      item.compactScrollEdgeAppearance = originalItemCompactScrollEdge
      self.item = nil
      originalItemStandard = nil
      appliedItemStandard = nil
    }

    func deactivate() {
      isVisible = false
      restoreAppearance()
      restoreItemAppearance()
    }

    private func restoreAppearance() {
      guard let bar, let originalStandard else { return }
      bar.tintColor = originalTint
      bar.standardAppearance = originalStandard
      bar.scrollEdgeAppearance = originalScrollEdge
      bar.compactAppearance = originalCompact
      bar.compactScrollEdgeAppearance = originalCompactScrollEdge
      self.bar = nil
    }
  }
}
