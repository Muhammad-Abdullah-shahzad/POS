import mongoose, { Document, Schema, Types } from 'mongoose';

/**
 * A company's logo, keyed by the company slug. Uploaded by the company's
 * admin in Settings (stored on Google Drive), or linked by the operator with
 * `npm run logo:set`. Printed at the top left of A4 invoices.
 *
 * Not tenant-scoped: it is looked up by slug, and removed alongside the
 * company by the tenant deletion service.
 */
export const LOGO_SOURCES = ['upload', 'link'] as const;
export type LogoSource = (typeof LOGO_SOURCES)[number];

export interface ICompanyLogo extends Document<Types.ObjectId> {
  slug: string;
  url: string;
  /** "upload": we stored the file and may delete it. "link": the operator's address, never deleted. */
  source: LogoSource;
  createdAt: Date;
  updatedAt: Date;
}

const CompanyLogoSchema = new Schema<ICompanyLogo>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    url: { type: String, required: true, trim: true },
    source: { type: String, enum: LOGO_SOURCES, default: 'link' },
  },
  { timestamps: true }
);

export const CompanyLogo = mongoose.model<ICompanyLogo>('CompanyLogo', CompanyLogoSchema);
export default CompanyLogo;
