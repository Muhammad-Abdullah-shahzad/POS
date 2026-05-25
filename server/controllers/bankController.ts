import { Request, Response } from 'express';
import { BankName, BankAccount, BankCard } from '../models/Bank';
import { successResponse, errorResponse } from '../utils/response';

export const getBankNames = async (req: Request, res: Response) => {
  try {
    const names = await BankName.find().sort({ createdAt: -1 });
    res.json(successResponse(names));
  } catch (error: any) { res.status(500).json(errorResponse('Server Error', error.message)); }
}

export const addBankName = async (req: Request, res: Response) => {
  try {
    const bank = await BankName.create(req.body);
    res.status(201).json(successResponse(bank));
  } catch (error: any) { res.status(400).json(errorResponse('Error', error.message)); }
}

export const getBankAccounts = async (req: Request, res: Response) => {
  try {
    const accounts = await BankAccount.find().sort({ createdAt: -1 });
    res.json(successResponse(accounts));
  } catch (error: any) { res.status(500).json(errorResponse('Server Error', error.message)); }
}

export const addBankAccount = async (req: Request, res: Response) => {
  try {
    const account = await BankAccount.create(req.body);
    res.status(201).json(successResponse(account));
  } catch (error: any) { res.status(400).json(errorResponse('Error', error.message)); }
}

export const getBankCards = async (req: Request, res: Response) => {
  try {
    const cards = await BankCard.find().sort({ createdAt: -1 });
    res.json(successResponse(cards));
  } catch (error: any) { res.status(500).json(errorResponse('Server Error', error.message)); }
}

export const addBankCard = async (req: Request, res: Response) => {
  try {
    const card = await BankCard.create(req.body);
    res.status(201).json(successResponse(card));
  } catch (error: any) { res.status(400).json(errorResponse('Error', error.message)); }
}
