require('dotenv').config();
const express = require('express');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');
const pool = require('./db/pool');
const { formatPrice } = require('./utils/helpers');
const { csrfMiddleware } = require('./middleware/csrf');

const app = express();
const PORT = process.env.PORT || 3000;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'user_sessions',
        createTableIfMissing: true,
        errorLog: console.error
    }),
    secret: process.env.SESSION_SECRET || 'fallback-secret-please-change',
    resave: false,
    saveUninitialized: false,
    name: 'ltllmnd.sid',
    cookie: {
        maxAge: 7 * 24 * 60 * 60 * 1000,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax'
    }
}));

app.use(csrfMiddleware);

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

// Глобальные переменные для шаблонов
app.use(async (req, res, next) => {
    // Считаем корзину
    var cartCount = 0;
    if (req.session.userId) {
        try {
            const result = await pool.query(
                'SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id = $1',
                [req.session.userId]
            );
            cartCount = parseInt(result.rows[0].count);
        } catch (e) {
            cartCount = 0;
        }
    } else {
        var cart = req.session.cart || [];
        cartCount = cart.reduce(function (s, i) { return s + i.quantity; }, 0);
    }

    res.locals.cartCount = cartCount;
    res.locals.formatPrice = formatPrice;
    res.locals.currentPath = req.path;
    res.locals.adminUser = req.session.adminUsername || null;
    res.locals.currentUser = req.session.userId ? {
        id: req.session.userId,
        email: req.session.userEmail,
        name: req.session.userName
    } : null;
    next();
});

// Папки загрузок
const uploadDir = path.join(__dirname, 'public', 'uploads');
const tempDir = path.join(uploadDir, 'temp');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(tempDir, { recursive: true });

// Маршруты
app.use(require('./routes/main'));
app.use(require('./routes/product'));
app.use(require('./routes/cart'));
app.use(require('./routes/order'));
app.use(require('./routes/auth'));
app.use(require('./routes/admin'));
app.use(require('./routes/pages'));

// 404
app.use((req, res) => {
    res.status(404).send(`
        <!DOCTYPE html><html><head><title>404</title>
        <style>body{font-family:sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#000;color:#fff}h1{font-size:6rem;font-weight:100}a{color:#fff;text-decoration:underline}</style>
        </head><body><div style="text-align:center"><h1>404</h1><p>Страница не найдена</p><p><a href="/">На главную</a></p></div></body></html>
    `);
});

// Обработчик ошибок
app.use((err, req, res, next) => {
    console.error('ОШИБКА:', req.method, req.path, err.message);
    console.error(err.stack);
    var isDev = process.env.NODE_ENV !== 'production';
    res.status(500).send(`
        <!DOCTYPE html><html><head><title>Ошибка</title>
        <style>body{font-family:monospace;padding:40px;background:#111;color:#eee}h1{color:#f55}pre{background:#222;padding:20px;white-space:pre-wrap}a{color:#88f}</style>
        </head><body><h1>Ошибка сервера</h1><p>URL: ${req.method} ${req.path}</p>
        ${isDev ? '<pre>' + err.message + '\n\n' + err.stack + '</pre>' : ''}
        <p><a href="/">На главную</a></p></body></html>
    `);
});

app.listen(PORT, () => {
    console.log('');
    console.log('  LTLLMND запущен');
    console.log('  Сайт:    http://localhost:' + PORT);
    console.log('  Админка: http://localhost:' + PORT + '/admin');
    console.log('');
});