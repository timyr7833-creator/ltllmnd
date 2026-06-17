const pool = require('./pool');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function initDB() {
    const client = await pool.connect();

    try {
        const sql = fs.readFileSync(
            path.join(__dirname, 'init.sql'), 'utf8'
        );
        await client.query(sql);
        console.log('Таблицы созданы, демо-товары добавлены.');

        // Добавляем колонку user_id если она не существует (для обновления)
        try {
            await client.query(`
                ALTER TABLE orders ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL
            `);
        } catch (e) {
            // Колонка уже есть — нормально
        }

        const username = process.env.ADMIN_USERNAME || 'admin';
        const password = process.env.ADMIN_PASSWORD || 'LtllmndAdmin2024!';

        const existing = await client.query(
            'SELECT id FROM admins WHERE username = $1',
            [username]
        );

        if (existing.rows.length === 0) {
            const hash = await bcrypt.hash(password, 12);
            await client.query(
                'INSERT INTO admins (username, password_hash) VALUES ($1, $2)',
                [username, hash]
            );
            console.log('Администратор создан: ' + username);
        } else {
            console.log('Администратор уже существует.');
        }

        console.log('\n=== Готово! ===');
        console.log('Логин админки: ' + username);
        console.log('Пароль админки: ' + password);
        console.log('Сайт: http://localhost:3000');
        console.log('Админка: http://localhost:3000/admin');

    } catch (err) {
        console.error('Ошибка инициализации:', err.message);
    } finally {
        client.release();
        pool.end();
    }
}

initDB();