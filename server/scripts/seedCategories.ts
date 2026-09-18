/**
 * Seed a company's product categories with a starter set.
 *
 *   npm run seed:categories -- --tenant corner-shop
 *
 * Existing categories are left alone, so this is safe to re-run.
 */
import { runAsTenant } from '../core/tenantContext';
import { logger } from '../core/logger';
import Category from '../models/Category';
import { findTenantBySlug, parseArgs, requireArg, runScript } from './lib/runScript';

const STARTER_CATEGORIES: Record<string, string[]> = {
  'FISH AND SEAFOOD': [
    'SEA BASS', 'SEA BREAM', 'PINK BREAM', 'SARADINE', 'KING FISH', 'TUNA BONITO', 'TUNA FILLETS',
    'SALMON', 'SHARK FILLETS', 'PRAWNS', 'RED MULLETS', 'SPANISH POMPANO', 'GREY MULLETS', 'RAHU FISH',
    'BOAL FISH', 'MIRGAL', 'HAKE FISH', 'HILSHA FISH', 'SALT FISH', 'RED SNAPER FISH',
    'SMOKE TURKEY WINGS', 'SALTED DRY FISH',
  ],
  'LAMB BEEF': ['LAMB CHOPS', 'BEEF STEAK', 'MINCED BEEF', 'LAMB SHANK', 'BEEF RIBS', 'ROAST BEEF', 'BEEF BRISKET', 'LAMB LEG'],
  CHICKEN: ['WHOLE CHICKEN', 'CHICKEN BREAST', 'CHICKEN WINGS', 'CHICKEN THIGHS', 'DRUMSTICKS', 'CHICKEN MINCE', 'CHICKEN LIVER'],
  FRUITS: ['APPLE', 'BANANA', 'ORANGE', 'MANGO', 'GRAPES', 'PINEAPPLE', 'WATERMELON', 'STRAWBERRY', 'PEACH', 'PEAR'],
  VEG: ['POTATO', 'ONION', 'TOMATO', 'CARROT', 'BROCCOLI', 'SPINACH', 'CABBAGE', 'BELL PEPPER', 'GARLIC', 'GINGER'],
  'BAKERY AND DAIRY': ['MILK', 'BREAD', 'EGGS', 'BUTTER', 'CHEESE', 'YOGURT', 'CROISSANT', 'BAGUETTE', 'CAKE', 'MUFFIN'],
};

runScript('seedCategories', async () => {
  const args = parseArgs();
  const tenant = await findTenantBySlug(requireArg(args, 'tenant'));

  await runAsTenant(tenant._id.toString(), async () => {
    for (const [name, items] of Object.entries(STARTER_CATEGORIES)) {
      const existing = await Category.findOne({ name });

      if (existing) {
        logger.info({ category: name }, 'Category already present');
        continue;
      }

      await Category.create({ name, items, vatRate: 0, vatType: 'exclusive' });
      logger.info({ category: name }, 'Category created');
    }
  });
});
