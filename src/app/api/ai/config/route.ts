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

        const isEnabled = settingsMap['AI_ENABLED'] !== 'false'; // Default to true if missing

        const availableModels: string[] = [];
        if (settingsMap['GEMINI_API_KEY']) availableModels.push('GEMINI');
        if (settingsMap['GPT_API_KEY']) availableModels.push('GPT');
        if (settingsMap['CLAUDE_API_KEY']) availableModels.push('CLAUDE');

        // Allow fetching this even if disabled, so UI can show "Disabled" state if needed
        return NextResponse.json({
            enabled: isEnabled,
            availableModels
        });

    } catch (error) {
        console.error('Failed to fetch AI config:', error);
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
