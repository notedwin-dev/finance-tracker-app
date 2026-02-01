# ZenFinance Tracker

A sophisticated personal finance management application built with **React 19**, **Vite**, and **Tailwind CSS v4**. It features cloud synchronization with Google Sheets and AI-powered financial insights.

## ✨ Features

- 📊 **Dynamic Dashboard**: Visualize your accounts, transactions, and spending patterns.
- ☁️ **Google Sheets Sync**: Real-time synchronization. Your data is stored safely in your own Google Drive.
- 🔐 **Secure Vault**: End-to-end encrypted storage for sensitive bank details. Protected by a user-defined password and hardware-level biometrics.
- 🤖 **AI Insights**: Integrated with Google Gemini to provide personalized financial advice and analysis.
- 🍯 **Saving Pots**: Create virtual buckets within your accounts to track specific savings goals without moving actual money.
- 📉 **Rich Visualizations**: Interactive charts to track balance history and expense distribution.
- 🌐 **Offline First**: Full functionality without an internet connection. Data syncs automatically once you go back online.
- 📱 **Mobile First**: responsive design optimized for both desktop and mobile use.

## 🔐 Privacy & Security

ZenFinance is built with a **Privacy-First** mindset:

- **End-to-End Encryption (E2EE)**: Sensitive data (like account numbers) are encrypted in your browser using AES-GCM before being sent to Google Sheets.
- **Biometric Authentication**: Support for modern Passkeys (TouchID, FaceID, or hardware keys) via WebAuthn for secure and seamless unlocking.
- **Multi-Device Sync**: Register your secure cryptographic keys across multiple devices to maintain access to your encrypted data anywhere.
- **Privacy Mode**: One-tap toggle to hide balances and sensitive information from prying eyes.
- **Zero-Knowledge**: Your vault password never leaves your browser. Even if Google is compromised, your sensitive data remains encrypted.

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS)
- A Google Cloud Project (for Sheets API and OAuth)
- A Gemini API Key (optional for free daily limited use, you should prioritize providing this API key on the UI itself over the .env file)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/notedwin-dev/finance-tracker-app
   cd finance-tracker-app
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Start the Backend**
   This app requires the [ZenFinance Backend](https://github.com/notedwin-dev/finance-tracker-app-backend) to handle secure Google OAuth token exchange. Follow the instructions in the backend directory to get it running.

4. **Environment Setup**
   Create a `.env` file in the root directory (refer to `.env.sample`):

   ```env
   VITE_GOOGLE_API_KEY=your_google_cloud_project_api_key
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   VITE_BACKEND_API_URL=http://localhost:3001
   ```

   - `VITE_GOOGLE_API_KEY`: You only need to fill this in if you want to provide a limited daily free requests for Gemini AI for other users using your hosted application. If not, you are not required to fill this in. Instead, fill it in from the UI for the Gemini API key you have gotten from [https://aistudio.google.com/api-keys](https://aistudio.google.com/api-keys)
   - `VITE_GOOGLE_CLIENT_ID`: You will need this for syncing your local data into cloud (Google Spreadsheets) so that you can access the same data from anywhere by logging in from multiple devices.
   - `VITE_BACKEND_API_URL`: You have to clone the [Backend repository](https://github.com/notedwin-dev/finance-tracker-app-backend) and host it with Vercel or your preferred self-hosting providers to get this Backend URL.

5. **Run the development server**
   ```bash
   npm run dev
   ```

## 🤖 ZenFinance AI

The integrated AI assistant provides:

- **Real-time Streaming**: See your financial advice appear word-by-word.
- **Data Context**: Analyzes your accounts, transactions, and goals to provide personalized insights.
- **Smart Suggestions**: Suggests follow-up questions to help you dig deeper into your finances.
- **Privacy First**: Daily limits for the public key and options to use your own secure Gemini API key.

## 🛠️ Tech Stack

- **Framework**: React 19
- **Bundler**: Vite
- **Styling**: Tailwind CSS v4
- **Charts**: Chart.js & React-Chartjs-2
- **Auth**: Google OAuth 2.0 & WebAuthn (Passkeys)
- **Encryption**: Web Crypto API (AES-GCM, PBKDF2)
- **Storage**: Browser LocalStorage + Google Sheets API
- **AI**: Google Generative AI (Gemini)
