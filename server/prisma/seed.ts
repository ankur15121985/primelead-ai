/**
 * Seed script.
 *
 * Creates:
 *   - Three public pricing plans
 *   - A demo organization "Sharma Enterprises" with demo credentials:
 *       email:    owner@primelead.demo
 *       password: Demo@1234
 *   - Owner + 2 salespeople + a manager
 *   - Default pipeline + stages
 *   - A full set of realistic (fictional) leads, activities and follow-ups
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ensureOrgBasics, addSampleData, DEFAULT_STAGES } from '../src/services/onboarding';
import { seedOrgRoles } from '../src/services/rbac';
import { prisma } from '../src/lib/prisma';

async function seedPlans() {
  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      priceMonthly: 0,
      priceYearly: 0,
      userLimit: 2,
      leadLimit: 1000,
      features: [
        'Up to 2 users',
        '1,000 leads',
        'Basic lead management',
        'Manual lead entry',
        'Email support',
      ],
    },
    {
      slug: 'growth',
      name: 'Growth',
      priceMonthly: 149900, // paise (₹1,499)
      priceYearly: 1499000, // paise (₹14,990)
      userLimit: 10,
      leadLimit: 25000,
      features: [
        'Up to 10 users',
        '25,000 leads',
        'Automatic lead assignment',
        'WhatsApp integration',
        'AI follow-up writer',
        'Quotations & invoices',
        'Reports & analytics',
        'Priority support',
      ],
    },
    {
      slug: 'business',
      name: 'Business',
      priceMonthly: 399900, // paise (₹3,999)
      priceYearly: 3999000, // paise (₹39,990)
      userLimit: 0, // unlimited
      leadLimit: 0, // unlimited
      features: [
        'Unlimited users',
        'Unlimited leads',
        'Everything in Growth',
        'QR lead capture campaigns',
        'API & webhooks',
        'CSV import/export',
        'Custom AI assistant',
        'Dedicated success manager',
      ],
    },
  ];
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { slug: plan.slug },
      create: plan,
      update: plan,
    });
  }
  // eslint-disable-next-line no-console
  console.log('✔ Plans seeded');
}

async function seedDemoOrg() {
  const existing = await prisma.user.findFirst({ where: { email: 'owner@primelead.demo' } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('✔ Demo org already exists — skipping');
    return;
  }

  const org = await prisma.organization.create({
    data: {
      name: 'Sharma Enterprises',
      slug: 'sharma-enterprises',
      businessType: 'SERVICES',
      plan: 'GROWTH',
    },
  });

  const owner = await prisma.user.create({
    data: {
      orgId: org.id,
      name: 'Rohit Sharma',
      email: 'owner@primelead.demo',
      passwordHash: await bcrypt.hash('Demo@1234', 10),
      role: 'OWNER',
      title: 'Founder',
      emailVerifiedAt: new Date(),
    },
  });
  const manager = await prisma.user.create({
    data: {
      orgId: org.id,
      name: 'Anita Desai',
      email: 'manager@primelead.demo',
      passwordHash: await bcrypt.hash('Demo@1234', 10),
      role: 'MANAGER',
      title: 'Sales Manager',
    },
  });
  const sales1 = await prisma.user.create({
    data: {
      orgId: org.id,
      name: 'Karan Mehta',
      email: 'karan@primelead.demo',
      passwordHash: await bcrypt.hash('Demo@1234', 10),
      role: 'SALES',
      title: 'Sales Executive',
    },
  });
  const sales2 = await prisma.user.create({
    data: {
      orgId: org.id,
      name: 'Pooja Singh',
      email: 'pooja@primelead.demo',
      passwordHash: await bcrypt.hash('Demo@1234', 10),
      role: 'SALES',
      title: 'Sales Executive',
    },
  });

  await ensureOrgBasics(org.id);
  await seedOrgRoles(org.id);
  await addSampleData(org.id, owner.id);

  // sanity check stage names
  const stages = await prisma.pipelineStage.findMany({ where: { orgId: org.id }, orderBy: { order: 'asc' } });
  if (stages.length !== DEFAULT_STAGES.length) {
    // eslint-disable-next-line no-console
    console.warn('⚠ Pipeline stage count mismatch:', stages.length);
  }

  await prisma.subscription.upsert({
    where: { orgId: org.id },
    create: { orgId: org.id, status: 'TRIAL', period: 'MONTHLY' },
    update: {},
  });

  // eslint-disable-next-line no-console
  console.log('✔ Demo org seeded: owner@primelead.demo / Demo@1234');
}

/** Demo QR campaign — idempotent, runs even if the demo org already exists. */
async function seedDemoQr(orgId: string) {
  const qrSlug = 'demo-shop-counter';
  const existing = await prisma.qrCode.findUnique({ where: { slug: qrSlug } });
  if (existing) return;
  const campaign =
    (await prisma.campaign.findFirst({ where: { orgId, name: 'Shop Counter' } })) ||
    (await prisma.campaign.create({
      data: { orgId, name: 'Shop Counter', source: 'QR', description: 'QR stand near the billing counter.' },
    }));
  await prisma.qrCode.create({
    data: {
      orgId,
      campaignId: campaign.id,
      title: 'Shop Counter',
      description: 'Scan to enquire about our products and services.',
      slug: qrSlug,
      fields: ['name', 'phone', 'email', 'message'],
      scanCount: 12,
      leadCount: 4,
    },
  });
  // eslint-disable-next-line no-console
  console.log('✔ Demo QR campaign seeded');
}

/** Demo documents (quotation → invoice), contacts & integrations — idempotent. */
async function seedDemoBusiness(demoOrgId: string) {
  const existing = await prisma.quotation.findFirst({ where: { orgId: demoOrgId } });
  if (existing) {
    // eslint-disable-next-line no-console
    console.log('✔ Demo business data already exists — skipping');
    return;
  }
  const lead = await prisma.lead.findFirst({ where: { orgId: demoOrgId, deletedAt: null } });
  const leadId = lead?.id || null;

  const quote = await prisma.quotation.create({
    data: {
      orgId: demoOrgId,
      number: 'QT-2026-0001',
      leadId,
      customerName: 'Vikram Properties',
      company: 'Vikram Realty Pvt Ltd',
      address: 'MG Road, Pune, Maharashtra',
      gstin: '27AABCV1234F1Z5',
      email: 'accounts@vikramrealty.in',
      phone: '9822001122',
      discount: 0,
      gstSummary: { cgst: 18000, sgst: 18000, igst: 0 }, // paise
      subtotal: 100000, // paise (₹1,000)
      total: 136000, // paise (₹1,360)
      terms: 'Payment within 7 days of acceptance. GST extra as applicable.',
      validityDays: 15,
      status: 'SENT',
      items: {
        create: [
          {
            description: 'Digital marketing campaign — monthly retainer',
            quantity: 1,
            rate: 100000, // paise (₹1,000)
            taxPct: 18,
            cgst: 9000, // paise
            sgst: 9000, // paise
            igst: 0,
            amount: 118000, // paise (₹1,180)
          },
        ],
      },
    },
  });

  await prisma.invoice.create({
    data: {
      orgId: demoOrgId,
      number: 'INV-2026-0001',
      leadId,
      quotationId: quote.id,
      customerName: 'Vikram Properties',
      company: 'Vikram Realty Pvt Ltd',
      billingAddress: 'MG Road, Pune, Maharashtra',
      gstin: '27AABCV1234F1Z5',
      discount: 0,
      gstSummary: { cgst: 18000, sgst: 18000, igst: 0 }, // paise
      subtotal: 100000, // paise (₹1,000)
      total: 136000, // paise (₹1,360)
      paidAmount: 136000, // paise (₹1,360)
      status: 'PAID',
      dueDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      terms: 'Thank you for your business!',
      items: {
        create: [
          {
            description: 'Digital marketing campaign — monthly retainer',
            hsnSac: '9983',
            quantity: 1,
            rate: 100000, // paise (₹1,000)
            taxPct: 18,
            cgst: 9000, // paise
            sgst: 9000, // paise
            igst: 0,
            amount: 118000, // paise (₹1,180)
          },
        ],
      },
    },
  });

  await prisma.contact.createMany({
    data: [
      { orgId: demoOrgId, leadId, name: 'Vikram Mehta', phone: '9822001122', email: 'vikram@vikramrealty.in', company: 'Vikram Realty', notes: 'Prefers WhatsApp over calls.', tags: ['VIP', 'Property'] as any },
      { orgId: demoOrgId, name: 'Sneha Kulkarni', phone: '9890987654', email: 'sneha.k@gmail.com', company: 'Kulkarni Interiors', tags: ['Interior'] as any },
    ],
  });

  await prisma.integration.createMany({
    data: [
      {
        orgId: demoOrgId,
        source: 'WHATSAPP',
        name: 'WhatsApp Business',
        enabled: false,
        status: 'DISCONNECTED',
      },
      {
        orgId: demoOrgId,
        source: 'FACEBOOK',
        name: 'Facebook Lead Ads',
        enabled: false,
        status: 'DISCONNECTED',
      },
    ],
  });

  // eslint-disable-next-line no-console
  console.log('✔ Demo business data seeded (quotation, invoice, contacts, integrations)');
}

async function main() {
  await seedPlans();
  await seedDemoOrg();
  // Demo QR campaign must run even when the demo org already exists
  const demoOrg = await prisma.organization.findFirst({ where: { name: 'Sharma Enterprises' } });
  if (demoOrg) {
    await seedDemoQr(demoOrg.id);
    await seedDemoBusiness(demoOrg.id);
  }
  // eslint-disable-next-line no-console
  console.log('✔ Seed complete');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
