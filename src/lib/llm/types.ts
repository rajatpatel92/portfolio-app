export type LLMModel = 'GEMINI' | 'GPT' | 'CLAUDE';

export interface LLMRequest {
    prompt: string;
    context?: string; // JSON string of portfolio data
    systemInstruction?: string;
    history?: LLMMessage[];
}

export interface LLMMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}

export interface LLMResponse {
    content: string;
    metadata?: {
        model: string;
        tokensUsed?: number;
        error?: string;
    };
}

export interface LLMProvider {
    generateResponse(request: LLMRequest, apiKey: string): Promise<LLMResponse>;
    streamResponse?(request: LLMRequest, apiKey: string): AsyncGenerator<string, void, unknown>;
}
