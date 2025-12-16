
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const benchmark = await prisma.benchmark.findUnique({
            where: { id }
        });

        if (!benchmark) {
            return NextResponse.json({ error: 'Benchmark not found' }, { status: 404 });
        }

        if (benchmark.isSystem) {
            return NextResponse.json({ error: 'Cannot delete system benchmark' }, { status: 403 });
        }

        await prisma.benchmark.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to delete benchmark' }, { status: 500 });
    }
}
