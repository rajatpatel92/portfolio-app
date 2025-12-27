
import { useState, useEffect } from 'react';

function usePersistentState<T>(key: string, defaultValue: T): [T, (value: T | ((val: T) => T)) => void, boolean] {
    // Initialize with default value to match Server Side Rendering (SSR)
    const [state, setState] = useState<T>(defaultValue);
    const [isInitialized, setIsInitialized] = useState(false);

    // Load from storage after mount (Client only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem(key);
            if (saved !== null) {
                try {
                    const parsed = JSON.parse(saved);
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setState(parsed);
                } catch (e) {
                    console.error(`Error parsing local storage key "${key}":`, e);
                }
            }
        }
        setIsInitialized(true);
    }, [key]);

    // Save to storage when state changes, but NOT before initialization
    useEffect(() => {
        if (isInitialized && typeof window !== 'undefined') {
            localStorage.setItem(key, JSON.stringify(state));
        }
    }, [key, state, isInitialized]);

    return [state, setState, isInitialized];
}

export default usePersistentState;
