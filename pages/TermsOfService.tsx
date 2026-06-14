import React from "react";
import { LegalDocumentLayout } from "./legal/legal-document-layout";
import { LegalSection } from "./legal/legal-section";

const TermsOfService: React.FC = () => (
	<LegalDocumentLayout title="Terms of Service" lastUpdated="31st January 2026">
		<LegalSection title="1. Acceptance of Terms">
			<p>
				By accessing or using ZenFinance, you, the **User**, agree to be
				bound by these Terms of Service. If you do not agree, please do not
				use the application.
			</p>
		</LegalSection>

		<LegalSection title="2. Description of Service">
			<p>
				ZenFinance is a financial tracking tool provided by the **Developer**
				(**Edwin Ng**). The tool is provided "as-is" and is currently
				completely free to use.
			</p>
		</LegalSection>

		<LegalSection title="3. User Responsibility">
			<p>As a **User**, you are solely responsible for:</p>
			<ul className="list-disc pl-5 space-y-2">
				<li>The accuracy of the financial data you enter.</li>
				<li>The security and maintenance of your Google Sheet.</li>
				<li>Any actions taken by the AI based on your data context.</li>
			</ul>
		</LegalSection>

		<LegalSection title="4. No Financial Advice">
			<p>
				The content provided by ZenFinance, including AI insights, is for
				informational purposes only and does not constitute professional
				financial, investment, or legal advice. Always consult with a
				qualified professional before making significant financial decisions.
			</p>
		</LegalSection>

		<LegalSection title="5. Limitation of Liability">
			<p>
				The **Developer** shall not be liable for any data loss, financial
				loss, or damages arising from your use of ZenFinance. Since the data
				is stored in your own Google Drive, we have no way to recover lost
				data if you delete your spreadsheet or lose access to your account.
			</p>
		</LegalSection>

		<LegalSection title="6. Intellectual Property">
			<p>
				The code, design, and branding of ZenFinance are the property of the
				**Developer**. You may not reproduce or distribute any part of the
				app without explicit permission.
			</p>
		</LegalSection>

		<LegalSection title="7. Termination">
			<p>
				The **Developer** reserves the right to discontinue or modify the
				service at any time without notice. You can stop using the service at
				any time by disconnecting your Google account and deleting your
				data.
			</p>
		</LegalSection>

		<LegalSection title="8. Governing Law">
			<p>
				These terms are governed by the laws applicable to the
				**Developer's** jurisdiction.
			</p>
		</LegalSection>

		<LegalSection title="9. Contact">
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
		</LegalSection>
	</LegalDocumentLayout>
);

export default TermsOfService;
