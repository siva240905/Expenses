package com.coinflow.app.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.coinflow.app.data.model.Transaction

@Entity(tableName = "transactions")
data class TransactionEntity(
    @PrimaryKey val id: String,
    val type: String,
    val amount: Double,
    val category: String,
    val description: String,
    val date: String,
    val time: String,
    val paymentMethod: String,
    val notes: String,
    val createdAt: String,
    val updatedAt: String,
    val isDeleted: Boolean = false,
    val pendingSync: Boolean = false
) {
    fun toDomain(): Transaction {
        return Transaction(
            id = id,
            type = type,
            amount = amount,
            category = category,
            description = description,
            date = date,
            time = time,
            paymentMethod = paymentMethod,
            notes = notes,
            createdAt = createdAt,
            updatedAt = updatedAt,
            isDeleted = isDeleted,
            pendingSync = pendingSync
        )
    }

    companion object {
        fun fromDomain(domain: Transaction): TransactionEntity {
            return TransactionEntity(
                id = domain.id,
                type = domain.type,
                amount = domain.amount,
                category = domain.category,
                description = domain.description,
                date = domain.date,
                time = domain.time,
                paymentMethod = domain.paymentMethod,
                notes = domain.notes,
                createdAt = domain.createdAt,
                updatedAt = domain.updatedAt,
                isDeleted = domain.isDeleted,
                pendingSync = domain.pendingSync
            )
        }
    }
}

@Entity(tableName = "categories")
data class CategoryEntity(
    @PrimaryKey val id: String,
    val name: String,
    val type: String,
    val icon: String,
    val color: String,
    val isDefault: Boolean = true
)
