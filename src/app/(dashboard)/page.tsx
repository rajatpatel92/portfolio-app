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
import DashboardSkeleton from '@/components/DashboardSkeleton';

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
  lastUpdated: string | null;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const { format, convert, currency } = useCurrency();

  // Lifted state for chart synchronization
  const [range, setRange] = useState('1M');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  // Last Updated Time State
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    // 1. Try to load from cache immediately
    const cacheKey = `portfolio_summary_${currency}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) {
      try {
        setSummary(JSON.parse(cached));
      } catch (e) {
        console.error('Failed to parse cached summary', e);
      }
    }

    // 2. Fetch fresh data
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/portfolio?currency=${currency}`);
        const data = await res.json();
        setSummary(data);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (err) {
        console.error('Failed to fetch portfolio', err);
      }
    };
    fetchData();
  }, [currency]);

  if (!summary) return <DashboardSkeleton />;

  const totalValue = summary.totalValue;
  const dayChange = summary.dayChange;
  const totalGrowth = summary.totalGrowth;
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
        <div className={styles.headerLeft}>
          <h1 className={styles.greeting}>{greeting}, {userName}</h1>
          <p className={styles.date}>{dateStr}</p>
        </div>

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
          <TopMovers
            constituents={summary.constituents}
            portfolioTotalValue={summary.totalValue}
            portfolioDayChange={summary.dayChange}
          />
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

      {summary?.lastUpdated && (
        <div style={{
          textAlign: 'right',
          fontSize: '0.75rem',
          color: 'var(--text-secondary)',
          marginTop: '2rem',
          paddingRight: '1rem',
          opacity: 0.8
        }}>
          Last Data Refresh: {new Date(summary.lastUpdated).toLocaleString()}
        </div>
      )}
    </div>
  );
}
