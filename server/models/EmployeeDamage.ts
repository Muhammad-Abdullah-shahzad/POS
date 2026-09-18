import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export const DAMAGE_STATUSES = ['Pending Approval', 'Deducted', 'Resolved'] as const;
export type DamageStatus = (typeof DAMAGE_STATUSES)[number];

export interface IEmployeeDamage extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  employeeId: string;
  employeeName: string;
  item: string;
  value: number;
  deduction: number;
  status: DamageStatus;
  date: string;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeDamageSchema = new Schema<IEmployeeDamage>(
  {
    employeeId: { type: String, required: true },
    employeeName: { type: String, required: true },
    item: { type: String, required: true },
    value: { type: Number, required: true, default: 0, min: 0 },
    deduction: { type: Number, required: true, default: 0, min: 0 },
    status: { type: String, enum: DAMAGE_STATUSES, default: 'Pending Approval' },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

EmployeeDamageSchema.plugin(tenantScopePlugin);
EmployeeDamageSchema.index({ tenantId: 1, date: -1 });

export const EmployeeDamage = mongoose.model<IEmployeeDamage>('EmployeeDamage', EmployeeDamageSchema);
export default EmployeeDamage;
