import { createApp } from './app';
import { config } from './config';
import { prisma } from './lib/prisma';
import { syncOverdue } from './services/followups';
import { syncSystemRoles } from './services/rbac';

async function main() {
  const app = createApp();

  // When new modules ship permissions, refresh system-role rows for every org
  // so existing customers get the new capabilities without a migration.
  try {
    const orgs = await prisma.organization.findMany({ select: { id: true } });
    await Promise.all(orgs.map((o) => syncSystemRoles(o.id)));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('System-role sync failed (continuing startup)', err);
  }

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`⚡ PRIMELEAD API listening on http://localhost:${config.port}`);
  });

  // Follow-up engine: mark overdue tasks + notify exactly once, every 60s.
  setInterval(
    async () => {
      try {
        const orgs = await prisma.organization.findMany({ where: { status: 'ACTIVE' }, select: { id: true } });
        for (const org of orgs) {
          await syncOverdue(org.id).catch(() => undefined);
        }
      } catch {
        // background loop must never crash the server
      }
    },
    60 * 1000
  );
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error', err);
  process.exit(1);
});
