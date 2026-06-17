const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

// ===== Получить корзину (из БД или из сессии) =====
async function getCartItems(req) {
    const items = [];
    let total = 0;

    if (req.session.userId) {
        // Авторизованный — берём из БД
        const result = await pool.query(`
            SELECT ci.id as cart_id, ci.product_id, ci.size, ci.quantity,
                   p.name, p.price, p.slug,
                   (SELECT pi.filename FROM product_images pi
                    WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
            FROM cart_items ci
            JOIN products p ON p.id = ci.product_id
            WHERE ci.user_id = $1
            ORDER BY ci.created_at ASC
        `, [req.session.userId]);

        result.rows.forEach(function (row, index) {
            const subtotal = Number(row.price) * row.quantity;
            total += subtotal;
            items.push({
                cartId: row.cart_id,
                cartIndex: index,
                product: {
                    id: row.product_id,
                    name: row.name,
                    price: row.price,
                    slug: row.slug,
                    main_image: row.main_image
                },
                size: row.size,
                quantity: row.quantity,
                subtotal: subtotal
            });
        });
    } else {
        // Гость — берём из сессии
        const cart = req.session.cart || [];

        for (var i = 0; i < cart.length; i++) {
            const result = await pool.query(`
                SELECT p.*,
                    (SELECT pi.filename FROM product_images pi
                     WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
                FROM products p WHERE p.id = $1
            `, [cart[i].productId]);

            if (result.rows.length > 0) {
                const product = result.rows[0];
                const subtotal = Number(product.price) * cart[i].quantity;
                total += subtotal;
                items.push({
                    cartId: null,
                    cartIndex: i,
                    product: product,
                    size: cart[i].size,
                    quantity: cart[i].quantity,
                    subtotal: subtotal
                });
            }
        }
    }

    return { items, total };
}

// ===== Получить количество товаров в корзине =====
async function getCartCount(req) {
    if (req.session.userId) {
        const result = await pool.query(
            'SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = $1',
            [req.session.userId]
        );
        return parseInt(result.rows[0].count);
    } else {
        const cart = req.session.cart || [];
        return cart.reduce(function (s, i) { return s + i.quantity; }, 0);
    }
}

// ===== Показать корзину =====
router.get('/cart', async (req, res) => {
    try {
        const { items, total } = await getCartItems(req);
        res.render('cart', { cartItems: items, total: total, page: 'cart' });
    } catch (err) {
        console.error('Ошибка корзины:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== Добавить в корзину =====
router.post('/cart/add', async (req, res) => {
    const productId = parseInt(req.body.productId);
    const size = req.body.size || '';
    const quantity = parseInt(req.body.quantity) || 1;

    if (!productId) {
        return res.status(400).json({ error: 'Товар не найден' });
    }

    try {
        // Проверяем что товар существует
        const prodCheck = await pool.query(
            'SELECT id FROM products WHERE id = $1 AND in_stock = true',
            [productId]
        );
        if (prodCheck.rows.length === 0) {
            return res.status(404).json({ error: 'Товар не найден' });
        }

        if (req.session.userId) {
            // Авторизованный — сохраняем в БД
            await pool.query(`
                INSERT INTO cart_items (user_id, product_id, size, quantity)
                VALUES ($1, $2, $3, $4)
                ON CONFLICT (user_id, product_id, size)
                DO UPDATE SET quantity = cart_items.quantity + $4
            `, [req.session.userId, productId, size, quantity]);
        } else {
            // Гость — сохраняем в сессию
            if (!req.session.cart) req.session.cart = [];

            const existing = req.session.cart.find(function (item) {
                return item.productId === productId && item.size === size;
            });

            if (existing) {
                existing.quantity += quantity;
            } else {
                req.session.cart.push({
                    productId: productId,
                    size: size,
                    quantity: quantity
                });
            }
        }

        const cartCount = await getCartCount(req);

        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({ success: true, cartCount: cartCount });
        }
        res.redirect('/cart');

    } catch (err) {
        console.error('Ошибка добавления в корзину:', err);
        res.status(500).json({ error: 'Ошибка сервера' });
    }
});

// ===== Обновить количество =====
router.post('/cart/update', async (req, res) => {
    const quantity = parseInt(req.body.quantity);

    try {
        if (req.session.userId) {
            const cartId = parseInt(req.body.cartId);
            if (quantity > 0) {
                await pool.query(
                    'UPDATE cart_items SET quantity = $1 WHERE id = $2 AND user_id = $3',
                    [quantity, cartId, req.session.userId]
                );
            } else {
                await pool.query(
                    'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
                    [cartId, req.session.userId]
                );
            }
        } else {
            const index = parseInt(req.body.index);
            var cart = req.session.cart || [];
            if (index >= 0 && index < cart.length) {
                if (quantity > 0) {
                    cart[index].quantity = quantity;
                } else {
                    cart.splice(index, 1);
                }
                req.session.cart = cart;
            }
        }

        res.redirect('/cart');

    } catch (err) {
        console.error('Ошибка обновления корзины:', err);
        res.redirect('/cart');
    }
});

// ===== Удалить из корзины =====
router.post('/cart/remove', async (req, res) => {
    try {
        if (req.session.userId) {
            const cartId = parseInt(req.body.cartId);
            await pool.query(
                'DELETE FROM cart_items WHERE id = $1 AND user_id = $2',
                [cartId, req.session.userId]
            );
        } else {
            const index = parseInt(req.body.index);
            var cart = req.session.cart || [];
            if (index >= 0 && index < cart.length) {
                cart.splice(index, 1);
                req.session.cart = cart;
            }
        }

        const cartCount = await getCartCount(req);

        if (req.xhr || req.headers['x-requested-with'] === 'XMLHttpRequest') {
            return res.json({ success: true, cartCount: cartCount });
        }
        res.redirect('/cart');

    } catch (err) {
        console.error('Ошибка удаления из корзины:', err);
        res.redirect('/cart');
    }
});

// ===== Количество в корзине (AJAX) =====
router.get('/cart/count', async (req, res) => {
    try {
        const count = await getCartCount(req);
        res.json({ count: count });
    } catch (err) {
        res.json({ count: 0 });
    }
});

// Экспортируем также вспомогательные функции
module.exports = router;
module.exports.getCartItems = getCartItems;
module.exports.getCartCount = getCartCount;