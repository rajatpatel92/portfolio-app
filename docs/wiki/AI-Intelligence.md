# AI Intelligence

The **Portfolio Intelligence** module (Beta) brings large language model (LLM) capabilities to your financial data.

## Features

### 1. Chat Interface
Located at **/ai-analysis**, the chat interface allows you to ask natural language questions about your portfolio.

*   *Examples*:
    *   "What is my exposure to the Technology sector?"
    *   "How has my portfolio performed compared to inflation since 2020?"
    *   "Suggest a rebalancing strategy to reduce my US Equity exposure."

### 2. Context Awareness
The AI is "grounded" in your data. It knows:
*   Your current holdings and their value.
*   Your transaction history.
*   Your platform and account structure.

It *does not* have access to your bank login credentials or the ability to execute trades on your behalf.

### 3. Privacy & Configuration

> [!NOTE]
> **Privacy First**: The AI Intelligence module is **entirely optional**. For investors who prefer complete data isolation, this feature can be completely disabled.

**Enable/Disable**
*   **Global Level**: Administrators can toggle the AI feature on/off for the entire instance. If disabled globally, no data is ever sent to any LLM provider.
*   **User Level**: Each user can opt-in or opt-out in their Profile settings.

**Data Privacy**
When you ask a question, a minimized, anonymized context of your portfolio (Symbols, Weights, Values) is sent to the LLM provider (e.g., Google Gemini, OpenAI). Please review your provider's privacy policy regarding data usage.

> [!IMPORTANT]
> The AI provides *information*, not *financial advice*. Always verify key metrics on the standard Dashboard before making investment decisions.
