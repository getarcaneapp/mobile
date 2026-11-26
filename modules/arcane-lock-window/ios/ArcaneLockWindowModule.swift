import ExpoModulesCore
import SwiftUI
import UIKit

struct LockWindowOptions: Record {
    @Field var enabled: Bool = false
    @Field var locked: Bool = false
    @Field var busy: Bool = false
    @Field var buttonTitle: String = "Unlock"
    @Field var symbol: String = "lock.open.fill"
    @Field var tintHex: String?
}

@MainActor
final class LockWindowState: ObservableObject {
    @Published var showsButton = false
    @Published var busy = false
    @Published var buttonTitle = "Unlock"
    @Published var symbol = "lock.open.fill"
    @Published var tint: Color?
    var onUnlock: () -> Void = {}
}

struct LockWindowView: View {
    @ObservedObject var state: LockWindowState

    var body: some View {
        VStack(spacing: 16) {
            Image(systemName: "lock.fill")
                .font(.system(size: 44))
                .foregroundStyle(.secondary)
            Text("Arcane Is Locked")
                .font(.title2.weight(.semibold))
            if state.showsButton {
                if state.busy {
                    ProgressView().padding(.top, 8)
                } else {
                    Button {
                        state.onUnlock()
                    } label: {
                        Label(state.buttonTitle, systemImage: state.symbol)
                    }
                    .buttonStyle(.glassProminent)
                    .controlSize(.large)
                    .padding(.top, 8)
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(uiColor: .systemBackground))
        .tint(state.tint)
    }
}

public class ArcaneLockWindowModule: Module {
    private var window: UIWindow?
    private var state: LockWindowState?
    private var enabled = false
    private var locked = false
    private var isActive = true
    private var observers: [NSObjectProtocol] = []

    public func definition() -> ModuleDefinition {
        Name("ArcaneLockWindow")

        Events("onUnlockPress")

        OnCreate {
            DispatchQueue.main.async { self.observeScenes() }
        }

        OnDestroy {
            DispatchQueue.main.async {
                for observer in self.observers { NotificationCenter.default.removeObserver(observer) }
                self.observers = []
                self.hide()
            }
        }

        AsyncFunction("update") { (options: LockWindowOptions) in
            MainActor.assumeIsolated {
                let state = self.lockState()
                self.enabled = options.enabled
                self.locked = options.enabled && options.locked
                state.busy = options.busy
                state.buttonTitle = options.buttonTitle
                state.symbol = options.symbol
                state.tint = options.tintHex.flatMap(Self.color(hex:))
                self.render()
            }
        }.runOnQueue(.main)
    }

    @MainActor
    private func lockState() -> LockWindowState {
        if let state { return state }
        let state = LockWindowState()
        state.onUnlock = { [weak self] in self?.sendEvent("onUnlockPress") }
        self.state = state
        return state
    }

    @MainActor
    private func observeScenes() {
        let center = NotificationCenter.default
        observers.append(
            center.addObserver(forName: UIScene.willDeactivateNotification, object: nil, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated {
                    self?.isActive = false
                    self?.render()
                }
            })
        observers.append(
            center.addObserver(forName: UIScene.didActivateNotification, object: nil, queue: .main) {
                [weak self] _ in
                MainActor.assumeIsolated {
                    self?.isActive = true
                    self?.render()
                }
            })
    }

    @MainActor
    private func render() {
        let covers = enabled && (locked || !isActive)
        guard covers else {
            hide()
            return
        }
        let state = lockState()
        state.showsButton = locked
        show(state)
    }

    @MainActor
    private func show(_ state: LockWindowState) {
        if let window, !window.isHidden { return }
        guard
            let scene = UIApplication.shared.connectedScenes
                .compactMap({ $0 as? UIWindowScene })
                .first(where: { $0.activationState != .unattached })
        else { return }
        let window = UIWindow(windowScene: scene)
        window.windowLevel = .alert + 1
        let controller = UIHostingController(rootView: LockWindowView(state: state))
        controller.view.backgroundColor = .systemBackground
        window.rootViewController = controller
        window.isHidden = false
        self.window = window
    }

    @MainActor
    private func hide() {
        window?.isHidden = true
        window = nil
    }

    private static func color(hex: String) -> Color? {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }
        return Color(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255)
    }
}
