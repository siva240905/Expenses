package com.coinflow.app.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.sqlite.db.SupportSQLiteDatabase
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

@Database(
    entities = [TransactionEntity::class, CategoryEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun transactionDao(): TransactionDao

    companion object {
        @Volatile
        private var INSTANCE: AppDatabase? = null

        fun getDatabase(context: Context, scope: CoroutineScope): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "coin_flow_database"
                )
                .addCallback(AppDatabaseCallback(scope))
                .fallbackToDestructiveMigration()
                .build()
                INSTANCE = instance
                instance
            }
        }

        private class AppDatabaseCallback(
            private val scope: CoroutineScope
        ) : RoomDatabase.Callback() {
            override fun onCreate(db: SupportSQLiteDatabase) {
                super.onCreate(db)
                INSTANCE?.let { database ->
                    scope.launch(Dispatchers.IO) {
                        populateInitialData(database.transactionDao())
                    }
                }
            }

            suspend fun populateInitialData(dao: TransactionDao) {
                // Populate default categories
                val defaultCategories = listOf(
                    CategoryEntity("cat_food", "Food", "expense", "utensils", "#EF4444", true),
                    CategoryEntity("cat_trans", "Transportation", "expense", "car", "#F59E0B", true),
                    CategoryEntity("cat_shop", "Shopping", "expense", "shopping-bag", "#EC4899", true),
                    CategoryEntity("cat_housing", "Housing", "expense", "home", "#3B82F6", true),
                    CategoryEntity("cat_edu", "Education", "expense", "graduation-cap", "#8B5CF6", true),
                    CategoryEntity("cat_ent", "Entertainment", "expense", "film", "#10B981", true),
                    CategoryEntity("cat_health", "Health", "expense", "heart-pulse", "#14B8A6", true),
                    CategoryEntity("cat_recharge", "Recharge", "expense", "smartphone", "#6366F1", true),
                    CategoryEntity("cat_sub", "Subscription", "expense", "tv", "#84CC16", true),
                    CategoryEntity("cat_family", "Family", "expense", "users", "#F97316", true),
                    CategoryEntity("cat_income", "Income", "income", "wallet", "#10B981", true),
                    CategoryEntity("cat_other", "Other", "expense", "help-circle", "#6B7280", true)
                )
                dao.insertCategories(defaultCategories)
            }
        }
    }
}

