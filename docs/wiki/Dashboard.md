# Dashboard

The Dashboard is the command center of the platform, providing an immediate snapshot of your financial health and performance.

[Screenshot: Dashboard Full View]

## Key Widgets

### 1. Summary Cards
Located at the top, these cards provide the "at-a-glance" numbers you check daily.

*   **Total Net Worth**: The sum of the current market value of all holdings across all accounts, converted to your base currency.
*   **Day Change**: The absolute and percentage change in your portfolio value since the previous market (or day) close.
*   **Portfolio XIRR**: Your money-weighted return rate (see *Key Metrics* below).
*   **All Time Return**: The total percentage growth of your portfolio NAV (Net Asset Value) since inception.

### 2. Performance Chart
A visual representation of your portfolio's performance over time. You can toggle between:
*   **1M, 6M, YTD, 1Y, ALL**: Preset time ranges.
*   **Custom Range**: Select specific start and end dates.

The chart plots the percentage return relative to the start of the selected period.

### 3. Insights Grid
*   **Top Movers**: The assets with the largest positive and negative % change for the day.
*   **Dividend Summary**: Your passive income stats. Including "Year to Date" received and "Projected" annual income based on current holdings.

---

## 🧮 Key Metrics Explained

The platform uses professional-grade financial formulas to ensure accuracy.

### XIRR (Extended Internal Rate of Return)

**What is it?**
XIRR is your "Dollar-Weighted Return". It tells you: *"Given the specific dates I deposited money and the specific dates I withdrew money, what annual interest rate would I need to get from a bank to match my current ending balance?"*

It is the best metric for understanding your **personal performance** because it accounts for your timing. If you add money right before the market drops, your XIRR will be punished more than TWR.

**The Math:**
We solve for the rate $r$ in the following equation using the **Newton-Raphson approximation method**:

$$ \sum_{i=0}^{N} \frac{C_i}{(1+r)^{\frac{d_i - d_0}{365}}} = 0 $$

Where:
*   $C_i$: Cash flow amount (positive for deposits/current value, negative for withdrawals).
*   $d_i$: Date of the cash flow.
*   $d_0$: Date of the first cash flow.
*   $r$: The annual return rate (XIRR).

*Example*:
1.  Jan 1: Invest $1,000.
2.  Jun 1: Invest $1,000.
3.  Dec 31: Portfolio Value is $2,200.
The algorithm finds the specific $r$ that equates these flows to zero.

### TWR (Time-Weighted Return)

**What is it?**
TWR is the "Portfolio Manager's Return". It isolates the performance of your *investments* from the timing of your *deposits*.

If you deposit $1M and the market stays flat, your *profit* (P&L) is $0, but your Total Value is massive. Simple growth metrics might get confused. TWR handles this by treating your portfolio like a Mutual Fund. Every time you deposit money, you buy "Units" of your portfolio at the current "NAV" (Net Asset Value).

**The Math:**
We calculate the **NAV** (Unit Price) daily.

1.  **Start**: Day 0, NAV = 100.
2.  **Daily Update**:
    $$ NAV_{today} = NAV_{yesterday} \times \left( \frac{PassiveValue_{today}}{MarketValue_{yesterday}} \right) $$

    *   *PassiveValue* = Value of holdings held yesterday * Today's Price (ignoring today's new deposits).
    *   *MarketValue* = Total ending value yesterday.

3.  **TWR Formula**:
    $$ TWR = \frac{NAV_{current} - NAV_{start}}{NAV_{start}} \times 100\% $$

**Why use TWR?**
It allows fairness. If you double your savings rate, it doesn't "distort" your performance chart. It shows purely how well your *stocks* performed, not how much you saved.

### All Time Return
This is simply the TWR calculated from the very first deposit (Inception) to Today.

---
## Calculating "Day Change"
Day change is calculated as:
$$ \sum (Quantity \times (CurrentPrice - PreviousClosePrice) \times FXRate) $$

Note that for foreign assets, the Day Change also includes the impact of Currency Fluctuations (FX) for that day.
