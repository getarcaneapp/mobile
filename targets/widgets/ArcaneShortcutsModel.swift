import AppIntents
import Foundation

struct ShortcutCatalog: Codable {
    static let currentSchemaVersion = 1

    var schemaVersion: Int
    var token: String
    var items: [Item]

    struct Item: Codable {
        var kind: String
        var id: String
        var name: String
        var environmentID: String
        var environmentName: String
    }
}

enum ShortcutCatalogStore {
    static let appGroupIdentifier = "group.com.getarcaneapp.ios.mobile"
    static let fileName = "shortcut-catalog.json"
    private static let maximumBytes = 1_024 * 1_024

    static func load() -> ShortcutCatalog? {
        guard
            let directory = FileManager.default.containerURL(
                forSecurityApplicationGroupIdentifier: appGroupIdentifier)
        else { return nil }
        let url = directory.appendingPathComponent(fileName)
        guard let data = try? Data(contentsOf: url), data.count <= maximumBytes,
            let catalog = try? JSONDecoder().decode(ShortcutCatalog.self, from: data),
            catalog.schemaVersion == ShortcutCatalog.currentSchemaVersion
        else { return nil }
        return catalog
    }

    static func items(kind: String) -> [ShortcutCatalog.Item] {
        (load()?.items ?? []).filter { $0.kind == kind }
    }

    static var token: String { load()?.token ?? "" }
}

enum ArcaneLink {
    private static func url(_ host: String, _ query: [(String, String)]) -> URL {
        var components = URLComponents()
        components.scheme = "arcane-mobile"
        components.host = host
        components.queryItems = query.map { URLQueryItem(name: $0.0, value: $0.1) }
        return components.url ?? URL(string: "arcane-mobile://open")!
    }

    static func open(tab: String) -> URL {
        url("open", [("tab", tab)])
    }

    static func item(kind: String, id: String, environmentID: String) -> URL {
        url("item", [("kind", kind), ("id", id), ("env", environmentID)])
    }

    static func run(kind: String, action: String, id: String, name: String, environmentID: String) -> URL {
        url(
            "run",
            [
                ("kind", kind), ("action", action), ("id", id), ("name", name),
                ("env", environmentID), ("token", ShortcutCatalogStore.token),
            ])
    }
}

struct ContainerEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Container"
    static let defaultQuery = ContainerEntityQuery()

    var id: String
    var containerName: String
    var name: String
    var environmentID: String
    var environmentName: String

    init(_ item: ShortcutCatalog.Item) {
        id = "\(item.environmentID)/\(item.id)"
        containerName = item.id
        name = item.name
        environmentID = item.environmentID
        environmentName = item.environmentName
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)", subtitle: "\(environmentName)", image: .init(systemName: "cube.box.fill"))
    }

    static func all() -> [ContainerEntity] {
        ShortcutCatalogStore.items(kind: "container").map(ContainerEntity.init)
    }
}

struct ContainerEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [ContainerEntity] {
        ContainerEntity.all().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [ContainerEntity] {
        ContainerEntity.all().filter { $0.name.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [ContainerEntity] {
        ContainerEntity.all()
    }
}

struct ProjectEntity: AppEntity {
    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Project"
    static let defaultQuery = ProjectEntityQuery()

    var id: String
    var projectID: String
    var name: String
    var environmentID: String
    var environmentName: String

    init(_ item: ShortcutCatalog.Item) {
        id = "\(item.environmentID)/\(item.id)"
        projectID = item.id
        name = item.name
        environmentID = item.environmentID
        environmentName = item.environmentName
    }

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(
            title: "\(name)", subtitle: "\(environmentName)", image: .init(systemName: "folder.fill"))
    }

    static func all() -> [ProjectEntity] {
        ShortcutCatalogStore.items(kind: "project").map(ProjectEntity.init)
    }
}

struct ProjectEntityQuery: EntityStringQuery {
    func entities(for identifiers: [String]) async throws -> [ProjectEntity] {
        ProjectEntity.all().filter { identifiers.contains($0.id) }
    }

    func entities(matching string: String) async throws -> [ProjectEntity] {
        ProjectEntity.all().filter { $0.name.localizedCaseInsensitiveContains(string) }
    }

    func suggestedEntities() async throws -> [ProjectEntity] {
        ProjectEntity.all()
    }
}

enum ContainerShortcutAction: String, AppEnum {
    case start
    case stop
    case restart

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Container Action"
    static let caseDisplayRepresentations: [ContainerShortcutAction: DisplayRepresentation] = [
        .start: DisplayRepresentation(title: "Start", image: .init(systemName: "play.fill")),
        .stop: DisplayRepresentation(title: "Stop", image: .init(systemName: "stop.fill")),
        .restart: DisplayRepresentation(title: "Restart", image: .init(systemName: "arrow.clockwise")),
    ]

    var symbolName: String {
        switch self {
        case .start: "play.fill"
        case .stop: "stop.fill"
        case .restart: "arrow.clockwise"
        }
    }
}

enum ProjectShortcutAction: String, AppEnum {
    case up
    case redeploy
    case restart
    case down

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Project Action"
    static let caseDisplayRepresentations: [ProjectShortcutAction: DisplayRepresentation] = [
        .up: DisplayRepresentation(title: "Deploy", image: .init(systemName: "play.fill")),
        .redeploy: DisplayRepresentation(
            title: "Redeploy", image: .init(systemName: "arrow.triangle.2.circlepath")),
        .restart: DisplayRepresentation(title: "Restart", image: .init(systemName: "arrow.clockwise")),
        .down: DisplayRepresentation(title: "Stop", image: .init(systemName: "stop.fill")),
    ]

    var symbolName: String {
        switch self {
        case .up: "play.fill"
        case .redeploy: "arrow.triangle.2.circlepath"
        case .restart: "arrow.clockwise"
        case .down: "stop.fill"
        }
    }
}

enum ArcaneDestination: String, AppEnum {
    case dashboard
    case containers
    case projects
    case images
    case updates
    case networks
    case volumes
    case events

    static let typeDisplayRepresentation: TypeDisplayRepresentation = "Arcane Section"
    static let caseDisplayRepresentations: [ArcaneDestination: DisplayRepresentation] = [
        .dashboard: DisplayRepresentation(title: "Dashboard", image: .init(systemName: "chart.bar.fill")),
        .containers: DisplayRepresentation(title: "Containers", image: .init(systemName: "cube.box.fill")),
        .projects: DisplayRepresentation(title: "Projects", image: .init(systemName: "folder.fill")),
        .images: DisplayRepresentation(
            title: "Images", image: .init(systemName: "square.3.layers.3d.top.filled")),
        .updates: DisplayRepresentation(
            title: "Updates", image: .init(systemName: "arrow.triangle.2.circlepath")),
        .networks: DisplayRepresentation(title: "Networks", image: .init(systemName: "network")),
        .volumes: DisplayRepresentation(title: "Volumes", image: .init(systemName: "externaldrive.fill")),
        .events: DisplayRepresentation(title: "Events", image: .init(systemName: "clock.badge.exclamationmark")),
    ]

    var symbolName: String {
        switch self {
        case .dashboard: "chart.bar.fill"
        case .containers: "cube.box.fill"
        case .projects: "folder.fill"
        case .images: "square.3.layers.3d.top.filled"
        case .updates: "arrow.triangle.2.circlepath"
        case .networks: "network"
        case .volumes: "externaldrive.fill"
        case .events: "clock.badge.exclamationmark"
        }
    }

    var title: String {
        switch self {
        case .dashboard: "Dashboard"
        case .containers: "Containers"
        case .projects: "Projects"
        case .images: "Images"
        case .updates: "Updates"
        case .networks: "Networks"
        case .volumes: "Volumes"
        case .events: "Events"
        }
    }
}

extension ContainerEntity {
    func runURL(_ action: ContainerShortcutAction) -> URL {
        ArcaneLink.run(
            kind: "container", action: action.rawValue, id: containerName, name: name,
            environmentID: environmentID)
    }

    var openURL: URL {
        ArcaneLink.item(kind: "container", id: containerName, environmentID: environmentID)
    }
}

extension ProjectEntity {
    func runURL(_ action: ProjectShortcutAction) -> URL {
        ArcaneLink.run(
            kind: "project", action: action.rawValue, id: projectID, name: name,
            environmentID: environmentID)
    }

    var openURL: URL {
        ArcaneLink.item(kind: "project", id: projectID, environmentID: environmentID)
    }
}
