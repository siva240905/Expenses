package com.coinflow.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.viewModels
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.coinflow.app.ui.MainViewModel
import com.coinflow.app.ui.screens.*

class MainActivity : ComponentActivity() {

    private val viewModel: MainViewModel by viewModels()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            MaterialTheme(
                colorScheme = darkColorScheme(
                    background = Color(0xFF020617),
                    surface = Color(0xFF0F172A),
                    primary = Color(0xFF10B981)
                )
            ) {
                var currentTab by remember { mutableStateOf("dashboard") }

                Scaffold(
                    bottomBar = {
                        NavigationBar(
                            containerColor = Color(0xFF0F172A),
                            contentColor = Color(0xFF94A3B8)
                        ) {
                            NavigationBarItem(
                                selected = currentTab == "dashboard",
                                onClick = { currentTab = "dashboard" },
                                icon = { Text("📊") },
                                label = { Text("Dashboard") }
                            )
                            NavigationBarItem(
                                selected = currentTab == "transactions",
                                onClick = { currentTab = "transactions" },
                                icon = { Text("💸") },
                                label = { Text("Transactions") }
                            )
                            NavigationBarItem(
                                selected = currentTab == "add",
                                onClick = { currentTab = "add" },
                                icon = { Text("➕") },
                                label = { Text("Add") }
                            )
                            NavigationBarItem(
                                selected = currentTab == "settings",
                                onClick = { currentTab = "settings" },
                                icon = { Text("⚙️") },
                                label = { Text("Settings") }
                            )
                        }
                    }
                ) { innerPadding ->
                    Box(modifier = Modifier.padding(innerPadding)) {
                        when (currentTab) {
                            "dashboard" -> DashboardScreen(
                                viewModel = viewModel,
                                onNavigateTransactions = { currentTab = "transactions" },
                                onOpenAddTx = { currentTab = "add" }
                            )
                            "transactions" -> TransactionsScreen(
                                viewModel = viewModel,
                                onOpenAddTx = { currentTab = "add" }
                            )
                            "add" -> AddEditTransactionScreen(
                                viewModel = viewModel,
                                onDone = { currentTab = "dashboard" }
                            )
                            "settings" -> SettingsScreen(
                                viewModel = viewModel
                            )
                        }
                    }
                }
            }
        }
    }
}
