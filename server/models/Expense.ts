import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface IExpense extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  title: string;
  amount: number;
  category: string;
  date: Date;
  paymentMethod: string;
  notes?: string;
  attachmentUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseSchema = new Schema<IExpense>(
  {
    title: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    category: { type: String, required: true, trim: true },
    date: { type: Date, required: true, default: Date.now },
    paymentMethod: { type: String, required: true, trim: true },
    notes: { type: String },
    attachmentUrl: { type: String },
  },
  { timestamps: true }
);

ExpenseSchema.plugin(tenantScopePlugin);
ExpenseSchema.index({ tenantId: 1, date: -1 });
ExpenseSchema.index({ tenantId: 1, category: 1 });

export const Expense = mongoose.model<IExpense>('Expense', ExpenseSchema);
export default Expense;
