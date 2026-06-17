const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const bcrypt = require('bcryptjs');

// ===== Страница регистрации =====
router.get('/register', (req, res) => {
    if (req.session.userId) return res.redirect('/account');
    res.render('register', {
        error: null,
        errors: [],
        formData: {},
        page: 'register'
    });
});

// ===== Обработка регистрации =====
router.post('/register', async (req, res) => {
    const { email, password, password_confirm, first_name, last_name, phone } = req.body;

    const errors = [];

    if (!email || !email.includes('@') || !email.includes('.')) {
        errors.push('Введите корректный email');
    }
    if (!password || password.length < 6) {
        errors.push('Пароль должен быть не менее 6 символов');
    }
    if (password !== password_confirm) {
        errors.push('Пароли не совпадают');
    }
    if (!first_name || !first_name.trim()) {
        errors.push('Введите имя');
    }

    if (errors.length > 0) {
        return res.render('register', {
            error: null,
            errors,
            formData: req.body,
            page: 'register'
        });
    }

    try {
        // Проверяем что email не занят
        const existing = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (existing.rows.length > 0) {
            return res.render('register', {
                error: 'Пользователь с таким email уже зарегистрирован',
                errors: [],
                formData: req.body,
                page: 'register'
            });
        }

        // Хешируем пароль
        const hash = await bcrypt.hash(password, 12);

        // Создаём пользователя
        const result = await pool.query(`
            INSERT INTO users (email, password_hash, first_name, last_name, phone)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id
        `, [
            email.trim().toLowerCase(),
            hash,
            first_name.trim(),
            (last_name || '').trim(),
            (phone || '').trim()
        ]);

        const userId = result.rows[0].id;

        // Сразу авторизуем
        req.session.regenerate(function (err) {
            if (err) {
                console.error(err);
                return res.redirect('/login');
            }

            req.session.userId = userId;
            req.session.userEmail = email.trim().toLowerCase();
            req.session.userName = first_name.trim();

            // Переносим корзину из сессии в БД
            transferSessionCartToDB(req, userId, function () {
                res.redirect('/account');
            });
        });

    } catch (err) {
        console.error('Ошибка регистрации:', err);
        res.render('register', {
            error: 'Произошла ошибка. Попробуйте позже.',
            errors: [],
            formData: req.body,
            page: 'register'
        });
    }
});

// ===== Страница входа =====
router.get('/login', (req, res) => {
    if (req.session.userId) return res.redirect('/account');
    res.render('user-login', {
        error: null,
        errors: [],
        formData: {},
        page: 'login'
    });
});

// ===== Обработка входа =====
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.render('user-login', {
            error: 'Заполните все поля',
            errors: [],
            formData: req.body,
            page: 'login'
        });
    }

    // Задержка от перебора паролей
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );

        if (result.rows.length === 0) {
            return res.render('user-login', {
                error: 'Неверный email или пароль',
                errors: [],
                formData: req.body,
                page: 'login'
            });
        }

        const user = result.rows[0];
        const valid = await bcrypt.compare(password, user.password_hash);

        if (!valid) {
            return res.render('user-login', {
                error: 'Неверный email или пароль',
                errors: [],
                formData: req.body,
                page: 'login'
            });
        }

        req.session.regenerate(function (err) {
            if (err) {
                console.error(err);
                return res.redirect('/login');
            }

            req.session.userId = user.id;
            req.session.userEmail = user.email;
            req.session.userName = user.first_name;

            // Переносим корзину из сессии в БД
            transferSessionCartToDB(req, user.id, function () {
                res.redirect('/account');
            });
        });

    } catch (err) {
        console.error('Ошибка входа:', err);
        res.render('user-login', {
            error: 'Произошла ошибка. Попробуйте позже.',
            errors: [],
            formData: req.body,
            page: 'login'
        });
    }
});

// ===== Выход =====
router.get('/logout', (req, res) => {
    req.session.destroy(function () {
        res.redirect('/');
    });
});

// ===== Личный кабинет =====
router.get('/account', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    try {
        const userResult = await pool.query(
            'SELECT * FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (userResult.rows.length === 0) {
            req.session.destroy(function () {
                return res.redirect('/login');
            });
            return;
        }

        const user = userResult.rows[0];

        // Заказы пользователя
        const ordersResult = await pool.query(
            'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
            [req.session.userId]
        );

        // Подгружаем позиции для каждого заказа
        for (const order of ordersResult.rows) {
            const items = await pool.query(
                'SELECT * FROM order_items WHERE order_id = $1',
                [order.id]
            );
            order.items = items.rows;
        }

        const statusNames = {
            'new': 'Новый',
            'confirmed': 'Подтверждён',
            'paid': 'Оплачен',
            'shipped': 'Отправлен',
            'delivered': 'Доставлен',
            'cancelled': 'Отменён'
        };

        res.render('account', {
            user,
            orders: ordersResult.rows,
            statusNames,
            errors: [],
            success: req.query.saved === '1' ? 'Данные сохранены' : null,
            page: 'account'
        });

    } catch (err) {
        console.error('Ошибка аккаунта:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== Обновление профиля =====
router.post('/account', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    const { first_name, last_name, phone, address } = req.body;

    try {
        await pool.query(`
            UPDATE users SET
                first_name = $1, last_name = $2,
                phone = $3, address = $4, updated_at = NOW()
            WHERE id = $5
        `, [
            (first_name || '').trim(),
            (last_name || '').trim(),
            (phone || '').trim(),
            (address || '').trim(),
            req.session.userId
        ]);

        req.session.userName = (first_name || '').trim();
        res.redirect('/account?saved=1');

    } catch (err) {
        console.error('Ошибка обновления профиля:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== Смена пароля =====
router.post('/account/password', async (req, res) => {
    if (!req.session.userId) return res.redirect('/login');

    const { current_password, new_password, new_password_confirm } = req.body;

    try {
        const userResult = await pool.query(
            'SELECT password_hash FROM users WHERE id = $1',
            [req.session.userId]
        );

        if (userResult.rows.length === 0) {
            return res.redirect('/login');
        }

        const valid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);

        if (!valid) {
            return res.redirect('/account?error=wrong_password');
        }

        if (!new_password || new_password.length < 6) {
            return res.redirect('/account?error=short_password');
        }

        if (new_password !== new_password_confirm) {
            return res.redirect('/account?error=mismatch');
        }

        const hash = await bcrypt.hash(new_password, 12);
        await pool.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
            [hash, req.session.userId]
        );

        res.redirect('/account?saved=1');

    } catch (err) {
        console.error('Ошибка смены пароля:', err);
        res.status(500).send('Ошибка сервера');
    }
});

// ===== Перенос корзины из сессии в БД =====
function transferSessionCartToDB(req, userId, callback) {
    const sessionCart = req.session.cart || [];

    if (sessionCart.length === 0) {
        return callback();
    }

    const promises = sessionCart.map(function (item) {
        return pool.query(`
            INSERT INTO cart_items (user_id, product_id, size, quantity)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (user_id, product_id, size)
            DO UPDATE SET quantity = cart_items.quantity + $4
        `, [userId, item.productId, item.size || '', item.quantity]);
    });

    Promise.all(promises)
        .then(function () {
            req.session.cart = [];
            callback();
        })
        .catch(function (err) {
            console.error('Ошибка переноса корзины:', err);
            callback();
        });
}

module.exports = router;