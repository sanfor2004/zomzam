import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * Shared image-upload pipeline. Both the avatar route and the post route own the
 * exact same knowledge — validate → re-encode (strip EXIF) → write to disk — so
 * it lives here once. Callers tune behavior per-call via {@link ImageUploadOptions};
 * the defaults reproduce the original avatar behavior byte-for-byte.
 */
export interface ImageUploadOptions {
  /** Subdir under public/Assets/Uploads, e.g. 'avatars' or 'posts'. */
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
 * Validate, re-encode (stripping EXIF), and persist an uploaded image under
 * public/Assets/Uploads/<subdir>. Returns the public path (e.g.
 * "/Assets/Uploads/posts/post_ab34.webp"). Throws {@link ImageUploadError} on
 * validation failure so the caller maps it to a 400 — never returns a
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
  const uploadDir = path.join(process.cwd(), 'public', 'Assets', 'Uploads', options.subdir);
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  const filename = `${options.filenamePrefix}_${crypto.randomBytes(16).toString('hex')}.${ext}`;
  const target = path.join(uploadDir, filename);

  // Metadata is stripped by default — sharp only keeps it when .keepMetadata() is called.
  let image = sharp(buffer);
  if (options.maxDimension) {
    image = image.resize(options.maxDimension, options.maxDimension, { fit: 'inside', withoutEnlargement: true });
  }

  if (ext === 'png') await image.png({ compressionLevel: 8 }).toFile(target);
  else if (ext === 'webp') await image.webp({ quality: 90 }).toFile(target);
  else if (ext === 'gif') await image.gif().toFile(target);
  else await image.jpeg({ quality: 90 }).toFile(target);

  return `/Assets/Uploads/${options.subdir}/${filename}`;
}

/** Remove a previously stored upload by its public path. No-op if absent or default. */
export function deleteUploadFile(publicPath: string | null | undefined): void {
  if (!publicPath || publicPath.includes('default-avatar.png')) return;
  const full = path.join(process.cwd(), 'public', publicPath);
  if (fs.existsSync(full)) fs.unlinkSync(full);
}
