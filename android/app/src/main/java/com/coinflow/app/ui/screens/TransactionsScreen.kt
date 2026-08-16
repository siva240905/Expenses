package com.coinflow.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coinflow.app.data.model.Transaction
import com.coinflow.app.ui.MainViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TransactionsScreen(
    viewModel: MainViewModel,
    onOpenAddTx: () => Unit
) {
    val transactions by viewModel.transactions.collectAsState()
    var searchQuery by remember { mutableStateOf("") }
    var selectedType by remember { mutableStateOf("all") }
    var deletingTxId by remember { mutableStateOf<String?>(null) }

    val filteredTxns = transactions.filter { tx ->
        val matchType = selectedType == "all" || tx.type == selectedType
        val matchQuery = searchQuery.isBlank() ||
                tx.description.contains(searchQuery, ignoreCase = true) ||
                tx.notes.contains(searchQuery, ignoreCase = true) ||
                tx.category.contains(searchQuery, ignoreCase = true) ||
                tx.amount.toString().contains(searchQuery)
        matchType && matchQuery
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(16.dp)
    ) {
        // Search TextField
        OutlinedTextField(
            value = searchQuery,
            onValueChange = { searchQuery = it },
            placeholder = { Text("Search transactions...", color = Color(0xFF64748B)) },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.outlinedTextFieldColors(
                focusedBorderColor = Color(0xFF10B981),
                unfocusedBorderColor = Color(0xFF1E293B),
                containerColor = Color(0xFF0F172A)
            )
        )

        Spacer(modifier = Modifier.height(12.dp))

        // Type filter row
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            FilterChip(
                selected = selectedType == "all",
                onClick = { selectedType = "all" },
                label = { Text("All") }
            )
            FilterChip(
                selected = selectedType == "expense",
                onClick = { selectedType = "expense" },
                label = { Text("Expenses") }
            )
            FilterChip(
                selected = selectedType == "income",
                onClick = { selectedType = "income" },
                label = { Text("Income") }
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // Transaction list
        LazyColumn(
            verticalArrangement = Arrangement.spacedBy(10.dp),
            modifier = Modifier.weight(1f)
        ) {
            items(filteredTxns) { tx ->
                Card(
                    colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                    shape = RoundedCornerShape(14.dp),
                    modifier = Modifier
                        .fillMaxWidth()
                        .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(14.dp))
                ) {
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .padding(14.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(modifier = Modifier.weight(1f)) {
                            Text(
                                text = tx.description.ifBlank { tx.category },
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFFF8FAFC)
                            )
                            Text(
                                text = "${tx.category} • ${tx.date} • ${tx.paymentMethod}",
                                fontSize = 11.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }

                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(
                                text = "${if (tx.type == "income") "+" else "-"}₹${String.format("%,.0f", tx.amount)}",
                                fontSize = 14.sp,
                                fontWeight = FontWeight.ExtraBold,
                                color = if (tx.type == "income") Color(0xFF10B981) else Color(0xFFF8FAFC)
                            )

                            Spacer(modifier = Modifier.width(8.dp))

                            IconButton(onClick = { deletingTxId = tx.id }) {
                                Text("🗑️", fontSize = 14.sp)
                            }
                        }
                    }
                }
            }
        }
    }

    // Delete Confirmation Dialog
    if (deletingTxId != null) {
        AlertDialog(
            onDismissRequest = { deletingTxId = null },
            title = { Text("Delete Transaction") },
            text = { Text("Are you sure you want to delete this transaction?") },
            confirmButton = {
                Button(
                    onClick = {
                        viewModel.deleteTransaction(deletingTxId!!)
                        deletingTxId = null
                    },
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFFEF4444))
                ) {
                    Text("Delete")
                }
            },
            dismissButton = {
                TextButton(onClick = { deletingTxId = null }) {
                    Text("Cancel")
                }
            }
        )
    }
}
