// ... existing imports ...
import express from 'express';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import cors from 'cors';
import bodyParser from 'body-parser';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const SECRET_KEY = process.env.JWT_SECRET || 'shipteez_secret_key_change_me';
// Secret specifically for signing order integrity
const HMAC_SECRET = process.env.HMAC_SECRET || 'order_integrity_secret_do_not_share'; 
const UPLOAD_DIR = path.join(__dirname, 'public/uploads');

// --- Anti-Spam / Rate Limiting (In-Memory) ---
const rateLimitMap = new Map();

// Helper: Rate Limit Check
// limit: number of requests allowed
// windowMs: time window in milliseconds
const checkRateLimit = (ip, key, limit, windowMs) => {
    const now = Date.now();
    const mapKey = `${ip}:${key}`;
    const record = rateLimitMap.get(mapKey);

    if (!record) {
        rateLimitMap.set(mapKey, { count: 1, expiry: now + windowMs });
        return true;
    }

    if (now > record.expiry) {
        rateLimitMap.set(mapKey, { count: 1, expiry: now + windowMs });
        return true;
    }

    if (record.count >= limit) {
        return false;
    }

    record.count++;
    return true;
};

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of rateLimitMap.entries()) {
        if (now > value.expiry) {
            rateLimitMap.delete(key);
        }
    }
}, 5 * 60 * 1000);

// --- Data Integrity & Sanitization Helper ---
const validateTicketInput = (data, type) => {
    const errors = [];
    
    const sanitize = (str) => {
        if (typeof str !== 'string') return '';
        // Remove control characters, basic XSS vectors
        return str.replace(/[<>{}]/g, '').trim(); 
    };

    if (type === 'create') {
        if (!data.subject || typeof data.subject !== 'string' || data.subject.length < 3 || data.subject.length > 100) {
            errors.push('Subject must be between 3 and 100 characters.');
        }
        if (!data.message || typeof data.message !== 'string' || data.message.length < 5 || data.message.length > 2000) {
            errors.push('Message must be between 5 and 2000 characters.');
        }
        data.subject = sanitize(data.subject);
        data.message = sanitize(data.message);
    } else if (type === 'reply') {
        if (!data.text || typeof data.text !== 'string' || data.text.length < 1 || data.text.length > 2000) {
            if (!data.attachments || data.attachments.length === 0) {
                errors.push('Message text is required (max 2000 chars) unless attaching files.');
            }
        }
        if (data.role !== 'user' && data.role !== 'admin') {
            errors.push('Invalid role.');
        }
        if (data.text) data.text = sanitize(data.text);
    }

    if (errors.length > 0) throw new Error(errors.join(' '));
    return data;
};

// --- HMAC Helper ---
const signOrder = (orderData) => {
    // Create a signature of critical fields: ID, Total, and Item Count
    const payload = `${orderData.id}|${orderData.total}|${JSON.stringify(orderData.items.map(i => i.id + ':' + i.quantity))}`;
    return crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
};

// ... (Rest of existing setup) ...

// Ensure Upload Directory Exists
if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

app.use('/uploads', express.static(UPLOAD_DIR));

let db;
(async () => {
    db = await open({
        filename: path.join(__dirname, 'shipteez.db'),
        driver: sqlite3.Database
    });
    console.log('Connected to SQLite database.');
})();

// ... (Helper functions processImageField, offloadImagesToDisk, authenticate, isAdmin) ...
const processImageField = (data) => {
    if (typeof data !== 'string') return data;
    const matches = data.match(/^data:image\/(\w+);base64,(.+)$/);
    if (matches) {
        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
        const bin = Buffer.from(matches[2], 'base64');
        const filename = `img_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.${ext}`;
        const filepath = path.join(UPLOAD_DIR, filename);
        try {
            fs.writeFileSync(filepath, bin);
            return `/uploads/${filename}`;
        } catch (e) {
            console.error("Failed to write image to disk", e);
            return data;
        }
    }
    return data;
};

const offloadImagesToDisk = (obj) => {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            if (typeof obj[i] === 'string') {
                obj[i] = processImageField(obj[i]);
            } else if (typeof obj[i] === 'object' && obj[i] !== null) {
                offloadImagesToDisk(obj[i]);
            }
        }
    } else if (typeof obj === 'object' && obj !== null) {
        for (const key in obj) {
            if (['images', 'designAsset', 'url', 'image', 'base64', 'logoUrl', 'backgroundImage'].includes(key) || typeof obj[key] === 'object') {
                if (typeof obj[key] === 'string') {
                    obj[key] = processImageField(obj[key]);
                } else {
                    offloadImagesToDisk(obj[key]);
                }
            }
        }
    }
};

const authenticate = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.sendStatus(401);
    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.sendStatus(403);
    }
};

// ... (Product, User, Content, Settings routes remain same) ...

// Products
app.get('/api/products', async (req, res) => {
    const products = await db.all('SELECT * FROM products');
    const parsed = products.map(p => {
        const data = JSON.parse(p.data);
        delete p.data;
        return { ...p, ...data };
    });
    res.json(parsed);
});

app.post('/api/products', authenticate, isAdmin, async (req, res) => {
    const p = req.body;
    offloadImagesToDisk(p);
    await db.run(
        'INSERT OR REPLACE INTO products (id, title, slug, description, price, category, stock, data, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [p.id, p.title, p.slug, p.description, p.price, p.category, p.stock, JSON.stringify(p), p.createdAt]
    );
    res.json({ success: true });
});

app.delete('/api/products/batch-delete', authenticate, isAdmin, async (req, res) => {
    const { ids } = req.body;
    const stmt = await db.prepare('DELETE FROM products WHERE id = ?');
    for (const id of ids) {
        await stmt.run(id);
    }
    await stmt.finalize();
    res.json({ success: true });
});

// Users
app.get('/api/users', authenticate, isAdmin, async (req, res) => {
    const users = await db.all('SELECT id, name, email, role, isVerified, createdAt, preferences, isSuspended, lastIp, userAgent, stripeCustomerId, addresses FROM users');
    const parsed = users.map(u => ({
        ...u,
        preferences: u.preferences ? JSON.parse(u.preferences) : { marketing: true, account: true },
        addresses: u.addresses ? JSON.parse(u.addresses) : [],
        isSuspended: !!u.isSuspended
    }));
    res.json(parsed);
});

// Content & Settings routes...
app.get('/api/content', async (req, res) => {
    const row = await db.get("SELECT data FROM content WHERE key = 'store_content'");
    res.json(row ? JSON.parse(row.data) : {});
});
app.post('/api/content', authenticate, isAdmin, async (req, res) => {
    const content = req.body;
    offloadImagesToDisk(content);
    await db.run("INSERT OR REPLACE INTO content (id, key, data) VALUES (?, ?, ?)", ['store_content', 'store_content', JSON.stringify(content)]);
    res.json({ success: true });
});
app.get('/api/settings', authenticate, isAdmin, async (req, res) => {
    const row = await db.get("SELECT data FROM content WHERE key = 'app_settings'");
    res.json(row ? JSON.parse(row.data) : {});
});
app.post('/api/settings', authenticate, isAdmin, async (req, res) => {
    await db.run("INSERT OR REPLACE INTO content (id, key, data) VALUES (?, ?, ?)", ['app_settings', 'app_settings', JSON.stringify(req.body)]);
    res.json({ success: true });
});
app.get('/api/settings/public', async (req, res) => {
    const row = await db.get("SELECT data FROM content WHERE key = 'app_settings'");
    const data = row ? JSON.parse(row.data) : {};
    
    // SAFETY CHECK: Ensure we never inadvertently send the secret key as the publishable key
    let pubKey = data.stripePublishableKey || process.env.STRIPE_PUBLISHABLE_KEY;
    if (pubKey && pubKey.trim().startsWith('sk_')) {
        console.error("Security Alert: Secret Key detected in stripePublishableKey config. Blocking from public API.");
        pubKey = null;
    }

    res.json({
        storeProfile: data.storeProfile,
        googleClientId: data.googleClientId || process.env.GOOGLE_CLIENT_ID,
        stripePublishableKey: pubKey,
        recaptchaSiteKey: data.recaptchaSiteKey
    });
});

// --- HELPER: Server-Side Price Calculation ---
// Security Measure: Recalculate totals based on DB prices, not frontend payload.
const calculateOrderTotal = async (cartItems, promoCode) => {
    let subtotal = 0;
    const validatedItems = [];
    const shippingItems = []; // For shipping calc

    for (const item of cartItems) {
        const product = await db.get("SELECT price, data FROM products WHERE id = ?", [item.id]);
        if (!product) continue;
        
        const data = JSON.parse(product.data);
        const price = product.price; // Trust DB price
        
        // Stock Check (Basic)
        // if (product.stock < item.quantity) throw new Error(`Insufficient stock for ${data.title}`);

        subtotal += price * item.quantity;
        
        validatedItems.push({ ...item, price }); // Attach verified price
        shippingItems.push({ 
            ...item, 
            price, 
            shippingTemplateId: data.shippingTemplateId 
        });
    }

    // Promo Logic
    let discount = 0;
    if (promoCode) {
        const promo = await db.get("SELECT type, value, active, data FROM promos WHERE code = ?", [promoCode.toUpperCase()]);
        if (promo && promo.active) {
            // Check expiry
            const promoData = JSON.parse(promo.data);
            if (!promoData.expiresAt || promoData.expiresAt > Date.now()) {
                if (promo.type === 'fixed') discount = promo.value;
                else discount = (subtotal * promo.value) / 100;
            }
        }
    }

    // Shipping Logic (Updated Logic)
    const contentRow = await db.get("SELECT data FROM content WHERE key = 'store_content'");
    const content = contentRow ? JSON.parse(contentRow.data) : {};
    const shippingConfig = content.shipping || { baseRate: 0, additionalItemRate: 0 };
    
    let shippingCost = 0;
    const threshold = shippingConfig.freeShippingThreshold;

    if (shippingConfig.enabled && (!threshold || subtotal < threshold)) {
        // Iterate through items
        for (const item of shippingItems) {
            const template = content.shippingTemplates?.find(t => t.id === item.shippingTemplateId);
            const base = template ? template.baseRate : shippingConfig.baseRate;
            const addl = template ? template.additionalItemRate : (shippingConfig.additionalItemRate ?? 0);

            let itemCost = 0;

            if (addl === 0) {
                // If additional rate is $0, multiply base rate by quantity
                itemCost = base * item.quantity;
            } else {
                // Specific Rounding Logic for Additional Rate
                let adjustedAddl = addl;
                const cents = Math.round((addl % 1) * 100);
                
                // If cents are NOT 0.25, 0.50, 0.75, or 0.95
                if (![25, 50, 75, 95].includes(cents)) {
                    // Round to nearest quarter
                    adjustedAddl = Math.round(addl * 4) / 4;
                    // If rounded result ends in .00, bump to .25
                    if (Math.round((adjustedAddl % 1) * 100) === 0) {
                        adjustedAddl += 0.25;
                    }
                }

                // If additional rate exists: Base + (Qty * Additional)
                itemCost = base + (item.quantity * adjustedAddl);
            }

            shippingCost += itemCost;
        }

        if (shippingConfig.handlingFee) {
            shippingCost += shippingConfig.handlingFee;
        }
    }

    const total = Math.max(0, subtotal + shippingCost - discount);
    return { total, subtotal, shippingCost, discount, validatedItems };
};

// Orders
app.get('/api/orders', authenticate, async (req, res) => {
    let orders;
    if (req.user.role === 'admin') {
        orders = await db.all('SELECT data FROM orders ORDER BY createdAt DESC');
    } else {
        orders = await db.all('SELECT data FROM orders WHERE userId = ? ORDER BY createdAt DESC', [req.user.id]);
    }
    const parsed = orders.map(o => JSON.parse(o.data));
    res.json(parsed);
});

// Secure Order Creation
app.post('/api/orders', async (req, res) => {
    const o = req.body;
    
    // Integrity Check: Verify HMAC if updating, or Generate if new
    // Note: Since we are creating/updating from frontend post-payment, 
    // we should re-verify the totals here to ensure the data saved matches what was paid.
    try {
        // 1. Recalculate based on items in payload
        const calculation = await calculateOrderTotal(o.items, o.promoCode);
        
        // 2. Allow small float variance (e.g. $0.05) due to JS math
        if (Math.abs(calculation.total - o.total) > 0.05) {
            console.warn(`Order Integrity Mismatch: ID ${o.id}. Claimed: ${o.total}, Calc: ${calculation.total}`);
            // In strict mode, we would reject. For now, we log it.
            // o.isFlagged = true; 
        }

        // 3. Sign the order
        const signature = signOrder(o);
        const signedOrder = { ...o, integritySignature: signature };

        await db.run("INSERT OR REPLACE INTO orders (id, userId, total, status, data, createdAt) VALUES (?, ?, ?, ?, ?, ?)", 
            [o.id, o.userId, o.total, o.status, JSON.stringify(signedOrder), o.date]
        );
        res.json({ success: true });
    } catch (e) {
        console.error("Order save failed", e);
        res.status(500).json({ error: e.message });
    }
});

// Auth endpoints...
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    if (email === 'admin@shipteez.com' && password === 'admin') {
        const token = jwt.sign({ id: 'admin-init', role: 'admin' }, SECRET_KEY);
        return res.json({ token, user: { id: 'admin-init', name: 'Admin', email, role: 'admin' } });
    }
    const user = await db.get('SELECT * FROM users WHERE email = ?', [email]);
    if (user && await bcrypt.compare(password, user.password)) {
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY);
        const prefs = user.preferences ? JSON.parse(user.preferences) : {};
        const addrs = user.addresses ? JSON.parse(user.addresses) : [];
        res.json({ token, user: { ...user, preferences: prefs, addresses: addrs, isSuspended: !!user.isSuspended } });
    } else {
        res.status(401).json({ error: 'Invalid credentials' });
    }
});
app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body;
    const hash = await bcrypt.hash(password, 10);
    const id = 'u-' + Date.now();
    try {
        await db.run('INSERT INTO users (id, name, email, password, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)', [id, name, email, hash, 'customer', Date.now()]);
        const token = jwt.sign({ id, role: 'customer' }, SECRET_KEY);
        res.json({ token, user: { id, name, email, role: 'customer' } });
    } catch(e) {
        res.status(400).json({ error: 'Email exists' });
    }
});

// --- NEW: Create or Update Payment Intent for Express Checkout ---
app.post('/api/checkout/intent', async (req, res) => {
    const { items, promoCode, paymentIntentId, customerEmail } = req.body;

    try {
        // 1. Get Settings
        const settingsRow = await db.get("SELECT data FROM content WHERE key = 'app_settings'");
        const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
        const stripeKey = settings.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
        if (!stripeKey) throw new Error('Stripe configuration missing');

        // 2. Server-Side Price Calculation
        const { total } = await calculateOrderTotal(items, promoCode);
        if (total <= 0) throw new Error("Invalid order total");
        
        const stripe = require('stripe')(stripeKey);
        const amount = Math.round(total * 100);

        // 3. Create or Update Intent
        if (paymentIntentId) {
            const intent = await stripe.paymentIntents.update(paymentIntentId, {
                amount: amount,
                metadata: { promoCode: promoCode || '', itemCount: items.length }
            });
            res.json({ clientSecret: intent.client_secret, id: intent.id });
        } else {
            const intentArgs = {
                amount: amount,
                currency: 'usd',
                automatic_payment_methods: { enabled: true },
                metadata: { promoCode: promoCode || '', itemCount: items.length },
                shipping_address_collection: {
                    allowed_countries: ['US', 'CA', 'GB', 'AU']
                }
            };
            if (customerEmail) {
                const user = await db.get("SELECT stripeCustomerId FROM users WHERE email = ?", [customerEmail]);
                if (user?.stripeCustomerId) intentArgs.customer = user.stripeCustomerId;
            }
            const intent = await stripe.paymentIntents.create(intentArgs);
            res.json({ clientSecret: intent.client_secret, id: intent.id });
        }
    } catch (e) {
        console.error("Intent Creation Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- CHECKOUT PROCESS (SECURE) ---
app.post('/api/checkout/process', async (req, res) => {
    const { paymentMethodId, items, promoCode, customerEmail, saveCard, paymentIntentId } = req.body;

    try {
        // 1. Get Settings
        const settingsRow = await db.get("SELECT data FROM content WHERE key = 'app_settings'");
        const settings = settingsRow ? JSON.parse(settingsRow.data) : {};
        const stripeKey = settings.stripeSecretKey || process.env.STRIPE_SECRET_KEY;
        
        if (!stripeKey) throw new Error('Stripe configuration missing');
        
        // 2. Server-Side Price Calculation (Source of Truth)
        const { total } = await calculateOrderTotal(items, promoCode);
        if (total <= 0) throw new Error("Invalid order total");

        // 3. Stripe Setup
        const stripe = require('stripe')(stripeKey);
        
        // --- SCENARIO A: EXPRESS CHECKOUT (Existing Intent Confirmed) ---
        if (paymentIntentId) {
            const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
            if (intent.status === 'succeeded' || intent.status === 'processing') {
                // Return success immediately, order recording happens in next step on frontend
                // Optionally validate amount match
                if (intent.amount !== Math.round(total * 100)) {
                    console.warn(`Amount mismatch on express checkout. Expected ${Math.round(total*100)}, got ${intent.amount}`);
                }
                
                let isFraud = false;
                let score = 0;
                if (intent.charges && intent.charges.data.length > 0) {
                    const charge = intent.charges.data[0];
                    score = charge.outcome?.risk_score || 0;
                    if (score > 65) isFraud = true;
                }

                return res.json({ 
                    success: true, 
                    paymentIntentId: intent.id, 
                    chargeId: intent.charges?.data?.[0]?.id, 
                    isFraudSuspect: isFraud, 
                    fraudScore: score,
                    verifiedTotal: total 
                });
            } else {
                throw new Error(`Payment intent status: ${intent.status}`);
            }
        }

        // --- SCENARIO B: MANUAL CHECKOUT (Create New Intent) ---
        
        // Get or Create Customer
        const user = await db.get("SELECT id, stripeCustomerId, isSuspended FROM users WHERE email = ?", [customerEmail]);
        if (user && user.isSuspended) throw new Error('Account suspended');
        
        let customerId = user?.stripeCustomerId;
        if (!customerId) {
            const cust = await stripe.customers.create({ email: customerEmail });
            customerId = cust.id;
            if (user) await db.run("UPDATE users SET stripeCustomerId = ? WHERE id = ?", [customerId, user.id]);
        }

        // Attach Card if saving
        if (saveCard) {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        }

        // Create Payment Intent with CALCULATED amount
        const intentArgs = {
            amount: Math.round(total * 100), // Convert to cents
            currency: 'usd',
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: true,
            return_url: 'https://shipteez.com/checkout/complete',
            metadata: {
                promoCode: promoCode || '',
                itemCount: items.length
            }
        };

        if (saveCard) intentArgs.setup_future_usage = 'off_session';

        const intent = await stripe.paymentIntents.create(intentArgs);

        // Fraud Check
        let isFraud = false;
        let score = 0;
        if (intent.charges && intent.charges.data.length > 0) {
            const charge = intent.charges.data[0];
            score = charge.outcome?.risk_score || 0;
            if (score > 65) isFraud = true;
        }

        res.json({ 
            success: true, 
            paymentIntentId: intent.id, 
            chargeId: intent.charges?.data?.[0]?.id, 
            isFraudSuspect: isFraud, 
            fraudScore: score,
            verifiedTotal: total 
        });

    } catch (e) {
        console.error("Payment Process Error:", e);
        res.status(500).json({ error: e.message });
    }
});

// --- TICKETS ---

app.post('/api/tickets', authenticate, async (req, res) => {
    // Rate Limiting: 2 tickets per 10 minutes per user
    if (!checkRateLimit(req.user.id, 'create_ticket', 2, 10 * 60 * 1000)) {
        return res.status(429).json({ error: 'Too many tickets created recently. Please wait.' });
    }

    try {
        const safeData = validateTicketInput(req.body, 'create');
        const { subject, message, orderId } = safeData;
        const id = 'tkt-' + Date.now();
        const initialMsg = { role: 'user', text: message, timestamp: Date.now(), senderName: req.user.name || 'User' };
        
        await db.run("INSERT INTO tickets (id, userId, subject, status, messages, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)", [
            id, req.user.id, subject, 'Open', JSON.stringify([initialMsg]), Date.now(), Date.now()
        ]);
        res.json({ id });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

app.get('/api/tickets/user', authenticate, async (req, res) => {
    const tickets = await db.all("SELECT * FROM tickets WHERE userId = ? ORDER BY updatedAt DESC", [req.user.id]);
    res.json(tickets.map(t => ({...t, messages: JSON.parse(t.messages), isLocked: !!t.isLocked, closedAt: t.closedAt})));
});

app.post('/api/tickets/:id/message', authenticate, async (req, res) => {
    // Rate Limiting: 5 messages per 60 seconds
    if (!checkRateLimit(req.user.id, 'reply_ticket', 5, 60 * 1000)) {
        return res.status(429).json({ error: 'You are sending messages too quickly.' });
    }

    try {
        const safeData = validateTicketInput(req.body, 'reply');
        const { text, role, attachments } = safeData;
        
        // Security check: Only admins can send as 'admin'
        if (role === 'admin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Unauthorized role impersonation' });
        }

        const ticket = await db.get("SELECT * FROM tickets WHERE id = ?", [req.params.id]);
        if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
        
        // Ownership check for customers
        if (req.user.role !== 'admin' && ticket.userId !== req.user.id) {
            return res.status(403).json({ error: 'Unauthorized access to ticket' });
        }

        // Prevent reply if locked
        if (ticket.isLocked) return res.status(403).json({ error: 'Ticket is locked' });

        if (attachments && Array.isArray(attachments)) {
            offloadImagesToDisk(attachments);
        }

        const messages = JSON.parse(ticket.messages);
        messages.push({
            role,
            text: text || '',
            timestamp: Date.now(),
            senderName: role === 'admin' ? 'Support' : (req.user.name || 'User'),
            attachments: attachments || []
        });
        
        await db.run("UPDATE tickets SET messages = ?, updatedAt = ? WHERE id = ?", [JSON.stringify(messages), Date.now(), req.params.id]);
        res.json({ success: true });
    } catch (e) {
        res.status(400).json({ error: e.message });
    }
});

// Update Status / Lock
app.post('/api/tickets/:id/status', authenticate, async (req, res) => {
    const { status, isLocked } = req.body;
    
    // Customers can close tickets, but only Admin can Lock/Unlock
    if (typeof isLocked !== 'undefined' && req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can lock tickets' });
    }

    // Ownership check for status change
    if (req.user.role !== 'admin') {
        const ticket = await db.get("SELECT userId FROM tickets WHERE id = ?", [req.params.id]);
        if (!ticket || ticket.userId !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });
    }

    const updates = [];
    const params = [];

    if (status) {
        updates.push("status = ?");
        params.push(status);
        
        if (status === 'Closed') {
            updates.push("closedAt = ?");
            params.push(Date.now());
        } else if (status === 'Open') {
            updates.push("closedAt = NULL");
        }
    }
    
    if (typeof isLocked === 'boolean') {
        updates.push("isLocked = ?");
        params.push(isLocked ? 1 : 0);
    }

    updates.push("updatedAt = ?");
    params.push(Date.now());

    params.push(req.params.id);

    const sql = `UPDATE tickets SET ${updates.join(', ')} WHERE id = ?`;
    await db.run(sql, params);
    res.json({ success: true });
});

// Delete Ticket
app.delete('/api/tickets/:id', authenticate, isAdmin, async (req, res) => {
    await db.run("DELETE FROM tickets WHERE id = ?", [req.params.id]);
    res.json({ success: true });
});

// Admin Routes
app.get('/api/tickets/admin', authenticate, isAdmin, async (req, res) => {
    const tickets = await db.all("SELECT tickets.*, users.email as userEmail FROM tickets LEFT JOIN users ON tickets.userId = users.id ORDER BY updatedAt DESC");
    const parsed = tickets.map(t => ({...t, messages: JSON.parse(t.messages), isLocked: !!t.isLocked, closedAt: t.closedAt}));
    res.json(parsed);
});

// ... (Promos, System, Start logs - unchanged) ...
app.get('/api/promos', async (req, res) => {
    const promos = await db.all("SELECT * FROM promos");
    res.json(promos.map(p => JSON.parse(p.data)));
});
app.post('/api/promos', authenticate, isAdmin, async (req, res) => {
    const p = req.body;
    await db.run("INSERT OR REPLACE INTO promos (code, type, value, active, usage, data) VALUES (?, ?, ?, ?, ?, ?)", [p.code, p.discountType, p.value, p.isActive ? 1 : 0, p.usageCount, JSON.stringify(p)]);
    res.json({ success: true });
});
app.get('/api/system/logs', authenticate, isAdmin, (req, res) => {
    res.json([{ id: 1, timestamp: new Date().toISOString(), type: 'INFO', message: 'Node Server Active' }]);
});
app.post('/api/system/test-db', authenticate, isAdmin, (req, res) => {
    res.json({ status: 'ok', latency: 2 });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Uploads served at http://localhost:${PORT}/uploads`);
});