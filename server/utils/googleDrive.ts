/**
 * Optional Google Drive mirror for product images.
 *
 * Drive is a backup, not the source of truth: the local file is written first
 * and stays valid whether or not the mirror succeeds. When Drive credentials
 * are not configured every call becomes a no-op, so the feature can simply be
 * left switched off.
 */
import fs from 'fs';
import { drive_v3, google } from 'googleapis';
import { env } from '../config/env';
import { logger } from '../core/logger';

const REDIRECT_URI = 'https://developers.google.com/oauthplayground';
const DRIVE_FOLDER_NAME = 'POS_Product_Images';

let driveClient: drive_v3.Drive | null = null;
let cachedFolderId: string | null = null;

function getDrive(): drive_v3.Drive | null {
  if (!env.googleDrive.isConfigured) return null;
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

/** Find the image folder, creating it the first time. */
async function getOrCreateFolder(drive: drive_v3.Drive): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  const existing = await drive.files.list({
    q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  const found = existing.data.files?.[0]?.id;
  if (found) {
    cachedFolderId = found;
    return found;
  }

  const created = await drive.files.create({
    requestBody: { name: DRIVE_FOLDER_NAME, mimeType: 'application/vnd.google-apps.folder' },
    fields: 'id',
  });

  cachedFolderId = created.data.id!;
  return cachedFolderId;
}

/** Upload a file and return its public URL, or null when Drive is not set up. */
export async function uploadToDrive(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<string | null> {
  const drive = getDrive();
  if (!drive) return null;

  const folderId = await getOrCreateFolder(drive);

  const response = await drive.files.create({
    requestBody: { name: fileName, parents: [folderId] },
    media: { mimeType, body: fs.createReadStream(filePath) },
    fields: 'id',
  });

  const fileId = response.data.id!;
  await drive.permissions.create({ fileId, requestBody: { role: 'reader', type: 'anyone' } });

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
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
  return url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] ?? null;
}
