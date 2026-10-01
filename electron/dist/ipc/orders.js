"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerOrderHandlers = registerOrderHandlers;
const licenseGuard_1 = require("../license/licenseGuard");
const database_1 = require("../db/database");
const customerLedger_1 = require("./customerLedger");
const round2 = (value) => Math.round(value * 100) / 100;
/**
 * How a sale was settled, worked out here rather than taken from the screen,
 * matching the server. Whatever is not handed over goes on the customer account.
 *
 *   cash, card   the whole total, one way
 *   split        the cash and card parts; any shortfall goes on account
 *   credit       optional cash and card deposits; the rest goes on account
 */
function settlement(data) {
    const total = Number(data.total ?? 0);
    const method = String(data.paymentMethod ?? '').toLowerCase();
    if (method === 'cash' || method === 'card') {
        return { paidCash: method === 'cash' ? total : 0, paidCard: method === 'card' ? total : 0, creditAmount: 0 };
    }
    const partPayment = method === 'credit'
        ? { cash: Number(data.paidCash ?? 0), card: Number(data.paidCard ?? 0) }
        : method.startsWith('split')
            ? { cash: Number(data.splitCash ?? 0), card: Number(data.splitCard ?? 0) }
            : null;
    // Anything else is treated as cash, as the till always has.
    if (!partPayment)
        return { paidCash: total, paidCard: 0, creditAmount: 0 };
    if (partPayment.cash < 0 || partPayment.card < 0)
        throw new Error('Deposits cannot be negative');
    if (round2(partPayment.cash + partPayment.card) > round2(total)) {
        throw new Error('The cash and card deposits add up to more than the total');
    }
    const paidCash = round2(partPayment.cash);
    const paidCard = round2(partPayment.card);
    return { paidCash, paidCard, creditAmount: round2(total - paidCash - paidCard) };
}
function registerOrderHandlers() {
    (0, licenseGuard_1.handleLicensed)('orders:getAll', (_e, month, year, search) => {
        let rows;
        const term = search?.trim();
        if (term) {
            // A receipt ID search looks through every receipt, not just the chosen month.
            rows = (0, database_1.dbAll)(`SELECT * FROM orders WHERE status != 'voided'
         AND invoiceId LIKE $pattern ESCAPE '\\'
         ORDER BY createdAt DESC LIMIT 200`, { $pattern: `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%` });
        }
        else if (month && year) {
            const start = new Date(year, month - 1, 1).toISOString();
            const end = new Date(year, month, 1).toISOString();
            rows = (0, database_1.dbAll)(`SELECT * FROM orders WHERE status != 'voided'
         AND createdAt >= $start AND createdAt < $end
         ORDER BY createdAt DESC LIMIT 100`, { $start: start, $end: end });
        }
        else {
            rows = (0, database_1.dbAll)(`SELECT * FROM orders WHERE status != 'voided' ORDER BY createdAt DESC LIMIT 100`);
        }
        return rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') }));
    });
    (0, licenseGuard_1.handleLicensed)('orders:getVoided', (_e) => {
        const rows = (0, database_1.dbAll)(`SELECT * FROM orders WHERE status = 'voided' ORDER BY voidedAt DESC LIMIT 500`);
        return rows.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') }));
    });
    (0, licenseGuard_1.handleLicensed)('orders:create', (_e, data) => {
        const _id = (0, database_1.generateLocalId)();
        // Checked before any stock moves, so a rejected sale leaves nothing behind.
        const settled = settlement(data);
        if (settled.creditAmount > 0 && !data.customerId) {
            throw new Error('Choose a customer to put part of this sale on their account');
        }
        const ts = (0, database_1.now)();
        const invoiceId = `REC-${Date.now()}`;
        const itemsArr = data.items ?? [];
        const itemsJson = JSON.stringify(itemsArr);
        (0, database_1.dbTransaction)((d) => {
            // Deduct stock for each item that has a product reference
            for (const item of itemsArr) {
                const productId = item.product || item.productId;
                if (productId) {
                    const stmt = d.prepare(`SELECT stock FROM products WHERE _id = $pid`);
                    stmt.bind({ $pid: productId });
                    let currentStock = 0;
                    if (stmt.step()) {
                        const row = stmt.getAsObject();
                        currentStock = Number(row.stock ?? 0);
                    }
                    stmt.free();
                    if (currentStock < item.quantity) {
                        throw new Error(`Insufficient stock for ${item.name}`);
                    }
                    d.run(`UPDATE products SET stock = stock - $qty, updatedAt=$ts, isSync=0 WHERE _id=$pid`, { $qty: Number(item.quantity), $ts: ts, $pid: String(productId) });
                }
            }
            // The account standing is read before the credit is added below.
            const account = data.customerId
                ? (0, database_1.dbGet)('SELECT outstandingBalance, contactNum1, address FROM customers WHERE _id = $cid', {
                    $cid: String(data.customerId),
                })
                : null;
            const balanceBefore = account ? round2(Number(account.outstandingBalance ?? 0)) : null;
            d.run(`INSERT INTO orders
           (_id, invoiceId, customerId, customerName, customerPhone, customerAddress, items, subtotal, totalVAT,
            discount, totalDRS, total, paymentMethod, splitCash, splitCard, paidCash, paidCard, creditAmount,
            balanceBefore, balanceAfter, remarks, status, createdAt, updatedAt, isSync)
         VALUES
           ($id, $invoiceId, $customerId, $customerName, $customerPhone, $customerAddress, $items, $subtotal, $totalVAT,
            $discount, $totalDRS, $total, $paymentMethod, $splitCash, $splitCard, $paidCash, $paidCard, $creditAmount,
            $balanceBefore, $balanceAfter, $remarks, 'completed', $createdAt, $updatedAt, 0)`, {
                $remarks: String(data.remarks ?? '').trim().slice(0, 500) || null,
                $customerPhone: account?.contactNum1 != null ? String(account.contactNum1) : null,
                $customerAddress: account?.address != null ? String(account.address) : null,
                $paidCash: settled.paidCash,
                $paidCard: settled.paidCard,
                $creditAmount: settled.creditAmount,
                $balanceBefore: balanceBefore,
                $balanceAfter: balanceBefore === null ? null : round2(balanceBefore + settled.creditAmount),
                $id: _id,
                $invoiceId: invoiceId,
                $customerId: data.customerId ? String(data.customerId) : null,
                $customerName: data.customerName ? String(data.customerName) : null,
                $items: itemsJson,
                $subtotal: Number(data.subtotal ?? 0),
                $totalVAT: Number(data.totalVAT ?? 0),
                $discount: Number(data.discount ?? 0),
                $totalDRS: Number(data.totalDRS ?? 0),
                $total: Number(data.total ?? 0),
                $paymentMethod: String(data.paymentMethod ?? ''),
                $splitCash: data.splitCash != null ? Number(data.splitCash) : null,
                $splitCard: data.splitCard != null ? Number(data.splitCard) : null,
                $createdAt: ts,
                $updatedAt: ts,
            });
            // Whatever went on credit is added to the customer's account.
            if (settled.creditAmount > 0 && data.customerId) {
                d.run(`UPDATE customers SET outstandingBalance = outstandingBalance + $credit, updatedAt=$ts, isSync=0 WHERE _id=$cid`, { $credit: settled.creditAmount, $ts: ts, $cid: String(data.customerId) });
            }
        });
        const row = (0, database_1.dbGet)('SELECT * FROM orders WHERE _id = $id', { $id: _id });
        return { ...row, items: JSON.parse(row?.items || '[]') };
    });
    (0, licenseGuard_1.handleLicensed)('orders:void', (_e, _id, reason, employeeId, employeeName) => {
        const ts = (0, database_1.now)();
        const order = (0, database_1.dbGet)('SELECT * FROM orders WHERE _id = $id', { $id: _id });
        if (!order)
            return null;
        // As on the server: a second void must not return the stock again.
        if (order.status === 'voided')
            throw new Error('This order is already voided');
        // What the sale put on the customer's account comes off again. The balance
        // may go below zero: the customer had already paid for a sale that is gone.
        const credit = order.customerId ? (0, customerLedger_1.currentSettlement)(order).creditAmount : 0;
        (0, database_1.dbTransaction)((d) => {
            if (credit > 0) {
                d.run(`UPDATE customers SET outstandingBalance = outstandingBalance - $credit, updatedAt=$ts, isSync=0 WHERE _id=$cid`, { $credit: credit, $ts: ts, $cid: String(order.customerId) });
            }
            d.run(`UPDATE orders SET
           status='voided', voidReason=$reason, voidedAt=$ts,
           voidedByEmployee=$empId, voidedByEmployeeName=$empName,
           updatedAt=$ts, isSync=0
         WHERE _id=$id AND status != 'voided'`, {
                $id: _id,
                $reason: reason,
                $ts: ts,
                $empId: employeeId ?? null,
                $empName: employeeName ?? null,
            });
            // Restore stock
            const items = JSON.parse(order.items || '[]');
            for (const item of items) {
                const productId = item.product || item.productId;
                if (productId) {
                    d.run(`UPDATE products SET stock = stock + $qty, updatedAt=$ts, isSync=0 WHERE _id=$pid`, { $qty: Number(item.quantity), $ts: ts, $pid: String(productId) });
                }
            }
        });
        const row = (0, database_1.dbGet)('SELECT * FROM orders WHERE _id = $id', { $id: _id });
        return { ...row, items: JSON.parse(row?.items || '[]') };
    });
}
//# sourceMappingURL=orders.js.map