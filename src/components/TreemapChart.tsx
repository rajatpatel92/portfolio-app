'use client';

import { ResponsiveContainer, Treemap, Tooltip } from 'recharts';
import { useCurrency } from '@/context/CurrencyContext';

interface TreemapChartProps {
    data: any[];
}

const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57'];

export default function TreemapChart({ data }: TreemapChartProps) {
    const { format, convert } = useCurrency();

    // Transform data into hierarchy: Root -> Type -> Symbol
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
                    size: item.value, // Recharts uses 'size' for value
                    ...item
                });
                return acc;
            }, {}))
        }
    ];

    const CustomContent = (props: any) => {
        const { root, depth, x, y, width, height, index, name, value } = props;

        return (
            <g>
                <rect
                    x={x}
                    y={y}
                    width={width}
                    height={height}
                    style={{
                        fill: depth < 2 ? COLORS[index % COLORS.length] : 'rgba(255,255,255,0)',
                        stroke: '#fff',
                        strokeWidth: 2 / (depth + 1e-10),
                        strokeOpacity: 1 / (depth + 1e-10),
                    }}
                />
                {depth === 1 ? (
                    <text
                        x={x + width / 2}
                        y={y + height / 2 + 7}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={14}
                    >
                        {name}
                    </text>
                ) : null}
                {depth === 2 && width > 50 && height > 30 ? (
                    <text
                        x={x + width / 2}
                        y={y + height / 2}
                        textAnchor="middle"
                        fill="#fff"
                        fontSize={12}
                    >
                        {name}
                    </text>
                ) : null}
            </g>
        );
    };

    return (
        <ResponsiveContainer width="100%" height="100%">
            <Treemap
                data={treeData}
                dataKey="size"
                aspectRatio={4 / 3}
                stroke="#fff"
                fill="#8884d8"
                content={<CustomContent />}
            >
                <Tooltip
                    formatter={(value: number) => format(convert(value, 'USD'))}
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
