/**
 * Storage Service — cloud storage abstraction for recording files.
 *
 * Providers:
 *   - S3 (AWS S3)
 *   - R2 (Cloudflare R2)
 *   - local (filesystem, for development)
 *
 * Handles: upload, download, signed URLs, delete.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

// ── Types ─────────────────────────────────────────────────

export interface StorageProvider {
  readonly name: string;
  upload(key: string, body: Buffer, contentType: string): Promise<StorageResult>;
  getSignedUrl(key: string, expiresIn?: number): Promise<string>;
  delete(key: string): Promise<void>;
  getPublicUrl(key: string): string;
}

export interface StorageResult {
  key: string;
  url: string;
  size: number;
}

// ── Provider Resolution ───────────────────────────────────

export function resolveStorageProvider(): StorageProvider {
  const provider = process.env.STORAGE_PROVIDER || 'local';

  if (provider === 's3' && process.env.AWS_S3_BUCKET) {
    return new S3Provider(
      process.env.AWS_S3_BUCKET,
      process.env.AWS_S3_REGION || 'us-east-1',
      process.env.AWS_ACCESS_KEY_ID || '',
      process.env.AWS_SECRET_ACCESS_KEY || '',
    );
  }

  if (provider === 'r2' && process.env.R2_BUCKET) {
    return new R2Provider(
      process.env.R2_BUCKET,
      process.env.R2_ACCOUNT_ID || '',
      process.env.R2_ACCESS_KEY_ID || '',
      process.env.R2_SECRET_ACCESS_KEY || '',
    );
  }

  // Default: local filesystem
  return new LocalProvider(path.join(__dirname, '..', '..', '..', 'uploads'));
}

// ── Upload Recording ──────────────────────────────────────

/**
 * Upload a recording file to storage.
 */
export async function uploadRecording(orgId: string, callId: string, fileName: string, body: Buffer, contentType: string): Promise<StorageResult> {
  const provider = resolveStorageProvider();
  const key = `recordings/${orgId}/${callId}/${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${fileName}`;
  const result = await provider.upload(key, body, contentType);
  return result;
}

/**
 * Get a signed URL for downloading a recording.
 */
export async function getRecordingUrl(key: string, expiresIn?: number): Promise<string> {
  const provider = resolveStorageProvider();
  return provider.getSignedUrl(key, expiresIn);
}

/**
 * Delete a recording file.
 */
export async function deleteRecording(key: string): Promise<void> {
  const provider = resolveStorageProvider();
  await provider.delete(key);
}

// ── Local Provider ────────────────────────────────────────

class LocalProvider implements StorageProvider {
  readonly name = 'local';
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  async upload(key: string, body: Buffer, _contentType: string): Promise<StorageResult> {
    const fullPath = path.join(this.basePath, key);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fullPath, body);
    return { key, url: `/uploads/${key}`, size: body.length };
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = path.join(this.basePath, key);
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
  }

  getPublicUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

// ── S3 Provider ───────────────────────────────────────────

class S3Provider implements StorageProvider {
  readonly name: string;
  private bucket: string;
  private region: string;
  private accessKeyId: string;
  private secretAccessKey: string;

  constructor(bucket: string, region: string, accessKeyId: string, secretAccessKey: string, name = 's3') {
    this.name = name;
    this.bucket = bucket;
    this.region = region;
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
  }

  async upload(key: string, body: Buffer, contentType: string): Promise<StorageResult> {
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    const date = new Date().toUTCString();
    const signature = this.sign('PUT', key, date, contentType);

    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Content-Type': contentType,
        'Date': date,
        'Authorization': `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${this.getScope(date)}, SignedHeaders=content-type;date, Signature=${signature}`,
      },
      body,
    });

    if (!response.ok) throw new Error(`S3 upload failed: ${response.status}`);
    return { key, url, size: body.length };
  }

  async getSignedUrl(key: string, expiresIn = 3600): Promise<string> {
    const date = new Date();
    const expiry = Math.floor(date.getTime() / 1000) + expiresIn;
    const credential = `${this.accessKeyId}/${this.getScope(date.toUTCString())}`;
    const policy = JSON.stringify({
      expiration: new Date(expiry * 1000).toISOString(),
      conditions: [
        { bucket: this.bucket },
        ['eq', '$key', key],
      ],
    });
    const encodedPolicy = Buffer.from(policy).toString('base64');
    const signature = this.sign('GET', key, date.toUTCString(), '', encodedPolicy);
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=${encodeURIComponent(credential)}&X-Amz-Date=${date.toISOString().replace(/[:\-]|\.\d{3}/g, '')}&X-Amz-Expires=${expiresIn}&X-Amz-SignedHeaders=host&X-Amz-Signature=${signature}`;
  }

  async delete(key: string): Promise<void> {
    const url = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
    const date = new Date().toUTCString();
    const signature = this.sign('DELETE', key, date);
    await fetch(url, {
      method: 'DELETE',
      headers: { 'Date': date, 'Authorization': `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${this.getScope(date)}, SignedHeaders=date, Signature=${signature}` },
    });
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  private getScope(date: string) {
    const d = new Date(date);
    return `${d.toISOString().split('T')[0].replace(/-/g, '')}/${this.region}/s3/aws4_request`;
  }

  private sign(method: string, key: string, date: string, contentType = '', body?: string) {
    const d = new Date(date);
    const dateStr = d.toISOString().replace(/[:\-]|\.\d{3}/g, '');
    const dateOnly = dateStr.slice(0, 8);
    const canonicalRequest = [
      method, `/${key}`,
      '', // query string
      `content-type:${contentType}\ndate:${date}\n`,
      'content-type;date',
      body || '',
    ].join('\n');
    const stringToSign = [
      'AWS4-HMAC-SHA256', dateStr,
      `${dateOnly}/${this.region}/s3/aws4_request`,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');
    const kDate = crypto.createHmac('sha256', `AWS4${this.secretAccessKey}`).update(dateOnly).digest();
    const kRegion = crypto.createHmac('sha256', kDate).update(this.region).digest();
    const kService = crypto.createHmac('sha256', kRegion).update('s3').digest();
    const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
    return crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  }
}

// ── R2 Provider (Cloudflare) ──────────────────────────────

class R2Provider extends S3Provider {
  readonly name = 'r2';

  constructor(bucket: string, accountId: string, accessKeyId: string, secretAccessKey: string) {
    // R2 uses S3-compatible API with custom endpoint
    super(bucket, 'auto', accessKeyId, secretAccessKey);
    // Override the endpoint for R2
    (this as any).endpoint = `https://${accountId}.r2.cloudflarestorage.com`;
  }

  getPublicUrl(key: string): string {
    // R2 public access requires a custom domain
    return process.env.R2_PUBLIC_URL ? `${process.env.R2_PUBLIC_URL}/${key}` : super.getPublicUrl(key);
  }
}
