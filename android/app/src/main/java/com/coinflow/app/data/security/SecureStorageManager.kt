package com.coinflow.app.data.security

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

class SecureStorageManager(context: Context) {

    private val sharedPreferences: SharedPreferences by lazy {
        try {
            val masterKey = MasterKey.Builder(context)
                .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
                .build()

            EncryptedSharedPreferences.create(
                context,
                "coin_flow_secure_prefs",
                masterKey,
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
            )
        } catch (e: Exception) {
            context.getSharedPreferences("coin_flow_fallback_prefs", Context.MODE_PRIVATE)
        }
    }

    fun saveGithubToken(token: String) {
        sharedPreferences.edit().putString("github_token", token.trim()).apply()
    }

    fun getGithubToken(): String {
        return sharedPreferences.getString("github_token", "") ?: ""
    }

    fun saveGistId(gistId: String) {
        sharedPreferences.edit().putString("gist_id", gistId.trim()).apply()
    }

    fun getGistId(): String {
        return sharedPreferences.getString("gist_id", "") ?: ""
    }

    fun saveAutoSync(enabled: Boolean) {
        sharedPreferences.edit().putBoolean("auto_sync", enabled).apply()
    }

    fun getAutoSync(): Boolean {
        return sharedPreferences.getBoolean("auto_sync", true)
    }

    fun saveLastSyncedAt(timestamp: String) {
        sharedPreferences.edit().putString("last_synced_at", timestamp).apply()
    }

    fun getLastSyncedAt(): String {
        return sharedPreferences.getString("last_synced_at", "") ?: ""
    }

    fun clear() {
        sharedPreferences.edit().clear().apply()
    }
}
