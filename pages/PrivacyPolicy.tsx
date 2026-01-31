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
          Last Updated: 31st January 2026
        </p>

        <div className="prose prose-invert prose-primary max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              1. Introduction
            </h2>
            <p>
              ZenFinance ("we", "us", or "the app") is developed by{" "}
              <b>Edwin Ng</b>. Your privacy is of paramount importance. This
              Privacy Policy explains how ZenFinance handles your data,
              emphasizing our "Data Sovereignty" model where you, the{" "}
              <b>User</b>, remain in control of your financial information.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              2. The Data Sovereignty Model
            </h2>
            <p>
              Unlike traditional financial apps, the <b>Developer</b> does not
              store your financial data on centralized servers. ZenFinance is
              designed to function using local storage and your personal Google
              Drive account.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Local Storage:</strong> Temporary session data and
                preferences are stored locally on your device.
              </li>
              <li>
                <strong>Google Sheets:</strong> When you connect your Google
                account, financial records are stored in a private spreadsheet
                within your own Google Drive.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              3. Data We Access and How We Use It
            </h2>
            <p>
              To provide our services, the app requests access to your Google
              account via OAuth. This access is limited to:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>Creating and managing the "ZenFinance" spreadsheet.</li>
              <li>
                Reading/writing transactions, accounts, and budget data strictly
                within that file.
              </li>
              <li>
                Accessing basic profile information (email and name) for account
                personalization.
              </li>
            </ul>
            <p>
              We use this data <b>exclusively</b> to provide the core
              functionality of the app: tracking your finances, calculating
              balances, and generating financial insights. We do not use your
              data for advertising or any other non-essential purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              4. AI Processing (Gemini API)
            </h2>
            <p>
              If you use the ZenFinance AI features, relevant financial context
              is sent to Google's Gemini API to generate insights. This data is
              handled according to Google's AI Privacy terms. You can also
              provide your own API key to have direct control over your AI
              usage.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              5. Google API Services User Data Policy
            </h2>
            <p>
              ZenFinance's use and transfer to any other app of information
              received from Google APIs will adhere to the{" "}
              <a
                href="https://developers.google.com/terms/api-services-user-data-policy#additional_requirements_for_specific_api_scopes"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                Google API Services User Data Policy
              </a>
              , including the Limited Use requirements.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              6. Data Sharing and Transfer
            </h2>
            <p>
              We <b>do not sell</b> your Google user data to third parties. We
              only transfer your data to the following third-party services when
              it is necessary to provide or improve the features of ZenFinance:
            </p>
            <ul className="list-disc pl-5 space-y-2 mb-4">
              <li>
                <strong>Google Cloud Platform:</strong> To facilitate Google
                OAuth and interact with the Google Sheets API.
              </li>
              <li>
                <strong>Google Gemini API:</strong> To provide AI-powered
                financial analysis and insights (if enabled by the user).
              </li>
            </ul>
            <p>
              Metadata or anonymized usage data may be used to improve the user
              experience, but your private financial records are never disclosed
              to any other party for any other purpose.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              7. Data Retention and Deletion
            </h2>
            <p>
              Your financial data is stored in your own Google Drive. ZenFinance
              does not maintain a copy of this data on its own servers.
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Retention:</strong> Data persists in your Google Sheet
                as long as you choose to keep it.
              </li>
              <li>
                <strong>Deletion:</strong> You can delete your financial data at
                any time by deleting the "ZenFinance" spreadsheet from your
                Google Drive or by using the reset features within the app.
              </li>
              <li>
                <strong>Revocation:</strong> You can revoke the app's access to
                your Google account via your{" "}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  Google Security Settings
                </a>
                .
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">8. Security</h2>
            <p>
              Since the <b>Developer</b> never session-logs or stores your data
              on private servers, the security of your data largely depends on
              the security of your device and your Google Account. We recommend
              enabling Two-Factor Authentication (2FA) on your Google account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Contact</h2>
            <p>
              If you have questions about this Privacy Policy, you can reach out
              to the <b>Developer</b> at{" "}
              <a
                href="https://notedwin.dev"
                className="text-primary hover:underline"
              >
                https://notedwin.dev
              </a>
              .
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
