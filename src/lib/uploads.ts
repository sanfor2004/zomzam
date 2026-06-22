import sharp from 'sharp';
import crypto from 'crypto';
import { put, del } from '@vercel/blob';

/**
 * Shared image-upload pipeline. Both the avatar route and the post route own the
 * exact same knowledge — validate → re-encode (strip EXIF) → upload to Vercel
 * Blob — so it lives here once. Callers tune behavior per-call via
 * {@link ImageUploadOptions}; the defaults reproduce the original avatar
 * behavior byte-for-byte.
 *
 * Storage lives in Vercel Blob, not local disk: Vercel's serverless functions
 * have a read-only filesystem at runtime (besides the ephemeral /tmp), so
 * writing under public/Assets/Uploads — which worked in `next dev` — threw on
 * every deploy. Requires BLOB_READ_WRITE_TOKEN (auto-set by Vercel once a Blob
 * store is attached to the project; see .env.example for local dev).
 */
export interface ImageUploadOptions {
  /** Blob path prefix, e.g. 'avatars' or 'posts'. */
  subdir: string;
  /** Filename stem; a random suffix + extension are appended. */
  filenamePrefix: string;
  /** Hard size ceiling in bytes. Default 2 MB. */
  maxBytes?: number;
  /** Accepted MIME types. Default JPG/PNG/GIF/WebP (avatars). Posts pass JPG/PNG/WebP. */
  allowedTypes?: string[];
  /** If set, clamp the longest edge to this many px (no upscaling). Omit to keep full size. */
  maxDimension?: number;
}

const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/** Distinct type so routes can tell a 400 (bad upload) from a 500 (sharp/disk). */
export class ImageUploadError extends Error {}

/**
 * Validate, re-encode (stripping EXIF), and upload an image to Vercel Blob
 * under <subdir>/. Returns the blob's public URL. Throws {@link ImageUploadError}
 * on validation failure so the caller maps it to a 400 — never returns a
 * partial/empty success.
 */
export async function processImageUpload(file: File, options: ImageUploadOptions): Promise<string> {
  const maxBytes = options.maxBytes ?? 2 * 1024 * 1024;
  const allowed = options.allowedTypes ?? DEFAULT_ALLOWED_TYPES;

  if (file.size > maxBytes) {
    throw new ImageUploadError(`File too large. Max ${Math.round(maxBytes / 1024 / 1024)}MB allowed.`);
  }
  if (!allowed.includes(file.type)) {
    const names = allowed.map((t) => t.split('/')[1].toUpperCase()).join(', ');
    throw new ImageUploadError(`Invalid file type. Allowed: ${names}.`);
  }

  const ext = file.type.split('/')[1];
  const buffer = Buffer.from(await file.arrayBuffer());

  // Metadata is stripped by default — sharp only keeps it when .keepMetadata() is called.
  let image = sharp(buffer);
  if (options.maxDimension) {
    image = image.resize(options.maxDimension, options.maxDimension, { fit: 'inside', withoutEnlargement: true });
  }

  let output: Buffer;
  if (ext === 'png') output = await image.png({ compressionLevel: 8 }).toBuffer();
  else if (ext === 'webp') output = await image.webp({ quality: 90 }).toBuffer();
  else if (ext === 'gif') output = await image.gif().toBuffer();
  else output = await image.jpeg({ quality: 90 }).toBuffer();

  const filename = `${options.filenamePrefix}_${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const blob = await put(`${options.subdir}/${filename}`, output, {
    access: 'public',
    contentType: file.type,
  });

  return blob.url;
}

/**
 * Remove a previously stored upload by its public Blob URL. No-op if absent,
 * the bundled default avatar, or a pre-migration local path (`/Assets/...`) —
 * those no longer exist in Blob storage, so deleting them would just throw.
 */
export async function deleteUploadFile(publicUrl: string | null | undefined): Promise<void> {
  if (!publicUrl || publicUrl.includes('default-avatar.png') || publicUrl.startsWith('/')) return;
  try {
    await del(publicUrl);
  } catch (error) {
    console.error('Failed to delete blob:', error);
  }
}
