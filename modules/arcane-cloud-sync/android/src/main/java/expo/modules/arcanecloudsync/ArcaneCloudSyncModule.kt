package expo.modules.arcanecloudsync

import android.content.Context
import androidx.credentials.CreatePasswordRequest
import androidx.credentials.CredentialManager
import androidx.credentials.GetCredentialRequest
import androidx.credentials.GetPasswordOption
import androidx.credentials.PasswordCredential
import androidx.credentials.exceptions.CreateCredentialCancellationException
import androidx.credentials.exceptions.CreateCredentialException
import androidx.credentials.exceptions.CreateCredentialNoCreateOptionException
import androidx.credentials.exceptions.CreateCredentialProviderConfigurationException
import androidx.credentials.exceptions.CreateCredentialUnsupportedException
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.GetCredentialProviderConfigurationException
import androidx.credentials.exceptions.GetCredentialUnsupportedException
import androidx.credentials.exceptions.NoCredentialException
import com.google.android.gms.auth.blockstore.Blockstore
import com.google.android.gms.auth.blockstore.BlockstoreClient
import com.google.android.gms.auth.blockstore.DeleteBytesRequest
import com.google.android.gms.auth.blockstore.RetrieveBytesRequest
import com.google.android.gms.auth.blockstore.StoreBytesData
import com.google.android.gms.common.ConnectionResult
import com.google.android.gms.common.GoogleApiAvailability
import com.google.android.gms.tasks.Task
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.security.MessageDigest
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import org.json.JSONObject

private class BlockStoreUnavailableException :
  CodedException("ERR_UNAVAILABLE", "Block Store is unavailable", null)

private class TooLargeException(size: Int) :
  CodedException("ERR_TOO_LARGE", "Item is $size bytes; Block Store allows ${BlockstoreClient.MAX_SIZE}", null)

class ArcaneCloudSyncModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val blockStore: BlockstoreClient
    get() {
      if (!isPlayServicesAvailable()) throw BlockStoreUnavailableException()
      return Blockstore.getClient(context)
    }

  override fun definition() = ModuleDefinition {
    Name("ArcaneCloudSync")

    AsyncFunction("getStatus") Coroutine { ->
      if (!isPlayServicesAvailable()) {
        return@Coroutine mapOf("available" to false, "cloudBackup" to false)
      }
      val client = Blockstore.getClient(context)
      val cloudBackup = runCatching { client.isEndToEndEncryptionAvailable.await() }.getOrDefault(false)
      mapOf("available" to true, "cloudBackup" to cloudBackup)
    }

    AsyncFunction("getItem") Coroutine { service: String, account: String, _: String? ->
      val key = keyFor(service, account)
      val request = RetrieveBytesRequest.Builder().setKeys(listOf(key)).build()
      val data = blockStore.retrieveBytes(request).await().blockstoreDataMap[key]
      data?.let { decode(it.bytes) }?.takeIf { it.service == service && it.account == account }?.value
    }

    AsyncFunction("setItem") Coroutine { service: String, account: String, value: String, _: String?, _: String? ->
      val bytes = JSONObject()
        .put("s", service)
        .put("a", account)
        .put("v", value)
        .toString()
        .toByteArray(Charsets.UTF_8)
      if (bytes.size > BlockstoreClient.MAX_SIZE) throw TooLargeException(bytes.size)
      val data = StoreBytesData.Builder()
        .setKey(keyFor(service, account))
        .setBytes(bytes)
        .setShouldBackupToCloud(true)
        .build()
      blockStore.storeBytes(data).await()
      Unit
    }

    AsyncFunction("deleteItem") Coroutine { service: String, account: String, _: String? ->
      val request = DeleteBytesRequest.Builder().setKeys(listOf(keyFor(service, account))).build()
      blockStore.deleteBytes(request).await()
      Unit
    }

    AsyncFunction("getAllItems") Coroutine { service: String, _: String? ->
      allItems(service).associate { it.account to it.value }
    }

    AsyncFunction("listAccounts") Coroutine { service: String, _: String? ->
      allItems(service).map { it.account }
    }

    AsyncFunction("savePassword") Coroutine { username: String, password: String ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      try {
        withContext(Dispatchers.Main) {
          CredentialManager.create(activity).createCredential(activity, CreatePasswordRequest(username, password))
        }
        true
      } catch (error: CreateCredentialException) {
        when (error) {
          is CreateCredentialCancellationException,
          is CreateCredentialNoCreateOptionException,
          is CreateCredentialProviderConfigurationException,
          is CreateCredentialUnsupportedException -> false
          else -> throw CodedException("ERR_SAVE_PASSWORD", error.message ?: error.type, error)
        }
      }
    }

    AsyncFunction("getPassword") Coroutine { ->
      val activity = appContext.currentActivity ?: throw Exceptions.MissingActivity()
      try {
        val response = withContext(Dispatchers.Main) {
          CredentialManager.create(activity).getCredential(activity, GetCredentialRequest(listOf(GetPasswordOption())))
        }
        (response.credential as? PasswordCredential)?.let { mapOf("username" to it.id, "password" to it.password) }
      } catch (error: GetCredentialException) {
        when (error) {
          is GetCredentialCancellationException,
          is NoCredentialException,
          is GetCredentialProviderConfigurationException,
          is GetCredentialUnsupportedException -> null
          else -> throw CodedException("ERR_GET_PASSWORD", error.message ?: error.type, error)
        }
      }
    }
  }

  private data class Item(val service: String, val account: String, val value: String)

  private fun isPlayServicesAvailable(): Boolean =
    GoogleApiAvailability.getInstance().isGooglePlayServicesAvailable(context) == ConnectionResult.SUCCESS

  private suspend fun allItems(service: String): List<Item> {
    val request = RetrieveBytesRequest.Builder().setRetrieveAll(true).build()
    return blockStore.retrieveBytes(request).await().blockstoreDataMap.values
      .mapNotNull { decode(it.bytes) }
      .filter { it.service == service }
  }

  private fun decode(bytes: ByteArray): Item? = runCatching {
    val json = JSONObject(String(bytes, Charsets.UTF_8))
    Item(json.getString("s"), json.getString("a"), json.getString("v"))
  }.getOrNull()

  private fun keyFor(service: String, account: String): String {
    val digest = MessageDigest.getInstance("SHA-256").digest("$service\u0000$account".toByteArray(Charsets.UTF_8))
    return "arcane_" + digest.take(16).joinToString("") { "%02x".format(it) }
  }
}

private suspend fun <T> Task<T>.await(): T = suspendCancellableCoroutine { continuation ->
  addOnSuccessListener { continuation.resume(it) }
  addOnFailureListener { continuation.resumeWithException(it) }
  addOnCanceledListener { continuation.cancel() }
}
