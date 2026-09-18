/**
 * Banking reference data: the banks a company deals with, plus its accounts
 * and cards. All three are tenant scoped.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface IBankName extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
}

export interface IBankAccount extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  bankName: string;
  type: string;
  accountName: string;
  iban: string;
  bic: string;
}

export interface IBankCard extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  bankName: string;
  accountName: string;
  type: string;
  cardNumber: string;
  cardName: string;
  expiryDate: string;
}

const BankNameSchema = new Schema<IBankName>(
  { name: { type: String, required: true, trim: true } },
  { timestamps: true }
);

const BankAccountSchema = new Schema<IBankAccount>(
  {
    bankName: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    iban: { type: String, required: true, trim: true },
    bic: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

const BankCardSchema = new Schema<IBankCard>(
  {
    bankName: { type: String, required: true, trim: true },
    accountName: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    cardNumber: { type: String, required: true, trim: true },
    cardName: { type: String, required: true, trim: true },
    expiryDate: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

BankNameSchema.plugin(tenantScopePlugin);
BankAccountSchema.plugin(tenantScopePlugin);
BankCardSchema.plugin(tenantScopePlugin);

BankNameSchema.index({ tenantId: 1, name: 1 }, { unique: true });
BankAccountSchema.index({ tenantId: 1, iban: 1 });
BankCardSchema.index({ tenantId: 1, bankName: 1 });

export const BankName = mongoose.model<IBankName>('BankName', BankNameSchema);
export const BankAccount = mongoose.model<IBankAccount>('BankAccount', BankAccountSchema);
export const BankCard = mongoose.model<IBankCard>('BankCard', BankCardSchema);
