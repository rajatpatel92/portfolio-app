/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';

interface PerformanceHeatmapProps {
    data: any[];
}

const getColor = (performance: number) => {
    // Simple Green/Red gradient logic
    if (performance >= 3) return '#15803d'; // Strong Green
    if (performance >= 1) return '#22c55e'; // Green
    if (performance >= 0) return '#4ade80'; // Light Green
    if (performance > -1) return '#f87171'; // Light Red
    if (performance > -3) return '#ef4444'; // Red
    return '#b91c1c'; // Strong Red
};

const CustomContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, performance } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: depth === 2 ? getColor(performance) : 'none',
                    stroke: '#fff',
                    strokeWidth: 2 / (depth + 1e-10),
                    strokeOpacity: 1 / (depth + 1e-10),
                }}
            />
            {depth === 2 && width > 40 && height > 20 ? (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={12}
                    fontWeight="bold"
                >
                    {name}
                    <tspan x={x + width / 2} dy="1.2em" fontSize={10} fontWeight="normal">
                        {performance?.toFixed(2)}%
                    </tspan>
                </text>
            ) : null}
        </g>
    );
};

export default function PerformanceHeatmap({ data }: PerformanceHeatmapProps) {
    const { format, convert } = useCurrency();

    // Transform data: Root -> Symbol (Flat hierarchy for heatmap usually works best, or grouped by type)
    // Let's group by Type for structure, but color by performance
    const treeData: any[] = [
        {
            name: 'Portfolio',
            children: Object.values(data.reduce((acc: any, item: any) => {
                const type = item.type || 'Other';
                if (!acc[type]) {
                    acc[type] = { name: type, children: [] };
                }
                acc[type].children.push({
                    name: item.symbol,
                    size: item.value,
                    performance: item.dayChange?.percent || 0, // Assuming dayChange exists
                    ...item
                });
                return acc;
            }, {}))
        }
    ];

    return (
        <ResponsiveContainer width="100%" height="100%">
            <Treemap
                data={treeData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                content={<CustomContent />}
            >
                <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                        `${props.payload.performance?.toFixed(2)}%`,
                        'Performance'
                    ]}
                    contentStyle={{
                        backgroundColor: 'var(--card-bg)',
                        border: '1px solid var(--card-border)',
                        borderRadius: '0.5rem',
                        color: 'var(--text-primary)'
                    }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                />
            </Treemap>
        </ResponsiveContainer>
    );
}
