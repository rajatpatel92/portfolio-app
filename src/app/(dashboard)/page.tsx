'use client';
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';

import PortfolioChart from '@/components/PortfolioChart';

import PerformanceChart from '@/components/PerformanceChart';
import TopMovers from '@/components/TopMovers';
import DividendSummary from '@/components/DividendSummary';

interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePercent: number;
  totalGrowth: number;
  totalGrowthPercent: number;
  xirr: number | null;
  allocationByType: { name: string; value: number }[];
  allocationByAsset: { name: string; value: number }[];
  allocationByPlatform: { name: string; value: number }[];
  allocationByAccount: { name: string; value: number; platformName: string }[];
  constituents: any[];
  dividendsYTD: number;
  projectedDividends: number;
  upcomingDividends: any[];
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const { format, convert, currency } = useCurrency();

  // Lifted state for chart synchronization
  const [range, setRange] = useState('1M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    fetch('/api/portfolio')
      .then(res => res.json())
      .then(data => setSummary(data))
      .catch(err => console.error('Failed to fetch portfolio', err));
  }, []);

  if (!summary) return <div className={styles.loading}>Loading...</div>;

  const totalValue = convert(summary.totalValue, 'USD'); // Assuming API returns USD
  const dayChange = convert(summary.dayChange, 'USD');
  const totalGrowth = convert(summary.totalGrowth, 'USD');
  const isPositive = dayChange >= 0;

  // Greeting Logic
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const userName = session?.user?.name || 'Investor';

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.greeting}>{greeting}, {userName}</h1>
        <p className={styles.date}>{dateStr}</p>
      </header>

      <div className={styles.dashboardGrid}>
        {/* Hero Card: Net Worth */}
        <div className={styles.heroCard}>
          <div className={styles.heroLabel}>Total Net Worth</div>
          <div className={styles.heroValue}>{format(totalValue)}</div>
          <div className={styles.heroChange}>
            <span>{isPositive ? '▲' : '▼'}</span>
            <span>{format(Math.abs(dayChange))} ({summary.dayChangePercent.toFixed(2)}%)</span>
            <span className={styles.heroChangeLabel}>Today</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Portfolio XIRR</div>
            <div className={`${styles.statValue} ${summary.xirr && summary.xirr >= 0 ? styles.positive : styles.negative}`}>
              {summary.xirr ? `${(summary.xirr * 100).toFixed(2)}%` : 'N/A'}
            </div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>All Time Return</div>
            <div className={styles.statValueRow}>
              <span className={styles.statAmount}>{format(totalGrowth)}</span>
              <span className={`${styles.statPercentPill} ${summary.totalGrowthPercent >= 0 ? styles.positive : styles.negative}`}>
                {summary.totalGrowthPercent >= 0 ? '▲' : '▼'} {summary.totalGrowthPercent ? `${Math.abs(summary.totalGrowthPercent).toFixed(2)}%` : '0.00%'}
              </span>
            </div>
          </div>
        </div>

        {/* Insights Grid */}
        <div className={styles.insightsGrid}>
          <TopMovers constituents={summary.constituents} />
          <DividendSummary
            dividendsYTD={summary.dividendsYTD}
            upcomingDividends={summary.upcomingDividends}
            totalValue={summary.totalValue}
            projectedDividends={summary.projectedDividends}
          />
        </div>

        {/* Performance Chart Section */}
        <section className={styles.performanceSection}>
          <PerformanceChart
            range={range}
            setRange={setRange}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
          <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
            <Link href="/analysis" className={styles.link}>
              Detailed Analysis &rarr;
            </Link>
          </div>
        </section>

        {/* Chart Section */}
        <section className={styles.chartSection}>
          <PortfolioChart
            range={range}
            setRange={setRange}
            customStart={customStart}
            setCustomStart={setCustomStart}
            customEnd={customEnd}
            setCustomEnd={setCustomEnd}
          />
        </section>


      </div>
    </div>
  );
}
