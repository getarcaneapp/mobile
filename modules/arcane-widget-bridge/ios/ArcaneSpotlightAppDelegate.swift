import CoreSpotlight
import ExpoModulesCore

enum ArcanePendingLink {
    static let notification = Notification.Name("ArcanePendingLink")
    private static let lock = NSLock()
    private static var pending: String?

    static func deliver(_ url: String) {
        lock.lock()
        pending = url
        lock.unlock()
        NotificationCenter.default.post(name: notification, object: nil)
    }

    static func take() -> String? {
        lock.lock()
        defer { lock.unlock() }
        let url = pending
        pending = nil
        return url
    }
}

public class ArcaneSpotlightAppDelegate: ExpoAppDelegateSubscriber {
    public func application(
        _ application: UIApplication,
        continue userActivity: NSUserActivity,
        restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
    ) -> Bool {
        guard userActivity.activityType == CSSearchableItemActionType,
            let identifier = userActivity.userInfo?[CSSearchableItemActivityIdentifier] as? String,
            identifier.hasPrefix("arcane-mobile://")
        else { return false }
        ArcanePendingLink.deliver(identifier)
        return true
    }
}
