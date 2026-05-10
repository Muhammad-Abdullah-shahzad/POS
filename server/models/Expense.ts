import mongoose, { Schema, Document } from 'mongoose';

export interface IExpense extends Document {
  title: string;
  amount: number;
  category: string;
  date: Date;
  paymentMethod: string;
  notes?: string;
  attachmentUrl?: string;
}

const ExpenseSchema = new Schema<IExpense>({
  title: { type: String, required: true },
  amount: { type: Number, required: true },
  category: { type: String, required: true },
  date: { type: Date, required: true, default: Date.now },
  paymentMethod: { type: String, required: true },
  notes: { type: String },
  attachmentUrl: { type: String },
}, { timestamps: true });

export default mongoose.model<IExpense>('Expense', ExpenseSchema);
