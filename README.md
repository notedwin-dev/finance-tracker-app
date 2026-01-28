# ZenFinance Tracker

A sophisticated personal finance management application built with **React 19**, **Vite**, and **Tailwind CSS v4**. It features cloud synchronization with Google Sheets and AI-powered financial insights.

## ✨ Features

- 📊 **Dynamic Dashboard**: Visualize your accounts, transactions, and spending patterns.
- ☁️ **Google Sheets Sync**: Real-time synchronization. Your data is stored safely in your own Google Drive.
- 🤖 **AI Insights**: Integrated with Google Gemini to provide personalized financial advice and analysis.
- 🍯 **Saving Pots**: Create virtual buckets within your accounts to track specific savings goals without moving actual money.
- 📉 **Rich Visualizations**: Interactive charts to track balance history and expense distribution.
- 📱 **Mobile First**: responsive design optimized for both desktop and mobile use.

## 🚀 Getting Started

### Prerequisites

- Node.js (Latest LTS)
- A Google Cloud Project (for Sheets API and OAuth)
- A Gemini API Key

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
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
   VITE_GOOGLE_CLIENT_ID=your_google_oauth_client_id
   VITE_BACKEND_API_URL=http://localhost:3001
   VITE_GEMINI_API_KEY=your_gemini_api_key
   ```

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
- **Auth**: Google OAuth 2.0
- **Storage**: Browser LocalStorage + Google Sheets API
- **AI**: Google Generative AI (Gemini)
