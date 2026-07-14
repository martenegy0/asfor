import React, { useState, useEffect } from "react";
import { 
  Calendar, RefreshCw, FileText, Filter, Plus, Save, 
  TrendingUp, DollarSign, Search, AlertCircle, Sparkles, CheckCircle, ArrowLeftRight
} from "lucide-react";
import { apiCall } from "../utils";

interface DailyClosingProps {
  token: string;
  role: string;
  user: string;
  orders?: any[];
}

interface ClosingRecord {
  date: string;
  deliveredCount: number;
  returnedCount: number;
  returnedValue?: number;
  totalCOD: number;
  shippingCost: number;
  addedBy: string;
  pendingCount?: number;
  pendingCOD?: number;
  courierCommissions?: number;
  cashboxIn?: number;
  cashboxOut?: number;
  cashboxNet?: number;
}

export default function DailyClosing({ token, role, user, orders }: DailyClosingProps) {
  // Historical closing states
  const [closingRecords, setClosingRecords] = useState<ClosingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Search & Filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Active Wizard/Calculation states
  const [selectedClosingDate, setSelectedClosingDate] = useState(new Date().toISOString().split("T")[0]);
  const [aggregationBasis, setAggregationBasis] = useState<"delivery" | "creation">("delivery");
  const [calculatedDraft, setCalculatedDraft] = useState<ClosingRecord | null>(null);
  const [calculating, setCalculating] = useState(false);

  // Manual input state
  const [isManualMode, setIsManualMode] = useState(false);
  const [manualDate, setManualDate] = useState(new Date().toISOString().split("T")[0]);
  const [manualDelivered, setManualDelivered] = useState("0");
  const [manualReturned, setManualReturned] = useState("0");
  const [manualCOD, setManualCOD] = useState("0");
  const [manualShip, setManualShip] = useState("0");

  // Detailed orders viewer states
  const [activeDetailDate, setActiveDetailDate] = useState<string | null>(null);
  const [detailOrders, setDetailOrders] = useState<any[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSearch, setDetailSearch] = useState("");
  const [detailStatusFilter, setDetailStatusFilter] = useState("all");

  const isSelectedClosed = closingRecords.some((r) => r.date === selectedClosingDate);
  const isManualClosed = closingRecords.some((r) => r.date === manualDate);

  async function loadDetailOrders(targetDate: string) {
    setActiveDetailDate(targetDate);
    setLoadingDetail(true);
    setDetailSearch("");
    setDetailStatusFilter("all");
    try {
      let ordersList = orders || [];
      if (ordersList.length === 0) {
        const res = await apiCall("getOrders", token);
        if (res.ok && res.orders) {
          ordersList = res.orders || [];
        }
      }
      
      // Filter orders related to targetDate
      const filtered = ordersList.filter((o: any) => {
        const dDate = o.delivDate ? o.delivDate.split(" ")[0] : "";
        const rDate = o.retDate ? o.retDate.split(" ")[0] : "";
        const cDate = o.createdAt ? o.createdAt.split(" ")[0] : (o.orderDate ? o.orderDate.split(" ")[0] : "");
        return dDate === targetDate || rDate === targetDate || cDate === targetDate;
      });
      setDetailOrders(filtered);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingDetail(false);
    }
  }

  // Fetch all existing closings
  async function fetchClosingRecords() {
    setLoading(true);
    setErrorMsg("");
    try {
      const res = await apiCall("getDailyClosing", token);
      if (res.ok) {
        // Normalize returned values to ensure typescript-safety
        const normalized: ClosingRecord[] = (res.records || []).map((item: any) => ({
          date: item.date || "",
          deliveredCount: Number(item.deliveredCount || 0),
          returnedCount: Number(item.returnedCount || 0),
          totalCOD: Number(item.totalCOD || 0),
          shippingCost: Number(item.shippingCost || 0),
          addedBy: item.addedBy || "النظام"
        }));
        // Sort chronologically (latest first)
        normalized.sort((a, b) => b.date.localeCompare(a.date));
        setClosingRecords(normalized);
      } else {
        setErrorMsg(res.error || "خطأ في استيراد تقارير التقفيل اليومي من الشيت المركزي");
      }
    } catch (err: any) {
      setErrorMsg("عطل اتصال: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  }

  // Calculate stats on-the-fly from the live orders sheet to generate a reliable draft
  async function calculateLiveDraft() {
    setCalculating(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      // Use locally loaded orders prop where available for high-speed client-side calculation, fallback to API
      let ordersList = orders || [];
      if (ordersList.length === 0) {
        const res = await apiCall("getOrders", token);
        if (res.ok && res.orders) {
          ordersList = res.orders || [];
        }
      }

       if (ordersList.length >= 0) {
        const targetDate = selectedClosingDate.trim();

        // Deduplicate the ordersList by tracking ID to avoid duplication counting
        const uniqueOrdersMap: { [key: string]: any } = {};
        ordersList.forEach((o: any) => {
          const track = (o.tracking || "").toString().trim();
          if (track) {
            uniqueOrdersMap[track] = o;
          } else {
            uniqueOrdersMap["no-track-" + Math.random()] = o;
          }
        });
        const dedupedOrders = Object.values(uniqueOrdersMap);

        // Safe lowercase status filter matching
        const normalizeToYMD = (val: any) => {
          if (!val) return "";
          const str = val.toString().trim();
          const matchYMD = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
          if (matchYMD) {
            return `${matchYMD[1]}-${matchYMD[2].padStart(2, "0")}-${matchYMD[3].padStart(2, "0")}`;
          }
          const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
          if (matchDMY) {
            return `${matchDMY[3]}-${matchDMY[2].padStart(2, "0")}-${matchDMY[1].padStart(2, "0")}`;
          }
          return str.split(" ")[0].split("T")[0];
        };

        const isDeliveredOnDate = (o: any) => {
          if (o.status !== "تم التسليم" && o.status !== "تسليم جزئي") return false;
          return normalizeToYMD(o.delivDate) === targetDate;
        };

        const isReturnedOnDate = (o: any) => {
          const isRetStatus = [
            "مرتجع", 
            "التسليم للمورد", 
            "تم تسليم المرتجع للمورد", 
            "مرتجع تم تسليمه للمورد", 
            "تم تسليم المرتجع للمورد وتصفية حسابه",
            "مرتجع والعميل دفع الشحن",
            "مرتجع مدفوع الشحن"
          ].includes(o.status) || (o.status || "").includes("مرتجع");
          if (!isRetStatus) return false;
          return normalizeToYMD(o.retDate || o.delivDate) === targetDate;
        };

        const isCreatedOnDate = (o: any) => {
          return normalizeToYMD(o.orderDate || o.createdAt) === targetDate;
        };

        const isDeliveredToSupplier = (o: any) => {
          return ["تم تسليم المرتجع للمورد", "التسليم للمورد", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه"].includes(o.status);
        };

        let delivered = 0;
        let returned = 0;
        let returnedValue = 0;
        let cod = 0;
        let shipping = 0;
        let pendingCount = 0;
        let pendingCOD = 0;
        let courierCommissions = 0;
        let returnedDeliveredToSupplierCount = 0;
        let returnedDeliveredToSupplierValue = 0;

        // Dynamic check of Cashbox database entries for live checking
        let cashboxIn = 0;
        let cashboxOut = 0;
        try {
          const cashboxRes = await apiCall("cashbox", token);
          if (cashboxRes && cashboxRes.ok && Array.isArray(cashboxRes.entries)) {
            cashboxRes.entries.forEach((item: any) => {
              if (item.date) {
                const entryYMD = item.date.substring(0, 10);
                if (entryYMD === targetDate) {
                  const isDeposit = ["وارد", "تحصيل مندوب", "إيداع خزنة direct", "إيداع", "استلام عهدة مندوب"].includes(item.type);
                  const amt = Number(item.amount || 0);
                  if (isDeposit) {
                    cashboxIn += amt;
                  } else {
                    cashboxOut += amt;
                  }
                }
              }
            });
          }
        } catch (e) {
          console.error("Failed to read cashbox for DailyClosing:", e);
        }
        const cashboxNet = cashboxIn - cashboxOut;

        dedupedOrders.forEach((o: any) => {
          // Calculate outstanding (pending) orders created on this target date
          if (isCreatedOnDate(o)) {
            const isClosed = [
              "تم التسليم", 
              "تسليم جزئي",
              "مرتجع", 
              "التسليم للمورد", 
              "تم تسليم المرتجع للمورد", 
              "مرتجع تم تسليمه للمورد", 
              "تم تسليم المرتجع للمورد وتصفية حسابه",
              "مرتجع والعميل دفع الشحن",
              "مرتجع مدفوع الشحن"
            ].includes(o.status) || (o.status || "").includes("مرتجع");
            if (!isClosed) {
              pendingCount++;
              pendingCOD += Number(o.totalCOD || 0);
            }
          }

          if (aggregationBasis === "delivery") {
            // Basis 1: Real-life action updates on that specific day
            if (isDeliveredOnDate(o)) {
              delivered++;
              cod += Number(o.totalCOD || 0);
              shipping += Number(o.shipPrice || o.shipCost || 0);
              courierCommissions += Number(o.commission || 20); // Courier success commission defaults to 20
            }
            if (isReturnedOnDate(o)) {
              returned++; // total collected returns
              returnedValue += Number(o.prodPrice || 0);

              const isPaidReturn = o.returnShippingType === "paid" || o.status === "مرتجع والعميل دفع الشحن" || o.status === "مرتجع مدفوع الشحن";
              if (isPaidReturn) {
                const returnShipCost = Number(o.shipPrice || o.shipCost || 0);
                shipping += returnShipCost;
                cod += returnShipCost; // ADD customer paid return shipping cash to representative's handover COD!
                courierCommissions += Number(o.commission || 20); // paid return gets success commission of 20
              } else {
                courierCommissions += Number(o.commission || 10); // regular returned defaults to 10
              }

              // Check if they were already delivered back to the supplier
              if (isDeliveredToSupplier(o)) {
                returnedDeliveredToSupplierCount++;
                returnedDeliveredToSupplierValue += Number(o.prodPrice || 0);
              }
            }
          } else {
            // Basis 2: Cumulative Order date booking (when the order was registered)
            if (isCreatedOnDate(o)) {
              if (o.status === "تم التسليم" || o.status === "تسليم جزئي") {
                delivered++;
                cod += Number(o.totalCOD || 0);
                shipping += Number(o.shipPrice || o.shipCost || 0);
                courierCommissions += Number(o.commission || 20);
              } else if ([
                "مرتجع", 
                "التسليم للمورد", 
                "تم تسليم المرتجع للمورد", 
                "تم تسليمه للمورد", 
                "مرتجع تم تسليمه للمورد", 
                "تم تسليم المرتجع للمورد وتصفية حسابه",
                "مرتجع والعميل دفع الشحن",
                "مرتجع مدفوع الشحن"
              ].includes(o.status) || (o.status || "").includes("مرتجع")) {
                returned++;
                returnedValue += Number(o.prodPrice || 0);

                const isPaidReturn = o.returnShippingType === "paid" || o.status === "مرتجع والعميل دفع الشحن" || o.status === "مرتجع مدفوع الشحن";
                if (isPaidReturn) {
                  const returnShipCost = Number(o.shipPrice || o.shipCost || 0);
                  shipping += returnShipCost;
                  cod += returnShipCost; // ADD customer paid return shipping cash to representative's handover COD!
                  courierCommissions += Number(o.commission || 20);
                } else {
                  courierCommissions += Number(o.commission || 10);
                }

                if (isDeliveredToSupplier(o)) {
                  returnedDeliveredToSupplierCount++;
                  returnedDeliveredToSupplierValue += Number(o.prodPrice || 0);
                }
              }
            }
          }
        });

        setCalculatedDraft({
          date: targetDate,
          deliveredCount: delivered,
          returnedCount: returned - returnedDeliveredToSupplierCount,
          returnedValue: returnedValue,
          totalCOD: cod,
          shippingCost: shipping,
          addedBy: user,
          pendingCount,
          pendingCOD,
          courierCommissions,
          cashboxIn,
          cashboxOut,
          cashboxNet,
          returnedDeliveredToSupplierCount,
          returnedDeliveredToSupplierValue,
          totalReturnsCollected: returned
        } as any);
      } else {
        setErrorMsg("تعذر تحميل قائمة الأوردرات لحساب التقفيل اللحظي");
      }
    } catch (err: any) {
      setErrorMsg("عطل أثناء الاتصال والحساب: " + (err.message || err));
    } finally {
      setCalculating(false);
    }
  }

  // Trigger Saving Daily Closing record
  async function handleSaveClosing(record: ClosingRecord) {
    setErrorMsg("");
    setSuccessMsg("");

    // Programmatic safety block - Cannot edit locked/submitted days
    if (closingRecords.some((r) => r.date === record.date)) {
      setErrorMsg("⚠️ عذراً، هذا اليوم المالي معتمد ومغلق مسبقاً. البيانات مقفلة بالكامل ولا يمكن التعديل عليها.");
      return;
    }

    // 1. Fire and Forget: Immediately close the draft, show success banner and add to list optimistically
    setCalculatedDraft(null);
    setSuccessMsg(`✅ تم ترحيل وحفظ التقفيل اليومي لـ ${record.date} بنجاح وبدء يوم جديد (جاري الحفظ بالمزامنة الخلفية)`);

    // Let's build the optimistic record
    const optimisticRecord: ClosingRecord = {
      ...record,
      addedBy: record.addedBy || user || "المحاسب",
    };

    setClosingRecords(prev => {
      const filtered = prev.filter(r => r.date !== record.date);
      return [optimisticRecord, ...filtered];
    });

    // 2. Dispatch background sync event to trigger the silent loader in the navbar
    window.dispatchEvent(new CustomEvent("bg-sync-start"));

    // 3. Fire local API in the background silently
    apiCall("addDailyClosing", token, {
      date: record.date,
      deliveredCount: record.deliveredCount,
      returnedCount: record.returnedCount,
      returnedValue: record.returnedValue || 0,
      totalCOD: record.totalCOD,
      shippingCost: record.shippingCost,
      cashboxIn: record.cashboxIn || 0,
      cashboxOut: record.cashboxOut || 0,
      cashboxNet: record.cashboxNet || 0
    })
      .then((res) => {
        if (res && res.ok) {
          console.log("Asynchronous daily closing saved successfully");
          // Silently sync the actual list
          fetchClosingRecords();
        } else {
          setErrorMsg(res?.error || "فشل تسجيل التقفيل بجوجل شيت عند المزامنة الخلفية");
        }
      })
      .catch((err: any) => {
        console.error("Async daily closing synchronization failed:", err);
        setErrorMsg("عطل اتصال أثناء الحفظ الخلفي: " + (err.message || err));
      })
      .finally(() => {
        // Dispatch bg-sync-end and stop silent loading
        window.dispatchEvent(new CustomEvent("bg-sync-end"));
      });
  }

  // Submit custom manual closing
  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!manualDate) {
      setErrorMsg("يرجى تحديد التاريخ");
      return;
    }

    const rec: ClosingRecord = {
      date: manualDate,
      deliveredCount: Number(manualDelivered || 0),
      returnedCount: Number(manualReturned || 0),
      totalCOD: Number(manualCOD || 0),
      shippingCost: Number(manualShip || 0),
      addedBy: user
    };

    await handleSaveClosing(rec);
    // Reset manual fields on success
    setIsManualMode(false);
    setManualDelivered("0");
    setManualReturned("0");
    setManualCOD("0");
    setManualShip("0");
  }

  useEffect(() => {
    fetchClosingRecords();
  }, [token]);

  // Filters calculation
  const filteredRecords = closingRecords.filter(r => {
    // 1. Date filters
    if (startDate && r.date < startDate) return false;
    if (endDate && r.date > endDate) return false;
    
    // 2. Search query (matches date or adder username)
    if (searchQuery) {
      const q = searchQuery.toLowerCase().trim();
      return r.date.includes(q) || r.addedBy.toLowerCase().includes(q);
    }

    return true;
  });

  // Aggregated sums of listed/filtered closings
  const totalDeliveredSum = filteredRecords.reduce((sum, r) => sum + r.deliveredCount, 0);
  const totalReturnedSum = filteredRecords.reduce((sum, r) => sum + r.returnedCount, 0);
  const totalCODSum = filteredRecords.reduce((sum, r) => sum + r.totalCOD, 0);
  const totalShippingSum = filteredRecords.reduce((sum, r) => sum + r.shippingCost, 0);

  return (
    <div id="daily-closing-view" className="p-4 space-y-6 text-right" dir="rtl">
      {/* Upper header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/6 pb-4">
        <div>
          <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
            <span className="p-2 rounded-xl bg-orange-500/10 text-orange-400">
              <Calendar size={22} />
            </span>
            دفتر التقفيل اليومي المجمع
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-semibold">
            رصد ومطابقة الدفاتر اليومية وإقفال الخزينة وحركات المحصل من المندوبين.
          </p>
        </div>
        <button
          onClick={fetchClosingRecords}
          className="self-start md:self-auto flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 border border-white/8 hover:bg-slate-850 text-slate-300 rounded-xl text-xs font-bold transition-all"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-orange-400" : ""} />
          تحديث البيانات
        </button>
      </div>

      {/* Notifications and Alerts */}
      {errorMsg && (
        <div className="p-4 bg-red-950/40 border border-red-500/20 text-red-400 text-xs font-bold rounded-xl flex items-center gap-2">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 text-emerald-400 text-xs font-bold rounded-xl flex items-center gap-2">
          <CheckCircle size={16} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Grid: 1. Wizard Generator / 2. Static Stats Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Module A: Automated closing wizard (Calculates on demand directly from orders) */}
        <div className="lg:col-span-2 bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-white/6 pb-2.5">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-1.5">
              <Sparkles size={16} className="text-orange-400" />
              أداة الترصيد الذكية لليوم المالي
            </h3>
            <span className="px-2 py-0.5 bg-orange-400/10 text-orange-400 text-[10px] font-bold rounded-full">
              تلقائي ومضمون
            </span>
          </div>

          {isSelectedClosed && (
            <div className="p-4 bg-red-950/45 border-r-4 border-red-500 rounded-xl text-red-300 text-xs font-semibold leading-relaxed flex items-start gap-2.5 animate-fade-in">
              <AlertCircle size={16} className="shrink-0 text-red-500 mt-0.5" />
              <span><strong>⚠️ عذراً، تم اعتماد وإغلاق حسابات هذا اليوم من الإدارة والمالية؛ البيانات مؤمنة ومقفلة بالكامل ولا يمكن التعديل عليها نهائياً برمجياً.</strong></span>
            </div>
          )}

          <div className={`grid grid-cols-1 md:grid-cols-3 gap-3 items-end ${isSelectedClosed ? "opacity-60 pointer-events-none" : ""}`}>
            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-1.5">التاريخ المستهدف للتقفيل</label>
              <div className="relative">
                <input
                  type="date"
                  value={selectedClosingDate}
                  disabled={isSelectedClosed}
                  onChange={(e) => {
                    setSelectedClosingDate(e.target.value);
                    setCalculatedDraft(null); // Clear previous draft
                  }}
                  className="w-full bg-slate-950 border border-white/8 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-center"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-black text-slate-400 mb-1.5">طريقة مطابقة البيانات</label>
              <select
                value={aggregationBasis}
                disabled={isSelectedClosed}
                onChange={(e: any) => {
                  setAggregationBasis(e.target.value);
                  setCalculatedDraft(null);
                }}
                className="w-full bg-slate-950 border border-white/8 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-bold"
              >
                <option value="delivery">📅 بناءً على تواريخ تسليم/ارتجاع الأوردرات</option>
                <option value="creation">🆕 بناءً على تواريخ تسجيل الأوردرات</option>
              </select>
            </div>

            <button
              onClick={calculateLiveDraft}
              disabled={calculating || !selectedClosingDate || isSelectedClosed}
              className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 active:scale-98 disabled:opacity-40 text-slate-950 hover:text-slate-950 font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all"
            >
              <TrendingUp size={14} />
              {calculating ? "جاري تجميع البيانات..." : "احسب تقرير التقفيل المجمع"}
            </button>
          </div>

          {/* Draft Aggregation Results Card */}
          {calculatedDraft ? (
            <div className="bg-slate-950 border border-orange-500/20 rounded-xl p-4 space-y-4 animate-fade-in">
              <div className="flex items-center justify-between border-b border-white/4 pb-2">
                <div className="text-xs font-black text-orange-400 flex items-center gap-1">
                  <FileText size={13} />
                  مسودة التقرير المجمعة لتاريخ {calculatedDraft.date}
                </div>
                <div className="text-[10px] text-slate-550 font-semibold font-mono">
                  بواسطة: {calculatedDraft.addedBy}
                </div>
              </div>

              {/* Stats Mini Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-white/4">
                  <div className="text-[10px] text-slate-500 font-black">إجمالي التسليم</div>
                  <div className="text-lg font-black text-emerald-400 mt-1">
                    {calculatedDraft.deliveredCount} <span className="text-[10px] font-medium text-slate-400">أوردر</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-white/4">
                  <div className="text-[10px] text-slate-500 font-black">📦 المرتجع الصافي بعهدة الفرع</div>
                  <div className="text-lg font-black text-red-400 mt-1">
                    {calculatedDraft.returnedCount} <span className="text-[10px] font-medium text-slate-400">أوردر</span>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold mt-1.5 space-y-1">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>📥 المستلم من المندوبين:</span>
                      <span className="font-mono bg-slate-950 px-1 rounded">{(calculatedDraft as any).totalReturnsCollected || (calculatedDraft.returnedCount + ((calculatedDraft as any).returnedDeliveredToSupplierCount || 0))}</span>
                    </div>
                    <div className="flex justify-between items-center text-rose-350">
                      <span>📤 تم تسليمه للموردين:</span>
                      <span className="font-mono bg-rose-950/40 text-rose-400 px-1 rounded">{(calculatedDraft as any).returnedDeliveredToSupplierCount || 0}</span>
                    </div>
                    <div className="flex justify-between items-center text-orange-400 pt-0.5 border-t border-white/5">
                      <span>🏢 متبقي في حوزتنا:</span>
                      <span className="font-mono bg-orange-950/40 text-orange-400 px-1 rounded">{calculatedDraft.returnedCount}</span>
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-400 font-bold mt-2 pt-1 border-t border-white/4 font-mono">
                    قيمة البضاعة: {(calculatedDraft.returnedValue || 0).toLocaleString("ar")} ج.م
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-white/4">
                  <div className="text-[10px] text-slate-500 font-black">إجمالي المحصل COD</div>
                  <div className="text-lg font-black text-slate-200 mt-1 font-mono">
                    {calculatedDraft.totalCOD.toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-white/4">
                  <div className="text-[10px] text-slate-500 font-black">إجمالي إيراد الشحن</div>
                  <div className="text-lg font-black text-cyan-400 mt-1 font-mono">
                    {calculatedDraft.shippingCost.toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>
              </div>

              {/* Robust calculations for company net profits and outstanding daily balances */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-slate-900/60 p-3 rounded-xl border border-amber-500/20">
                  <div className="text-[10px] text-amber-400 font-black">💼 المتبقي في ذمة اليوم (لأوردرات معلقة)</div>
                  <div className="text-sm font-black text-amber-300 mt-1.5 font-mono">
                    {(calculatedDraft.pendingCOD || 0).toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م ({calculatedDraft.pendingCount || 0} شحنة)</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-red-500/20">
                  <div className="text-[10px] text-red-400 font-black">🏍️ إجمالي عمولات المناديب المستحقة</div>
                  <div className="text-sm font-black text-red-300 mt-1.5 font-mono">
                    {(calculatedDraft.courierCommissions || 0).toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>

                <div className="bg-slate-900/60 p-3 rounded-xl border border-emerald-500/20">
                  <div className="text-[10px] text-emerald-400 font-black">💰 صافي ربح شحن اليوم الفعلي</div>
                  <div className="text-sm font-black text-emerald-300 mt-1.5 font-mono">
                    {((calculatedDraft.shippingCost || 0) - (calculatedDraft.courierCommissions || 0)).toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>
              </div>

              {/* Cashbox Live Verification Ledger */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-white/4 pt-3">
                <div className="bg-indigo-950/20 p-3 rounded-xl border border-indigo-500/10">
                  <div className="text-[10px] text-indigo-400 font-black">📥 واردات الخزنة اليومية (حركات حقيقية)</div>
                  <div className="text-sm font-black text-indigo-300 mt-1.5 font-mono">
                    {(calculatedDraft.cashboxIn || 0).toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>

                <div className="bg-rose-950/20 p-3 rounded-xl border border-rose-500/10">
                  <div className="text-[10px] text-rose-400 font-black">📤 مدفوعات ومصروفات الخزنة اليوم</div>
                  <div className="text-sm font-black text-rose-350 mt-1.5 font-mono">
                    {(calculatedDraft.cashboxOut || 0).toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>

                <div className="bg-emerald-950/20 p-3 rounded-xl border border-emerald-500/10">
                  <div className="text-[10px] text-emerald-400 font-black">🔒 صافي حركة الخزنة اللحظي (في الدرج الفعلي)</div>
                  <div className="text-sm font-black text-emerald-300 mt-1.5 font-mono">
                    {(calculatedDraft.cashboxNet || 0).toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                  </div>
                </div>
              </div>

              <div className="bg-orange-500/5 p-3 rounded-lg border border-orange-500/10 text-[11px] text-orange-300 leading-relaxed font-semibold">
                ⚠️ يرجى التأكد من مطابقة هذه الأرقام للدفاتر الورقية. الضغط على ترحيل سيقوم بحفظ القيمة في شيت
                <strong> "التقفيل اليومي" </strong> وتحديثه إذا كان مسجلاً بالكامل مسبقاً، وتدوين بند في سجل التدقيق للأمان المالي.
              </div>

              {/* Action save */}
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleSaveClosing(calculatedDraft)}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 active:scale-98 text-slate-950 hover:text-slate-950 font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-all"
                >
                  <Save size={13} />
                  ترحيل وإثبات هذا التقرير اليومي بالملفات المركزية
                </button>
                <button
                  onClick={() => {
                    loadDetailOrders(calculatedDraft.date);
                    setTimeout(() => {
                      document.getElementById("detail-orders-section")?.scrollIntoView({ behavior: "smooth" });
                    }, 100);
                  }}
                  className="px-4 py-2 border border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 font-extrabold text-xs rounded-xl flex items-center gap-1"
                >
                  <span>🔍 معاينة الشحنات</span>
                </button>
                <button
                  onClick={() => setCalculatedDraft(null)}
                  className="px-4 py-2 border border-white/8 hover:bg-white/4 text-slate-350 font-bold text-xs rounded-xl"
                >
                  إلغاء التقرير
                </button>
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-xs text-slate-550 border border-dashed border-white/8 rounded-xl space-y-2">
              <Calendar size={32} className="mx-auto text-slate-600" />
              <p className="font-bold">يرجى تحديد تاريخ والضغط على "احسب تقرير التقفيل المجمع" لاستخراج الأرقام اللحظية</p>
              <p className="text-[10px] text-slate-600 leading-relaxed max-w-sm mx-auto">
                سيقوم النظام بالبحث الآلي داخل جميع الأوردرات وتجهيز مجموع النقدية والطلبات المسلمة والمرتجعة وتكلفة الشحن بدقة 100%.
              </p>
            </div>
          )}
        </div>

        {/* Module B: Manual closing entry override */}
        <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/6 pb-2">
            <h3 className="text-sm font-black text-slate-300 flex items-center gap-1.5">
              <Plus size={16} className="text-orange-400" />
              إضافة تقرير تقفيل يدوي
            </h3>
            <button
              onClick={() => setIsManualMode(!isManualMode)}
              className="text-[10px] px-2.5 py-1 bg-slate-950 border border-white/8 text-slate-300 rounded-lg hover:bg-slate-850 font-black transition-all"
            >
              {isManualMode ? "إغلاق النموذج" : "تفعيل الإدخال اليدوي"}
            </button>
          </div>

          {isManualClosed && isManualMode && (
            <div className="p-3 bg-red-950/45 border-r-[3px] border-red-500 rounded-xl text-red-300 text-[11px] font-semibold leading-relaxed">
              ⚠️ عذراً، تاريخ التقفيل المختار معتمد ومغلق مسبقاً.
            </div>
          )}

          {isManualMode ? (
            <form onSubmit={handleManualSubmit} className="space-y-3">
              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-1">تاريخ اليوم المالي</label>
                <input
                  type="date"
                  required
                  value={manualDate}
                  onChange={(e) => setManualDate(e.target.value)}
                  className="w-full bg-slate-950 border border-white/8 rounded-xl py-2 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-center"
                />
              </div>

              <div className={`space-y-3 ${isManualClosed ? "opacity-50 pointer-events-none" : ""}`}>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">إجمالي التسليم (عدد)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isManualClosed}
                      value={manualDelivered}
                      onChange={(e) => setManualDelivered(e.target.value)}
                      className="w-full bg-slate-950 border border-white/8 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">المرتجع (عدد)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isManualClosed}
                      value={manualReturned}
                      onChange={(e) => setManualReturned(e.target.value)}
                      className="w-full bg-slate-950 border border-white/8 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-center"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">إجمالي المحصل COD</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isManualClosed}
                      value={manualCOD}
                      onChange={(e) => setManualCOD(e.target.value)}
                      className="w-full bg-slate-950 border border-white/8 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-center"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-1">تكلفة الشحن (ج.م)</label>
                    <input
                      type="number"
                      min="0"
                      placeholder="0"
                      disabled={isManualClosed}
                      value={manualShip}
                      onChange={(e) => setManualShip(e.target.value)}
                      className="w-full bg-slate-950 border border-white/8 rounded-xl py-1.5 px-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-mono text-center"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isManualClosed}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1 transitions-all"
              >
                <Save size={13} />
                {isManualClosed ? "التاريخ مقفل برمجياً" : "ترصيد التقفيل اليدوي بالشيت"}
              </button>
            </form>
          ) : (
            <div className="bg-slate-950 p-4 border border-white/4 rounded-xl text-center space-y-1 relative overflow-hidden">
              <div className="text-orange-500/5 absolute -top-4 -left-4">
                <FileText size={72} />
              </div>
              <div className="text-[10px] text-slate-400 font-black uppercase">نموذج حماية وتعديل التسويات المباشرة</div>
              <p className="text-slate-500 text-[10px] leading-relaxed font-semibold">
                يتيح التعديل والمطابقة اليدوية للتقارير متى دعت الحاجة أو عند إجراء تصقيص أو جرد يدوي مع المندوبين.
              </p>
              <button
                onClick={() => setIsManualMode(true)}
                className="mt-3 inline-block px-4 py-1.5 bg-slate-900 hover:bg-slate-850 border border-white/6 text-slate-300 rounded-lg text-xs font-black"
              >
                تحرير يدوي الآن
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Module C: Historical Logs & Filtering Controls */}
      <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4">
        
        {/* Filtering Controls */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3 border-b border-white/6 pb-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="p-1 px-2.5 rounded-lg bg-orange-400/10 text-orange-400 text-xs font-bold flex items-center gap-1 text-[11px]">
              <Filter size={12} />
              مرشحات البحث والفرز
            </span>
            
            {/* Search Input */}
            <div className="relative min-w-[200px]">
              <Search size={14} className="absolute right-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="ابحث بالتاريخ أو مسجل التقرير..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-white/8 rounded-xl py-1.5 pr-8 pl-3 text-xs text-slate-200 focus:outline-none focus:border-orange-500 font-bold"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 font-sans">تاريخ البداية</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-950 border border-white/8 rounded-xl py-1.5 px-3 text-xs text-slate-300 focus:outline-none focus:border-orange-500 font-mono text-center"
              />
            </div>
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1 font-sans">تاريخ النهاية</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="bg-slate-950 border border-white/8 rounded-xl py-1.5 px-3 text-xs text-slate-300 focus:outline-none focus:border-orange-500 font-mono text-center"
              />
            </div>
            {(startDate || endDate || searchQuery) && (
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setSearchQuery("");
                }}
                className="h-[30px] self-end px-3 bg-red-950/20 border border-red-500/20 text-red-400 hover:bg-red-950/40 text-xs font-bold rounded-xl transition-all"
              >
                تفريغ
              </button>
            )}
          </div>
        </div>

        {/* Dynamic closing table logs */}
        {loading ? (
          <div className="py-20 text-center flex flex-col items-center justify-center gap-3">
            <RefreshCw size={24} className="animate-spin text-orange-400" />
            <p className="text-xs text-slate-400 font-bold">جاري تحميل سجلات التقفيل اليومي من سكريبت جوجل شيت...</p>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-white/8 rounded-xl space-y-2">
            <Calendar size={40} className="mx-auto text-slate-600" />
            <p className="text-xs font-black text-slate-500">لم يتم العثور على أي سجلات تقفيل مطابقة للمرشحات الحالية</p>
            <p className="text-[10px] text-slate-650 max-w-sm mx-auto">
              يمكنك ترصيد اليوم المالي الأول من خلال أداة الترصيد الذكية في الأعلى لتسجيلها في شيت "التقفيل اليومي" فوراً.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Table wrapper */}
            <div className="overflow-x-auto rounded-xl border border-white/6 bg-slate-950">
              <table className="w-full text-right border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-white/6 text-slate-450 font-black">
                    <th className="p-3.5">تاريخ التقفيل</th>
                    <th className="p-3.5">إجمالي التسليم (أوردر)</th>
                    <th className="p-3.5">المرتجع (أوردر)</th>
                    <th className="p-3.5">المحصل الفعلي COD</th>
                    <th className="p-3.5">إيراد تكلفة الشحن</th>
                    <th className="p-3.5">المسؤول عن الترصيد</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/4">
                  {filteredRecords.map((r, idx) => (
                    <tr 
                      key={idx} 
                      onClick={() => {
                        loadDetailOrders(r.date);
                        setTimeout(() => {
                          const el = document.getElementById("detail-orders-section");
                          if (el) el.scrollIntoView({ behavior: "smooth" });
                        }, 100);
                      }}
                      className="hover:bg-white/5 font-semibold text-slate-300 cursor-pointer transition-all border-r-[3px] border-transparent hover:border-orange-500"
                    >
                      <td className="p-3.5 font-mono text-orange-400 font-bold">📅 {r.date}</td>
                      <td className="p-3.5 text-emerald-400">{r.deliveredCount} أوردر</td>
                      <td className="p-3.5 text-red-400">{r.returnedCount} أوردر</td>
                      <td className="p-3.5 font-mono text-slate-100">{(r.totalCOD).toLocaleString("ar")} ج.م</td>
                      <td className="p-3.5 font-mono text-cyan-400">{(r.shippingCost).toLocaleString("ar")} ج.م</td>
                      <td className="p-3.5 text-slate-400">
                        <span className="px-2 py-0.5 bg-slate-900 border border-white/4 rounded text-[10px] font-bold">
                          👤 {r.addedBy}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Aggregated Totals Overlay Footer */}
            <div className="bg-slate-950 border border-white/6 p-4 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 font-bold">مجموع التسليم للفترة الحالية</div>
                <div className="text-sm font-black text-emerald-400 font-mono">
                  {totalDeliveredSum} <span className="text-[10px] font-medium text-slate-400">أوردر</span>
                </div>
              </div>
              
              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 font-bold">مجموع المرتجع للفترة الحالية</div>
                <div className="text-sm font-black text-red-400 font-mono">
                  {totalReturnedSum} <span className="text-[10px] font-medium text-slate-400">أوردر</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 font-bold">مجموع COD المحصل للفترة</div>
                <div className="text-sm font-black text-slate-100 font-mono">
                  {totalCODSum.toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <div className="text-[10px] text-slate-500 font-bold font-sans">مجموع تكلفة الشحن للفترة</div>
                <div className="text-sm font-black text-cyan-400 font-mono">
                  {totalShippingSum.toLocaleString("ar")} <span className="text-[10px] font-medium text-slate-400">ج.م</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Module D: Detailed Orders Viewer */}
      {activeDetailDate && (
        <div className="bg-slate-900 border border-orange-500/25 rounded-2xl p-5 mt-6 space-y-4 animate-fade-in scroll-mt-6" id="detail-orders-section">
          <div className="flex items-center justify-between border-b border-white/6 pb-2.5">
            <div>
              <h3 className="text-sm font-black text-slate-200 flex items-center gap-1.5">
                <span>📋 تفاصيل كشف حركة شحنات تاريخ:</span>
                <span className="font-mono text-orange-400 font-bold">{activeDetailDate}</span>
              </h3>
              <p className="text-[10px] text-slate-500 mt-1 font-semibold">
                يعرض هذا الجدول جميع طلبيات التوريد، التسليم والارتجاع التي طرأت في هذا اليوم المالي.
              </p>
            </div>
            <button
              onClick={() => setActiveDetailDate(null)}
              className="text-xs font-black text-rose-400 bg-rose-950/20 px-3 py-1.5 rounded-xl border border-rose-900/35 hover:bg-rose-950/40 transition-colors cursor-pointer"
            >
              إغلاق التفاصيل ×
            </button>
          </div>

          {loadingDetail ? (
            <div className="py-12 text-center text-xs text-slate-550 flex flex-col items-center justify-center gap-2">
              <RefreshCw size={20} className="animate-spin text-orange-500" />
              <span>جاري استدعاء تفاصيل الأوردرات ومطابقتها...</span>
            </div>
          ) : detailOrders.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-550 bg-slate-950 border border-white/4 rounded-xl">
              لا توجد طلبيات مسجلة بحدث (توصيل/ارتجاع/إنشاء) في تاريخ {activeDetailDate}.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Detailed Inner Filter Controls */}
              <div className="flex flex-col sm:flex-row gap-2 items-center justify-between bg-slate-950/60 p-3 rounded-xl border border-white/4">
                <div className="relative w-full sm:max-w-[280px]">
                  <Search size={14} className="absolute right-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="البحث برقم الشحنة، اسم العميل، أو المورد..."
                    value={detailSearch}
                    onChange={(e) => setDetailSearch(e.target.value)}
                    className="w-full bg-slate-900 border border-white/8 rounded-lg py-1.5 pr-8 pl-3 text-xs text-slate-200 outline-none focus:border-orange-500 text-right"
                  />
                </div>
                
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button
                    onClick={() => setDetailStatusFilter("all")}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${detailStatusFilter === "all" ? "bg-orange-500 text-slate-950" : "bg-slate-900 text-slate-400"}`}
                  >
                    الكل ({detailOrders.length})
                  </button>
                  <button
                    onClick={() => setDetailStatusFilter("delivered")}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${detailStatusFilter === "delivered" ? "bg-emerald-600 text-slate-950" : "bg-slate-900 text-slate-400"}`}
                  >
                    تم التسليم ({detailOrders.filter(o => o.status === "تم التسليم").length})
                  </button>
                  <button
                    onClick={() => setDetailStatusFilter("returned")}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${detailStatusFilter === "returned" ? "bg-rose-600 text-white" : "bg-slate-900 text-slate-400"}`}
                  >
                    المرتجعات ({detailOrders.filter(o => ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "تم تسليمه للمورد"].includes(o.status) || (o.status || "").includes("مرتجع")).length})
                  </button>
                  <button
                    onClick={() => setDetailStatusFilter("other")}
                    className={`px-3 py-1 text-[10px] font-bold rounded cursor-pointer ${detailStatusFilter === "other" ? "bg-amber-600 text-slate-950" : "bg-slate-900 text-slate-400"}`}
                  >
                    أخرى ({detailOrders.filter(o => o.status !== "تم التسليم" && !["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "تم تسليمه للمورد"].includes(o.status) && !(o.status || "").includes("مرتجع")).length})
                  </button>
                </div>
              </div>

              {/* Grid or Table listing of detailOrders */}
              <div className="overflow-x-auto rounded-xl border border-white/6 bg-slate-950">
                <table className="w-full text-right border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-white/6 font-bold text-right">
                      <th className="p-2.5">رقم البوليصة</th>
                      <th className="p-2.5">اسم المورد</th>
                      <th className="p-2.5">العميل</th>
                      <th className="p-2.5">الهاتف</th>
                      <th className="p-2.5">المحافظة</th>
                      <th className="p-2.5">الحالة الحالية</th>
                      <th className="p-2.5 text-left">المبلغ COD</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {detailOrders
                      .filter(o => {
                        if (detailSearch) {
                          const s = detailSearch.toLowerCase();
                          return (o.tracking || "").toLowerCase().includes(s) ||
                                 (o.customer || "").toLowerCase().includes(s) ||
                                 (o.supplier || "").toLowerCase().includes(s) ||
                                 (o.phone || "").toLowerCase().includes(s);
                        }
                        return true;
                      })
                      .filter(o => {
                        if (detailStatusFilter === "delivered") return o.status === "تم التسليم";
                        if (detailStatusFilter === "returned") return ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "تم تسليمه للمورد"].includes(o.status) || (o.status || "").includes("مرتجع");
                        if (detailStatusFilter === "other") return o.status !== "تم التسليم" && !["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "تم تسليمه للمورد"].includes(o.status) && !(o.status || "").includes("مرتجع");
                        return true;
                      })
                      .map((o, oidx) => (
                        <tr key={oidx} className="hover:bg-white/1 text-slate-350 font-semibold text-right">
                          <td className="p-2.5 font-mono text-orange-400 font-bold">{o.tracking}</td>
                          <td className="p-2.5 font-sans font-bold text-slate-300">{o.supplier}</td>
                          <td className="p-2.5">{o.customer}</td>
                          <td className="p-2.5 font-mono text-[10px] text-slate-450">{o.phone}</td>
                          <td className="p-2.5">{o.gov || "—"}</td>
                          <td className="p-2.5">
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black ${
                              o.status === "تم التسليم" ? "bg-emerald-950/30 text-emerald-450 border border-emerald-900/40" :
                              ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "تم تسليمه للمورد"].includes(o.status) || (o.status || "").includes("مرتجع") ? "bg-red-950/30 text-rose-400 border border-red-900/40" :
                              "bg-amber-950/20 text-amber-500 border border-amber-900/30"
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="p-2.5 text-left font-mono font-bold text-slate-100">{(Number(o.totalCOD || 0)).toLocaleString("ar")} ج.م</td>
                        </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
