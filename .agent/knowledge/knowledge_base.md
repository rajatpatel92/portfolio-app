---
name: Portfolio Knowledge Base
description: General knowledge, architecture, and core context of the Portfolio App.
---
# Portfolio App - AI Knowledge Base

This document serves as a persistent knowledge base, summarizing key context, features, technical decisions, and lessons learned from developing the `portfolio-app`.

## 1. Project Overview
The `portfolio-app` is a comprehensive investment tracking and portfolio management application. It helps users monitor their holdings, analyze performance (like XIRR and dividend yields), manage multi-currency investments, and automate activity logging.

## 2. Core Features & Capabilities

### Dashboard & Analytics
- **Performance Tracking (XIRR):** Calculates accurate return rates. Filtering by `investmentTypes` and `accountTypes` is handled server-side via the `/api/portfolio` endpoint to ensure accuracy across the dashboard.
- **Portfolio Returns Chart:** Features optimized, cached charting (e.g., 1D charts) to drastically reduce loading times and improve performance.
- **Multi-Currency Support:** Fully supports tracking and viewing portfolios in different currencies. Currency contexts are passed securely from the client UI down to the APIs, ensuring all child components display the accurate, converted figures.

### Asset & Dividend Analysis
- **Symbol Analysis:** Provides deep-dives into specific assets, including a "Dividends Received" section that breaks down income by month and year. This view is styled consistently with UI elements like "Account Allocation" progress bars.
- **Dividend Automation:** Automatically fetches dividend events and correctly logs Dividend Reinvestment Plans (DRIP).

### Data Entry & Management
- **Smart Activity Entry:** Enhances user experience by auto-determining investment types, smart symbol searching, and streamlining manual activity entries.
- **Data Tools:** Fully supports bulk import and export of activities for power users.
- **AI Settings:** Includes a global AI enablement switch that dynamically updates layout contexts (like the Sidebar) via seamless router refreshes, avoiding hard page reloads.

## 3. Technical Architecture & Stack
- **Frontend & API:** Built using React/Next.js (utilizing `page.module.css`, server-side endpoint routing like `/api/portfolio`, and router refresh mechanisms).
- **CI/CD & Containerization:** Dockerized architecture utilizing GitHub Actions. (Note: historical context includes resolving architecture-specific `qemu` emulation errors during continuous integration builds).
- **State & Data Flow:** Emphasis on moving heavy calculations (currency conversion, filtered XIRR) to backend API endpoints instead of resolving them on the client side.

## 4. Key Lessons Learned & Pitfalls Avoided

1. **Floating-Point Precision:** Financial math requires strict precision handling. We've previously mitigated issues in `getHoldingsAtDate` where floating-point errors resulted in "ghost dividends" (entries with near-zero quantities). Tolerate and clamp these micro-values.
2. **Server-Side Derivations:** Shifting complex filtering (XIRR, currency calculations) to the backend API prevents client-side regressions, ensuring that whatever the Dashboard displays is universally accurate.
3. **Reactive UI States:** System-wide settings (such as AI toggles) must instantly propagate across disconnected components (like Layouts and Sidebars) leveraging Next.js router refreshes rather than relying on manual browser reloads.
4. **Consistent UI Design:** Maintaining a uniform CSS aesthetic (aligning header buttons gracefully, matching progress bar styles across different data tiles) is paramount for the app's premium feel.
