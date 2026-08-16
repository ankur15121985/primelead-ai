/**
 * Online SQLite backup (no downtime, no extra deps).
 *
 * Uses SQLite's `VACUUM INTO` through the app's own Prisma client, so the
 * copy is transactionally consistent even while the API is serving traffic.
 *
 *   npm run backup -w server                 → data/backups/primelead-YYYYMMDD-HHmmss.db
 *   npm run backup -w server -- /custom/path → explicit destination path
 *
 * Scheduling (daily + retention) is the operator's job:
 *   - host cron:  0 2 * * *  cd /path/to/repo && npm run backup -w server
 *   - container:  docker exec <container> npx tsx scripts/backup-db.ts /backups/x.db
 *     (scripts/ is outside the tsc build; tsx runs it — node_modules in the
 *     image is kept whole so this works without a separate build step)
 *
 * The backup is a normal SQLite file — verify restores regularly (spec §58).
 */
import fs from 'fs';
import path from 'path';

async function main() {
  const { prisma } = await import('../src/lib/prisma');

  const destArg = process.argv[2];
  let dest: string;
  if (destArg) {
    dest = destArg;
  } else {
    const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    const dir = path.join(__dirname, '..', 'data', 'backups');
    fs.mkdirSync(dir, { recursive: true });
    dest = path.join(dir, `primelead-${stamp}.db`);
  }
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  // VACUUM INTO takes a literal — escape single quotes defensively.
  const literal = dest.replace(/'/g, "''");
  await prisma.$queryRawUnsafe(`VACUUM INTO '${literal}'`);

  const size = fs.statSync(dest).size;
  // eslint-disable-next-line no-console
  console.log(`Backup written: ${dest} (${(size / 1024).toFixed(0)} KB)`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Backup failed:', err instanceof Error ? err.message : err);
  const { prisma } = await import('../src/lib/prisma').catch(() => ({ prisma: null as any }));
  if (prisma) await prisma.$disconnect().catch(() => undefined);
  process.exit(1);
});
