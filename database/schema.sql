-- ============================================================
-- PataPro Kenya Database
-- ============================================================

-- ------------------------------------------------------------
-- USERS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    name VARCHAR(200) NOT NULL,

    email VARCHAR(255) NOT NULL UNIQUE,
    phone VARCHAR(30),

    role VARCHAR(30) NOT NULL DEFAULT 'customer'
        CHECK (role IN (
            'customer',
            'business',
            'service_provider',
            'admin'
        )),

    password_hash TEXT NOT NULL,

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email
ON users (email);

CREATE INDEX IF NOT EXISTS idx_users_role
ON users (role);


-- ------------------------------------------------------------
-- BUSINESSES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS businesses (
    id BIGSERIAL PRIMARY KEY,

    owner_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    business_name VARCHAR(200) NOT NULL,

    slug VARCHAR(220) UNIQUE,

    description TEXT,

    category VARCHAR(100) NOT NULL,

    subcategory VARCHAR(100),

    phone VARCHAR(30),
    whatsapp VARCHAR(30),

    email VARCHAR(255),

    website VARCHAR(500),

    county VARCHAR(100),
    town VARCHAR(100),
    location VARCHAR(255),

    logo_url TEXT,
    cover_image_url TEXT,

    opening_hours JSONB,

    rating NUMERIC(2,1) NOT NULL DEFAULT 0
        CHECK (rating >= 0 AND rating <= 5),

    review_count INTEGER NOT NULL DEFAULT 0,

    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_businesses_owner
ON businesses (owner_id);

CREATE INDEX IF NOT EXISTS idx_businesses_category
ON businesses (category);

CREATE INDEX IF NOT EXISTS idx_businesses_county
ON businesses (county);

CREATE INDEX IF NOT EXISTS idx_businesses_town
ON businesses (town);

CREATE INDEX IF NOT EXISTS idx_businesses_featured
ON businesses (is_featured);


-- ------------------------------------------------------------
-- SERVICES
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS services (
    id BIGSERIAL PRIMARY KEY,

    business_id BIGINT NOT NULL
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    name VARCHAR(200) NOT NULL,

    description TEXT,

    price NUMERIC(12,2),

    price_type VARCHAR(30) DEFAULT 'fixed'
        CHECK (price_type IN (
            'fixed',
            'starting_from',
            'negotiable',
            'free',
            'quote'
        )),

    image_url TEXT,

    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_services_business
ON services (business_id);


-- ------------------------------------------------------------
-- QUOTE REQUESTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS quotes (
    id BIGSERIAL PRIMARY KEY,

    customer_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    business_id BIGINT NOT NULL
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    service_id BIGINT
        REFERENCES services(id)
        ON DELETE SET NULL,

    subject VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    budget NUMERIC(12,2),

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'viewed',
            'responded',
            'accepted',
            'rejected',
            'completed',
            'cancelled'
        )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_quotes_customer
ON quotes (customer_id);

CREATE INDEX IF NOT EXISTS idx_quotes_business
ON quotes (business_id);

CREATE INDEX IF NOT EXISTS idx_quotes_status
ON quotes (status);


-- ------------------------------------------------------------
-- BUSINESS VERIFICATION REQUESTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS verification_requests (
    id BIGSERIAL PRIMARY KEY,

    business_id BIGINT NOT NULL
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    submitted_by BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    document_type VARCHAR(100),

    document_url TEXT,

    notes TEXT,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'rejected'
        )),

    reviewed_by BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    reviewed_at TIMESTAMPTZ,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_verification_business
ON verification_requests (business_id);

CREATE INDEX IF NOT EXISTS idx_verification_status
ON verification_requests (status);


-- ------------------------------------------------------------
-- REVIEWS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reviews (
    id BIGSERIAL PRIMARY KEY,

    business_id BIGINT NOT NULL
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    customer_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    rating INTEGER NOT NULL
        CHECK (rating BETWEEN 1 AND 5),

    comment TEXT,

    is_visible BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    UNIQUE (business_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_business
ON reviews (business_id);


-- ------------------------------------------------------------
-- FEATURED LISTINGS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS featured_listings (
    id BIGSERIAL PRIMARY KEY,

    business_id BIGINT NOT NULL
        REFERENCES businesses(id)
        ON DELETE CASCADE,

    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NOT NULL,

    amount NUMERIC(12,2) NOT NULL DEFAULT 0,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'active',
            'expired',
            'cancelled'
        )),

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_featured_business
ON featured_listings (business_id);

CREATE INDEX IF NOT EXISTS idx_featured_dates
ON featured_listings (start_date, end_date);


-- ------------------------------------------------------------
-- ADVERTISEMENTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS advertisements (
    id BIGSERIAL PRIMARY KEY,

    business_id BIGINT
        REFERENCES businesses(id)
        ON DELETE SET NULL,

    title VARCHAR(200) NOT NULL,

    description TEXT,

    image_url TEXT,

    target_url TEXT,

    placement VARCHAR(50) NOT NULL DEFAULT 'homepage',

    budget NUMERIC(12,2) NOT NULL DEFAULT 0,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'approved',
            'active',
            'paused',
            'rejected',
            'expired'
        )),

    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,

    impressions INTEGER NOT NULL DEFAULT 0,
    clicks INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ads_status
ON advertisements (status);

CREATE INDEX IF NOT EXISTS idx_ads_business
ON advertisements (business_id);


-- ------------------------------------------------------------
-- PAYMENTS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS payments (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT
        REFERENCES users(id)
        ON DELETE SET NULL,

    business_id BIGINT
        REFERENCES businesses(id)
        ON DELETE SET NULL,

    amount NUMERIC(12,2) NOT NULL,

    currency VARCHAR(10) NOT NULL DEFAULT 'KES',

    payment_type VARCHAR(50) NOT NULL,

    provider VARCHAR(50),

    transaction_reference VARCHAR(255) UNIQUE,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN (
            'pending',
            'completed',
            'failed',
            'cancelled',
            'refunded'
        )),

    metadata JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_user
ON payments (user_id);

CREATE INDEX IF NOT EXISTS idx_payments_business
ON payments (business_id);

CREATE INDEX IF NOT EXISTS idx_payments_status
ON payments (status);


-- ------------------------------------------------------------
-- NOTIFICATIONS
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,

    user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(50) DEFAULT 'general',

    is_read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
ON notifications (user_id);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
ON notifications (user_id, is_read);


-- ------------------------------------------------------------
-- UPDATED_AT FUNCTION
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ------------------------------------------------------------
-- UPDATED_AT TRIGGERS
-- ------------------------------------------------------------

DROP TRIGGER IF EXISTS update_users_updated_at
ON users;

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_businesses_updated_at
ON businesses;

CREATE TRIGGER update_businesses_updated_at
BEFORE UPDATE ON businesses
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_services_updated_at
ON services;

CREATE TRIGGER update_services_updated_at
BEFORE UPDATE ON services
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_quotes_updated_at
ON quotes;

CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON quotes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_advertisements_updated_at
ON advertisements;

CREATE TRIGGER update_advertisements_updated_at
BEFORE UPDATE ON advertisements
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


DROP TRIGGER IF EXISTS update_payments_updated_at
ON payments;

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- PataPro Kenya schema complete
-- ============================================================