/**
 * Fill a company with realistic demo data: a grocery catalogue, customers,
 * staff, suppliers, expenses and about ten weeks of sales, so dashboards and
 * reports can be seen with data in them.
 *
 *   npm run seed:demo -- --tenant corner-shop
 *   npm run seed:demo -- --tenant corner-shop --days 90 --seed 7
 *
 * Sales follow a shop's week (busier Friday and Saturday), its day (lunch and
 * evening peaks) and grow gently over the period. Orders are written the way
 * the till writes them, so every screen reads them as real sales. The same
 * --seed always produces the same data.
 *
 * It only seeds a company with no products or orders, so it can never mix
 * demo sales into a live shop's books. It refuses to run in production unless
 * --allow-production is passed, for setting up a dedicated demo company.
 */
import { Types } from 'mongoose';
import { env } from '../config/env';
import { logger } from '../core/logger';
import { runAsTenant } from '../core/tenantContext';
import Category from '../models/Category';
import Counter from '../models/Counter';
import Customer from '../models/Customer';
import Employee from '../models/Employee';
import Expense from '../models/Expense';
import Order from '../models/Order';
import type { IOrderItem } from '../models/Order';
import Product from '../models/Product';
import Supplier from '../models/Supplier';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

// ── Random numbers ──────────────────────────────────────────────────────────

/** mulberry32: small, fast and repeatable for a given seed. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const between = (min: number, max: number): number => min + next() * (max - min);
  const integer = (min: number, max: number): number => Math.floor(between(min, max + 1));
  const chance = (probability: number): boolean => next() < probability;
  const pick = <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)];

  /** Pick an index with probability proportional to its weight. */
  const weighted = (weights: readonly number[]): number => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = next() * total;
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index];
      if (roll < 0) return index;
    }
    return weights.length - 1;
  };

  return { next, between, integer, chance, pick, weighted };
}

type Random = ReturnType<typeof createRandom>;

const round2 = (value: number): number => Math.round(value * 100) / 100;

// ── Catalogue ───────────────────────────────────────────────────────────────

interface CatalogueItem {
  name: string;
  price: number;
  /** How often it sells relative to other lines. */
  popularity: number;
  /** Deposit return charge per unit, for drinks containers. */
  drs?: number;
}

interface CatalogueCategory {
  name: string;
  vatRate: number;
  items: CatalogueItem[];
}

const CATALOGUE: CatalogueCategory[] = [
  {
    name: 'FRUIT AND VEG',
    vatRate: 0,
    items: [
      { name: 'Bananas 1kg', price: 1.49, popularity: 9 },
      { name: 'Apples 4 Pack', price: 2.29, popularity: 5 },
      { name: 'Tomatoes 500g', price: 1.19, popularity: 6 },
      { name: 'Onions 1kg', price: 0.99, popularity: 7 },
      { name: 'Potatoes 2.5kg', price: 2.49, popularity: 5 },
      { name: 'Carrots 1kg', price: 0.89, popularity: 4 },
      { name: 'Garlic 3 Pack', price: 0.99, popularity: 4 },
      { name: 'Fresh Ginger 250g', price: 1.29, popularity: 3 },
      { name: 'Lemons 4 Pack', price: 1.49, popularity: 3 },
      { name: 'Fresh Coriander', price: 0.79, popularity: 5 },
    ],
  },
  {
    name: 'BAKERY AND DAIRY',
    vatRate: 0,
    items: [
      { name: 'Whole Milk 2L', price: 2.15, popularity: 10 },
      { name: 'Free Range Eggs 12', price: 3.49, popularity: 7 },
      { name: 'Salted Butter 227g', price: 2.79, popularity: 4 },
      { name: 'Mature Cheddar 400g', price: 4.29, popularity: 3 },
      { name: 'Natural Yogurt 500g', price: 1.59, popularity: 4 },
      { name: 'White Sliced Pan', price: 1.95, popularity: 8 },
      { name: 'Naan Bread 4 Pack', price: 1.99, popularity: 5 },
      { name: 'Croissants 4 Pack', price: 2.49, popularity: 3 },
    ],
  },
  {
    name: 'FRESH MEAT',
    vatRate: 0,
    items: [
      { name: 'Chicken Breast 1kg', price: 8.99, popularity: 6 },
      { name: 'Whole Chicken', price: 7.49, popularity: 4 },
      { name: 'Lamb Chops 1kg', price: 14.99, popularity: 3 },
      { name: 'Minced Beef 500g', price: 5.49, popularity: 4 },
      { name: 'Chicken Wings 1kg', price: 5.99, popularity: 3 },
      { name: 'Lamb Leg 1kg', price: 12.99, popularity: 2 },
    ],
  },
  {
    name: 'PANTRY',
    vatRate: 0,
    items: [
      { name: 'Basmati Rice 5kg', price: 12.99, popularity: 4 },
      { name: 'Chapati Flour 10kg', price: 11.49, popularity: 3 },
      { name: 'Sunflower Oil 5L', price: 9.99, popularity: 3 },
      { name: 'Red Lentils 1kg', price: 2.49, popularity: 4 },
      { name: 'Chickpeas 400g', price: 0.89, popularity: 5 },
      { name: 'Chopped Tomatoes 400g', price: 0.79, popularity: 5 },
      { name: 'Garam Masala 100g', price: 1.99, popularity: 3 },
      { name: 'Ground Turmeric 100g', price: 1.49, popularity: 2 },
      { name: 'Granulated Sugar 1kg', price: 1.39, popularity: 4 },
      { name: 'Tea Bags 80', price: 3.29, popularity: 5 },
    ],
  },
  {
    name: 'DRINKS',
    vatRate: 20,
    items: [
      { name: 'Cola 2L', price: 2.99, popularity: 6, drs: 0.25 },
      { name: 'Still Water 500ml', price: 0.99, popularity: 8, drs: 0.15 },
      { name: 'Sparkling Water 1.5L', price: 1.29, popularity: 3, drs: 0.25 },
      { name: 'Mango Lassi 1L', price: 2.79, popularity: 4 },
      { name: 'Orange Juice 1L', price: 2.49, popularity: 4 },
      { name: 'Energy Drink 250ml', price: 1.59, popularity: 5, drs: 0.15 },
    ],
  },
  {
    name: 'SWEETS AND SNACKS',
    vatRate: 20,
    items: [
      { name: 'Crisps Multipack', price: 3.49, popularity: 5 },
      { name: 'Milk Chocolate Bar', price: 1.29, popularity: 8 },
      { name: 'Digestive Biscuits', price: 1.69, popularity: 4 },
      { name: 'Gulab Jamun Tin', price: 3.99, popularity: 2 },
      { name: 'Mixed Nuts 200g', price: 3.49, popularity: 3 },
      { name: 'Bombay Mix 300g', price: 2.29, popularity: 3 },
    ],
  },
  {
    name: 'HOUSEHOLD',
    vatRate: 20,
    items: [
      { name: 'Washing Up Liquid', price: 1.89, popularity: 3 },
      { name: 'Toilet Roll 9 Pack', price: 5.49, popularity: 3 },
      { name: 'Bin Bags 20', price: 2.99, popularity: 2 },
      { name: 'Laundry Detergent 2L', price: 7.99, popularity: 2 },
    ],
  },
];

/** A valid EAN-13 barcode in the in-store range (prefix 20), unique by index. */
function barcodeFor(index: number): string {
  const body = `20${String(1000000000 + index * 7919).slice(-10)}`;
  const sum = [...body].reduce((total, digit, position) => total + Number(digit) * (position % 2 === 0 ? 1 : 3), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}

// ── People ──────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
  'Aisha', 'Omar', 'Sarah', 'Liam', 'Fatima', 'Conor', 'Zainab', 'Hassan', 'Emma', 'Bilal',
  'Niamh', 'Yusuf', 'Hira', 'Daniel', 'Maryam', 'Sean', 'Imran', 'Chloe', 'Ali', 'Grace',
  'Amina', 'Tariq', 'Sophie', 'Usman', 'Aoife', 'Kareem', 'Leah', 'Farhan', 'Ciara', 'Adeel',
];
const LAST_NAMES = [
  'Khan', 'Murphy', 'Ahmed', 'Kelly', 'Hussain', 'Byrne', 'Malik', 'Walsh', 'Siddiqui', 'Ryan',
  'Qureshi', "O'Brien", 'Shah', 'Doyle', 'Iqbal', 'Lynch', 'Rehman', 'Nolan', 'Chaudhry', 'Kennedy',
];

const STREETS = ['Castle Street', 'Main Street', 'Church Road', 'Station Road', 'Park Avenue', 'Mill Lane', 'Green Road'];

/** Numbers from the 07700 900xxx range, set aside for drama and examples. */
const phoneFor = (index: number): string => `07700 900${String(index % 1000).padStart(3, '0')}`;

const emailFor = (name: string, index: number): string =>
  `${name.toLowerCase().replace(/[^a-z]+/g, '.')}${index}@example.com`;

const VOID_REASONS = ['Customer changed mind', 'Wrong item scanned', 'Card payment declined', 'Duplicate transaction'];

// ── Shop rhythm ─────────────────────────────────────────────────────────────

/** Sunday first, matching Date.getDay(). */
const WEEKDAY_TRADE = [1.05, 0.85, 0.8, 0.9, 1.0, 1.25, 1.35];

/** Relative footfall for each opening hour, 08:00 to 21:00. */
const HOURLY_TRADE: Record<number, number> = {
  8: 3, 9: 4, 10: 5, 11: 6, 12: 9, 13: 9, 14: 6, 15: 5, 16: 6, 17: 9, 18: 10, 19: 8, 20: 5, 21: 2,
};
const OPENING_HOURS = Object.keys(HOURLY_TRADE).map(Number);

const BASKET_SIZE_WEIGHTS = [25, 25, 20, 13, 9, 5, 3]; // 1 to 7 lines

// ── Builders ────────────────────────────────────────────────────────────────

interface SeededProduct {
  _id: Types.ObjectId;
  name: string;
  price: number;
  drs: number;
  popularity: number;
  category: string;
}

interface SeededCustomer {
  _id: Types.ObjectId;
  name: string;
  createdAt: Date;
  visits: number;
  spent: number;
  lastVisit: Date | null;
}

interface SeededEmployee {
  _id: Types.ObjectId;
  name: string;
}

function buildProducts(random: Random) {
  const products: SeededProduct[] = [];
  const documents: Record<string, unknown>[] = [];

  CATALOGUE.forEach((category) => {
    category.items.forEach((item) => {
      const index = documents.length;
      const _id = new Types.ObjectId();

      // Most lines are well stocked; a handful are running low or sold out.
      const stock = index % 9 === 4 ? random.integer(1, 9) : index % 17 === 11 ? 0 : random.integer(18, 160);

      documents.push({
        _id,
        name: item.name,
        sku: `SKU-${String(index + 1).padStart(4, '0')}`,
        barcode: barcodeFor(index),
        category: category.name,
        price: item.price,
        vatRate: category.vatRate,
        vatType: 'inclusive',
        costPrice: round2(item.price * random.between(0.55, 0.75)),
        stock,
        drs: item.drs ?? 0,
      });
      products.push({ _id, name: item.name, price: item.price, drs: item.drs ?? 0, popularity: item.popularity, category: category.name });
    });
  });

  return { products, documents };
}

function buildCustomers(random: Random, count: number, now: Date, spanDays: number): SeededCustomer[] {
  const customers: SeededCustomer[] = [];
  const used = new Set<string>();

  while (customers.length < count) {
    const name = `${random.pick(FIRST_NAMES)} ${random.pick(LAST_NAMES)}`;
    if (used.has(name)) continue;
    used.add(name);

    // Most joined before the period; the rest trickle in through it.
    const daysAgo = random.chance(0.55) ? random.integer(spanDays, spanDays + 120) : random.integer(0, spanDays);
    const createdAt = new Date(now.getTime() - daysAgo * 86_400_000 - random.integer(0, 36_000) * 1000);

    customers.push({ _id: new Types.ObjectId(), name, createdAt, visits: 0, spent: 0, lastVisit: null });
  }

  return customers.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

function buildBasket(random: Random, products: SeededProduct[]) {
  const lines = random.weighted(BASKET_SIZE_WEIGHTS) + 1;
  const chosen = new Set<number>();
  const weights = products.map((product) => product.popularity);

  while (chosen.size < lines) chosen.add(random.weighted(weights));

  return [...chosen].map((index): IOrderItem => {
    const product = products[index];
    const quantity = random.chance(0.05) ? 3 : random.chance(0.2) ? 2 : 1;
    const discountPct = random.chance(0.05) ? 10 : 0;
    const unitDiscount = round2(product.price * (discountPct / 100));
    const unitPrice = round2(product.price - unitDiscount);

    // Mirrors the till: price is the charged unit price, totalPrice is before
    // discount, finalPrice includes deposits.
    return {
      product: product._id,
      name: product.name,
      quantity,
      price: unitPrice,
      vatRate: 0,
      vatAmount: 0,
      totalPrice: round2(quantity * product.price),
      discountPct,
      discountAmt: round2(unitDiscount * quantity),
      finalPrice: round2(quantity * unitPrice + product.drs * quantity),
      drs: product.drs,
    };
  });
}

/** A time on the given day, weighted towards the shop's busy hours. */
function tradingTime(random: Random, day: Date): Date {
  const hour = OPENING_HOURS[random.weighted(OPENING_HOURS.map((h) => HOURLY_TRADE[h]))];
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, random.integer(0, 59), random.integer(0, 59));
}

function buildOrders(
  random: Random,
  options: { days: number; now: Date; products: SeededProduct[]; customers: SeededCustomer[]; employees: SeededEmployee[] }
) {
  const { days, now, products, customers, employees } = options;
  const orders: Record<string, unknown>[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset);
    const growth = 1 + 0.2 * ((days - 1 - offset) / Math.max(days - 1, 1));
    const target = Math.round(36 * WEEKDAY_TRADE[day.getDay()] * growth * random.between(0.85, 1.15));

    for (let count = 0; count < target; count += 1) {
      const createdAt = tradingTime(random, day);
      if (createdAt > now) continue;

      const items = buildBasket(random, products);
      const subtotal = round2(items.reduce((sum, item) => sum + item.quantity * item.price, 0));
      const totalDRS = round2(items.reduce((sum, item) => sum + item.quantity * (item.drs ?? 0), 0));
      const discount = subtotal > 20 && random.chance(0.04) ? random.pick([1, 2, 5]) : 0;
      const total = round2(Math.max(0, subtotal - discount + totalDRS));

      // Only baskets of 10 or more are split, so both parts are real amounts.
      const method = random.weighted([42, 50, total >= 10 ? 8 : 0]);
      const paymentMethod = ['cash', 'card', 'split'][method];
      let splitCash: number | null = null;
      let splitCard: number | null = null;
      if (paymentMethod === 'split') {
        splitCash = Math.max(5, Math.floor((total * random.between(0.3, 0.7)) / 5) * 5);
        if (splitCash >= total) splitCash = 5;
        splitCard = round2(total - splitCash);
      }

      const eligible = customers.filter((customer) => customer.createdAt <= createdAt);
      const customer = eligible.length > 0 && random.chance(0.22) ? random.pick(eligible) : null;

      const voided = random.chance(0.015);
      const voider = voided ? random.pick(employees) : null;

      if (customer && !voided) {
        customer.visits += 1;
        customer.spent = round2(customer.spent + total);
        if (!customer.lastVisit || createdAt > customer.lastVisit) customer.lastVisit = createdAt;
      }

      orders.push({
        items,
        subtotal,
        totalVAT: 0,
        discount,
        totalDRS,
        total,
        paymentMethod,
        splitCash,
        splitCard,
        status: voided ? 'voided' : 'completed',
        voidReason: voided ? random.pick(VOID_REASONS) : null,
        voidedAt: voided ? new Date(createdAt.getTime() + random.integer(1, 15) * 60_000) : null,
        voidedByEmployee: voider?._id ?? null,
        voidedByEmployeeName: voider?.name ?? null,
        customerId: customer?._id ?? null,
        customerName: customer?.name ?? null,
        createdAt,
        updatedAt: createdAt,
      });
    }
  }

  // Receipt numbers run in time order, as they would at the till.
  orders.sort((a, b) => (a.createdAt as Date).getTime() - (b.createdAt as Date).getTime());
  orders.forEach((order, index) => {
    order.invoiceId = String(index + 1);
  });

  return orders;
}

function buildExpenses(random: Random, from: Date, now: Date) {
  const expenses: Record<string, unknown>[] = [];
  const add = (date: Date, title: string, category: string, amount: number, paymentMethod: string) => {
    if (date < from || date > now) return;
    expenses.push({ title, category, amount: round2(amount), date, paymentMethod, createdAt: date, updatedAt: date });
  };

  // Monthly bills, for every month the period touches.
  for (let month = new Date(from.getFullYear(), from.getMonth(), 1); month <= now; month = new Date(month.getFullYear(), month.getMonth() + 1, 1)) {
    const on = (day: number, hour = 10) => new Date(month.getFullYear(), month.getMonth(), day, hour);
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();

    add(on(1), 'Shop rent', 'Rent', 1850, 'bank');
    add(on(6), 'Electricity bill', 'Utilities', random.between(210, 290), 'bank');
    add(on(9), 'Water and waste', 'Utilities', random.between(55, 80), 'bank');
    add(on(12), 'Broadband and phone', 'Utilities', 49.99, 'card');
    add(on(15, 17), 'Staff wages, first half', 'Salaries', random.between(2300, 2500), 'bank');
    add(on(lastDay, 17), 'Staff wages, second half', 'Salaries', random.between(2300, 2500), 'bank');
    add(on(random.integer(3, 25)), 'Leaflet printing', 'Marketing', random.between(80, 160), 'card');
  }

  // Weekly and occasional costs.
  for (let day = new Date(from); day <= now; day = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1)) {
    const at = new Date(day.getFullYear(), day.getMonth(), day.getDate(), random.integer(9, 18), random.integer(0, 59));
    if (day.getDay() === 1) add(at, 'Carrier bags and till rolls', 'Supplies', random.between(90, 180), 'card');
    if (day.getDay() === 4) add(at, 'Cleaning supplies', 'Supplies', random.between(25, 60), 'cash');
    if (random.chance(0.12)) add(at, random.pick(['Minor repairs', 'Parking and fuel', 'Staff refreshments']), 'Other', random.between(12, 65), 'cash');
  }

  return expenses;
}

// ── Script ──────────────────────────────────────────────────────────────────

runScript('seedDemoData', async () => {
  const args = parseArgs();
  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));
  const days = Math.min(365, Math.max(14, Number(args.days) || 75));
  const seed = Number(args.seed) || 158;

  if (env.isProduction && args['allow-production'] !== true) {
    throw new Error('Refusing to seed demo data in production. Pass --allow-production for a dedicated demo company.');
  }

  await runAsTenant(tenant._id.toString(), async () => {
    const [productCount, orderCount] = await Promise.all([Product.countDocuments(), Order.countDocuments()]);
    if (productCount > 0 || orderCount > 0) {
      throw new Error(
        `${tenant.name} already has ${productCount} products and ${orderCount} orders. Demo data is only added to an empty company.`
      );
    }

    const random = createRandom(seed);
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));

    const { products, documents: productDocuments } = buildProducts(random);

    const employees: SeededEmployee[] = [];
    const employeeDocuments = ['Shift Manager', 'Cashier', 'Cashier', 'Stock Assistant'].map((role, index) => {
      const name = `${FIRST_NAMES[(index * 7 + 3) % FIRST_NAMES.length]} ${LAST_NAMES[(index * 5 + 2) % LAST_NAMES.length]}`;
      const _id = new Types.ObjectId();
      employees.push({ _id, name });
      return {
        _id,
        name,
        role,
        contactNo: phoneFor(900 + index),
        emailId: emailFor(name, index),
        address: `${random.integer(1, 120)} ${random.pick(STREETS)}`,
        gender: index % 2 === 0 ? 'Female' : 'Male',
        dob: new Date(random.integer(1975, 2003), random.integer(0, 11), random.integer(1, 28)),
      };
    });

    const customers = buildCustomers(random, 48, now, days);
    const orders = buildOrders(random, { days, now, products, customers, employees });
    const expenses = buildExpenses(random, from, now);

    await Category.insertMany(
      CATALOGUE.map((category) => ({
        name: category.name,
        items: category.items.map((item) => item.name),
        vatRate: category.vatRate,
        vatType: 'inclusive',
      }))
    );
    await Product.insertMany(productDocuments);
    await Employee.insertMany(employeeDocuments);
    await Supplier.insertMany([
      { name: 'Fresh Fields Wholesale', contact: phoneFor(950), emailId: 'orders@freshfields.example.com', address: 'Unit 4, Riverside Business Park' },
      { name: 'Crescent Halal Meats', contact: phoneFor(951), emailId: 'sales@crescentmeats.example.com', address: '18 Market Yard' },
      { name: 'Northside Cash and Carry', contact: phoneFor(952), emailId: 'trade@northside.example.com', address: 'North Ring Road Industrial Estate' },
      { name: 'Green Valley Dairies', contact: phoneFor(953), emailId: 'accounts@greenvalley.example.com', address: 'Green Valley Farm' },
    ]);
    await Customer.insertMany(
      customers.map((customer, index) => ({
        _id: customer._id,
        name: customer.name,
        contactNum1: phoneFor(index),
        email: emailFor(customer.name, index),
        address: `${random.integer(1, 200)} ${random.pick(STREETS)}`,
        timesVisited: customer.visits,
        totalAmount: customer.spent,
        lastVisit: customer.lastVisit ? customer.lastVisit.toISOString().slice(0, 10) : '',
        loyaltyPoints: Math.floor(customer.spent) % 100,
        createdAt: customer.createdAt,
        updatedAt: customer.lastVisit ?? customer.createdAt,
      }))
    );
    await Expense.insertMany(expenses);

    // Large batches keep memory flat for long periods.
    for (let start = 0; start < orders.length; start += 1000) {
      await Order.insertMany(orders.slice(start, start + 1000));
    }

    // The next sale at the till continues from the last demo receipt.
    await Counter.findOneAndUpdate({ key: 'receipt' }, { $max: { value: orders.length } }, { upsert: true });

    const sales = orders.filter((order) => order.status === 'completed').reduce((sum, order) => sum + (order.total as number), 0);
    logger.info(
      {
        company: tenant.name,
        days,
        products: productDocuments.length,
        customers: customers.length,
        employees: employees.length,
        expenses: expenses.length,
        orders: orders.length,
        sales: round2(sales),
      },
      'Demo data added'
    );
  });
});
