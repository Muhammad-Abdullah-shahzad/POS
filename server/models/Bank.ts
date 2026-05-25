import mongoose, { Schema, Document } from 'mongoose';

export interface IBankName extends Document {
  name: string;
}

export interface IBankAccount extends Document {
  bankName: string;
  type: string;
  accountName: string;
  iban: string;
  bic: string;
}

export interface IBankCard extends Document {
  bankName: string;
  accountName: string;
  type: string;
  cardNumber: string;
  cardName: string;
  expiryDate: string;
}

const BankNameSchema = new Schema({
  name: { type: String, required: true, unique: true }
}, { timestamps: true });

const BankAccountSchema = new Schema({
  bankName: { type: String, required: true },
  type: { type: String, required: true },
  accountName: { type: String, required: true },
  iban: { type: String, required: true },
  bic: { type: String, required: true }
}, { timestamps: true });

const BankCardSchema = new Schema({
  bankName: { type: String, required: true },
  accountName: { type: String, required: true },
  type: { type: String, required: true },
  cardNumber: { type: String, required: true },
  cardName: { type: String, required: true },
  expiryDate: { type: String, required: true }
}, { timestamps: true });

export const BankName = mongoose.model<IBankName>('BankName', BankNameSchema);
export const BankAccount = mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
export const BankCard = mongoose.model<IBankCard>('BankCard', BankCardSchema);
