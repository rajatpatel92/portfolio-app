'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

export type DateFormat = 'MM/DD/YYYY' | 'DD/MM/YYYY' | 'YYYY-MM-DD' | 'MMM DD, YYYY';

interface DateContextType {
    dateFormat: DateFormat;
    setDateFormat: (format: DateFormat) => void;
    formatDate: (date: Date | string | number) => string;
}

const DateContext = createContext<DateContextType | undefined>(undefined);

export function DateProvider({ children }: { children: React.ReactNode }) {
    const [dateFormat, setDateFormat] = useState<DateFormat>('MM/DD/YYYY');
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('portfolio_date_format');
        if (saved) {
            setDateFormat(saved as DateFormat);
        }
        setMounted(true);
    }, []);

    useEffect(() => {
        if (mounted) {
            localStorage.setItem('portfolio_date_format', dateFormat);
        }
    }, [dateFormat, mounted]);

    const formatDate = (date: Date | string | number): string => {
        const d = new Date(date);
        if (isNaN(d.getTime())) return 'Invalid Date';

        const day = d.getDate();
        const month = d.getMonth() + 1;
        const year = d.getFullYear();

        const pad = (n: number) => n.toString().padStart(2, '0');
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

        switch (dateFormat) {
            case 'DD/MM/YYYY':
                return `${pad(day)}/${pad(month)}/${year}`;
            case 'YYYY-MM-DD':
                return `${year}-${pad(month)}-${pad(day)}`;
            case 'MMM DD, YYYY':
                return `${monthNames[month - 1]} ${pad(day)}, ${year}`;
            case 'MM/DD/YYYY':
            default:
                return `${pad(month)}/${pad(day)}/${year}`;
        }
    };

    return (
        <DateContext.Provider value={{ dateFormat, setDateFormat, formatDate }}>
            {children}
        </DateContext.Provider>
    );
}

export function useDate() {
    const context = useContext(DateContext);
    if (context === undefined) {
        throw new Error('useDate must be used within a DateProvider');
    }
    return context;
}
