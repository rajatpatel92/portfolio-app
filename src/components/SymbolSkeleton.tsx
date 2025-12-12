import styles from '@/app/(dashboard)/analysis/[symbol]/page.module.css';
import Skeleton from './Skeleton';

export default function SymbolSkeleton() {
    return (
        <div className={styles.container}>
            {/* Header Skeleton */}
            <header className={styles.header}>
                <div>
                    <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem' }}>
                        <Skeleton width={32} height={32} variant="circle" />
                        <Skeleton width={200} height={32} />
                        <Skeleton width={32} height={32} variant="circle" />
                    </div>
                    <div className={styles.price}>
                        <Skeleton width={120} height={40} />
                    </div>
                </div>
                <div className={styles.headerRight}>
                    <Skeleton width={150} height={50} />
                </div>
            </header>

            {/* Content Skeleton matches Overview tab */}
            <div className={styles.content}>
                {/* Chart Section */}
                <section className={styles.section} style={{ height: '400px', marginBottom: '2rem' }}>
                    <Skeleton width={150} height={24} style={{ marginBottom: '1rem' }} />
                    <Skeleton variant="rect" height="100%" />
                </section>

                {/* Stats Grid */}
                <section className={styles.statsGrid}>
                    {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                        <div key={i} className={styles.statCard}>
                            <Skeleton width={80} height={16} style={{ marginBottom: '0.5rem' }} />
                            <Skeleton width={100} height={24} />
                        </div>
                    ))}
                </section>

                {/* Allocation Section */}
                <div className={styles.splitSection} style={{ marginTop: '2rem' }}>
                    <div style={{ background: 'var(--card-bg)', borderRadius: '1rem', padding: '1.5rem', height: '200px', border: '1px solid var(--card-border)' }}>
                        <Skeleton width={150} height={24} style={{ marginBottom: '1rem' }} />
                        <Skeleton variant="rect" height={100} />
                    </div>
                    <div style={{ background: 'var(--card-bg)', borderRadius: '1rem', padding: '1.5rem', height: '200px', border: '1px solid var(--card-border)' }}>
                        <Skeleton width={150} height={24} style={{ marginBottom: '1rem' }} />
                        <Skeleton variant="rect" height={100} />
                    </div>
                </div>
            </div>
        </div>
    );
}
