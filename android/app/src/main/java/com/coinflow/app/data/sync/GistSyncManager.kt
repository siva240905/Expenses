package com.coinflow.app.data.sync

import android.content.Context
import com.coinflow.app.data.local.AppDatabase
import com.coinflow.app.data.local.TransactionEntity
import com.coinflow.app.data.model.*
import com.coinflow.app.data.remote.GistApiService
import com.coinflow.app.data.security.SecureStorageManager
import com.google.gson.Gson
import com.google.gson.JsonObject
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.text.SimpleDateFormat
import java.util.*

class GistSyncManager(private val context: Context) {

    private val secureStorage = SecureStorageManager(context)
    private val gson = Gson()

    private val gistApiService: GistApiService by lazy {
        val client = OkHttpClient.Builder().build()
        Retrofit.Builder()
            .baseUrl("https://api.github.com/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(GistApiService::class.java)
    }

    suspend fun performSync(): Pair<Boolean, String> = withContext(Dispatchers.IO) {
        val token = secureStorage.getGithubToken()
        if (token.isBlank()) {
            return@withContext Pair(false, "No GitHub token configured")
        }

        val authHeader = if (token.startsWith("token ") || token.startsWith("Bearer ")) token else "token $token"
        val db = AppDatabase.getDatabase(context, kotlinx.coroutines.CoroutineScope(Dispatchers.IO))
        val dao = db.transactionDao()

        try {
            val localEntities = dao.getAllRawTransactions()
            val localTxns = localEntities.map { it.toDomain() }
            val localCategories = dao.getAllCategories().map {
                Category(it.id, it.name, it.type, it.icon, it.color, it.isDefault)
            }

            var gistId = secureStorage.getGistId()
            var remotePayload: GistPayload? = null

            if (gistId.isNotBlank()) {
                val response = gistApiService.getGist(authHeader, gistId)
                if (response.isSuccessful && response.body() != null) {
                    val gistObj = response.body()!!
                    val filesObj = gistObj.getAsJsonObject("files")
                    val fileObj = filesObj?.getAsJsonObject("coin_flow_data.json")
                        ?: filesObj?.entrySet()?.firstOrNull()?.value?.asJsonObject

                    if (fileObj != null && fileObj.has("content")) {
                        val contentStr = fileObj.get("content").asString
                        remotePayload = gson.fromJson(contentStr, GistPayload::class.java)
                    }
                }
            }

            val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
                timeZone = TimeZone.getTimeZone("UTC")
            }.format(Date())

            if (remotePayload == null || gistId.isBlank()) {
                // Create new Gist
                val newPayload = GistPayload(
                    version = 1,
                    user = GistUserData("INR"),
                    transactions = localTxns,
                    categories = localCategories,
                    settings = UserSettings("INR", "dark", token, gistId, true, nowIso),
                    lastSyncedAt = nowIso
                )

                val fileContentObj = JsonObject().apply {
                    addProperty("content", gson.toJson(newPayload))
                }
                val filesObj = JsonObject().apply {
                    add("coin_flow_data.json", fileContentObj)
                }
                val requestObj = JsonObject().apply {
                    addProperty("description", "Coin Flow Personal Expense Data")
                    addProperty("public", false)
                    add("files", filesObj)
                }

                val createResponse = gistApiService.createGist(authHeader, requestObj)
                if (createResponse.isSuccessful && createResponse.body() != null) {
                    val newGistId = createResponse.body()!!.get("id").asString
                    secureStorage.saveGistId(newGistId)
                    secureStorage.saveLastSyncedAt(nowIso)
                    return@withContext Pair(true, "Created Gist $newGistId and synced ${localTxns.size} transactions.")
                } else {
                    return@withContext Pair(false, "Failed to create Gist: ${createResponse.code()}")
                }
            }

            // Bidirectional Merge
            val mergedMap = mutableMapOf<String, Transaction>()
            localTxns.forEach { mergedMap[it.id] = it }

            val remoteTxns = remotePayload.transactions
            remoteTxns.forEach { remoteTx ->
                val localTx = mergedMap[remoteTx.id]
                if (localTx == null) {
                    mergedMap[remoteTx.id] = remoteTx
                } else {
                    // Compare updatedAt
                    val localTime = parseIsoTime(localTx.updatedAt)
                    val remoteTime = parseIsoTime(remoteTx.updatedAt)
                    if (remoteTime > localTime) {
                        mergedMap[remoteTx.id] = remoteTx
                    }
                }
            }

            val mergedList = mergedMap.values.toList()

            // Construct merged payload
            val mergedPayload = GistPayload(
                version = 1,
                user = GistUserData("INR"),
                transactions = mergedList,
                categories = localCategories,
                settings = UserSettings("INR", "dark", token, gistId, true, nowIso),
                lastSyncedAt = nowIso
            )

            val fileContentObj = JsonObject().apply {
                addProperty("content", gson.toJson(mergedPayload))
            }
            val filesObj = JsonObject().apply {
                add("coin_flow_data.json", fileContentObj)
            }
            val updateObj = JsonObject().apply {
                add("files", filesObj)
            }

            val updateResponse = gistApiService.updateGist(authHeader, gistId, updateObj)
            if (updateResponse.isSuccessful) {
                // Update local Room database
                val entitiesToSave = mergedList.map { TransactionEntity.fromDomain(it).copy(pendingSync = false) }
                dao.insertTransactions(entitiesToSave)
                secureStorage.saveLastSyncedAt(nowIso)
                return@withContext Pair(true, "Synced ${mergedList.size} transactions cleanly with Gist.")
            } else {
                return@withContext Pair(false, "Gist update failed: ${updateResponse.code()}")
            }
        } catch (e: Exception) {
            return@withContext Pair(false, e.message ?: "Sync failed")
        }
    }

    private fun parseIsoTime(iso: String): Long {
        return try {
            val format = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
            format.parse(iso)?.time ?: 0L
        } catch (e: Exception) {
            0L
        }
    }
}
