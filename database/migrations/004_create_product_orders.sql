BEGIN;

CREATE TABLE IF NOT EXISTS product_orders (
    id BIGSERIAL PRIMARY KEY,
    customer_id BIGINT NOT NULL REFERENCES users(id),
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'confirmed', 'processing',
                          'shipped', 'delivered', 'cancelled')),
    payment_method VARCHAR(30) NOT NULL
        CHECK (payment_method IN ('cash_on_delivery', 'mpesa')),
    payment_status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    delivery_name VARCHAR(120) NOT NULL,
    delivery_phone VARCHAR(20) NOT NULL,
    delivery_email VARCHAR(160),
    delivery_county VARCHAR(100) NOT NULL,
    delivery_town VARCHAR(100) NOT NULL,
    delivery_address TEXT NOT NULL,
    customer_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_order_items (
    id BIGSERIAL PRIMARY KEY,
    order_id BIGINT NOT NULL
        REFERENCES product_orders(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES products(id),
    seller_id BIGINT NOT NULL REFERENCES users(id),
    product_name VARCHAR(180) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    subtotal NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_orders_customer
    ON product_orders(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_product_order_items_order
    ON product_order_items(order_id);

CREATE INDEX IF NOT EXISTS idx_product_order_items_seller
    ON product_order_items(seller_id);

COMMIT;
