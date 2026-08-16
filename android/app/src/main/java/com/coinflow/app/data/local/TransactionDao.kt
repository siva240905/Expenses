package com.coinflow.app.data.local

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TransactionDao {
    @Query("SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY date DESC, time DESC")
    fun getAllActiveTransactionsFlow(): Flow<List<TransactionEntity>>

    @Query("SELECT * FROM transactions WHERE isDeleted = 0 ORDER BY date DESC, time DESC")
    suspend fun getAllActiveTransactions(): List<TransactionEntity>

    @Query("SELECT * FROM transactions")
    suspend fun getAllRawTransactions(): List<TransactionEntity>

    @Query("SELECT * FROM transactions WHERE pendingSync = 1")
    suspend fun getPendingSyncTransactions(): List<TransactionEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransaction(transaction: TransactionEntity)

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTransactions(transactions: List<TransactionEntity>)

    @Query("UPDATE transactions SET isDeleted = 1, updatedAt = :updatedAt, pendingSync = 1 WHERE id = :id")
    suspend fun softDeleteTransaction(id: String, updatedAt: String)

    @Query("DELETE FROM transactions WHERE id = :id")
    suspend fun hardDeleteTransaction(id: String)

    // Categories
    @Query("SELECT * FROM categories")
    fun getAllCategoriesFlow(): Flow<List<CategoryEntity>>

    @Query("SELECT * FROM categories")
    suspend fun getAllCategories(): List<CategoryEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertCategories(categories: List<CategoryEntity>)
}
