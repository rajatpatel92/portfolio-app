'use client';

import { useState } from 'react';
import styles from './ConstituentsGrid.module.css';
import { useCurrency } from '@/context/CurrencyContext';

interface ChangeData {
    absolute: number;
    percent: number;
}

interface Constituent {
    symbol: string;
    name: string;
    type: string;
    quantity: number;
    price: number;
    avgPrice: number;
    bookValue: number;
    value: number;
    currency: string;
    dayChange: ChangeData;
    change1W: ChangeData | null;
    change1M: ChangeData | null;
    change1Y: ChangeData | null;
    changeYTD: ChangeData | null;
    inceptionChange: ChangeData;

    xirr?: number | null;
    dividendYield?: number;
}

interface ConstituentsGridProps {
    data: Constituent[];
}

export default function ConstituentsGrid({ data }: ConstituentsGridProps) {
    const [showPercent, setShowPercent] = useState(true);
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const { format, convert, currency } = useCurrency();

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedData = [...data].sort((a, b) => {
        if (!sortConfig) return 0;

        const getValue = (item: any, key: string) => {
            const keys = key.split('.');
            let value = item;
            for (const k of keys) {
                value = value[k];
            }
            return value;
        };

        const aValue = getValue(a, sortConfig.key);
        const bValue = getValue(b, sortConfig.key);

        if (aValue < bValue) {
            return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
            return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
    });

    const getColorClass = (value: number) => {
        if (value > 0) return styles.positive;
        if (value < 0) return styles.negative;
        return '';
    };

    const renderChange = (change: ChangeData | null, baseCurrency: string) => {
        if (!change) {
            return <span className={styles.neutral}>-</span>;
        }

        const isPositive = change.absolute >= 0;
        const className = isPositive ? styles.positive : styles.negative;
        const val = convert(change.absolute, baseCurrency || 'USD');

        return (
            <div className={className}>
                <div>{format(val)}</div>
                <div className={styles.percent}>({change.percent.toFixed(2)}%)</div>
            </div>
        );
    };

    const handleRowClick = (symbol: string) => {
        window.location.href = `/analysis/${symbol}`;
    };

    return (
        <div className={styles.container}>
            <div className={styles.header}>
                <h2>Portfolio Constituents</h2>
            </div>

            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.th} onClick={() => handleSort('name')}>Asset</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('bookValue')}>Book Value</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('value')}>Current Value</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('dayChange.absolute')}>Day</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('change1W.absolute')}>1W</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('change1M.absolute')}>1M</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('change1Y.absolute')}>1Y</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('changeYTD.absolute')}>YTD</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('inceptionChange.absolute')}>ALL</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('dividendYield')}>Yield</th>
                            <th className={`${styles.th} ${styles.right}`} onClick={() => handleSort('xirr')}>XIRR</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedData.map((item) => (
                            <tr
                                key={item.symbol}
                                className={styles.tr}
                                onClick={() => handleRowClick(item.symbol)}
                                style={{ cursor: 'pointer' }}
                            >
                                <td className={styles.td}>
                                    <div className={styles.symbol}>{item.symbol}</div>
                                    {item.name !== item.symbol && <div className={styles.name}>{item.name}</div>}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    <div>{format(convert(item.bookValue, item.currency))}</div>
                                    <div className={styles.subtext}>
                                        {format(convert(item.avgPrice, item.currency))} / unit
                                    </div>
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    <div>{format(convert(item.value, item.currency))}</div>
                                    <div className={styles.subtext}>
                                        {format(convert(item.price, item.currency))} / unit
                                    </div>
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {renderChange(item.dayChange, item.currency)}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {renderChange(item.change1W, item.currency)}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {renderChange(item.change1M, item.currency)}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {renderChange(item.change1Y, item.currency)}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {renderChange(item.changeYTD, item.currency)}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {renderChange(item.inceptionChange, item.currency)}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {item.dividendYield ? `${(item.dividendYield * 100).toFixed(2)}%` : '-'}
                                </td>
                                <td className={`${styles.td} ${styles.right} ${getColorClass(item.xirr || 0)}`}>
                                    {item.xirr ? `${(item.xirr * 100).toFixed(2)}%` : '-'}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
