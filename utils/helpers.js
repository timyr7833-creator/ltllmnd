const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sharp = require('sharp');
const fs = require('fs');

const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

// ==================== SLUGIFY (исправленная версия) ====================
function slugify(text) {
    if (!text) return 'product-' + Date.now();

    const translitMap = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
        'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    };

    let str = text.toString().toLowerCase();

    // Транслитерация русского текста
    str = str.replace(/[а-яё]/g, char => translitMap[char] || char);

    // Убираем всё кроме букв, цифр, пробелов и дефисов
    str = str.replace(/[^a-z0-9\s-]/g, '');

    // Заменяем пробелы и множественные дефисы на один дефис
    str = str.replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

    return str || 'product-' + Date.now().toString(36);
}

// ==================== Остальные функции ====================
function generateOrderNumber() {
    return 'LM-' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

function isAllowedFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXT.includes(ext);
}

async function processImage(inputPath, outputDir) {
    const newName = uuidv4().replace(/-/g, '') + '.jpg';
    const outputPath = path.join(outputDir, newName);

    await sharp(inputPath)
        .resize(1200, 1600, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 92 })
        .toFile(outputPath);

    fs.unlinkSync(inputPath); // удаляем оригинал
    return newName;
}

function deleteImage(filename, uploadDir) {
    if (filename && filename !== 'no-image.png') {
        const filepath = path.join(uploadDir, filename);
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
        }
    }
}

function formatPrice(price) {
    return Math.round(Number(price)).toLocaleString('ru-RU');
}

const STATUS_NAMES = {
    'new': 'Новый',
    'confirmed': 'Подтверждён',
    'paid': 'Оплачен',
    'shipped': 'Отправлен',
    'delivered': 'Доставлен',
    'cancelled': 'Отменён'
};

const CATEGORIES = {
    'tshirts': 'Футболки',
    'hoodies': 'Худи',
    'pants': 'Штаны',
    'outerwear': 'Верхняя одежда',
    'accessories': 'Аксессуары',
    'other': 'Другое'
};

module.exports = {
    generateOrderNumber,
    slugify,
    isAllowedFile,
    processImage,
    deleteImage,
    formatPrice,
    STATUS_NAMES,
    CATEGORIES
};