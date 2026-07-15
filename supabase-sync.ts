// ====================================================================
// ASFOOR STORE - SUPABASE BIDIRECTIONAL SYNC ENGINE (v190)
// High-Performance Data Mappings, Syncers, and Fallback Handlers
// ====================================================================

import { supabase } from "./supabase-client.js";

// Helper to convert date strings to PostgreSQL compliant timestamps or ISO
function toIsoTimestamp(str: string | undefined | null): string | null {
  if (!str) return null;
  try {
    const d = new Date(str);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

// --------------------------------------------------------------------
// 1. MAPPING FROM SUPABASE TO LOCAL FORMAT
// --------------------------------------------------------------------
export function mapUserFromSupabase(u: any): any {
  return {
    name: u.username,
    email: u.email,
    pass: u.password_hash,
    role: u.role,
    active: u.is_active ? "نعم" : "لا",
    perms: u.permissions || "متابعة محدودة",
    commission_success: u.commission_success,
    commission_return: u.commission_return,
    salary: u.basic_salary,
    region: u.region,
  };
}

export function mapVendorFromSupabase(v: any): any {
  return {
    name: v.name,
    phone: v.phone || "",
    price: Number(v.default_shipping_price || 60),
    opening_balance: Number(v.opening_balance || 0),
    wallet_balance: Number(v.wallet_balance || 0),
    notes: v.notes || "",
  };
}

export function mapShipmentFromSupabase(s: any): any {
  return {
    tracking: s.tracking,
    createdAt: s.created_at ? new Date(s.created_at).toLocaleString("en-US", { hour12: false }).replace(",", "") : "",
    updatedAt: s.updated_at ? new Date(s.updated_at).toLocaleString("en-US", { hour12: false }).replace(",", "") : "",
    orderDate: s.order_date || "",
    supplier: s.vendor_name || "",
    customer: s.customer_name || "",
    phone: s.phone || "",
    phone2: s.phone2 || "",
    gov: s.gov || "",
    region: s.region || "",
    address: s.address || "",
    prodPrice: Number(s.prod_price || 0),
    shipPrice: Number(s.ship_price || 60),
    totalCOD: Number(s.total_cod || 0),
    shipCost: Number(s.ship_cost || 60),
    courier: s.courier_name || "",
    status: s.status || "جديد",
    notes: s.notes || "",
    delivDate: s.delivered_date ? new Date(s.delivered_date).toLocaleString("en-US", { hour12: false }).replace(",", "") : "",
    retDate: s.returned_date ? new Date(s.returned_date).toLocaleString("en-US", { hour12: false }).replace(",", "") : "",
    addedBy: s.added_by || "",
    commission: Number(s.commission || 0),
    returnShippingType: s.return_shipping_type || "",
    returnQueueStatus: s.return_queue_status || "",
    returnQueueAgent: s.return_queue_agent || "",
    isPartial: s.is_partial || false,
    partialAmount: Number(s.partial_amount || 0),
    actualReceivedCash: Number(s.actual_received_cash || 0),
    lat: s.lat || null,
    lng: s.lng || null,
  };
}

export function mapLedgerFromSupabase(l: any): any {
  return {
    supplier: l.vendor_name,
    date: l.date ? new Date(l.date).toLocaleString("en-US", { hour12: false }).replace(",", "") : "",
    type: l.type,
    tracking: l.tracking || "",
    amount: Number(l.amount || 0),
    desc: l.desc_text || "",
    balanceAfter: l.balance_after ? Number(l.balance_after) : null,
  };
}

export function mapExpenseFromSupabase(e: any): any {
  return {
    date: e.date ? new Date(e.date).toLocaleString("en-US", { hour12: false }).replace(",", "") : "",
    cat: e.category,
    desc: e.description || "",
    amount: Number(e.amount || 0),
    by: e.by_user || "",
  };
}

// --------------------------------------------------------------------
// 2. MAPPING FROM LOCAL TO SUPABASE FORMAT
// --------------------------------------------------------------------
export function mapUserToSupabase(u: any): any {
  return {
    username: u.name,
    email: u.email || `${(u.name || "user").replace(/\s+/g, "").toLowerCase()}@friendplus.com`,
    password_hash: u.pass || "14014",
    role: u.role || "مندوب",
    is_active: u.active === "نعم" || u.active === "yes" || true,
    permissions: u.perms || "",
    commission_success: Number(u.commission_success || u.commission || 25),
    commission_return: Number(u.commission_return || 10),
    basic_salary: Number(u.salary || u.basic_salary || 3000),
    region: u.region || null,
  };
}

export function mapVendorToSupabase(s: any): any {
  return {
    name: s.name,
    phone: s.phone || "",
    default_shipping_price: Number(s.price || 60),
    opening_balance: Number(s.opening_balance || s.openingBalance || 0),
    notes: s.notes || "",
  };
}

export function mapShipmentToSupabase(o: any): any {
  return {
    tracking: o.tracking,
    order_date: o.orderDate || o.createdAt?.split(" ")[0] || new Date().toISOString().split("T")[0],
    vendor_name: o.supplier || "محل الأناقة",
    customer_name: o.customer || "عميل",
    phone: o.phone || "—",
    phone2: o.phone2 || "",
    gov: o.gov || "القاهرة",
    region: o.region || "المعادي",
    address: o.address || "",
    prod_price: Number(o.prodPrice || 0),
    ship_price: Number(o.shipPrice || 60),
    total_cod: Number(o.totalCOD || 0),
    ship_cost: Number(o.shipCost || 60),
    courier_name: o.courier || null,
    status: o.status || "جديد",
    notes: o.notes || "",
    delivered_date: toIsoTimestamp(o.delivDate),
    returned_date: toIsoTimestamp(o.retDate),
    added_by: o.addedBy || "السيستم",
    commission: Number(o.commission || 0),
    return_shipping_type: o.returnShippingType || "",
    return_queue_status: o.returnQueueStatus || "",
    return_queue_agent: o.returnQueueAgent || "",
    is_partial: o.isPartial === true || o.isPartial === "true" || false,
    partial_amount: Number(o.partialAmount || 0),
    actual_received_cash: Number(o.actualReceivedCash || 0),
    lat: o.lat || null,
    lng: o.lng || null,
  };
}

export function mapLedgerToSupabase(l: any): any {
  return {
    vendor_name: l.supplier || l["المورد"] || "محل الأناقة",
    date: toIsoTimestamp(l.date),
    type: l.type,
    tracking: l.tracking || null,
    amount: Number(l.amount || 0),
    desc_text: l.desc || "",
    balance_after: l.balanceAfter ? Number(l.balanceAfter) : null,
  };
}

export function mapExpenseToSupabase(e: any): any {
  return {
    date: toIsoTimestamp(e.date),
    category: e.cat,
    description: e.desc || "",
    amount: Number(e.amount || 0),
    by_user: e.by || "",
  };
}

// --------------------------------------------------------------------
// 3. MASTER LOAD DATABASE FROM SUPABASE
// --------------------------------------------------------------------
export async function loadDbFromSupabase(): Promise<any> {
  console.log("🔄 Loading full database state from Supabase PostgreSQL...");
  try {
    const [usersRes, vendorsRes, shipmentsRes, ledgerRes, expensesRes] = await Promise.all([
      supabase.from("users").select("*"),
      supabase.from("vendors").select("*"),
      supabase.from("shipments").select("*"),
      supabase.from("supplier_ledger").select("*"),
      supabase.from("expenses").select("*"),
    ]);

    if (usersRes.error) throw usersRes.error;
    if (vendorsRes.error) throw vendorsRes.error;
    if (shipmentsRes.error) throw shipmentsRes.error;
    if (ledgerRes.error) throw ledgerRes.error;
    if (expensesRes.error) throw expensesRes.error;

    const mappedUsers = (usersRes.data || []).map(mapUserFromSupabase);
    const mappedSuppliers = (vendorsRes.data || []).map(mapVendorFromSupabase);
    
    // Sort orders into active (not archived) and archived
    const allShipments = (shipmentsRes.data || []).map(mapShipmentFromSupabase);
    const orders = allShipments.filter((s: any) => s.status !== "مؤرشف");
    const archivedOrders = allShipments.filter((s: any) => s.status === "مؤرشف");

    const supplierLedger = (ledgerRes.data || []).map(mapLedgerFromSupabase);
    const expenses = (expensesRes.data || []).map(mapExpenseFromSupabase);

    // Build the couriers metadata list used by selectors in frontend
    const couriers = (usersRes.data || [])
      .filter((u: any) => u.role === "مندوب")
      .map((u: any) => ({
        name: u.username,
        phone: u.phone || "—",
        commission: u.commission_success || 25,
        salary: u.basic_salary || 3000,
        region: u.region || "—",
      }));

    return {
      users: mappedUsers,
      suppliers: mappedSuppliers,
      couriers,
      orders,
      archivedOrders,
      supplierLedger,
      expenses,
      cashbox: [], // Dynamically populated locally or on demand
      statusHistory: [],
      staffPermissions: [],
      settings: {
        COUNTER: 1000 + orders.length + archivedOrders.length,
        COMPANY: "عصفور ستور",
        VERSION: "6.0-Supabase",
      },
    };
  } catch (err: any) {
    console.error("❌ Failed to load from Supabase, returning null to trigger local fallback:", err.message || err);
    return null;
  }
}

// --------------------------------------------------------------------
// 4. MASTER SAVE / SYNC SINGLE OPERATIONS
// --------------------------------------------------------------------
export async function syncOrderToSupabase(order: any) {
  const payload = mapShipmentToSupabase(order);
  const { error } = await supabase.from("shipments").upsert(payload, { onConflict: "tracking" });
  if (error) console.error(`❌ Supabase order sync failed for ${order.tracking}:`, error.message);
}

export async function syncUserToSupabase(user: any) {
  const payload = mapUserToSupabase(user);
  const { error } = await supabase.from("users").upsert(payload, { onConflict: "username" });
  if (error) console.error(`❌ Supabase user sync failed for ${user.name}:`, error.message);
}

export async function syncSupplierToSupabase(supplier: any) {
  const payload = mapVendorToSupabase(supplier);
  const { error } = await supabase.from("vendors").upsert(payload, { onConflict: "name" });
  if (error) console.error(`❌ Supabase vendor sync failed for ${supplier.name}:`, error.message);
}

export async function syncLedgerToSupabase(ledger: any) {
  const payload = mapLedgerToSupabase(ledger);
  const { error } = await supabase.from("supplier_ledger").insert(payload);
  if (error) console.error(`❌ Supabase ledger sync failed:`, error.message);
}

export async function syncExpenseToSupabase(expense: any) {
  const payload = mapExpenseToSupabase(expense);
  const { error } = await supabase.from("expenses").insert(payload);
  if (error) console.error(`❌ Supabase expense sync failed:`, error.message);
}
