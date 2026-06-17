const express = require('express');
const router = express.Router();

router.get('/delivery', (req, res) => {
    res.render('pages/delivery', { page: 'delivery' });
});

router.get('/payment', (req, res) => {
    res.render('pages/payment', { page: 'payment' });
});

router.get('/returns', (req, res) => {
    res.render('pages/returns', { page: 'returns' });
});

router.get('/offer', (req, res) => {
    res.render('pages/offer', { page: 'offer' });
});

router.get('/privacy', (req, res) => {
    res.render('pages/privacy', { page: 'privacy' });
});

module.exports = router;