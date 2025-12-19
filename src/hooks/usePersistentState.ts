
import { useState, useEffect } from 'react';

function usePersistentState<T>(key: string, defaultValue: T): [T, (value: T | ((val: T) => T)) => void] {
    const [state, setState] = useState<T>(() => {
        if (typeof window !== 'undefined') {
            const saved = sessionStorage.getItem(key);
            if (saved !== null) {
                try {
                    return JSON.parse(saved);
                } catch (e) {
                    console.error(`Error parsing session storage key "${key}":`, e);
                }
            }
        }
        return defaultValue;
    });

    useEffect(() => {
        if (typeof window !== 'undefined') {
            sessionStorage.setItem(key, JSON.stringify(state));
        }
    }, [key, state]);

    return [state, setState];
}

export default usePersistentState;
