package com.coinflow.app.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.coinflow.app.ui.MainViewModel
import java.text.SimpleDateFormat
import java.util.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddEditTransactionScreen(
    viewModel: MainViewModel,
    onDone: () => Unit
) {
    var type by remember { mutableStateOf("expense") }
    var amountStr by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("Food") }
    var description by remember { mutableStateOf("") }
    var date by remember { mutableStateOf(SimpleDateFormat("yyyy-MM-DD", Locale.US).format(Date())) }
    var paymentMethod by remember { mutableStateOf("Bank Transfer") }
    var notes by remember { mutableStateOf("") }
    var errorMsg by remember { mutableStateOf<String?>(null) }

    val categories = listOf("Food", "Transportation", "Shopping", "Housing", "Health", "Education", "Entertainment", "Income", "Other")
    val paymentMethods = listOf("Bank Transfer", "Debit Card", "UPI", "Cash", "Credit Card")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Add Transaction", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))

        if (errorMsg != null) {
            Text(errorMsg!!, color = Color(0xFFEF4444), fontSize = 12.sp)
        }

        // Expense / Income Toggle
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color(0xFF0F172A), RoundedCornerShape(12.dp))
                .padding(4.dp)
        ) {
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(if (type == "expense") Color(0xFFEF4444) else Color.Transparent, RoundedCornerShape(10.dp))
                    .clickable { type = "expense"; category = "Food" }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("Expense", fontWeight = FontWeight.Bold, color = Color.White)
            }
            Box(
                modifier = Modifier
                    .weight(1f)
                    .background(if (type == "income") Color(0xFF10B981) else Color.Transparent, RoundedCornerShape(10.dp))
                    .clickable { type = "income"; category = "Income" }
                    .padding(vertical = 10.dp),
                contentAlignment = Alignment.Center
            ) {
                Text("Income", fontWeight = FontWeight.Bold, color = Color.White)
            }
        }

        // Amount Input
        OutlinedTextField(
            value = amountStr,
            onValueChange = { amountStr = it },
            label = { Text("Amount (₹)") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.outlinedTextFieldColors(
                focusedBorderColor = Color(0xFF10B981),
                unfocusedBorderColor = Color(0xFF1E293B),
                containerColor = Color(0xFF0F172A)
            )
        )

        // Category dropdown / selector
        OutlinedTextField(
            value = category,
            onValueChange = { category = it },
            label = { Text("Category") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.outlinedTextFieldColors(
                focusedBorderColor = Color(0xFF10B981),
                unfocusedBorderColor = Color(0xFF1E293B),
                containerColor = Color(0xFF0F172A)
            )
        )

        // Description
        OutlinedTextField(
            value = description,
            onValueChange = { description = it },
            label = { Text("Description / Note") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.outlinedTextFieldColors(
                focusedBorderColor = Color(0xFF10B981),
                unfocusedBorderColor = Color(0xFF1E293B),
                containerColor = Color(0xFF0F172A)
            )
        )

        // Payment Method
        OutlinedTextField(
            value = paymentMethod,
            onValueChange = { paymentMethod = it },
            label = { Text("Payment Method") },
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(14.dp),
            colors = TextFieldDefaults.outlinedTextFieldColors(
                focusedBorderColor = Color(0xFF10B981),
                unfocusedBorderColor = Color(0xFF1E293B),
                containerColor = Color(0xFF0F172A)
            )
        )

        Spacer(modifier = Modifier.weight(1f))

        // Save Button
        Button(
            onClick = {
                val amt = amountStr.toDoubleOrNull()
                if (amt == null || amt <= 0) {
                    errorMsg = "Please enter a valid amount greater than 0"
                    return@Button
                }
                viewModel.addTransaction(
                    type = type,
                    amount = amt,
                    category = category,
                    description = description.ifBlank { category },
                    date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date()),
                    time = "12:00",
                    paymentMethod = paymentMethod,
                    notes = description
                )
                onDone()
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(52.dp),
            shape = RoundedCornerShape(14.dp),
            colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
        ) {
            Text("Save Transaction", fontSize = 16.sp, fontWeight = FontWeight.Bold, color = Color(0xFF020617))
        }
    }
}
