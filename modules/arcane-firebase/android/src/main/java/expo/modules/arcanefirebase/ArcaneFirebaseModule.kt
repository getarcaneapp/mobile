package expo.modules.arcanefirebase

import android.content.Context
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ArcaneFirebaseModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  override fun definition() = ModuleDefinition {
    Name("ArcaneFirebase")

    Function("getOptions") { ->
      ArcaneFirebase.read(context)?.toMap()
    }

    Function("isInitialized") { ->
      ArcaneFirebase.isInitialized(context)
    }

    AsyncFunction("setOptions") Coroutine { projectId: String, applicationId: String, apiKey: String, senderId: String ->
      val options = ArcaneFirebaseOptions(projectId.trim(), applicationId.trim(), apiKey.trim(), senderId.trim())
      if (!options.isComplete()) throw CodedException("ERR_INCOMPLETE", "All four Firebase values are required", null)
      ArcaneFirebase.apply(context, options)
    }

    AsyncFunction("clearOptions") Coroutine { ->
      ArcaneFirebase.apply(context, null)
    }

    Function("restart") { ->
      ArcaneFirebase.restart(context)
    }
  }
}
