import styles from '@/app/(dashboard)/page.module.css';
import Skeleton from './Skeleton';

export default function DashboardSkeleton() {
    return (
        <div className={styles.container}>
            {/* Header Skeleton */}
            <header className={styles.header}>
                <Skeleton width={200} height={32} style={{ marginBottom: '0.5rem' }} />
                <Skeleton width={150} height={20} />
            </header>

            <div className={styles.dashboardGrid}>
                {/* Hero Card Skeleton */}
                <div className={styles.heroCard}>
                    <Skeleton width={100} height={16} style={{ marginBottom: '1rem' }} />
                    <Skeleton width={180} height={48} style={{ marginBottom: '1rem' }} />
                    <div className={styles.heroChange}>
                        <Skeleton width={120} height={24} />
                    </div>
                </div>

                {/* Stats Grid Skeletons */}
                <div className={styles.statsGrid}>
                    <div className={styles.statCard}>
                        <Skeleton width={100} height={16} style={{ marginBottom: '0.5rem' }} />
                        <Skeleton width={120} height={32} />
                    </div>
                    <div className={styles.statCard}>
                        <Skeleton width={100} height={16} style={{ marginBottom: '0.5rem' }} />
                        <div className={styles.statValueRow}>
                            <Skeleton width={120} height={32} />
                            <Skeleton width={80} height={24} style={{ marginLeft: '1rem', borderRadius: 'full' }} />
                        </div>
                    </div>
                </div>

                {/* Insights Grid Skeletons */}
                <div className={styles.insightsGrid}>
                    <div className={styles.card} style={{ height: '300px' }}>
                        <Skeleton width={150} height={24} style={{ marginBottom: '1.5rem' }} />
                        <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                            <Skeleton height={60} variant="rect" />
                            <Skeleton height={60} variant="rect" />
                            <Skeleton height={60} variant="rect" />
                        </div>
                    </div>
                    <div className={styles.card} style={{ height: '300px' }}>
                        <Skeleton width={150} height={24} style={{ marginBottom: '1.5rem' }} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                            <Skeleton height={60} variant="rect" />
                            <Skeleton height={60} variant="rect" />
                        </div>
                        <Skeleton height={100} variant="rect" />
                    </div>
                </div>

                {/* Performance Chart Skeleton */}
                <section className={styles.performanceSection}>
                    <div className={styles.card} style={{ height: '400px', width: '100%' }}>
                        <Skeleton width={200} height={24} style={{ marginBottom: '1rem' }} />
                        <Skeleton variant="rect" height="100%" />
                    </div>
                </section>

                {/* Portfolio Chart Skeleton */}
                <section className={styles.chartSection}>
                    <div className={styles.card} style={{ height: '400px', width: '100%' }}>
                        <Skeleton width={200} height={24} style={{ marginBottom: '1rem' }} />
                        <Skeleton variant="rect" height="100%" />
                    </div>
                </section>
            </div>
        </div>
    );
}
