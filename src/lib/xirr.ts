export interface Transaction {
    amount: number; // Negative for outflow (Buy), Positive for inflow (Sell, Dividend, Current Value)
    date: Date;
}

export function calculateXIRR(transactions: Transaction[], guess: number = 0.1): number | null {
    if (transactions.length < 2) return null;

    // Sort transactions by date
    transactions.sort((a, b) => a.date.getTime() - b.date.getTime());

    const limit = 100; // Max iterations
    const tol = 1e-6; // Tolerance
    let x0 = guess;

    const f = (x: number) => {
        let sum = 0;
        for (const t of transactions) {
            const days = (t.date.getTime() - transactions[0].date.getTime()) / (1000 * 60 * 60 * 24);
            sum += t.amount / Math.pow(1 + x, days / 365);
        }
        return sum;
    };

    const df = (x: number) => {
        let sum = 0;
        for (const t of transactions) {
            const days = (t.date.getTime() - transactions[0].date.getTime()) / (1000 * 60 * 60 * 24);
            sum += -days / 365 * t.amount / Math.pow(1 + x, days / 365 + 1);
        }
        return sum;
    };

    for (let i = 0; i < limit; i++) {
        const y = f(x0);
        const dy = df(x0);

        if (Math.abs(dy) < tol) return null; // Derivative too close to 0

        const x1 = x0 - y / dy;

        if (Math.abs(x1 - x0) < tol) return x1;

        x0 = x1;
    }

    return null; // Failed to converge
}
