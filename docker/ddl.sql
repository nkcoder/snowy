-- 1. Users Table: Basic entity information
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Accounts Table: Where the money lives
-- Includes a check constraint to prevent negative balances if required
CREATE TABLE accounts (
    account_id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(user_id) ON DELETE CASCADE,
    account_type VARCHAR(20) NOT NULL, -- e.g., 'checking', 'savings'
    balance DECIMAL(15, 2) DEFAULT 0.00 CHECK (balance >= 0),
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(15) DEFAULT 'active',
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Transactions Table: The immutable ledger
CREATE TABLE transactions (
    transaction_id SERIAL PRIMARY KEY,
    from_account_id INT REFERENCES accounts(account_id),
    to_account_id INT REFERENCES accounts(account_id),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount > 0),
    transaction_type VARCHAR(20) NOT NULL, -- e.g., 'transfer', 'deposit', 'withdrawal'
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. Audit Log: Tracks changes for security and compliance
CREATE TABLE audit_logs (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50),
    record_id INT,
    action VARCHAR(10), -- 'INSERT', 'UPDATE', 'DELETE'
    old_value JSONB,
    new_value JSONB,
    changed_by INT REFERENCES users(user_id),
    changed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 1. Insert Users
INSERT INTO users (first_name, last_name, email) VALUES
('Alice', 'Smith', 'alice.smith@example.com'),
('Bob', 'Johnson', 'bob.j@provider.net'),
('Charlie', 'Davis', 'charlie.d@fintech.com');

-- 2. Insert Accounts
-- Assuming Alice is ID 1, Bob is ID 2, Charlie is ID 3
INSERT INTO accounts (user_id, account_type, balance, currency) VALUES
(1, 'checking', 5000.00, 'USD'),
(1, 'savings', 12500.50, 'USD'),
(2, 'checking', 850.00, 'USD'),
(3, 'checking', 2200.00, 'USD');

-- 3. Insert Transactions
-- Alice (Acct 1) sends money to Bob (Acct 3)
INSERT INTO transactions (from_account_id, to_account_id, amount, transaction_type, description) VALUES
(1, 3, 150.00, 'transfer', 'Dinner split'),
(4, 1, 500.00, 'transfer', 'Freelance payment from Charlie to Alice');

-- 4. Manual Deposits/Withdrawals (where one side of the ledger is NULL)
INSERT INTO transactions (to_account_id, amount, transaction_type, description) VALUES
(1, 2000.00, 'deposit', 'ATM Deposit');

INSERT INTO transactions (from_account_id, amount, transaction_type, description) VALUES
(3, 40.00, 'withdrawal', 'Cash out at Merchant');

-- 5. Products Table: A wide catalog table with UUID PK
-- gen_random_uuid() is built-in since PostgreSQL 13; no extension needed.

CREATE TABLE products (
    product_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku                 VARCHAR(50) UNIQUE NOT NULL,
    name                VARCHAR(200) NOT NULL,
    slug                VARCHAR(200) UNIQUE NOT NULL,
    description         TEXT,
    short_description   VARCHAR(500),
    brand               VARCHAR(100),
    manufacturer        VARCHAR(100),
    category            VARCHAR(100),
    subcategory         VARCHAR(100),
    tags                TEXT[],
    price               DECIMAL(12, 2) NOT NULL CHECK (price >= 0),
    compare_at_price    DECIMAL(12, 2),
    cost_price          DECIMAL(12, 2),
    currency            VARCHAR(3) DEFAULT 'USD',
    stock_quantity      INT NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
    low_stock_threshold INT DEFAULT 10,
    weight_kg           DECIMAL(8, 3),
    length_cm           DECIMAL(8, 2),
    width_cm            DECIMAL(8, 2),
    height_cm           DECIMAL(8, 2),
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured         BOOLEAN NOT NULL DEFAULT FALSE,
    is_digital          BOOLEAN NOT NULL DEFAULT FALSE,
    requires_shipping   BOOLEAN NOT NULL DEFAULT TRUE,
    tax_class           VARCHAR(50) DEFAULT 'standard',
    barcode             VARCHAR(100),
    country_of_origin   VARCHAR(2),
    warranty_months     INT DEFAULT 0,
    rating_average      DECIMAL(3, 2) CHECK (rating_average BETWEEN 0 AND 5),
    rating_count        INT DEFAULT 0,
    metadata            JSONB,
    created_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Insert 10,000 Products via generate_series
INSERT INTO products (
    sku, name, slug, description, short_description,
    brand, manufacturer, category, subcategory, tags,
    price, compare_at_price, cost_price, currency,
    stock_quantity, low_stock_threshold,
    weight_kg, length_cm, width_cm, height_cm,
    is_active, is_featured, is_digital, requires_shipping,
    tax_class, barcode, country_of_origin, warranty_months,
    rating_average, rating_count, metadata
)
SELECT
    -- sku / identity
    'SKU-' || LPAD(i::TEXT, 6, '0'),
    (ARRAY['Wireless Headphones','Office Chair','Water Bottle','Mechanical Keyboard',
           'Standing Desk','Webcam','USB Hub','Monitor','Laptop Stand','Phone Case',
           'Backpack','Portable Charger','Smart Watch','Earbuds','Desk Lamp',
           'Mousepad','Cable Organizer','Keyboard Wrist Rest','Screen Cleaner','Pen Holder'])
        [(i % 20) + 1] || ' Model ' || i,
    'product-' || i || '-' || LPAD(i::TEXT, 6, '0'),
    'Detailed description for product ' || i || '. High quality item with excellent reviews.',
    'Short description for product ' || i,

    -- brand / manufacturer
    (ARRAY['SoundWave','ComfortPro','HydroFlow','KeyCraft','BrewLab',
           'TechGear','OfficePro','SmartHome','EcoGoods','UrbanStyle'])
        [(i % 10) + 1],
    (ARRAY['SoundWave Electronics Ltd','ComfortPro Furnishings','HydroFlow Gear Co.',
           'KeyCraft Peripherals','BrewLab Roasters Inc.','TechGear Manufacturing',
           'OfficePro Solutions','SmartHome Devices','EcoGoods International','UrbanStyle Co.'])
        [(i % 10) + 1],

    -- category / subcategory
    (ARRAY['Electronics','Furniture','Sports & Outdoors','Food & Beverage',
           'Office Supplies','Home & Garden','Clothing','Books','Toys','Automotive'])
        [(i % 10) + 1],
    (ARRAY['Audio','Seating','Hydration','Coffee','Peripherals',
           'Lighting','Storage','Desks','Accessories','Tools'])
        [(i % 10) + 1],

    -- tags array
    ARRAY['product-' || i, 'tag-' || (i % 50), 'cat-' || (i % 10)],

    -- pricing
    ROUND((RANDOM() * 990 + 10)::NUMERIC, 2),
    CASE WHEN i % 3 = 0 THEN ROUND((RANDOM() * 1200 + 50)::NUMERIC, 2) ELSE NULL END,
    ROUND((RANDOM() * 200 + 5)::NUMERIC, 2),
    'USD',

    -- inventory
    (RANDOM() * 1000)::INT,
    (RANDOM() * 50 + 5)::INT,

    -- dimensions
    ROUND((RANDOM() * 20 + 0.1)::NUMERIC, 3),
    ROUND((RANDOM() * 100 + 5)::NUMERIC, 2),
    ROUND((RANDOM() * 80 + 5)::NUMERIC, 2),
    ROUND((RANDOM() * 60 + 2)::NUMERIC, 2),

    -- flags
    TRUE,
    (i % 20 = 0),
    (i % 15 = 0),
    (i % 15 != 0),

    -- misc
    (ARRAY['standard','reduced','zero'])[(i % 3) + 1],
    LPAD((i * 7919)::TEXT, 13, '0'),
    (ARRAY['US','CN','DE','JP','GB','FR','CA','TW','KR','PL'])[(i % 10) + 1],
    (ARRAY[0,6,12,24,36])[(i % 5) + 1],

    -- ratings
    ROUND((RANDOM() * 2 + 3)::NUMERIC, 2),
    (RANDOM() * 10000)::INT,

    -- metadata
    jsonb_build_object('batch', 'seed', 'index', i, 'tier', (i % 4) + 1)

FROM generate_series(1, 10000) AS s(i);
