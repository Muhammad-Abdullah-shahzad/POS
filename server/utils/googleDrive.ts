import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const CLIENT_ID     = process.env.CLIENT_ID!.trim();
const CLIENT_SECRET = process.env.CLIENT_SECRET!.trim();
const REFRESH_TOKEN = process.env.REFRESH_TOKEN!.trim();
const REDIRECT_URI  = 'https://developers.google.com/oauthplayground';

// Folder name in Google Drive where product images will be stored
const DRIVE_FOLDER_NAME = 'POS_Product_Images';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
oauth2Client.setCredentials({ refresh_token: REFRESH_TOKEN });

const drive = google.drive({ version: 'v3', auth: oauth2Client });

// Cache the folder ID so we don't look it up on every upload
let cachedFolderId: string | null = null;

/**
 * Get (or create) the POS_Product_Images folder in Google Drive.
 */
async function getOrCreateFolder(): Promise<string> {
  if (cachedFolderId) return cachedFolderId;

  // Search for existing folder
  const res = await drive.files.list({
    q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
    fields: 'files(id, name)',
    spaces: 'drive',
  });

  if (res.data.files && res.data.files.length > 0) {
    cachedFolderId = res.data.files[0].id!;
    return cachedFolderId;
  }

  // Create folder if it doesn't exist
  const folder = await drive.files.create({
    requestBody: {
      name: DRIVE_FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    },
    fields: 'id',
  });

  cachedFolderId = folder.data.id!;
  return cachedFolderId;
}

/**
 * Upload a file to Google Drive and return its public URL.
 * @param filePath  Local path to the file
 * @param fileName  Desired filename in Drive
 * @param mimeType  MIME type of the file
 */
export async function uploadToDrive(
  filePath: string,
  fileName: string,
  mimeType: string
): Promise<string> {
  const folderId = await getOrCreateFolder();

  const response = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: fs.createReadStream(filePath),
    },
    fields: 'id',
  });

  const fileId = response.data.id!;

  // Make the file publicly readable
  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone',
    },
  });

  return `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
}

/**
 * Delete a file from Google Drive by its file ID.
 */
export async function deleteFromDrive(fileId: string): Promise<void> {
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    console.error('Failed to delete Drive file:', fileId, err);
  }
}

/**
 * Extract the Google Drive file ID from a Drive URL.
 * Returns null if the URL is not a Drive URL.
 */
export function extractDriveFileId(url: string): string | null {
  const match = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}
