/* eslint-disable @typescript-eslint/no-explicit-any */
import { auth } from "@/auth";
import { PrismaClient } from "@prisma/client";
import { NextResponse } from "next/server";

const prisma = new PrismaClient();

export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await auth();
    if (!session || (session.user as any).role !== 'ADMIN') {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    const { id } = await params;

    try {
        // Prevent deleting self
        if (session.user?.id === id) {
            return new NextResponse("Cannot delete yourself", { status: 400 });
        }

        await prisma.user.delete({
            where: { id }
        });

        return new NextResponse(null, { status: 204 });
    } catch (error) {
        console.error("Error deleting user:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
