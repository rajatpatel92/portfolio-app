# Analysis & Reports

The Analysis module provides four specialized lenses to view your portfolio.

## 1. Allocation
**"What do I own?"**

This page visualizes your portfolio diversification.

*   **By Asset Class**: Stocks vs. ETFs vs. Cash (defined in your Master Data).
*   **By Sector**: Technology, Financials, Healthcare, etc. (Automated for ETFs via specific logic).
*   **By Geography**: US, Canada, International.
*   **By Currency**: Exposure to USD, CAD, EUR, etc.

*Tip: Click on any slice of the donut chart to drill down into specific holdings.*

## 2. Comparison
**"How am I doing vs the Market?"**

Benchmarking is critical to know if your active management is adding value.

*   **Benchmark Selection**: Choose from indices like S&P 500 (`^GSPC`) or Nasdaq (`^IXIC`).
*   **Normalization**: The chart starts both your portfolio and the benchmark at 0% for the selected time range.
*   **Top/Bottom Performers**: A leaderboard of your individual holdings' performance over the selected period.

## 3. Evolution
**"How has my wealth grown?"**

A historical line chart of your **Net Asset Value (NAV)**.
Unlike the Performance chart (which shows %), this shows absolute currency value.

*   **Filters**: You can filter the evolution view by specific Groups (e.g., "Only show me my Retirement accounts").

## 4. FIRE Calculator
**"When can I retire?"**

The Financial Independence / Retire Early (FIRE) tool projects your future freedom.

### Inputs
*   **Current Net Worth**: Auto-filled from your dashboard.
*   **Annual Savings**: Your estimated yearly contribution.
*   **Annual Expenses**: Your target spending in retirement.
*   **Growth Rate**: Assumed market return (e.g., 7%).
*   **Safe Withdrawal Rate (SWR)**: Typically 4% (The "4% Rule").

### Outputs
*   **FI Number**: The target portfolio size needed ($Expenses / 0.04$).
*   **Years to FI**: How many years until you hit that number.
*   **The Chart**: A projection of your Net Worth growth (Logarithmic or Linear) crossing your FI Target line.

> [!NOTE]
> The FIRE calculator assumes constant inflation-adjusted returns. Future updates will support Monte Carlo simulations for probability-based success rates.
