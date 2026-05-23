// Test script to simulate product creation with image
const FormData = require('form-data');
const fs = require('fs');
const axios = require('axios');
const path = require('path');

async function testUpload() {
  try {
    // First, login to get token
    console.log('🔐 Logging in...');
    const loginRes = await axios.post('http://localhost:5001/api/auth/login', {
      email: 'deviction@gmail.com',
      password: '12345678'
    });
    
    const token = loginRes.data.data.token;
    console.log('✅ Login successful, token:', token.substring(0, 20) + '...');

    // Create a test image file (1x1 pixel PNG)
    const testImagePath = path.join(__dirname, 'test-image.png');
    const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    fs.writeFileSync(testImagePath, pngBuffer);
    console.log('📷 Created test image:', testImagePath);

    // Create FormData
    const form = new FormData();
    form.append('name', 'Test Product with Image');
    form.append('sku', 'TEST-' + Date.now());
    form.append('barcode', 'BAR-' + Date.now());
    form.append('category', 'FISH AND SEAFOOD');
    form.append('price', '99.99');
    form.append('costPrice', '50.00');
    form.append('stock', '10');
    form.append('vatRate', '5');
    form.append('vatType', 'inclusive');
    form.append('image', fs.createReadStream(testImagePath), {
      filename: 'test-image.png',
      contentType: 'image/png'
    });

    console.log('📤 Sending POST request to /api/products...');
    const response = await axios.post('http://localhost:5001/api/products', form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));

    // Cleanup
    fs.unlinkSync(testImagePath);
    console.log('🧹 Cleaned up test image');

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

testUpload();
