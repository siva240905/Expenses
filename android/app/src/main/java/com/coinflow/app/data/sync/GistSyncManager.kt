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
        val token = secureStorage.getGithubToken().trim()
        val configuredGistId = secureStorage.getGistId().trim()
        val gistId = if (configuredGistId.isBlank()) "4e9d3322f1da9f4a2ed6d79374937944" else configuredGistId

        val db = AppDatabase.getDatabase(context, kotlinx.coroutines.CoroutineScope(Dispatchers.IO))
        val dao = db.transactionDao()

        try {
            val localEntities = dao.getAllRawTransactions()
            val localTxns = localEntities.map { it.toDomain() }
            val localCategories = dao.getAllCategories().map {
                Category(it.id, it.name, it.type, it.icon, it.color, it.isDefault)
            }

            var remotePayload: GistPayload? = null
            var fetchedFromPublic = false

            if (gistId.isNotBlank()) {
                val authHeader = if (token.isNotBlank()) {
                    if (token.startsWith("token ") || token.startsWith("Bearer ")) token else "token $token"
                } else ""

                var response = if (authHeader.isNotBlank()) {
                    try { gistApiService.getGist(authHeader, gistId) } catch (e: Exception) { null }
                } else null

                // Fallback to unauthenticated GET for public Gists if token is blank or returned 401 Unauthorized
                if (response == null || !response.isSuccessful || response.code() == 401) {
                    try {
                        val publicResp = gistApiService.getPublicGist(gistId)
                        if (publicResp.isSuccessful && publicResp.body() != null) {
                            response = publicResp
                            fetchedFromPublic = true
                        }
                    } catch (e: Exception) {
                        // ignore public fallback error
                    }
                }

                if (response != null && response.isSuccessful && response.body() != null) {
                    val gistObj = response.body()!!
                    val filesObj = gistObj.getAsJsonObject("files")
                    val fileObj = filesObj?.getAsJsonObject("coin_flow_data.json")
                        ?: filesObj?.getAsJsonObject("data.json")
                        ?: filesObj?.getAsJsonObject("expenses.json")
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

            // Bidirectional Merge with remote payload if available
            val mergedMap = mutableMapOf<String, Transaction>()
            localTxns.forEach { mergedMap[it.id] = it }

            var remoteTxCount = 0
            if (remotePayload != null) {
                val remoteTxns = remotePayload.transactions
                remoteTxns.forEach { remoteTx ->
                    if (remoteTx.id.isNotBlank()) {
                        val localTx = mergedMap[remoteTx.id]
                        if (localTx == null) {
                            mergedMap[remoteTx.id] = remoteTx
                        } else {
                            val localTime = parseIsoTime(localTx.updatedAt)
                            val remoteTime = parseIsoTime(remoteTx.updatedAt)
                            if (remoteTime > localTime) {
                                mergedMap[remoteTx.id] = remoteTx
                            }
                        }
                    }
                }
                remoteTxCount = remoteTxns.count { !it.isDeleted }
            }

            val mergedList = mergedMap.values.toList()

            // Save merged list directly into local Room database so UI instantly populates
            if (mergedList.isNotEmpty()) {
                val entitiesToSave = mergedList.map { TransactionEntity.fromDomain(it).copy(pendingSync = false) }
                dao.insertTransactions(entitiesToSave)
                secureStorage.saveLastSyncedAt(nowIso)
                if (secureStorage.getGistId().isBlank()) {
                    secureStorage.saveGistId(gistId)
                }
            }

            // If token is missing, return success if read succeeded, or prompt for token
            if (token.isBlank()) {
                return@withContext if (remotePayload != null) {
                    Pair(true, "Restored $remoteTxCount transactions from Gist (Read-only mode).")
                } else {
                    Pair(false, "No GitHub token configured.")
                }
            }

            val authHeader = if (token.startsWith("token ") || token.startsWith("Bearer ")) token else "token $token"

            if (remotePayload == null && configuredGistId.isBlank()) {
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

            // Construct merged payload for updating Gist
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
                secureStorage.saveLastSyncedAt(nowIso)
                return@withContext Pair(true, "Synced ${mergedList.size} transactions cleanly with Gist.")
            } else {
                if (updateResponse.code() == 401) {
                    if (remotePayload != null) {
                        return@withContext Pair(true, "Restored $remoteTxCount transactions from Gist! (Token invalid for updates)")
                    } else {
                        return@withContext Pair(false, "GitHub Token invalid/unauthorized (401).")
                    }
                }
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
