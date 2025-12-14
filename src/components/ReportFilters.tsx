
'use client';

import { useState, useEffect } from 'react';
import styles from './ReportFilters.module.css';
import { MdFilterList, MdClose } from 'react-icons/md';

interface FilterState {
    accountTypes: string[];
    investmentTypes: string[];
}

interface ReportFiltersProps {
    onChange: (filters: FilterState) => void;
}

export default function ReportFilters({ onChange }: ReportFiltersProps) {
    const [isOpen, setIsOpen] = useState(false);

    // Available Options
    const [availableAccTypes, setAvailableAccTypes] = useState<string[]>([]);
    const [availableInvTypes, setAvailableInvTypes] = useState<string[]>([]);

    // Selected Options
    const [selectedAccTypes, setSelectedAccTypes] = useState<string[]>([]);
    const [selectedInvTypes, setSelectedInvTypes] = useState<string[]>([]);

    useEffect(() => {
        // Fetch Metadata to populate filters
        // We can hit /api/portfolio to get unique types from current data, 
        // OR fetch settings types.
        // Let's rely on /api/portfolio metadata if possible, or hit separate endpoints.
        // Simplest: Hit settings endpoints or infer from portfolio.
        // Let's use portfolio to ensure we only show Used types.
        fetch('/api/portfolio')
            .then(res => res.json())
            .then(data => {
                if (data.stats) {
                    // Extract unique types from allocation/activities not trivial here.
                    // Let's just hardcode standard ones or fetch settings.
                    // Actually, fetching from Settings is cleaner.
                }
            });

        // Parallel fetch for types
        Promise.all([
            fetch('/api/settings/account-types').then(res => res.json()),
            fetch('/api/settings/investment-types').then(res => res.json())
        ]).then(([accs, invs]) => {
            const accTypes = (accs as { name: string }[]).map(a => a.name);
            const invTypes = (invs as { name: string }[]).map(i => i.name);

            setAvailableAccTypes(accTypes);
            setAvailableInvTypes(invTypes);

            // Default select all
            setSelectedAccTypes(accTypes);
            setSelectedInvTypes(invTypes);

            // Initial notify
            if (onChange) onChange({ accountTypes: accTypes, investmentTypes: invTypes });
        });
    }, [onChange]);

    const handleApply = () => {
        onChange({
            accountTypes: selectedAccTypes,
            investmentTypes: selectedInvTypes
        });
        setIsOpen(false);
    };

    const toggleAcc = (type: string) => {
        setSelectedAccTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const toggleInv = (type: string) => {
        setSelectedInvTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    return (
        <div className={styles.container}>
            <button className={styles.filterBtn} onClick={() => setIsOpen(!isOpen)}>
                <MdFilterList size={20} />
                <span>Filters</span>
            </button>

            {isOpen && (
                <div className={styles.popover}>
                    <div className={styles.header}>
                        <h3>Filter Analysis</h3>
                        <button onClick={() => setIsOpen(false)}><MdClose /></button>
                    </div>

                    <div className={styles.section}>
                        <h4>Account Types</h4>
                        <div className={styles.grid}>
                            {availableAccTypes.map(type => (
                                <label key={type} className={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={selectedAccTypes.includes(type)}
                                        onChange={() => toggleAcc(type)}
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.section}>
                        <h4>Investment Types</h4>
                        <div className={styles.grid}>
                            {availableInvTypes.map(type => (
                                <label key={type} className={styles.checkbox}>
                                    <input
                                        type="checkbox"
                                        checked={selectedInvTypes.includes(type)}
                                        onChange={() => toggleInv(type)}
                                    />
                                    {type}
                                </label>
                            ))}
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.applyBtn} onClick={handleApply}>Apply Filters</button>
                    </div>
                </div>
            )}
        </div>
    );
}
