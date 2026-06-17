const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { CATEGORIES } = require('../utils/helpers');

// Главная страница
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT p.*,
                (SELECT pi.filename FROM product_images pi
                 WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
            FROM products p
            WHERE p.featured = true AND p.in_stock = true
            ORDER BY p.created_at DESC LIMIT 8
        `);
        res.render('index', {
            products: result.rows,
            page: 'home'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

// Каталог
router.get('/catalog/:category?', async (req, res) => {
    try {
        const category = req.params.category;
        let result;

        if (category && CATEGORIES[category]) {
            result = await pool.query(`
                SELECT p.*,
                    (SELECT pi.filename FROM product_images pi
                     WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
                FROM products p
                WHERE p.category = $1 AND p.in_stock = true
                ORDER BY p.created_at DESC
            `, [category]);
        } else {
            result = await pool.query(`
                SELECT p.*,
                    (SELECT pi.filename FROM product_images pi
                     WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
                FROM products p
                WHERE p.in_stock = true
                ORDER BY p.created_at DESC
            `);
        }

        res.render('catalog', {
            products: result.rows,
            categories: CATEGORIES,
            currentCategory: category && CATEGORIES[category]
                ? CATEGORIES[category]
                : 'Все товары',
            selectedCategory: category || null,
            page: 'catalog'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

module.exports = router;