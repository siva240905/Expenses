package com.coinflow.app.data.model

import com.google.gson.annotations.SerializedName

enum class TransactionType {
    @SerializedName("expense")
    EXPENSE,
    @SerializedName("income")
    INCOME
}

data class Transaction(
    val id: String,
    val type: String, // "expense" or "income"
    val amount: Double,
    val category: String,
    val description: String,
    val date: String, // YYYY-MM-DD
    val time: String = "12:00", // HH:mm
    val paymentMethod: String = "Bank Transfer",
    val notes: String = "",
    val createdAt: String,
    val updatedAt: String,
    val isDeleted: Boolean = false,
    val pendingSync: Boolean = false
)

data class Category(
    val id: String,
    val name: String,
    val type: String,
    val icon: String,
    val color: String,
    val isDefault: Boolean = true
)

data class UserSettings(
    val currency: String = "INR",
    val theme: String = "dark",
    val githubToken: String = "",
    val gistId: String = "",
    val autoSync: Boolean = true,
    val lastSyncedAt: String = "",
    val monthlySavingsGoal: Double = 1362.0
)

data class GistUserData(
    val currency: String = "INR"
)

data class GistPayload(
    val version: Int = 1,
    val user: GistUserData = GistUserData("INR"),
    val transactions: List<Transaction>,
    val categories: List<Category>,
    val settings: UserSettings,
    val monthlySavings: Double = 1362.0,
    val lastSyncedAt: String
)

sealed class SyncState {
    object Idle : SyncState()
    object Syncing : SyncState()
    object Synced : SyncState()
    object Pending : SyncState()
    data class Failed(val error: String) : SyncState()
}
