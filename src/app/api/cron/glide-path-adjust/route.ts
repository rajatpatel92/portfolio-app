import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const targets = await prisma.targetAllocation.findMany({
            where: {
                yearlyDriftAdjustment: { not: null }
            }
        });

        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

        const updated = [];

        for (const target of targets) {
            // Compare against last adjustment date or creation date
            const referenceDate = target.lastAdjustmentDate || target.createdAt;
            
            if (referenceDate <= oneYearAgo) {
                const newTarget = Math.max(0, target.targetPercentage + (target.yearlyDriftAdjustment || 0));
                
                const res = await prisma.targetAllocation.update({
                    where: { id: target.id },
                    data: {
                        targetPercentage: newTarget,
                        lastAdjustmentDate: new Date()
                    }
                });
                updated.push({
                    symbol: target.symbol,
                    oldTarget: target.targetPercentage,
                    newTarget: newTarget
                });
            }
        }

        return NextResponse.json({
            success: true,
            adjustedCount: updated.length,
            updated
        });
    } catch (error: any) {
        console.error('Glide Path Cron Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
