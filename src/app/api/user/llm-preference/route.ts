import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
    const session = await auth();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const username = (session?.user as any)?.username || session?.user?.name;

    if (!username) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { model } = await req.json();

    if (!['GEMINI', 'GPT', 'CLAUDE'].includes(model)) {
        return new NextResponse('Invalid model', { status: 400 });
    }

    await prisma.user.update({
        where: { username },
        data: { preferredLLM: model }
    });

    return NextResponse.json({ success: true });
}
