const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cloudinary = require('cloudinary').v2;

const ALLOWED_EXT = ['.png', '.jpg', '.jpeg', '.webp'];

// ==================== SLUGIFY ====================
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
    str = str.replace(/[а-яё]/g, char => translitMap[char] || char);
    str = str.replace(/[^a-z0-9\s-]/g, '');
    str = str.replace(/[\s_-]+/g, '-').replace(/^-+|-+$/g, '');

    return str || 'product-' + Date.now().toString(36);
}

function generateOrderNumber() {
    return 'LM-' + uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
}

function isAllowedFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ALLOWED_EXT.includes(ext);
}

// ==================== УДАЛЕНИЕ КАРТИНКИ (защищённая версия) ====================
async function deleteImage(imageUrl) {
    try {
        if (!imageUrl || typeof imageUrl !== 'string') return;
        if (imageUrl === 'no-image.png') return;

        // Если это URL Cloudinary — пытаемся удалить
        if (imageUrl.includes('cloudinary.com')) {
            const matches = imageUrl.match(/\/upload\/(?:v\d+\/)?(.+)\.[a-z]+$/i);
            if (matches && matches[1]) {
                const publicId = matches[1];
                try {
                    await cloudinary.uploader.destroy(publicId);
                    console.log(`✓ Удалена картинка из Cloudinary: ${publicId}`);
                } catch (cloudErr) {
                    console.error('⚠ Cloudinary не удалил картинку (игнор):', cloudErr.message);
                }
            }
        } else {
            console.log(`ℹ Пропуск удаления локального файла: ${imageUrl}`);
        }
    } catch (err) {
        console.error('⚠ Ошибка в deleteImage (игнорируется):', err.message);
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
    deleteImage,
    formatPrice,
    STATUS_NAMES,
    CATEGORIES
};