import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { LLMService } from '@/lib/llm/service';
import { NextResponse } from 'next/server';
import { LLMModel } from '@/lib/llm/types';

export async function POST(req: Request) {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const username = (session?.user as any)?.username || session?.user?.name;

    if (!username) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { prompt, messages } = await req.json();

    if (!prompt) {
        return new NextResponse('Missing prompt', { status: 400 });
    }

    try {
        // 1. Get User Preference
        const user = await prisma.user.findUnique({
            where: { username },
            select: { preferredLLM: true, id: true } // Need ID for portfolio fetching
        });

        const model = (user?.preferredLLM || 'GEMINI') as LLMModel;

        // 2. Fetch Portfolio Data (Simplified Context)
        // In a real scenario, we might want to be selective about what data we send
        // 2. Fetch Portfolio Data (Filtered for Current Holdings)
        // Fetch all activities to calculate current state
        const activities = await prisma.activity.findMany({
            include: {
                investment: true
            },
            orderBy: { date: 'asc' }
        });

        // Import dynamically to avoid circular deps if any (though likely fine here)
        const { PortfolioAnalytics } = await import('@/lib/portfolio-analytics');

        // Calculate current quantities
        const currentHoldingsMap = PortfolioAnalytics.computeHoldingsState(activities);

        // Filter valid holdings and map to context format
        const portfolio = Object.entries(currentHoldingsMap)
            .filter(([_, qty]) => qty > 0.0001) // Filter out sold/zero positions
            .map(([symbol, qty]) => {
                // Find investment details
                const activity = activities.find(a => a.investment.symbol === symbol);
                return {
                    symbol: symbol,
                    name: activity?.investment.name || symbol,
                    currency: activity?.investment.currencyCode || 'USD',
                    quantity: qty,
                    type: activity?.investment.type || 'Unknown'
                };
            });

        const context = JSON.stringify(portfolio);

        // 3. Call LLM Service
        const history = messages?.map((m: any) => ({
            role: m.role === 'user' ? 'user' : 'assistant', // Normalize
            content: m.content
        })) || [];

        const response = await LLMService.analyze(model, {
            prompt,
            context,
            history,
            systemInstruction: "You are a helpful financial portfolio assistant. Analyze the user's portfolio data provided in context. Be concise and insightful."
        });

        return NextResponse.json(response);

    } catch (error: any) {
        console.error('Analysis failed:', error);
        return new NextResponse(error.message || 'Internal Server Error', { status: 500 });
    }
}
