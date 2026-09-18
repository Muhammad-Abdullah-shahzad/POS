/**
 * Tenant — one registered company.
 *
 * Every other collection hangs off a tenant. This is the only model that is
 * not itself tenant scoped, because it defines the boundary.
 *
 * The company's licence lives here too. It is read on every authenticated
 * request (through a short cache), so keeping it on the same document avoids
 * a second lookup. `licenseHistory` keeps the previous keys for support
 * questions such as "when did this customer last pay".
 */
import mongoose, { Document, Schema, Types } from 'mongoose';

export const TENANT_STATUSES = ['active', 'trial', 'suspended', 'cancelled'] as const;
export type TenantStatus = (typeof TENANT_STATUSES)[number];

export const LICENSE_KINDS = ['trial', 'paid'] as const;
export type LicenseKind = (typeof LICENSE_KINDS)[number];

export interface ITenantLicense {
  /** The signed key string the customer types into the app. */
  key: string;
  /** Stable across extensions, so one customer's renewals can be followed. */
  licenseId: string;
  kind: LicenseKind;
  issuedAt: Date;
  expiresAt: Date;
  /** Free text for the operator, e.g. "September invoice paid by transfer". */
  note: string;
}

/** How many past licences are kept on the document. */
export const LICENSE_HISTORY_LIMIT = 24;

export interface ITenant extends Document<Types.ObjectId> {
  name: string;
  /** URL and support friendly identifier, e.g. "corner-shop". Unique platform wide. */
  slug: string;
  status: TenantStatus;
  contactEmail: string;
  contactPhone?: string;
  /** Free form plan label; billing lives outside this service. */
  plan: string;
  /** Set when status becomes `suspended` or `cancelled`, for support context. */
  statusReason?: string;
  /** The licence currently in force. Absent until one is issued. */
  license?: ITenantLicense;
  licenseHistory: ITenantLicense[];
  createdAt: Date;
  updatedAt: Date;
  isActive(): boolean;
}

const LicenseSchema = new Schema<ITenantLicense>(
  {
    key: { type: String, required: true },
    licenseId: { type: String, required: true },
    kind: { type: String, enum: LICENSE_KINDS, required: true, default: 'paid' },
    issuedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    note: { type: String, default: '' },
  },
  { _id: false }
);

const TenantSchema = new Schema<ITenant>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/, 'Slug may contain lowercase letters, digits and hyphens only'],
    },
    status: { type: String, enum: TENANT_STATUSES, default: 'active', index: true },
    contactEmail: { type: String, required: true, lowercase: true, trim: true },
    contactPhone: { type: String, trim: true, default: '' },
    plan: { type: String, default: 'standard', trim: true },
    statusReason: { type: String, default: '' },
    // Optional on purpose: companies created before licensing existed have no
    // licence until the operator issues one, and the auth layer treats that as
    // "locked" rather than as a broken document.
    license: { type: LicenseSchema, required: false },
    licenseHistory: { type: [LicenseSchema], default: [] },
  },
  { timestamps: true }
);

TenantSchema.methods.isActive = function (this: ITenant): boolean {
  return this.status === 'active' || this.status === 'trial';
};

export const Tenant = mongoose.model<ITenant>('Tenant', TenantSchema);
export default Tenant;
