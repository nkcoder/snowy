-- 1. Users Table (The "One" in One-to-Many)
CREATE TABLE users (
                       user_id SERIAL PRIMARY KEY,
                       username VARCHAR(50) NOT NULL,
                       email VARCHAR(100) UNIQUE NOT NULL,
                       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Products Table
CREATE TABLE products (
                          product_id SERIAL PRIMARY KEY,
                          name VARCHAR(100) NOT NULL,
                          price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
                          stock_quantity INTEGER DEFAULT 0
);

-- 3. Orders Table (The "Many" in One-to-Many)
-- Linked to Users via user_id
CREATE TABLE orders (
                        order_id SERIAL PRIMARY KEY,
                        user_id INTEGER REFERENCES users(user_id) ON DELETE CASCADE,
                        order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(20) DEFAULT 'pending'
);

-- 4. Order_Items Table (The Join Table for Many-to-Many)
-- Links Orders and Products
CREATE TABLE order_items (
                             order_id INTEGER REFERENCES orders(order_id) ON DELETE CASCADE,
                             product_id INTEGER REFERENCES products(product_id) ON DELETE RESTRICT,
                             quantity INTEGER NOT NULL CHECK (quantity > 0),
                             PRIMARY KEY (order_id, product_id)
);

-- Seed Users
INSERT INTO users (username, email) VALUES 
('alice_db', 'alice@example.com'),
('bob_sql', 'bob@example.com');

-- Seed Products
INSERT INTO products (name, price, stock_quantity) VALUES 
('Mechanical Keyboard', 120.00, 50),
('USB-C Hub', 45.50, 200),
('Monitor Stand', 89.99, 30);

-- Create an Order for Alice (User 1)
INSERT INTO orders (user_id, status) VALUES (1, 'shipped');

-- Alice bought 1 Keyboard and 2 USB-C Hubs
INSERT INTO order_items (order_id, product_id, quantity) VALUES 
(1, 1, 1),
(1, 2, 2);