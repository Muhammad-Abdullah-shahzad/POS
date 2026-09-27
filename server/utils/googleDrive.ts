/**
 * Google Drive, where every uploaded image is kept: product photos and
 * company logos. Nothing is written to the server's disk, so image storage
 * never competes with the database for space on the VPS.
 *
 * Files are shared as "anyone with the link can view", but the app does not
 * load them from Google's public links: Google rate-limits those (429). The
 * server downloads images with its own Drive access and serves them itself.
 */
import { Readable } from 'stream';
import { drive_v3, google } from 'googleapis';
import { env } from '../config/env';
import { AppError } from '../core/errors';
import { logger } from '../core/logger';

const REDIRECT_URI = 'https://developers.google.com/oauthplayground';

let driveClient: drive_v3.Drive | null = null;
/** Folder ids by name, so each folder is looked up once per process. */
const folderIds = new Map<string, string>();

export const isDriveConfigured = (): boolean => env.googleDrive.isConfigured;

/** Raised when an upload is attempted but Drive credentials are missing. */
export class ImageStorageUnavailableError extends AppError {
  constructor() {
    super('Image storage is not set up yet. Add the Google Drive credentials to the server settings.', 503, 'IMAGE_STORAGE_UNAVAILABLE');
  }
}

function getDrive(): drive_v3.Drive | null {
  if (!isDriveConfigured()) return null;
  if (driveClient) return driveClient;

  const auth = new google.auth.OAuth2(
    env.googleDrive.clientId!.trim(),
    env.googleDrive.clientSecret!.trim(),
    REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: env.googleDrive.refreshToken!.trim() });

  driveClient = google.drive({ version: 'v3', auth });
  return driveClient;
}

/** Find a folder by name; null if it does not exist yet. */
async function findFolder(drive: drive_v3.Drive, name: string): Promise<string | null> {
  const cached = folderIds.get(name);
  if (cached) return cached;

  const existing = await drive.files.list({
    q: `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const id = existing.data.files?.[0]?.id ?? null;
  if (id) folderIds.set(name, id);
  return id;
}

/** Find a folder by name, creating it the first time. */
async function getOrCreateFolder(drive: drive_v3.Drive, name: string): Promise<string> {
  const existing = await findFolder(drive, name);
  if (existing) return existing;

  const created = await drive.files.create({
    requestBody: { name, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });
  const id = created.data.id!;
  folderIds.set(name, id);
  return id;
}

/** The address an <img> can load a Drive image from. */
export const driveImageUrl = (fileId: string): string => `https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`;

export interface DriveUpload {
  data: Buffer;
  fileName: string;
  mimeType: string;
  /** Drive folder the file goes into, e.g. "POS_Product_Images". */
  folder: string;
}

/** Upload a file, share it for viewing, and return its id and image address. */
export async function uploadToDrive(upload: DriveUpload): Promise<{ fileId: string; url: string }> {
  const drive = getDrive();
  if (!drive) throw new ImageStorageUnavailableError();

  const folderId = await getOrCreateFolder(drive, upload.folder);
  const created = await drive.files.create({
    requestBody: { name: upload.fileName, parents: [folderId] },
    media: { mimeType: upload.mimeType, body: Readable.from(upload.data) },
    fields: 'id',
  });

  const fileId = created.data.id!;
  try {
    await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });
  } catch (error) {
    // An image nobody can see is useless; do not leave it behind.
    await deleteFromDrive(fileId);
    throw error;
  }

  return { fileId, url: driveImageUrl(fileId) };
}

export interface DriveImage {
  data: Buffer;
  mimeType: string;
}

/** Which images `downloadDriveImage` may return. */
export interface DriveImageRules {
  /** Drive folders, by name, the file must be in. */
  folders: string[];
  mimeTypes: readonly string[];
}

/**
 * Download an image with the server's own Drive access. Only a file inside
 * one of the given folders, of an allowed type, is returned, so the account's
 * other files can never be reached through it. Anything else gives null.
 */
export async function downloadDriveImage(fileId: string, rules: DriveImageRules): Promise<DriveImage | null> {
  const drive = getDrive();
  if (!drive) return null;

  try {
    const { data: file } = await drive.files.get({ fileId, fields: 'mimeType, parents, trashed' });
    if (file.trashed || !file.mimeType || !rules.mimeTypes.includes(file.mimeType)) return null;

    const allowedFolders = await Promise.all(rules.folders.map((name) => findFolder(drive, name)));
    if (!file.parents?.some((parent) => allowedFolders.includes(parent))) return null;

    const media = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'arraybuffer' });
    return { data: Buffer.from(media.data as ArrayBuffer), mimeType: file.mimeType };
  } catch (error) {
    // A file that does not exist, or that this account cannot see.
    const status = (error as { response?: { status?: number } }).response?.status;
    if (status === 404 || status === 403) return null;
    throw error;
  }
}

export async function deleteFromDrive(fileId: string): Promise<void> {
  const drive = getDrive();
  if (!drive) return;

  try {
    await drive.files.delete({ fileId });
  } catch (error) {
    logger.warn({ err: error, fileId }, 'Failed to delete a Drive file');
  }
}

/** Pull the Drive file id out of a Drive URL, or null if it is not one. */
export function extractDriveFileId(url: string): string | null {
  if (!/(^https?:\/\/)?([a-z0-9-]+\.)*(google|googleusercontent)\.com\//i.test(url)) return null;
  return (
    url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ??
    url.match(/\/(?:file\/)?d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    null
  );
}
