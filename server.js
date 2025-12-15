
// ... existing code ...
const isAdmin = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.sendStatus(403);
    }
};

// ... (Product, User, Content, Settings routes remain same) ...

// Products List
app.get('/api/products', async (req, res) => {
    if (req.query.mode === 'ids') {
        try {
            const rows = await db.all('SELECT id FROM products ORDER BY createdAt DESC');
            return res.json(rows.map(r => r.id));
        } catch (e) {
            return res.status(500).json({ error: e.message });
        }
    }

    const products = await db.all('SELECT * FROM products ORDER BY createdAt DESC');
    const parsed = products.map(p => {
        const data = JSON.parse(p.data);
        delete p.data;
        return { ...p, ...data };
    });
    res.json(parsed);
});

// Categories (MUST be defined before /:id)
app.get('/api/products/categories', async (req, res) => {
    try {
        const rows = await db.all("SELECT DISTINCT category FROM products");
        const categories = rows.map(r => r.category).filter(c => c);
        res.json(categories);
    } catch (e) {
        console.error("Categories fetch failed", e);
        res.status(500).json({ error: e.message });
    }
});

// Single Product Detail
app.get('/api/products/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const product = await db.get("SELECT * FROM products WHERE id = ? OR slug = ?", [id, id]);
        if (!product) return res.status(404).json({ error: 'Not found' });
        
        const data = JSON.parse(product.data);
        delete product.data;
        res.json({ ...product, ...data });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/products', authenticate, isAdmin, async (req, res) => {
    const p = req.body;
// ... existing code ...
