import ActivityKit
import Foundation

struct DeployActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String
        var progress: Double?
        var state: RunState
        var detail: String?
    }

    enum RunState: String, Codable, Hashable {
        case running, success, failure
    }

    var title: String
    var symbolName: String
    var environmentName: String
}
