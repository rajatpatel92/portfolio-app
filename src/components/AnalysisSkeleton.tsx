import styles from '@/app/(dashboard)/analysis/allocation/page.module.css';
import Skeleton from './Skeleton';

export default function AnalysisSkeleton() {
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <Skeleton width={300} height={40} style={{ marginBottom: '0.5rem' }} />
                <Skeleton width={400} height={20} />
            </header>

            <div className={styles.analysisGrid}>
                {/* Constituents Grid Skeleton */}
                <div className={styles.gridContainer}>
                    <div style={{ background: 'var(--card-bg)', borderRadius: '1rem', padding: '1.5rem', border: '1px solid var(--card-border)' }}>
                        {/* Table Header like skeleton */}
                        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
                            <Skeleton width={100} height={20} />
                            <Skeleton width={80} height={20} style={{ marginLeft: 'auto' }} />
                            <Skeleton width={80} height={20} />
                            <Skeleton width={80} height={20} />
                        </div>
                        {/* Table Rows */}
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} style={{ display: 'flex', gap: '1rem', padding: '1rem 0', borderTop: '1px solid var(--card-border)' }}>
                                <div style={{ width: '40%' }}>
                                    <Skeleton width={60} height={20} style={{ marginBottom: '0.25rem' }} />
                                    <Skeleton width={100} height={16} />
                                </div>
                                <div style={{ marginLeft: 'auto', width: '60%', display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
                                    <Skeleton width={80} height={30} />
                                    <Skeleton width={80} height={30} />
                                    <Skeleton width={80} height={30} />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
