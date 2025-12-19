/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import styles from './ConstituentsGrid.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import { formatQuantity } from '@/lib/format';

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
    lifetimeDividends?: number;
    realizedGain?: number;
    dividendsYTD?: number;
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

    // Filter active assets for the main table body
    const EPSILON = 0.000001;
    const activeAssets = data.filter(d => d.quantity >= EPSILON);
    const soldAssets = data.filter(d => d.quantity < EPSILON);

    const sortedData = [...activeAssets].sort((a, b) => {
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

    const router = useRouter();

    const handleRowClick = (symbol: string) => {
        router.push(`/analysis/${symbol}?from=allocation`);
    };

    return (
        <div className={styles.container}>


            <div className={styles.tableWrapper}>
                <table className={styles.table}>
                    <thead>
                        <tr>
                            <th className={styles.th} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('name')}>Asset</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('bookValue')}>Book Value</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('value')}>Current Value</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('dayChange.absolute')}>Day</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('change1W.absolute')}>1W</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('change1M.absolute')}>1M</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('change1Y.absolute')}>1Y</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('changeYTD.absolute')}>YTD</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('inceptionChange.absolute')}>ALL</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('lifetimeDividends')}>Dividend</th>
                            <th className={`${styles.th} ${styles.right}`} style={{ position: 'sticky', top: 0, zIndex: 20, background: 'var(--card-bg)', boxShadow: '0 1px 0 var(--card-border)' }} onClick={() => handleSort('xirr')}>XIRR</th>
                        </tr>
                    </thead>
                    <tbody>
                        <AnimatePresence mode="popLayout">
                            {sortedData.map((item) => (
                                <motion.tr
                                    layout
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, transition: { duration: 0.05 } }}
                                    transition={{ duration: 0.2 }}
                                    key={item.symbol}
                                    className={styles.tr}
                                    onClick={() => handleRowClick(item.symbol)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <td className={styles.td}>
                                        <div className={styles.symbolRow}>
                                            <span className={styles.symbolText}>{item.symbol}</span>
                                        </div>
                                        <div className={styles.sharesText}>{formatQuantity(item.quantity)} Shares</div>
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
                                        <div>{format(convert(item.lifetimeDividends || 0, item.currency))}</div>
                                        <div className={styles.subtext}>
                                            {(() => {
                                                const yieldVal = item.dividendYield || (item.value > 0 ? (item.dividendsYTD || 0) / item.value : 0);
                                                return yieldVal > 0 ? `(${(yieldVal * 100).toFixed(2)}%)` : '-';
                                            })()}
                                        </div>
                                    </td>
                                    <td className={`${styles.td} ${styles.right} ${getColorClass(item.xirr || 0)}`}>
                                        {item.xirr ? `${(item.xirr * 100).toFixed(2)}%` : '-'}
                                    </td>
                                </motion.tr>
                            ))}
                        </AnimatePresence>
                        {/* Sold Assets Row - Rendered at bottom of body */}
                        {soldAssets.length > 0 && (
                            <tr className={styles.tr} style={{ background: 'var(--card-bg)', color: 'var(--text-secondary)', fontStyle: 'italic', boxShadow: '0 -1px 0 var(--card-border)' }}>
                                <td className={styles.td}>Realized / Sold Assets</td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {(() => {
                                        const totalRealized = soldAssets.reduce((sum, item) => sum + convert(item.realizedGain || 0, item.currency), 0);
                                        return (
                                            <div className={getColorClass(totalRealized)}>
                                                <div>{format(totalRealized)}</div>
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {format(soldAssets.reduce((sum, item) => sum + convert(item.lifetimeDividends || 0, item.currency), 0))}
                                </td>
                                <td className={styles.td}></td>
                            </tr>
                        )}
                    </tbody>
                    {data.length > 0 && (
                        <tfoot>
                            <tr className={styles.tr} style={{ fontWeight: 'bold', background: 'var(--card-bg)', position: 'sticky', bottom: 0, zIndex: 20, boxShadow: '0 -1px 0 var(--card-border)' }}>
                                <td className={styles.td}>TOTAL</td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {format(data.reduce((sum, item) => sum + convert(item.bookValue, item.currency), 0))}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {format(data.reduce((sum, item) => sum + convert(item.value, item.currency), 0))}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {(() => {
                                        const totalAbs = data.reduce((sum, item) => sum + convert(item.dayChange.absolute, item.currency), 0);
                                        const totalVal = data.reduce((sum, item) => sum + convert(item.value, item.currency), 0);
                                        const prevVal = totalVal - totalAbs;
                                        const pct = prevVal !== 0 ? (totalAbs / prevVal) * 100 : 0;
                                        return (
                                            <div className={getColorClass(totalAbs)}>
                                                <div>{format(totalAbs)}</div>
                                                <div className={styles.percent}>({pct.toFixed(2)}%)</div>
                                            </div>
                                        );
                                    })()}
                                </td>
                                {/* Spacers for 1W/1M/1Y/YTD */}
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={styles.td}></td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    {(() => {
                                        const totalValue = data.reduce((sum, item) => sum + convert(item.value, item.currency), 0);
                                        const totalCost = data.reduce((sum, item) => sum + convert(item.bookValue, item.currency), 0);
                                        const totalRealized = data.reduce((sum, item) => sum + convert(item.realizedGain || 0, item.currency), 0);

                                        const totalPnl = (totalValue - totalCost) + totalRealized;
                                        const pct = totalCost > 0 ? (totalPnl / totalCost) * 100 : 0;

                                        return (
                                            <div className={getColorClass(totalPnl)}>
                                                <div>{format(totalPnl)}</div>
                                                <div className={styles.percent}>({pct.toFixed(2)}%)</div>
                                            </div>
                                        );
                                    })()}
                                </td>
                                <td className={`${styles.td} ${styles.right}`}>
                                    <div>{format(data.reduce((sum, item) => sum + convert(item.lifetimeDividends || 0, item.currency), 0))}</div>
                                    <div className={styles.subtext}>
                                        {(() => {
                                            const totalVal = data.reduce((sum, item) => sum + convert(item.value, item.currency), 0);
                                            const weightedYieldSum = data.reduce((sum, item) => {
                                                const itemYield = item.dividendYield || (item.value > 0 ? (item.dividendsYTD || 0) / item.value : 0);
                                                return sum + (convert(item.value, item.currency) * itemYield);
                                            }, 0);
                                            const avgYield = totalVal > 0 ? (weightedYieldSum / totalVal) : 0;
                                            return `(${(avgYield * 100).toFixed(2)}%)`;
                                        })()}
                                    </div>
                                </td>
                                <td className={styles.td}></td>
                            </tr>
                        </tfoot>
                    )}
                </table>
            </div>

            {/* Mobile Card List */}
            <div className={styles.mobileList}>
                {sortedData.map((item) => (
                    <div
                        key={item.symbol}
                        className={styles.mobileCard}
                        onClick={() => handleRowClick(item.symbol)}
                    >
                        <div className={styles.cardHeader}>
                            <div>
                                <div className={styles.symbolRow}>
                                    <span className={styles.symbolText}>{item.symbol}</span>
                                </div>
                                <div className={styles.sharesText}>{formatQuantity(item.quantity)} Shares</div>
                                {item.xirr && (
                                    <div className={styles.sharesText} style={{ marginTop: '0.125rem' }}>
                                        <span className={styles.subtext} style={{ fontSize: '0.75rem', fontWeight: 500 }}>
                                            XIRR: <span className={getColorClass(item.xirr)}>{(item.xirr * 100).toFixed(2)}%</span>
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{format(convert(item.value, item.currency))}</div>
                                {renderChange(item.dayChange, item.currency)}
                            </div>
                        </div>
                        <div className={styles.cardBody}>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Avg Cost</span>
                                <span className={styles.statValue}>{format(convert(item.avgPrice, item.currency))}</span>
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Total Return</span>
                                {renderChange(item.inceptionChange, item.currency)}
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>1D Change</span>
                                {renderChange(item.dayChange, item.currency)}
                            </div>
                            <div className={styles.statItem}>
                                <span className={styles.statLabel}>Dividends</span>
                                <span className={styles.statValue}>
                                    {format(convert(item.lifetimeDividends || 0, item.currency))}
                                </span>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div >
    );
}
