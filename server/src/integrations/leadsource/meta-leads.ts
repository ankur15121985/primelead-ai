/**
 * Meta Lead Ads adapter (Facebook & Instagram).
 *
 * Facebook's `leadgen` webhook delivers the form response:
 *   { field_data: [{ name, values: [...] }], leadgen_id, form_id, ad_id,
 *     adset_id, campaign_id, page_id, created_time }
 *
 * `field_data` answers are mapped by name (full_name, phone_number, email,
 * company_name, city, state, plus custom question names). Every identifier is
 * kept in customFields for campaign → ad-set → ad → form attribution, and the
 * `leadgen_id` is the replay key.
 *
 * The webhook is authenticated by the org's own `x-webhook-secret` (the
 * shared ingestion point) — Meta's app secret is configured in the
 * integration config when present.
 */
import type { LeadSourceAdapter, NormalizedLead } from '../leadsource';

function pick(fieldData: Array<{ name?: string; values?: string[] }> | undefined, name: string): string | undefined {
  const match = (fieldData || []).find(
    (f) => (f.name || '').toLowerCase().replace(/[\s_-]/g, '') === name.toLowerCase().replace(/[\s_-]/g, '')
  );
  const v = match?.values?.[0];
  return v !== undefined && String(v).trim() !== '' ? String(v).trim() : undefined;
}

export const metaLeadsAdapter: LeadSourceAdapter = {
  source: 'FACEBOOK',

  validate(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return 'Payload must be a JSON object.';
    const obj = raw as Record<string, unknown>;
    const entry = Array.isArray(obj.entry) ? obj.entry[0] : null;
    const entryObj = entry as Record<string, unknown> | null;
    const changes = entryObj?.changes;
    const change = Array.isArray(changes) ? changes[0] : null;
    const value = change && (change as Record<string, unknown>).value;
    if (!value || typeof value !== 'object') return 'Payload is missing the leadgen change value.';
    const v = value as Record<string, unknown>;
    if (!v.leadgen_id) return 'Payload is missing leadgen_id.';
    if (!Array.isArray(v.field_data)) return 'Payload is missing field_data.';
    return null;
  },

  normalize(raw: unknown): NormalizedLead {
    const obj = raw as Record<string, unknown>;
    const entry = Array.isArray(obj.entry) ? obj.entry[0] : null;
    const entryObj = entry as Record<string, unknown> | null;
    const changes = entryObj?.changes;
    const change = Array.isArray(changes) ? changes[0] : null;
    const value = (change as Record<string, unknown>)?.value as Record<string, unknown>;
    const fieldData = value.field_data as Array<{ name?: string; values?: string[] }>;

    const name = pick(fieldData, 'full_name') || pick(fieldData, 'name') || 'Facebook Lead';
    const phone = pick(fieldData, 'phone_number');
    const email = pick(fieldData, 'email');
    const company = pick(fieldData, 'company_name');
    const city = pick(fieldData, 'city');
    const state = pick(fieldData, 'state');

    const customFields: Record<string, string> = {};
    if (value.form_id) customFields.metaFormId = String(value.form_id);
    if (value.ad_id) customFields.metaAdId = String(value.ad_id);
    if (value.adset_id) customFields.metaAdSetId = String(value.adset_id);
    if (value.campaign_id) customFields.metaCampaignId = String(value.campaign_id);
    if (value.page_id) customFields.metaPageId = String(value.page_id);
    if (city) customFields.city = city;
    if (state) customFields.state = state;
    // Anything else the form asked (custom questions) stays visible on the lead.
    for (const f of fieldData || []) {
      const key = (f.name || '').toLowerCase().replace(/[\s_-]/g, '');
      if (!key || ['fullname', 'name', 'phonenumber', 'email', 'companyname', 'city', 'state'].includes(key)) continue;
      if (f.values?.[0] && !customFields[`question:${key}`]) customFields[`question:${key}`] = f.values[0];
    }

    return {
      name,
      phone,
      email,
      company,
      notes: `Lead from ${value.page_id ? `page ${value.page_id}` : 'Meta'}${value.campaign_id ? `, campaign ${value.campaign_id}` : ''}.`,
      customFields,
      externalId: value.leadgen_id ? String(value.leadgen_id) : null,
    };
  },
};
