/**
 * File-upload security (OWASP / spec §39).
 *
 * Never trust the browser-supplied filename, extension or MIME type: the
 * content-type header is trivially spoofable, so the file *signature* (magic
 * bytes) is the ground truth. This module provides:
 *
 *  - `assertSafeCsvUpload`  — whitelisted extension + sniffed content type,
 *    used before any CSV import is parsed.
 *  - `sanitizeCsvCell`      — neutralises spreadsheet formula injection
 *    (OWASP CSV Injection): cells beginning with `=`, `+`, `-` or `@` are
 *    prefixed with a single quote so Excel/Sheets treats them as text.
 */
import { badRequest } from './http';

/** Allowed CSV upload MIME types (browser-declared, cross-checked but not trusted). */
const ALLOWED_MIME = new Set([
  'text/csv',
  'text/plain',
  'text/comma-separated-values',
  'application/csv',
  'application/vnd.ms-excel',
  'application/octet-stream', // some browsers send this for .csv
  'text/tab-separated-values',
]);

/** Reject anything that is clearly not a CSV/text upload. Throws 400. */
export function assertSafeCsvUpload(file: { originalname: string; mimetype: string; buffer: Buffer }): void {
  const name = file.originalname || '';
  const lower = name.toLowerCase();
  const ext = lower.slice(lower.lastIndexOf('.'));
  if (!['.csv', '.txt'].includes(ext)) {
    throw badRequest('Only .csv or .txt files can be imported.');
  }

  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw badRequest('The uploaded file does not look like a CSV (unexpected content type).');
  }

  // Magic-byte sniff: reject binary payloads even when the extension/MIME is
  // spoofed. A NUL byte in the first 64 bytes is a reliable marker that the
  // file is not text. CSV column headers vary, so absence of a known header is
  // NOT a rejection — the CSV parser validates the actual shape later.
  const hasNul = file.buffer.subarray(0, 64).includes(0);
  if (hasNul) throw badRequest('The uploaded file is not a valid CSV (binary content detected).');
}

/**
 * OWASP CSV-injection protection. Values that would be interpreted as a
 * spreadsheet formula are prefixed so the cell is read as text.
 */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];
export function sanitizeCsvCell(value: unknown): unknown {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (FORMULA_PREFIXES.some((p) => value.startsWith(p))) {
    return `'${value}`;
  }
  return value;
}

/** Sanitise every string cell in a parsed CSV record (used before persistence). */
export function sanitizeCsvRecord(record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    out[key] = sanitizeCsvCell(value);
  }
  return out;
}
