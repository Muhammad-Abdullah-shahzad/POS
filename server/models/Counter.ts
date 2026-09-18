/**
 * Counter — per tenant monotonic sequences, currently the receipt number.
 *
 * A single atomic `$inc` hands out the next number, so concurrent tills never
 * get the same receipt id and listing orders never has to count rows.
 */
import mongoose, { Document, Schema, Types } from 'mongoose';
import { tenantScopePlugin } from './plugins/tenantScope';

export interface ICounter extends Document<Types.ObjectId> {
  tenantId: Types.ObjectId;
  key: string;
  value: number;
}

const CounterSchema = new Schema<ICounter>({
  key: { type: String, required: true },
  value: { type: Number, required: true, default: 0 },
});

CounterSchema.plugin(tenantScopePlugin);
CounterSchema.index({ tenantId: 1, key: 1 }, { unique: true });

export const Counter = mongoose.model<ICounter>('Counter', CounterSchema);

/** Reserve the next number in a sequence. Creates the sequence on first use. */
export async function nextSequence(key: string): Promise<number> {
  const counter = await Counter.findOneAndUpdate(
    { key },
    { $inc: { value: 1 } },
    { returnDocument: 'after', upsert: true }
  );
  return counter.value;
}

export default Counter;
