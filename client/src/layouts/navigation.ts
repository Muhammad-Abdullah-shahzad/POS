/**
 * Sidebar navigation for the cashier and admin workspaces.
 *
 * The two menus share most sections; the admin one lives under /admin and adds
 * a few management pages. Both are built here so a new page is added once.
 */
import {
  IconAddressBook,
  IconBan,
  IconBuildingBank,
  IconCash,
  IconChartDonut3,
  IconKey,
  IconLayoutDashboard,
  IconPackage,
  IconPackages,
  IconReceipt,
  IconReportAnalytics,
  IconSettings,
  IconUsersGroup,
} from '@tabler/icons-react';
import type { TablerIcon } from '@tabler/icons-react';

export interface NavChild {
  label: string;
  path: string;
}

export interface NavItem {
  label: string;
  icon: TablerIcon;
  /** A page. Sections with children have no path of their own. */
  path?: string;
  children?: NavChild[];
}

const REPORTS: [label: string, slug: string][] = [
  ['Sales Summary Report', 'sales-summary'],
  ['Transaction Sales Report', 'transaction-sales'],
  ['Category Sale Report', 'category-sale'],
  ['Top Sale Products', 'top-sale-products'],
  ['Products Sale Report', 'products-sale'],
  ['Category Ratio Report', 'category-ratio'],
  ['Category Profit Report', 'category-profit'],
  ['Expiry Items Report', 'expiry-items'],
  ['Employee Sales Report', 'employee-sales'],
  ['Product Purchase - Sales History', 'purchase-sales-history'],
  ['Z Report Print Report', 'z-report-print'],
  ['Sales Analysis Report', 'sales-analysis'],
  ['Profit Analysis Report', 'profit-analysis'],
  ['Product Stock Report', 'product-stock'],
  ['Posting Report', 'posting'],
  ['Bag Levy Report', 'bag-levy'],
  ['DRS Report', 'drs'],
  ['Inventory Report', 'inventory'],
  ['Invoice Report', 'invoice'],
  ['Wastage Report', 'wastage'],
  ['Exchange Refund Report', 'exchange-refund'],
  ['Expenses Report', 'expenses'],
  ['Stock Reconciliation Report', 'stock-reconciliation'],
  ['Stock Value', 'stock-value'],
];

/** The sections both workspaces share, rooted at `base` ('' or '/admin'). */
function workspaceItems(base: string): NavItem[] {
  return [
    { label: 'Receipts', icon: IconReceipt, path: `${base}/receipts` },
    {
      label: 'Product',
      icon: IconPackage,
      children: [
        { label: 'Manage Category', path: `${base}/products/category` },
        { label: 'Manage Products', path: `${base}/products` },
        { label: 'Manage Quick Products', path: `${base}/products/quick` },
        { label: 'Manage General Products', path: `${base}/products/general` },
        { label: 'Edit Price', path: `${base}/products/edit-price` },
        { label: 'Wastage Management', path: `${base}/products/wastage` },
        { label: 'Excel Sheet Load', path: `${base}/products/excel-load` },
        { label: 'Stock Reconciliation', path: `${base}/products/reconciliation` },
      ],
    },
    {
      label: 'Stock',
      icon: IconPackages,
      children: [
        { label: 'View Stock', path: `${base}/products` },
        { label: 'Manage Suppliers', path: `${base}/suppliers` },
        { label: 'Supplier Payments', path: `${base}/suppliers/payments` },
      ],
    },
    { label: 'Expenses', icon: IconCash, path: `${base}/expenses` },
    { label: 'Analysis', icon: IconChartDonut3, path: `${base}/analysis` },
    {
      label: 'Reports',
      icon: IconReportAnalytics,
      children: REPORTS.map(([label, slug]) => ({ label, path: `${base}/reports/${slug}` })),
    },
    {
      label: 'Employees',
      icon: IconUsersGroup,
      children: [
        { label: 'Manage Employees', path: `${base}/employees` },
        { label: 'Salary Management', path: `${base}/employees/salary` },
        { label: 'Damages', path: `${base}/employees/damages` },
        { label: 'Change Password', path: `${base}/employees/change-password` },
        { label: 'Employee Access', path: `${base}/employees/access` },
        { label: 'Duty Roaster', path: `${base}/employees/duty-roaster` },
        { label: 'Attendance Report', path: `${base}/employees/attendance-report` },
        { label: 'OverTime Details', path: `${base}/employees/overtime` },
      ],
    },
    { label: 'Bank', icon: IconBuildingBank, path: `${base}/bank` },
    { label: 'Customer Details', icon: IconAddressBook, path: `${base}/customers` },
  ];
}

export const CASHIER_NAV: NavItem[] = [
  { label: 'Counter', icon: IconLayoutDashboard, path: '/' },
  ...workspaceItems(''),
];

const [adminReceipts, ...adminSections] = workspaceItems('/admin');

export const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', icon: IconLayoutDashboard, path: '/admin' },
  adminReceipts,
  { label: 'Void Transactions', icon: IconBan, path: '/admin/void-transactions' },
  ...adminSections,
  { label: 'Settings', icon: IconSettings, path: '/admin/settings' },
  { label: 'Licence', icon: IconKey, path: '/license' },
];
