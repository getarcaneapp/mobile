import ActivityKit
import CoreSpotlight
import ExpoModulesCore
import Foundation
import WidgetKit

struct LiveActivityAttributesRecord: Record {
    @Field var title: String = ""
    @Field var symbolName: String = ""
    @Field var environmentName: String = ""
}

struct LiveActivityStateRecord: Record {
    @Field var phase: String = ""
    @Field var progress: Double?
    @Field var state: String = "running"
    @Field var detail: String?

    var contentState: DeployActivityAttributes.ContentState {
        .init(
            phase: String(phase.prefix(120)),
            progress: progress.map { min(max($0, 0), 1) },
            state: DeployActivityAttributes.RunState(rawValue: state) ?? .running,
            detail: detail.map { String($0.prefix(120)) }
        )
    }
}

struct SpotlightItemRecord: Record {
    @Field var id: String = ""
    @Field var title: String = ""
    @Field var subtitle: String = ""
    @Field var kind: String = ""
}

public class ArcaneWidgetBridgeModule: Module {
    private static let appGroupIdentifier = "group.com.getarcaneapp.ios.mobile"
    private static let snapshotFileName = "widget-snapshot.json"
    private static let maximumSnapshotBytes = 512 * 1_024
    private static let staleInterval: TimeInterval = 60
    private static let sharedFileNames: Set<String> = ["shortcut-catalog.json"]
    private static let maximumSharedFileBytes = 1_024 * 1_024
    private static let spotlightDomain = "com.getarcaneapp.ios.mobile.items"
    private var linkObserver: NSObjectProtocol?

    public func definition() -> ModuleDefinition {
        Name("ArcaneWidgetBridge")

        AsyncFunction("writeSnapshot") { (json: String, reload: Bool) -> Bool in
            guard
                let directory = FileManager.default.containerURL(
                    forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier)
            else { return false }
            let url = directory.appendingPathComponent(Self.snapshotFileName)
            let data = Data(json.utf8)
            guard data.count <= Self.maximumSnapshotBytes else {
                try? FileManager.default.removeItem(at: url)
                return false
            }
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var protectedURL = url
            try? protectedURL.setResourceValues(values)
            if reload { WidgetCenter.shared.reloadAllTimelines() }
            return true
        }

        Events("onLink")

        OnStartObserving {
            self.linkObserver = NotificationCenter.default.addObserver(
                forName: ArcanePendingLink.notification, object: nil, queue: .main
            ) { [weak self] _ in
                guard let url = ArcanePendingLink.take() else { return }
                self?.sendEvent("onLink", ["url": url])
            }
        }

        OnStopObserving {
            if let observer = self.linkObserver { NotificationCenter.default.removeObserver(observer) }
            self.linkObserver = nil
        }

        Function("takePendingLink") { () -> String? in
            ArcanePendingLink.take()
        }

        AsyncFunction("writeSharedFile") { (name: String, json: String) -> Bool in
            guard Self.sharedFileNames.contains(name),
                let directory = FileManager.default.containerURL(
                    forSecurityApplicationGroupIdentifier: Self.appGroupIdentifier)
            else { return false }
            let url = directory.appendingPathComponent(name)
            let data = Data(json.utf8)
            guard data.count <= Self.maximumSharedFileBytes else {
                try? FileManager.default.removeItem(at: url)
                return false
            }
            try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            var values = URLResourceValues()
            values.isExcludedFromBackup = true
            var protectedURL = url
            try? protectedURL.setResourceValues(values)
            return true
        }

        AsyncFunction("indexSpotlight") { (items: [SpotlightItemRecord]) in
            let index = CSSearchableIndex.default()
            try await index.deleteSearchableItems(withDomainIdentifiers: [Self.spotlightDomain])
            guard !items.isEmpty else { return }
            let searchable = items.prefix(2_000).map { item in
                let attributes = CSSearchableItemAttributeSet(contentType: .content)
                attributes.title = String(item.title.prefix(200))
                attributes.contentDescription = String(item.subtitle.prefix(200))
                attributes.keywords = [item.kind == "project" ? "project" : "container", "arcane"]
                return CSSearchableItem(
                    uniqueIdentifier: item.id, domainIdentifier: Self.spotlightDomain, attributeSet: attributes)
            }
            try await index.indexSearchableItems(Array(searchable))
        }

        AsyncFunction("clearSpotlight") { () in
            try await CSSearchableIndex.default().deleteSearchableItems(withDomainIdentifiers: [
                Self.spotlightDomain
            ])
        }

        Function("areActivitiesEnabled") { () -> Bool in
            ActivityAuthorizationInfo().areActivitiesEnabled
        }

        AsyncFunction("startActivity") {
            (attributes: LiveActivityAttributesRecord, state: LiveActivityStateRecord) -> String? in
            guard ActivityAuthorizationInfo().areActivitiesEnabled else { return nil }
            let activity = try Activity<DeployActivityAttributes>.request(
                attributes: DeployActivityAttributes(
                    title: String(attributes.title.prefix(120)),
                    symbolName: attributes.symbolName,
                    environmentName: String(attributes.environmentName.prefix(120))
                ),
                content: .init(
                    state: state.contentState,
                    staleDate: Date().addingTimeInterval(Self.staleInterval)
                )
            )
            return activity.id
        }

        AsyncFunction("updateActivity") { (id: String, state: LiveActivityStateRecord) in
            guard let activity = Self.activity(id: id) else { return }
            await activity.update(
                .init(
                    state: state.contentState,
                    staleDate: Date().addingTimeInterval(Self.staleInterval)
                ))
        }

        AsyncFunction("endActivity") { (id: String, state: LiveActivityStateRecord?, lingerSeconds: Double) in
            guard let activity = Self.activity(id: id) else { return }
            let content = state.map { ActivityContent(state: $0.contentState, staleDate: nil) }
            let policy: ActivityUIDismissalPolicy =
                lingerSeconds > 0 ? .after(Date().addingTimeInterval(lingerSeconds)) : .immediate
            await activity.end(content ?? activity.content, dismissalPolicy: policy)
        }

        AsyncFunction("endAllActivities") { () in
            for activity in Activity<DeployActivityAttributes>.activities {
                await activity.end(activity.content, dismissalPolicy: .immediate)
            }
        }
    }

    private static func activity(id: String) -> Activity<DeployActivityAttributes>? {
        Activity<DeployActivityAttributes>.activities.first { $0.id == id }
    }
}
