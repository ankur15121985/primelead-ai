import { PrismaClient } from '@prisma/client';

// Single shared Prisma client (hoisted by npm workspaces).
// In tests we point DATABASE_URL at an in-memory SQLite file.
export const prisma = new PrismaClient();
