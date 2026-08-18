package com.coinflow.app.ui.screens

import androidx.compose.foundation.background
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(viewModel: MainViewModel) {
    var token by remember { mutableStateOf(viewModel.getSavedToken()) }
    var gistId by remember { mutableStateOf(viewModel.getSavedGistId()) }
    val isSyncing by viewModel.isSyncing.collectAsState()
    val syncMessage by viewModel.syncMessage.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Color(0xFF020617))
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Settings & Cloud Sync", fontSize = 20.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))

        if (syncMessage != null) {
            val isError = syncMessage!!.startsWith("Sync Error:")
            Text(syncMessage!!, color = if (isError) Color(0xFFEF4444) else Color(0xFF10B981), fontSize = 12.sp)
        }

        Card(
            colors = CardDefaults.cardColors(containerColor = Color(0xFF0F172A)),
            shape = RoundedCornerShape(16.dp),
            modifier = Modifier.fillMaxWidth()
        ) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("GitHub Gist Synchronization", fontSize = 14.sp, fontWeight = FontWeight.Bold, color = Color(0xFFF8FAFC))

                OutlinedTextField(
                    value = token,
                    onValueChange = { token = it },
                    label = { Text("Personal Access Token (PAT)") },
                    placeholder = { Text("ghp_xxxxxxxxxxxx") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.outlinedTextFieldColors(
                        focusedBorderColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        containerColor = Color(0xFF020617)
                    )
                )

                OutlinedTextField(
                    value = gistId,
                    onValueChange = { gistId = it },
                    label = { Text("Gist ID (Optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(12.dp),
                    colors = TextFieldDefaults.outlinedTextFieldColors(
                        focusedBorderColor = Color(0xFF10B981),
                        unfocusedBorderColor = Color(0xFF1E293B),
                        containerColor = Color(0xFF020617)
                    )
                )

                Button(
                    onClick = { viewModel.saveGistToken(token, gistId) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF10B981))
                ) {
                    Text("Save & Connect Gist", fontWeight = FontWeight.Bold, color = Color(0xFF020617))
                }

                OutlinedButton(
                    onClick = { viewModel.syncNow() },
                    enabled = !isSyncing,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(if (isSyncing) "Syncing..." else "Sync Now")
                }
            }
        }
    }
}
