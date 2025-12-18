
'use client';

import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Legend,
    ReferenceLine
} from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';

interface Props {
    data: { date: string; inflow: number; outflow: number }[];
    period: 'week' | 'month' | 'year';
}

export default function ContributionChart({ data, period }: Props) {
    const { format } = useCurrency();
    const { formatDate } = useDate();

    const processedData = data.map(d => ({
        ...d,
        outflow: -Math.abs(d.outflow),
        net: d.inflow - Math.abs(d.outflow)
    }));

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={processedData} margin={{ top: 30, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(str) => {
                            const date = new Date(str);
                            if (period === 'year') return date.getFullYear().toString();
                            if (period === 'month') return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
                            return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        }}
                        stroke="#9ca3af"
                        fontSize={12}
                        tickMargin={10}
                    />
                    <YAxis
                        tickFormatter={(val) => format(val, { notation: 'compact' })}
                        stroke="#9ca3af"
                        fontSize={12}
                        tickMargin={10}
                        width={80}
                    />
                    <Tooltip
                        formatter={(val: number) => format(val)}
                        labelFormatter={(label) => formatDate(label)}
                        contentStyle={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '0.5rem',
                            color: 'var(--text-primary)'
                        }}
                    />
                    <Legend verticalAlign="top" />
                    <ReferenceLine y={0} stroke="#9ca3af" />
                    <Bar dataKey="inflow" name="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflow" name="Outflow" fill="#ef4444" radius={[0, 0, 4, 4]} />
                    <Line type="monotone" dataKey="net" name="Net Flow" stroke="#2563eb" dot={false} strokeWidth={2} />
                </ComposedChart>
            </ResponsiveContainer>
        </div>
    );
}
