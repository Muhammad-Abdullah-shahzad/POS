/**
 * Shared harness for the CLI scripts.
 *
 * Handles the connect / disconnect lifecycle and turns an unhandled failure
 * into a non-zero exit code, so scripts stay focused on what they actually do.
 */
import { connectDB, disconnectDB } from '../../config/db';
import { logger } from '../../core/logger';
import { withSystemScope } from '../../core/tenantContext';
import Tenant, { ITenant } from '../../models/Tenant';

export async function runScript(name: string, work: () => Promise<void>): Promise<void> {
  const startedAt = Date.now();

  try {
    await connectDB();
    // Scripts operate across tenants by definition.
    await withSystemScope(work);
    logger.info({ script: name, ms: Date.now() - startedAt }, 'Script finished');
    await disconnectDB();
    process.exit(0);
  } catch (error) {
    logger.error({ err: error, script: name }, 'Script failed');
    await disconnectDB().catch(() => undefined);
    process.exit(1);
  }
}

/** Read `--key value` and `--flag` arguments from the command line. */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string | boolean> {
  const args: Record<string, string | boolean> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) continue;

    const key = token.slice(2);
    const next = argv[index + 1];

    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }

  return args;
}

export function requireArg(args: Record<string, string | boolean>, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Missing required argument --${key}`);
  }
  return value.trim();
}

/** Look a company up by slug, the identifier the CLI uses. */
export async function findTenantBySlug(slug: string): Promise<ITenant> {
  const tenant = await Tenant.findOne({ slug: slug.toLowerCase() });
  if (!tenant) throw new Error(`No company found with slug "${slug}"`);
  return tenant;
}
