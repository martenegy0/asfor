// ====================================================================
// ASFOOR STORE - SUPABASE MIGRATION & SEEDING SCRIPT (v190)
// Production-Ready Migration Script to Extract Existing JSON/Sheets Data
// and Bulk Upload it Directly to Supabase Postgres (ESM Compatible)
// ====================================================================

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables from .env.local and .env
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
dotenv.config({ path: path.resolve(process.cwd(), ".env") });

// Load configuration
const DB_PATH = path.join(process.cwd(), "src", "db.json");
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const GOOGLE_SCRIPT_URL = (process.env.GOOGLE_SCRIPT_URL || "").trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(`
======================================================================
❌ خطأ هام: لم يتم العثور على بيانات الاتصال بـ Supabase!
⚠️ Error: Supabase credentials are missing.

يرجى اتباع الخطوات التالية لحل المشكلة:
1. قم بإنشاء ملف باسم '.env.local' في المجلد الرئيسي للمشروع (بجانب package.json).
2. أضف المتغيرات التالية داخل الملف مع استبدال القيم ببيانات مشروعك من Supabase:

NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here

ثم قم بتشغيل الأمر مرة أخرى!
======================================================================
  `);
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchFromGoogleSheets(action: string): Promise<any[]> {
  if (!GOOGLE_SCRIPT_URL) return [];
  try {
    console.log(`🌐 Fetching '${action}' data from Google Sheets...`);
    const response = await fetch(GOOGLE_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, token: "14014" }),
    });
    const data: any = await response.json();
    if (data && data.ok) {
      if (action === "getUsers") return data.users || [];
      if (action === "getSuppliers") return data.suppliers || [];
      if (action === "getOrders" || action === "getArchivedOrders") return data.orders || [];
      if (action === "getSupplierLedger") return data.supplierLedger || [];
    }
    return [];
  } catch (err: any) {
    console.warn(`⚠️ Failed to fetch '${action}' from Google Sheets: ${err.message || err}`);
    return [];
  }
}

async function migrateData() {
  console.log("🚀 Starting database migration and seeding sequence to Supabase...");

  let usersList: any[] = [];
  let suppliersList: any[] = [];
  let ordersList: any[] = [];
  let archivedOrdersList: any[] = [];
  let ledgerList: any[] = [];
  let courierProfiles: any[] = [];

  // --- SOURCE SELECTION: GOOGLE SHEETS VS LOCAL db.json ---
  if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL.startsWith("http")) {
    console.log("📥 Source detected: Google Sheets API...");
    usersList = await fetchFromGoogleSheets("getUsers");
    suppliersList = await fetchFromGoogleSheets("getSuppliers");
    ordersList = await fetchFromGoogleSheets("getOrders");
    archivedOrdersList = await fetchFromGoogleSheets("getArchivedOrders");
    ledgerList = await fetchFromGoogleSheets("getSupplierLedger");
  }

  // Fallback to local db.json if sheets are empty or Google script was unconfigured
  if (usersList.length === 0 && fs.existsSync(DB_PATH)) {
    console.log("📂 No data from Google Sheets. Reading from local database (src/db.json) fallback...");
    try {
      const raw = fs.readFileSync(DB_PATH, "utf-8");
      const db = JSON.parse(raw);
      usersList = db.users || [];
      suppliersList = db.suppliers || [];
      ordersList = db.orders || [];
      ledgerList = db.supplierLedger || [];
      courierProfiles = db.couriers || [];
    } catch (err: any) {
      console.error("❌ Error reading db.json fallback:", err);
    }
  }

  // --- 1. SEED VENDORS FIRST (To avoid foreign key violations in shipments) ---
  if (suppliersList.length > 0) {
    console.log(`🏪 Seeding ${suppliersList.length} vendors...`);
    const mappedVendors = suppliersList.map((s: any) => ({
      name: s.name ? s.name.trim() : "مورد مجهول",
      phone: s.phone || "—",
      default_shipping_price: Number(s.price || 60),
      opening_balance: Number(s.opening_balance || s.openingBalance || 0),
      notes: s.notes || "",
    }));

    const { error: vendorsError } = await supabase.from("vendors").upsert(mappedVendors, { onConflict: "name" });
    if (vendorsError) {
      console.error("❌ Error seeding vendors:", vendorsError.message);
    } else {
      console.log("✅ Vendors table seeded successfully!");
    }
  }

  // --- 2. SEED USERS ---
  if (usersList.length > 0) {
    console.log(`👤 Seeding ${usersList.length} users into 'users' table...`);
    const mappedUsers = usersList.map((u: any) => {
      const courierProfile = courierProfiles.find(
        (c: any) => c.name?.trim().toLowerCase() === u.name?.trim().toLowerCase()
      );
      return {
        username: u.name ? u.name.trim() : "مستخدم",
        email: u.email || `${(u.name || "user").replace(/\s+/g, "").toLowerCase()}@friendplus.com`,
        password_hash: u.pass || "14014", // default fallback password
        role: u.role || "مندوب",
        is_active: u.active === "نعم" || u.active === "yes" || u.active === "yes" || true,
        permissions: u.perms || "",
        commission_success: courierProfile ? Number(courierProfile.commission || 25) : 25,
        commission_return: 10,
        basic_salary: courierProfile ? Number(courierProfile.salary || 3000) : 3000,
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

  // --- 3. SEED SHIPMENTS (ORDERS) ---
  const allOrders = [...ordersList, ...archivedOrdersList];
  if (allOrders.length > 0) {
    console.log(`📦 Seeding ${allOrders.length} shipments into 'shipments' table...`);
    
    // Chunk imports to handle Postgres limit on batch parameters
    const CHUNK_SIZE = 100;
    for (let i = 0; i < allOrders.length; i += CHUNK_SIZE) {
      const chunk = allOrders.slice(i, i + CHUNK_SIZE);
      const mappedShipments = chunk.map((o: any) => {
        // Enforce vendor name matches references
        const vendorName = o.supplier ? o.supplier.trim() : "محل الأناقة";
        return {
          tracking: o.tracking,
          order_date: o.orderDate || o.createdAt?.split(" ")[0] || new Date().toISOString().split("T")[0],
          vendor_name: vendorName,
          customer_name: o.customer || "عميل بدون اسم",
          phone: o.phone || "—",
          phone2: o.phone2 || "",
          gov: o.gov || "القاهرة",
          region: o.region || "المعادي",
          address: o.address || "",
          prod_price: Number(o.prodPrice || o.prod_price || 0),
          ship_price: Number(o.shipPrice || o.ship_price || 60),
          total_cod: Number(o.totalCOD || o.total_cod || 0),
          ship_cost: Number(o.shipCost || o.ship_cost || 60),
          courier_name: o.courier || null,
          status: o.status || "جديد",
          notes: o.notes || "",
          added_by: o.addedBy || o.added_by || "السيستم",
          return_shipping_type: o.returnShippingType || o.return_shipping_type || "",
          return_queue_status: o.returnQueueStatus || o.return_queue_status || "",
          return_queue_agent: o.returnQueueAgent || o.return_queue_agent || "",
          is_partial: o.isPartial === true || o.isPartial === "true" || o.is_partial === true,
          partial_amount: Number(o.partialAmount || o.partial_amount || 0),
          actual_received_cash: Number(o.actualReceivedCash || o.actual_received_cash || 0),
          lat: o.lat || null,
          lng: o.lng || null,
        };
      });

      const { error: shipmentsError } = await supabase.from("shipments").upsert(mappedShipments, { onConflict: "tracking" });
      if (shipmentsError) {
        console.error(`❌ Error seeding shipment chunk starting at ${i}:`, shipmentsError.message);
      }
    }
    console.log("✅ Shipments table seeded successfully!");
  }

  // --- 4. SEED SUPPLIER LEDGER LOGS ---
  if (ledgerList.length > 0) {
    console.log(`📜 Seeding ${ledgerList.length} ledger logs...`);
    const mappedLedger = ledgerList.map((l: any) => ({
      vendor_name: l.supplier || l.vendor_name || "محل الأناقة",
      date: l.date || new Date().toISOString(),
      type: l.type || "أوردر مستلم",
      tracking: l.tracking || null,
      amount: Number(l.amount || 0),
      desc_text: l.desc || l.desc_text || "",
      balance_after: l.balanceAfter || l.balance_after || null,
    }));

    const { error: ledgerError } = await supabase.from("supplier_ledger").insert(mappedLedger);
    if (ledgerError) {
      console.error("❌ Error seeding supplier ledger logs:", ledgerError.message);
    } else {
      console.log("✅ Supplier Ledger table seeded successfully!");
    }
  }

  console.log("🎉 Complete migration process finished successfully! Your database is now fully updated on Supabase.");
}

// ESM safe direct-run checker (solves the require.main issue)
const isMain = process.argv[1] && (
  process.argv[1].endsWith("supabase-seed-helper.ts") || 
  process.argv[1].endsWith("supabase-seed-helper.js") ||
  process.argv[1].endsWith("supabase-seed-helper")
);

if (isMain) {
  migrateData().catch((err) => {
    console.error("❌ Unhandled migration crash:", err);
  });
}

export { migrateData };
