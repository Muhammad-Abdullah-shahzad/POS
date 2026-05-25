# Store POS & Accounting System

A production-grade Point of Sale (POS) and Business Management System built using the MERN stack with a focus on clean architecture, VAT handling, and expense management.

## Features
- **Auth System**: Role-based access control (Admin, Manager, Cashier)
- **Product Management**: Configurable VAT rates (inclusive/exclusive), barcode support.
- **POS System**: Fast cart operations, barcode scanning, split payments.
- **Invoice & Receipt**: Thermal printer friendly receipt generation.
- **Expense Management**: Track expenses and calculate net profit.
- **Inventory Management**: Auto-deduction and low stock alerts.
- **Dashboard**: Business intelligence and charts.

## Tech Stack
- **Frontend**: React (Vite), Mantine UI, React Router, Zustand, React Hook Form, Axios.
- **Backend**: Node.js, Express.js, MongoDB, Mongoose, JWT.

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB running locally or a MongoDB Atlas URI

### 1. Backend Setup
```bash
cd server
npm install
# Create a .env file based on the provided .env or set environment variables
npm run dev
```
*(You may need to add `"dev": "nodemon server.ts"` to your `server/package.json` scripts)*

### 2. Frontend Setup
```bash
cd client
npm install
npm run dev
```

### Architecture
This repository follows a feature-based architecture on the frontend and a layered architecture on the backend.
