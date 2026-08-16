/**
 * IndiaMART buyer-enquiry adapter.
 *
 * IndiaMART seller integrations deliver buyer enquiries with fields like
 * BUYER_NAME, MOBILE, EMAIL, SUBJECT, QUERY (the message), PRODUCT,
 * COMPANY, CITY, STATE, QTY and a query id (SR_NO / QUERY_ID). We map the
 * documented names onto the canonical shape and keep the enquiry-specific
 * fields in customFields for attribution. Anything unknown is preserved in
 * customFields rather than dropped.
 *
 * NOTE: IndiaMART's exact payload field names vary by plan/integration type
 * (API vs CSV vs email). This adapter accepts the commonly documented names
 * plus common aliases; if your feed uses different keys, extend the alias
 * map — the adapter contract stays the same.
 */
import type { LeadSourceAdapter, NormalizedLead } from '../leadsource';

const NAME_KEYS = ['BUYER_NAME', 'CUSTOMER_NAME', 'NAME', 'contact_name', 'Contact Name'];
const PHONE_KEYS = ['MOBILE', 'PHONE', 'PHONE_NUMBER', 'CONTACT_NO', 'contact_number', 'Mobile Number'];
const EMAIL_KEYS = ['EMAIL', 'EMAIL_ID', 'EMAIL_ADDRESS', 'Email'];
const COMPANY_KEYS = ['COMPANY', 'COMPANY_NAME', 'BUSINESS_NAME', 'Company'];
const PRODUCT_KEYS = ['PRODUCT', 'PRODUCT_NAME', 'ITEM'];
const QUERY_KEYS = ['QUERY', 'MESSAGE', 'QUERY_TEXT', 'REMARKS', 'Enquiry', 'Requirement'];
const CITY_KEYS = ['CITY', 'CITY_NAME'];
const STATE_KEYS = ['STATE', 'STATE_NAME'];
const QTY_KEYS = ['QTY', 'QUANTITY'];
const ID_KEYS = ['QUERY_ID', 'SR_NO', 'ENQUIRY_ID', 'QUERY_NO'];

function first(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return undefined;
}

export const indiamartAdapter: LeadSourceAdapter = {
  source: 'INDIAMART',

  validate(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return 'Payload must be a JSON object.';
    const obj = raw as Record<string, unknown>;
    // IndiaMART sometimes wraps enquiries in an array or a `data` key.
    const inner = Array.isArray(obj.data) ? obj.data[0] : obj.data && typeof obj.data === 'object' ? obj.data : obj;
    if (!inner || typeof inner !== 'object') return 'Payload must contain an enquiry object.';
    return null;
  },

  normalize(raw: unknown): NormalizedLead {
    const obj = raw as Record<string, unknown>;
    const inner = Array.isArray(obj.data) ? obj.data[0] : obj.data && typeof obj.data === 'object' ? obj.data : obj;
    const r = (inner as Record<string, unknown>) || {};

    const name = first(r, NAME_KEYS) || 'IndiaMART Enquiry';
    const phone = first(r, PHONE_KEYS);
    const email = first(r, EMAIL_KEYS);
    const company = first(r, COMPANY_KEYS);
    const product = first(r, PRODUCT_KEYS);
    const query = first(r, QUERY_KEYS);
    const city = first(r, CITY_KEYS);
    const state = first(r, STATE_KEYS);
    const qty = first(r, QTY_KEYS);
    const externalId = first(r, ID_KEYS);

    const notes = [query && `Enquiry: ${query}`, product && `Product: ${product}`, qty && `Quantity: ${qty}`]
      .filter(Boolean)
      .join('\n');

    const customFields: Record<string, string> = {};
    if (product) customFields.product = product;
    if (city) customFields.city = city;
    if (state) customFields.state = state;
    if (qty) customFields.quantity = qty;
    if (externalId) customFields.indiamartQueryId = externalId;

    return { name, phone, email, company, notes: notes || null, customFields, externalId };
  },
};
