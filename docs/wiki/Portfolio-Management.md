# Portfolio Management

This section covers the core mechanics of setting up and maintaining your portfolio data.

## 1. Structure: Platforms vs. Accounts

The system uses a two-tier hierarchy to organize your holdings:

### Platforms (Master Data)
A **Platform** represents the institution where your assets are held.
*   *Examples*: Questrade, Interactive Brokers, Wealthsimple, Computershare.
*   **Setup**: Go to **Settings > Master Data** to create Platforms. You define a "Slug" (ID) and a Name.

### Accounts
An **Account** represents a specific container within a Platform.
*   *Examples*: "TFSA" held at Questrade, "RRSP" held at Interactive Brokers.
*   **Currency**: Each account acts as a "bucket" for a specific currency (e.g., USD Account vs CAD Account). If you have a dual-currency account at a broker, it is best modeled as two separate accounts in this system (e.g., `Questrade-CAD` and `Questrade-USD`) to track cash balances accurately.

## 2. Activity Logging

All changes to your portfolio are recorded as **Activities**. This is an immutable ledger of history.

Navigate to **Activities** in the sidebar to view your history or add new transactions.

### Adding an Activity
Click the **"Add Activity"** button (or Floating Action Button on mobile) to open the form.

#### Smart Entry Features
The form is designed to minimize manual entry:
1.  **Symbol Search**: Type a ticker (e.g., "AAPL" or "VFV") and select from the dropdown. This automatically fills:
    *   **Name**: Official company/ETF name.
    *   **Currency**: The trading currency (e.g., USD for AAPL).
    *   **Current Price**: Fetches the latest market close price to help you estimate costs.
    *   **Investment Type**: Automatically detects if it is an Equity, ETF, or Mutual Fund.

#### Fields
*   **Date**: The transaction date.
*   **Type**: `BUY`, `SELL`, `DIVIDEND`, `STOCK_SPLIT`, `DEPOSIT`, `WITHDRAWAL`.
*   **Quantity & Price**: Enter the raw execution data.
*   **Fee**: Any transaction commission.
*   **Account**: The account where this occurred. Note that selecting an account automatically sets the **Platform**.

### Dividend Automation
Instead of manually logging every dividend payment, use the **Fetch Dividends** feature.

1.  **Scan**: The system scans your holdings against historical market data to find declared dividends.
2.  **Review**: A list of "Found Dividends" is presented. By default, duplicates are hidden.
3.  **DRIP (Re-investment)**: If you participated in a Dividend Re-investment Plan, check the **"Reinvest"** box next to the dividend.
    *   **Result**: The system creates *two* log entries:
        1.  A `DIVIDEND` activity (Cash In).
        2.  A `BUY` activity (Cash Out) for the purchased shares at the market price.

### Data Tools
*   **Bulk Import**: You can upload a CSV file to add multiple activities at once. Use the "Import CSV" option in the Actions menu.
*   **Export CSV**: Download your full activity ledger for backup or external analysis (Excel/Sheets).

## 3. FX and Currencies

### Multi-Currency Mechanics
The platform differs from simple trackers by truly understanding currency separation.

*   **Asset Currency**: Determined by the Symbol (e.g., `KO` is USD).
*   **Account Currency**: Determined by the container (e.g., `TFSA-CAD`).
*   **Conversion**:
    *   When you buy a **USD Asset** in a **CAD Account**, the system calculates the Flow value using the historical FX rate on that specific `Date`.
    *   **Dashboards** aggregate unrelated currencies (e.g. EUR + USD + CAD holdings) into your chosen **Base Currency** using today's live rates.

This ensures that your "Net Worth" is always a single, accurate number, regardless of how international your portfolio is.
