-- ════════════════════════════════════════════════════════════════
-- Netlink Billing — PostgreSQL schema
-- ════════════════════════════════════════════════════════════════

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Admin users (dashboard access) ────────────────────────────────
CREATE TABLE IF NOT EXISTS admins (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) NOT NULL,
    email         VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role          VARCHAR(20) NOT NULL DEFAULT 'admin', -- admin | superadmin
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Routers (support multiple MikroTik devices / sites) ──────────
CREATE TABLE IF NOT EXISTS routers (
    id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name          VARCHAR(100) NOT NULL,
    host          VARCHAR(100) NOT NULL,
    api_port      INTEGER NOT NULL DEFAULT 8728,
    api_user      VARCHAR(100) NOT NULL,
    api_password  VARCHAR(255) NOT NULL,
    use_tls       BOOLEAN NOT NULL DEFAULT false,
    site_label    VARCHAR(100),
    is_active     BOOLEAN NOT NULL DEFAULT true,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Customers ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name      VARCHAR(150) NOT NULL,
    phone          VARCHAR(20) UNIQUE NOT NULL,
    email          VARCHAR(150),
    address        VARCHAR(255),
    connection_type VARCHAR(20) NOT NULL DEFAULT 'hotspot', -- hotspot | pppoe
    status         VARCHAR(20) NOT NULL DEFAULT 'active',   -- active | suspended | disabled
    router_id      UUID REFERENCES routers(id),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Plans (both prepaid packages and postpaid monthly plans) ─────
CREATE TABLE IF NOT EXISTS plans (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name           VARCHAR(100) NOT NULL,
    plan_type      VARCHAR(20) NOT NULL,        -- prepaid | postpaid
    connection_type VARCHAR(20) NOT NULL,       -- hotspot | pppoe
    price          NUMERIC(10,2) NOT NULL,
    duration_value INTEGER,                     -- e.g. 1, 24, 7
    duration_unit  VARCHAR(10),                 -- minutes | hours | days | months
    data_cap_mb    INTEGER,                     -- NULL = unlimited
    download_speed VARCHAR(20),                 -- e.g. '5M' (mikrotik rate-limit format)
    upload_speed   VARCHAR(20),
    rate_limit     VARCHAR(30),                 -- combined "upload/download" burst string, optional override
    mikrotik_profile VARCHAR(100),              -- hotspot user-profile OR ppp-profile name on router
    is_active      BOOLEAN NOT NULL DEFAULT true,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Vouchers (prepaid hotspot access codes) ───────────────────────
CREATE TABLE IF NOT EXISTS vouchers (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code           VARCHAR(20) UNIQUE NOT NULL,
    plan_id        UUID NOT NULL REFERENCES plans(id),
    router_id      UUID REFERENCES routers(id),
    customer_id    UUID REFERENCES customers(id),   -- NULL until redeemed/linked to a payer
    status         VARCHAR(20) NOT NULL DEFAULT 'unused', -- unused | active | expired | used
    activated_at   TIMESTAMPTZ,
    expires_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── PPPoE secrets (postpaid / provisioned PPPoE accounts) ─────────
CREATE TABLE IF NOT EXISTS pppoe_accounts (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    router_id      UUID REFERENCES routers(id),
    plan_id        UUID NOT NULL REFERENCES plans(id),
    username       VARCHAR(100) UNIQUE NOT NULL,
    password       VARCHAR(100) NOT NULL,
    profile        VARCHAR(100) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'active', -- active | suspended | disabled
    next_due_date  DATE,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Payments / transactions (M-Pesa Daraja STK Push) ──────────────
CREATE TABLE IF NOT EXISTS payments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id         UUID REFERENCES customers(id),
    plan_id             UUID REFERENCES plans(id),
    voucher_id          UUID REFERENCES vouchers(id),
    pppoe_account_id    UUID REFERENCES pppoe_accounts(id),
    phone               VARCHAR(20) NOT NULL,
    amount              NUMERIC(10,2) NOT NULL,
    merchant_request_id VARCHAR(100),
    checkout_request_id VARCHAR(100) UNIQUE,
    mpesa_receipt       VARCHAR(50),
    status              VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | success | failed | cancelled
    result_desc         VARCHAR(255),
    raw_callback        JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Sessions (hotspot/PPPoE active session tracking, synced from router) ─
CREATE TABLE IF NOT EXISTS sessions (
    id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id    UUID REFERENCES customers(id),
    voucher_id     UUID REFERENCES vouchers(id),
    pppoe_account_id UUID REFERENCES pppoe_accounts(id),
    router_id      UUID REFERENCES routers(id),
    connection_type VARCHAR(20) NOT NULL, -- hotspot | pppoe
    mac_address    VARCHAR(30),
    ip_address     VARCHAR(45),
    started_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at       TIMESTAMPTZ,
    bytes_in       BIGINT DEFAULT 0,
    bytes_out      BIGINT DEFAULT 0,
    status         VARCHAR(20) NOT NULL DEFAULT 'active' -- active | closed
);

-- ── Indexes ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE INDEX IF NOT EXISTS idx_vouchers_code ON vouchers(code);
CREATE INDEX IF NOT EXISTS idx_vouchers_status ON vouchers(status);
CREATE INDEX IF NOT EXISTS idx_payments_checkout ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_pppoe_username ON pppoe_accounts(username);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
