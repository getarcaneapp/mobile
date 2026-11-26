import AppIntents
import Foundation

struct OpenArcaneIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Arcane Section"
    static let description = IntentDescription("Opens a section of Arcane.")

    @Parameter(title: "Section", default: .dashboard)
    var destination: ArcaneDestination

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$destination)")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(ArcaneLink.open(tab: destination.rawValue)))
    }
}

struct OpenContainerIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Container"
    static let description = IntentDescription("Shows a container in Arcane.")

    @Parameter(title: "Container")
    var container: ContainerEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$container)")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(container.openURL))
    }
}

struct OpenProjectIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Project"
    static let description = IntentDescription("Shows a project in Arcane.")

    @Parameter(title: "Project")
    var project: ProjectEntity

    static var parameterSummary: some ParameterSummary {
        Summary("Open \(\.$project)")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(project.openURL))
    }
}

struct ContainerActionIntent: AppIntent {
    static let title: LocalizedStringResource = "Run Container Action"
    static let description = IntentDescription("Starts, stops or restarts a container.")

    @Parameter(title: "Action", default: .restart)
    var action: ContainerShortcutAction

    @Parameter(title: "Container")
    var container: ContainerEntity

    static var parameterSummary: some ParameterSummary {
        Summary("\(\.$action) \(\.$container)")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(container.runURL(action)))
    }
}

struct ProjectActionIntent: AppIntent {
    static let title: LocalizedStringResource = "Run Project Action"
    static let description = IntentDescription("Deploys, redeploys, restarts or stops a project.")

    @Parameter(title: "Action", default: .redeploy)
    var action: ProjectShortcutAction

    @Parameter(title: "Project")
    var project: ProjectEntity

    static var parameterSummary: some ParameterSummary {
        Summary("\(\.$action) \(\.$project)")
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(project.runURL(action)))
    }
}

struct ArcaneShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenArcaneIntent(),
            phrases: [
                "Open \(\.$destination) in \(.applicationName)",
                "Show \(.applicationName) \(\.$destination)",
            ],
            shortTitle: "Open Section",
            systemImageName: "square.grid.2x2"
        )
        AppShortcut(
            intent: ContainerActionIntent(),
            phrases: [
                "\(\.$action) a container in \(.applicationName)",
                "\(\.$action) a \(.applicationName) container",
            ],
            shortTitle: "Container Action",
            systemImageName: "cube.box.fill"
        )
        AppShortcut(
            intent: ProjectActionIntent(),
            phrases: [
                "\(\.$action) a project in \(.applicationName)",
                "\(\.$action) an \(.applicationName) project",
            ],
            shortTitle: "Project Action",
            systemImageName: "folder.fill"
        )
        AppShortcut(
            intent: OpenContainerIntent(),
            phrases: ["Open a container in \(.applicationName)"],
            shortTitle: "Open Container",
            systemImageName: "cube.box"
        )
        AppShortcut(
            intent: OpenProjectIntent(),
            phrases: ["Open a project in \(.applicationName)"],
            shortTitle: "Open Project",
            systemImageName: "folder"
        )
    }
}
