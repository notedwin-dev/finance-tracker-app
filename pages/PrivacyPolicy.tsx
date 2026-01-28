import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-background text-gray-300 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <Link
          to="/"
          className="inline-flex items-center text-primary hover:text-primary-dark mb-8 transition-colors"
        >
          <ChevronLeftIcon className="w-4 h-4 mr-2" />
          Back to Home
        </Link>
        
        <h1 className="text-4xl font-black text-white mb-2">Privacy Policy</h1>
        <p className="text-gray-500 mb-8 uppercase tracking-widest text-sm font-bold">
          Last Updated: 28th January 2026
        </p>

        <div className="prose prose-invert prose-primary max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">1. Introduction</h2>
            <p>
              ZenFinance ("we", "us", or "the app") is developed by **Edwin Ng**. Your privacy is of paramount importance. This Privacy Policy explains how ZenFinance handles your data, emphasizing our "Data Sovereignty" model where you, the **User**, remain in control of your financial information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">2. The Data Sovereignty Model</h2>
            <p>
              Unlike traditional financial apps, the **Developer** does not store your financial data on centralized servers. ZenFinance is designed to function using local storage and your personal Google Drive account.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Local Storage:</strong> Temporary session data and preferences are stored locally on your device.</li>
              <li><strong>Google Sheets:</strong> When you connect your Google account, financial records are stored in a private spreadsheet within your own Google Drive.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">3. Data We Access</h2>
            <p>
              To provide our services, the app requests access to your Google account via OAuth. This access is limited to:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Creating and managing the "ZenFinance" spreadsheet.</li>
              <li>Reading/writing transactions, accounts, and budget data strictly within that file.</li>
              <li>Accessing basic profile information (email and name) for account personalization.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">4. AI Processing (Gemini API)</h2>
            <p>
              If you use the ZenFinance AI features, relevant financial context is sent to Google's Gemini API to generate insights. This data is handled according to Google's AI Privacy terms. You can also provide your own API key to have direct control over your AI usage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">5. Third-Party Services</h2>
            <p>
              We use the following third-party services:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Google Cloud Platform:</strong> For OAuth and Google Sheets API.</li>
              <li><strong>Google Gemini:</strong> For AI-powered financial analysis.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">6. Security</h2>
            <p>
              Since the **Developer** never session-logs or stores your data on private servers, the security of your data largely depends on the security of your device and your Google Account. We recommend enabling Two-Factor Authentication (2FA) on your Google account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">7. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, you can reach out to the **Developer** at <a href="https://notedwin.dev" className="text-primary hover:underline">https://notedwin.dev</a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
