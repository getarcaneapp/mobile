import { tabTitle, type AppTab } from '@/core/app-tab';

import { ContainersDestination } from '@/features/containers/containers-destination';
import { DashboardScreen } from '@/features/dashboard/dashboard-screen';
import { ImagesDestination } from '@/features/images/images-destination';
import { SecurityDestination } from '@/features/images/security/security-destination';
import { VolumesDestination } from '@/features/volumes/volumes-destination';
import { ActivitiesScreen } from '@/features/activities/activities-screen';
import { BuildSettingsScreen } from '@/features/builds/build-settings-screen';
import { ActivityHistorySettingsScreen } from '@/features/environments/activity-history-settings-screen';
import { JobsDestination } from '@/features/jobs/jobs-destination';
import { ProjectsDestination } from '@/features/projects/projects-destination';
import { UpdatesScreen } from '@/features/updates/updates-screen';
import { EventsDestination } from '@/features/events/events-destination';
import {
	NetworkTopologyDestination,
	NetworksDestination
} from '@/features/networks/networks-destination';
import { PortsDestination } from '@/features/ports/ports-destination';
import { SwarmDestination } from '@/features/swarm/swarm-destination';
import { CustomizeDestination } from '@/features/customize/customize-destination';
import { GitOpsDestination } from '@/features/customize/gitops/gitops-destination';
import { GitRepositoriesDestination } from '@/features/customize/gitops/git-repositories-destination';
import { VariablesDestination } from '@/features/customize/variables/variables-destination';
import { APIKeysDestination } from '@/features/settings/api-keys/api-keys-screen';
import { SystemBackupsDestination } from '@/features/settings/backups/system-backups-destination';
import { FederatedCredentialsDestination } from '@/features/settings/federated/federated-credentials-screen';
import { MoreScreen } from '@/features/settings/more-screen';
import { NotificationsDestination } from '@/features/settings/notifications/notification-settings-screen';
import { OIDCRoleMappingsDestination } from '@/features/settings/rbac/oidc-role-mappings-screen';
import { RolesDestination } from '@/features/settings/rbac/roles-screen';
import { ContainerRegistriesDestination } from '@/features/settings/registries/container-registries-destination';
import { AuthenticationDestination } from '@/features/settings/system/authentication-settings-screen';
import { TimeoutsDestination } from '@/features/settings/system/settings-category-screen';
import { TemplateRegistriesDestination } from '@/features/settings/templates/template-registries-destination';
import { UsersDestination } from '@/features/settings/users/users-screen';
import { WebhooksDestination } from '@/features/settings/webhooks/webhooks-screen';

import { NotYetPorted } from './not-yet-ported';

export function AppTabDestination({ tab }: { tab: AppTab }) {
	switch (tab) {
		case 'dashboard':
			return <DashboardScreen />;
		case 'containers':
			return <ContainersDestination />;
		case 'projects':
			return <ProjectsDestination />;
		case 'images':
			return <ImagesDestination />;
		case 'imageVulnerabilities':
			return <SecurityDestination />;
		case 'volumes':
			return <VolumesDestination />;
		case 'updates':
			return <UpdatesScreen />;
		case 'activities':
			return <ActivitiesScreen />;
		case 'jobs':
			return <JobsDestination />;
		case 'builds':
			return <BuildSettingsScreen />;
		case 'activityHistory':
			return <ActivityHistorySettingsScreen />;
		case 'networks':
			return <NetworksDestination />;
		case 'networkTopology':
			return <NetworkTopologyDestination />;
		case 'ports':
			return <PortsDestination />;
		case 'events':
			return <EventsDestination />;
		case 'swarm':
			return <SwarmDestination />;
		case 'customize':
			return <CustomizeDestination />;
		case 'settings':
			return <MoreScreen />;
		case 'templateRegistries':
			return <TemplateRegistriesDestination />;
		case 'containerRegistries':
			return <ContainerRegistriesDestination />;
		case 'variables':
			return <VariablesDestination />;
		case 'gitRepositories':
			return <GitRepositoriesDestination />;
		case 'gitOps':
			return <GitOpsDestination />;
		case 'apiKeys':
			return <APIKeysDestination />;
		case 'webhooks':
			return <WebhooksDestination />;
		case 'authentication':
			return <AuthenticationDestination />;
		case 'notifications':
			return <NotificationsDestination />;
		case 'users':
			return <UsersDestination />;
		case 'roles':
			return <RolesDestination />;
		case 'timeouts':
			return <TimeoutsDestination />;
		case 'systemBackups':
			return <SystemBackupsDestination />;
		case 'federatedCredentials':
			return <FederatedCredentialsDestination />;
		case 'oidcRoleMappings':
			return <OIDCRoleMappingsDestination />;
		default:
			return <NotYetPorted title={tabTitle[tab]} />;
	}
}
