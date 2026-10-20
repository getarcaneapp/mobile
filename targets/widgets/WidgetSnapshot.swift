import Foundation

enum AppGroup {
    static let identifier = "group.com.getarcaneapp.ios.mobile"

    static var containerURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: identifier)
    }
}

struct WidgetSnapshot: Codable, Equatable {
    static let currentSchemaVersion = 3
    static let maximumCount = 1_000_000_000

    var schemaVersion: Int
    var generatedAt: Date
    var serverConfigured: Bool
    var serverOrigin: String?
    var isDemo: Bool
    var accentHex: String?
    var activeEnvironmentID: String?
    var environments: [EnvSummary]

    struct EnvSummary: Codable, Equatable, Identifiable {
        var id: String
        var name: String
        var online: Bool
        var running: Int
        var stopped: Int
        var total: Int
        var images: Int
        var updatesAvailable: Int
        var actionableVulnerabilities: Int?
    }

    var totalRunning: Int { aggregate(\.running) }
    var totalContainers: Int { aggregate(\.total) }
    var totalUpdates: Int { aggregate(\.updatesAvailable) }
    var totalVulnerabilities: Int {
        environments.reduce(0) { partial, environment in
            Self.saturatingAdd(partial, environment.actionableVulnerabilities ?? 0)
        }
    }
    var onlineEnvironments: Int { environments.count(where: \.online) }

    private func aggregate(_ keyPath: KeyPath<EnvSummary, Int>) -> Int {
        environments.reduce(0) { partial, environment in
            Self.saturatingAdd(partial, environment[keyPath: keyPath])
        }
    }

    private static func saturatingAdd(_ lhs: Int, _ rhs: Int) -> Int {
        let left = min(max(lhs, 0), maximumCount)
        let right = min(max(rhs, 0), maximumCount)
        let (sum, overflow) = left.addingReportingOverflow(right)
        return overflow ? maximumCount : min(sum, maximumCount)
    }
}

enum WidgetSnapshotStore {
    private static let maximumSnapshotBytes = 512 * 1_024

    private static var fileURL: URL? {
        AppGroup.containerURL?.appendingPathComponent("widget-snapshot.json")
    }

    static func load() -> WidgetSnapshot? {
        guard let url = fileURL,
            let attributes = try? FileManager.default.attributesOfItem(atPath: url.path),
            let size = attributes[.size] as? NSNumber,
            size.intValue <= maximumSnapshotBytes,
            let data = try? Data(contentsOf: url),
            data.count <= maximumSnapshotBytes
        else { return nil }
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        guard let snapshot = try? decoder.decode(WidgetSnapshot.self, from: data),
            snapshot.schemaVersion == WidgetSnapshot.currentSchemaVersion
        else { return nil }
        return snapshot
    }
}
