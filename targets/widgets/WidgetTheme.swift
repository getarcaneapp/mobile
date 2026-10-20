import SwiftUI
import WidgetKit

enum WidgetTheme {
    static func accent(from snapshot: WidgetSnapshot?) -> Color {
        snapshot?.accentHex.flatMap(color(hex:)) ?? .purple
    }

    static func color(hex: String) -> Color? {
        var value = hex.trimmingCharacters(in: .whitespacesAndNewlines)
        if value.hasPrefix("#") { value.removeFirst() }
        guard value.count == 6, let rgb = UInt64(value, radix: 16) else { return nil }
        return Color(
            red: Double((rgb >> 16) & 0xFF) / 255,
            green: Double((rgb >> 8) & 0xFF) / 255,
            blue: Double(rgb & 0xFF) / 255
        )
    }
}

enum WidgetLink {
    static func open(tab: String, environmentID: String?, environmentName: String? = nil) -> URL {
        var components = URLComponents()
        components.scheme = "arcane-mobile"
        components.host = "open"
        components.queryItems = [URLQueryItem(name: "tab", value: tab)]
        if let environmentID {
            components.queryItems?.append(URLQueryItem(name: "env", value: environmentID))
            if let environmentName {
                components.queryItems?.append(URLQueryItem(name: "name", value: environmentName))
            }
        }
        return components.url ?? URL(string: "arcane-mobile://open")!
    }
}

struct WidgetContainerBackground: ViewModifier {
    @Environment(\.widgetRenderingMode) private var renderingMode
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content
            .environment(
                \.colorScheme,
                renderingMode == .fullColor ? .dark : colorScheme
            )
            .containerBackground(for: .widget) {
                if renderingMode == .fullColor {
                    Color.black
                } else {
                    Color.clear
                }
            }
    }
}

extension View {
    func widgetContainerBackground() -> some View {
        modifier(WidgetContainerBackground())
    }
}

struct StatusDot: View {
    @Environment(\.widgetRenderingMode) private var renderingMode
    let online: Bool

    var body: some View {
        Circle()
            .fill(renderingMode == .fullColor ? (online ? Color.green : Color.red) : Color.primary)
            .opacity(online ? 1 : 0.5)
            .frame(width: 7, height: 7)
            .widgetAccentable()
    }
}

struct WidgetCountChip: View {
    let count: Int
    let systemImage: String
    var tint: Color = .secondary

    var body: some View {
        HStack(spacing: 3) {
            Image(systemName: systemImage)
                .font(.system(size: 9, weight: .semibold))
            Text("\(count)")
                .font(.system(.caption2, design: .rounded).weight(.semibold))
                .monospacedDigit()
        }
        .foregroundStyle(tint)
    }
}

struct WidgetUnconfiguredView: View {
    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: "server.rack")
                .font(.title3)
                .foregroundStyle(.secondary)
            Text("Open Arcane to connect a server")
                .font(.caption2)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
        }
    }
}
