'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import styles from './Sidebar.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import { useTheme } from '@/context/ThemeContext';
import {
    MdDashboard,
    MdFormatListBulleted,
    MdShowChart,
    MdSettings,
    MdMenu,
    MdClose,
    MdDarkMode,
    MdLightMode,
    MdLogout,
    MdPeople,
    MdTrendingUp
} from 'react-icons/md';
import { signOut } from 'next-auth/react';

export default function Sidebar() {
    const pathname = usePathname();
    const { currency, setCurrency } = useCurrency();
    const { theme, toggleTheme } = useTheme();
    const [isOpen, setIsOpen] = useState(false);

    const { data: session } = useSession();
    const role = (session?.user as any)?.role || 'VIEWER';

    const navItems = [
        { name: 'Dashboard', href: '/', icon: <MdDashboard size={20} /> },
        { name: 'Activities', href: '/activities', icon: <MdFormatListBulleted size={20} /> },
        { name: 'Analysis', href: '/analysis', icon: <MdShowChart size={20} /> },
    ];

    if (role === 'ADMIN' || role === 'EDITOR') {
        navItems.push({ name: 'Settings', href: '/settings', icon: <MdSettings size={20} /> });
    }

    if (role === 'ADMIN') {
        navItems.push({ name: 'Users', href: '/settings/users', icon: <MdPeople size={20} /> });
    }

    return (
        <>
            {/* Mobile Toggle Button */}
            <button
                className={styles.mobileToggle}
                onClick={() => setIsOpen(true)}
                aria-label="Open Menu"
            >
                <MdMenu size={24} />
            </button>

            {/* Overlay */}
            {isOpen && (
                <div
                    className={styles.overlay}
                    onClick={() => setIsOpen(false)}
                    aria-hidden="true"
                />
            )}

            <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
                <div className={styles.logo}>
                    <div style={{ display: 'flex', alignItems: 'center', overflow: 'hidden', width: '200px', height: '80px' }}>
                        <img
                            src="/logo.png"
                            alt="Ascend"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', transform: 'scale(1.2)' }}
                        />
                    </div>
                    <button
                        className={styles.closeButton}
                        onClick={() => setIsOpen(false)}
                        aria-label="Close Menu"
                    >
                        <MdClose size={24} />
                    </button>
                </div>

                <nav className={styles.nav}>
                    {navItems.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`${styles.link} ${pathname === item.href ? styles.active : ''}`}
                            onClick={() => setIsOpen(false)} // Close on navigation
                        >
                            <span className={styles.iconWrapper}>{item.icon}</span>
                            {item.name}
                        </Link>
                    ))}
                </nav>

                <div className={styles.footer}>
                    <div className={styles.controls}>
                        <select
                            className={styles.currencySelect}
                            value={currency}
                            onChange={(e) => setCurrency(e.target.value as any)}
                        >
                            <option value="USD">USD ($)</option>
                            <option value="CAD">CAD ($)</option>
                            <option value="INR">INR (₹)</option>
                        </select>

                        <button
                            className={styles.themeToggle}
                            onClick={toggleTheme}
                            aria-label="Toggle Dark Mode"
                        >
                            {theme === 'light' ? <MdDarkMode size={20} /> : <MdLightMode size={20} />}
                        </button>

                        <button
                            className={styles.logoutButton}
                            onClick={() => signOut({ callbackUrl: '/login' })}
                            aria-label="Logout"
                            style={{
                                background: 'none',
                                border: 'none',
                                color: 'var(--text-secondary)',
                                cursor: 'pointer',
                                padding: '0.5rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'color 0.2s'
                            }}
                        >
                            <MdLogout size={20} />
                        </button>
                    </div>
                </div>
            </aside>
        </>
    );
}
