


Jerwin Montellano 
9:36
June 29, 2025




https://insectsconnection.github.io/icon/


You've got a comprehensive backend setup here! To make sure it runs properly on your local server, let's address a few key points:
1. Environment Variables (.env file)
Your code relies heavily on environment variables, especially for Twilio configuration (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER). It's best practice to manage these using a .env file and the dotenv package.
Steps:
Install dotenv:
npm install dotenv


Create a .env file in the root of your project (the same directory as your server.js file).
Add your environment variables to .env:
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx  # Your Twilio Account SID
TWILIO_AUTH_TOKEN=your_auth_token_here             # Your Twilio Auth Token
TWILIO_PHONE_NUMBER=+1234567890                    # Your Twilio Phone Number (e.g., +15017122661)

# Optional: If you want to explicitly set the server port, uncomment and change
# PORT=5000


Load dotenv at the very top of your server file (before any other require statements):
require('dotenv').config(); // Add this line at the very top

const express = require('express');
const multer = require('multer');
// ... rest of your code


2. Supporting Modules/Files
Your server.js imports several local modules:
./auth.js
./cnn-models.js
./payment-system.js
You need to ensure these files exist in the same directory as your server.js and contain the necessary exports. Without these, your server won't start.
Example structure (create these files if you haven't):
/your-project-folder
├── server.js
├── .env
├── package.json
├── package-lock.json
├── auth.js  <-- You need this file
├── cnn-models.js  <-- You need this file
├── payment-system.js <-- You need this file
└── public/  <-- Your frontend HTML, CSS, JS files go here
    ├── index.html
    └── login.html
    └── ...
└── uploads/  <-- This folder will be created automatically for image uploads
└── data/     <-- This folder will be created automatically for JSON data storage
    ├── batches.json
    ├── breeding_log.json
    ├── profit_data.json
    └── tasks.json
    └── users.json (if auth stores users in file)

Brief overview of what each imported file should roughly contain (if you don't have them yet):
auth.js
// auth.js
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const USERS_FILE = path.join(__dirname, 'data', 'users.json');
const SECRET_KEY = process.env.JWT_SECRET || 'your_secret_jwt_key'; // Use .env for this!

// Default permissions for roles
const ROLE_PERMISSIONS = {
    admin: ['*'], // '*' means all permissions
    breeder: ['view_batches', 'create_batches', 'update_batches', 'manage_tasks', 'classify_images', 'view_analytics', 'send_sms'],
    enthusiast: ['view_batches', 'classify_images'],
    purchaser: ['view_batches', 'view_marketplace', 'create_orders', 'make_payments', 'view_analytics'],
    student: ['view_batches', 'classify_images'],
    faculty: ['view_batches', 'classify_images', 'view_analytics'],
    other: ['view_batches']
};

let users = [];

async function initializeUsers() {
    try {
        await fs.mkdir(path.dirname(USERS_FILE), { recursive: true });
        const data = await fs.readFile(USERS_FILE, 'utf8');
        users = JSON.parse(data);
        if (users.length === 0) {
            // Create default admin if no users exist
            await createDefaultAdmin();
        }
    } catch (error) {
        if (error.code === 'ENOENT') { // File not found
            console.log('Users file not found, creating new one and adding admin.');
            await createDefaultAdmin();
        } else {
            console.error('Error loading users:', error);
        }
    }
}

async function saveUsers() {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
}

async function createDefaultAdmin() {
    const adminUsername = 'admin';
    const adminPassword = 'admin123';
    const adminEmail = 'admin@example.com';

    if (!users.some(u => u.username === adminUsername)) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(adminPassword, salt);
        const adminUser = {
            id: uuidv4(),
            firstName: 'Default',
            lastName: 'Admin',
            username: adminUsername,
            email: adminEmail,
            passwordHash: passwordHash,
            role: 'admin',
            createdAt: new Date().toISOString()
        };
        users.push(adminUser);
        await saveUsers();
        console.log('Default admin user created.');
    }
}

async function registerUser(userData) {
    const { username, email, password, firstName, lastName, role, organization } = userData;

    if (users.some(u => u.username === username)) {
        throw new Error('Username already exists');
    }
    if (users.some(u => u.email === email)) {
        throw new Error('Email already registered');
    }
    if (!ROLE_PERMISSIONS[role]) {
        throw new Error('Invalid role specified');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = {
        id: uuidv4(),
        firstName,
        lastName,
        username,
        email,
        passwordHash,
        role,
        organization: organization || null,
        createdAt: new Date().toISOString()
    };
    users.push(newUser);
    await saveUsers();
    return { id: newUser.id, username: newUser.username, role: newUser.role, firstName: newUser.firstName, lastName: newUser.lastName };
}

async function authenticateUser(username, password) {
    const user = users.find(u => u.username === username);
    if (!user) {
        throw new Error('Invalid username or password');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new Error('Invalid username or password');
    }
    return { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email };
}

function generateToken(user) {
    return jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, { expiresIn: '1h' });
}

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // No token

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403); // Invalid token
        req.user = user; // user contains { id, username, role }
        next();
    });
}

function hasPermission(userRole, requiredPermission) {
    const permissions = ROLE_PERMISSIONS[userRole] || [];
    return permissions.includes('*') || permissions.includes(requiredPermission);
}

function requirePermission(permission) {
    return (req, res, next) => {
        if (req.user && hasPermission(req.user.role, permission)) {
            next();
        } else {
            res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
        }
    };
}

async function getAllUsers() {
    return users.map(user => ({
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        email: user.email,
        role: user.role,
        organization: user.organization,
        createdAt: user.createdAt
    }));
}

async function updateUser(userId, updates) {
    const userIndex = users.findIndex(u => u.id === userId);
    if (userIndex === -1) {
        throw new Error('User not found');
    }

    const user = users[userIndex];
    // Only allow certain fields to be updated
    const allowedUpdates = ['firstName', 'lastName', 'email', 'role', 'organization'];

    allowedUpdates.forEach(key => {
        if (updates[key] !== undefined) {
            user[key] = updates[key];
        }
    });

    // Handle password change separately if provided
    if (updates.password) {
        const salt = await bcrypt.genSalt(10);
        user.passwordHash = await bcrypt.hash(updates.password, salt);
    }

    users[userIndex] = user;
    await saveUsers();
    return { id: user.id, username: user.username, role: user.role, firstName: user.firstName, lastName: user.lastName, email: user.email };
}


module.exports = {
    initializeUsers,
    registerUser,
    authenticateUser,
    generateToken,
    authenticateToken,
    hasPermission,
    requirePermission,
    getAllUsers,
    updateUser
};


cnn-models.js (This will be a placeholder as actual CNN models require TensorFlow.js, Python, or external services. For now, it will return dummy data.)
// cnn-models.js
const CLASSIFICATION_LABELS = {
    species: ['Monarch', 'Swallowtail', 'Blue Morpho', 'Painted Lady', 'Common Mormon', 'Orange Tip', 'Glasswing'],
    stage: ['Egg', 'Larva', 'Pupa', 'Adult'],
    disease: ['Healthy', 'Bacterial Infection', 'Fungal Infection', 'Viral Infection'],
    defects: ['Healthy', 'Minor Defects', 'Antbites', 'Slight Deformation', 'Deformed Body', 'Severe Damage']
};

const SPECIES_MARKET_PRICES = {
    "Monarch": 50.00,
    "Swallowtail": 65.00,
    "Blue Morpho": 120.00,
    "Painted Lady": 30.00,
    "Common Mormon": 40.00,
    "Orange Tip": 35.00,
    "Glasswing": 80.00
};

const SPECIES_HOST_PLANTS = {
    "Monarch": { plant: "Milkweed", dailyConsumption: 200, lifecycleDays: 40, marketPrice: 50.00 },
    "Swallowtail": { plant: "Parsley, Fennel, Dill", dailyConsumption: 180, lifecycleDays: 45, marketPrice: 65.00 },
    "Blue Morpho": { plant: "Vines (e.g., Mucuna)", dailyConsumption: 250, lifecycleDays: 50, marketPrice: 120.00 },
    "Painted Lady": { plant: "Thistle, Mallow", dailyConsumption: 100, lifecycleDays: 35, marketPrice: 30.00 },
    "Common Mormon": { plant: "Citrus, Curry Leaf", dailyConsumption: 170, lifecycleDays: 42, marketPrice: 40.00 },
    "Orange Tip": { plant: "Cuckoo Flower", dailyConsumption: 90, lifecycleDays: 38, marketPrice: 35.00 },
    "Glasswing": { plant: "Nightshade Family", dailyConsumption: 120, lifecycleDays: 48, marketPrice: 80.00 }
};

class CNNModelManager {
    constructor() {
        this.modelsLoaded = {
            species: false,
            stage: false,
            disease: false,
            defects: false
        };
        this.modelStatus = {};
    }

    async initialize() {
        console.log('Initializing CNN models (placeholder)...');
        // Simulate model loading
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.modelsLoaded = {
            species: true,
            stage: true,
            disease: true,
            defects: true
        };
        this.modelStatus = {
            species: { status: 'Loaded', version: '1.0', accuracy: '95%' },
            stage: { status: 'Loaded', version: '1.1', accuracy: '92%' },
            disease: { status: 'Loaded', version: '1.0', accuracy: '88%' },
            defects: { status: 'Loaded', version: '1.2', accuracy: '90%' }
        };
        console.log('CNN models initialized (placeholder).');
    }

    getModelStatus() {
        return this.modelStatus;
    }

    async classifyImage(imageBuffer, modelType) {
        if (!this.modelsLoaded[modelType]) {
            throw new Error(`Model for ${modelType} not loaded.`);
        }

        // Simulate classification results
        const labels = CLASSIFICATION_LABELS[modelType];
        const randomIndex = Math.floor(Math.random() * labels.length);
        const predictedLabel = labels[randomIndex];
        const confidence = (Math.random() * 0.2 + 0.7).toFixed(2); // 70-90% confidence

        return {
            prediction: predictedLabel,
            confidence: parseFloat(confidence),
            allScores: labels.map(label => ({ label, score: (Math.random() * 0.1 + (label === predictedLabel ? 0.8 : 0.05)).toFixed(2) }))
        };
    }

    async performFullAnalysis(imageBuffer, analysisType = 'all') {
        const results = {};
        const typesToAnalyze = analysisType === 'all' ? Object.keys(this.modelsLoaded) : [analysisType];

        for (const type of typesToAnalyze) {
            if (this.modelsLoaded[type]) {
                try {
                    results[type] = await this.classifyImage(imageBuffer, type);
                } catch (error) {
                    results[type] = { error: `Failed to classify ${type}: ${error.message}` };
                }
            } else {
                results[type] = { error: `Model for ${type} is not loaded.` };
            }
        }
        return results;
    }
}

const cnnModelManager = new CNNModelManager();

module.exports = {
    cnnModelManager,
    CLASSIFICATION_LABELS,
    SPECIES_MARKET_PRICES,
    SPECIES_HOST_PLANTS
};


payment-system.js (This will be a placeholder for GCash integration, using simple file-based storage for orders.)
// payment-system.js
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const ORDERS_FILE = path.join(__dirname, 'data', 'orders.json');
const PAYMENTS_FILE = path.join(__dirname, 'data', 'payments.json');

const PAYMENT_STATUS = {
    PENDING: 'pending',
    SUCCESS: 'success',
    FAILED: 'failed',
    CANCELLED: 'cancelled',
    REFUNDED: 'refunded'
};

const PAYMENT_METHODS = {
    GCASH: 'gcash',
    BANK_TRANSFER: 'bank_transfer'
};

let orders = [];
let payments = [];

class PaymentProcessor {
    async initialize() {
        try {
            await fs.mkdir(path.dirname(ORDERS_FILE), { recursive: true });
            await fs.mkdir(path.dirname(PAYMENTS_FILE), { recursive: true });

            try {
                const ordersData = await fs.readFile(ORDERS_FILE, 'utf8');
                orders = JSON.parse(ordersData);
            } catch (e) {
                if (e.code === 'ENOENT') { await fs.writeFile(ORDERS_FILE, JSON.stringify([], null, 2)); } else { throw e; }
            }

            try {
                const paymentsData = await fs.readFile(PAYMENTS_FILE, 'utf8');
                payments = JSON.parse(paymentsData);
            } catch (e) {
                if (e.code === 'ENOENT') { await fs.writeFile(PAYMENTS_FILE, JSON.stringify([], null, 2)); } else { throw e; }
            }
            console.log('Payment system initialized.');
        } catch (error) {
            console.error('Error initializing payment system:', error);
        }
    }

    async saveOrders() {
        await fs.writeFile(ORDERS_FILE, JSON.stringify(orders, null, 2), 'utf8');
    }

    async savePayments() {
        await fs.writeFile(PAYMENTS_FILE, JSON.stringify(payments, null, 2), 'utf8');
    }

    async loadOrders() {
        return orders;
    }

    async loadPayments() {
        return payments;
    }

    async createOrder(orderData) {
        const newOrder = {
            orderId: uuidv4(),
            buyerId: orderData.buyerId,
            sellerId: orderData.sellerId,
            items: orderData.items,
            totalAmount: orderData.totalAmount,
            shippingAddress: orderData.shippingAddress,
            notes: orderData.notes,
            status: 'pending', // pending, completed, cancelled
            createdAt: new Date().toISOString(),
            completedAt: null
        };
        orders.push(newOrder);
        await this.saveOrders();
        return newOrder;
    }

    async createGCashPayment(paymentData) {
        const newPayment = {
            paymentId: uuidv4(),
            orderId: paymentData.orderId,
            buyerId: paymentData.buyerId,
            sellerId: paymentData.sellerId,
            amount: paymentData.amount,
            method: PAYMENT_METHODS.GCASH,
            description: paymentData.description,
            status: PAYMENT_STATUS.PENDING,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // In a real scenario, this would involve calling a GCash API
            // and getting a redirect URL or QR code for the user to complete payment.
            // For this mock, we'll generate a dummy QR or simply state "pending manual payment"
            gcashDetails: {
                referenceNumber: 'REF-' + uuidv4().substring(0, 8).toUpperCase(),
                // This QR would be generated by a real GCash integration
                qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=GCashPayment:${newPayment.paymentId}`
            },
            customerInfo: {
                name: paymentData.customerName,
                email: paymentData.customerEmail,
                phone: paymentData.customerPhone
            }
        };
        payments.push(newPayment);
        await this.savePayments();
        return newPayment;
    }

    async handleGCashCallback(callbackData) {
        // This is a simplified mock. A real callback would have transaction IDs, statuses etc.
        const { paymentId, status } = callbackData; // Assuming the callback sends paymentId and status

        const payment = payments.find(p => p.paymentId === paymentId);
        if (!payment) {
            return { success: false, error: 'Payment not found' };
        }

        if (status === 'success') {
            payment.status = PAYMENT_STATUS.SUCCESS;
            payment.updatedAt = new Date().toISOString();

            // Update order status
            const order = orders.find(o => o.orderId === payment.orderId);
            if (order) {
                order.status = 'completed';
                order.completedAt = new Date().toISOString();
                await this.saveOrders();
            }

            await this.savePayments();
            console.log(`Payment ${paymentId} marked as SUCCESS`);
            return { success: true, paymentId, status: PAYMENT_STATUS.SUCCESS };
        } else if (status === 'failed' || status === 'cancelled') {
            payment.status = status;
            payment.updatedAt = new Date().toISOString();
            await this.savePayments();
            console.log(`Payment ${paymentId} marked as ${status.toUpperCase()}`);
            return { success: true, paymentId, status };
        } else {
            return { success: false, error: 'Invalid callback status' };
        }
    }

    async getPaymentStatus(paymentId) {
        const payment = payments.find(p => p.paymentId === paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        return payment;
    }

    async getUserOrders(userId, role = 'buyer') {
        if (role === 'buyer') {
            return orders.filter(order => order.buyerId === userId);
        } else if (role === 'seller') {
            return orders.filter(order => order.sellerId === userId);
        }
        return [];
    }

    async cancelPayment(paymentId, userId) {
        const payment = payments.find(p => p.paymentId === paymentId);
        if (!payment) {
            throw new Error('Payment not found');
        }
        if (payment.buyerId !== userId) {
            throw new Error('Unauthorized to cancel this payment');
        }
        if (payment.status !== PAYMENT_STATUS.PENDING) {
            throw new Error('Only pending payments can be cancelled');
        }

        payment.status = PAYMENT_STATUS.CANCELLED;
        payment.updatedAt = new Date().toISOString();
        await this.savePayments();

        // Potentially update the associated order too
        const order = orders.find(o => o.orderId === payment.orderId);
        if (order && order.status === 'pending') {
            order.status = 'cancelled';
            await this.saveOrders();
        }

        return { success: true, message: 'Payment cancelled successfully' };
    }

    async getPaymentAnalytics(userId = null, role = null) {
        let filteredOrders = orders;
        let filteredPayments = payments;

        if (userId) {
            if (role === 'buyer') {
                filteredOrders = orders.filter(order => order.buyerId === userId);
                filteredPayments = payments.filter(payment => payment.buyerId === userId);
            } else if (role === 'seller') {
                filteredOrders = orders.filter(order => order.sellerId === userId);
                filteredPayments = payments.filter(payment => payment.sellerId === userId);
            }
        }

        const totalTransactions = filteredPayments.length;
        const successfulPayments = filteredPayments.filter(p => p.status === PAYMENT_STATUS.SUCCESS).length;
        const totalRevenue = filteredPayments.reduce((sum, p) => p.status === PAYMENT_STATUS.SUCCESS ? sum + p.amount : sum, 0);

        const orderCounts = {
            pending: filteredOrders.filter(o => o.status === 'pending').length,
            completed: filteredOrders.filter(o => o.status === 'completed').length,
            cancelled: filteredOrders.filter(o => o.status === 'cancelled').length,
        };

        return {
            summary: {
                totalTransactions,
                successfulPayments,
                totalRevenue: totalRevenue.toFixed(2),
                successRate: totalTransactions > 0 ? (successfulPayments / totalTransactions * 100).toFixed(2) : 0
            },
            orderCounts
        };
    }
}

const paymentProcessor = new PaymentProcessor();

module.exports = {
    paymentProcessor,
    PAYMENT_STATUS,
    PAYMENT_METHODS
};


3. Start Command in package.json
For convenience, add a start script to your package.json.
Steps:
Open your package.json file.
Find the "scripts" section and add a "start" command:
{
  "name": "butterfly-breeding-app",
  "version": "1.0.0",
  "description": "",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",  <-- Add this line
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "body-parser": "^1.20.2",
    "cors": "^2.8.5",
    "cron": "^3.1.7",
    "dotenv": "^16.4.5",
    "express": "^4.19.2",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "node-cron": "^3.0.3",
    "qrcode": "^1.5.3",
    "socket.io": "^4.7.5",
    "twilio": "^5.0.4",
    "uuid": "^9.0.1"
  }
}


Now, you can just run npm start in your terminal to fire up the server.
4. Running the Application
With all the pieces in place:
Open your terminal in the root of your project.
Install all dependencies (if you haven't already):
npm install


Start the server:
npm start
You should see output similar to this:
Server running on port 5000
📊 Dashboard: http://localhost:5000
⚠️  Twilio not configured. SMS notifications disabled.
   Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER
🔐 Authentication system ready
🧠 CNN models initialized
Default admin user created. (Only if no users.json exists or it's empty)
👤 Default admin login: username=admin, password=admin123
Payment system initialized.


Open your browser and navigate to http://localhost:5000/login.html (or http://localhost:5000/ if index.html is your default).
Now, your frontend should be able to communicate with your backend server for login, registration, and all the other API calls you've defined!



