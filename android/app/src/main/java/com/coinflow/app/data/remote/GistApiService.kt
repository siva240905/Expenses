package com.coinflow.app.data.remote

import com.coinflow.app.data.model.GistPayload
import com.google.gson.JsonObject
import retrofit2.Response
import retrofit2.http.*

interface GistApiService {

    @GET("gists/{id}")
    suspend fun getGist(
        @Header("Authorization") token: String,
        @Path("id") gistId: String
    ): Response<JsonObject>

    @POST("gists")
    suspend fun createGist(
        @Header("Authorization") token: String,
        @Body body: JsonObject
    ): Response<JsonObject>

    @PATCH("gists/{id}")
    suspend fun updateGist(
        @Header("Authorization") token: String,
        @Path("id") gistId: String,
        @Body body: JsonObject
    ): Response<JsonObject>
}
