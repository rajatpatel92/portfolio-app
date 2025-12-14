
'use client';

import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';

interface Props {
    data: { date: string; amount: number }[];
    period: 'month' | 'year';
}

export default function DividendChart({ data, period }: Props) {
    const { format } = useCurrency();
    const { formatDate } = useDate();

    return (
        <div style={{ width: '100%', height: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis
                        dataKey="date"
                        tickFormatter={(str) => {
                            const date = new Date(str);
                            if (period === 'year') return date.getFullYear().toString();
                            return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
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
                        formatter={(val: number) => [format(val), 'Dividends']}
                        labelFormatter={(label) => formatDate(label)}
                        contentStyle={{
                            backgroundColor: 'var(--card-bg)',
                            border: '1px solid var(--card-border)',
                            borderRadius: '0.5rem',
                            color: 'var(--text-primary)'
                        }}
                        itemStyle={{ color: '#8b5cf6' }}
                    />
                    <Bar dataKey="amount" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}
