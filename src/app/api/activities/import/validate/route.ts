import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import Papa from 'papaparse';

const REQUIRED_FIELDS = ['Date', 'Type', 'Symbol', 'Quantity', 'Price', 'Account', 'Account Type', 'Platform'];

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { csvContent } = body;

        if (!csvContent) {
            return NextResponse.json({ error: 'No CSV content provided' }, { status: 400 });
        }

        // Parse CSV
        const parseResult = Papa.parse(csvContent, {
            header: true,
            skipEmptyLines: true,
            transformHeader: (h) => h.trim() // Handle potential whitespace in headers
        });

        if (parseResult.errors.length > 0) {
            return NextResponse.json({
                valid: false,
                errors: parseResult.errors.map(e => ({ row: e.row, message: e.message }))
            }, { status: 400 });
        }

        const rows = parseResult.data as any[];
        const errors: { row: number, message: string }[] = [];
        const validRows: any[] = [];

        // Fetch reference data for validation
        const accounts = await prisma.account.findMany();
        const platforms = await prisma.platform.findMany();

        // Create lookup maps
        // Use composite key for Account: "name|type" to ensure uniqueness and correct matching
        const accountMap = new Map(accounts.map(a => [`${a.name.toLowerCase()}|${a.type.toLowerCase()}`, a]));
        const platformMap = new Map(platforms.map(p => [p.name.toLowerCase(), p]));

        // Validate each row
        rows.forEach((row, index) => {
            const rowNum = index + 1; // 1-based index for user friendliness
            const rowErrors: string[] = [];

            // Check required fields
            for (const field of REQUIRED_FIELDS) {
                if (!row[field] || row[field].toString().trim() === '') {
                    rowErrors.push(`Missing required field: ${field}`);
                }
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, message: rowErrors.join(', ') });
                return;
            }

            // Validate Date
            const date = new Date(row['Date']);
            if (isNaN(date.getTime())) {
                rowErrors.push(`Invalid Date format: ${row['Date']}`);
            }

            // Validate Numbers
            const quantity = parseFloat(row['Quantity']);
            const price = parseFloat(row['Price']);
            const fee = row['Fee'] ? parseFloat(row['Fee']) : 0;

            if (isNaN(quantity)) rowErrors.push(`Invalid Quantity: ${row['Quantity']}`);
            if (isNaN(price)) rowErrors.push(`Invalid Price: ${row['Price']}`);
            if (row['Fee'] && isNaN(fee)) rowErrors.push(`Invalid Fee: ${row['Fee']}`);

            // Validate Account (Name + Type)
            const accountName = row['Account'].trim();
            const accountType = row['Account Type'].trim();
            const accountKey = `${accountName.toLowerCase()}|${accountType.toLowerCase()}`;
            const account = accountMap.get(accountKey);

            if (!account) {
                rowErrors.push(`Account not found: ${accountName} (${accountType})`);
            }

            // Validate Platform
            const platformName = row['Platform'].trim();
            const platform = platformMap.get(platformName.toLowerCase());
            if (!platform) {
                rowErrors.push(`Platform not found: ${platformName}`);
            } else if (account && account.platformId !== platform.id) {
                // Optional: Warn if account doesn't match platform?
            }

            if (rowErrors.length > 0) {
                errors.push({ row: rowNum, message: rowErrors.join('; ') });
            } else {
                validRows.push({
                    ...row,
                    accountId: account!.id,
                    platformId: platform!.id,
                    parsedDate: date,
                    parsedQuantity: quantity,
                    parsedPrice: price,
                    parsedFee: fee
                });
            }
        });

        return NextResponse.json({
            valid: errors.length === 0,
            errors,
            data: validRows,
            totalRows: rows.length
        });

    } catch (error) {
        console.error('Validation error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
