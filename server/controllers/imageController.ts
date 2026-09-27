import { Request, Response } from 'express';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import { readStoredImage } from '../services/imageStorageService';
import { driveImageUrl } from '../utils/googleDrive';

/** Drive file ids are letters, digits, "-" and "_". */
const DRIVE_FILE_ID = /^[\w-]{10,200}$/;
/** A Drive file never changes under the same id; a new image gets a new id. */
const CACHE_FOREVER = 'public, max-age=31536000, immutable';

/**
 * GET /api/images/drive/:fileId — a product photo or company logo.
 *
 * Open to anyone, like the Drive link itself, because an <img> cannot send a
 * sign-in token. Only images inside this app's Drive folders are served; any
 * other Drive link (such as a logo the operator linked from elsewhere) is sent
 * on to Google's public address.
 */
export const getDriveImage = asyncHandler(async (req: Request<{ fileId: string }>, res: Response) => {
  const { fileId } = req.params;
  if (!DRIVE_FILE_ID.test(fileId)) throw new NotFoundError('Image');

  const image = await readStoredImage(fileId);
  if (!image) {
    res.redirect(302, driveImageUrl(fileId));
    return;
  }

  res.set({
    'Content-Type': image.mimeType,
    'Content-Length': String(image.data.length),
    'Cache-Control': CACHE_FOREVER,
  });
  res.send(image.data);
});
