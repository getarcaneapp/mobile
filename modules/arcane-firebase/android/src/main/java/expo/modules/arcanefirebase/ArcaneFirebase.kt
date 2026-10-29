package expo.modules.arcanefirebase

import android.content.Context
import android.content.Intent
import android.os.Handler
import android.os.Looper
import android.os.Process
import com.google.android.gms.tasks.Task
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.suspendCancellableCoroutine

data class ArcaneFirebaseOptions(
  val projectId: String,
  val applicationId: String,
  val apiKey: String,
  val senderId: String
) {
  fun isComplete() =
    projectId.isNotBlank() && applicationId.isNotBlank() && apiKey.isNotBlank() && senderId.isNotBlank()

  fun toMap() = mapOf(
    "projectId" to projectId,
    "applicationId" to applicationId,
    "apiKey" to apiKey,
    "senderId" to senderId
  )

  fun toFirebaseOptions(): FirebaseOptions =
    FirebaseOptions.Builder()
      .setProjectId(projectId)
      .setApplicationId(applicationId)
      .setApiKey(apiKey)
      .setGcmSenderId(senderId)
      .build()
}

object ArcaneFirebase {
  private const val PREFERENCES = "arcane_firebase"
  private const val PROJECT_ID = "projectId"
  private const val APPLICATION_ID = "applicationId"
  private const val API_KEY = "apiKey"
  private const val SENDER_ID = "senderId"

  fun read(context: Context): ArcaneFirebaseOptions? {
    val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)
    val options = ArcaneFirebaseOptions(
      preferences.getString(PROJECT_ID, null).orEmpty(),
      preferences.getString(APPLICATION_ID, null).orEmpty(),
      preferences.getString(API_KEY, null).orEmpty(),
      preferences.getString(SENDER_ID, null).orEmpty()
    )
    return options.takeIf { it.isComplete() }
  }

  private fun write(context: Context, options: ArcaneFirebaseOptions?) {
    val editor = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE).edit()
    if (options == null) {
      editor.clear()
    } else {
      editor
        .putString(PROJECT_ID, options.projectId)
        .putString(APPLICATION_ID, options.applicationId)
        .putString(API_KEY, options.apiKey)
        .putString(SENDER_ID, options.senderId)
    }
    editor.commit()
  }

  fun isInitialized(context: Context): Boolean =
    FirebaseApp.getApps(context).any { it.name == FirebaseApp.DEFAULT_APP_NAME }

  fun initialize(context: Context): Boolean {
    if (isInitialized(context)) return true
    val options = read(context) ?: return false
    return runCatching { FirebaseApp.initializeApp(context, options.toFirebaseOptions()) }.isSuccess
  }

  suspend fun apply(context: Context, options: ArcaneFirebaseOptions?): String {
    val running = isInitialized(context)
    if (running && read(context) == options) return "applied"
    if (running) runCatching { FirebaseMessaging.getInstance().deleteToken().await() }
    write(context, options)
    if (running) return "restart"
    return if (initialize(context)) "applied" else "failed"
  }

  fun restart(context: Context) {
    val intent = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
    context.startActivity(intent)
    Handler(Looper.getMainLooper()).postDelayed({ Process.killProcess(Process.myPid()) }, 300)
  }
}

suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
  addOnSuccessListener { continuation.resume(it) }
  addOnFailureListener { continuation.resumeWithException(it) }
  addOnCanceledListener { continuation.cancel() }
}
