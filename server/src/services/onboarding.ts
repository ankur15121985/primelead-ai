/**
 * Onboarding & org bootstrap.
 *  - ensureOrgBasics: default pipeline + stages + subscription + settings
 *  - addSampleData: realistic fictional Indian demo data
 */
import { prisma } from '../lib/prisma';
import { hashPassword } from '../lib/passwords';
import { createLead } from './leads';
import { setOrgSetting } from './assignment';

export const DEFAULT_STAGES = [
  { name: 'New', color: '#3b82f6', order: 0, isWon: false, isLost: false },
  { name: 'Contacted', color: '#8b5cf6', order: 1, isWon: false, isLost: false },
  { name: 'Qualified', color: '#06b6d4', order: 2, isWon: false, isLost: false },
  { name: 'Proposal', color: '#f59e0b', order: 3, isWon: false, isLost: false },
  { name: 'Negotiation', color: '#ec4899', order: 4, isWon: false, isLost: false },
  { name: 'Won', color: '#10b981', order: 5, isWon: true, isLost: false },
  { name: 'Lost', color: '#64748b', order: 6, isWon: false, isLost: true },
];

export async function ensureOrgBasics(orgId: string): Promise<void> {
  const pipelineCount = await prisma.pipeline.count({ where: { orgId } });
  if (pipelineCount === 0) {
    const pipeline = await prisma.pipeline.create({
      data: { orgId, name: 'Sales Pipeline', isDefault: true },
    });
    await prisma.pipelineStage.createMany({
      data: DEFAULT_STAGES.map((s) => ({ ...s, orgId, pipelineId: pipeline.id })),
    });
  }
  const sub = await prisma.subscription.findUnique({ where: { orgId } });
  if (!sub) {
    await prisma.subscription.create({
      data: { orgId, status: 'TRIAL', planId: null, period: 'MONTHLY' },
    });
  }
  const sources = await prisma.orgSetting.findUnique({ where: { orgId_key: { orgId, key: 'leadSources' } } });
  if (!sources) {
    await setOrgSetting(orgId, 'leadSources', [
      { value: 'WEBSITE', enabled: true },
      { value: 'FACEBOOK', enabled: false },
      { value: 'WHATSAPP', enabled: false },
      { value: 'INDIAMART', enabled: false },
      { value: 'MANUAL', enabled: true },
    ]);
  }
}

export async function addSampleData(orgId: string, actorId: string) {
  const salespeople = (await prisma.user.findMany({
    where: { orgId, role: 'SALES', active: true },
    select: { id: true, name: true },
  })) as Array<{ id: string; name: string }>;
  const salesA: { id: string; name: string } | undefined = salespeople[0];
  const salesB: { id: string; name: string } | undefined = salespeople[1] || salesA;
  const pickOwner = (): string | null => {
    if (!salesA) return null;
    if (!salesB) return salesA.id;
    return Math.random() > 0.5 ? salesA.id : salesB.id;
  };

  const sample: Array<{
    name: string; phone?: string; email?: string; company?: string; source: string;
    priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'; expectedValue: number; notes?: string;
  }> = [
    { name: 'Rajesh Sharma', phone: '9811012345', email: 'rajesh.sharma@gmail.com', company: 'Sharma Furnishings', source: 'WEBSITE', priority: 'HIGH', expectedValue: 250000, notes: 'Looking for modular kitchen for new flat in Gurgaon.' },
    { name: 'Priya Patel', phone: '9822023456', email: 'priya.patel@yahoo.com', company: 'Patel Interiors', source: 'INDIAMART', priority: 'URGENT', expectedValue: 850000, notes: 'Needs 12 workstation office fit-out before end of month.' },
    { name: 'Amit Verma', phone: '9833034567', email: 'amit.verma@outlook.com', company: 'Verma Enterprises', source: 'FACEBOOK', priority: 'MEDIUM', expectedValue: 120000, notes: 'Enquired about bulk corporate orders.' },
    { name: 'Sunita Reddy', phone: '9844045678', email: 'sunita.reddy@gmail.com', company: 'Reddy Realty', source: 'WEBSITE', priority: 'HIGH', expectedValue: 1500000, notes: 'Builder wanting signage for 3 new projects.' },
    { name: 'Mohammed Irfan', phone: '9855056789', email: 'irfan.m@hotmail.com', company: 'Irfan Traders', source: 'WHATSAPP', priority: 'MEDIUM', expectedValue: 45000, notes: 'Asked for price list on WhatsApp.' },
    { name: 'Kavita Nair', phone: '9866067890', email: 'kavita.nair@gmail.com', company: 'Nair Boutique', source: 'INSTAGRAM', priority: 'LOW', expectedValue: 18000, notes: 'Follow-up needed after Instagram DM.' },
    { name: 'Suresh Gupta', phone: '9877078901', email: 'suresh.gupta@gmail.com', company: 'Gupta Agencies', source: 'JUSTDIAL', priority: 'HIGH', expectedValue: 300000, notes: 'Quoted on JustDial, wants site visit.' },
    { name: 'Ananya Iyer', phone: '9888089012', email: 'ananya.iyer@gmail.com', company: 'Iyer & Co', source: 'GOOGLE_ADS', priority: 'MEDIUM', expectedValue: 90000, notes: 'Came via Google Ads campaign "office-interiors".' },
    { name: 'Vikram Singh', phone: '9899090123', email: 'vikram.singh@gmail.com', company: 'Singh Motors', source: 'WEBSITE', priority: 'MEDIUM', expectedValue: 175000, notes: 'Interested in premium showroom signage.' },
    { name: 'Meera Krishnan', phone: '9900012345', email: 'meera.k@rediffmail.com', company: 'Krishnan Textiles', source: 'TRADEINDIA', priority: 'LOW', expectedValue: 60000, notes: 'TradeIndia enquiry, price-sensitive.' },
    { name: 'Deepak Joshi', phone: '9911123456', email: 'deepak.joshi@gmail.com', company: 'Joshi Constructions', source: 'PROPERTY_PORTAL', priority: 'URGENT', expectedValue: 420000, notes: 'RERA project — needs hoarding + brochures.' },
    { name: 'Neha Kapoor', phone: '9922234567', email: 'neha.kapoor@gmail.com', company: 'Kapoor Events', source: 'FACEBOOK', priority: 'MEDIUM', expectedValue: 75000, notes: 'Wedding season backdrop + branding.' },
  ];

  const stageMap = new Map<string, string>();
  const stages = await prisma.pipelineStage.findMany({ where: { orgId }, orderBy: { order: 'asc' } });
  stages.forEach((s, i) => stageMap.set(i.toString(), s.id));

  const statuses = ['NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
  const statusToStage: Record<string, number> = {
    NEW: 0, CONTACTED: 1, QUALIFIED: 2, PROPOSAL: 3, NEGOTIATION: 4, WON: 5, LOST: 6,
  };

  let created = 0;
  for (let i = 0; i < sample.length; i++) {
    const s = sample[i];
    const status = i < 4 ? statuses[i] : statuses[Math.floor(Math.random() * 4)];
    try {
      const lead = await createLead({
        orgId,
        actorId,
        name: s.name,
        phone: s.phone,
        email: s.email,
        company: s.company,
        source: s.source,
        priority: s.priority,
        expectedValue: s.expectedValue,
        notes: s.notes,
        ownerId: pickOwner(),
        status,
        stageId: stageMap.get(String(statusToStage[status])) || null,
        createdVia: 'manual-unassigned',
      });
      // spread out creation dates over the last 30 days
      await prisma.lead.update({
        where: { id: lead.id },
        data: { createdAt: new Date(Date.now() - Math.floor(Math.random() * 30) * 24 * 60 * 60 * 1000) },
      });
      created++;
    } catch {
      // skip duplicates
    }
  }

  // some activities + follow-ups so the timeline looks alive
  const leads = await prisma.lead.findMany({ where: { orgId, deletedAt: null }, take: 6 });
  const now = new Date();
  for (const lead of leads) {
    await prisma.activity.create({
      data: {
        orgId, leadId: lead.id, userId: lead.ownerId || actorId,
        type: 'WHATSAPP', title: 'WhatsApp message sent',
        body: 'Sent product brochure and price list.',
      },
    });
    if (lead.status !== 'WON' && lead.status !== 'LOST') {
      const due = new Date(now.getTime() + (Math.random() > 0.5 ? -1 : 1) * 24 * 60 * 60 * 1000);
      await prisma.task.create({
        data: {
          orgId, leadId: lead.id, userId: lead.ownerId || actorId,
          title: 'Follow up on quotation', kind: 'CALL', dueAt: due,
        },
      });
    }
  }

  return { created };
}
