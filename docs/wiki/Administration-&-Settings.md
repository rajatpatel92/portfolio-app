# Administration & Settings

Control the configuration of your platform workspace.

## 1. User Management
Navigate to **Settings > Users**.

### Roles
*   **ADMIN**: Full access. Can manage users, system settings, and seeing all data.
*   **EDITOR**: Can add/edit Activity data and view reports. Cannot manage users.
*   **VIEWER**: Read-only access to Dashboards and Reports.

### Adding Users
Admins can invite new users by maintaining the user table. New users will be prompt to change their password on first login.

## 2. System Settings
Navigate to **Settings > General**.

### Currency Configuration
*   **Base Currency**: The currency in which the Dashboard aggregates all data (e.g., USD, CAD, EUR).
*   **Exchange Rates**: The system automatically pulls daily FX rates. You can manually override specific rates if needed.

### AI Configuration
*   **Global Toggle**: Located in **System Settings**, this switch controls the AI engine for the entire platform.
*   **Privacy Mode**: When the AI is disabled here, the application runs in strict "Local Mode" with no external calls to LLM APIs. This is designed for privacy-focused investors who do not wish to share even anonymized portfolio context.

### Master Data
Navigate to **Settings > Master Data**.

This is where you define the "Language" of your portfolio:
*   **Platforms**: Define the brokerage firms (e.g. `Questrade`, `Robinhood`).
*   **Asset Classes**: Define high-level categories (e.g., `Equity`, `Fixed Income`, `Crypto`).
*   **Investment Types**: Map specific types (e.g., `ETF`, `Stock`, `Mutual Fund`) to Asset Classes.
    *   *Example*: You might map "REITs" to "Real Estate" and "GICs" to "Fixed Income".

## 3. Theming
Toggle between **Dark Mode** and **Light Mode** using the icon in the Sidebar footer. This preference is saved to your local browser.
