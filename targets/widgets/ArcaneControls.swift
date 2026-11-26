import AppIntents
import SwiftUI
import WidgetKit

struct ContainerControlConfiguration: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "Container Action"
    static let isDiscoverable = false

    @Parameter(title: "Container")
    var container: ContainerEntity?

    @Parameter(title: "Action", default: .restart)
    var action: ContainerShortcutAction
}

struct ContainerControlIntent: AppIntent {
    static let title: LocalizedStringResource = "Run Container Action"
    static let isDiscoverable = false

    @Parameter(title: "Container")
    var container: ContainerEntity?

    @Parameter(title: "Action", default: .restart)
    var action: ContainerShortcutAction

    init() {}

    init(container: ContainerEntity?, action: ContainerShortcutAction) {
        self.container = container
        self.action = action
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(container?.runURL(action) ?? ArcaneLink.open(tab: "containers")))
    }
}

struct ContainerActionControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: "com.getarcaneapp.ios.mobile.control.container",
            intent: ContainerControlConfiguration.self
        ) { configuration in
            ControlWidgetButton(
                action: ContainerControlIntent(container: configuration.container, action: configuration.action)
            ) {
                Label(configuration.container?.name ?? "Container", systemImage: configuration.action.symbolName)
            }
        }
        .displayName("Container Action")
        .description("Start, stop or restart a container.")
        .promptsForUserConfiguration()
    }
}

struct ProjectControlConfiguration: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "Project Action"
    static let isDiscoverable = false

    @Parameter(title: "Project")
    var project: ProjectEntity?

    @Parameter(title: "Action", default: .redeploy)
    var action: ProjectShortcutAction
}

struct ProjectControlIntent: AppIntent {
    static let title: LocalizedStringResource = "Run Project Action"
    static let isDiscoverable = false

    @Parameter(title: "Project")
    var project: ProjectEntity?

    @Parameter(title: "Action", default: .redeploy)
    var action: ProjectShortcutAction

    init() {}

    init(project: ProjectEntity?, action: ProjectShortcutAction) {
        self.project = project
        self.action = action
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(project?.runURL(action) ?? ArcaneLink.open(tab: "projects")))
    }
}

struct ProjectActionControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: "com.getarcaneapp.ios.mobile.control.project",
            intent: ProjectControlConfiguration.self
        ) { configuration in
            ControlWidgetButton(
                action: ProjectControlIntent(project: configuration.project, action: configuration.action)
            ) {
                Label(configuration.project?.name ?? "Project", systemImage: configuration.action.symbolName)
            }
        }
        .displayName("Project Action")
        .description("Deploy, redeploy, restart or stop a project.")
        .promptsForUserConfiguration()
    }
}

struct DestinationControlConfiguration: ControlConfigurationIntent {
    static let title: LocalizedStringResource = "Open Arcane"
    static let isDiscoverable = false

    @Parameter(title: "Section", default: .dashboard)
    var destination: ArcaneDestination
}

struct DestinationControlIntent: AppIntent {
    static let title: LocalizedStringResource = "Open Arcane Section"
    static let isDiscoverable = false

    @Parameter(title: "Section", default: .dashboard)
    var destination: ArcaneDestination

    init() {}

    init(destination: ArcaneDestination) {
        self.destination = destination
    }

    func perform() async throws -> some IntentResult & OpensIntent {
        .result(opensIntent: OpenURLIntent(ArcaneLink.open(tab: destination.rawValue)))
    }
}

struct DestinationControl: ControlWidget {
    var body: some ControlWidgetConfiguration {
        AppIntentControlConfiguration(
            kind: "com.getarcaneapp.ios.mobile.control.destination",
            intent: DestinationControlConfiguration.self
        ) { configuration in
            ControlWidgetButton(action: DestinationControlIntent(destination: configuration.destination)) {
                Label(configuration.destination.title, systemImage: configuration.destination.symbolName)
            }
        }
        .displayName("Open Arcane")
        .description("Open a section of Arcane.")
    }
}
