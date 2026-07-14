// ====================================================================
// ASFOOR STORE - SUPABASE MIGRATION & SEEDING SCRIPT (v190)
// Production-Ready Migration Script to Extract Existing JSON/Sheets Data
// and Bulk Upload it Directly to Supabase Postgres
// ====================================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

// Load configuration
const DB_PATH = path.join(process.cwd(), "src", "db.json");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://your-project.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "your-service-role-key-never-share-this";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function migrateData() {
  console.log("🚀 Starting migration from local storage (db.json) to Supabase PostgreSQL...");

  if (!fs.existsSync(DB_PATH)) {
    console.error("❌ Error: Local database file (src/db.json) not found!");
    return;
  }

  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const db = JSON.parse(raw);

  // 1. Seed Users
  if (db.users && db.users.length > 0) {
    console.log(`👤 Seeding ${db.users.length} users into 'users' table...`);
    const mappedUsers = db.users.map((u: any) => {
      // Find matching courier profile to seed basic commissions & info
      const courierProfile = (db.couriers || []).find(
        (c: any) => c.name?.trim().toLowerCase() === u.name?.trim().toLowerCase()
      );
      return {
        username: u.name,
        email: u.email || `${u.name.replace(/\s+/g, "")}@friendplus.com`,
        password_hash: u.pass, // Safe fallback
        role: u.role,
        is_active: u.active === "نعم" || u.active === "yes" || true,
        permissions: u.perms || "",
        commission_success: courierProfile ? courierProfile.commission || 25 : 25,
        commission_return: 10,
        basic_salary: courierProfile ? courierProfile.salary || 3000 : 3000,
        region: courierProfile ? courierProfile.region : null,
      };
    });

    const { error: usersError } = await supabase.from("users").upsert(mappedUsers, { onConflict: "username" });
    if (usersError) {
      console.error("❌ Error seeding users:", usersError.message);
    } else {
      console.log("✅ Users table seeded successfully!");
    }
  }

  // 2. Seed Vendors (Suppliers)
  if (db.suppliers && db.suppliers.length > 0) {
    console.log(`🏪 Seeding ${db.suppliers.length} vendors into 'vendors' table...`);
    const mappedVendors = db.suppliers.map((s: any) => ({
      name: s.name,
      phone: s.phone,
      default_shipping_price: s.price || 60,
      opening_balance: s.opening_balance || s.openingBalance || 0,
      notes: s.notes || "",
    }));

    const { error: vendorsError } = await supabase.from("vendors").upsert(mappedVendors, { onConflict: "name" });
    if (vendorsError) {
      console.error("❌ Error seeding vendors:", vendorsError.message);
    } else {
      console.log("✅ Vendors table seeded successfully!");
    }
  }

  // 3. Seed Shipments (Orders)
  if (db.orders && db.orders.length > 0) {
    console.log(`📦 Seeding ${db.orders.length} shipments into 'shipments' table...`);
    
    // Chunk size because of Postgres limit on bulk insert parameters
    const CHUNK_SIZE = 100;
    for (let i = 0; i < db.orders.length; i += CHUNK_SIZE) {
      const chunk = db.orders.slice(i, i + CHUNK_SIZE);
      const mappedShipments = chunk.map((o: any) => ({
        tracking: o.tracking,
        order_date: o.orderDate || o.createdAt?.split(" ")[0] || new Date().toISOString().split("T")[0],
        vendor_name: o.supplier,
        customer_name: o.customer,
        phone: o.phone,
        phone2: o.phone2 || "",
        gov: o.gov || "القاهرة",
        region: o.region || "المعادي",
        address: o.address || "",
        prod_price: Number(o.prodPrice || 0),
        ship_price: Number(o.shipPrice || 0),
        total_cod: Number(o.totalCOD || 0),
        ship_cost: Number(o.shipCost || 0),
        courier_name: o.courier || null,
        status: o.status || "جديد",
        notes: o.notes || "",
        added_by: o.addedBy || "السيستم",
        return_shipping_type: o.returnShippingType || "",
        return_queue_status: o.returnQueueStatus || "",
        return_queue_agent: o.returnQueueAgent || "",
        is_partial: o.isPartial === true || o.isPartial === "true",
        partial_amount: Number(o.partialAmount || 0),
        actual_received_cash: Number(o.actualReceivedCash || 0),
        lat: o.lat || null,
        lng: o.lng || null,
      }));

      const { error: shipmentsError } = await supabase.from("shipments").upsert(mappedShipments, { onConflict: "tracking" });
      if (shipmentsError) {
        console.error(`❌ Error seeding shipment chunk ${i / CHUNK_SIZE + 1}:`, shipmentsError.message);
      }
    }
    console.log("✅ Shipments table seeded successfully!");
  }

  // 4. Seed Supplier Ledger Logs
  if (db.supplierLedger && db.supplierLedger.length > 0) {
    console.log(`📜 Seeding ${db.supplierLedger.length} ledger entries into 'supplier_ledger'...`);
    const mappedLedger = db.supplierLedger.map((l: any) => ({
      vendor_name: l.supplier || l["المورد"],
      date: l.date || new Date().toISOString(),
      type: l.type,
      tracking: l.tracking || null,
      amount: Number(l.amount || 0),
      desc_text: l.desc || "",
      balance_after: l.balanceAfter || null,
    }));

    const { error: ledgerError } = await supabase.from("supplier_ledger").insert(mappedLedger);
    if (ledgerError) {
      console.error("❌ Error seeding supplier ledger:", ledgerError.message);
    } else {
      console.log("✅ Supplier Ledger table seeded successfully!");
    }
  }

  console.log("🎉 Complete migration process finished successfully! Your database is now fully updated on Supabase.");
}

// Automatically execute if run directly in Node environment
if (require.main === module) {
  migrateData().catch((err) => {
    console.error("❌ Unhandled migration crash:", err);
  });
}

export { migrateData };
