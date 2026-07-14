-- ====================================================================
-- ASFOOR STORE - SUPABASE POSTGRESQL MIGRATION BLUEPRINT (v190)
-- Production-Ready SQL Schema, Relationships, Functions, and Triggers
-- ====================================================================

BEGIN;

-- --------------------------------------------------------------------
-- 1. Enable Required Extensions
-- --------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- --------------------------------------------------------------------
-- 2. Create Users Table (Preserving Supervisor Organizational Tree)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('مدير', 'مشرف', 'موظف عمليات', 'مسؤول مرتجعات', 'محاسب', 'مندوب', 'مورد')),
    is_active BOOLEAN DEFAULT TRUE,
    permissions TEXT, -- Full privileges description (e.g., 'كاملة', 'توزيع ومتابعة')
    supervisor_id UUID REFERENCES users(id) ON DELETE SET NULL, -- Nested Odoo-style organizational tree
    commission_success NUMERIC DEFAULT 25.00, -- Default courier success commission
    commission_return NUMERIC DEFAULT 10.00,  -- Default courier return commission
    basic_salary NUMERIC DEFAULT 3000.00,
    region TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add self-referencing index for supervisors tree
CREATE INDEX IF NOT EXISTS idx_users_supervisor ON users(supervisor_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- --------------------------------------------------------------------
-- 3. Create Vendors Table (Merchants, Wallet & Profiles)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS vendors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT UNIQUE NOT NULL,
    phone TEXT,
    default_shipping_price NUMERIC DEFAULT 60.00,
    opening_balance NUMERIC DEFAULT 0.00,
    wallet_balance NUMERIC DEFAULT 0.00, -- Dynamically managed financial balance
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vendors_name ON vendors(name);

-- --------------------------------------------------------------------
-- 4. Create Shipments Table (The Operational Shipments Engine)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shipments (
    tracking TEXT PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    order_date DATE DEFAULT CURRENT_DATE,
    vendor_name TEXT REFERENCES vendors(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    customer_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    phone2 TEXT,
    gov TEXT NOT NULL,
    region TEXT NOT NULL,
    address TEXT NOT NULL,
    
    -- Financial fields
    prod_price NUMERIC DEFAULT 0.00,
    ship_price NUMERIC DEFAULT 0.00,
    total_cod NUMERIC DEFAULT 0.00,
    ship_cost NUMERIC DEFAULT 0.00, -- Internal handling cost
    
    -- Assignment
    courier_name TEXT REFERENCES users(username) ON UPDATE CASCADE ON DELETE SET NULL,
    
    -- Operational Statuses Check
    status TEXT NOT NULL CHECK (status IN (
        'جديد', 
        'جاهز للاستلام', 
        'مع المندوب', 
        'قيد التنفيذ', 
        'تم التسليم', 
        'تسليم جزئي', 
        'مؤجل', 
        'مرتجع بالمستودع', 
        'مرتجع تم تسليمه للمورد', 
        'مرتجع والعميل دفع الشحن',
        'مؤرشف',
        'لا يوجد رد'
    )),
    
    -- Returns Queue & Delayed controls
    notes TEXT,
    delivered_date TIMESTAMPTZ,
    returned_date TIMESTAMPTZ,
    added_by TEXT,
    
    -- Automatic Calculation Outputs
    commission NUMERIC DEFAULT 0.00,  -- Courier commission
    vendor_net NUMERIC DEFAULT 0.00,  -- Net wallet addition for merchant
    
    return_shipping_type TEXT DEFAULT '' CHECK (return_shipping_type IN ('paid', 'unpaid', '')),
    return_queue_status TEXT DEFAULT '',
    return_queue_agent TEXT DEFAULT '',
    
    -- Partial delivery logs
    is_partial BOOLEAN DEFAULT FALSE,
    partial_amount NUMERIC DEFAULT 0.00,
    actual_received_cash NUMERIC DEFAULT 0.00,
    
    -- Geospatial coordinates
    lat DOUBLE PRECISION,
    lng DOUBLE PRECISION
);

-- Core High-Performance Indexes
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(status);
CREATE INDEX IF NOT EXISTS idx_shipments_courier ON shipments(courier_name);
CREATE INDEX IF NOT EXISTS idx_shipments_vendor ON shipments(vendor_name);
CREATE INDEX IF NOT EXISTS idx_shipments_order_date ON shipments(order_date);

-- --------------------------------------------------------------------
-- 5. Create Daily Settlements Table
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS daily_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    courier_name TEXT REFERENCES users(username) ON UPDATE CASCADE ON DELETE RESTRICT,
    settlement_date DATE DEFAULT CURRENT_DATE,
    total_collected NUMERIC DEFAULT 0.00,
    total_commission NUMERIC DEFAULT 0.00,
    net_cash_handed_over NUMERIC DEFAULT 0.00,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'closed')),
    approved_by TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (courier_name, settlement_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_settlements_courier_date ON daily_settlements(courier_name, settlement_date);

-- --------------------------------------------------------------------
-- 6. Auxiliary Operational Logs Tables (Audit Trail)
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS supplier_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_name TEXT REFERENCES vendors(name) ON UPDATE CASCADE ON DELETE RESTRICT,
    date TIMESTAMPTZ DEFAULT NOW(),
    type TEXT NOT NULL, -- 'أوردر مستلم', 'مرتجع', 'تسوية', 'دفع نقدي'
    tracking TEXT,
    amount NUMERIC NOT NULL,
    desc_text TEXT,
    balance_after NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date TIMESTAMPTZ DEFAULT NOW(),
    category TEXT NOT NULL,
    description TEXT,
    amount NUMERIC NOT NULL,
    by_user TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- --------------------------------------------------------------------
-- 7. Automate Vendor Net & Courier Commission Calculations
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_shipment_financials_tg()
RETURNS TRIGGER AS $$
DECLARE
    v_success_comm NUMERIC := 25.00;
    v_return_comm NUMERIC := 10.00;
BEGIN
    -- Fetch active commissions from the courier's user record if assigned
    IF NEW.courier_name IS NOT NULL THEN
        SELECT COALESCE(commission_success, 25.00), COALESCE(commission_return, 10.00)
        INTO v_success_comm, v_return_comm
        FROM users
        WHERE username = NEW.courier_name;
    END IF;

    -- Ensure prod_price / total_cod mathematical integrity
    IF NEW.total_cod > 0 AND NEW.prod_price = 0 THEN
        NEW.prod_price := NEW.total_cod - NEW.ship_price;
    ELSIF NEW.prod_price > 0 AND NEW.ship_price > 0 AND NEW.total_cod = 0 THEN
        NEW.total_cod := NEW.prod_price + NEW.ship_price;
    END IF;

    -- Calculate Courier Commission based on Shipment Status and Return Config
    IF NEW.status IN ('تم التسليم', 'تم التسليم بنجاح') OR NEW.is_partial = TRUE OR NEW.status = 'تسليم جزئي' THEN
        NEW.commission := v_success_comm;
    ELSIF NEW.status IN ('مرتجع', 'مرتجع بالمستودع') THEN
        IF NEW.return_shipping_type = 'paid' OR NEW.status = 'مرتجع والعميل دفع الشحن' THEN
            NEW.commission := v_success_comm; -- Paid return earns full success rate
        ELSE
            NEW.commission := v_return_comm;  -- Unpaid return earns base return rate
        END IF;
    ELSE
        NEW.commission := 0.00; -- No commission for pending/undelivered states
    END IF;

    -- Calculate Vendor Net (Wallet credit value)
    IF NEW.status IN ('تم التسليم', 'تم التسليم بنجاح') THEN
        NEW.vendor_net := NEW.total_cod - NEW.ship_price;
    ELSIF NEW.is_partial = TRUE OR NEW.status = 'تسليم جزئي' THEN
        NEW.vendor_net := COALESCE(NEW.actual_received_cash, NEW.partial_amount, 0) - NEW.ship_price;
    ELSIF NEW.status IN ('مرتجع', 'مرتجع بالمستودع') AND NEW.return_shipping_type = 'paid' THEN
        NEW.vendor_net := -NEW.ship_price; -- Shipping cost debited from Vendor
    ELSE
        NEW.vendor_net := 0.00;
    END IF;

    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_shipments_financial_integrity
BEFORE INSERT OR UPDATE ON shipments
FOR EACH ROW
EXECUTE FUNCTION process_shipment_financials_tg();

-- --------------------------------------------------------------------
-- 8. Automate Vendor Wallet Synchronization Trigger
-- --------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_vendor_wallet_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- This trigger automatically updates vendor.wallet_balance when a supplier ledger entry is recorded
    IF TG_OP = 'INSERT' THEN
        UPDATE vendors
        SET wallet_balance = wallet_balance + NEW.amount
        WHERE name = NEW.vendor_name;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE vendors
        SET wallet_balance = wallet_balance - OLD.amount
        WHERE name = OLD.vendor_name;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tg_sync_vendor_wallet
AFTER INSERT OR DELETE ON supplier_ledger
FOR EACH ROW
EXECUTE FUNCTION sync_vendor_wallet_balance();

COMMIT;
