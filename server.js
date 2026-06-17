require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const pool = require('./db/pool');
const { formatPrice } = require('./utils/helpers');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Сессия
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        errorLog: console.error
    }),
    secret: 'ltllmnd-super-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    name: 'ltllmnd.sid',
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        sameSite: 'lax'
    }
}));

// Простой CSRF-заглушка (чтобы не падал сервер)
app.use((req, res, next) => {
    res.locals.csrfToken = 'dummy-token';
    next();
});

// Security
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// Глобальные переменные
app.use(async (req, res, next) => {
    let cartCount = 0;
    if (req.session?.userId) {
        try {
            const result = await pool.query(
                'SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = $1',
                [req.session.userId]
            );
            cartCount = parseInt(result.rows[0]?.count || 0);
        } catch (e) {}
    } else {
        const cart = req.session.cart || [];
        cartCount = cart.reduce((sum, item) => sum + (item.quantity || 0), 0);
    }

    res.locals.cartCount = cartCount;
    res.locals.formatPrice = formatPrice;
    res.locals.currentPath = req.path;
    res.locals.adminUser = req.session?.adminUsername || null;
    res.locals.currentUser = req.session?.userId ? {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName
    } : null;

    next();
});

// Создание папок
const uploadDir = path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(path.join(uploadDir, 'temp'), { recursive: true });

// ====================== ЗАГРУЗКА МАРШРУТОВ ======================
const routes = [
    './routes/main',
    './routes/product',
    './routes/cart',
    './routes/order',
    './routes/auth',
    './routes/admin',
    './routes/pages'
];

routes.forEach(routePath => {
    try {
        const route = require(routePath);
        if (route && typeof route === 'function') {
            app.use(route);
            console.log(`✓ Подключён маршрут: ${routePath}`);
        } else {
            console.error(`✗ Ошибка: ${routePath} не экспортирует router`);
        }
    } catch (err) {
        console.error(`✗ Не удалось подключить ${routePath}:`, err.message);
    }
});

// 404
app.use((req, res) => {
    res.status(404).send('<h1>404 - Страница не найдена</h1><a href="/">На главную</a>');
});

// Обработчик ошибок
app.use((err, req, res, next) => {
    console.error('ОШИБКА:', err.stack);
    res.status(500).send('Внутренняя ошибка сервера');
});

app.listen(PORT, () => {
    console.log('');
    console.log('  LTLLMND запущен');
    console.log('  Сайт:    http://localhost:' + PORT);
    console.log('  Админка: http://localhost:' + PORT + '/admin');
    console.log('');
});