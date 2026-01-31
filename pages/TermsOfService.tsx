import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

const TermsOfService: React.FC = () => {
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

        <h1 className="text-4xl font-black text-white mb-2">
          Terms of Service
        </h1>
        <p className="text-gray-500 mb-8 uppercase tracking-widest text-sm font-bold">
          Last Updated: 31st January 2026
        </p>

        <div className="prose prose-invert prose-primary max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              1. Acceptance of Terms
            </h2>
            <p>
              By accessing or using ZenFinance, you, the **User**, agree to be
              bound by these Terms of Service. If you do not agree, please do
              not use the application.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              2. Description of Service
            </h2>
            <p>
              ZenFinance is a financial tracking tool provided by the
              **Developer** (**Edwin Ng**). The tool is provided "as-is" and is
              currently completely free to use.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              3. User Responsibility
            </h2>
            <p>As a **User**, you are solely responsible for:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>The accuracy of the financial data you enter.</li>
              <li>The security and maintenance of your Google Sheet.</li>
              <li>Any actions taken by the AI based on your data context.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              4. No Financial Advice
            </h2>
            <p>
              The content provided by ZenFinance, including AI insights, is for
              informational purposes only and does not constitute professional
              financial, investment, or legal advice. Always consult with a
              qualified professional before making significant financial
              decisions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              5. Limitation of Liability
            </h2>
            <p>
              The **Developer** shall not be liable for any data loss, financial
              loss, or damages arising from your use of ZenFinance. Since the
              data is stored in your own Google Drive, we have no way to recover
              lost data if you delete your spreadsheet or lose access to your
              account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              6. Intellectual Property
            </h2>
            <p>
              The code, design, and branding of ZenFinance are the property of
              the **Developer**. You may not reproduce or distribute any part of
              the app without explicit permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              7. Termination
            </h2>
            <p>
              The **Developer** reserves the right to discontinue or modify the
              service at any time without notice. You can stop using the service
              at any time by disconnecting your Google account and deleting your
              data.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">
              8. Governing Law
            </h2>
            <p>
              These terms are governed by the laws applicable to the
              **Developer's** jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-bold text-white mb-4">9. Contact</h2>
            <p>
              For any legal inquiries, visit{" "}
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

export default TermsOfService;
