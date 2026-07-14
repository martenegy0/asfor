import React, { useState, useEffect, useMemo } from "react";
import { 
  Users, RefreshCw, DollarSign, Wallet, ShieldAlert, CheckCircle2, 
  ChevronRight, ArrowUpRight, ArrowDownRight, Edit3, Sparkles,
  Search, Filter, Calendar, Printer, FileText, ArrowRight,
  TrendingUp, TrendingDown, Layers, Copy, Check, Info, Download
} from "lucide-react";
import { apiCall } from "../utils";

interface SuppliersManagementProps {
  token: string;
  role: string;
  orders?: any[];
  user?: string;
}

interface SupplierAccount {
  name: string;
  totalCOD: number;
  returnsDelivered: number;
  adjustments: number;
  payments: number;
  totalOrders: number;
  deliveredOrders: number;
  returnsCount: number;
  balance: number;
  rate: number;
  phone?: string;
  price?: number;
  notes?: string;
  openingBalance?: number;
}

interface LedgerEntry {
  date: string;
  type: string;
  tracking: string;
  amount: number;
  desc: string;
  balanceAfter: number;
}

export default function SuppliersManagement({ token, role, orders = [], user = "" }: SuppliersManagementProps) {
  // Navigation tabs (page internal)
  const isSupplierRole = (role || "").toString().trim() === "مورد" || 
                         (role || "").toString().trim() === "موردين" || 
                         (role || "").toString().trim().includes("مورد");
  const [activeSubTab, setActiveSubTab] = useState<"directory" | "statement" | "query">(
    isSupplierRole ? "statement" : "directory"
  );

  // Directory and common data states
  const [accounts, setAccounts] = useState<SupplierAccount[]>([]);
  const [allRegisteredSuppliers, setAllRegisteredSuppliers] = useState<{ id?: string; name: string }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed Ledger / Statement States
  const [selectedLedgerSupplier, setSelectedLedgerSupplier] = useState("");
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [ledgerStats, setLedgerStats] = useState<any>(null);
  const [dailyLedgerData, setDailyLedgerData] = useState<any>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [copiedTracking, setCopiedTracking] = useState<string | null>(null);
  const [visibleEntriesLimit, setVisibleEntriesLimit] = useState<number>(50);
  const [expandedEntryIdx, setExpandedEntryIdx] = useState<number | null>(null);

  // Statement Filters
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "settled" | "pending">("all");
  const [filterSearch, setFilterSearch] = useState("");

  // Payment Settlement Dialog States
  const [activeSettleSupplier, setActiveSettleSupplier] = useState<SupplierAccount | null>(null);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleDesc, setSettleDesc] = useState("");
  const [isSettling, setIsSettling] = useState(false);
  const [isSettleModalOpen, setIsSettleModalOpen] = useState(false);
  const [settleTransType, setSettleTransType] = useState<"payout" | "inflow" | "adjustment">("payout");
  const [adjustmentType, setAdjustmentType] = useState<"add" | "subtract">("subtract");

  // Edit Supplier Profile States
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editSupplierPhone, setEditSupplierPhone] = useState("");
  const [editSupplierPrice, setEditSupplierPrice] = useState("");
  const [editSupplierNotes, setEditSupplierNotes] = useState("");
  const [editSupplierOpeningBalance, setEditSupplierOpeningBalance] = useState("");
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);

  // --- Supplier Fast Query States ---
  const [querySupplier, setQuerySupplier] = useState("");
  const [queryDate, setQueryDate] = useState(() => {
    try {
      const d = new Date();
      d.setHours(d.getHours() + 3); // Cairo offset fallback
      return d.toISOString().substring(0, 10);
    } catch (e) {
      return new Date().toISOString().split("T")[0];
    }
  });

  const normalizeArabicText = (str: string): string => {
    if (!str) return "";
    return str
      .toString()
      .trim()
      .toLowerCase()
      .replace(/[أإآإأ]/g, "ا")
      .replace(/[يى]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  };

  const sameSupplierNames = (na: string, nb: string): boolean => {
    return normalizeArabicText(na) === normalizeArabicText(nb);
  };

  // Calculate unique supplier names
  const uniqueSuppliersList = useMemo(() => {
    const names = new Set<string>();
    accounts.forEach(a => { if (a.name) names.add(a.name.trim()); });
    allRegisteredSuppliers.forEach(s => { if (s.name) names.add(s.name.trim()); });
    return Array.from(names).filter(Boolean).sort();
  }, [accounts, allRegisteredSuppliers]);

  // Handle supplier dashboard query details
  const queryResult = useMemo(() => {
    const target = isSupplierRole ? querySupplier || "" : querySupplier;
    if (!target) return null;
    
    const supplierOrders = (orders || []).filter(o => {
      const sup = (o.supplier || "").toString().trim();
      if (!sameSupplierNames(sup, target)) return false;
      const oDate = (o.orderDate || o.createdAt || "").toString().substring(0, 10);
      return oDate === queryDate;
    });

    const isReturnedDelivered = (status: string) => {
      const s = (status || "").toString().trim();
      const patterns = [
        "تم تسليم المرتجع للمورد",
        "مرتجع تم تسليمه للمورد",
        "التسليم للمورد",
        "تم تسليم المرتجع للمورد وتصفية حسابه",
        "تسليم المرتجع للمورد",
        "تسليمه للمورد",
        "تصفية حسابه",
        "مرتجع والعميل دفع الشحن",
        "مرتجع مدفوع الشحن"
      ];
      return patterns.some((p) => s.includes(p));
    };

    const total = supplierOrders.length;
    const delivered = supplierOrders.filter(o => o.status === "تم التسليم").length;
    const returnedToOffice = supplierOrders.filter(o => {
      const s = (o.status || "").toString().trim();
      return (s === "مرتجع" || s === "التسليم للمورد") && !isReturnedDelivered(s);
    }).length;
    const returnedDelivered = supplierOrders.filter(o => isReturnedDelivered(o.status)).length;

    return {
      total,
      delivered,
      returnedToOffice,
      returnedDelivered
    };
  }, [querySupplier, queryDate, orders, isSupplierRole]);

  // Initial bindings
  useEffect(() => {
    initializeData();
  }, [token]);

  // Auto-set supplier for statements if role is "مورد" or auto-select first for admins if empty
  useEffect(() => {
    if (isSupplierRole) {
      const lockName = user || uniqueSuppliersList[0] || "";
      setSelectedLedgerSupplier(lockName);
      setQuerySupplier(lockName);
    } else if (uniqueSuppliersList.length > 0) {
      if (!selectedLedgerSupplier) {
        setSelectedLedgerSupplier(uniqueSuppliersList[0]);
      }
      if (!querySupplier) {
        setQuerySupplier(uniqueSuppliersList[0]);
      }
    }
  }, [uniqueSuppliersList, isSupplierRole, user]);

  // Load detailed account statement when selected supplier shifts
  useEffect(() => {
    setVisibleEntriesLimit(50);
    setExpandedEntryIdx(null);
    if (selectedLedgerSupplier) {
      fetchSupplierStatement(selectedLedgerSupplier);
    } else if (isSupplierRole && user) {
      fetchSupplierStatement(user);
    }
  }, [selectedLedgerSupplier, isSupplierRole, user]);

  async function initializeData() {
    setIsLoading(true);
    setErrorMsg("");
    try {
      // 1. Fetch directories in parallel
      const [resAcc, resSup] = await Promise.all([
        apiCall("supplierAccounts", token),
        apiCall("getSuppliers", token)
      ]);

      if (resAcc.ok && resAcc.accounts) {
        setAccounts(resAcc.accounts);
      }
      if (resSup.ok && resSup.suppliers) {
        setAllRegisteredSuppliers(resSup.suppliers);
      }
    } catch (err: any) {
      setErrorMsg("عذراً، فشل تهيئة وإحضار بيانات الفوترة: " + err.message);
    } finally {
      setIsLoading(false);
    }
  }

  // Fetch detailed accounting statement for a target vendor
  async function fetchSupplierStatement(supplierName: string) {
    const targetName = supplierName || (isSupplierRole ? user : "");
    if (!targetName) return;
    setIsLedgerLoading(true);
    setErrorMsg("");
    try {
      const res = await apiCall("getSupplierLedger", token, { supplier: targetName });
      if (res.ok) {
        setLedgerEntries(res.entries || []);
        setLedgerStats(res.stats || null);
        setDailyLedgerData(res.dailyLedger || null);
      } else {
        setErrorMsg(res.error || "خطأ أثناء تحميل كشف الحساب التفصيلي.");
      }
    } catch (err: any) {
      setErrorMsg("فشل جلب تفاصيل القيود المالية: " + err.message);
    } finally {
      setIsLedgerLoading(false);
    }
  }

  // Handle manual payouts or debit withdrawals
  async function handleSettleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!activeSettleSupplier) return;

    let amountNum = Number(settleAmount);
    if (isNaN(amountNum) || amountNum === 0) {
      setErrorMsg("يرجى إدخال قيمة صحيحة غير صفرية.");
      return;
    }

    let finalAdjustmentType = adjustmentType;
    if (settleTransType === "adjustment") {
      if (amountNum < 0) {
        finalAdjustmentType = "subtract";
        amountNum = Math.abs(amountNum);
      }
    } else {
      amountNum = Math.abs(amountNum);
    }

    let defaultDesc = "";
    if (settleTransType === "inflow") {
      defaultDesc = `استلام نقدية / إيراد للخزنة من المورد: ${activeSettleSupplier.name} بمبلغ ${amountNum} ج.م`;
    } else if (settleTransType === "adjustment") {
      defaultDesc = `تسوية رصيد يدوي (${finalAdjustmentType === "add" ? "إضافة" : "خصم"}) للمورد: ${activeSettleSupplier.name} بمبلغ ${amountNum} ج.م`;
    } else {
      defaultDesc = `تصفية حساب المورد: ${activeSettleSupplier.name} بمبلغ ${amountNum} ج.م`;
    }

    setIsSettling(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await apiCall("addSupplierPayment", token, {
        supplier: activeSettleSupplier.name,
        amount: amountNum,
        desc: settleDesc.trim() || defaultDesc,
        transactionType: settleTransType,
        adjustmentType: finalAdjustmentType
      });

      if (res.ok) {
        setSuccessMsg(res.msg || `تم توثيق قيد التسوية بقيمة ${amountNum} ج.م بنجاح للمورد.`);
        setIsSettleModalOpen(false);
        setSettleAmount("");
        setSettleDesc("");
        setSettleTransType("payout");
        setAdjustmentType("subtract");
        setActiveSettleSupplier(null);
        
        // Refresh directories and stats
        await initializeData();
        // If current statement is for this supplier, refresh statement too
        if (selectedLedgerSupplier === activeSettleSupplier.name) {
          fetchSupplierStatement(activeSettleSupplier.name);
        }
      } else {
        setErrorMsg(res.error || "عذراً، فشل تسجيل المستند المالي بالخيمة المركزية.");
      }
    } catch (err: any) {
      setErrorMsg("خطأ في الاتصال أثناء تسجيل التسوية: " + err.message);
    } finally {
      setIsSettling(false);
    }
  }

  // Fast clipboard helper
  function copyToClipboard(val: string) {
    navigator.clipboard.writeText(val);
    setCopiedTracking(val);
    setTimeout(() => setCopiedTracking(null), 1800);
  }

  // Filtering ledger entries locally for powerful statement audits
  const filteredLedgerEntries = useMemo(() => {
    const normalizeEntryDate = (dateStr: string) => {
      if (!dateStr) return "";
      try {
        const clean = dateStr.toString().trim();
        
        // 1. Strict DD/MM/YYYY pattern match (e.g. 10/06/2026 or 10-06-2026 with possible trailing time)
        const dmyMatch = clean.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (dmyMatch) {
          const d = dmyMatch[1].padStart(2, '0');
          const m = dmyMatch[2].padStart(2, '0');
          const y = dmyMatch[3];
          return `${y}-${m}-${d}`;
        }

        // 2. Strict YYYY-MM-DD pattern match (e.g. 2026-06-10 or 2026/06/10)
        const ymdMatch = clean.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (ymdMatch) {
          const y = ymdMatch[1];
          const m = ymdMatch[2].padStart(2, '0');
          const d = ymdMatch[3].padStart(2, '0');
          return `${y}-${m}-${d}`;
        }

        // 3. Try standard Date first! If it's valid, use it
        const parsed = new Date(clean);
        if (!isNaN(parsed.getTime())) {
          const y = parsed.getFullYear();
          const m = String(parsed.getMonth() + 1).padStart(2, '0');
          const d = String(parsed.getDate()).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } catch (err) {
        // Quiet fallthrough
      }
      const cleanSlash = dateStr.toString().replace(/\//g, "-").trim();
      return cleanSlash.substring(0, 10);
    };

    const getEntrySettleStatus = (entry: any) => {
      const typeClean = entry.type || "";
      const isPayoutOrAdj = ["دفع نقدي", "سداد", "سداد مورد", "دفعة", "خصم", "سحب", "تعديل", "عكسية"].some(kw => typeClean.includes(kw));
      if (isPayoutOrAdj) return "settled";

      if (dailyLedgerData && dailyLedgerData.days) {
        const entryYMD = entry.date ? entry.date.toString().substring(0, 10) : "";
        const matchedDay = dailyLedgerData.days.find((d: any) => d.date === entryYMD);
        if (matchedDay) {
          return matchedDay.isSettled ? "settled" : "pending";
        }
      }
      return "pending";
    };

    return ledgerEntries.filter(entry => {
      // Date constraints
      const entryYMD = normalizeEntryDate(entry.date);
      if (filterStartDate && entryYMD && entryYMD < filterStartDate) return false;
      if (filterEndDate && entryYMD && entryYMD > filterEndDate) return false;

      // Type Constraints
      if (filterType !== "all") {
        const typeClean = entry.type || "";
        if (filterType === "rights" && !typeClean.includes("حقوق")) return false;
        if (filterType === "returns" && !typeClean.includes("مرتجع")) return false;
        if (filterType === "payments" && !["دفع نقدي", "سداد", "سداد مورد", "دفعة"].some(kw => typeClean.includes(kw))) return false;
        if (filterType === "adjustments" && !["خصم", "سحب", "تعديل", "عكسية"].some(kw => typeClean.includes(kw))) return false;
      }

      // Status Filter
      if (statusFilter !== "all") {
        const settleStatus = getEntrySettleStatus(entry);
        if (settleStatus !== statusFilter) return false;
      }

      // Keyword search (tracking, description, type)
      if (filterSearch.trim()) {
        const kw = filterSearch.toLowerCase().trim();
        const trackingClean = (entry.tracking || "").toString().toLowerCase();
        const descClean = (entry.desc || "").toString().toLowerCase();
        const typeClean = (entry.type || "").toString().toLowerCase();
        if (!trackingClean.includes(kw) && !descClean.includes(kw) && !typeClean.includes(kw)) return false;
      }

      return true;
    });
  }, [ledgerEntries, filterStartDate, filterEndDate, filterType, statusFilter, filterSearch, dailyLedgerData]);

  // Overall consolidated metrics for Admin/Accountant Top Banner Card
  const totalFinancialDuesSystem = useMemo(() => {
    return accounts.reduce((sum, item) => sum + Number(item.balance || 0), 0);
  }, [accounts]);

  const totalUploadedGoodsSystem = useMemo(() => {
    return accounts.reduce((sum, item) => sum + Number(item.totalCOD || 0), 0);
  }, [accounts]);

  const totalReturnsGoodsSystem = useMemo(() => {
    return accounts.reduce((sum, item) => sum + Number(item.returnsDelivered || 0), 0);
  }, [accounts]);

  const totalPaymentsMadeSystem = useMemo(() => {
    return accounts.reduce((sum, item) => sum + Number(item.payments || 0), 0);
  }, [accounts]);

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.name ? acc.name.toLowerCase().includes(searchQuery.toLowerCase()) : false
    );
  }, [accounts, searchQuery]);

  // Pre-calculated O(1) snapshots for ALL suppliers
  const supplierSnapshots = useMemo(() => {
    // 1. Build a fast Map of pending counts per supplier in O(Orders)
    const pendingCountsMap = new Map<string, number>();
    (orders || []).forEach(o => {
      const oSup = (o.supplier || o["المورد"] || "").toString().trim().toLowerCase();
      if (!oSup) return;
      const isPending = !["تم التسليم", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تسليم المرتجع للمورد"].includes(o.status);
      if (isPending) {
        pendingCountsMap.set(oSup, (pendingCountsMap.get(oSup) || 0) + 1);
      }
    });

    // 2. Map accounts in O(Accounts)
    return accounts.map(acc => {
      const accNameClean = acc.name.toString().trim().toLowerCase();
      const pendingCount = pendingCountsMap.get(accNameClean) || 0;
      
      return {
        name: acc.name,
        totalCollection: acc.totalCOD || 0,
        netDues: acc.balance || 0,
        pendingCount,
        phone: acc.phone || ""
      };
    });
  }, [accounts, orders]);

  const isAdminOrAccountant = role === "مدير" || role === "محاسب";

  function handleEditSupplierClick(supplierName: string) {
    const sup = allRegisteredSuppliers.find(s => s.name === supplierName) || 
                accounts.find(a => a.name === supplierName);
    
    setEditSupplierName(supplierName);
    setEditSupplierPhone(sup?.phone || "");
    setEditSupplierPrice(sup?.price !== undefined ? sup.price.toString() : "0");
    setEditSupplierNotes(sup?.notes || "");
    setEditSupplierOpeningBalance(sup?.openingBalance !== undefined ? sup.openingBalance.toString() : "0");
    setIsEditModalOpen(true);
  }

  async function handleSaveSupplierSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editSupplierName) return;
    setIsSavingSupplier(true);
    setSuccessMsg("");
    setErrorMsg("");
    try {
      const res = await apiCall("saveSupplier", token, {
        name: editSupplierName,
        phone: editSupplierPhone,
        price: Number(editSupplierPrice || 0),
        notes: editSupplierNotes,
        openingBalance: Number(editSupplierOpeningBalance || 0)
      });
      if (res && res.ok) {
        setSuccessMsg("تم حفظ وتعديل بيانات المورد بنجاح ✓");
        setIsEditModalOpen(false);
        initializeData();
      } else {
        setErrorMsg(res?.error || "خطأ أثناء حفظ البيانات.");
      }
    } catch (err: any) {
      setErrorMsg("حدث خطأ غير متوقع: " + err.message);
    } finally {
      setIsSavingSupplier(false);
    }
  }

  // Statement print view trigger
  function handlePrintStatement() {
    window.print();
  }

  return (
    <div className="p-4 space-y-6 select-none font-sans text-right" id="suppliers-unified-view">
      
      {/* Page Title & Main Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 border border-white/6 p-5 rounded-2xl print:hidden">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Users className="text-amber-500" size={18} />
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-widest">
              💼 كشف الحساب المركزي ومستودع الموردين
            </h2>
          </div>
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed">
            البوابة المتكاملة لمراجعة الطلبات المرفوعة للموردين، مطابقة المرتجعات، صرف الدفعات، والاطلاع على التدفق المالي التفصيلي.
          </p>
        </div>

        <button
          onClick={initializeData}
          disabled={isLoading}
          className="px-4 py-2 bg-slate-950 text-slate-350 hover:bg-slate-950/70 border border-white/8 rounded-xl text-xs font-black cursor-pointer flex items-center justify-center gap-1.5 transition-all self-start sm:self-auto disabled:opacity-40"
        >
          <RefreshCw className={isLoading ? "animate-spin" : ""} size={13} />
          <span>مزامنة الحسابات الفورية</span>
        </button>
      </div>

      {/* Dynamic Alerts */}
      {errorMsg && (
        <div className="bg-red-950/25 border border-red-900/30 text-red-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 print:hidden">
          <ShieldAlert size={14} className="shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-950/25 border border-emerald-900/30 text-emerald-400 p-3.5 rounded-xl text-xs font-bold flex items-center gap-2 print:hidden">
          <CheckCircle2 size={14} className="shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Consolidated Master Stats Dashboard Banner (Admin/Accountant Only) */}
      {isAdminOrAccountant && activeSubTab === "directory" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 print:hidden">
          {/* Active Suppliers Count */}
          <div className="bg-slate-900 border border-white/6 rounded-2xl p-4 text-right space-y-1">
            <span className="text-[10px] text-slate-400 font-black block">📁 عدد شركاء المكاتب</span>
            <div className="text-lg font-mono font-black text-slate-200">
              {accounts.length} <span className="text-xs text-slate-400">تاجر نشط</span>
            </div>
          </div>
          {/* Total Uploaded Value */}
          <div className="bg-slate-900 border border-white/6 rounded-2xl p-4 text-right space-y-1">
            <span className="text-[10px] text-slate-400 font-black block">📦 البضائع المرفوعة (صافي)</span>
            <div className="text-lg font-mono font-black text-blue-450 text-blue-400">
              {totalUploadedGoodsSystem.toLocaleString()} <span className="text-xs">ج.م</span>
            </div>
          </div>
          {/* Total Returns Handed Back */}
          <div className="bg-slate-900 border border-white/6 rounded-2xl p-4 text-right space-y-1">
            <span className="text-[10px] text-slate-400 font-black block">📦 المرتجعات المخصومة</span>
            <div className="text-lg font-mono font-black text-red-400">
              {totalReturnsGoodsSystem.toLocaleString()} <span className="text-xs">ج.م</span>
            </div>
          </div>
          {/* Total Paid Out Cash */}
          <div className="bg-slate-900 border border-white/6 rounded-2xl p-4 text-right space-y-1">
            <span className="text-[10px] text-slate-400 font-black block">🟢 كلي المدفوعات المسددة</span>
            <div className="text-lg font-mono font-black text-emerald-400">
              {totalPaymentsMadeSystem.toLocaleString()} <span className="text-xs">ج.م</span>
            </div>
          </div>
          {/* Cumulative Net Dues to all Suppliers */}
          <div className="bg-slate-900/60 border border-amber-500/20 rounded-2xl p-4 text-right space-y-1 shadow-lg shadow-amber-500/2">
            <span className="text-[10px] text-amber-500 font-black block">👑 المبلغ الكلي العالق بذمة الشركة</span>
            <div className="text-xl font-mono font-black text-amber-450 text-amber-500">
              {totalFinancialDuesSystem.toLocaleString()} <span className="text-xs">ج.م</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigations Tabs (Internal Segmented Control) */}
      <div className="flex bg-slate-950 p-1 border border-white/6 rounded-2xl print:hidden">
        {/* Tab 1: Directory (Only for Admins/Staffs) */}
        {!isSupplierRole && (
          <button
            onClick={() => setActiveSubTab("directory")}
            className={`flex-1 text-center py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
              activeSubTab === "directory"
                ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
                : "text-slate-450 text-slate-400 hover:text-slate-100"
            }`}
          >
            📋 دليل حسابات الموردين والدفعات
          </button>
        )}

        {/* Tab 2: Detailed Chronicle Statement */}
        <button
          onClick={() => setActiveSubTab("statement")}
          className={`flex-1 text-center py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "statement"
              ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
              : "text-slate-450 text-slate-400 hover:text-slate-100"
          }`}
        >
          📂 كشف الحساب التفصيلي والتدقيق
        </button>

        {/* Tab 3: Cairo-Offset Query Screen */}
        <button
          onClick={() => setActiveSubTab("query")}
          className={`flex-1 text-center py-3 rounded-xl text-xs font-black transition-all cursor-pointer ${
            activeSubTab === "query"
              ? "bg-amber-500 text-slate-950 shadow-md font-extrabold"
              : "text-slate-450 text-slate-400 hover:text-slate-100"
          }`}
        >
          🔍 الاستعلام الفوري والمطابقة للمورد
        </button>
      </div>

      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB A: REGISTERED ACCOUNTS AND DIRECTORY LISTING */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "directory" && !isSupplierRole && (
        <div className="space-y-6 print:hidden" id="directory-subtab-container">
          
          {/* Quick Filter Box */}
          <div className="bg-slate-900 border border-white/6 rounded-2xl p-4 flex items-center">
            <Search className="text-slate-500 ml-2.5" size={16} />
            <input
              type="text"
              placeholder="🎯 ابحث عن تاجر بالاسم المعرّف أو شركة الشحن التابعة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-slate-100 text-right outline-none placeholder:text-slate-500"
            />
          </div>

          {/* Accounts Grid */}
          {isLoading ? (
            <div className="text-center py-20 text-xs text-slate-500 bg-slate-900/20 border border-white/4 rounded-2xl animate-pulse">
              جاري تدقيق الخزائن وسحب مؤشرات أداء الموردين والشركاء...
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="text-center py-16 text-xs text-slate-500 bg-slate-900 border border-white/6 rounded-2xl">
              لا توجد نتائج تطابق معيار التصفية المختار.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredAccounts.map((acc) => {
                const outstanding = acc.balance; // Remaining dues (unrestricted negative value allowed)

                return (
                  <div
                    key={acc.name}
                    className="bg-slate-900 border border-white/6 rounded-2xl p-5 hover:border-amber-500/30 transition-all flex flex-col justify-between"
                  >
                    <div className="space-y-4">
                      {/* Name Header and rate bar */}
                      <div className="flex justify-between items-start border-b border-white/6 pb-3">
                        <div className="flex items-center gap-2">
                          {isAdminOrAccountant && (
                            <button
                              onClick={() => handleEditSupplierClick(acc.name)}
                              className="p-1 text-slate-400 hover:text-amber-500 rounded transition-colors bg-slate-950 border border-white/10"
                              title="تعديل بيانات المورد"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          )}
                          <span className="text-[10px] font-black text-emerald-400 bg-emerald-950/30 border border-emerald-900/30 px-2.5 py-1 rounded-lg">
                            🟢 تسليم {acc.rate || 0}%
                          </span>
                        </div>
                        <h3 className="text-xs font-black text-slate-100">{acc.name}</h3>
                      </div>

                      {/* Quantum of Metrics */}
                      <div className="space-y-2 text-[11px]">
                        <div className="flex justify-between">
                          <span className="text-slate-200 font-extrabold font-mono">{acc.totalOrders || 0} طلب</span>
                          <span className="text-slate-450 text-slate-400">: إجمالي الطلبات المرفوعة</span>
                        </div>

                        <div className="flex justify-between">
                          <span className="text-emerald-400 font-bold font-mono">{acc.deliveredOrders || 0} طلب</span>
                          <span className="text-slate-450">: مسلّم بنجاح للعميل</span>
                        </div>

                        {/* Net Goods value - totalGoodsUploaded (without company shipping fees as requested!) */}
                        <div className="flex justify-between border-t border-dashed border-white/4 pt-2">
                          <span className="text-blue-400 font-extrabold font-mono">
                            {Number(acc.totalCOD || 0).toLocaleString()} ج.م
                          </span>
                          <span className="text-slate-400">: إجمالي البضاعة المرفوعة (صافي)</span>
                        </div>

                        {/* Returns deducted value */}
                        <div className="flex justify-between">
                          <span className="text-red-400 font-bold font-mono">
                            {Number(acc.returnsDelivered || 0).toLocaleString()} ج.م ({acc.returnsCount || 0} طلب مسترجع)
                          </span>
                          <span className="text-slate-400">: المرتجعات المرتدة والخصم</span>
                        </div>

                        {/* Total payments paid to supplier */}
                        <div className="flex justify-between">
                          <span className="text-slate-300 font-bold font-mono">
                            {Number(acc.payments || 0).toLocaleString()} ج.م
                          </span>
                          <span className="text-slate-440 text-slate-400">: الدفعات النقدية المسددة</span>
                        </div>

                        {/* Opening Balance */}
                        {acc.openingBalance !== undefined && Number(acc.openingBalance) !== 0 && (
                          <div className="flex justify-between border-t border-dashed border-white/4 pt-2">
                            <span className="text-amber-450 text-amber-500 font-bold font-mono">
                              {Number(acc.openingBalance).toLocaleString()} ج.م
                            </span>
                            <span className="text-slate-400">: رصيد افتتاحي (سابق)</span>
                          </div>
                        )}

                        {/* Reverse Adjustments on supplier */}
                        {acc.adjustments !== undefined && acc.adjustments !== null && Number(acc.adjustments) !== 0 && (
                          <div className="flex justify-between">
                            <span className="text-red-300 font-bold font-mono">
                              {Number(acc.adjustments).toLocaleString()} ج.م
                            </span>
                            <span className="text-slate-400">: التسويات العكسية/ السحوبات</span>
                          </div>
                        )}

                        {/* Final Net Account Due */}
                        <div className="flex justify-between text-xs font-black border-t border-white/6 pt-2.5 mt-2">
                          <span className={`font-mono text-sm font-black ${outstanding > 0 ? "text-amber-500" : outstanding < 0 ? "text-red-400" : "text-slate-350"}`}>
                            {Number(outstanding || 0).toLocaleString()} ج.م
                          </span>
                          <span className="text-slate-200 font-black">: المستحقات العالقة الحالية</span>
                        </div>
                      </div>
                    </div>

                    {/* Operational triggers */}
                    <div className="mt-5 pt-3.5 border-t border-white/6 flex flex-col sm:flex-row gap-2">
                      {/* Statement Chronicle link */}
                      <button
                        onClick={() => {
                          setSelectedLedgerSupplier(acc.name);
                          setActiveSubTab("statement");
                        }}
                        className="flex-1 py-2 bg-slate-950 hover:bg-slate-900 border border-white/8 rounded-xl text-[10px] font-black text-slate-350 text-center cursor-pointer transition-colors"
                      >
                        📂 كشف تفصيلي
                      </button>

                      {/* Payout button trigger */}
                      {isAdminOrAccountant && (
                        <button
                          onClick={() => {
                            setActiveSettleSupplier(acc);
                            setSettleAmount(outstanding.toString());
                            setSettleDesc(`تصفية وصرف رصيد المورد: ${acc.name} للطلبات المسجلة بالكامل`);
                            setIsSettleModalOpen(true);
                          }}
                          className="flex-1 py-2 bg-slate-950 hover:bg-amber-600/10 border border-white/8 rounded-xl text-[10px] font-black text-amber-500 text-center cursor-pointer transition-all"
                        >
                          💸 دفعة / تسوية
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}


      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB B: DETAILED CHRONOLOGICAL STATEMENT TABLE (Kashf Hesab) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "statement" && (
        <div className="space-y-6" id="statement-subtab-container">
          
          {/* Pre-Calculated Global Snapshots Banner (Zero-Lag Widgets) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">إجمالي تحصيل الشركاء (COD)</span>
                <span className="text-xl font-black font-mono text-emerald-400">
                  {supplierSnapshots.reduce((sum, s) => sum + s.totalCollection, 0).toLocaleString()} ج.م
                </span>
              </div>
              <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <TrendingUp size={20} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">صافي المستحقات التراكمية للحسابات</span>
                <span className="text-xl font-black font-mono text-amber-500">
                  {supplierSnapshots.reduce((sum, s) => sum + s.netDues, 0).toLocaleString()} ج.م
                </span>
              </div>
              <div className="p-3 bg-amber-500/10 text-amber-500 rounded-xl">
                <Wallet size={20} />
              </div>
            </div>

            <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-5 rounded-2xl flex items-center justify-between shadow-lg">
              <div className="space-y-1">
                <span className="text-[10px] text-slate-400 font-bold block uppercase tracking-wider">إجمالي الشحنات المعلقة حالياً</span>
                <span className="text-xl font-black font-mono text-blue-400">
                  {supplierSnapshots.reduce((sum, s) => sum + s.pendingCount, 0).toLocaleString()} شحنة
                </span>
              </div>
              <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl">
                <Layers size={20} />
              </div>
            </div>
          </div>

          {/* Pre-Calculated Supplier Snapshots Selector Grid (Click to Filter/Expand) */}
          <div className="space-y-2 print:hidden">
            <span className="text-[10.5px] font-black text-slate-400 block uppercase tracking-wider">
              ⚡ المراقبة الفورية والمستحقات المباشرة لكل مورد (انقر لتصفية وفرد كشف الحساب)
            </span>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {supplierSnapshots
                .filter(snap => !isSupplierRole || snap.name === user)
                .map(snap => {
                  const isSelected = selectedLedgerSupplier === snap.name;
                  return (
                    <div
                      key={snap.name}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedLedgerSupplier("");
                        } else {
                          setSelectedLedgerSupplier(snap.name);
                          fetchSupplierStatement(snap.name);
                        }
                      }}
                      className={`relative overflow-hidden bg-slate-900 hover:bg-slate-950/80 border rounded-xl p-3.5 cursor-pointer transition-all ${
                        isSelected 
                          ? "border-amber-500 bg-amber-950/10 shadow-lg shadow-amber-500/5 ring-1 ring-amber-500/30" 
                          : "border-white/6 hover:border-slate-500"
                      }`}
                    >
                      <div className="flex justify-between items-start gap-1">
                        <span className="text-xs font-black text-slate-100 truncate max-w-[130px]">{snap.name}</span>
                        {isSelected ? (
                          <span className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-md shrink-0">نشط ✓</span>
                        ) : snap.pendingCount > 0 ? (
                          <span className="bg-blue-500/10 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">
                            {snap.pendingCount} معلق
                          </span>
                        ) : (
                          <span className="bg-emerald-500/10 text-emerald-400 text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0">مستقر</span>
                        )}
                      </div>
                      <div className="mt-2.5 grid grid-cols-2 gap-2 text-[10px] border-t border-white/4 pt-2">
                        <div>
                          <span className="text-slate-500 block">الصافي الدائن</span>
                          <span className={`font-mono font-black ${snap.netDues > 0 ? "text-amber-500" : "text-slate-300"}`}>
                            {snap.netDues?.toLocaleString()} ج.م
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block">إجمالي تحصيل</span>
                          <span className="font-mono font-bold text-slate-300">
                            {snap.totalCollection?.toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Accordion List of Supplier Accounting Workspaces */}
          <div className="space-y-4">
            {supplierSnapshots
              .filter(snap => !isSupplierRole || snap.name === user)
              .map(snap => {
                const isExpanded = selectedLedgerSupplier === snap.name;
                return (
                  <div 
                    key={snap.name} 
                    className={`bg-slate-900 border rounded-2xl overflow-hidden transition-all duration-300 ${
                      isExpanded 
                        ? "border-amber-500/40 shadow-xl shadow-amber-500/2 bg-gradient-to-b from-slate-900 to-slate-950" 
                        : "border-white/6 hover:border-slate-700"
                    }`}
                  >
                    {/* Accordion Header */}
                    <div 
                      onClick={() => {
                        if (isExpanded) {
                          setSelectedLedgerSupplier("");
                        } else {
                          setSelectedLedgerSupplier(snap.name);
                          fetchSupplierStatement(snap.name);
                        }
                      }}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none border-b border-white/4"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${isExpanded ? "bg-amber-500 text-slate-950" : "bg-slate-950 text-slate-400"}`}>
                          <Users size={16} />
                        </div>
                        <div className="space-y-0.5">
                          <h3 className="text-xs font-black text-slate-100 flex items-center gap-2">
                            <span>{snap.name}</span>
                            {snap.phone && <span className="text-[10px] text-slate-500 font-mono font-normal">({snap.phone})</span>}
                          </h3>
                          <span className="text-[10px] text-slate-400 font-semibold block">اضغط للتوسيع وعرض كشف الحساب التفصيلي المحدث</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 self-end md:self-auto text-xs font-mono">
                        <div className="hidden sm:block text-right">
                          <span className="text-[9px] text-slate-500 block">إجمالي تحصيله</span>
                          <span className="text-slate-300 font-bold">{snap.totalCollection?.toLocaleString()} ج.م</span>
                        </div>
                        <div className="text-right border-r border-white/6 pr-4">
                          <span className="text-[9px] text-slate-500 block">الصافي المستحق للمورد</span>
                          <span className={`font-black ${snap.netDues > 0 ? "text-amber-500" : "text-emerald-400"}`}>
                            {snap.netDues?.toLocaleString()} ج.م
                          </span>
                        </div>
                        <div className="text-right border-r border-white/6 pr-4 pl-2">
                          <span className="text-[9px] text-slate-500 block">شحنات معلقة</span>
                          <span className={`font-black ${snap.pendingCount > 0 ? "text-blue-400" : "text-slate-500"}`}>
                            {snap.pendingCount}
                          </span>
                        </div>
                        <div className="text-slate-400 transform transition-transform duration-300">
                          <span className="text-lg font-black">{isExpanded ? "▲" : "▼"}</span>
                        </div>
                      </div>
                    </div>

                    {/* Accordion Body (Lazy Rendered Only when active) */}
                    {isExpanded && (
                      <div className="p-5 space-y-6">
                        
                        {/* Instant Fast-Loading Summary Widgets (Using Snap Cache) */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 print:hidden">
                          <div className="bg-slate-950 border border-white/6 p-4 rounded-2xl flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-extrabold block">👤 المورد الشريك</span>
                              <span className="text-sm font-black text-white">{snap.name}</span>
                            </div>
                            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                              <Users size={16} />
                            </div>
                          </div>

                          <div className="bg-slate-950 border border-white/6 p-4 rounded-2xl flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-extrabold block">💰 إجمالي المبالغ المحصلة</span>
                              <span className="text-sm font-black text-slate-100 font-mono">
                                {snap.totalCollection?.toLocaleString()} ج.م
                              </span>
                            </div>
                            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
                              <Wallet size={16} />
                            </div>
                          </div>

                          <div className="bg-slate-950 border border-white/6 p-4 rounded-2xl flex items-center justify-between">
                            <div className="space-y-1">
                              <span className="text-[10px] text-amber-500 font-extrabold block">⚖️ الصافي الدائن المستحق للتصفية</span>
                              <span className="text-sm font-black text-amber-500 font-mono">
                                {snap.netDues?.toLocaleString()} ج.م
                              </span>
                            </div>
                            <div className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
                              <DollarSign size={16} />
                            </div>
                          </div>
                        </div>

                        {/* Print Header (Visible ONLY on viewport printing) */}
                        <div className="hidden print:block text-right pb-4 border-b border-black mb-6">
                          <h1 className="text-xl font-black text-black">شركة الشحن والتوصيل المتكاملة</h1>
                          <h2 className="text-base font-bold text-gray-700">كشف حساب مالي تفصيلي للمورد الشريك: {snap.name}</h2>
                          <p className="text-[10px] text-gray-500">تم الاستخراج بتاريخ: {new Date().toLocaleString("ar-EG")}</p>
                        </div>

                        {/* Detailed Metrics Ribbon (from backend stats) */}
                        {isLedgerLoading ? (
                          <div className="text-center py-12 text-xs text-slate-500 animate-pulse bg-slate-950/20 border border-white/5 rounded-xl">
                            🔄 جاري قراءة الدفاتر وتركيب الحركات المالية للمورد لحظياً...
                          </div>
                        ) : !ledgerStats ? (
                          <div className="text-center py-8 text-xs text-slate-500 border border-white/4 rounded-xl">
                            ⚠️ لا تتوفر إحصائيات مالية حالية لهذا المورد.
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-950/60 p-4 rounded-xl border border-white/5">
                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-semibold block">إجمالي البضائع المرفوعة (صافي)</span>
                              <span className="text-sm font-black font-mono text-blue-400">
                                {ledgerStats.totalGoodsUploaded?.toLocaleString()} ج.م <span className="text-[9px] text-slate-500">({ledgerStats.totalOrdersCount} طلب)</span>
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-semibold block">المرتجع المرتد المخصوم</span>
                              <span className="text-sm font-black font-mono text-red-400">
                                {ledgerStats.returnsDeliveredValue?.toLocaleString()} ج.م <span className="text-[9px] text-slate-500">({ledgerStats.returnsDeliveredCount} طلب مرتد)</span>
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-slate-400 font-semibold block">الدفعات والسحوبات المصروفة</span>
                              <span className="text-sm font-black font-mono text-emerald-400">
                                {((ledgerStats.paymentsValue || 0) + (ledgerStats.reverseAdjustmentsValue || 0)).toLocaleString()} ج.م
                              </span>
                            </div>

                            <div className="space-y-1">
                              <span className="text-[10px] text-amber-500 font-semibold block">الرصيد الدائن الحالي للمورد</span>
                              <span className="text-base font-black font-mono text-amber-500">
                                {ledgerStats.outstanding?.toLocaleString()} ج.م
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Fast Action Buttons Banner */}
                        <div className="flex flex-wrap items-center gap-2 print:hidden">
                          {isAdminOrAccountant && (
                            <button
                              onClick={() => {
                                const targetAcc = accounts.find(a => a.name === snap.name);
                                if (targetAcc) {
                                  setActiveSettleSupplier(targetAcc);
                                  setSettleAmount(targetAcc.balance.toString());
                                  setSettleDesc(`صرف دفعة مالية للحساب من كشف الحساب المركزي`);
                                  setIsSettleModalOpen(true);
                                }
                              }}
                              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                            >
                              <DollarSign size={13} />
                              <span>صرف دفعة نقدية</span>
                            </button>
                          )}

                          <button
                            onClick={handlePrintStatement}
                            className="px-4 py-2.5 bg-slate-950 hover:bg-slate-800 border border-white/10 text-slate-300 font-extrabold text-xs rounded-xl cursor-pointer flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Printer size={13} />
                            <span>طباعة / تصدير PDF كشف حساب</span>
                          </button>
                        </div>

                        {/* Instant Status-Color Filter Bar & Custom Audit Inputs */}
                        <div className="bg-slate-950/40 border border-white/5 rounded-2xl p-4 space-y-4 print:hidden">
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/5 pb-3">
                            <div className="flex items-center gap-1.5">
                              <Filter className="text-amber-500" size={13} />
                              <span className="text-[11px] font-black text-slate-200">فرز وتصنيف القيود المالية (فوري وبألوان متباينة)</span>
                            </div>
                            
                            {/* Color Coded Status Quick Filter Toggle Buttons */}
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setStatusFilter("all")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-all ${
                                  statusFilter === "all"
                                    ? "bg-slate-800 text-slate-100 border-slate-500 shadow-md"
                                    : "bg-slate-950 text-slate-400 border-white/5 hover:text-slate-200"
                                }`}
                              >
                                عرض كل الحركات ({ledgerEntries.length})
                              </button>
                              
                              <button
                                type="button"
                                onClick={() => setStatusFilter("settled")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-all flex items-center gap-1 ${
                                  statusFilter === "settled"
                                    ? "bg-emerald-950 text-emerald-400 border-emerald-500 shadow-md shadow-emerald-500/5"
                                    : "bg-slate-950 text-emerald-500/50 border-emerald-500/10 hover:bg-emerald-950/20 hover:text-emerald-450"
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                                مصفى ومصروف مسبقاً
                              </button>

                              <button
                                type="button"
                                onClick={() => setStatusFilter("pending")}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold cursor-pointer border transition-all flex items-center gap-1 ${
                                  statusFilter === "pending"
                                    ? "bg-amber-950 text-amber-500 border-amber-500 shadow-md shadow-amber-500/5"
                                    : "bg-slate-950 text-amber-500/50 border-amber-500/10 hover:bg-amber-950/20 hover:text-amber-450"
                                }`}
                              >
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block"></span>
                                معلق جاهز للمحاسبة الفورية
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                            {/* Search query */}
                            <div>
                              <label className="text-[9.5px] font-black text-slate-500 block mb-1">ابحث برقم الباركود / الكود</label>
                              <input
                                type="text"
                                placeholder="رقم الأوردر أو البيان..."
                                value={filterSearch}
                                onChange={(e) => setFilterSearch(e.target.value)}
                                className="w-full bg-slate-950 border border-white/6 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-200 outline-none text-right"
                              />
                            </div>

                            {/* Filter Type */}
                            <div>
                              <label className="text-[9.5px] font-black text-slate-500 block mb-1">نوع الحركة</label>
                              <select
                                value={filterType}
                                onChange={(e) => setFilterType(e.target.value)}
                                className="w-full bg-slate-950 border border-white/6 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-100 outline-none"
                              >
                                <option value="all">كل الحركات والقيود</option>
                                <option value="rights">حقوق بضاعة الأوردرات</option>
                                <option value="returns">المرتجعات المخصومة</option>
                                <option value="payments">الدفعات النقدية والمسددات</option>
                                <option value="adjustments">التسويات العكسية والسحوبات</option>
                              </select>
                            </div>

                            {/* Start Date */}
                            <div>
                              <label className="text-[9.5px] font-black text-slate-500 block mb-1">تاريخ البداية من</label>
                              <input
                                type="date"
                                value={filterStartDate}
                                onChange={(e) => setFilterStartDate(e.target.value)}
                                className="w-full bg-slate-950 border border-white/6 rounded-lg px-3 py-1.5 text-xs font-bold font-mono text-slate-200 outline-none text-right"
                              />
                            </div>

                            {/* End Date */}
                            <div>
                              <label className="text-[9.5px] font-black text-slate-500 block mb-1">تاريخ النهاية إلى</label>
                              <input
                                type="date"
                                value={filterEndDate}
                                onChange={(e) => setFilterEndDate(e.target.value)}
                                className="w-full bg-slate-950 border border-white/6 rounded-lg px-3 py-1.5 text-xs font-bold font-mono text-slate-200 outline-none text-right"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Chronic Ledger Table Representation */}
                        {isLedgerLoading ? (
                          <div className="text-center py-16 text-xs text-slate-500 animate-pulse">
                            جاري جلب البنود والقيود التفصيلية...
                          </div>
                        ) : filteredLedgerEntries.length === 0 ? (
                          <div className="text-center py-12 text-xs text-slate-500 bg-slate-950/40 border border-dashed border-white/5 rounded-2xl">
                            لا توجد قيود مالية مسجلة تتوافق مع محددات البحث والتاريخ وتصفية الحالة الحالية.
                          </div>
                        ) : (
                          <div className="space-y-4">
                            <div className="bg-slate-950 border border-white/6 rounded-2xl overflow-hidden shadow-sm">
                              <div className="p-4 bg-slate-950 font-black text-xs text-slate-200 border-b border-white/6 flex justify-between items-center print:hidden">
                                <span>كشف الحساب - القائمة مرتبة بالأحداث الأحدث أولاً (انقر لتوسيع التفاصيل والخيارات ⚡)</span>
                                <span className="text-[10px] text-slate-400">حركات مفرودة: {filteredLedgerEntries.slice(0, visibleEntriesLimit).length} من أصل {filteredLedgerEntries.length}</span>
                              </div>

                              <div className="divide-y divide-white/5">
                                {/* Accordion Table Header Row (Hidden on mobile, helpful for large displays) */}
                                <div className="hidden sm:grid sm:grid-cols-12 gap-3 p-3.5 bg-slate-900/60 font-extrabold text-[10px] text-slate-400 border-b border-white/6 text-right">
                                  <div className="sm:col-span-3">التاريخ والمطابقة</div>
                                  <div className="sm:col-span-3">نوع الحركة ومستندها</div>
                                  <div className="sm:col-span-2">الكود/المرجع</div>
                                  <div className="sm:col-span-2 text-left">قيمة الحركة</div>
                                  <div className="sm:col-span-2 text-left">الرصيد التراكمي</div>
                                </div>

                                {filteredLedgerEntries.slice(0, visibleEntriesLimit).map((entry, idx) => {
                                  const isExpanded = expandedEntryIdx === idx;
                                  const isCredit = entry.amount > 0;
                                  const isReturn = entry.type === "مرتجع مخصوم" || (entry.type || "").includes("مرتجع");
                                  const isPayoutTrans = ["دفع نقدي", "سداد", "دفعة"].some(kw => (entry.type || "").includes(kw));
                                  
                                  return (
                                    <div key={idx} className="border-b border-white/4 last:border-0 hover:bg-white/[0.01] transition-colors">
                                      {/* Entry Header Accordion Tab */}
                                      <div 
                                        onClick={() => setExpandedEntryIdx(isExpanded ? null : idx)}
                                        className="p-3.5 flex flex-col sm:grid sm:grid-cols-12 gap-3 items-start sm:items-center cursor-pointer select-none text-[11px] text-right"
                                      >
                                        {/* Chevron + Date */}
                                        <div className="sm:col-span-3 flex items-center gap-2">
                                          <ChevronRight size={13} className={`text-slate-500 shrink-0 transform transition-transform duration-200 print:hidden ${isExpanded ? "rotate-90 text-amber-500" : ""}`} />
                                          <span className="font-mono text-slate-300 font-bold">
                                            {entry.date ? entry.date.toString().substring(0, 16) : "—"}
                                          </span>
                                        </div>

                                        {/* Type Badge */}
                                        <div className="sm:col-span-3">
                                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                                            isCredit 
                                              ? "bg-blue-955/20 text-blue-400 border border-blue-900/40" 
                                              : isReturn
                                              ? "bg-red-955/20 text-red-400 border border-red-900/40"
                                              : isPayoutTrans
                                              ? "bg-emerald-955/20 text-emerald-400 border border-emerald-900/40"
                                              : "bg-amber-955/20 text-amber-450 border border-amber-900/40"
                                          }`}>
                                            {isCredit && <TrendingUp size={11} className="shrink-0" />}
                                            {!isCredit && isReturn && <TrendingDown size={11} className="shrink-0" />}
                                            {!isCredit && !isReturn && <Layers size={11} className="shrink-0" />}
                                            <span>{entry.type}</span>
                                          </span>
                                        </div>

                                        {/* Barcode/Reference */}
                                        <div className="sm:col-span-2 font-mono text-slate-300">
                                          {entry.tracking && entry.tracking !== "CASH-PAY" ? (
                                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-white/5 text-[10px]">{entry.tracking}</span>
                                          ) : (
                                            <span className="text-slate-500">—</span>
                                          )}
                                        </div>

                                        {/* Amount */}
                                        <div className="sm:col-span-2 text-left w-full sm:w-auto font-mono font-black">
                                          <span className={isCredit ? "text-blue-400" : isPayoutTrans ? "text-emerald-400" : "text-red-400"}>
                                            {isCredit ? "+" : ""}{entry.amount?.toLocaleString()} ج.م
                                          </span>
                                        </div>

                                        {/* Balance after */}
                                        <div className="sm:col-span-2 text-left w-full sm:w-auto font-mono font-black text-amber-500">
                                          <span>{entry.balanceAfter?.toLocaleString()} ج.م</span>
                                        </div>
                                      </div>

                                      {/* Collapsible Panel Body */}
                                      <div className={`${isExpanded ? "block" : "hidden print:block"} p-4 bg-slate-950/45 border-t border-white/5 space-y-3 text-xs leading-relaxed text-right`}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                          <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-white/4">
                                            <span className="text-[10px] text-slate-400 font-extrabold block">📝 تفاصيل الحركة والبيان:</span>
                                            <p className="text-slate-200 font-bold leading-relaxed">{entry.desc}</p>
                                          </div>

                                          <div className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-white/4">
                                            <span className="text-[10px] text-slate-400 font-extrabold block">⚙️ الإجراءات السريعة والمستند:</span>
                                            <div className="flex flex-wrap items-center gap-2 pt-1">
                                              {entry.tracking && entry.tracking !== "CASH-PAY" && (
                                                <button
                                                  onClick={() => copyToClipboard(entry.tracking)}
                                                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-white/6 text-slate-300 font-extrabold rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                                                >
                                                  {copiedTracking === entry.tracking ? (
                                                    <>
                                                      <Check size={11} className="text-emerald-500" />
                                                      <span>تم النسخ ✓</span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <Copy size={11} />
                                                      <span>نسخ كود الشحنة ({entry.tracking})</span>
                                                    </>
                                                  )}
                                                </button>
                                              )}
                                              <div className="text-[11px] text-slate-400 flex items-center gap-1">
                                                <span>الرصيد بعد الحركة:</span>
                                                <span className="text-amber-500 font-bold">{entry.balanceAfter?.toLocaleString()} ج.م</span>
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Pagination/Load More Button for massive ledger lists */}
                            {filteredLedgerEntries.length > visibleEntriesLimit && (
                              <div className="flex justify-center pt-2 print:hidden">
                                <button
                                  type="button"
                                  onClick={() => setVisibleEntriesLimit(prev => prev + 50)}
                                  className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 border border-white/8 text-amber-500 font-black text-xs rounded-xl cursor-pointer flex items-center gap-1.5 transition-colors"
                                >
                                  <span>➕ عرض المزيد من القيود والعمليات التراكمية (+50 حركة متبقية)</span>
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

            {supplierSnapshots.filter(snap => !isSupplierRole || snap.name === user).length === 0 && (
              <div className="text-center py-12 text-xs text-slate-500 bg-slate-900 border border-white/6 rounded-2xl">
                لا يوجد موردين مسجلين حالياً لعرض كشف حساب مالي.
              </div>
            )}
          </div>
        </div>
      )}


      {/* ───────────────────────────────────────────────────────────── */}
      {/* TAB C: CAIRO-OFFSET PERFORMANCE SPOT CHECKS (Query Screen) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {activeSubTab === "query" && (
        <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-6 print:hidden" id="query-subtab-container">
          <div className="flex items-center gap-2 border-b border-white/5 pb-3">
            <Sparkles className="text-amber-500" size={16} />
            <h3 className="text-xs font-black text-slate-200">🔍 الاستعلام والمطابقة الفورية (اليوم والأوردرات)</h3>
          </div>

          <p className="text-[10px] text-slate-400 font-bold leading-relaxed -mt-2">
            يتيح هذا الموديل مطابقة حركة اليوم الفوري الفعالة للمورد وجهًا لوجه وحساب كميات الأوردرات الجديدة، المسلمة، أو المرتجعة للفرع فوراً.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 block pb-1">اختر التاجر / المورد</label>
              
              {isSupplierRole ? (
                <div className="bg-slate-950 border border-white/8 rounded-xl px-4 py-2.5 text-xs font-black text-amber-500">
                  👑 {selectedLedgerSupplier || "مورد مسجل"}
                </div>
              ) : (
                <select
                  value={querySupplier}
                  onChange={(e) => setQuerySupplier(e.target.value)}
                  className="w-full bg-slate-950 border border-white/8 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-100 outline-none focus:border-amber-500/50"
                >
                  <option value="">-- اضغط لتحديد المورد --</option>
                  {uniqueSuppliersList.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 block pb-1">تاريخ اليوم المالي للاستعلام</label>
              <input
                type="date"
                value={queryDate}
                onChange={(e) => setQueryDate(e.target.value)}
                className="w-full bg-slate-950 border border-white/8 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-100 outline-none focus:border-amber-500/50 text-right"
              />
            </div>
          </div>

          {querySupplier ? (
            queryResult ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                <div className="bg-slate-950/65 border border-white/5 rounded-xl p-3.5 text-center space-y-1 hover:border-white/10 transition-all">
                  <span className="text-[10px] text-slate-400 block font-bold">الأوردرات المرفوعة اليوم</span>
                  <span className="text-xl font-black text-slate-100 font-mono">{queryResult.total}</span>
                </div>
                <div className="bg-emerald-950/20 border border-emerald-900/30 rounded-xl p-3.5 text-center space-y-1 hover:border-emerald-600/20 transition-all">
                  <span className="text-[10px] text-emerald-450 block font-bold">المسلمة للعملاء اليوم</span>
                  <span className="text-xl font-black text-emerald-450 font-mono">{queryResult.delivered}</span>
                </div>
                <div className="bg-amber-950/20 border border-amber-900/30 rounded-xl p-3.5 text-center space-y-1 hover:border-amber-600/20 transition-all">
                  <span className="text-[10px] text-amber-450 block font-bold">قيد الارتجاع في فرع المكتب</span>
                  <span className="text-xl font-black text-amber-450 font-mono">{queryResult.returnedToOffice}</span>
                </div>
                <div className="bg-blue-950/20 border border-blue-900/30 rounded-xl p-3.5 text-center space-y-1 hover:border-blue-600/20 transition-all">
                  <span className="text-[10px] text-blue-450 block font-bold">المرتجعات الـمُستلمة فعلياً للتاجر</span>
                  <span className="text-xl font-black text-blue-450 font-mono">{queryResult.returnedDelivered}</span>
                </div>
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-500 font-bold">جاري جلب واحتساب حركات المورد المختار...</div>
            )
          ) : (
            <div className="text-center py-5 text-[10px] text-slate-500 font-black bg-slate-950/30 rounded-xl border border-dashed border-white/5">
              💡 يرجى اختيار اسم التاجر / المورد لعرض كمياته الفورية
            </div>
          )}
        </div>
      )}


      {/* ───────────────────────────────────────────────────────────── */}
      {/* FINANCIAL SETTLEMENT INPUT MODAL (Admin/Accountant Only) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isSettleModalOpen && activeSettleSupplier && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full text-right space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/6 pb-3">
              <button 
                onClick={() => setIsSettleModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-sm font-black cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>
              <h3 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                <Sparkles className="text-amber-500" size={14} />
                <span>إجراء تسوية مالية للمورد: [{activeSettleSupplier.name}]</span>
              </h3>
            </div>

            <form onSubmit={handleSettleSubmit} className="space-y-4">
              
              {/* Settle break stats */}
               <div className="bg-slate-950 p-4 border border-white/6 rounded-xl space-y-2.5 text-xs">
                 <div className="flex justify-between items-center text-slate-300">
                   <span className="font-mono font-bold text-blue-400">
                     {Number(activeSettleSupplier.totalCOD || 0).toLocaleString()} ج.م
                   </span>
                   <span>إجمالي البضاعة المرفوعة (صافي بضاعة)</span>
                 </div>

                 <div className="flex justify-between items-center text-slate-300">
                   <span className="font-mono font-bold text-red-400">
                     {Number(activeSettleSupplier.returnsDelivered || 0).toLocaleString()} ج.م
                   </span>
                   <span>المرتجعات المخصومة والمسلمة</span>
                 </div>

                 <div className="flex justify-between items-center text-slate-300">
                   <span className="font-mono font-light text-slate-400">
                     {Number(activeSettleSupplier.payments || 0).toLocaleString()} ج.م
                   </span>
                   <span>الدفعات النقدية السابقة</span>
                 </div>

                 <div className="border-t border-white/6 pt-2 pb-1 flex justify-between items-center font-black">
                   <span className={`font-mono text-sm font-black ${Number(activeSettleSupplier.balance || 0) > 0 ? "text-amber-500" : Number(activeSettleSupplier.balance || 0) < 0 ? "text-red-400" : "text-slate-200"}`}>
                     {Number(activeSettleSupplier.balance || 0).toLocaleString()} ج.م
                   </span>
                   <span className="text-slate-100">المبلغ المستحق الصافي الحالي</span>
                 </div>
               </div>

              {/* Transaction direction */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">نوع المعاملة المالية*</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettleTransType("payout")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      settleTransType === "payout"
                        ? "bg-amber-600/20 text-amber-500 border-amber-500 font-black"
                        : "bg-slate-950 text-slate-400 border-white/6 hover:bg-slate-900"
                    }`}
                  >
                    صرف دفعة للمورد (مدفوع)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleTransType("inflow")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      settleTransType === "inflow"
                        ? "bg-emerald-600/20 text-emerald-400 border-emerald-500 font-black"
                        : "bg-slate-950 text-slate-400 border-white/6 hover:bg-slate-900"
                    }`}
                  >
                    استلام نقدية (وارد)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettleTransType("adjustment")}
                    className={`py-2 px-1 text-[10px] sm:text-xs font-bold rounded-xl border text-center transition-all cursor-pointer ${
                      settleTransType === "adjustment"
                        ? "bg-blue-600/20 text-blue-400 border-blue-500 font-black"
                        : "bg-slate-950 text-slate-400 border-white/6 hover:bg-slate-900"
                    }`}
                  >
                    تسوية رصيد (يدوي)
                  </button>
                </div>
              </div>

              {/* Adjustment direction sub-selector */}
              {settleTransType === "adjustment" && (
                <div className="bg-slate-950/60 p-3 rounded-xl border border-white/4 space-y-2">
                  <label className="block text-[10px] font-bold text-slate-400">اتجاه التسوية اليدوية (لا تؤثر على الخزنة)*</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAdjustmentType("add")}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        adjustmentType === "add"
                          ? "bg-emerald-600/20 text-emerald-400 border-emerald-500 font-black"
                          : "bg-slate-950 text-slate-500 border-white/4 hover:bg-slate-900"
                      }`}
                    >
                      إضافة لرصيد المورد (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdjustmentType("subtract")}
                      className={`py-1.5 px-2 text-[10px] font-bold rounded-lg border text-center transition-all cursor-pointer ${
                        adjustmentType === "subtract"
                          ? "bg-red-600/20 text-red-400 border-red-500 font-black"
                          : "bg-slate-950 text-slate-500 border-white/4 hover:bg-slate-900"
                      }`}
                    >
                      خصم من رصيد المورد (-)
                    </button>
                  </div>
                </div>
              )}

              {/* Payout Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">
                  {settleTransType === "inflow"
                    ? "المبلغ المستلم من المورد (ج.م)*"
                    : settleTransType === "adjustment"
                    ? "مبلغ التسوية اليدوية (ج.م)*"
                    : "المبلغ المراد صرفه للمورد (ج.م)*"}
                </label>
                <input
                  type="number"
                  required
                  value={settleAmount}
                  onChange={(e) => setSettleAmount(e.target.value)}
                  className={`w-full bg-slate-950 border border-white/6 rounded-xl px-4 py-2.5 text-xs font-extrabold outline-none text-right font-mono focus:border-amber-500 ${
                    settleTransType === "inflow"
                      ? "text-emerald-400"
                      : settleTransType === "adjustment"
                      ? "text-blue-400"
                      : "text-amber-500"
                  }`}
                  placeholder={
                    settleTransType === "inflow"
                      ? "المبلغ المحصل لداخل الخزينة"
                      : settleTransType === "adjustment"
                      ? "تسوية رصيد يدوي دون حركة نقدية"
                      : "صرف دفعة نقدية مسددة للمورد"
                  }
                />
              </div>

              {/* Note context */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">بيان الدفعة وموثق الخزنة</label>
                <textarea
                  value={settleDesc}
                  onChange={(e) => setSettleDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-white/6 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-bold outline-none text-right placeholder:text-slate-600 min-h-[60px] focus:border-amber-550"
                  placeholder="وصف المستند لإيضاح الفاتورة أو التسوية..."
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-3 border-t border-white/6">
                <button
                  type="button"
                  onClick={() => setIsSettleModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-950/80 border border-white/6 rounded-xl text-[11px] font-extrabold text-slate-400 text-center cursor-pointer transition-all"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  disabled={isSettling}
                  className={`flex-1 py-2.5 text-slate-950 rounded-xl text-[10px] font-black text-center cursor-pointer transition-all disabled:opacity-50 ${
                    settleTransType === "inflow"
                      ? "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white"
                      : settleTransType === "adjustment"
                      ? "bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-black"
                      : "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  }`}
                >
                  {isSettling
                    ? "جاري الحفظ..."
                    : settleTransType === "inflow"
                    ? "تأكيد واستلام النقدية 📥"
                    : settleTransType === "adjustment"
                    ? "تأكيد وقيد التسوية اليدوية 💾"
                    : "تأكيد وصرف النقديّة ✅"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ───────────────────────────────────────────────────────────── */}
      {/* EDIT SUPPLIER PROFILE MODAL (Admin/Accountant Only) */}
      {/* ───────────────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-md w-full text-right space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/6 pb-3">
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-sm font-black cursor-pointer bg-transparent border-none"
              >
                ✕
              </button>
              <h3 className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                <Edit3 className="text-amber-500" size={14} />
                <span>تعديل الملف المالي وبيانات المورد</span>
              </h3>
            </div>

            <form onSubmit={handleSaveSupplierSubmit} className="space-y-4">
              {/* Supplier Name (Readonly or display label since it's the primary key/ID) */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">اسم المورد (معرّف ثابت لا يمكن تغييره)</label>
                <input
                  type="text"
                  disabled
                  value={editSupplierName}
                  className="w-full bg-slate-950/60 border border-white/4 rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-400 outline-none text-right cursor-not-allowed"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">رقم الهاتف للتاجر</label>
                <input
                  type="text"
                  value={editSupplierPhone}
                  onChange={(e) => setEditSupplierPhone(e.target.value)}
                  className="w-full bg-slate-950 border border-white/6 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-100 outline-none text-right placeholder:text-slate-700 focus:border-amber-500"
                  placeholder="مثال: 01000000000"
                />
              </div>

              {/* Price / Commission */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">سعر شحن الشركة / تكلفة التوصيل المتفق عليها (ج.م)*</label>
                <input
                  type="number"
                  required
                  value={editSupplierPrice}
                  onChange={(e) => setEditSupplierPrice(e.target.value)}
                  className="w-full bg-slate-950 border border-white/6 rounded-xl px-4 py-2.5 text-xs font-extrabold text-slate-100 outline-none text-right font-mono focus:border-amber-500"
                  placeholder="سعر التوصيل الثابت للتاجر"
                />
              </div>

              {/* Opening Balance */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">الرصيد الافتتاحي المبدئي (سابقة أعمال / مستحق مرحّل) (ج.م)*</label>
                <input
                  type="number"
                  required
                  value={editSupplierOpeningBalance}
                  onChange={(e) => setEditSupplierOpeningBalance(e.target.value)}
                  className="w-full bg-slate-950 border border-white/6 rounded-xl px-4 py-2.5 text-xs font-extrabold text-amber-500 outline-none text-right font-mono focus:border-amber-500"
                  placeholder="الرصيد الافتتاحي"
                />
                <p className="text-[9px] text-slate-500 mt-1 leading-normal font-bold">
                  * رصيد البداية المسجل للمورد قبل استخدام السيستم (يمكن تعديله لتسوية الفروق التاريخية).
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-[11px] font-bold text-slate-400 mb-1.5">ملاحظات ومقرر الاتفاق</label>
                <textarea
                  value={editSupplierNotes}
                  onChange={(e) => setEditSupplierNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-white/6 rounded-xl px-3 py-2.5 text-xs text-slate-100 font-bold outline-none text-right placeholder:text-slate-600 min-h-[50px] focus:border-amber-500"
                  placeholder="عنوان المورد، تفاصيل الاتفاق التجاري إلخ..."
                />
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-3 border-t border-white/6">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-950 hover:bg-slate-950/80 border border-white/6 rounded-xl text-[11px] font-extrabold text-slate-400 text-center cursor-pointer transition-all"
                >
                  إلغاء الأمر
                </button>
                <button
                  type="submit"
                  disabled={isSavingSupplier}
                  className="flex-1 py-2.5 text-slate-950 rounded-xl text-[10px] font-black text-center cursor-pointer transition-all disabled:opacity-50 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                >
                  {isSavingSupplier ? "جاري الحفظ..." : "حفظ التحديثات ✓"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
