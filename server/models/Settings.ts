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
  loyaltyPointsPerEuro: number;
  loyaltyRewardThreshold: number;
  loyaltyRewardValue: number;
  quickProducts: {
    id: string;
    name: string;
    barcode: string;
    color: string;
  }[];
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
  loyaltyPointsPerEuro: { type: Number, default: 1 },
  loyaltyRewardThreshold: { type: Number, default: 100 },
  loyaltyRewardValue: { type: Number, default: 5 },
  quickProducts: {
    type: [{
      id: { type: String, required: true },
      name: { type: String, required: true },
      barcode: { type: String, required: true },
      color: { type: String, required: true },
    }],
    default: [
      { id: 'open-item', name: 'OPEN ITEM', barcode: 'open1234', color: '#688939' },
      { id: 'house-hold', name: 'HOUSE HOLD', barcode: 'hh1234', color: '#688939' },
      { id: 'sweets', name: 'SWEETS', barcode: 'sw1234', color: '#688939' },
      { id: 'minerals', name: 'MINERALS', barcode: 'mn1234', color: '#86af49' },
      { id: 'veg-item', name: 'VEG ITEM', barcode: 'vg1234', color: '#86af49' },
      { id: 'fresh-meat', name: 'FRESH MEAT', barcode: 'fm1234', color: '#86af49' },
    ],
  },
}, { timestamps: true });

export default mongoose.model<ISettings>('Settings', SettingsSchema);
