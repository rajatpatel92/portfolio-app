'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './layout.module.css';

const navItems = [
    { name: 'General', href: '/settings' },
    { name: 'Currency', href: '/settings/currency' },
    { name: 'Accounts', href: '/settings/accounts' },
    { name: 'Users', href: '/settings/users' },
    { name: 'Master Data', href: '/settings/data' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Settings</h1>
            </header>

            <div className={styles.settingsGrid}>
                <nav className={styles.sidebar}>
                    {navItems.map(item => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.link} ${pathname === item.href ? styles.active : ''}`}
                        >
                            {item.name}
                        </Link>
                    ))}
                </nav>
                <div className={styles.content}>
                    {children}
                </div>
            </div>
        </div>
    );
}
