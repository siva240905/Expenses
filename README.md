# Coin Flow - Personal Expense Tracker (Android & Web)

A complete, modern, offline-first personal finance application with **bidirectional cloud synchronization** via **GitHub Gist**.

## 🌟 Key Features

* **Offline-First Architecture**: Work seamlessly offline on Android and Web. Data is stored locally in Room DB (Android) & IndexedDB (Web) and syncs automatically when online.
* **Shared GitHub Gist Data Store**: Expenses added from Android are immediately available on the Web app and vice versa.
* **Bidirectional Sync & Conflict Resolution**: Merges local and remote data safely using `updatedAt` timestamps and unique transaction IDs (`tx-...`).
* **Secure Token Management**: GitHub Personal Access Token (PAT) stored securely using Android KeyStore (`EncryptedSharedPreferences`) on Android and encrypted local storage on Web. Never plain text.
* **Interactive Dashboard & Charts**: Category Pie/Doughnut charts, Daily Expense Bar charts, Income vs Expense Line charts, and Monthly Savings goals.
* **Full Financial CRUD**: Add income & expenses, category management, date pickers, payment methods, search, filtering, and sorting.
* **Backup & Restore**: Export complete financial state to JSON, import JSON backups, and backup/restore from Gist.

---

## 📁 Shared Gist JSON Schema (`coin_flow_data.json`)

```json
{
  "version": 1,
  "user": {
    "currency": "INR"
  },
  "transactions": [
    {
      "id": "tx-1786767545397",
      "type": "expense",
      "amount": 150,
      "category": "Transportation",
      "description": "Return to Home",
      "date": "2026-08-15",
      "time": "18:30",
      "paymentMethod": "Bank Transfer",
      "notes": "Return to Home",
      "createdAt": "2026-08-15T18:30:00.000Z",
      "updatedAt": "2026-08-15T18:30:00.000Z",
      "isDeleted": false
    }
  ],
  "categories": [
    {
      "id": "cat_food",
      "name": "Food",
      "type": "expense",
      "icon": "utensils",
      "color": "#EF4444"
    }
  ],
  "settings": {
    "currency": "INR",
    "theme": "dark"
  },
  "monthlySavings": 1362,
  "lastSyncedAt": "2026-08-16T17:47:00.000Z"
}
```

---

## 🚀 Web Application Setup & Deployment

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Run Web App Locally**:
   ```bash
   npx vite
   # or run Node server: node server.js
   ```

3. **Build for Production**:
   ```bash
   npx vite build
   ```

---

## 📱 Android Application Setup & Build

1. Open `android/` directory in Android Studio.
2. Ensure JDK 17 is selected in Project Structure.
3. Build & Run Debug APK:
   ```bash
   cd android
   ./gradlew assembleDebug
   ```

---

## 🔐 GitHub Gist Setup Instructions

1. Go to [GitHub Settings -> Personal Access Tokens](https://github.com/settings/tokens).
2. Generate a token with the `gist` permission scope.
3. Open **Settings** inside either Android or Web app.
4. Enter your Personal Access Token.
5. Click **Save Configuration & Connect**. The app will automatically create a secret Gist containing your 57 transactions and sync bidirectionally!
