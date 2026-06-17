const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { requireAdmin } = require('../middleware/auth');
const {
    slugify, deleteImage,
    STATUS_NAMES, CATEGORIES
} = require('../utils/helpers');

// ====================== CLOUDINARY ======================
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ====================== MULTER ======================
const storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: {
        folder: 'ltllmnd',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
        transformation: [{ width: 1200, height: 1200, crop: 'limit', quality: 'auto' }],
    },
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 16 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Разрешены только изображения'), false);
        }
    }
});

// ====================== ЛОГИН ======================
router.get('/admin/login', (req, res) => {
    if (req.session.adminId) return res.redirect('/admin');
    res.render('login', { error: null, page: 'login' });
});

router.post('/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const result = await pool.query('SELECT * FROM admins WHERE username = $1', [username]);

        if (result.rows.length === 0) {
            return res.render('login', { error: 'Неверные учётные данные', page: 'login' });
        }

        const admin = result.rows[0];
        const valid = await bcrypt.compare(password, admin.password_hash);

        if (!valid) {
            return res.render('login', { error: 'Неверные учётные данные', page: 'login' });
        }

        req.session.adminId = admin.id;
        req.session.adminUsername = admin.username;
        res.redirect('/admin');
    } catch (err) {
        console.error(err);
        res.render('login', { error: 'Ошибка сервера', page: 'login' });
    }
});

router.get('/admin/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// ====================== ДАШБОРД ======================
router.get('/admin', requireAdmin, async (req, res) => {
    try {
        const products = await pool.query('SELECT COUNT(*) as c FROM products');
        const orders = await pool.query('SELECT COUNT(*) as c FROM orders');
        const newOrders = await pool.query("SELECT COUNT(*) as c FROM orders WHERE status = 'new'");
        const recent = await pool.query('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');

        res.render('admin/dashboard', {
            totalProducts: products.rows[0].c,
            totalOrders: orders.rows[0].c,
            newOrders: newOrders.rows[0].c,
            recentOrders: recent.rows,
            statusNames: STATUS_NAMES,
            page: 'admin-dashboard'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// ====================== ТОВАРЫ ======================
router.get('/admin/products', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*,
                (SELECT pi.filename FROM product_images pi
                 WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
            FROM products p ORDER BY p.created_at DESC
        `);
        res.render('admin/products', {
            products: result.rows,
            categories: CATEGORIES,
            page: 'admin-products'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

router.get('/admin/products/add', requireAdmin, (req, res) => {
    res.render('admin/product-form', {
        product: null,
        formData: {},
        categories: CATEGORIES,
        page: 'admin-products'
    });
});

router.post('/admin/products/add', requireAdmin, upload.array('images', 10), async (req, res) => {
    try {
        const { name, description, price, old_price, category, sizes, in_stock, featured } = req.body;

        if (!name || !price) {
            return res.render('admin/product-form', {
                product: null,
                formData: req.body,
                categories: CATEGORIES,
                error: 'Название и цена обязательны',
                page: 'admin-products'
            });
        }

        let slug = slugify(name);
        const slugCheck = await pool.query('SELECT id FROM products WHERE slug = $1', [slug]);
        if (slugCheck.rows.length > 0) {
            slug = slug + '-' + Date.now().toString(36);
        }

        const result = await pool.query(`
            INSERT INTO products (name, slug, description, price, old_price, category, sizes, in_stock, featured)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id
        `, [
            name.trim(), slug, description || '', parseFloat(price),
            old_price ? parseFloat(old_price) : null, category || 'other',
            sizes || '', in_stock === 'on', featured === 'on'
        ]);

        const productId = result.rows[0].id;

        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                // Cloudinary автоматически загружает файл и возвращает URL в req.files[i].path
                const imageUrl = req.files[i].path;
                await pool.query(
                    'INSERT INTO product_images (product_id, filename, is_main) VALUES ($1, $2, $3)',
                    [productId, imageUrl, i === 0]
                );
            }
        }

        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при добавлении товара');
    }
});

// Редактирование товара
router.get('/admin/products/edit/:id', requireAdmin, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM products WHERE id = $1', [req.params.id]);
        if (result.rows.length === 0) return res.redirect('/admin/products');

        const product = result.rows[0];
        const images = await pool.query(
            'SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_main DESC, id',
            [product.id]
        );
        product.images = images.rows;

        res.render('admin/product-form', {
            product,
            formData: {},
            categories: CATEGORIES,
            page: 'admin-products'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/admin/products/edit/:id', requireAdmin, upload.array('images', 10), async (req, res) => {
    try {
        const {
            name, description, price, old_price, category, sizes,
            in_stock, featured, main_image_id, delete_images
        } = req.body;

        await pool.query(`
            UPDATE products SET
                name = $1, description = $2, price = $3,
                old_price = $4, category = $5, sizes = $6,
                in_stock = $7, featured = $8, updated_at = NOW()
            WHERE id = $9
        `, [
            name.trim(), description || '', parseFloat(price),
            old_price ? parseFloat(old_price) : null, category || 'other',
            sizes || '', in_stock === 'on', featured === 'on', req.params.id
        ]);

        if (main_image_id) {
            await pool.query('UPDATE product_images SET is_main = false WHERE product_id = $1', [req.params.id]);
            await pool.query(
                'UPDATE product_images SET is_main = true WHERE id = $1 AND product_id = $2',
                [main_image_id, req.params.id]
            );
        }

        if (delete_images) {
            const ids = Array.isArray(delete_images) ? delete_images : [delete_images];
            for (const imgId of ids) {
                const img = await pool.query(
                    'SELECT filename FROM product_images WHERE id = $1 AND product_id = $2',
                    [imgId, req.params.id]
                );
                if (img.rows.length > 0) {
                    // Удаление картинки из Cloudinary по URL
                    await deleteImage(img.rows[0].filename);
                    await pool.query('DELETE FROM product_images WHERE id = $1', [imgId]);
                }
            }
        }

        if (req.files && req.files.length > 0) {
            const existingCount = await pool.query(
                'SELECT COUNT(*) as c FROM product_images WHERE product_id = $1',
                [req.params.id]
            );
            for (let i = 0; i < req.files.length; i++) {
                const imageUrl = req.files[i].path;
                await pool.query(
                    'INSERT INTO product_images (product_id, filename, is_main) VALUES ($1, $2, $3)',
                    [req.params.id, imageUrl, parseInt(existingCount.rows[0].c) === 0 && i === 0]
                );
            }
        }

        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при обновлении товара');
    }
});

router.post('/admin/products/delete/:id', requireAdmin, async (req, res) => {
    try {
        const images = await pool.query('SELECT filename FROM product_images WHERE product_id = $1', [req.params.id]);
        for (const img of images.rows) {
            await deleteImage(img.filename);
        }
        await pool.query('DELETE FROM products WHERE id = $1', [req.params.id]);
        res.redirect('/admin/products');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка');
    }
});

// ====================== ЗАКАЗЫ ======================
router.get('/admin/orders', requireAdmin, async (req, res) => {
    try {
        const statusFilter = req.query.status || '';
        let query = `SELECT * FROM orders ORDER BY created_at DESC`;
        let params = [];

        if (statusFilter) {
            query = `SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC`;
            params = [statusFilter];
        }

        const result = await pool.query(query, params);

        for (const order of result.rows) {
            const items = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id]);
            order.items = items.rows;
        }

        res.render('admin/orders', {
            orders: result.rows,
            statusFilter,
            statusNames: STATUS_NAMES,
            currentStatus: statusFilter,
            page: 'admin-orders'
        });
    } catch (err) {
        console.error('Ошибка загрузки заказов:', err);
        res.status(500).send('Ошибка сервера');
    }
});

router.post('/admin/orders/:id/status', requireAdmin, async (req, res) => {
    const { status } = req.body;
    const orderId = req.params.id;

    const allowedStatuses = ['new', 'confirmed', 'paid', 'shipped', 'delivered', 'cancelled'];

    if (!allowedStatuses.includes(status)) {
        return res.status(400).send('Недопустимый статус');
    }

    try {
        await pool.query(`UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2`, [status, orderId]);
        console.log(`Статус заказа #${orderId} изменён на ${status}`);
        res.redirect('/admin/orders');
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка при изменении статуса');
    }
});

// Просмотр деталей одного заказа
router.get('/admin/orders/:id', requireAdmin, async (req, res) => {
    try {
        const orderResult = await pool.query(
            'SELECT * FROM orders WHERE id = $1', 
            [req.params.id]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).send('Заказ не найден');
        }

        const order = orderResult.rows[0];

        const itemsResult = await pool.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [order.id]
        );

        order.items = itemsResult.rows;

        res.render('admin/order-detail', {
            order: order,
            statusNames: STATUS_NAMES,
            page: 'admin-order-detail'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// ====================== ЭКСПОРТ ======================
module.exports = router;