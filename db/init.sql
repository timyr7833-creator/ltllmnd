-- Таблица администраторов
CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
    username VARCHAR(80) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица пользователей (покупателей)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(200) UNIQUE NOT NULL,
    password_hash VARCHAR(256) NOT NULL,
    first_name VARCHAR(100) NOT NULL DEFAULT '',
    last_name VARCHAR(100) NOT NULL DEFAULT '',
    phone VARCHAR(30) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица товаров
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    description TEXT,
    price NUMERIC(10,2) NOT NULL,
    old_price NUMERIC(10,2),
    category VARCHAR(100) NOT NULL DEFAULT 'other',
    sizes VARCHAR(200),
    in_stock BOOLEAN DEFAULT true,
    featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица изображений товаров
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    filename VARCHAR(300) NOT NULL,
    is_main BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Таблица заказов
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(20) UNIQUE NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    customer_name VARCHAR(200) NOT NULL,
    customer_email VARCHAR(200) NOT NULL,
    customer_phone VARCHAR(30) NOT NULL,
    delivery_address TEXT NOT NULL,
    delivery_method VARCHAR(50) DEFAULT 'cdek',
    payment_method VARCHAR(50) DEFAULT 'card',
    comment TEXT,
    status VARCHAR(30) DEFAULT 'new',
    total_price NUMERIC(10,2) NOT NULL,
    agree_offer BOOLEAN DEFAULT false,
    agree_privacy BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Таблица позиций заказа
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    product_name VARCHAR(200) NOT NULL,
    size VARCHAR(10),
    quantity INTEGER NOT NULL DEFAULT 1,
    price NUMERIC(10,2) NOT NULL
);

-- Таблица корзины (привязана к пользователю)
CREATE TABLE IF NOT EXISTS cart_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(10) NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(user_id, product_id, size)
);

-- Демо-товары
INSERT INTO products (name, slug, description, price, old_price, category, sizes, in_stock, featured)
VALUES
    (
        'LTLLMND Oversized Tee Black',
        'oversized-tee-black',
        'Оверсайз футболка из плотного хлопка 240 г/м². Минималистичный дизайн с вышитым логотипом LTLLMND на груди. Dropped shoulders, удлинённый крой.',
        4500, NULL, 'tshirts', 'XS,S,M,L,XL,XXL', true, true
    ),
    (
        'LTLLMND Oversized Tee White',
        'oversized-tee-white',
        'Оверсайз футболка из плотного хлопка 240 г/м². Чистый белый цвет. Вышитый логотип LTLLMND. Dropped shoulders, удлинённый крой.',
        4500, 5500, 'tshirts', 'XS,S,M,L,XL', true, true
    ),
    (
        'LTLLMND Essential Hoodie',
        'essential-hoodie',
        'Худи из premium-флиса 360 г/м². Оверсайз крой, капюшон с двойным шнурком, карман-кенгуру. Вышивка LTLLMND на груди.',
        8900, NULL, 'hoodies', 'S,M,L,XL', true, true
    ),
    (
        'LTLLMND Wide Cargo Pants',
        'wide-cargo-pants',
        'Широкие карго-штаны из плотного хлопкового твила. Множество карманов, регулируемый пояс, утяжки по низу штанин.',
        7500, 9000, 'pants', 'S,M,L,XL', true, true
    )
ON CONFLICT (slug) DO NOTHING;