/**
 * Settings — one document per tenant holding shop details, VAT defaults,
 * loyalty rules and the POS quick buttons.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface IQuickProduct {
  id: string;
  name: string;
  barcode: string;
  color: string;
}

export interface ISettings extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  shopWebsite: string;
  receiptFooter: string;
  defaultVatRate: number;
  isVatInclusiveDefault: boolean;
  loyaltyPointsPerEuro: number;
  loyaltyRewardThreshold: number;
  loyaltyRewardValue: number;
  quickProducts: IQuickProduct[];
  expenseCategories: string[];
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_QUICK_PRODUCTS: IQuickProduct[] = [
  { id: 'open-item', name: 'OPEN ITEM', barcode: 'open1234', color: '#688939' },
  { id: 'house-hold', name: 'HOUSE HOLD', barcode: 'hh1234', color: '#688939' },
  { id: 'sweets', name: 'SWEETS', barcode: 'sw1234', color: '#688939' },
  { id: 'minerals', name: 'MINERALS', barcode: 'mn1234', color: '#86af49' },
  { id: 'veg-item', name: 'VEG ITEM', barcode: 'vg1234', color: '#86af49' },
  { id: 'fresh-meat', name: 'FRESH MEAT', barcode: 'fm1234', color: '#86af49' },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  'Rent',
  'Utilities',
  'Salaries',
  'Supplies',
  'Marketing',
  'Other',
];

const QuickProductSchema = new Schema<IQuickProduct>(
  {
    id: { type: String, required: true },
    name: { type: String, required: true },
    barcode: { type: String, required: true },
    color: { type: String, required: true },
  },
  { _id: false }
);

const SettingsSchema = new Schema<ISettings>(
  {
    shopName: { type: String, required: true, default: 'My Retail Store' },
    shopAddress: { type: String, required: true, default: '123 Retail Lane, Shop City' },
    shopPhone: { type: String, default: '' },
    shopEmail: { type: String, default: '' },
    shopWebsite: { type: String, default: '' },
    receiptFooter: { type: String, default: 'THANK YOU FOR SHOPPING! Please visit us again soon.' },
    defaultVatRate: { type: Number, required: true, default: 20, min: 0 },
    isVatInclusiveDefault: { type: Boolean, required: true, default: true },
    loyaltyPointsPerEuro: { type: Number, default: 1, min: 0 },
    loyaltyRewardThreshold: { type: Number, default: 100, min: 0 },
    loyaltyRewardValue: { type: Number, default: 5, min: 0 },
    quickProducts: { type: [QuickProductSchema], default: () => DEFAULT_QUICK_PRODUCTS },
    expenseCategories: { type: [String], default: () => DEFAULT_EXPENSE_CATEGORIES },
  },
  { timestamps: true }
);

SettingsSchema.plugin(tenantScopePlugin);

// Exactly one settings document per company.
SettingsSchema.index({ tenantId: 1 }, { unique: true });

export const Settings = mongoose.model<ISettings>('Settings', SettingsSchema);
export default Settings;
