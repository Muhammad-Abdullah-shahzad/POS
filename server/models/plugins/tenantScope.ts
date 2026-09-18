/**
 * tenantScope — the plugin that makes data isolation automatic.
 *
 * Applying it to a schema does three things:
 *   1. adds a required, indexed `tenantId` field
 *   2. injects `tenantId` into the filter of every query, update and delete
 *   3. stamps `tenantId` onto every document that is created
 *
 * The value always comes from the request context, never from the request body,
 * so a caller cannot read or write another company's rows by sending an id.
 *
 * When no scope is active the plugin throws instead of running an unscoped
 * query. Trusted internal work (onboarding, migrations, CLI scripts) opts out
 * explicitly by running inside `withSystemScope()`.
 */
import {
  MongooseDistinctQueryMiddleware,
  MongooseQueryAndDocumentMiddleware,
  Schema,
  Types,
} from 'mongoose';
import { getTenantId, hasScope, isSystemScope } from '../../core/tenantContext';
import { TenantScopeError } from '../../core/errors';

/**
 * Query middleware that accepts a filter. `estimatedDocumentCount` is left out
 * because it counts the whole collection and cannot be filtered.
 */
const QUERY_HOOKS: MongooseDistinctQueryMiddleware[] = [
  'find',
  'findOne',
  'findOneAndUpdate',
  'findOneAndDelete',
  'findOneAndReplace',
  'countDocuments',
  'distinct',
  'updateMany',
  'replaceOne',
  'deleteMany',
];

/**
 * `updateOne` and `deleteOne` exist as both query and document middleware, so
 * they are registered separately and limited to the query form.
 */
const AMBIGUOUS_QUERY_HOOKS: MongooseQueryAndDocumentMiddleware[] = ['updateOne', 'deleteOne'];

/**
 * Resolve the tenant for the current operation.
 * Returns null when the operation is allowed to run unscoped.
 */
function resolveTenantId(modelName: string, operation: string): Types.ObjectId | null {
  if (isSystemScope()) return null;

  if (!hasScope()) {
    throw new TenantScopeError(modelName, operation);
  }

  const tenantId = getTenantId();
  if (!tenantId) {
    throw new TenantScopeError(modelName, operation);
  }

  return new Types.ObjectId(tenantId);
}

/** Remove a caller supplied tenantId so it can never override the context. */
function stripTenantId(update: Record<string, any> | null | undefined): void {
  if (!update || typeof update !== 'object') return;

  delete update.tenantId;
  for (const operator of ['$set', '$setOnInsert', '$unset'] as const) {
    if (update[operator] && typeof update[operator] === 'object') {
      delete update[operator].tenantId;
    }
  }
}

export function tenantScopePlugin(schema: Schema): void {
  // No single-field index is declared here. Every model defines compound
  // indexes that start with tenantId, which already serve tenant-only queries.
  // A plain { tenantId: 1 } index would also collide with models that need a
  // unique index on exactly that key, such as Settings.
  schema.add({
    tenantId: {
      type: Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      immutable: true,
    },
  });

  // ── Reads, updates and deletes ────────────────────────────────────────────
  function scopeQuery(this: any): void {
    const tenantId = resolveTenantId(this.model?.modelName ?? 'Model', this.op ?? 'query');
    if (!tenantId) return;

    this.where({ tenantId });

    const update = this.getUpdate?.();
    stripTenantId(update);

    // An upsert creates a document, so it needs the tenant stamped on insert.
    if (update && this.getOptions?.().upsert) {
      this.setUpdate({ ...update, $setOnInsert: { ...(update.$setOnInsert ?? {}), tenantId } });
    }
  }

  schema.pre(QUERY_HOOKS, scopeQuery);
  schema.pre(AMBIGUOUS_QUERY_HOOKS, { document: false, query: true }, scopeQuery);

  // ── Creates ───────────────────────────────────────────────────────────────
  // Runs on validate (not save) because `tenantId` is required and validation
  // happens before the save hooks.
  schema.pre('validate', function (this: any) {
    const tenantId = resolveTenantId(this.constructor?.modelName ?? 'Model', 'save');
    if (!tenantId) return;
    this.tenantId = tenantId;
  });

  schema.pre('insertMany', function (docs: any) {
    const tenantId = resolveTenantId(this.modelName ?? 'Model', 'insertMany');
    if (!tenantId) return;

    for (const doc of Array.isArray(docs) ? docs : [docs]) {
      doc.tenantId = tenantId;
    }
  });

  // ── Aggregations ──────────────────────────────────────────────────────────
  // $match is prepended so the tenant filter runs before any grouping.
  schema.pre('aggregate', function (this: any) {
    const tenantId = resolveTenantId(this._model?.modelName ?? 'Model', 'aggregate');
    if (!tenantId) return;
    this.pipeline().unshift({ $match: { tenantId } });
  });

  // `tenantId` is an internal ownership marker; clients never need to see it.
  const hideTenantId = {
    transform(_doc: unknown, ret: Record<string, any>) {
      delete ret.tenantId;
      return ret;
    },
  };
  schema.set('toJSON', hideTenantId);
  schema.set('toObject', hideTenantId);
}
