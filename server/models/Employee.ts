import mongoose, { Schema, Document } from 'mongoose';

export interface IEmployee extends Document {
  name: string;
  contactNo: string;
  emailId: string;
  address: string;
  role: string;
  gender: string;
  dob: Date;
}

const EmployeeSchema: Schema = new Schema({
  name: { type: String, required: true },
  contactNo: { type: String, required: true },
  emailId: { type: String, required: true },
  address: { type: String, required: true },
  role: { type: String, required: true },
  gender: { type: String, required: true },
  dob: { type: Date, required: true },
}, { timestamps: true });

export default mongoose.model<IEmployee>('Employee', EmployeeSchema);
