import mongoose, { Schema } from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const BCRYPT_ROUNDS = 12;

const TestUserSchema = new Schema({
  name: String,
  email: String,
  passwordHash: { type: String, required: true, select: false },
});

const TestUser = mongoose.model('TestUser', TestUserSchema);

async function run() {
  await mongoose.connect(process.env.MONGO_URI as string);
  
  // Create user
  const u1 = await TestUser.create({
    name: 'Test',
    email: 'testselect@example.com',
    passwordHash: 'oldhash',
  });
  console.log('Created user passwordHash:', u1.passwordHash); // Should be oldhash

  // Find user (deselect passwordHash)
  const foundUser = await TestUser.findById(u1._id);
  console.log('Found user passwordHash:', foundUser?.passwordHash); // Should be undefined

  if (foundUser) {
    foundUser.passwordHash = 'newhash';
    await foundUser.save();
  }

  // Find user explicitly selecting passwordHash
  const updatedUser = await TestUser.findById(u1._id).select('+passwordHash');
  console.log('Updated user passwordHash:', updatedUser?.passwordHash); // Should be newhash

  await TestUser.deleteOne({ _id: u1._id });
  mongoose.disconnect();
}
run().catch(console.error);
