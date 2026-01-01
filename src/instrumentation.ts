
import cron from 'node-cron';

export async function register() {
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        // Only run on server-side
        console.log('[Instrumentation] Registering Cron Jobs...');

        // 1. Run immediately on startup (with a small delay to allow server to be ready)
        // Note: calling fetch here might fail if the server itself isn't listening yet.
        // Instead, we can import the logic directly if possible, or retry.
        // But better: Just start the cron schedule.

        // Schedule: Every hour at minute 0
        cron.schedule('0 * * * *', async () => {
            console.log('[Cron] Triggering Scheduled Market Data Refresh...');
            try {
                // We use fetch to call our own API route to keep logic centralized
                // We need the APP_URL or localhost
                const baseUrl = process.env.APP_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/cron/market-data`);
            } catch (e) {
                console.error('[Cron] Failed to trigger market data refresh:', e);
            }
        });

        // Trigger on Startup (One-off)
        setTimeout(async () => {
            console.log('[Startup] Triggering Initial Market Data Refresh...');
            try {
                const baseUrl = process.env.APP_URL || 'http://localhost:3000';
                await fetch(`${baseUrl}/api/cron/market-data`, {
                    headers: { 'x-cron-secret': process.env.CRON_SECRET || '' }
                });
            } catch (e) {
                console.error('[Startup] Failed to trigger initial refresh:', e);
            }
        }, 10000); // 10s delay
    }
}
