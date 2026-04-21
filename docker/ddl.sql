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
