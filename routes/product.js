const express = require('express');
const router = express.Router();
const pool = require('../db/pool');

router.get('/product/:slug', async (req, res) => {
    try {
        const { slug } = req.params;

        const productResult = await pool.query(
            'SELECT * FROM products WHERE slug = $1', [slug]
        );

        if (productResult.rows.length === 0) {
            return res.status(404).render('layout', {
                body: '<div style="text-align:center;padding:100px 20px;"><h1 style="font-size:4rem;font-weight:100;">404</h1><p>Товар не найден</p><a href="/catalog">В каталог</a></div>',
                page: '404',
                cartCount: 0
            });
        }

        const product = productResult.rows[0];

        // Все изображения товара
        const imagesResult = await pool.query(
            'SELECT * FROM product_images WHERE product_id = $1 ORDER BY is_main DESC, id ASC',
            [product.id]
        );
        product.images = imagesResult.rows;
        product.main_image = imagesResult.rows.find(i => i.is_main)?.filename
            || imagesResult.rows[0]?.filename || null;

        // Похожие товары
        const relatedResult = await pool.query(`
            SELECT p.*,
                (SELECT pi.filename FROM product_images pi
                 WHERE pi.product_id = p.id AND pi.is_main = true LIMIT 1) as main_image
            FROM products p
            WHERE p.category = $1 AND p.id != $2 AND p.in_stock = true
            LIMIT 4
        `, [product.category, product.id]);

        res.render('product', {
            product,
            related: relatedResult.rows,
            page: 'product'
        });
    } catch (err) {
        console.error(err);
        res.status(500).send('Ошибка сервера');
    }
});

module.exports = router;