# Changelog

All notable changes to this project will be documented in this file.

## [1.5.0] - 2026-02-02

### Added

- **Multi-Device Passkey Support**: Users can now register and manage multiple biometric credentials (TouchID/FaceID) across different devices.
- **Enhanced Vault Security**: Vault passwords are now encrypted using local device keys before being stored in session storage.
- **Offline Mode**: Comprehensive support for offline usage with status notifications and local data persistence.
- **Device Tracking**: Added tracking for trusted devices to improve biometric restoration and security management.
- **Redirection Logic**: Improved UX by adding proper redirection for unauthorized users and smoother logout transitions.

### Changed

- **Profile Management**: Refactored `updateProfile` to allow skipping cloud sync for performance-sensitive updates.
- **UI Improvements**: Updated icon styling and spacing across several components (AccountCard, AccountPage).

## [1.4.0] - 2026-02-01

### Added

- **Secure Vault v1**: Initial implementation of the secure vault with AES-GCM encryption for bank details.
- **Biometric Authentication**: Integration with WebAuthn for unlocking sensitive data.
- **Dashboard Charts**: New Monthly Breakdown and Revenue charts for better financial visualization.
- **State Management**: Implemented `DataProvider` and `DataContext` for unified state handling across the app.

### Fixed

- **Formatting**: Improved currency and amount display formatting in Budgets and AccountPage.
- **Pot Management**: Refactored Spending Pots to use clearer terminology (`limitAmount`, `usedAmount`, `amountLeft`).

## [1.3.0] - 2026-01-31

### Added

- **Gemini 2.5 Support**: Updated generative model to Gemini 2.5 Flash for improved financial analysis.
- **AI-Powered Subscriptions**: Enhanced AI insights to handle subscription data and access requests.
- **Mobile Navigation**: Added links to Privacy Policy and Terms of Service in the auth flow.
- **Vercel Deployment**: Added configuration for seamless redirects on Vercel.

### Changed

- **Crypto Integration**: Migrated to CoinGecko API for real-time cryptocurrency price tracking.

### Fixed

- **Calculations**: Fixed `currentAmount` logic for goals linked to account balances.
- **AI UX**: Improved suggested responses format and clarified spending limit terminology.

## [1.2.0] - 2026-01-30

### Added

- **Account Analytics**: Comprehensive history and analytics page for individual accounts.
- **Assets Page**: A dedicated view to track all assets and net worth.
- **Live Patching**: Added a utility script for live recalculation of Google Sheets balances.
- **Crypto Visualization**: Live crypto prices integration using CoinGecko and updated dashboard filters.

### Changed

- **Data Engine**: Switched balance calculations to a more robust helper-based approach integrated with Sheets.

## [1.1.0] - 2026-01-29

### Added

- **Multi-Currency Support**: Comprehensive exchange rate handling and CurrencyRateCard component (USD/MYR).
- **Cloud Chat Sync**: Added option to sync AI chat sessions directly to Google Sheets.
- **AI Chat Route**: Dedicated navigation for full-screen financial assistant interactions.
- **Backend Auth Proxy**: Implemented proxy for unauthenticated requests and improved token security.

### Changed

- **Profile Layout**: Revamped Settings/Profile layout with categorized items and better iconography.
- **Localization**: Updated date formatting across all components to respect local locales.

### Fixed

- **Data Consistency**: Enhanced transaction handling to ensure account and pot balances update atomically.
- **Date Handling**: Implemented `parseDateSafe` to handle inconsistent date formats from legacy imports.

## [1.0.1] - 2026-01-28

### Added

- **Route-Based Architecture**: Implemented React Router for Landing, Auth, and Policy pages.
- **Enhanced Auth Flow**: Added unified email login and improved Google OAuth token refresh logic.
- **Smart Form Inputs**: Implemented auto-decimal formatting and optimized amount handling in transaction forms.
- **Data Recovery**: Added a "Legacy Data Rescue" banner to migrate data from early prototypes to the new Sheets engine.
- **Goal Linking**: Added ability to link saving goals directly to bank account balances.

### Changed

- **AI Infrastructure**: Updated to `react-markdown` and `remark-gfm` for formatted financial reports.
- **Performance**: Optimized Google Sheets integration with batch row updates and better error handling.

## [1.0.0] - 2026-01-27

### Added

- **Initial Release**: Basic finance tracking with Google Sheets sync.
- **AI Financial Advice**: Integration with Google Gemini for basic chat sessions.
- **Core Features**: Accounts, Transactions, Categories, and Goals.
