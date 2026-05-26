/**
 * localApi.ts
 *
 * A drop-in replacement for the axios `api` instance when running inside
 * Electron. Routes every call to window.electronAPI (IPC → SQLite) instead
 * of hitting the remote HTTP server.
 *
 * Mirrors the same { data: { success, data, message } } response envelope
 * that the Express server returns, so all existing components work unchanged.
 */

const eAPI = () => window.electronAPI!;

// ─── helpers ────────────────────────────────────────────────────────────────

function ok(data: unknown, message = 'OK') {
  return { data: { success: true, data, message } };
}

function parseId(url: string): string {
  return url.split('/').filter(Boolean).pop()!;
}

// ─── route table ─────────────────────────────────────────────────────────────

type Method = 'get' | 'post' | 'patch' | 'put' | 'delete';

async function route(method: Method, url: string, body?: any): Promise<any> {
  const parts = url.replace(/^\//, '').split('/');
  const resource = parts[0];   // e.g. "products"
  const id       = parts[1];   // e.g. "abc123"  or "barcode" or "sync"
  const sub      = parts[2];   // e.g. "stock"

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  if (resource === 'products') {
    if (method === 'get' && !id)
      return ok(await eAPI().products.getAll());

    if (method === 'get' && id === 'barcode')
      return ok(await eAPI().products.getByBarcode(sub));

    if (method === 'post' && !id)
      return ok(await eAPI().products.create(body));

    if ((method === 'patch' || method === 'put') && id && sub === 'stock')
      return ok(await eAPI().products.updateStock(id, body.quantity));

    if ((method === 'patch' || method === 'put') && id && !sub)
      return ok(await eAPI().products.update(id, body));

    if (method === 'delete' && id)
      return ok(await eAPI().products.delete(id));
  }

  // ── CATEGORIES ────────────────────────────────────────────────────────────
  if (resource === 'categories') {
    if (method === 'get')   return ok(await eAPI().categories.getAll());
    if (method === 'post')  return ok(await eAPI().categories.create(body));
    if ((method === 'put' || method === 'patch') && id)
      return ok(await eAPI().categories.update(id, body));
    if (method === 'delete' && id)
      return ok(await eAPI().categories.delete(id));
  }

  // ── ORDERS ────────────────────────────────────────────────────────────────
  if (resource === 'orders') {
    if (method === 'get' && id === 'voided')
      return ok(await eAPI().orders.getVoided());

    if (method === 'get' && !id) {
      const { month, year } = body || {};
      return ok(await eAPI().orders.getAll(month, year));
    }

    if (method === 'post' && !id)
      return ok(await eAPI().orders.create(body));

    // void = DELETE /:id
    if (method === 'delete' && id)
      return ok(await eAPI().orders.void(
        id,
        body?.reason || 'No reason provided',
        body?.employeeId,
        body?.employeeName,
      ));
  }

  // ── CUSTOMERS ─────────────────────────────────────────────────────────────
  if (resource === 'customers') {
    if (method === 'get' && !id)
      return ok(await eAPI().customers.getAll());
    if (method === 'post' && !id)
      return ok(await eAPI().customers.create(body));
    if ((method === 'put' || method === 'patch') && id && !sub)
      return ok(await eAPI().customers.update(id, body));
    if (method === 'delete' && id)
      return ok(await eAPI().customers.delete(id));
    if (method === 'post' && id && sub === 'transaction')
      return ok(await eAPI().customers.updateStats(id, body.amount));
    if (method === 'post' && id && sub === 'reset-points')
      return ok(await eAPI().customers.resetPoints(id));
  }

  // ── EMPLOYEES ─────────────────────────────────────────────────────────────
  if (resource === 'employees') {
    if (method === 'get')   return ok(await eAPI().employees.getAll());
    if (method === 'post')  return ok(await eAPI().employees.create(body));
    if ((method === 'put' || method === 'patch') && id)
      return ok(await eAPI().employees.update(id, body));
    if (method === 'delete' && id)
      return ok(await eAPI().employees.delete(id));
  }

  // ── EMPLOYEE DAMAGES ──────────────────────────────────────────────────────
  if (resource === 'employee-damages') {
    if (method === 'get' && !id)                return ok(await eAPI().employeeDamages.getAll());
    if (method === 'post' && !id)               return ok(await eAPI().employeeDamages.create(body));
    if ((method === 'put' || method === 'patch') && id)
                                                return ok(await eAPI().employeeDamages.update(id, body));
    if (method === 'delete' && id)              return ok(await eAPI().employeeDamages.delete(id));
  }

  // ── EXPENSES ──────────────────────────────────────────────────────────────
  if (resource === 'expenses') {
    if (method === 'get')  return ok(await eAPI().expenses.getAll());
    if (method === 'post') return ok(await eAPI().expenses.create(body));
  }

  // ── EXPENSE CATEGORIES ────────────────────────────────────────────────────
  if (resource === 'expense-categories') {
    if (method === 'get')              return ok(await eAPI().expenseCategories.getAll());
    if (method === 'post')             return ok(await eAPI().expenseCategories.create(body));
    if (method === 'delete' && id)     return ok(await eAPI().expenseCategories.delete(id));
  }

  // ── SUPPLIERS ─────────────────────────────────────────────────────────────
  if (resource === 'suppliers') {
    if (method === 'get')  return ok(await eAPI().suppliers.getAll());
    if (method === 'post') return ok(await eAPI().suppliers.create(body));
  }

  // ── BANKS ─────────────────────────────────────────────────────────────────
  if (resource === 'banks') {
    if (method === 'get'  && id === 'names')    return ok(await eAPI().banks.getNames());
    if (method === 'post' && id === 'names')    return ok(await eAPI().banks.addName(body));
    if (method === 'get'  && id === 'accounts') return ok(await eAPI().banks.getAccounts());
    if (method === 'post' && id === 'accounts') return ok(await eAPI().banks.addAccount(body));
    if (method === 'get'  && id === 'cards')    return ok(await eAPI().banks.getCards());
    if (method === 'post' && id === 'cards')    return ok(await eAPI().banks.addCard(body));
  }

  // ── SETTINGS ──────────────────────────────────────────────────────────────
  if (resource === 'settings') {
    if (method === 'get'  && id === 'quick-products')
      return ok(await eAPI().settings.getQuickProducts());
    if ((method === 'put' || method === 'patch') && id === 'quick-products')
      return ok(await eAPI().settings.updateQuickProducts(body));
    if (method === 'get'  && !id)
      return ok(await eAPI().settings.get());
    if ((method === 'put' || method === 'patch') && !id)
      return ok(await eAPI().settings.update(body));
  }

  // ── DASHBOARD / ANALYTICS — return empty stubs offline ───────────────────
  if (resource === 'dashboard') return ok({});
  if (resource === 'analytics') return ok([]);

  throw new Error(`[localApi] Unhandled route: ${method.toUpperCase()} /${url}`);
}

// ─── Public API (same shape as axios instance) ───────────────────────────────

const localApi = {
  get:    (url: string, config?: any) => route('get',    url, config?.params),
  post:   (url: string, body?: any)   => route('post',   url, body),
  patch:  (url: string, body?: any)   => route('patch',  url, body),
  put:    (url: string, body?: any)   => route('put',    url, body),
  delete: (url: string, config?: any) => route('delete', url, config?.data || config?.params),
};

export default localApi;
