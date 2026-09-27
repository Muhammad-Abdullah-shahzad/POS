/**
 * Image storage for product photos and company logos.
 *
 * Uploads are held in memory, sent straight to Google Drive, and only the
 * Drive link is saved in the database. Nothing is written to the VPS disk.
 * Browsers load images through `readStoredImage`, which keeps recently used
 * ones in memory so Drive is asked for each image only once.
 *
 * Images saved before this change live under /uploads on the server. They
 * still display, are cleaned up when replaced, and can be moved to Drive with
 * `npm run images:to-drive`.
 */
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import multer from 'multer';
import { BadRequestError } from '../core/errors';
import { DriveImage, deleteFromDrive, downloadDriveImage, extractDriveFileId, uploadToDrive } from '../utils/googleDrive';
import { LruCache } from '../utils/lruCache';

export type ImageKind = 'products' | 'logos';

/** One Drive folder per kind of image. */
const DRIVE_FOLDERS: Record<ImageKind, string> = {
  products: 'POS_Product_Images',
  logos: 'POS_Company_Logos',
};

const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
/** Memory set aside for images being served; the least used are dropped first. */
const IMAGE_CACHE_BYTES = 64 * 1024 * 1024;
/** Types served back to browsers. SVG is left out because it can carry script. */
const SERVED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
const EXTENSIONS: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const ALLOWED_NAMES = /\.(jpe?g|png|webp)$/i;
const DATA_URL = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i;

/** Where images saved before Drive storage live; used only to clean them up. */
export const LEGACY_UPLOADS_DIR = path.join(process.cwd(), 'uploads');

/**
 * Accepts one JPG, PNG or WebP image into memory. It never touches the disk;
 * the controller hands the bytes to storeUploadedImage.
 */
export function imageUpload(maxBytes = MAX_IMAGE_BYTES) {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: maxBytes, files: 1 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED_NAMES.test(file.originalname) && file.mimetype in EXTENSIONS) {
        cb(null, true);
        return;
      }
      cb(new BadRequestError('Only JPG, PNG and WebP images are allowed'));
    },
  });
}

export const productImageUpload = imageUpload();

interface ImageData {
  data: Buffer;
  mimeType: string;
}

/** Upload an image to Drive and return the link to save in the database. */
export async function storeImage(kind: ImageKind, tenantId: string, image: ImageData): Promise<string> {
  const extension = EXTENSIONS[image.mimeType.toLowerCase()] ?? 'img';
  // The company id and a random suffix make each name unique and traceable.
  const fileName = `${kind}-${tenantId}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.${extension}`;

  const { url } = await uploadToDrive({ data: image.data, fileName, mimeType: image.mimeType, folder: DRIVE_FOLDERS[kind] });
  return url;
}

export const storeUploadedImage = (kind: ImageKind, tenantId: string, file: Express.Multer.File): Promise<string> =>
  storeImage(kind, tenantId, { data: file.buffer, mimeType: file.mimetype });

/** True for an image sent inline as base64, as the desktop till does. */
export const isDataUrlImage = (value: unknown): value is string => typeof value === 'string' && DATA_URL.test(value);

/** Move an inline base64 image to Drive and return its link. */
export async function storeDataUrlImage(kind: ImageKind, tenantId: string, dataUrl: string): Promise<string> {
  const match = dataUrl.match(DATA_URL);
  if (!match) throw new BadRequestError('Not an image');

  const data = Buffer.from(match[2], 'base64');
  if (data.length > MAX_IMAGE_BYTES) throw new BadRequestError('Image is larger than 15 MB');
  const declared = match[1].toLowerCase();
  return storeImage(kind, tenantId, { data, mimeType: declared === 'image/jpg' ? 'image/jpeg' : declared });
}

/**
 * Delete a stored image: from Drive, or from the server disk for an older
 * image. Never throws, so a missing file cannot undo a completed change.
 */
export async function removeStoredImage(url?: string | null): Promise<void> {
  if (!url) return;

  const driveId = extractDriveFileId(url);
  if (driveId) {
    servedImages.delete(driveId);
    await deleteFromDrive(driveId);
    return;
  }

  // Only files inside the uploads folder, so a stored path can never reach elsewhere.
  if (!url.startsWith('/uploads/')) return;
  const file = path.resolve(LEGACY_UPLOADS_DIR, url.replace(/^\/uploads\//, ''));
  if (!file.startsWith(LEGACY_UPLOADS_DIR + path.sep)) return;
  await fs.unlink(file).catch(() => undefined);
}

// ── Serving images ────────────────────────────────────────────────────────

const servedImages = new LruCache<DriveImage>(IMAGE_CACHE_BYTES, (image) => image.data.length);
/** Downloads under way, so a page showing one image many times fetches it once. */
const downloads = new Map<string, Promise<DriveImage | null>>();

/**
 * A stored image by its Drive file id, from memory when possible. Null when
 * the id is not an image this app stored.
 */
export async function readStoredImage(fileId: string): Promise<DriveImage | null> {
  const cached = servedImages.get(fileId);
  if (cached) return cached;

  let download = downloads.get(fileId);
  if (!download) {
    download = downloadDriveImage(fileId, { folders: Object.values(DRIVE_FOLDERS), mimeTypes: SERVED_TYPES }).finally(
      () => downloads.delete(fileId)
    );
    downloads.set(fileId, download);
  }

  const image = await download;
  if (image) servedImages.set(fileId, image);
  return image;
}
