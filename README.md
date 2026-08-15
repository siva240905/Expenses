# 🪙 Coin Flow - Personal Finance Tracker

[![Vercel Deployment](https://img.shields.io/badge/Vercel-Live--App-00DDF7?style=for-the-badge&logo=vercel&logoColor=white)](https://expenses-mauve-xi.vercel.app)
[![GitHub License](https://img.shields.io/badge/License-MIT-purple?style=for-the-badge)](LICENSE)
[![PWA Ready](https://img.shields.io/badge/PWA-1--Tap--Install-00FF9D?style=for-the-badge&logo=pwa&logoColor=white)](https://expenses-mauve-xi.vercel.app)

> **Coin Flow** is a high-precision, neon-cyber personal expense tracker designed for web and mobile. Built with kinetic UI glassmorphism, instant PWA home-screen installation, and cloud database synchronization.

---

## ⚡ Quick App Access & Installation

### Option 1: 🌐 Live Web App (Instant Access)
Open the live web application on any device:
👉 **[https://expenses-mauve-xi.vercel.app](https://expenses-mauve-xi.vercel.app)**

---

### Option 2: 📲 Install Mobile App (PWA - Recommended)
You can install **Coin Flow** directly as a native-feeling app on Android, iOS, Windows, or Mac without needing the Google Play Store:

#### On Android (Google Chrome)
1. Open [**`https://expenses-mauve-xi.vercel.app`**](https://expenses-mauve-xi.vercel.app) in Google Chrome.
2. Tap the **Install** prompt banner at the top, or tap the 3-dots menu (`⋮`) in the top right.
3. Select **Add to Home Screen** / **Install App**.

#### On iPhone / iPad (Safari)
1. Open [**`https://expenses-mauve-xi.vercel.app`**](https://expenses-mauve-xi.vercel.app) in Safari.
2. Tap the **Share** icon (bottom bar).
3. Scroll down and tap **Add to Home Screen**.

---

### Option 3: 📦 Download Built Android APK from GitHub
GitHub Actions automatically builds and publishes compiled `.apk` files on every commit:
- 🚀 **[Download Latest APK Release](https://github.com/siva240905/Expenses/releases)**
- ⚡ **[Download GitHub Actions Build Artifacts](https://github.com/siva240905/Expenses/actions)**

---

### Option 4: 🤖 Android Studio Project (`/android`)
The repository includes a complete native Android WebKit wrapper project:
- **Location**: [`/android`](android)
- **Source Code**: [`android/app/src/main/java/com/coinflow/app/MainActivity.kt`](android/app/src/main/java/com/coinflow/app/MainActivity.kt)
- **Assets**: [`android/app/src/main/assets/`](android/app/src/main/assets/)

To build an APK manually in Android Studio:
```bash
git clone https://github.com/siva240905/Expenses.git
cd Expenses/android
# Open in Android Studio and select Build > Build Bundle(s) / APK(s) > Build APK(s)
```

---

## ✨ Features

- 💎 **Lumina Neon UI**: Futuristic kinetic glassmorphism panels with high-contrast typography (Plus Jakarta Sans & Inter).
- 🇮🇳 **Indian Rupee (₹) Support**: Complete Indian Rupee formatting across metrics, tables, and chart tooltips.
- 📊 **Interactive Analytics**: Monthly expense breakdown, weekly graphs, doughnut category shares, and 365-day activity heatmaps.
- ⚡ **Rapid Transaction Entry**: 1-tap presets for Food 🍕, Fuel ⛽, Shopping 🛍️, Bills 💡, and Salary 💰.
- 🔒 **Cloud Sync & Vault**: Secure database sync via Vercel Serverless API or GitHub Gist.
- 🛡️ **Admin Security**: PIN-protected write access to protect data from unauthorized edits.

---

## 🛠️ Local Development & Server Setup

To run the application locally on your machine:

1. Clone the repository:
   ```bash
   git clone https://github.com/siva240905/Expenses.git
   cd Expenses
   ```

2. Start the local server:
   ```bash
   node server.js
   ```

3. Open your browser:
   ```text
   http://localhost:3000
   ```

---

## 📄 License
Distributed under the MIT License. See `LICENSE` for more information.
