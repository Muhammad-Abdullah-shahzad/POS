import mongoose, { Schema, Document } from 'mongoose';

export interface IVatSettings extends Document {
  defaultVatRate: number;
  isVatInclusiveDefault: boolean;
}

const VatSettingsSchema = new Schema<IVatSettings>({
  defaultVatRate: { type: Number, required: true, default: 20 },
  isVatInclusiveDefault: { type: Boolean, required: true, default: true },
});

export default mongoose.model<IVatSettings>('VatSettings', VatSettingsSchema);
