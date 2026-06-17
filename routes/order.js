const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { generateOrderNumber } = require('../utils/helpers');
const cartModule = require('./cart');

// ===== Страница оформления =====
router.get('/checkout', async (req, res) => {
    try {
        const { items, total } = await cartModule.getCartItems(req);

        if (items.length === 0) {
            return res.redirect('/cart');
        }

        // Если авторизован — заполняем поля из профиля
        var formData = {};
        if (req.session.userId) {
            const userResult = await pool.query(
                'SELECT * FROM users WHERE id = $1',
                [req.session.userId]
            );
            if (userResult.rows.length > 0) {
                var user = userResult.rows[0];
                formData = {
                    name: (user.first_name + ' ' + user.last_name).trim(),
                    email: user.email,
                    phone: user.phone,
                    address: user.address
                };
            }
        }

        res.render('checkout', {
            cartItems: items,
            total: total,
            formData: formData,
            errors: [],
            page: 'checkout'
        });
    } catch (err) {
        console.error('Ошибка checkout:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== Создание заказа =====
router.post('/checkout', async (req, res) => {
    try {
        const { items, total } = await cartModule.getCartItems(req);

        if (items.length === 0) {
            return res.redirect('/cart');
        }

        const {
            name, email, phone, address,
            delivery_method, payment_method, comment,
            agree_offer, agree_privacy
        } = req.body;

        // Валидация
        var errors = [];
        if (!name || !name.trim()) errors.push('Укажите имя');
        if (!email || !email.includes('@')) errors.push('Укажите корректный email');
        if (!phone || !phone.trim()) errors.push('Укажите телефон');
        if (!address || !address.trim()) errors.push('Укажите адрес доставки');
        if (agree_offer !== 'on') errors.push('Необходимо согласие с публичной офертой');
        if (agree_privacy !== 'on') errors.push('Необходимо согласие с политикой конфиденциальности');

        if (errors.length > 0) {
            return res.render('checkout', {
                cartItems: items,
                total: total,
                formData: req.body,
                errors: errors,
                page: 'checkout'
            });
        }

        // Создаём заказ в транзакции
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            var orderNumber = generateOrderNumber();

            const orderResult = await client.query(`
                INSERT INTO orders
                (order_number, user_id, customer_name, customer_email,
                 customer_phone, delivery_address, delivery_method,
                 payment_method, comment, total_price, agree_offer, agree_privacy)
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                RETURNING id
            `, [
                orderNumber,
                req.session.userId || null,
                name.trim(),
                email.trim(),
                phone.trim(),
                address.trim(),
                delivery_method || 'cdek',
                payment_method || 'card',
                comment || '',
                total,
                agree_offer === 'on',
                agree_privacy === 'on'
            ]);

            var orderId = orderResult.rows[0].id;

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                await client.query(`
                    INSERT INTO order_items
                    (order_id, product_id, product_name, size, quantity, price)
                    VALUES ($1,$2,$3,$4,$5,$6)
                `, [
                    orderId,
                    item.product.id,
                    item.product.name,
                    item.size,
                    item.quantity,
                    item.product.price
                ]);
            }

            // Очищаем корзину
            if (req.session.userId) {
                await client.query(
                    'DELETE FROM cart_items WHERE user_id = $1',
                    [req.session.userId]
                );
            }

            await client.query('COMMIT');

            // Очищаем корзину в сессии
            req.session.cart = [];

            res.redirect('/order/success/' + orderNumber);

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (err) {
        console.error('Ошибка заказа:', err);
        res.status(500).send('Ошибка при создании заказа');
    }
});

// ===== Успешный заказ =====
router.get('/order/success/:orderNumber', async (req, res) => {
    try {
        const orderResult = await pool.query(
            'SELECT * FROM orders WHERE order_number = $1',
            [req.params.orderNumber]
        );

        if (orderResult.rows.length === 0) {
            return res.status(404).send('Заказ не найден');
        }

        var order = orderResult.rows[0];
        const itemsResult = await pool.query(
            'SELECT * FROM order_items WHERE order_id = $1',
            [order.id]
        );
        order.items = itemsResult.rows;

        res.render('order-success', { order: order, page: 'success' });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

module.exports = router;