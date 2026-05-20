import mongoose, { Schema, Document } from 'mongoose';

export interface ISettings extends Document {
  shopName: string;
  shopAddress: string;
  shopPhone: string;
  shopEmail: string;
  shopWebsite: string;
  receiptFooter: string;
  defaultVatRate: number;
  isVatInclusiveDefault: boolean;
}

const SettingsSchema = new Schema<ISettings>({
  shopName: { type: String, required: true, default: 'My Retail Store' },
  shopAddress: { type: String, required: true, default: '123 Retail Lane, Shop City' },
  shopPhone: { type: String, default: '+1234567890' },
  shopEmail: { type: String, default: 'info@retailstore.com' },
  shopWebsite: { type: String, default: 'www.retailstore.com' },
  receiptFooter: { type: String, default: 'THANK YOU FOR SHOPPING! Please visit us again soon.' },
  defaultVatRate: { type: Number, required: true, default: 20 },
  isVatInclusiveDefault: { type: Boolean, required: true, default: true },
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);
