package com.coinflow.app.data.repository

import android.content.Context
import com.coinflow.app.data.local.AppDatabase
import com.coinflow.app.data.local.TransactionEntity
import com.coinflow.app.data.model.Category
import com.coinflow.app.data.model.Transaction
import com.coinflow.app.data.security.SecureStorageManager
import com.coinflow.app.data.sync.GistSyncManager
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map
import java.text.SimpleDateFormat
import java.util.*

class ExpenseRepository(private val context: Context) {

    private val db = AppDatabase.getDatabase(context, CoroutineScope(Dispatchers.IO))
    private val dao = db.transactionDao()
    private val syncManager = GistSyncManager(context)
    val secureStorage = SecureStorageManager(context)

    val allTransactions: Flow<List<Transaction>> = dao.getAllActiveTransactionsFlow().map { list ->
        list.map { it.toDomain() }
    }

    val allCategories: Flow<List<Category>> = dao.getAllCategoriesFlow().map { list ->
        list.map { Category(it.id, it.name, it.type, it.icon, it.color, it.isDefault) }
    }

    suspend fun addTransaction(type: String, amount: Double, category: String, description: String, date: String, time: String, paymentMethod: String, notes: String) {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        val id = "tx-${System.currentTimeMillis()}_${(1000..9999).random()}"
        val entity = TransactionEntity(
            id = id,
            type = type,
            amount = amount,
            category = category,
            description = if (description.isBlank()) category else description,
            date = date,
            time = time,
            paymentMethod = paymentMethod,
            notes = notes,
            createdAt = nowIso,
            updatedAt = nowIso,
            isDeleted = false,
            pendingSync = true
        )
        dao.insertTransaction(entity)

        if (secureStorage.getAutoSync() && secureStorage.getGithubToken().isNotBlank()) {
            syncManager.performSync()
        }
    }

    suspend fun updateTransaction(transaction: Transaction) {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        val entity = TransactionEntity.fromDomain(transaction.copy(updatedAt = nowIso, pendingSync = true))
        dao.insertTransaction(entity)

        if (secureStorage.getAutoSync() && secureStorage.getGithubToken().isNotBlank()) {
            syncManager.performSync()
        }
    }

    suspend fun deleteTransaction(id: String) {
        val nowIso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).apply {
            timeZone = TimeZone.getTimeZone("UTC")
        }.format(Date())

        dao.softDeleteTransaction(id, nowIso)

        if (secureStorage.getAutoSync() && secureStorage.getGithubToken().isNotBlank()) {
            syncManager.performSync()
        }
    }

    suspend fun syncNow(): Pair<Boolean, String> {
        return syncManager.performSync()
    }
}
