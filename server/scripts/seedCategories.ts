import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Category from '../models/Category';

dotenv.config();

const categoryItemsMap: Record<string, string[]> = {
  "FISH AND SEAFOOD": [
    "SEA BASS", "SEA BREAM", "PINK BREAM", "SARADINE", "KING FISH", "TUNA BONITO", "TUNA FILLETS",
    "SALMON", "SHARK FILLETS", "PRAWNS", "RED MULLETS", "SPANISH POMPANO", "GREY MULLETS", "RAHU FISH",
    "BOAL FISH", "MIRGAL", "HAKE FISH", "HILSHA FISH", "SALT FISH", "RED SNAPER FISH", "SMOKE TURKEY WINGS",
    "Salted dry Fish"
  ],
  "LAMB BEEF": ["LAMB CHOPS", "BEEF STEAK", "MINCED BEEF", "LAMB SHANK", "BEEF RIBS", "ROAST BEEF", "BEEF BRISKET", "LAMB LEG"],
  "CHICKEN": ["WHOLE CHICKEN", "CHICKEN BREAST", "CHICKEN WINGS", "CHICKEN THIGHS", "DRUMSTICKS", "CHICKEN MINCE", "CHICKEN LIVER"],
  "FRUITS": ["APPLE", "BANANA", "ORANGE", "MANGO", "GRAPES", "PINEAPPLE", "WATERMELON", "STRAWBERRY", "PEACH", "PEAR"],
  "VEG": ["POTATO", "ONION", "TOMATO", "CARROT", "BROCCOLI", "SPINACH", "CABBAGE", "BELL PEPPER", "GARLIC", "GINGER"],
  "BAKERY AND DAIRY": ["MILK", "BREAD", "EGGS", "BUTTER", "CHEESE", "YOGURT", "CROISSANT", "BAGUETTE", "CAKE", "MUFFIN"]
};

const seedCategories = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log('MongoDB Connected');

    for (const [name, items] of Object.entries(categoryItemsMap)) {
      const existing = await Category.findOne({ name });
      if (!existing) {
        await Category.create({ name, items, vatRate: 0, vatType: 'exclusive' });
        console.log(`Created category: ${name}`);
      } else {
        console.log(`Category already exists: ${name}`);
      }
    }

    console.log('Category seeding completed successfully');
    process.exit();
  } catch (error) {
    console.error('Error with data import', error);
    process.exit(1);
  }
};

seedCategories();
