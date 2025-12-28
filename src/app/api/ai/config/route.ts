import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { SystemSetting } from '@prisma/client';

export async function GET() {
    const session = await auth();
    if (!session?.user) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    try {
        const keys = ['AI_ENABLED', 'GEMINI_API_KEY', 'GPT_API_KEY', 'CLAUDE_API_KEY'];
        const settings = await prisma.systemSetting.findMany({
            where: { key: { in: keys } }
        });

        const settingsMap = settings.reduce((acc: Record<string, string>, s: SystemSetting) => ({ ...acc, [s.key]: s.value }), {} as Record<string, string>);

        const globalEnabled = settingsMap['AI_ENABLED'] === 'true';
        const userEnabled = (session.user as any).aiEnabled !== false; // Default true

        // If globally disabled or user disabled, return limited config
        if (!globalEnabled || !userEnabled) {
            return NextResponse.json({
                availableModels: [], // No models available
                isAIEnabled: false // Explicitly false
            });
        }

        const availableModels: string[] = [];
        if (settingsMap['GEMINI_API_KEY']) availableModels.push('GEMINI');
        if (settingsMap['GPT_API_KEY']) availableModels.push('GPT');
        if (settingsMap['CLAUDE_API_KEY']) availableModels.push('CLAUDE');

        return NextResponse.json({
            availableModels,
            isAIEnabled: true
        });

    } catch (error) {
        console.error('Failed to fetch AI config:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
