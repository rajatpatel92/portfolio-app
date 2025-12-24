import { prisma } from "@/lib/prisma";

/**
 * Checks if a key has exceeded the rate limit.
 * @param key Unique identifier for the limit (e.g. "dividend-scan-user-123")
 * @param limit Max requests allowed in the window
 * @param windowSeconds Window duration in seconds
 * @returns true if allowed, false if limit exceeded
 */
export async function checkRateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
    const now = new Date();

    try {
        // Clean up expired entries for this key (lazy cleanup)
        // Ideally handled by a cron, but this is simple and robust
        // Or we just check validity on fetch.
        // Let's use a transaction to be safe.

        const result = await prisma.$transaction(async (tx) => {
            let record = await tx.rateLimit.findUnique({
                where: { key }
            });

            // If expired or not exists, reset
            if (!record || record.expiresAt < now) {
                // Determine new expiry
                const expiresAt = new Date(now.getTime() + windowSeconds * 1000);

                // create or update
                record = await tx.rateLimit.upsert({
                    where: { key },
                    update: { count: 1, expiresAt },
                    create: { key, count: 1, expiresAt }
                });

                return true; // Allowed (count is 1)
            }

            // Record exists and is valid
            if (record.count >= limit) {
                return false; // Limit exceeded
            }

            // Increment
            await tx.rateLimit.update({
                where: { key },
                data: { count: record.count + 1 }
            });

            return true; // Allowed
        });

        return result;

    } catch (error) {
        console.error("Rate limit error:", error);
        // Fail open or closed? 
        // Fail closed for security (VULN-004) -> if DB down, no scan.
        // Fail open for usability -> if DB down, allow scan.
        // Given this is DoS protection, failing open defeats the purpose if DB is overloaded.
        // But for a portfolio app, maybe fail open is better than breaking usage?
        // Let's fail OPEN but log error to be safe against glitches not stopping users.
        return true;
    }
}
