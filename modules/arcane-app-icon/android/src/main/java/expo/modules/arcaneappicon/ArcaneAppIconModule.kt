package expo.modules.arcaneappicon

import android.content.ComponentName
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.os.Build
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ArcaneAppIconModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ArcaneAppIcon")

    Constant("alternateIconNames") {
      runCatching { aliases().mapNotNull { iconName(it) }.sorted() }.getOrDefault(emptyList())
    }

    AsyncFunction("getSupportsAlternateIcons") {
      aliases().isNotEmpty()
    }

    AsyncFunction("getAlternateIconName") {
      aliases().firstOrNull { isEnabled(it) }?.let { iconName(it) }
    }

    AsyncFunction("setAlternateIconName") { name: String? ->
      val all = aliases()
      val target = all.firstOrNull { iconName(it) == name }
        ?: throw IconNotFoundException(name ?: PRIMARY)
      val pm = context.packageManager
      pm.setComponentEnabledSetting(
        ComponentName(context.packageName, target.name),
        PackageManager.COMPONENT_ENABLED_STATE_ENABLED,
        PackageManager.DONT_KILL_APP,
      )
      for (alias in all) {
        if (alias.name == target.name) continue
        pm.setComponentEnabledSetting(
          ComponentName(context.packageName, alias.name),
          PackageManager.COMPONENT_ENABLED_STATE_DISABLED,
          PackageManager.DONT_KILL_APP,
        )
      }
    }
  }

  @Suppress("DEPRECATION")
  private fun aliases(): List<ActivityInfo> {
    val pm = context.packageManager
    val flags = PackageManager.GET_ACTIVITIES or PackageManager.GET_META_DATA or PackageManager.MATCH_DISABLED_COMPONENTS
    val info = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      pm.getPackageInfo(context.packageName, PackageManager.PackageInfoFlags.of(flags.toLong()))
    } else {
      pm.getPackageInfo(context.packageName, flags)
    }
    return info.activities.orEmpty().filter { it.metaData?.getString(META_KEY) != null }
  }

  private fun iconName(alias: ActivityInfo): String? =
    alias.metaData?.getString(META_KEY)?.takeUnless { it == PRIMARY }

  private fun isEnabled(alias: ActivityInfo): Boolean =
    when (context.packageManager.getComponentEnabledSetting(ComponentName(context.packageName, alias.name))) {
      PackageManager.COMPONENT_ENABLED_STATE_ENABLED -> true
      PackageManager.COMPONENT_ENABLED_STATE_DEFAULT -> alias.enabled
      else -> false
    }

  private class IconNotFoundException(name: String) :
    CodedException("ERR_ICON_NOT_FOUND", "The icon \"$name\" isn't in this build.", null)

  companion object {
    private const val META_KEY = "app.getarcane.appIcon"
    private const val PRIMARY = "AppIcon"
  }
}
