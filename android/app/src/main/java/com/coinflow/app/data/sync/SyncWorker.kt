package com.coinflow.app.data.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters

class SyncWorker(
    context: Context,
    workerParams: WorkerParameters
) : CoroutineWorker(context, workerParams) {

    override suspend fun doWork(): Result {
        val syncManager = GistSyncManager(applicationContext)
        val (success, _) = syncManager.performSync()
        return if (success) {
            Result.success()
        } else {
            Result.retry()
        }
    }
}
