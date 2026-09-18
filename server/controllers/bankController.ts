/**
 * Banking reference data. The three collections share one shape of handler, so
 * they are generated from a small table rather than copied six times.
 */
import { Request, Response } from 'express';
import { Model } from 'mongoose';
import { successResponse } from '../core/apiResponse';
import { asyncHandler } from '../core/asyncHandler';
import { NotFoundError } from '../core/errors';
import { BankAccount, BankCard, BankName } from '../models/Bank';

const list = (model: Model<any>, sort: Record<string, 1 | -1> = { createdAt: -1 }) =>
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(successResponse(await model.find().sort(sort)));
  });

const create = (model: Model<any>, label: string) =>
  asyncHandler(async (req: Request, res: Response) => {
    const created = await model.create(req.body);
    res.status(201).json(successResponse(created, `${label} added`));
  });

const remove = (model: Model<any>, label: string) =>
  asyncHandler(async (req: Request, res: Response) => {
    const deleted = await model.findByIdAndDelete(req.params.id);
    if (!deleted) throw new NotFoundError(label);

    res.json(successResponse(null, `${label} removed`));
  });

export const getBankNames = list(BankName, { name: 1 });
export const addBankName = create(BankName, 'Bank');
export const deleteBankName = remove(BankName, 'Bank');

export const getBankAccounts = list(BankAccount);
export const addBankAccount = create(BankAccount, 'Account');
export const deleteBankAccount = remove(BankAccount, 'Account');

export const getBankCards = list(BankCard);
export const addBankCard = create(BankCard, 'Card');
export const deleteBankCard = remove(BankCard, 'Card');
