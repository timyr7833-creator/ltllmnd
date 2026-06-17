const crypto = require('crypto');

// Пути, где multer обрабатывает тело (пропускаем CSRF здесь, проверим в роуте)
const MULTIPART_PATHS = [
    '/admin/products/add',
    '/admin/products/edit'
];

function generateToken(req) {
    if (!req.session.csrfToken) {
        req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    }
    return req.session.csrfToken;
}

function csrfMiddleware(req, res, next) {
    const token = generateToken(req);
    res.locals.csrfToken = token;

    const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
    if (safeMethods.includes(req.method)) {
        return next();
    }

    // Для multipart форм (загрузка файлов) — пропускаем здесь,
    // проверим вручную в роуте после multer
    const contentType = req.headers['content-type'] || '';
    if (contentType.includes('multipart/form-data')) {
        return next();
    }

    const bodyToken = req.body && req.body._csrf;
    const headerToken = req.headers['x-csrf-token'];
    const submitted = bodyToken || headerToken;

    if (!submitted || submitted !== req.session.csrfToken) {
        return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>403 — LTLLMND</title>
                <style>
                    body { font-family:sans-serif; display:flex; justify-content:center;
                           align-items:center; height:100vh; margin:0;
                           background:#000; color:#fff; }
                    h1 { font-size:4rem; font-weight:100; }
                    a { color:#fff; }
                </style>
            </head>
            <body>
                <div style="text-align:center">
                    <h1>403</h1>
                    <p>Недействительный запрос.</p>
                    <p><a href="/">На главную</a></p>
                </div>
            </body>
            </html>
        `);
    }

    next();
}

// Используем для ручной проверки в роутах с multer
function verifyCsrf(req, res) {
    const bodyToken = req.body && req.body._csrf;
    const headerToken = req.headers['x-csrf-token'];
    const submitted = bodyToken || headerToken;
    return submitted && submitted === req.session.csrfToken;
}

module.exports = { csrfMiddleware, generateToken, verifyCsrf };