"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCustomerHandlers = registerCustomerHandlers;
const licenseGuard_1 = require("../license/licenseGuard");
const database_1 = require("../db/database");
const customerLedger_1 = require("./customerLedger");
function registerCustomerHandlers() {
    (0, licenseGuard_1.handleLicensed)('customers:getAll', () => {
        return (0, database_1.dbAll)('SELECT * FROM customers WHERE deletedAt IS NULL ORDER BY name ASC');
    });
    (0, licenseGuard_1.handleLicensed)('customers:create', (_e, data) => {
        (0, database_1.assertNameFree)('customers', 'customer', data.name);
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`INSERT INTO customers
         (_id, name, contactNum1, contactNum2, email, address, eircode,
          qrCode, barcode, birthday, anniversary, timesVisited, totalAmount,
          outstandingBalance, openingBalance, creditLimit,
          lastVisit, loyaltyPoints, createdAt, updatedAt, isSync)
       VALUES
         ($id, $name, $c1, $c2, $email, $address, $eircode,
          $qrCode, $barcode, $birthday, $anniversary, $timesVisited, $totalAmount,
          $outstandingBalance, $openingBalance, $creditLimit,
          $lastVisit, $loyaltyPoints, $createdAt, $updatedAt, 0)`, {
            $id: _id, $name: (0, database_1.v)(data.name), $c1: (0, database_1.v)(data.contactNum1),
            $c2: (0, database_1.v)(data.contactNum2, ''), $email: (0, database_1.v)(data.email, ''),
            $address: (0, database_1.v)(data.address, ''), $eircode: (0, database_1.v)(data.eircode, ''),
            $qrCode: (0, database_1.v)(data.qrCode, ''), $barcode: (0, database_1.v)(data.barcode, ''),
            $birthday: (0, database_1.v)(data.birthday), $anniversary: (0, database_1.v)(data.anniversary),
            $timesVisited: (0, database_1.v)(data.timesVisited, 0), $totalAmount: (0, database_1.v)(data.totalAmount, 0),
            $outstandingBalance: (0, database_1.v)(data.openingBalance, 0), // Init outstanding with opening
            $openingBalance: (0, database_1.v)(data.openingBalance, 0),
            $creditLimit: (0, database_1.v)(data.creditLimit, 0),
            $lastVisit: (0, database_1.v)(data.lastVisit, ''), $loyaltyPoints: (0, database_1.v)(data.loyaltyPoints, 0),
            $createdAt: ts, $updatedAt: ts,
        });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    (0, licenseGuard_1.handleLicensed)('customers:update', (_e, _id, data) => {
        (0, database_1.assertNameFree)('customers', 'customer', data.name, _id);
        // A new opening balance moves what the customer owes by the same amount.
        if (data.openingBalance !== undefined && data.openingBalance !== null)
            (0, customerLedger_1.setOpeningBalance)(_id, data.openingBalance);
        (0, database_1.dbRun)(`UPDATE customers SET
         name=$name, contactNum1=$c1, contactNum2=$c2, email=$email,
         address=$address, eircode=$eircode, qrCode=$qrCode, barcode=$barcode,
         birthday=$birthday, anniversary=$anniversary, timesVisited=$timesVisited,
         totalAmount=$totalAmount, creditLimit=$creditLimit,
         lastVisit=$lastVisit, loyaltyPoints=$loyaltyPoints,
         updatedAt=$ts, isSync=0
       WHERE _id=$id AND deletedAt IS NULL`, {
            $id: _id, $name: (0, database_1.v)(data.name), $c1: (0, database_1.v)(data.contactNum1),
            $c2: (0, database_1.v)(data.contactNum2, ''), $email: (0, database_1.v)(data.email, ''),
            $address: (0, database_1.v)(data.address, ''), $eircode: (0, database_1.v)(data.eircode, ''),
            $qrCode: (0, database_1.v)(data.qrCode, ''), $barcode: (0, database_1.v)(data.barcode, ''),
            $birthday: (0, database_1.v)(data.birthday), $anniversary: (0, database_1.v)(data.anniversary),
            $timesVisited: (0, database_1.v)(data.timesVisited, 0), $totalAmount: (0, database_1.v)(data.totalAmount, 0),
            $creditLimit: (0, database_1.v)(data.creditLimit, 0),
            $lastVisit: (0, database_1.v)(data.lastVisit, ''), $loyaltyPoints: (0, database_1.v)(data.loyaltyPoints, 0),
            $ts: (0, database_1.now)(),
        });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    (0, licenseGuard_1.handleLicensed)('customers:delete', (_e, _id) => {
        (0, database_1.softDelete)('customers', _id);
        return { success: true };
    });
    (0, licenseGuard_1.handleLicensed)('customers:updateStats', (_e, _id, amount) => {
        const ts = (0, database_1.now)();
        (0, database_1.dbRun)(`UPDATE customers SET timesVisited = timesVisited + 1, totalAmount = totalAmount + $amount,
         lastVisit=$ts, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`, { $id: _id, $amount: amount, $ts: ts });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    (0, licenseGuard_1.handleLicensed)('customers:resetPoints', (_e, _id) => {
        (0, database_1.dbRun)(`UPDATE customers SET loyaltyPoints=0, updatedAt=$ts, isSync=0 WHERE _id=$id AND deletedAt IS NULL`, { $id: _id, $ts: (0, database_1.now)() });
        return (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: _id });
    });
    (0, licenseGuard_1.handleLicensed)('customers:getLedger', (_e, _id) => {
        // Same as the server: voided sales and deleted payments are not part of the account.
        const orders = (0, database_1.dbAll)(`SELECT * FROM orders WHERE customerId = $id AND status != 'voided' ORDER BY createdAt DESC`, { $id: _id });
        const payments = (0, database_1.dbAll)(`SELECT * FROM customer_payments WHERE customerId = $id AND (deletedAt IS NULL OR deletedAt = '') ORDER BY createdAt DESC`, { $id: _id });
        const returns = (0, database_1.dbAll)(`SELECT * FROM product_returns WHERE customerId = $id AND (deletedAt IS NULL OR deletedAt = '') ORDER BY createdAt DESC`, { $id: _id });
        const customer = (0, database_1.dbGet)(`SELECT * FROM customers WHERE _id = $id`, { $id: _id });
        return {
            orders: orders.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') })),
            payments,
            returns: returns.map((r) => ({ ...r, items: JSON.parse(r.items || '[]') })),
            customer
        };
    });
    (0, licenseGuard_1.handleLicensed)('customers:addPayment', (_e, data) => {
        const amount = Number(data.amountPaid ?? 0);
        if (!(amount > 0))
            throw new Error('Amount must be more than zero');
        const owing = (0, database_1.dbGet)('SELECT name, outstandingBalance FROM customers WHERE _id = $id', { $id: (0, database_1.v)(data.customerId) });
        if (!owing)
            throw new Error('Customer not found');
        const owed = Number(owing.outstandingBalance) || 0;
        if (amount > owed + 0.005) {
            throw new Error(`${owing.name} owes ${owed.toFixed(2)}; a payment cannot be more than that`);
        }
        const _id = (0, database_1.generateLocalId)();
        const ts = (0, database_1.now)();
        // Add payment
        (0, database_1.dbRun)(`INSERT INTO customer_payments (_id, customerId, customerName, amountPaid, paymentMethod, date, notes, createdAt, updatedAt, isSync)
       VALUES ($id, $cid, $cname, $amount, $method, $date, $notes, $ts, $ts, 0)`, {
            $id: _id,
            $cid: (0, database_1.v)(data.customerId),
            $cname: (0, database_1.v)(data.customerName),
            $amount: Number(data.amountPaid ?? 0),
            $method: (0, database_1.v)(data.paymentMethod),
            $date: (0, database_1.v)(data.date, new Date().toISOString().split('T')[0]),
            $notes: (0, database_1.v)(data.notes, ''),
            $ts: ts
        });
        // Deduct from outstanding balance
        (0, database_1.dbRun)(`UPDATE customers SET outstandingBalance = outstandingBalance - $amount, updatedAt=$ts, isSync=0 WHERE _id=$cid`, { $amount: Number(data.amountPaid ?? 0), $ts: ts, $cid: (0, database_1.v)(data.customerId) });
        const payment = (0, database_1.dbGet)('SELECT * FROM customer_payments WHERE _id = $id', { $id: _id });
        const customer = (0, database_1.dbGet)('SELECT * FROM customers WHERE _id = $id', { $id: (0, database_1.v)(data.customerId) });
        return { payment, customer };
    });
}
//# sourceMappingURL=customers.js.map