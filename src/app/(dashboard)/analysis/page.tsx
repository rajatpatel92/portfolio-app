'use client';

import { useEffect, useState } from 'react';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import ConstituentsGrid from '@/components/ConstituentsGrid';

interface PortfolioSummary {
    allocationByType: { name: string; value: number }[];
    allocationByAsset: { name: string; value: number }[];
    constituents: any[];
}

export default function AnalysisPage() {
    const [summary, setSummary] = useState<PortfolioSummary | null>(null);
    const { format, convert } = useCurrency();

    useEffect(() => {
        fetch('/api/portfolio')
            .then(res => res.json())
            .then(data => setSummary(data))
            .catch(err => console.error('Failed to fetch portfolio', err));
    }, []);

    if (!summary) return <div className={styles.loading}>Loading...</div>;

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Portfolio Analysis</h1>
                <p className={styles.subtitle}>
                    Deep dive into your asset allocation and performance metrics.
                </p>
            </header>

            <div className={styles.analysisGrid}>
                {/* Constituents Grid */}
                <div className={styles.gridContainer}>
                    <ConstituentsGrid data={summary.constituents} />
                </div>
            </div>
        </div>
    );
}
