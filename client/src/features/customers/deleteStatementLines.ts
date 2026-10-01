/**
 * Deleting lines from a customer's account statement.
 *
 *   Payment          deleted; the customer owes that amount again
 *   Sale             voided, as at the till: stock back, credit off the balance,
 *                    kept on record under Void Transactions
 *   Opening balance  set to zero
 *
 * The Adjustment line is worked out, not recorded, so it cannot be deleted.
 */
import { deletePayment, setOpeningBalance, voidSale } from '../../services/customerLedgerService';
import { errorMessage } from '../../utils/errorMessage';
import type { StatementLine } from './accountStatement';

export const isDeletable = (line: StatementLine): boolean =>
  line.type === 'Payment' || line.type === 'Sale' || (line.type === 'Opening' && line.onAccount > 0);

export interface DeletionOutcome {
  deleted: StatementLine[];
  failed: { line: StatementLine; reason: string }[];
}

/**
 * Payments go first: removing them raises the balance, so the sales and the
 * opening balance that come off afterwards are not refused for taking it
 * below zero part-way through.
 */
const ORDER: Record<StatementLine['type'], number> = { Payment: 0, Sale: 1, Opening: 2, Return: 3, Adjustment: 4 };

function remove(customer: { _id: string; name: string }, line: StatementLine): Promise<unknown> {
  switch (line.type) {
    case 'Payment':
      return deletePayment(customer._id, line.payment._id);
    case 'Sale':
      return voidSale(line.order._id, `Deleted from ${customer.name}'s account statement`);
    case 'Opening':
      return setOpeningBalance(customer._id, 0);
    default:
      return Promise.reject(new Error('This line is worked out from the others and cannot be deleted'));
  }
}

/** Delete each line in turn, carrying on past failures so one bad line does not block the rest. */
export async function deleteStatementLines(customer: { _id: string; name: string }, lines: StatementLine[]): Promise<DeletionOutcome> {
  const outcome: DeletionOutcome = { deleted: [], failed: [] };
  const ordered = [...lines].sort((a, b) => ORDER[a.type] - ORDER[b.type]);

  for (const line of ordered) {
    try {
      await remove(customer, line);
      outcome.deleted.push(line);
    } catch (error) {
      outcome.failed.push({ line, reason: errorMessage(error, 'Could not be deleted') });
    }
  }
  return outcome;
}

/** A plain-language list of what deleting these lines will do, for the confirmation. */
export function describeDeletion(lines: StatementLine[], format: (amount: number) => string): string[] {
  const sum = (type: StatementLine['type'], pick: (line: StatementLine) => number) =>
    lines.filter((line) => line.type === type).reduce((total, line) => total + pick(line), 0);
  const count = (type: StatementLine['type']) => lines.filter((line) => line.type === type).length;

  const effects: string[] = [];
  if (count('Payment')) {
    effects.push(`${count('Payment')} payment(s) deleted: the customer owes ${format(sum('Payment', (l) => l.received))} again.`);
  }
  if (count('Sale')) {
    effects.push(
      `${count('Sale')} sale(s) voided: stock goes back, ${format(sum('Sale', (l) => l.onAccount))} comes off the account, and they stay listed under Void Transactions.`
    );
  }
  if (count('Opening')) {
    effects.push(`Opening balance of ${format(sum('Opening', (l) => l.onAccount))} cleared.`);
  }
  return effects;
}
