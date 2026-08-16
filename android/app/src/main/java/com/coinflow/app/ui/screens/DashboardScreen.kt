package com.coinflow.app.ui.screens

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coinflow.app.data.model.Transaction
import com.coinflow.app.ui.MainViewModel

@Composable
fun DashboardScreen(
    viewModel: MainViewModel,
    onNavigateTransactions: () -> Unit,
    onOpenAddTx: () -> Unit
) {
    val uiMetrics by viewModel.uiMetrics.collectAsState()
    val transactions by viewModel.transactions.collectAsState()

    val recentTxns = transactions.take(7)

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        // Balance Card
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(20.dp))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("TOTAL BALANCE", fontSize = 12.sp, fontWeight = FontWeight.Bold, color = Color(0xFF94A3B8))
                    Spacer(modifier = Modifier.height(4.dp))
                    Text(
                        text = "₹${String.format("%,.2f", uiMetrics.totalBalance)}",
                        fontSize = 32.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (uiMetrics.totalBalance >= 0) Color(0xFF10B981) else Color(0xFFEF4444)
                    )
                    Spacer(modifier = Modifier.height(16.dp))
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Column {
                            Text("INCOME", fontSize = 11.sp, color = Color(0xFF94A3B8))
                            Text("₹${String.format("%,.0f", uiMetrics.totalIncome)}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFF10B981))
                        }
                        Column {
                            Text("EXPENSES", fontSize = 11.sp, color = Color(0xFF94A3B8))
                            Text("₹${String.format("%,.0f", uiMetrics.totalExpenses)}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFEF4444))
                        }
                        Column {
                            Text("THIS MONTH", fontSize = 11.sp, color = Color(0xFF94A3B8))
                            Text("₹${String.format("%,.0f", uiMetrics.thisMonthSpending)}", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF59E0B))
                        }
                    }
                }
            }
        }

        // Native Category Distribution Canvas Chart
        item {
            Card(
                colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier
                    .fillMaxWidth()
                    .border(1.dp, Color(0xFF1E293B), RoundedCornerShape(20.dp))
            ) {
                Column(modifier = Modifier.padding(20.dp)) {
                    Text("EXPENSE DISTRIBUTION", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))
                    Spacer(modifier = Modifier.height(16.dp))

                    val categoryTotals = transactions.filter { it.type == "expense" }
                        .groupBy { it.category }
                        .mapValues { entry -> entry.value.sumOf { it.amount } }

                    if (categoryTotals.isNotEmpty()) {
                        val totalSum = categoryTotals.values.sum()
                        val colors = listOf(Color(0xFFEF4444), Color(0xFFF59E0B), Color(0xFFEC4899), Color(0xFF3B82F6), Color(0xFF8B5CF6), Color(0xFF10B981))

                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Canvas(modifier = Modifier.size(140.dp)) {
                                var startAngle = -90f
                                categoryTotals.values.forEachIndexed { index, amount ->
                                    val sweep = (amount / totalSum * 360).toFloat()
                                    drawArc(
                                        color = colors[index % colors.size],
                                        startAngle = startAngle,
                                        sweepAngle = sweep,
                                        useCenter = false,
                                        style = androidx.compose.ui.graphics.drawscope.Stroke(width = 28f),
                                        size = Size(size.width, size.height)
                                    )
                                    startAngle += sweep
                                }
                            }
                        }
                    } else {
                        Text("No expense data", fontSize = 12.sp, color = Color(0xFF64748B), modifier = Modifier.padding(vertical = 24.dp))
                    }
                }
            }
        }

        // Recent Transactions Section Header
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("Recent Transactions", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))
                TextButton(onClick = onNavigateTransactions) {
                    Text("View All", fontSize = 12.sp, color = Color(0xFF10B981))
                }
            }
        }

        // Recent Transactions Items
        items(recentTxns) { tx ->
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
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(
                            modifier = Modifier
                                .size(38.dp)
                                .background(
                                    if (tx.type == "income") Color(0xFF064E3B) else Color(0xFF881337),
                                    RoundedCornerShape(10.dp)
                                ),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = if (tx.type == "income") "+" else "-",
                                color = if (tx.type == "income") Color(0xFF10B981) else Color(0xFFEF4444),
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp
                            )
                        }
                        Spacer(modifier = Modifier.width(12.dp))
                        Column {
                            Text(
                                text = tx.description.ifBlank { tx.category },
                                fontSize = 14.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color(0xFFF8FAFC)
                            )
                            Text(
                                text = "${tx.category} • ${tx.date}",
                                fontSize = 11.sp,
                                color = Color(0xFF94A3B8)
                            )
                        }
                    }

                    Text(
                        text = "${if (tx.type == "income") "+" else "-"}₹${String.format("%,.0f", tx.amount)}",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = if (tx.type == "income") Color(0xFF10B981) else Color(0xFFF8FAFC)
                    )
                }
            }
        }

        item {
            Spacer(modifier = Modifier.height(64.dp))
        }
    }
}
