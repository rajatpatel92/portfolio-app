'use client';

import { useEffect, useRef } from 'react';
import { signOut } from 'next-auth/react';

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export default function InactivityManager() {
    const timerRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Check if "Remember Me" is enabled
        const isRemembered = localStorage.getItem('rememberMe') === 'true';

        // If remembered, do not enforce inactivity timeout
        if (isRemembered) {
            return;
        }

        const resetTimer = () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
                signOut();
            }, TIMEOUT_MS);
        };

        // Events to listen for activity
        const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];

        // Add event listeners
        events.forEach(event => {
            window.addEventListener(event, resetTimer);
        });

        // Initial start
        resetTimer();

        // Cleanup
        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            events.forEach(event => {
                window.removeEventListener(event, resetTimer);
            });
        };
    }, []);

    return null;
}
