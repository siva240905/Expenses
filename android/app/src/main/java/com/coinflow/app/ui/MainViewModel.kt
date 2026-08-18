package com.coinflow.app.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.coinflow.app.data.model.Category
import com.coinflow.app.data.model.Transaction
import com.coinflow.app.data.repository.ExpenseRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.combine
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

data class UiMetrics(
    val totalBalance: Double = 0.0,
    val totalIncome: Double = 0.0,
    val totalExpenses: Double = 0.0,
    val todaySpending: Double = 0.0,
    val thisMonthSpending: Double = 0.0,
    val largestExpense: Transaction? = null
)

class MainViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = ExpenseRepository(application)

    init {
        syncNow()
    }

    val transactions: StateFlow<List<Transaction>> = repository.allTransactions.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    val categories: StateFlow<List<Category>> = repository.allCategories.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = emptyList()
    )

    private val _syncMessage = MutableStateFlow<String?>(null)
    val syncMessage: StateFlow<String?> = _syncMessage.asStateFlow()

    private val _isSyncing = MutableStateFlow(false)
    val isSyncing: StateFlow<Boolean> = _isSyncing.asStateFlow()

    val uiMetrics: StateFlow<UiMetrics> = transactions.combine(MutableStateFlow(Unit)) { txs, _ ->
        val income = txs.filter { it.type == "income" }.sumOf { it.amount }
        val expenses = txs.filter { it.type == "expense" }.sumOf { it.amount }
        val balance = income - expenses

        val todayStr = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US).format(java.util.Date())
        val monthStr = todayStr.substring(0, 7)

        val todaySp = txs.filter { it.type == "expense" && it.date == todayStr }.sumOf { it.amount }
        val monthSp = txs.filter { it.type == "expense" && it.date.startsWith(monthStr) }.sumOf { it.amount }

        val largest = txs.filter { it.type == "expense" }.maxByOrNull { it.amount }

        UiMetrics(
            totalBalance = balance,
            totalIncome = income,
            totalExpenses = expenses,
            todaySpending = todaySp,
            thisMonthSpending = monthSp,
            largestExpense = largest
        )
    }.stateIn(
        scope = viewModelScope,
        started = SharingStarted.WhileSubscribed(5000),
        initialValue = UiMetrics()
    )

    fun addTransaction(type: String, amount: Double, category: String, description: String, date: String, time: String, paymentMethod: String, notes: String) {
        viewModelScope.launch {
            repository.addTransaction(type, amount, category, description, date, time, paymentMethod, notes)
        }
    }

    fun deleteTransaction(id: String) {
        viewModelScope.launch {
            repository.deleteTransaction(id)
        }
    }

    fun syncNow() {
        viewModelScope.launch {
            _isSyncing.value = true
            val (success, msg) = repository.syncNow()
            _isSyncing.value = false
            _syncMessage.value = if (success) "Sync Success: $msg" else "Sync Error: $msg"
        }
    }

    fun saveGistToken(token: String, gistId: String) {
        repository.secureStorage.saveGithubToken(token)
        repository.secureStorage.saveGistId(gistId)
        syncNow()
    }

    fun getSavedToken(): String = repository.secureStorage.getGithubToken()
    fun getSavedGistId(): String = repository.secureStorage.getGistId()
}
