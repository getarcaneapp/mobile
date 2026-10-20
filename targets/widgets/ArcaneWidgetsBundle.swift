import SwiftUI
import WidgetKit

@main
struct ArcaneWidgetsBundle: WidgetBundle {
    var body: some Widget {
        StatusWidget()
        EnvironmentsWidget()
        UpdatesWidget()
        DeployLiveActivity()
    }
}
