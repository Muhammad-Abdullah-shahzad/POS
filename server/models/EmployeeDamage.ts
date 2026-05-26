import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployeeDamage extends Document {
  employeeId: string;
  employeeName: string;
  item: string;
  value: number;
  deduction: number;
  status: 'Pending Approval' | 'Deducted' | 'Resolved';
  date: string;
}

const EmployeeDamageSchema: Schema = new Schema({
  employeeId:   { type: String, required: true },
  employeeName: { type: String, required: true },
  item:         { type: String, required: true },
  value:        { type: Number, required: true, default: 0 },
  deduction:    { type: Number, required: true, default: 0 },
  status:       { type: String, enum: ['Pending Approval', 'Deducted', 'Resolved'], default: 'Pending Approval' },
  date:         { type: String, required: true },
}, { timestamps: true });

export default mongoose.model<IEmployeeDamage>('EmployeeDamage', EmployeeDamageSchema);
