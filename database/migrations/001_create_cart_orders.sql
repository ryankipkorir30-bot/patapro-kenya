-- PataPro Kenya: Shopping cart and orders
-- This migration does not replace existing tables.

CREATE TABLE IF NOT EXISTS orders (
    id BIGSERIAL PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE RESTRICT,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'confirmed',
            'in_progress',
            'completed',
            'cancelled'
        )),

    total_amount NUMERIC(12,2) NOT NULL
        CHECK (total_amount >= 0),

    delivery_location VARCHAR(255),
    customer_note TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_customer
ON orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_status
ON orders(status);

CREATE TABLE IF NOT EXISTS order_items (
    id BIGSERIAL PRIMARY KEY,

    order_id BIGINT NOT NULL
        REFERENCES orders(id) ON DELETE CASCADE,

    service_id BIGINT NOT NULL
        REFERENCES services(id) ON DELETE RESTRICT,

    service_name VARCHAR(200) NOT NULL,
    business_name VARCHAR(200) NOT NULL,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity BETWEEN 1 AND 100),

    unit_price NUMERIC(12,2) NOT NULL
        CHECK (unit_price >= 0),

    subtotal NUMERIC(12,2) NOT NULL
        CHECK (subtotal >= 0),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_items_order
ON order_items(order_id);

CREATE TABLE IF NOT EXISTS shopping_cart_items (
    id BIGSERIAL PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    service_id BIGINT NOT NULL
        REFERENCES services(id) ON DELETE CASCADE,

    quantity INTEGER NOT NULL DEFAULT 1
        CHECK (quantity BETWEEN 1 AND 100),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(customer_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_cart_customer
ON shopping_cart_items(customer_id);
