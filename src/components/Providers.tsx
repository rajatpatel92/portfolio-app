'use client';

import { SessionProvider } from 'next-auth/react';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { DateProvider } from '@/context/DateContext';

export default function Providers({ children }: { children: React.ReactNode }) {
    return (
        <SessionProvider>
            <CurrencyProvider>
                <ThemeProvider>
                    <DateProvider>
                        {children}
                    </DateProvider>
                </ThemeProvider>
            </CurrencyProvider>
        </SessionProvider>
    );
}
