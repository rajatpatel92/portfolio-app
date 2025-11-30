'use client';

import { useEffect, useState } from 'react';
import AddActivityForm from '@/components/AddActivityForm';
import styles from './page.module.css';
import { useCurrency } from '@/context/CurrencyContext';
import { useDate } from '@/context/DateContext';
import { useSession } from 'next-auth/react';
import DateInput from '@/components/DateInput';
import Papa from 'papaparse';
import BulkUploadModal from '@/components/BulkUploadModal';

interface Activity {
    id: string;
    type: string;
    date: string;
    quantity: number;
    price: number;
    fee?: number;
    currency?: string;
    investment: {
        symbol: string;
        name: string;
        currencyCode: string;
        type: string;
    };
    platform?: {
        id: string;
        name: string;
    };
    account?: {
        id: string;
        name: string;
        type: string;
    };
}

export default function ActivitiesPage() {
    const [activities, setActivities] = useState<Activity[]>([]);
    const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
    const { format, convert, currency } = useCurrency();
    const { formatDate } = useDate();

    const [range, setRange] = useState('ALL');
    const [customStart, setCustomStart] = useState('');
    const [customEnd, setCustomEnd] = useState('');
    const RANGES = ['1W', '1M', '3M', '6M', '1Y', 'YTD', 'ALL'];

    const [filterAccount, setFilterAccount] = useState('');
    const [filterAccountType, setFilterAccountType] = useState('');
    const [filterPlatform, setFilterPlatform] = useState('');
    const [filterSymbol, setFilterSymbol] = useState('');
    const [filterType, setFilterType] = useState('');
    const [pageSize, setPageSize] = useState<number | 'ALL'>(20);
    const [currentPage, setCurrentPage] = useState(1);

    const [showAddForm, setShowAddForm] = useState(false);

    const fetchActivities = async () => {
        try {
            const res = await fetch('/api/activities');
            const data = await res.json();
            if (Array.isArray(data)) {
                setActivities(data);
            }
        } catch (error) {
            console.error('Failed to fetch activities', error);
        }
    };

    useEffect(() => {
        fetchActivities();
    }, []);

    // Reset page when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [range, customStart, customEnd, filterAccount, filterAccountType, filterPlatform, filterSymbol, filterType, pageSize]);

    const handleEdit = (activity: Activity) => {
        setEditingActivity(activity);
        setShowAddForm(true);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this activity?')) return;

        try {
            const res = await fetch(`/api/activities/${id}`, {
                method: 'DELETE',
            });
            if (res.ok) {
                fetchActivities();
            } else {
                alert('Failed to delete activity');
            }
        } catch (error) {
            console.error('Delete failed', error);
        }
    };

    const handleSuccess = () => {
        fetchActivities();
        setEditingActivity(null);
        setShowAddForm(false);
    };

    // Derive options for filters
    const accountTypes = Array.from(new Set(activities.map(a => a.account?.type).filter(Boolean))) as string[];
    const platforms = Array.from(new Set(activities.map(a => a.platform?.name).filter(Boolean))) as string[];
    const symbols = Array.from(new Set(activities.map(a => a.investment.symbol))).sort();
    const activityTypes = Array.from(new Set(activities.map(a => a.type))).sort();

    // Derive unique accounts for the filter
    const accountsMap = new Map<string, { id: string, name: string, type: string }>();
    activities.forEach(a => {
        if (a.account) {
            accountsMap.set(a.account.id, { id: a.account.id, name: a.account.name, type: a.account.type });
        }
    });
    const accounts = Array.from(accountsMap.values());

    const getFilteredActivities = () => {
        let filtered = activities;

        // Date Range Filter
        if (range !== 'ALL') {
            const now = new Date();
            let startDate = new Date();

            if (range === 'CUSTOM' && customStart && customEnd) {
                startDate = new Date(customStart);
                const endDate = new Date(customEnd);
                endDate.setHours(23, 59, 59, 999);
                filtered = filtered.filter(a => {
                    const date = new Date(a.date);
                    return date >= startDate && date <= endDate;
                });
            } else {
                switch (range) {
                    case '1W': startDate.setDate(now.getDate() - 7); break;
                    case '1M': startDate.setMonth(now.getMonth() - 1); break;
                    case '3M': startDate.setMonth(now.getMonth() - 3); break;
                    case '6M': startDate.setMonth(now.getMonth() - 6); break;
                    case '1Y': startDate.setFullYear(now.getFullYear() - 1); break;
                    case 'YTD': startDate.setMonth(0, 1); break;
                }
                if (range !== 'ALL' && range !== 'CUSTOM') {
                    filtered = filtered.filter(a => new Date(a.date) >= startDate);
                }
            }
        }

        // Account Filter
        if (filterAccount) {
            filtered = filtered.filter(a => a.account?.id === filterAccount);
        }

        // Account Type Filter
        if (filterAccountType) {
            filtered = filtered.filter(a => a.account?.type === filterAccountType);
        }

        // Platform Filter
        if (filterPlatform) {
            filtered = filtered.filter(a => a.platform?.name === filterPlatform);
        }

        // Symbol Filter
        if (filterSymbol) {
            filtered = filtered.filter(a => a.investment.symbol === filterSymbol);
        }

        // Activity Type Filter
        if (filterType) {
            filtered = filtered.filter(a => a.type === filterType);
        }

        return filtered;
    };

    const filteredActivities = getFilteredActivities();

    // Pagination Logic
    const totalItems = filteredActivities.length;
    const totalPages = pageSize === 'ALL' ? 1 : Math.ceil(totalItems / pageSize);
    const paginatedActivities = pageSize === 'ALL'
        ? filteredActivities
        : filteredActivities.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const { data: session } = useSession();
    const role = (session?.user as any)?.role || 'VIEWER';

    const [showDividendModal, setShowDividendModal] = useState(false);
    const [foundDividends, setFoundDividends] = useState<any[]>([]);
    const [selectedDividends, setSelectedDividends] = useState<Set<number>>(new Set());
    const [loadingDividends, setLoadingDividends] = useState(false);
    const [reinvestSelection, setReinvestSelection] = useState<Set<number>>(new Set());

    const [selectedActivities, setSelectedActivities] = useState<Set<string>>(new Set());
    const [showImportModal, setShowImportModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const handleBatchDelete = async () => {
        if (selectedActivities.size === 0) return;
        if (!confirm(`Are you sure you want to delete ${selectedActivities.size} activities? This cannot be undone.`)) return;

        try {
            const res = await fetch('/api/activities/batch-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: Array.from(selectedActivities) })
            });

            if (res.ok) {
                const data = await res.json();
                alert(`Successfully deleted ${data.count} activities.`);
                setSelectedActivities(new Set());
                fetchActivities();
            } else {
                alert('Failed to delete activities.');
            }
        } catch (error) {
            console.error('Failed to batch delete', error);
        }
    };

    const toggleActivitySelection = (id: string) => {
        const newSelected = new Set(selectedActivities);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedActivities(newSelected);
    };

    const toggleAllActivities = () => {
        if (selectedActivities.size === paginatedActivities.length) {
            setSelectedActivities(new Set());
        } else {
            setSelectedActivities(new Set(paginatedActivities.map(a => a.id)));
        }
    };

    const handleFetchDividends = async () => {
        setShowDividendModal(true);
        setLoadingDividends(true);
        setFoundDividends([]);
        setReinvestSelection(new Set());
        try {
            const res = await fetch('/api/dividends/scan');
            const data = await res.json();
            if (Array.isArray(data)) {
                setFoundDividends(data);
                // Select all by default
                setSelectedDividends(new Set(data.map((_, i) => i)));
            }
        } catch (error) {
            console.error('Failed to fetch dividends', error);
        } finally {
            setLoadingDividends(false);
        }
    };

    const handleAddDividends = async () => {
        const toAdd = foundDividends
            .map((div, i) => ({ ...div, reinvest: reinvestSelection.has(i) }))
            .filter((_, i) => selectedDividends.has(i));

        if (toAdd.length === 0) return;

        try {
            const res = await fetch('/api/dividends/batch-add', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dividends: toAdd })
            });

            if (res.ok) {
                setShowDividendModal(false);
                fetchActivities();
                alert(`Successfully added ${toAdd.length} dividend activities.`);
            } else {
                alert('Failed to add dividends.');
            }
        } catch (error) {
            console.error('Failed to add dividends', error);
        }
    };

    const toggleDividendSelection = (index: number) => {
        const newSelected = new Set(selectedDividends);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedDividends(newSelected);
    };

    const toggleReinvestSelection = (index: number) => {
        const newReinvest = new Set(reinvestSelection);
        if (newReinvest.has(index)) {
            newReinvest.delete(index);
        } else {
            newReinvest.add(index);
        }
        setReinvestSelection(newReinvest);
    };

    const toggleAllDividends = () => {
        if (selectedDividends.size === foundDividends.length) {
            setSelectedDividends(new Set());
        } else {
            setSelectedDividends(new Set(foundDividends.map((_, i) => i)));
        }
    };


    const handleExport = () => {
        // Determine which activities to export
        let dataToExport = filteredActivities;
        if (selectedActivities.size > 0) {
            dataToExport = filteredActivities.filter(a => selectedActivities.has(a.id));
        }

        if (dataToExport.length === 0) {
            alert('No activities to export.');
            return;
        }

        // Map to CSV Schema
        // Map to CSV Schema
        const csvData = dataToExport.map(a => ({
            Date: a.date.split('T')[0], // YYYY-MM-DD
            Type: a.type,
            Symbol: a.investment.symbol,
            Name: a.investment.name,
            'Investment Type': a.investment.type,
            Quantity: a.quantity,
            Price: a.price,
            Fee: a.fee || 0,
            Currency: a.currency || a.investment.currencyCode || 'USD',
            Account: a.account?.name || '',
            'Account Type': a.account?.type || '',
            Platform: a.platform?.name || ''
        }));

        // Generate CSV
        const csv = Papa.unparse(csvData);

        // Trigger Download
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `activities_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h1 className={styles.title}>Activities</h1>
                {role !== 'VIEWER' && (
                    <div style={{ display: 'flex', gap: '1rem' }}>
                        {selectedActivities.size > 0 && (
                            <button
                                onClick={handleBatchDelete}
                                style={{
                                    background: 'var(--danger)',
                                    color: 'white',
                                    border: 'none',
                                    padding: '0.75rem 1.5rem',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: 'pointer'
                                }}
                            >
                                Delete Selected ({selectedActivities.size})
                            </button>
                        )}
                        <button
                            onClick={handleFetchDividends}
                            style={{
                                background: 'var(--card-bg)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--card-border)',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            Fetch Dividends
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                style={{
                                    background: 'var(--card-bg)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--card-border)',
                                    padding: '0.75rem',
                                    borderRadius: '0.5rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '42px',
                                    height: '42px'
                                }}
                            >
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="1" />
                                    <circle cx="12" cy="5" r="1" />
                                    <circle cx="12" cy="19" r="1" />
                                </svg>
                            </button>

                            {showMenu && (
                                <>
                                    <div
                                        style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                                        onClick={() => setShowMenu(false)}
                                    />
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 0,
                                        marginTop: '0.5rem',
                                        background: 'var(--card-bg)',
                                        border: '1px solid var(--card-border)',
                                        borderRadius: '0.5rem',
                                        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                                        zIndex: 20,
                                        minWidth: '160px',
                                        overflow: 'hidden'
                                    }}>
                                        <button
                                            onClick={() => {
                                                handleExport();
                                                setShowMenu(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '0.75rem 1rem',
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            Export CSV
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowImportModal(true);
                                                setShowMenu(false);
                                            }}
                                            style={{
                                                display: 'block',
                                                width: '100%',
                                                textAlign: 'left',
                                                padding: '0.75rem 1rem',
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                cursor: 'pointer',
                                                fontSize: '0.875rem',
                                                borderTop: '1px solid var(--card-border)'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-secondary)'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                        >
                                            Import CSV
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <button
                            onClick={() => {
                                setEditingActivity(null);
                                setShowAddForm(!showAddForm);
                            }}
                            style={{
                                background: 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                padding: '0.75rem 1.5rem',
                                borderRadius: '0.5rem',
                                fontWeight: 600,
                                cursor: 'pointer'
                            }}
                        >
                            {showAddForm ? 'Close Form' : '+ Add Activity'}
                        </button>
                    </div>
                )}
            </header>

            {/* Dividend Modal */}
            {showDividendModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.5)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        background: 'var(--card-bg)',
                        padding: '2rem',
                        borderRadius: '1rem',
                        width: '90%',
                        maxWidth: '1000px',
                        maxHeight: '90vh',
                        overflowY: 'auto',
                        border: '1px solid var(--card-border)'
                    }}>
                        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 700 }}>Found Dividends</h2>

                        {loadingDividends ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>Scanning for dividends...</div>
                        ) : foundDividends.length === 0 ? (
                            <div style={{ padding: '2rem', textAlign: 'center' }}>No new dividends found.</div>
                        ) : (
                            <>
                                <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
                                    <table className={styles.table}>
                                        <thead>
                                            <tr>
                                                <th>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedDividends.size === foundDividends.length}
                                                        onChange={toggleAllDividends}
                                                    />
                                                </th>
                                                <th>Date</th>
                                                <th>Symbol</th>
                                                <th style={{ textAlign: 'right' }}>Rate</th>
                                                <th style={{ textAlign: 'right' }}>Qty</th>
                                                <th style={{ textAlign: 'right' }}>Amount</th>
                                                <th>Account</th>
                                                <th style={{ textAlign: 'center' }}>Reinvest?</th>
                                                <th style={{ textAlign: 'right' }}>Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {foundDividends.map((div, i) => (
                                                <tr key={i}>
                                                    <td>
                                                        <input
                                                            type="checkbox"
                                                            checked={selectedDividends.has(i)}
                                                            onChange={() => toggleDividendSelection(i)}
                                                        />
                                                    </td>
                                                    <td>{formatDate(div.date)}</td>
                                                    <td style={{ fontWeight: 600 }}>{div.symbol}</td>
                                                    <td style={{ textAlign: 'right' }}>{div.rate.toFixed(4)}</td>
                                                    <td style={{ textAlign: 'right' }}>{div.quantity}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{format(convert(div.amount, div.currency))}</td>
                                                    <td>{accounts.find(a => a.id === div.accountId)?.name || 'Unknown'}</td>
                                                    <td style={{ textAlign: 'center' }}>
                                                        <input
                                                            type="checkbox"
                                                            checked={reinvestSelection.has(i)}
                                                            onChange={() => toggleReinvestSelection(i)}
                                                            disabled={!div.price || div.price <= 0}
                                                        />
                                                    </td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        {div.price ? format(convert(div.price, div.currency)) : '-'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                    <button
                                        onClick={() => setShowDividendModal(false)}
                                        style={{
                                            background: 'transparent',
                                            color: 'var(--text-secondary)',
                                            border: '1px solid var(--card-border)',
                                            padding: '0.75rem 1.5rem',
                                            borderRadius: '0.5rem',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleAddDividends}
                                        disabled={selectedDividends.size === 0}
                                        style={{
                                            background: 'var(--primary)',
                                            color: 'white',
                                            border: 'none',
                                            padding: '0.75rem 1.5rem',
                                            borderRadius: '0.5rem',
                                            fontWeight: 600,
                                            cursor: selectedDividends.size === 0 ? 'not-allowed' : 'pointer',
                                            opacity: selectedDividends.size === 0 ? 0.5 : 1
                                        }}
                                    >
                                        Add Selected ({selectedDividends.size})
                                    </button>
                                </div>
                            </>
                        )}
                        {!loadingDividends && foundDividends.length === 0 && (
                            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowDividendModal(false)}
                                    style={{
                                        background: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        padding: '0.75rem 1.5rem',
                                        borderRadius: '0.5rem',
                                        fontWeight: 600,
                                        cursor: 'pointer'
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {role !== 'VIEWER' && (
                <div className={`${styles.formWrapper} ${showAddForm ? styles.open : ''}`}>
                    <div className={styles.formInner}>
                        <div className="card">
                            <AddActivityForm
                                onSuccess={handleSuccess}
                                initialData={editingActivity}
                                onCancel={() => {
                                    setEditingActivity(null);
                                    setShowAddForm(false);
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}


            {
                showImportModal && (
                    <BulkUploadModal
                        onClose={() => setShowImportModal(false)}
                        onSuccess={() => {
                            fetchActivities();
                            setShowImportModal(false);
                        }}
                    />
                )
            }

            <div className={styles.activitiesGrid}>
                {/* Sidebar Filters */}
                <aside className={styles.sidebar}>
                    {/* ... (Filters unchanged) ... */}
                    <h2 className={styles.sidebarTitle}>Filters</h2>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Time Range</label>
                        <div className={styles.rangeGrid}>
                            {RANGES.map(r => (
                                <button
                                    key={r}
                                    onClick={() => setRange(r)}
                                    className={`${styles.rangeButton} ${range === r ? styles.active : ''}`}
                                >
                                    {r}
                                </button>
                            ))}
                            <button
                                onClick={() => setRange('CUSTOM')}
                                className={`${styles.rangeButton} ${range === 'CUSTOM' ? styles.active : ''}`}
                            >
                                Custom
                            </button>
                        </div>
                        {range === 'CUSTOM' && (
                            <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                <div className={styles.dateInputs}>
                                    <DateInput
                                        value={customStart}
                                        onChange={setCustomStart}
                                        className={styles.dateInput}
                                    />
                                    <span className={styles.separator}>to</span>
                                    <DateInput
                                        value={customEnd}
                                        onChange={setCustomEnd}
                                        className={styles.dateInput}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Account</label>
                        <select
                            value={filterAccount}
                            onChange={(e) => setFilterAccount(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">All Accounts</option>
                            {accounts.map(account => (
                                <option key={account.id} value={account.id}>
                                    {account.name} - {account.type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Account Type</label>
                        <select
                            value={filterAccountType}
                            onChange={(e) => setFilterAccountType(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">All Account Types</option>
                            {accountTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Platform</label>
                        <select
                            value={filterPlatform}
                            onChange={(e) => setFilterPlatform(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">All Platforms</option>
                            {platforms.map(platform => (
                                <option key={platform} value={platform}>{platform}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Symbol</label>
                        <select
                            value={filterSymbol}
                            onChange={(e) => setFilterSymbol(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">All Symbols</option>
                            {symbols.map(symbol => (
                                <option key={symbol} value={symbol}>{symbol}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.filterGroup}>
                        <label className={styles.filterLabel}>Activity Type</label>
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className={styles.select}
                        >
                            <option value="">All Types</option>
                            {activityTypes.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                </aside>

                {/* Main Content */}
                <main className={styles.main}>
                    <div className={styles.listHeader}>
                        <h2 className={styles.listTitle}>Activity Log</h2>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            {totalItems} entries found
                        </div>
                    </div>

                    <div className={styles.tableContainer}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>
                                        <input
                                            type="checkbox"
                                            checked={paginatedActivities.length > 0 && selectedActivities.size === paginatedActivities.length}
                                            onChange={toggleAllActivities}
                                        />
                                    </th>
                                    <th>Date</th>
                                    <th>Symbol</th>
                                    <th>Type</th>
                                    <th style={{ textAlign: 'right' }}>Qty</th>
                                    <th style={{ textAlign: 'right' }}>Price ({currency})</th>
                                    <th style={{ textAlign: 'right' }}>Total</th>
                                    <th>Account</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedActivities.length === 0 ? (
                                    <tr>
                                        <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
                                            No activities found.
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedActivities.map((activity) => {
                                        const fromCurrency = activity.investment.currencyCode || 'USD';
                                        const convertedPrice = convert(activity.price, fromCurrency);
                                        // const convertedFee = convert(activity.fee || 0, fromCurrency); // Fee removed from display

                                        let total = activity.quantity * activity.price;
                                        if (activity.type === 'BUY') {
                                            total += (activity.fee || 0);
                                        } else if (activity.type === 'SELL') {
                                            total -= (activity.fee || 0);
                                        }

                                        const convertedTotal = convert(total, fromCurrency);

                                        return (
                                            <tr
                                                key={activity.id}
                                                className={styles.row}
                                                onClick={() => role !== 'VIEWER' && handleEdit(activity)}
                                                style={{ cursor: role !== 'VIEWER' ? 'pointer' : 'default' }}
                                            >
                                                <td onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedActivities.has(activity.id)}
                                                        onChange={() => toggleActivitySelection(activity.id)}
                                                    />
                                                </td>
                                                <td>{formatDate(activity.date)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{activity.investment.symbol}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{activity.investment.name}</div>
                                                </td>
                                                <td>
                                                    <span className={`${styles.badge} ${styles[activity.type]}`}>
                                                        {activity.type}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>{activity.quantity}</td>
                                                <td style={{ textAlign: 'right' }}>{format(convertedPrice)}</td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{format(convertedTotal)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{activity.account ? `${activity.account.name} - ${activity.account.type}` : '-'}</div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{activity.platform?.name || '-'}</div>
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    {role !== 'VIEWER' && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDelete(activity.id);
                                                            }}
                                                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.25rem' }}
                                                        >
                                                            &times;
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className={styles.pagination}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Rows per page:</span>
                            <select
                                value={pageSize}
                                onChange={(e) => {
                                    const val = e.target.value;
                                    setPageSize(val === 'ALL' ? 'ALL' : Number(val));
                                }}
                                className={styles.select}
                                style={{ width: 'auto' }}
                            >
                                <option value={10}>10</option>
                                <option value={20}>20</option>
                                <option value={30}>30</option>
                                <option value={50}>50</option>
                                <option value={100}>100</option>
                                <option value="ALL">All</option>
                            </select>
                        </div>

                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1 || pageSize === 'ALL'}
                                className={styles.pageButton}
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages || pageSize === 'ALL'}
                                className={styles.pageButton}
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </main>
            </div>
        </div >
    );
}

