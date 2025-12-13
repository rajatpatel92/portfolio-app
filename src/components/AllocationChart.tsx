'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';
import styles from './AllocationChart.module.css';

interface DataPoint {
    name: string;
    value: number;
}

interface AllocationChartProps {
    title: string;
    data: DataPoint[];
    onSelect?: (name: string | null, event?: React.MouseEvent) => void;
    selectedName?: string | null;
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6'];

export default function AllocationChart({ title, data, onSelect, selectedName }: AllocationChartProps) {
    const { format, convert, currency } = useCurrency();

    const chartData = data.map(item => ({
        ...item,
        value: convert(item.value, 'USD')
    })).filter(item => item.value > 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handleClick = (data: any, index: number, e: React.MouseEvent) => {
        if (onSelect) {
            onSelect(data.name === selectedName ? null : data.name, e);
        }
    };

    if (chartData.length === 0) {
        return (
            <div className={styles.container}>
                <h3 className={styles.title}>{title}</h3>
                <div className={styles.empty}>No data available</div>
            </div>
        );
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>{title}</h3>
            <div className={styles.chartWrapper}>
                <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                        <Pie
                            data={chartData}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={90}
                            paddingAngle={5}
                            dataKey="value"
                            onClick={handleClick}
                            cursor="pointer"
                        >
                            {chartData.map((entry, index) => (
                                <Cell
                                    key={`cell-${index}`}
                                    fill={COLORS[index % COLORS.length]}
                                    opacity={selectedName && selectedName !== entry.name ? 0.3 : 1}
                                    stroke={selectedName === entry.name ? 'var(--text-primary)' : 'none'}
                                    strokeWidth={selectedName === entry.name ? 2 : 0}
                                />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => format(value)}
                            contentStyle={{
                                backgroundColor: 'var(--card-bg)',
                                border: '1px solid var(--card-border)',
                                borderRadius: '0.5rem',
                                color: 'var(--text-primary)'
                            }}
                            itemStyle={{ color: 'var(--text-primary)' }}
                        />
                        <Legend
                            layout="horizontal"
                            verticalAlign="bottom"
                            align="center"
                            iconType="circle"
                            wrapperStyle={{ paddingTop: '10px' }}
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            formatter={(value, entry: any) => {
                                const { payload } = entry;
                                const total = chartData.reduce((sum, item) => sum + item.value, 0);
                                const percent = (payload.value / total) * 100;
                                return (
                                    <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', marginRight: '0.5rem' }}>
                                        {value} <span style={{ opacity: 0.7 }}>({percent.toFixed(1)}%)</span>
                                    </span>
                                );
                            }}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
