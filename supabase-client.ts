// ====================================================================
// ASFOOR STORE - SUPABASE CLIENT CONFIGURATION & ADAPTERS (v190)
// Production-Ready Native Client Integration
// ====================================================================

import { createClient } from "@supabase/supabase-js";

// 1. Environment Variable Structure (Plugged securely into Vercel or local .env)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "⚠️ Supabase URL or Anon Key is missing! Ensure VITE_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL is configured."
  );
}

// 2. Instantiate the Supabase Client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// ====================================================================
// 3. Complete Database Adapters to Replace Old Local/Google Sheets API
// ====================================================================

// --- Users & Authenticated Sessions ---
export async function getSupabaseUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("username", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertSupabaseUser(user: any) {
  const { data, error } = await supabase
    .from("users")
    .upsert({
      username: user.username || user.name,
      email: user.email,
      password_hash: user.password_hash || user.pass, // Prefer hashed passwords!
      role: user.role,
      is_active: user.active === "نعم" || user.is_active === true,
      permissions: user.perms || user.permissions,
      supervisor_id: user.supervisor_id,
      commission_success: user.commission_success || 25,
      commission_return: user.commission_return || 10,
      basic_salary: user.basic_salary || user.salary || 3000,
      region: user.region,
    })
    .select();
  if (error) throw error;
  return data;
}

// --- Vendors (Suppliers) Wallet & Accounts ---
export async function getSupabaseVendors() {
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function upsertSupabaseVendor(vendor: any) {
  const { data, error } = await supabase
    .from("vendors")
    .upsert({
      name: vendor.name,
      phone: vendor.phone,
      default_shipping_price: vendor.default_shipping_price || vendor.price || 60,
      opening_balance: vendor.opening_balance || vendor.openingBalance || 0,
      notes: vendor.notes,
    })
    .select();
  if (error) throw error;
  return data;
}

// --- Shipments Engine CRUD (Replacements for spreadsheet sheets) ---
export async function getSupabaseShipments(filters: { status?: string; courier_name?: string; vendor_name?: string } = {}) {
  let query = supabase.from("shipments").select("*");
  
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.courier_name) query = query.eq("courier_name", filters.courier_name);
  if (filters.vendor_name) query = query.eq("vendor_name", filters.vendor_name);
  
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function insertSupabaseShipment(shipment: any) {
  const { data, error } = await supabase
    .from("shipments")
    .insert({
      tracking: shipment.tracking,
      vendor_name: shipment.supplier || shipment.vendor_name,
      customer_name: shipment.customer || shipment.customer_name,
      phone: shipment.phone,
      phone2: shipment.phone2 || "",
      gov: shipment.gov,
      region: shipment.region,
      address: shipment.address,
      prod_price: Number(shipment.prodPrice || shipment.prod_price || 0),
      ship_price: Number(shipment.shipPrice || shipment.ship_price || 0),
      ship_cost: Number(shipment.shipCost || shipment.ship_cost || 0),
      courier_name: shipment.courier || shipment.courier_name || null,
      status: shipment.status || "جديد",
      notes: shipment.notes || "",
      added_by: shipment.addedBy || shipment.added_by,
      return_shipping_type: shipment.returnShippingType || shipment.return_shipping_type || "",
      return_queue_status: shipment.returnQueueStatus || shipment.return_queue_status || "",
      return_queue_agent: shipment.returnQueueAgent || shipment.return_queue_agent || "",
      is_partial: shipment.isPartial === true || shipment.is_partial === true || false,
      partial_amount: Number(shipment.partialAmount || shipment.partial_amount || 0),
      actual_received_cash: Number(shipment.actualReceivedCash || shipment.actual_received_cash || 0),
      lat: shipment.lat,
      lng: shipment.lng,
    })
    .select();
  if (error) throw error;
  return data;
}

export async function updateSupabaseShipmentStatus(trackingId: string, status: string, additionalFields: any = {}) {
  const { data, error } = await supabase
    .from("shipments")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...additionalFields,
    })
    .eq("tracking", trackingId)
    .select();
  if (error) throw error;
  return data;
}

// --- Daily Settlement System ---
export async function getCourierDailySettlements(courierName: string) {
  const { data, error } = await supabase
    .from("daily_settlements")
    .select("*")
    .eq("courier_name", courierName)
    .order("settlement_date", { ascending: false });
  if (error) throw error;
  return data;
}

export async function closeCourierDay(courierName: string, settlementDate: string, summary: any) {
  const { data, error } = await supabase
    .from("daily_settlements")
    .upsert({
      courier_name: courierName,
      settlement_date: settlementDate,
      total_collected: summary.totalCollected,
      total_commission: summary.totalCommission,
      net_cash_handed_over: summary.netCashHandedOver,
      status: "closed",
      approved_by: summary.approvedBy,
      notes: summary.notes,
    })
    .select();
  if (error) throw error;
  return data;
}
