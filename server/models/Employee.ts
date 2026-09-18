import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface IEmployee extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  name: string;
  contactNo: string;
  emailId: string;
  address: string;
  role: string;
  gender: string;
  dob: Date;
  createdAt: Date;
  updatedAt: Date;
}

const EmployeeSchema = new Schema<IEmployee>(
  {
    name: { type: String, required: true, trim: true },
    contactNo: { type: String, required: true, trim: true },
    emailId: { type: String, required: true, lowercase: true, trim: true },
    address: { type: String, required: true },
    role: { type: String, required: true, trim: true },
    gender: { type: String, required: true },
    dob: { type: Date, required: true },
  },
  { timestamps: true }
);

EmployeeSchema.plugin(tenantScopePlugin);
EmployeeSchema.index({ tenantId: 1, name: 1 });

export const Employee = mongoose.model<IEmployee>('Employee', EmployeeSchema);
export default Employee;
