import React, { useState, useMemo } from "react";
import { Search, RotateCcw, Calendar, TrendingUp, DollarSign, ArrowDownLeft, Inbox, ShieldCheck, Download } from "lucide-react";
import { normalizeDateToYMD } from "../utils";

interface ArchivePortalProps {
  token: string;
  role: string;
  username: string;
  orders: any[];
  onRefresh?: () => void;
}

export default function ArchivePortal({ token, role, username, orders, onRefresh }: ArchivePortalProps) {
  const [activeSubTab, setActiveSubTab] = useState<"settled_delivered" | "closed_returns">("settled_delivered");
  const [searchQuery, setSearchQuery] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const isSupplier = role === "مورد" || role.includes("مورد");
  const isAgent = role === "مندوب" || role.includes("مندوب");

  // Determine which orders fit the roles
  const filteredByRole = useMemo(() => {
    return (orders || []).filter((o) => {
      const sName = o.supplier || "";
      const cName = o.courier || o.lastCourier || "";
      if (isSupplier) {
        return sName.toLowerCase().trim() === username.toLowerCase().trim();
      }
      if (isAgent) {
        return cName.toLowerCase().trim() === username.toLowerCase().trim();
      }
      return true; // Manager, Admin, supervisor can see all
    });
  }, [orders, isSupplier, isAgent, username]);

  // Main filter engine for Archive
  const archiveRecords = useMemo(() => {
    return filteredByRole.filter((o) => {
      const status = (o.status || "").toString().trim();
      
      const isSettled = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
      
      const isClosedReturnPattern = [
        "تم تسليم المرتجع للمورد",
        "تم تسليم المرتجع للمورد وتصفية حسابه",
        "مرتجع تم تسليمه للمورد"
      ].includes(status);

      // Tab split: Delivers (Settled) vs Closed Returns
      if (activeSubTab === "settled_delivered") {
        if (!isSettled) return false;
        // Should only be delivered/partially delivered
        const isDelivStatus = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status);
        if (!isDelivStatus) return false;
      } else {
        // closed returns to supplier
        if (!isClosedReturnPattern) return false;
      }

      // Search filters
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matches = [
          o.tracking,
          o.supplier,
          o.courier,
          o.lastCourier,
          o.customer,
          o.phone,
          o.gov,
          o.region,
          o.status
        ].some((val) => val && val.toString().toLowerCase().includes(q));
        if (!matches) return false;
      }

      // Date range filter
      if (fromDate) {
        const oDate = normalizeDateToYMD(o.delivDate || o.retDate || o.createdAt || o.orderDate);
        if (oDate < fromDate) return false;
      }
      if (toDate) {
        const oDate = normalizeDateToYMD(o.delivDate || o.retDate || o.createdAt || o.orderDate);
        if (oDate > toDate) return false;
      }

      return true;
    });
  }, [filteredByRole, activeSubTab, searchQuery, fromDate, toDate]);

  // Calculations & Analytics Summary
  const stats = useMemo(() => {
    let totalCount = archiveRecords.length;
    let totalCODCollected = 0;
    let totalCommissions = 0;

    archiveRecords.forEach((o) => {
      const actualReceived = Number(o.actualReceivedCash || o.partialAmount || o.totalCOD || 0);
      totalCODCollected += actualReceived;
      totalCommissions += Number(o.lastCommission || o.commission || 25);
    });

    return { totalCount, totalCODCollected, totalCommissions };
  }, [archiveRecords]);

  // Export to CSV
  const handleExportCSV = () => {
    if (archiveRecords.length === 0) return alert("لا توجد بيانات لتصديرها حالياً");
    
    // CSV file header
    let csvContent = "\uFEFF"; // UTF-8 BOM
    csvContent += "رقم التتبع,اسم المورد,اسم العميل,الهاتف,المحافظة,المنطقة,الحالة النهائية,تاريخ التحديث,المبلغ المحصل,العمولة المقتطعة\n";
    
    archiveRecords.forEach((o) => {
      const row = [
        o.tracking || "",
        o.supplier || "",
        o.customer || "",
        o.phone || "",
        o.gov || "",
        o.region || "",
        o.status || "",
        o.delivDate || o.retDate || o.updatedAt || "",
        o.actualReceivedCash || o.partialAmount || o.totalCOD || 0,
        o.lastCommission || o.commission || 0
      ].map(val => `"${val.toString().replace(/"/g, '""')}"`).join(",");
      csvContent += row + "\n";
    });

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `archive_export_${activeSubTab}_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const statusColors: { [key: string]: string } = {
    "تم التسليم": "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40",
    "تم التسليم بنجاح": "bg-emerald-950/40 text-emerald-400 border border-emerald-900/40",
    "تسليم جزئي": "bg-amber-950/45 text-amber-500 border border-amber-940/50",
    "تسليم جزئي - معلق للجرد": "bg-amber-950/80 text-amber-400 border border-amber-800 font-bold",
    "مرتجع جزئي بالمستودع": "bg-indigo-950/40 text-indigo-400 border border-indigo-900/40",
    "تم تسليم المرتجع للمورد": "bg-purple-950/40 text-purple-400 border border-purple-900/40",
    "تم تسليم المرتجع للمورد وتصفية حسابه": "bg-purple-920 text-purple-300 border border-purple-900",
    "مرتجع تم تسليمه للمورد": "bg-fuchsia-950/30 text-fuchsia-400 border border-fuchsia-900/40"
  };

  return (
    <div className="p-4 md:p-6 space-y-6 text-right font-sans" dir="rtl">
      {/* Upper Main Header Card */}
      <div className="relative rounded-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-indigo-950/30 p-6 border border-white/6 overflow-hidden">
        <div className="absolute top-0 left-0 w-[400px] h-[400px] bg-indigo-500/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-500/15 text-indigo-400 rounded-xl text-lg">🗄️</span>
              <h2 className="text-lg font-black text-slate-100 tracking-tight">بوابة الأرشيف المركزي المالي واللوجيستي</h2>
            </div>
            <p className="text-xs text-slate-400 font-bold leading-relaxed">
              تصفح تاريخ المعاملات اللوجيستيكية والمالية المقفلة لضمان استمرارية التقارير ومطابقة الحسابات المالية التراكمية.
            </p>
          </div>
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-850 active:scale-97 text-slate-200 border border-white/8 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer self-start md:self-auto"
            >
              <RotateCcw size={13} />
              <span>تحديث الأرشيف اللحظي</span>
            </button>
          )}
        </div>
      </div>

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total Count */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">إجمالي عدد شحنات الأرشيف</span>
            <div className="text-2xl font-black text-slate-100 font-mono">
              {stats.totalCount.toLocaleString("ar")}{" "}
              <span className="text-[10px] text-slate-400 font-sans">طلب</span>
            </div>
          </div>
          <span className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
            <Inbox size={18} />
          </span>
        </div>

        {/* Collected Money */}
        {activeSubTab === "settled_delivered" && (
          <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-400 font-bold block">إجمالي الكاش المؤرشف والمحصل</span>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {stats.totalCODCollected.toLocaleString("ar")}{" "}
                <span className="text-[10px] text-emerald-500 font-sans">ج.م</span>
              </div>
            </div>
            <span className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <DollarSign size={18} />
            </span>
          </div>
        )}

        {/* Commissions Paid */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 font-bold block">إجمالي العمولات التراكمية المحتسبة</span>
            <div className="text-2xl font-black text-opacity-90 text-indigo-400 font-mono">
              {stats.totalCommissions.toLocaleString("ar")}{" "}
              <span className="text-[10px] text-indigo-400/80 font-sans">ج.م</span>
            </div>
          </div>
          <span className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <TrendingUp size={18} />
          </span>
        </div>
      </div>

      {/* Sub Tabs Selection (أرشيف التسليمات vs المرتجعات المقفلة للموردين) */}
      <div className="flex border-b border-slate-800 gap-6">
        <button
          onClick={() => {
            setActiveSubTab("settled_delivered");
            setSearchQuery("");
          }}
          className={`pb-4 px-2 text-xs font-black transition-all relative whitespace-nowrap cursor-pointer ${
            activeSubTab === "settled_delivered" ? "text-amber-500" : "text-slate-450 text-slate-400 hover:text-slate-200"
          }`}
        >
          {activeSubTab === "settled_delivered" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-amber-500 rounded-full" />
          )}
          <span className="flex items-center gap-1.5">
            <span>✅</span>
            <span>بوابة [أرشيف التسليمات والتصفيات الكلية]</span>
          </span>
        </button>

        <button
          onClick={() => {
            setActiveSubTab("closed_returns");
            setSearchQuery("");
          }}
          className={`pb-4 px-2 text-xs font-black transition-all relative whitespace-nowrap cursor-pointer ${
            activeSubTab === "closed_returns" ? "text-amber-500" : "text-slate-450 text-slate-400 hover:text-slate-200"
          }`}
        >
          {activeSubTab === "closed_returns" && (
            <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-amber-500 rounded-full" />
          )}
          <span className="flex items-center gap-1.5">
            <span>📦</span>
            <span>بوابة [المرتجعات المقفلة للموردين]</span>
          </span>
        </button>
      </div>

      {/* Advanced Search & Filtering Board */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Quick Search */}
          <div className="flex-1 relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
              <Search size={14} />
            </span>
            <input
              type="text"
              placeholder="البحث السريع برقم تتبع، اسم المورد، هاتف العميل، المندوب، المحافظة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-white/6 rounded-xl pr-9 pl-4 py-2.5 text-xs text-slate-200 outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          {/* Date from */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
              <Calendar size={13} />
            </span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              title="تاريخ التحديث الأرشيفي من"
              className="bg-slate-950 border border-white/6 rounded-xl pr-9 pl-4 py-2.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Date to */}
          <div className="relative">
            <span className="absolute inset-y-0 right-3 flex items-center text-slate-500">
              <Calendar size={13} />
            </span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              title="تاريخ التحديث الأرشيفي إلى"
              className="bg-slate-950 border border-white/6 rounded-xl pr-9 pl-4 py-2.5 text-xs text-slate-300 outline-none focus:border-indigo-500"
            />
          </div>

          {/* Reset Filters */}
          <button
            onClick={() => {
              setSearchQuery("");
              setFromDate("");
              setToDate("");
            }}
            className="p-2.5 bg-slate-950 hover:bg-slate-850 active:scale-97 text-slate-400 hover:text-slate-200 border border-white/6 rounded-xl transition-colors cursor-pointer"
            title="تصفير محركات الفلاتر"
          >
            <RotateCcw size={14} />
          </button>

          {/* Export CVS */}
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-97"
          >
            <Download size={13} className="text-slate-950" />
            <span>تصدير البيانات (CSV)</span>
          </button>
        </div>
      </div>

      {/* Main Archive Records Table Card */}
      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
        {archiveRecords.length === 0 ? (
          <div className="text-center py-16 space-y-3">
            <span className="text-4xl block opacity-40">🗄️</span>
            <h4 className="text-xs font-black text-slate-400">لا توجد سجلات مؤرشفة مطابقة لمحركات البحث حالياً</h4>
            <p className="text-[10px] text-slate-500">
              المعاملات التي يتم تسويتها وإغلاق دورتها المالية واللوجستية تظهر وتخزن هنا بشكل دائم.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-950 border-b border-white/5 text-slate-300 font-black text-right">
                  <th className="p-3.5">باقة التتبع (Tracking ID)</th>
                  <th className="p-3.5">المورد والتاجر</th>
                  <th className="p-3.5">العميل والمستلم</th>
                  <th className="p-3.5">المنطقة والموقع</th>
                  <th className="p-3.5 text-center">المبلغ المحصل</th>
                  <th className="p-3.5 text-center">رصيد المندوب الأخير</th>
                  <th className="p-3.5 text-center">الحالة النهائية</th>
                  <th className="p-3.5 text-left">تاريخ التوثيق</th>
                </tr>
              </thead>
              <tbody>
                {archiveRecords.map((o: any, idx: number) => {
                  const actualCash = Number(o.actualReceivedCash || o.partialAmount || o.totalCOD || 0);
                  const commissionEarned = Number(o.lastCommission || o.commission || 0);
                  return (
                    <tr
                      key={o.tracking || idx}
                      className="border-b border-white/4 hover:bg-slate-950/60 transition-colors"
                    >
                      {/* Tracking ID */}
                      <td className="p-3.5">
                        <div className="font-mono font-black text-amber-500 tracking-wider">
                          {o.tracking}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-200">{o.supplier}</div>
                        {o.lastCourier && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            المندوب: {o.lastCourier}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td className="p-3.5">
                        <div className="font-bold text-slate-100">{o.customer}</div>
                        <div className="font-mono text-[10px] text-slate-450 text-slate-400 mt-0.5" dir="ltr">
                          {o.phone}
                        </div>
                      </td>

                      {/* Location */}
                      <td className="p-3.5">
                        <div className="text-slate-300 font-semibold">{o.gov}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{o.region}</div>
                      </td>

                      {/* Collected amount */}
                      <td className="p-3.5 text-center">
                        <div className="font-mono font-black text-emerald-400">
                          {actualCash.toLocaleString("ar")} <span className="text-[10px]">ج.م</span>
                        </div>
                        {o.isPartial && (
                          <span className="text-[8px] bg-amber-950 text-amber-400 border border-amber-900 rounded px-1 px-1 py-0.2">
                            تسليم جزئي
                          </span>
                        )}
                      </td>

                      {/* Commission earned */}
                      <td className="p-3.5 text-center font-mono">
                        <div className="text-slate-300 font-bold">
                          {commissionEarned.toLocaleString("ar")} <span className="text-[10px]">ج.م</span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-3.5 text-center">
                        {(o.status === "مرتجع بالمستودع" || o.status === "مرتجع في المستودع" || o.status === "مرتجع جزئي بالمستودع") && (o.isPartial === true || o.isPartial === "true" || Number(o.actualReceivedCash || o.partialAmount || 0) > 0) && (
                          <div className="text-[9px] font-extrabold text-amber-400 bg-red-950/80 border border-red-500/30 px-1.5 py-0.5 rounded mb-1 inline-block animate-pulse whitespace-nowrap">
                            ⚠️ مرتجع جزئي ({o.actualReceivedCash || o.partialAmount || 0} ج.م)
                          </div>
                        )}
                        <span
                          className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-black ${
                            statusColors[o.status] || "bg-slate-950 text-slate-400 border border-white/5"
                          }`}
                        >
                          {o.status}
                        </span>
                      </td>

                      {/* Documentation Date */}
                      <td className="p-3.5 text-left font-mono font-medium text-slate-400">
                        {o.delivDate || o.retDate || o.updatedAt || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
