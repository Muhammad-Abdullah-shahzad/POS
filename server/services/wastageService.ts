/**
 * Writing stock off as waste.
 *
 * The stock deduction and the log entry belong together: the deduction is a
 * conditional update that only applies when enough stock is on hand, and it is
 * put back if the entry cannot be saved.
 */
import { BadRequestError, NotFoundError } from '../core/errors';
import { logger } from '../core/logger';
import Product from '../models/Product';
import WastageEntry, { IWastageEntry } from '../models/WastageEntry';
import type { RecordWastageInput } from '../validators/catalogValidators';

export async function recordWastage(input: RecordWastageInput, recordedBy?: string): Promise<IWastageEntry> {
  const product = await Product.findOneAndUpdate(
    { _id: input.productId, stock: { $gte: input.quantity } },
    { $inc: { stock: -input.quantity } },
    { returnDocument: 'after' }
  );

  if (!product) {
    const existing = await Product.findById(input.productId).select('name stock');
    if (!existing) throw new NotFoundError('Product');
    throw new BadRequestError(`Only ${existing.stock} of ${existing.name} in stock`);
  }

  try {
    return await WastageEntry.create({
      productId: product._id.toString(),
      productName: product.name,
      sku: product.sku ?? '',
      quantity: input.quantity,
      unitCost: product.costPrice,
      reason: input.reason,
      date: new Date(),
      recordedBy,
    });
  } catch (error) {
    await Product.updateOne({ _id: product._id }, { $inc: { stock: input.quantity } }).catch((restoreError) =>
      logger.error({ err: restoreError, productId: product._id }, 'Failed to return stock after a failed write-off')
    );
    throw error;
  }
}
