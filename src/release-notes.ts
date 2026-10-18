export type ReleaseNoteBadge = 'premium' | 'preview';
export type ReleaseNoteBullet = { text: string; badge?: ReleaseNoteBadge };
export type ReleaseNote = {
	version: string;
	new?: ReleaseNoteBullet[];
	changed?: ReleaseNoteBullet[];
	removed?: ReleaseNoteBullet[];
	fixed?: ReleaseNoteBullet[];
};

export const releaseNotes: ReleaseNote[] = [
	{
		version: '0.11.0',
		new: [
			{
				text: 'On Android, connection profiles back up to your Google account and saved sign-ins can go to Google Password Manager.'
			},
			{
				text: 'Alternate app icons on Android, under Appearance > App Icon.'
			}
		],
		changed: [
			{
				text: 'Smoother scrolling in long lists, live charts, logs, and terminals.'
			},
			{
				text: 'Live usage charts slide continuously instead of jumping with each sample.'
			},
			{
				text: 'Long-pressing a log line opens Copy Line in an action sheet.'
			},
			{
				text: 'Swarm stack compose and .env files, and new config data, are edited as plain monospaced text.'
			},
			{
				text: 'Disconnecting a container keeps its network open; deleting a network closes it once the delete succeeds.'
			},
			{
				text: 'Custom environment colors on iOS open a compact color-well sheet.'
			},
			{
				text: 'Project deploy, redeploy, pull, and build progress shows in its log sheet, or as a progress toast while the sheet is hidden.'
			},
			{
				text: 'Image pull progress shows as a progress toast.'
			},
			{
				text: 'Volume workspace files open in a plain text editor without syntax highlighting.'
			},
			{
				text: 'Android dialogs use Material 3 styling and your wallpaper colors.'
			}
		],
		fixed: [
			{
				text: 'On Android, long lists no longer load every page on their own before you scroll.'
			},
			{
				text: 'Creating a project works again on current Arcane servers.'
			},
			{
				text: 'Android follows a dark mode switch right away instead of after a restart.'
			},
			{
				text: 'Findings by severity on the Security screen shows every severity instead of only Medium.'
			},
			{
				text: 'Tab switchers on Security, image, container, Swarm stack and service, and template preview screens blend into the navigation bar on iOS.'
			},
			{
				text: 'Connection Profiles opens inside Account instead of as a separate sheet, so Preferences and Passkeys open where expected afterward.'
			},
			{
				text: 'Shared log files and saved volume files are fully written before they are shared or uploaded.'
			}
		]
	},
	{
		version: '0.10.2',
		new: [
			{
				text: 'Docker Swarm services, stacks, nodes, tasks, configs, secrets, and cluster setup.'
			},
			{
				text: 'Kill, pause, processes, and auto-update toggle for containers.'
			},
			{
				text: 'Live CPU and memory on running container rows, with CPU and memory sorting.'
			},
			{
				text: 'Refreshed Dashboard in Preview Features, with live usage graphs, busiest containers, customizable tiles, an inventory row for every host, and a guided introduction.',
				badge: 'preview'
			},
			{
				text: 'Start All, Start Stopped, and Stop All containers.'
			},
			{
				text: 'Rename volumes.'
			},
			{
				text: 'Connect and disconnect containers from networks.'
			},
			{
				text: 'Project tags with filtering.'
			},
			{
				text: 'Edit Git repositories and GitOps syncs.'
			},
			{
				text: 'Push notifications combine into one summary per environment and type, written with Apple Intelligence when available.'
			}
		],
		changed: [
			{
				text: 'Success and error toasts for every container, image, volume, network, project, and settings action.'
			},
			{
				text: 'With Activity Toasts set to All, every server activity gets a toast and a Live Activity, including work that finishes before it is seen running.'
			},
			{
				text: 'Loading screens and sections show the Arcane logo drawing itself in place of a spinner.'
			},
			{
				text: 'Refreshed list rows across the app with icon tiles; image references lead with the image name and show the tag as a chip.'
			},
			{
				text: 'New icons for Projects and Images.'
			},
			{
				text: 'Choose how many environments stream live dashboard stats in App Settings.'
			},
			{
				text: 'Deployment pill and activity toasts show progress around their edge instead of a spinner; a finished deployment sweeps the border and shows a checkmark without a separate toast.'
			},
			{
				text: 'Faster loading across all environments, with each environment appearing as soon as it responds.'
			},
			{
				text: 'Smoother Dashboard, logs, lists, activities, network topology, compose editor, and compose options.'
			},
			{
				text: 'Faster app launch, with the profile picture shown without re-downloading.'
			},
			{
				text: 'Log lines copy from a long-press menu.'
			}
		],
		fixed: [
			{
				text: 'Data is never shown from an outdated cache.'
			},
			{
				text: 'Lists keep their loaded pages and scroll position after returning from a detail screen.'
			},
			{
				text: 'Last log lines appear without waiting for new output.'
			},
			{
				text: 'Dashboard no longer reloads on every return from Control Center or a detail screen.'
			},
			{
				text: 'Webhook enable and disable.'
			},
			{
				text: 'Confirmation dialogs are no longer see-through inside sheets.'
			},
			{
				text: 'Repeated push notifications replace the earlier copy instead of stacking or inflating the count.'
			},
			{
				text: 'Adding a Git repository.'
			},
			{
				text: 'Activities update live on Arcane 2.16 and later.'
			}
		]
	},
	{
		version: '0.10.1',
		new: [
			{
				text: 'Native environment details with animated horizontal connections, session metrics, and certificate status.'
			},
			{
				text: 'Account Preferences for the icon catalog, saved to your Arcane account.'
			}
		],
		changed: [
			{
				text: 'Detail tabs center within the available width and scroll without inset edge bars.'
			},
			{
				text: 'All Environments updates use a searchable resource list with environment labels and filters.'
			},
			{
				text: 'Updates sheet opens at half height and expands with a native drag gesture.'
			},
			{
				text: 'All Environments resource pages use the standard resource views, sections, menus, and actions.',
				badge: 'preview'
			},
			{
				text: 'Resource sorting and filters have their own toolbar button.'
			},
			{
				text: 'Toolbar buttons share one group, with the add button on its own.'
			},
			{
				text: 'Preview release notes appear in an outlined Preview card.'
			},
			{
				text: 'Dashboard greets you by first name in place of its title and date.'
			},
			{
				text: 'Purple is the default accent color.'
			},
			{
				text: "Environment details hold the environment's settings in tabs matching the web; Timeouts, Activity History, and Builds moved under Server Settings."
			},
			{
				text: "What's New sits under Preview Features, Edit Tabs moved into Appearance, and Connection Profiles moved to Account."
			},
			{
				text: 'Redesigned launch animation that follows the accent color.'
			}
		],
		removed: [
			{
				text: 'Support bundle in Settings.'
			},
			{
				text: 'Server Info in App Settings.'
			},
			{
				text: 'Share Arcane and the About section; its links moved to Support.'
			},
			{
				text: "Environment Settings from More; settings live on each environment's details page."
			}
		],
		fixed: [
			{
				text: 'Updates uses the standard resource menu for sorting, filters, and All Environments actions.'
			},
			{
				text: 'Resource pages prune only their resource across all enabled environments with a concise confirmation.'
			},
			{
				text: 'All Environments resource lists retain row swipe actions.'
			},
			{
				text: "All Environments row, bulk, and detail actions target each resource's own environment."
			},
			{
				text: 'Prune and other destructive menu actions show red icons.'
			},
			{
				text: 'Resource filter sheets expand to full height.'
			},
			{
				text: 'Native GitOps sync details with status, repository, schedule, and backup details.'
			},
			{
				text: 'Creating a GitOps sync sends the compose path and auto sync setting.'
			},
			{
				text: 'Container registry rows and dashboard environment counts use standard text colors.'
			},
			{
				text: 'Dashboard environment cards no longer overlap while scrolling in.'
			},
			{
				text: 'Unused-resource pruning uses the correct API requests and response types.'
			},
			{
				text: 'Image pruning offers Dangling and All Unused choices across all enabled environments.'
			},
			{
				text: 'Resource details omit the environment label from the navigation header.'
			},
			{
				text: 'System pruning omits environment lists and confirms the selected cleanup across all enabled environments.'
			}
		]
	},
	{
		version: '0.10.0',
		new: [
			{
				text: 'Blueprint alternate app icon.'
			},
			{
				text: 'View and manage resources across all environments in one place, with environment filters and a guided introduction.',
				badge: 'preview'
			},
			{
				text: 'Native Compose editor for projects and templates in Preview Features.',
				badge: 'preview'
			}
		],
		changed: [
			{
				text: 'Updated SwiftUI and Arcane SDK integration for iOS 18 through iOS 27.'
			},
			{
				text: 'Preview badges identify experimental features in release notes.'
			}
		],
		fixed: [
			{
				text: 'Live logs preserve proxy sessions and close connections when cancelled.'
			},
			{
				text: 'Profile images use the current display resolution.'
			},
			{
				text: 'Proxy authentication failures show specific error messages.'
			},
			{
				text: 'Image update results appear correctly in All Environments.'
			},
			{
				text: 'All Environments actions use concise confirmation prompts and compact toast feedback; Compose drafts use standard confirmations.'
			},
			{
				text: 'Destructive menu icons match their red action labels.'
			},
			{
				text: 'Saved resource tabs stay visible through launch and refresh.'
			},
			{
				text: 'Dashboard toolbar buttons remain directly accessible.'
			}
		]
	},
	{
		version: '0.9.1',
		new: [
			{
				text: 'Security overview with patch priority, risk trend, exposure, and priority findings.'
			}
		],
		changed: [
			{
				text: 'Security findings and image patch actions share the redesigned security view.'
			},
			{
				text: 'Risk score and trend share a switchable card with an animated score.'
			},
			{
				text: "Security overview and findings use the app's detail tabs."
			}
		],
		fixed: [
			{
				text: 'Deployment updates avoid duplicate activity toasts and Live Activities.'
			},
			{
				text: 'Activity toasts retain completion during transitions and show unmeasured progress.'
			},
			{
				text: 'Activity progress distinguishes measured percentages from unmeasured work.'
			},
			{
				text: 'Activity detail Back buttons use the selected app accent color.'
			},
			{
				text: 'Activity status updates stay live in lists and details.'
			},
			{
				text: 'Navigation bar controls use the selected app accent color.'
			},
			{
				text: 'Sign-in and background responses stay with their active server and account.'
			},
			{
				text: 'Project deletion preserves files when removal is disabled.'
			},
			{
				text: 'Large resource numbers display without crashes.'
			},
			{
				text: 'Activity history keeps loaded entries through live updates and retries failed environments.'
			},
			{
				text: 'Resource lists follow server pagination limits and retry failed pages.'
			},
			{
				text: 'Refreshes discard invalidated requests and cached responses.'
			},
			{
				text: 'Widget links and Shortcuts open containers and projects beyond the first page.'
			},
			{
				text: 'Container details show images, labels, and mounts.'
			},
			{
				text: 'Live logs follow wrapped output to the bottom.'
			},
			{
				text: 'Security findings load the next page without repeating earlier results.'
			},
			{
				text: 'Dashboard live stats connect on cold launch.'
			},
			{
				text: 'Dashboard environment switcher uses the app accent color.'
			}
		]
	},
	{
		version: '0.9.0',
		new: [
			{
				text: 'Bulk container updates from multi-select.'
			},
			{
				text: 'Container log downloads with share.'
			},
			{
				text: 'Vulnerability CSV export with fix-available filter.'
			},
			{
				text: 'Volume S3 backup discovery with remote instance badges.'
			},
			{
				text: 'Network creation with optional subnet, gateway, and IP range.'
			},
			{
				text: 'Telegram topic destinations with chat:topic syntax.'
			},
			{
				text: 'Hidden container visibility toggle with label filtering.'
			},
			{
				text: 'Live Activities for automated and system work when All Activities is selected.'
			},
			{
				text: 'Update option in the container long-press menu when an update is available.'
			}
		],
		changed: [
			{
				text: 'Updated navigation with a native tab bar, compact environment switching, and streamlined resource detail layouts.'
			},
			{
				text: 'Accent color uses a native menu picker.'
			}
		],
		fixed: [
			{
				text: 'Attention Center items open without delay.'
			},
			{
				text: 'Federated credentials empty state matches other lists.'
			},
			{
				text: 'Vulnerability report loads summary, filters, and findings together.'
			},
			{
				text: 'Accent menu shows each color correctly.'
			},
			{
				text: 'Push toggle recovers from already-registered devices.'
			},
			{
				text: 'Push errors show readable text.'
			}
		]
	},
	{
		version: '0.8.3',
		new: [
			{
				text: 'Colored Compose tags with links beneath them in the project header.'
			},
			{
				text: 'Five new alternate app icons.'
			},
			{
				text: 'Container creation, editing, image commits, and Compose generation.'
			},
			{
				text: 'Volume file editing, transfers, and conflict review.'
			},
			{
				text: 'Volume and system backup policies, recovery, and S3 destinations.'
			},
			{
				text: 'Image tagging, export, and vulnerability patching.'
			},
			{
				text: 'Federated credential management.'
			}
		],
		changed: [
			{
				text: 'Project status and creation date aligned beside the project name.'
			},
			{
				text: 'Resource lists and details use consistent native sections and controls.'
			},
			{
				text: 'Sidebar navigation uses an iPad split view and an iPhone navigation sheet.'
			},
			{
				text: 'Container and image rows show clear update-status badges.'
			},
			{
				text: 'Smoother button feedback, filter selection, and resource-count transitions.'
			},
			{
				text: 'Image patching uses a tools icon with separate toolbar controls.'
			},
			{
				text: 'Backup history uses toolbar actions and separate backup settings.'
			},
			{
				text: 'Standalone image builds removed from mobile navigation.'
			},
			{
				text: 'Accent color menu shows colored dots and labels.'
			},
			{
				text: 'App icon previews use native display resolutions.'
			},
			{
				text: 'Clearer gray grid backgrounds for app icons.'
			},
			{
				text: 'Templates use the same collapsible search layout as resource pages.'
			}
		],
		fixed: [
			{
				text: 'Template filters scroll with the list without overlapping the navigation header.'
			},
			{
				text: 'Image update badges account for every image tag.'
			},
			{
				text: "Backup failures display the server's error message."
			},
			{
				text: 'Volume backup deletion uses the correct backup route.'
			},
			{
				text: 'Template rows keep their icons and text aligned.'
			},
			{
				text: 'Dashboard counts refresh after prune, updates, and pull-to-refresh.'
			},
			{
				text: 'Dashboard rings track live stats without judder.'
			},
			{
				text: 'Dashboard attention badge refreshes when returning to the tab.'
			},
			{
				text: 'Attention Center badge no longer flickers during loads.'
			},
			{
				text: 'Smoother scrolling across dashboards, resource lists, logs, and terminal output.'
			}
		]
	},
	{
		version: '0.8.2',
		new: [
			{
				text: 'Support bundles with actionable redacted diagnostics.'
			},
			{
				text: 'iCloud Keychain connection profiles with included password sign-ins.'
			},
			{
				text: 'Attention Center toolbar button with an expanding summary; hold it to open the full center.'
			},
			{
				text: 'Activity Center button no longer badges failed activities.'
			},
			{
				text: 'Activity Center and System Prune are separate toolbar buttons.'
			},
			{
				text: 'Environment cards open details on tap and show their actions on long press.'
			},
			{
				text: 'Environment cards show icon counts beside the name and full-width CPU, memory, and disk rings; the active environment is marked by its outline.'
			},
			{
				text: 'Update All is a two-tap icon button that expands into a confirm step and starts the run immediately.'
			},
			{
				text: 'Update All progress shows environments as a left-to-right pipeline with floating bubbles and filling connectors.'
			},
			{
				text: 'Staggered card entrances, sweeping ring gauges, and scroll-edge fades on the dashboard.'
			}
		],
		changed: [
			{
				text: 'Connection profiles manage server details and saved sign-ins together.'
			},
			{
				text: 'Saved iCloud sign-ins are offered after sign-out.'
			},
			{
				text: 'Tab bar compacts on downward scrolling and expands on upward scrolling.'
			},
			{
				text: 'Reorganized App Settings with compact single-line rows.'
			},
			{
				text: 'Compact detail tabs and log layout with inline stream controls.'
			},
			{
				text: 'Removed log search from the viewer.'
			},
			{
				text: 'Log expansion and options use separate navigation-bar buttons.'
			},
			{
				text: 'Dashboard environment cards show Arcane and Docker API versions.'
			},
			{
				text: 'Dashboard redesign with frosted Liquid Glass cards that follow the system Liquid Glass appearance, compact rings, and a large title.'
			},
			{
				text: 'Update All and Run Updater use centered native sheets.'
			}
		],
		fixed: [
			{
				text: 'Authentication settings save with one-year session timeouts.'
			},
			{
				text: 'Destructive action icons consistently use red styling.'
			},
			{
				text: 'Live log following stays pinned to new output.'
			},
			{
				text: 'All Activities banners include running work.'
			},
			{
				text: 'Activity and update counts clear without relaunching.'
			},
			{
				text: 'Cleaner login controls with a properly spaced keyboard dismissal.'
			},
			{
				text: 'Disabled local password authentication is hidden from sign-in.'
			},
			{
				text: 'Tab bar stays compact during bottom-edge bounce.'
			}
		]
	},
	{
		version: '0.8.1',
		new: [
			{
				text: 'Potential secrets are blurred in container and image environment-variable views.'
			},
			{
				text: 'Detailed API key management with assigned users, partial keys, editing, rotation, and deletion.'
			},
			{
				text: 'Environment Settings includes an independent environment dropdown.'
			}
		],
		changed: [
			{
				text: 'Environment-wide updates keep every environment in a progress cycle with loading rings and animated result symbols.'
			},
			{
				text: 'Dashboard explains the four-environment limit for live system metrics.'
			},
			{
				text: 'Environment settings identify the selected environment and follow Arcane web configuration groups.'
			},
			{
				text: 'Trivy network settings list available Docker networks in a menu.'
			},
			{
				text: 'Environment Settings detail pages omit repeated environment banners.'
			},
			{
				text: 'User avatar settings live under Users and apply to the manager.'
			},
			{
				text: 'Editable settings use a shared floating save control with a contextual tinted revert action.'
			},
			{
				text: "Feature-focused What's New presentation with access to previous releases."
			},
			{
				text: "What's New uses compact category sections and toolbar actions."
			},
			{
				text: 'Animated bottom-tab selection with a sliding accent indicator.'
			},
			{
				text: 'Selectable straight, parabolic, and teleport dock indicator motion.'
			},
			{
				text: 'Adaptive log viewer with full-screen reading and configurable line wrapping.'
			}
		],
		fixed: [
			{
				text: 'Dashboard activity badges remain fully visible in the navigation toolbar.'
			},
			{
				text: 'Dashboard update and volume counts remain visible during pull-to-refresh.'
			},
			{
				text: "Login keyboard and What's New wait for the launch animation to finish."
			},
			{
				text: 'Masked environment-variable rows match other row heights.'
			},
			{
				text: 'Environment update backgrounds no longer show a gradient edge.'
			},
			{
				text: 'API key details use native grouped sections with readable metadata and one copy action.'
			},
			{
				text: 'Prune age filters appear only for Older Than modes.'
			},
			{
				text: 'Settings action controls morph smoothly without vertical movement.'
			},
			{
				text: 'Settings revert actions use white symbols on subtly tinted glass.'
			},
			{
				text: 'Revert controls fade before merging into the save action.'
			},
			{
				text: 'Bottom-tab icons and selection indicators stay centered in the floating bar.'
			},
			{
				text: 'Resource rows clear their selection highlight after returning from details.'
			},
			{
				text: 'Custom accent colors apply consistently across app surfaces.'
			},
			{
				text: 'Consistent accent and destructive colors for navigation toolbar actions.'
			},
			{
				text: 'Unit test suite compatibility with Swift 6 actor isolation.'
			}
		]
	},
	{
		version: '0.8.0',
		new: [
			{
				text: 'Activity Center button on the Dashboard in tab-bar navigation mode.'
			},
			{
				text: 'Optional accent-colored Arcane logo animation with a zoom transition on app launch.'
			},
			{
				text: 'Techy alternate app icon.'
			}
		],
		changed: [
			{
				text: 'Consistent dashboard-style cards, chips, and section headers across screens.'
			},
			{
				text: 'Image updates and layer history use dashboard card layout.'
			},
			{
				text: 'Image detail overview and attestations use dashboard card layout.'
			},
			{
				text: 'Volume, network, job, container detail, Swarm, and template screens use dashboard card layout.'
			},
			{
				text: 'User, registry, webhook, and template lists render as cards.'
			},
			{
				text: 'Shared card and list surfaces extracted to reusable vocabulary for future screens.'
			},
			{
				text: 'Deployment and client lifecycle helpers factored for maintainability.'
			}
		],
		fixed: [
			{
				text: 'Settings menu rows show navigation chevrons.'
			},
			{
				text: 'Healthy service status badge shows green instead of grey.'
			},
			{
				text: 'Swipe-back gesture animates correctly on pushed pages.'
			},
			{
				text: 'Card rows no longer stay highlighted after returning from a detail page.'
			},
			{
				text: 'Detail pages add breathing room below the navigation bar.'
			},
			{
				text: 'Loading lists no longer animate rows from the top-left.'
			},
			{
				text: 'Image identity values wrap instead of truncating on the detail page.'
			},
			{
				text: 'Severity filters on image vulnerabilities are color-coded tappable chips.'
			},
			{
				text: 'External links safely unwrap URLs.'
			},
			{
				text: 'App-icon preview uses design token radius.'
			},
			{
				text: 'Counts and IDs render without locale formatting.'
			}
		]
	},
	{
		version: '0.7.0',
		new: [
			{
				text: 'Reliable passkey sign-in and multi-factor authentication.'
			},
			{
				text: 'Notification provider configuration with native controls and floating save actions.'
			},
			{
				text: 'Configurable project deploy options.'
			},
			{
				text: 'Repository names for container registries.'
			},
			{
				text: 'Image layer history.'
			}
		],
		changed: [
			{
				text: 'Removed Arcane Assistant.'
			},
			{
				text: 'Native controls across forms, actions, and modal sheets.'
			},
			{
				text: 'Arcane wordmark and Activity Center access in sidebar navigation.'
			},
			{
				text: 'Dashboard uses a flat layout with compact environment rows, smooth well-spaced gauges, grouped sections, and separate prune controls.'
			},
			{
				text: 'Dashboard is the destination for all environments.'
			},
			{
				text: 'Sidebar navigation, resource details, and page actions match Arcane’s consolidated layout.'
			},
			{
				text: 'Project services and logs share one workspace.'
			}
		],
		fixed: [
			{
				text: 'Home Screen widgets retain data after the device locks.'
			},
			{
				text: 'Activity notifications appear for remote environment updates.'
			},
			{
				text: 'Dashboard environments load independently with accurate update and vulnerability counts.'
			},
			{
				text: 'Detail content stays clear of the floating tab bar.'
			},
			{
				text: 'Tab bar Settings hides pinned pages and opens every available destination.'
			},
			{
				text: 'Page tab bars scroll without truncating labels.'
			},
			{
				text: 'Sidebar buttons and switches respond reliably.'
			},
			{
				text: 'Project compose and custom files open on current Arcane servers.'
			}
		]
	},
	{
		version: '0.6.1',
		new: [
			{
				text: 'Resource section headers show loaded and total item counts.'
			}
		],
		changed: [
			{
				text: 'OIDC role mappings and Git repositories move behind management buttons in Roles and GitOps.'
			}
		],
		fixed: [
			{
				text: 'Project and image operation logs match Docker output, wrap cleanly, and reconnect reliably.'
			},
			{
				text: 'Image uploads report the server result correctly.'
			},
			{
				text: 'Reliable OIDC sign-in when identity providers repeat callbacks.'
			},
			{
				text: 'Resource lists and pickers load every available item.'
			},
			{
				text: 'Hardened sessions, widgets, remote images, and server-provided data.'
			}
		]
	},
	{
		version: '0.6.0',
		new: [
			{
				text: 'Global variable management with secret and environment scoping.'
			},
			{
				text: 'Configurable activity start toasts for user or system activity.'
			}
		],
		changed: [
			{
				text: 'Floating profile and App Settings buttons in sidebar navigation.'
			},
			{
				text: 'Activities is accessed from the dashboard instead of navigation menus.'
			},
			{
				text: 'Grouped Activity Center summaries for related operations.'
			},
			{
				text: 'Event severity summaries, server-side filters, and permission-aware deletion.'
			},
			{
				text: 'Template search, source filtering, metadata, and remote downloads.'
			},
			{
				text: 'Navigation visibility based on server-provided permissions.'
			},
			{
				text: 'Updates opens directly to environment update cards.'
			},
			{
				text: 'Activity progress toasts open the app-wide Activity Center sheet when tapped.'
			},
			{
				text: 'Widgets use solid black system-style backgrounds.'
			},
			{
				text: 'Dashboard overview identifies counts across all enabled environments.'
			},
			{
				text: 'Batched log line streaming and unanimated terminal scrolling.'
			},
			{
				text: 'Cached Activity Center grouping for smoother list rendering.'
			},
			{
				text: 'Debounced search filtering across resource lists.'
			},
			{
				text: 'Hero zoom navigation transitions for resource cards and details.'
			},
			{
				text: 'Rich context menus and swipe actions for jobs, variables, events, and updates.'
			},
			{
				text: 'Long-press preview cards render custom container and project icons.'
			},
			{
				text: 'Navigation toolbar actions render as separate buttons.'
			}
		],
		fixed: [
			{
				text: 'Network topology renders as an interactive network-to-container diagram.'
			},
			{
				text: 'Multiple dashboard performance and reliability improvements.'
			},
			{
				text: 'System prune reports background activity progress correctly.'
			},
			{
				text: 'Bottom overlays sit at the safe-area edge in sidebar navigation.'
			},
			{
				text: 'Port mappings replace invalid host addresses with the wildcard address.'
			},
			{
				text: 'Activity toast selections stay aligned beside their setting.'
			},
			{
				text: 'Activity toasts use compact text with live progress.'
			},
			{
				text: 'Widgets use live Docker totals and online state across all enabled environments.'
			},
			{
				text: 'Toasts align with the bottom safe area inside sheets.'
			},
			{
				text: 'Image update actions support consumers resolved by name.'
			},
			{
				text: 'Widget refreshes keep environment work within the extension budget.'
			},
			{
				text: 'Delete confirmations avoid unnecessary app-wide overlay work.'
			},
			{
				text: 'Context menu previews safely retain app environment dependencies.'
			},
			{
				text: 'Container registry previews show current status and URL.'
			}
		]
	},
	{
		version: '0.5.4',
		changed: [
			{
				text: 'Version details moved below the Danger Zone in App Settings.'
			},
			{
				text: 'Bounded terminal and event history during long-running sessions.'
			}
		],
		fixed: [
			{
				text: 'Assistant uses safe context limits.'
			},
			{
				text: 'Assistant stays hidden on unsupported devices.'
			},
			{
				text: 'Dashboard update counts stay in sync after image scans and tab changes.'
			},
			{
				text: 'Reliable live activity updates across environments.'
			},
			{
				text: 'Reliable sign-out when the server is unavailable.'
			},
			{
				text: 'Reliable log and statistics reconnection after reopening views.'
			},
			{
				text: 'Correct terminal output when text and control sequences span network frames.'
			},
			{
				text: 'Isolated cached data for servers that share a hostname.'
			}
		]
	},
	{
		version: '0.5.3',
		new: [
			{
				text: 'Optional sidebar navigation mode.'
			}
		]
	},
	{
		version: '0.5.2',
		new: [
			{
				text: 'Redesigned Updates page with one-tap and per-container updates.'
			},
			{
				text: 'Container updates show progress in the pill and Live Activities.'
			}
		],
		changed: [
			{
				text: 'Terminal-style redesign for the operation log.'
			}
		],
		fixed: [
			{
				text: 'Ports showing thousands separators (9,000 → 9000).'
			},
			{
				text: 'Needs Attention and the Updates tile counted updates differently.'
			}
		]
	},
	{
		version: '0.5.1',
		changed: [
			{
				text: 'Removed the incorrect Add Environment dialog from the dashboard.'
			}
		]
	},
	{
		version: '0.5.0',
		new: [
			{
				text: 'Update All is now available from the dashboard.'
			}
		],
		changed: [
			{
				text: 'Bulk actions for containers, images, and volumes.'
			},
			{
				text: 'Logs now support timestamps, copy, share, and clear.'
			},
			{
				text: 'Volume browsing now has breadcrumbs and path jumping.'
			},
			{
				text: 'Events now update live with a pause control.'
			},
			{
				text: 'Pinned containers and projects now show on the dashboard.'
			}
		],
		fixed: [
			{
				text: 'Dashboard pull-to-refresh now reconnects live streams and refreshes data.'
			}
		]
	},
	{
		version: '0.4.1',
		new: [
			{
				text: 'Live Activities: deploys, redeploys, pulls, and builds now show live progress in the Dynamic Island and on the Lock Screen when you leave the app.'
			},
			{
				text: 'A floating progress pill tracks the running operation inside the app — tap it any time to reopen the full log.'
			},
			{
				text: 'Deployments are now synced with the server: if the connection drops mid-operation, the app re-attaches and picks up where the server is, and Cancel stops the operation server-side too. (Arcane v2 servers)'
			},
			{
				text: 'Pulling an image from the Images tab now shows real download progress with the same pill and Live Activity treatment.'
			},
			{
				text: 'One-tap setup for the Arcane Community Templates registry.'
			},
			{
				text: 'Your profile picture now syncs from the server — custom avatars and Gravatar (when enabled) — on the Account page and in Settings.'
			}
		],
		changed: [
			{
				text: 'The deploy log sheet can now be swiped away mid-run — the operation keeps going behind the progress pill instead of locking you in.'
			},
			{
				text: 'Sign out moved to the Account page, with a combined Sign Out / Sign Out & Change Server menu.'
			},
			{
				text: 'Clear Cache moved to a Danger Zone at the bottom of App Settings.'
			},
			{
				text: 'The templates button on Projects now opens the template browser directly; registry management moved behind its Settings button.'
			},
			{
				text: "Profile name and email are now read-only for SSO accounts — they're managed by your identity provider."
			},
			{
				text: 'The project Files section now pins only the compose file, .env, and compose override files, with a Browse Files row for everything else — so you can always add new files even when custom files exist.'
			},
			{
				text: 'The project file browser now works more like the Files app: a + button for new files and folders, one flat file list, and folder item counts and file sizes on each row.'
			}
		],
		fixed: [
			{
				text: 'A deployment that failed on the server no longer shows as complete just because the progress stream ended cleanly — the outcome is now confirmed against the server.'
			},
			{
				text: "Fixed getting signed out when launching the app after an update — a widget refresh could invalidate the app's session at the worst moment."
			}
		]
	},
	{
		version: '0.4.0',
		new: [
			{
				text: 'Home and Lock Screen widgets: Status (configurable, with refresh button), Environments, and Updates & Vulnerabilities.'
			},
			{
				text: 'Siri & Shortcuts: open tabs, containers, and projects; restart containers; start/stop projects (with confirmation).'
			},
			{
				text: 'Environment cards show live CPU and memory sparklines with a rolling minute of history.'
			},
			{
				text: 'New Needs Attention card on the dashboard — offline environments, vulnerabilities, stopped containers, updates, expiring keys, and failed activities in one place.'
			},
			{
				text: 'Vulnerability summaries use a proportional severity bar instead of plain numbers.'
			},
			{
				text: 'New Account page in Settings: edit your display name and email, and change your password.'
			}
		],
		changed: [
			{
				text: 'Tapping the current tab again returns to its root page, like the native tab bar.'
			},
			{
				text: "System Prune options start from your server's configured prune defaults."
			},
			{
				text: 'Updater actions now live in the floating tab bar instead of a separate button row.'
			},
			{
				text: 'Environment card stats survive scrolling and use fewer connections.'
			},
			{
				text: "Container Stats matches the app's card styling and loads with skeletons."
			},
			{
				text: 'Empty screens now explain themselves and offer a create action.'
			},
			{
				text: 'Slimmer accent color picker.'
			},
			{
				text: 'Smarter caching: fewer refetches on tab switches, and the disk cache cleans itself up.'
			}
		],
		fixed: [
			{
				text: 'Log tailing no longer drops frames on busy containers.'
			},
			{
				text: 'Container Stats uses much less CPU and battery.'
			},
			{
				text: 'Slow DNS no longer freezes the UI during server setup.'
			},
			{
				text: 'Signing in no longer interrupts live dashboard streams.'
			},
			{
				text: 'Icons load in parallel again in long lists.'
			},
			{
				text: 'Inspect view search no longer lags on large containers.'
			},
			{
				text: 'Confirmation dialog buttons no longer balloon with long titles.'
			},
			{
				text: "Delete dialogs opened from a detail page's bottom bar render full-width instead of squeezed."
			},
			{
				text: 'Signing in to a URL that serves a webpage (proxy portal, wrong port) now explains the problem instead of showing a raw JSON error.'
			},
			{
				text: 'Destructive menu actions now show a red icon to match their red text.'
			},
			{
				text: "Cleaned up overlapping buttons in the log viewer's top bar."
			}
		]
	},
	{
		version: '0.3.2',
		changed: [
			{
				text: 'Cleaned up alot of areas of the UI to more consistient with native iOS styling'
			}
		]
	},
	{
		version: '0.3.1',
		new: [
			{
				text: 'Add New Application Icon Variants'
			},
			{
				text: 'Browse and edit custom project files from project details with a Files-style browser.'
			}
		],
		fixed: [
			{
				text: 'Delete confirmation dialogs now stay clear of the floating bottom bar so action buttons remain tappable.'
			},
			{
				text: 'Activity Center live updates now reconnect after transient stream drops instead of immediately showing a paused warning.'
			}
		]
	},
	{
		version: '0.3.0',
		new: [
			{
				text: 'App Now Supports iOS 18 and up.'
			},
			{
				text: 'Custom Navbar that morphs into resource controls in detail views.'
			},
			{
				text: 'New Uniform Delete confirmation dialog for all actions.'
			},
			{
				text: 'New Toasts for notifying you of completed or failed actions.'
			},
			{
				text: 'Alpha version of Arcane Assistant for helping troubleshoot containers and more.'
			}
		],
		changed: [
			{
				text: 'Redesigned List View Rows to better visual appearance.'
			},
			{
				text: 'Remove the Builds tab from resources since builds are not in the application yet.'
			},
			{
				text: 'Redesigned the Image Details view with less clutter and proper update status display.'
			},
			{
				text: 'Container Health Status displays in the list view.'
			},
			{
				text: 'Overhaul of the project details page.'
			},
			{
				text: 'Redesigned Navbar Tab Switcher on iOS 26.'
			}
		],
		fixed: [
			{
				text: 'Fixed the issue with the iOS Keychain signing users out even when refresh tokens exist.'
			}
		]
	},
	{
		version: '0.2.2',
		new: [
			{
				text: 'Activity Center for Arcane 2.0 shows live and recent work across all environments.'
			},
			{
				text: 'Dashboard now has an Activity Center toolbar button and highlights recent failures.'
			},
			{
				text: "System prune controls now use Arcane's granular prune modes."
			}
		],
		changed: [
			{
				text: 'Updated Status badge design.'
			},
			{
				text: 'Server switching moved into App Settings.'
			},
			{
				text: 'Application version details moved out of About.'
			},
			{
				text: 'Dashboard totals now include polling and standby environments.'
			},
			{
				text: 'RBAC-capable servers now use role pickers in user forms.'
			},
			{
				text: 'Forms now use clearer labels, examples, helper text, and picker controls.'
			},
			{
				text: 'App Settings now separates About links from support actions.'
			}
		],
		fixed: [
			{
				text: 'Updated libarcane-swift to decode null JSON object values correctly.'
			},
			{
				text: 'App Settings cache size now reports persistent disk cache only.'
			},
			{
				text: 'Dashboard keeps the selected environment at the top of the Environments list.'
			},
			{
				text: 'Dashboard resource gauges now show live stats connection errors.'
			},
			{
				text: 'Real devices now handle local-network Arcane server connections more reliably.'
			}
		]
	},
	{
		version: '0.2.1',
		changed: [
			{
				text: 'Server addresses entered without http:// or https:// now default to https://, and the login screen reminds you to include http:// when connecting to a local server.'
			}
		],
		fixed: [
			{
				text: 'You can now sign in to a local, HTTP-only Arcane server on your network — for example http://192.168.1.50:3000. iOS was silently blocking these plain-HTTP connections, so login failed with a generic connection error.'
			},
			{
				text: "Connection problems on the login screen now explain what actually went wrong — can't reach the server, server not found, timed out, or a secure-connection issue — instead of showing a raw system message."
			},
			{
				text: "The Dashboard's Containers and Images tiles showed '—' instead of counts on Arcane 2.0 servers. They now read live per-environment data — the same source the environment cards use — so they populate regardless of server version, and a genuine zero shows as '0' instead of a dash."
			}
		]
	},
	{
		version: '0.2.0',
		new: [
			{
				text: 'First Public Testflight Release!'
			}
		]
	},
	{
		version: '0.1.9',
		changed: [
			{
				text: 'Searching and filtering large resource lists (Containers, Images, Networks, Projects, Volumes) is snappier — results are now computed once when you stop typing or change the sort or filter, instead of re-sorting on every keystroke.'
			},
			{
				text: 'The dashboard now appears as soon as your environment cards are ready instead of waiting on the cross-environment Volumes and Updates totals, which fill in their tiles a moment later.'
			},
			{
				text: 'Resource icons stop loading the moment you scroll past them, so fast scrolling through long lists uses less CPU and data.'
			},
			{
				text: 'Loading skeletons now use a single synchronized shimmer that stays contained to each placeholder — no glow bleed onto neighboring content — and honor the system Reduce Motion setting.'
			},
			{
				text: 'Swarm management is temporarily a placeholder while the screen is reworked. The tab stays in the navigation; the cluster, services, and nodes screens will return in a future update.'
			}
		]
	},
	{
		version: '0.1.8',
		fixed: [
			{
				text: 'Project compose files and env file do not show up when requested.'
			}
		]
	},
	{
		version: '0.1.7',
		new: [
			{
				text: 'New Roles screen for Arcane 2.0 servers: browse built-in roles, create and edit custom roles, and pick permissions from a searchable, grouped picker. Pinnable as a bottom tab or reachable from Settings → Administration.'
			},
			{
				text: 'New OIDC Role Mappings screen for Arcane 2.0 servers: map an SSO claim value to a role and an optional environment scope. Mappings declared via the OIDC_ROLE_MAPPINGS env var are shown read-only with a lock badge.'
			},
			{
				text: "New Edit Role Assignments screen on every user's detail page (Arcane 2.0 servers): see a user's assignments grouped by scope (Global, then per-environment), add new assignments with a role + scope picker, swipe to remove manual assignments. OIDC-sourced assignments are shown but can't be changed from the app."
			},
			{
				text: 'Tabs that only make sense on Arcane 2.0 (Roles, OIDC Role Mappings) are automatically hidden when you connect to an older server, and reappear when you connect to a 2.0 one.'
			}
		],
		changed: [
			{
				text: "Updated to work with Arcane 2.0's new role-based access control while still supporting older servers transparently. Existing admin users keep admin access after the server upgrade (Arcane 2.0 backfills them into the built-in Admin role)."
			},
			{
				text: "Creating or editing a user on Arcane 2.0 servers now manages the admin role through the new role-assignment endpoint behind the scenes. The Administrator toggle still works the same way; for finer control, use the new Edit Role Assignments screen on the user's detail page."
			}
		],
		fixed: [
			{
				text: 'Permission picker now expands one resource group at a time instead of opening every group together.'
			},
			{
				text: 'Permission picker search field is now the standard iOS search bar at the top of the screen instead of a custom field inside the form.'
			}
		]
	},
	{
		version: '0.1.6',
		changed: [
			{
				text: 'Removed the Apprise section from Notifications. Apprise support has been dropped in Arcane 2.0.'
			},
			{
				text: 'Admin badge in the Users list is now a solid indigo capsule with white text — better contrast and a less alarming color than the previous orange-on-orange.'
			},
			{
				text: 'Tapping a row in any resource list (Containers, Images, Networks, Volumes, Projects) — or an environment card on the Dashboard — now zooms into the detail view instead of pushing flat from the right.'
			},
			{
				text: "Resource lists now show shimmering skeleton rows on first load instead of a centered 'Loading…' spinner, and the Dashboard's first-load skeleton has the same subtle shimmer."
			},
			{
				text: "Paginated lists (Images, Networks, Volumes, Projects) auto-load the next page as you scroll, with a skeleton row in place while the next page fetches, instead of requiring you to tap 'Load More'."
			},
			{
				text: 'Search results in long lists settle 200 ms after you stop typing instead of re-filtering on every keystroke.'
			},
			{
				text: 'Resource lists animate row reflow when you change the sort order or apply a filter.'
			},
			{
				text: 'Empty states for all five resource lists now offer a primary action — Create for Networks/Volumes/Projects, Pull Image for Images, Refresh for Containers — instead of a dead end.'
			},
			{
				text: 'Container detail tabs (Overview, Stats, Logs) slide between sections instead of snapping.'
			},
			{
				text: "The status dot on a running container's detail screen pulses subtly so it's clear the container is live."
			},
			{
				text: 'Start, Stop, Restart, and Redeploy buttons cross-fade smoothly into the in-flight spinner while an action runs.'
			},
			{
				text: 'Dashboard counts and the CPU/Memory/Disk gauges on environment cards now roll between values instead of popping.'
			},
			{
				text: "Dashboard, Container, Project, and Environment detail screens now use iOS 26's soft scroll-edge effect so the toolbar fades naturally into the scrolling content."
			},
			{
				text: "Logs view: the Live/Paused button icon morphs between states, pausing shows a floating 'N new' pill at the bottom that resumes live tailing and jumps to the latest line, and new log lines fade in gently instead of popping."
			},
			{
				text: 'The Arcane logo on the login screen bounces in with a spring on appear instead of just popping into place.'
			},
			{
				text: 'Tab swap hint banner fades out smoothly when dismissed or when you discover the long-press feature, instead of popping.'
			},
			{
				text: 'Dashboard tiles and mini-metric cards now read out as a single VoiceOver element with the metric name and value combined, instead of as a stack of separate icons and numbers.'
			},
			{
				text: 'Action toolbar button labels now scale with the system Text Size setting.'
			},
			{
				text: 'All new motion respects the system Reduce Motion accessibility setting.'
			}
		]
	},
	{
		version: '0.1.5',
		new: [
			{
				text: "Redesigned login screen with a refined hero, glass-effect form card, and a persistent 'Try the demo' card that's always available — no need to wipe your server config to spin up a demo."
			}
		],
		changed: [
			{
				text: 'Login screen and demo banner now use your selected accent color from Settings.'
			},
			{
				text: 'Starting a demo now hides the rest of the login form so the spinner is the focus.'
			},
			{
				text: 'Removed the redundant Cancel button from the Change Server flow.'
			},
			{
				text: "Removed the 'Welcome back' subtitle on the login screen for a cleaner hero."
			}
		],
		fixed: [
			{
				text: "'End' button in the demo banner now sends you back to the login screen immediately instead of waiting on background cleanup."
			},
			{
				text: 'Server URL, Username, and Password placeholders no longer pick up URL-style link coloring.'
			},
			{
				text: "'End' button color now matches your selected accent color instead of the system default."
			},
			{
				text: 'Appearance settings swatch selection is now derived from the stored accent color, so the checkmark always matches the actual color the app is using.'
			},
			{
				text: 'Tab bar labels for long titles (Container Registries, Template Registries, Git Repositories, System Settings, Authentication) now use compact names so they no longer wrap or clip.'
			}
		]
	},
	{
		version: '0.1.4',
		fixed: [
			{
				text: 'Fix an issue where the ImageList logic was not parsed correctly'
			}
		]
	},
	{
		version: '0.1.3',
		new: [
			{
				text: "New cross-environment Updates screen: per-environment summary cards with totals, per-image update rows, and a 'Recheck all images' action for each environment."
			}
		],
		changed: [
			{
				text: 'Refactored the app to use the shared Arcane Swift SDK directly for API models and services, improving consistency with the backend.'
			}
		]
	},
	{
		version: '0.1.2',
		new: [
			{
				text: 'Dashboard now shows an Updates tile with the total count of pending image updates across all environments. Tap to jump into the Updates tab.'
			},
			{
				text: 'New floating Liquid Glass action bar on Project, Container, Environment, and Updates detail screens — primary actions (Stop, Restart, Redeploy, etc.) live in circular glass buttons above the tab bar.'
			}
		],
		changed: [
			{
				text: 'Dashboard now loads environment cards lazily as you scroll and shows at most 50 environments at a time, with a link to view the full list.'
			},
			{
				text: 'Replaced the Environments overview tile with the new Updates tile — the per-environment cards below already convey online/total counts.'
			},
			{
				text: 'Container detail tabs are now Overview, Stats, and Logs (replacing the Inspect tab). Inspect moved to a toolbar button; Terminal also lives in the toolbar when the container is running.'
			}
		],
		fixed: [
			{
				text: 'Error messages now show human-readable text instead of raw API responses or schema URLs'
			},
			{
				text: 'Error banners wrap to multiple lines so long messages are fully readable'
			},
			{
				text: 'Validation errors point to the specific field that needs attention'
			},
			{
				text: 'Fixed a security issue where a malicious or compromised server could degrade or crash the app by returning an excessive number of environments.'
			},
			{
				text: 'Fixed a security issue where a malicious or compromised server could crash the app at launch by returning duplicate keys in the public OIDC settings response.'
			}
		]
	},
	{
		version: '0.1.1',
		new: [
			{
				text: 'Redesigned dashboard with per-environment summary cards showing live CPU, memory, disk, and container/image counts'
			},
			{
				text: 'Long-press an environment card to set it as the active context or jump into system details'
			},
			{
				text: 'Volume totals now aggregate across all environments on the dashboard'
			},
			{
				text: 'Skeleton loading state on first dashboard load'
			}
		],
		changed: [
			{
				text: 'Overall Design fixes between iOS 18 and iOS 26'
			}
		],
		fixed: [
			{
				text: 'Fixed a security issue where crafted icon URLs could leak authentication headers to external servers.'
			}
		]
	},
	{
		version: '0.1.0',
		new: [
			{
				text: 'Initial Arcane Mobile Beta release'
			},
			{
				text: 'Customizable bottom tab bar — long-press any tab to swap'
			},
			{
				text: 'Pin containers, projects, and resources to keep them at the top'
			},
			{
				text: 'Archived projects collapse into their own section'
			},
			{
				text: 'Redesigned Updater Status and Updater History screens'
			},
			{
				text: 'Redesigned Events list with severity filtering'
			},
			{
				text: 'Ports grouped by container'
			},
			{
				text: 'Show More pagination on Events and Updater History'
			},
			{
				text: 'Reset to defaults from the tab customization sheet'
			}
		],
		changed: [
			{
				text: 'Reorganized navigation to match the web app (Management / Resources / Swarm / Administration)'
			},
			{
				text: 'Tab customization sheet now uses a tile grid and opens to full height'
			},
			{
				text: 'Smoother scrolling on the dashboard, container stats, and tab picker'
			},
			{
				text: 'Removed OIDC sign-in from the login screen'
			},
			{
				text: 'Removed Build Workspace (build settings still available to admins)'
			}
		],
		fixed: [
			{
				text: 'Container and project icons no longer crop wider artwork'
			},
			{
				text: 'Events sort newest-first'
			},
			{
				text: 'GitOps icon now renders'
			},
			{
				text: 'Reduced memory use on long image lists'
			}
		]
	}
];

export const releaseNoteCategories = [
	{ key: 'new', title: 'New', systemImage: 'sparkles', tint: 'mint' },
	{ key: 'changed', title: 'Changed', systemImage: 'paintbrush.fill', tint: 'blue' },
	{ key: 'removed', title: 'Removed', systemImage: 'minus.circle.fill', tint: 'gray' },
	{ key: 'fixed', title: 'Fixed', systemImage: 'ladybug.fill', tint: 'red' }
] as const;
