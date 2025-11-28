'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type CurrencyCode = 'USD' | 'CAD' | 'INR';

interface CurrencyContextType {
    currency: CurrencyCode;
    setCurrency: (code: CurrencyCode) => void;
    convert: (amount: number, fromCurrency: string) => number;
    format: (amount: number) => string;
    rates: Record<string, number>;
    loading: boolean;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrency] = useState<CurrencyCode>('CAD');
    const [rates, setRates] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);

    // Load from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('portfolio_currency');
        if (saved && (saved === 'USD' || saved === 'CAD' || saved === 'INR')) {
            setCurrency(saved as CurrencyCode);
        }
    }, []);

    // Save to localStorage when changed
    useEffect(() => {
        localStorage.setItem('portfolio_currency', currency);
    }, [currency]);

    // Fetch rates when target currency changes
    useEffect(() => {
        const fetchRates = async () => {
            setLoading(true);
            const newRates: Record<string, number> = { [currency]: 1 };
            const currenciesToFetch = ['USD', 'CAD', 'INR'].filter(c => c !== currency);

            for (const from of currenciesToFetch) {
                try {
                    const res = await fetch(`/api/currencies?from=${from}&to=${currency}`);
                    const data = await res.json();
                    if (data.rate) {
                        newRates[from] = data.rate;
                    }
                } catch (error) {
                    console.error(`Failed to fetch rate for ${from}`, error);
                }
            }
            setRates(newRates);
            setLoading(false);
        };

        fetchRates();
    }, [currency]);

    const convert = (amount: number, fromCurrency: string): number => {
        if (fromCurrency === currency) return amount;
        const rate = rates[fromCurrency];
        return rate ? amount * rate : amount; // Fallback to 1:1 if rate missing
    };

    const format = (amount: number): string => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
        }).format(amount);
    };

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, convert, format, rates, loading }}>
            {children}
        </CurrencyContext.Provider>
    );
}

export function useCurrency() {
    const context = useContext(CurrencyContext);
    if (context === undefined) {
        throw new Error('useCurrency must be used within a CurrencyProvider');
    }
    return context;
}
