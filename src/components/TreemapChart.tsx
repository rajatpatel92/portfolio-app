/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';

interface TreemapChartProps {
    data: any[];
    colorMetric?: string; // e.g., 'inceptionChangePercent' or 'dayChange.percent'
}

// Helper to get color based on performance
const getPerformanceColor = (value: number) => {
    if (value === 0) return '#525252'; // Neutral gray

    // Cap intensity at +/- 20% for visualization
    const intensity = Math.min(Math.abs(value) / 20, 1);

    if (value > 0) {
        // Green shades: from dark green to bright green
        // Using HSL for easier lightness manipulation
        // Base Green: 142, 76%, 36% (#16a34a)
        return `rgba(22, 163, 74, ${0.4 + (intensity * 0.6)})`;
    } else {
        // Red shades: from dark red to bright red
        // Base Red: 0, 84%, 60% (#ef4444)
        return `rgba(239, 68, 68, ${0.4 + (intensity * 0.6)})`;
    }
};

export default function TreemapChart({ data, colorMetric = 'inceptionChange.percent' }: TreemapChartProps) {
    const { format, convert } = useCurrency();

    const treeData: any[] = [
        {
            name: 'Portfolio',
            children: Object.values(data.reduce((acc: any, item: any) => {
                const type = item.type || 'Other';
                if (!acc[type]) {
                    acc[type] = { name: type, children: [] };
                }

                // Extract value for coloring
                let colorValue = 0;
                if (colorMetric.includes('.')) {
                    const parts = colorMetric.split('.');
                    colorValue = item[parts[0]]?.[parts[1]] || 0;
                } else {
                    colorValue = item[colorMetric] || 0;
                }

                acc[type].children.push({
                    name: item.symbol,
                    size: item.value, // Recharts uses 'size' for value
                    colorValue: colorValue,
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
                stroke="#171717" // Dark border to separate tiles
                fill="#262626"
                content={<CustomContent />}
            >
                <Tooltip
                    formatter={(value: number, name: string, props: any) => {
                        const colorVal = props.payload.colorValue;
                        return [
                            format(convert(value, 'USD')),
                            `Value`
                        ];
                    }}
                    content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                                <div style={{
                                    backgroundColor: 'var(--card-bg)',
                                    border: '1px solid var(--card-border)',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    color: 'var(--text-primary)',
                                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
                                }}>
                                    <p style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>{data.name}</p>
                                    <p style={{ fontSize: '0.875rem' }}>Value: {format(convert(data.size, 'USD'))}</p>
                                    <p style={{
                                        fontSize: '0.875rem',
                                        color: data.colorValue >= 0 ? '#4ade80' : '#f87171'
                                    }}>
                                        Return: {data.colorValue?.toFixed(2)}%
                                    </p>
                                </div>
                            );
                        }
                        return null;
                    }}
                />
            </Treemap>
        </ResponsiveContainer>
    );
}

const CustomContent = (props: any) => {
    const { root, depth, x, y, width, height, index, name, colorValue } = props;

    return (
        <g>
            <rect
                x={x}
                y={y}
                width={width}
                height={height}
                style={{
                    fill: depth < 2 ? 'transparent' : getPerformanceColor(colorValue),
                    stroke: '#171717',
                    strokeWidth: 2,
                    strokeOpacity: 1,
                }}
            />
            {depth === 1 ? (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 7}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={14}
                    fontWeight="bold"
                    style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                    {name}
                </text>
            ) : null}
            {depth === 2 && width > 40 && height > 25 ? (
                <text
                    x={x + width / 2}
                    y={y + height / 2}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={11}
                    style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                    {name}
                </text>
            ) : null}
            {depth === 2 && width > 40 && height > 45 ? (
                <text
                    x={x + width / 2}
                    y={y + height / 2 + 14}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.8)"
                    fontSize={10}
                    style={{ pointerEvents: 'none', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                >
                    {colorValue?.toFixed(1)}%
                </text>
            ) : null}
        </g>
    );
};
