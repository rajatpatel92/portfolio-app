/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useMemo, useEffect } from 'react';
import styles from './TopMoversModal.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import Link from 'next/link';

interface TopMoversModalProps {
    isOpen: boolean;
    onClose: () => void;
    constituents: any[];
    portfolioTotalValue: number; // In USD (or base currency consistent with rateToUSD)
    portfolioDayChange: number; // In USD
}

type SortField = 'symbol' | 'price' | 'changePercent' | 'impactAbs' | 'impactPercent';
type SortDirection = 'asc' | 'desc';

export default function TopMoversModal({
    isOpen,
    onClose,
    constituents,
    portfolioTotalValue,
    portfolioDayChange
}: TopMoversModalProps) {
    const { format, convert } = useCurrency();
    const [sortField, setSortField] = useState<SortField>('impactPercent');
    const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
    const [prevValueUSD, setPrevValueUSD] = useState(0);

    useEffect(() => {
        // Calculate previous portfolio value for impact % calculation
        setPrevValueUSD(portfolioTotalValue - portfolioDayChange);
    }, [portfolioTotalValue, portfolioDayChange]);

    const sortedConstituents = useMemo(() => {
        const data = constituents.map(c => {
            const impactUSD = c.dayChange.absolute * c.rateToUSD;
            const impactPercent = prevValueUSD !== 0 ? (impactUSD / prevValueUSD) * 100 : 0;

            // Calculate Price Change Per Share from percentage to ensure consistency with displayed %
            // Change % = (Change / PrevPrice) * 100
            // Change = (Change % * PrevPrice) / 100
            // Current Price = PrevPrice + Change
            // PrevPrice = Current Price / (1 + Change%/100)
            const prevPrice = c.price / (1 + (c.dayChange.percent / 100));
            const priceChangePerShare = c.price - prevPrice;

            return {
                ...c,
                impactUSD,
                impactPercent,
                priceChangePerShare
            };
        });

        return data.sort((a, b) => {
            let valA, valB;

            switch (sortField) {
                case 'symbol':
                    valA = a.symbol;
                    valB = b.symbol;
                    break;
                case 'price':
                    valA = a.price * a.rateToUSD;
                    valB = b.price * a.rateToUSD;
                    break;
                case 'changePercent':
                    valA = a.dayChange.percent;
                    valB = b.dayChange.percent;
                    break;
                case 'impactAbs':
                    // Map old impactAbs sort to impactPercent logic (same direction)
                    valA = Math.abs(a.impactUSD);
                    valB = Math.abs(b.impactUSD);
                    break;
                case 'impactPercent':
                default:
                    valA = a.impactPercent;
                    valB = b.impactPercent;
                    break;
            }

            if (valA < valB) return sortDirection === 'asc' ? -1 : 1;
            if (valA > valB) return sortDirection === 'asc' ? 1 : -1;
            return 0;
        });
    }, [constituents, sortField, sortDirection, prevValueUSD]);

    if (!isOpen) return null;

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDirection('desc');
        }
    };

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return null;
        return <span style={{ marginLeft: '4px' }}>{sortDirection === 'asc' ? '↑' : '↓'}</span>;
    };

    const formatPercent = (val: number) => {
        const sign = val > 0 ? '+' : '';
        return `${sign}${val.toFixed(2)}%`;
    };

    const getColorClass = (val: number) => {
        if (val > 0) return styles.positive;
        if (val < 0) return styles.negative;
        return styles.neutral;
    };

    return (
        <div className={styles.overlay} onClick={onClose}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
                <div className={styles.header}>
                    <h3 className={styles.title}>Portfolio Constituents Details</h3>
                    <button className={styles.closeButton} onClick={onClose}>&times;</button>
                </div>

                <div className={styles.content}>
                    <table className={styles.tableContainer}>
                        <thead>
                            <tr>
                                <th className={styles.tableHeader} onClick={() => handleSort('symbol')}>
                                    Asset <SortIcon field="symbol" />
                                </th>
                                <th className={`${styles.tableHeader} ${styles.alignRight}`}>
                                    Price
                                </th>
                                <th className={`${styles.tableHeader} ${styles.alignRight}`} onClick={() => handleSort('changePercent')}>
                                    Change (1D) <SortIcon field="changePercent" />
                                </th>
                                <th className={`${styles.tableHeader} ${styles.alignRight}`} onClick={() => handleSort('impactPercent')}>
                                    Impact <SortIcon field="impactPercent" />
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedConstituents.map(c => {
                                // Conversion for display
                                const priceDisp = format(convert(c.price, c.currency));
                                const avgPriceDisp = format(convert(c.avgPrice, c.currency));
                                const changeAbsDisp = format(convert(c.priceChangePerShare, c.currency));
                                const impactAbsDisp = format(convert(c.dayChange.absolute, c.currency));

                                return (
                                    <tr key={c.symbol} className={styles.row}>
                                        <td className={styles.cell}>
                                            <Link href={`/analysis/${c.symbol}?from=dashboard`} className={styles.symbolLink} style={{ textDecoration: 'none', color: 'inherit' }}>
                                                <span className={styles.symbol}>{c.symbol}</span>
                                                <span className={styles.name}>{c.name}</span>
                                            </Link>
                                        </td>
                                        <td className={`${styles.cell} ${styles.alignRight}`}>
                                            <div className={styles.value}>
                                                {priceDisp}
                                            </div>
                                            <div className={`${styles.neutral}`} style={{ fontSize: '0.8em' }}>
                                                Avg: {avgPriceDisp}
                                            </div>
                                        </td>
                                        <td className={`${styles.cell} ${styles.alignRight}`}>
                                            <div className={`${styles.value} ${getColorClass(c.dayChange.percent)}`}>
                                                {formatPercent(c.dayChange.percent)}
                                            </div>
                                            <div className={getColorClass(c.dayChange.percent) || styles.neutral} style={{ fontSize: '0.8em' }}>
                                                {c.priceChangePerShare > 0 ? '+' : ''}{changeAbsDisp}
                                            </div>
                                        </td>
                                        <td className={`${styles.cell} ${styles.alignRight}`}>
                                            <div className={`${styles.value} ${getColorClass(c.impactPercent)}`}>
                                                {formatPercent(c.impactPercent)}
                                            </div>
                                            <div className={getColorClass(c.impactPercent) || styles.neutral} style={{ fontSize: '0.8em' }}>
                                                {c.dayChange.absolute > 0 ? '+' : ''}{impactAbsDisp}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
