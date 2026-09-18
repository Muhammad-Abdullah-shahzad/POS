import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface IExpenseCategory extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

const ExpenseCategorySchema = new Schema<IExpenseCategory>(
  {
    name: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

ExpenseCategorySchema.plugin(tenantScopePlugin);
ExpenseCategorySchema.index({ tenantId: 1, name: 1 }, { unique: true });

export const ExpenseCategory = mongoose.model<IExpenseCategory>('ExpenseCategory', ExpenseCategorySchema);
export default ExpenseCategory;
