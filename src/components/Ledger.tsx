import React, { useEffect, useState } from "react";
import { PlusCircle, Wallet, FileText, ArrowUpRight, ArrowDownRight, Calendar, Filter, Users, ShieldAlert, Search, Eye, CheckCircle2, Clock, Loader2, ArrowLeft, Check, Shield, ChevronDown, ChevronUp, Lock } from "lucide-react";
import { apiCall } from "../utils";

function parseSafeNumber(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  const cleaned = val.toString().replace(/[^\d.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

function getOrderFinancials(o: any) {
  if (!o) return { prodPrice: 0, shipPrice: 0, totalCOD: 0 };
  
  var shipPrice = 0;
  var rawShip = o["سعر الشحن"] !== undefined ? o["سعر الشحن"] :
                (o["الشحن"] !== undefined ? o["الشحن"] :
                (o["تكلفة الشحن"] !== undefined ? o["تكلفة الشحن"] :
                (o["مصاريف الشحن"] !== undefined ? o["مصاريف الشحن"] :
                (o["shipping"] !== undefined ? o["shipping"] :
                (o["shipPrice"] !== undefined ? o["shipPrice"] :
                o["ship_price"])))));
                
  if (rawShip !== undefined && rawShip !== null && rawShip !== "") {
    shipPrice = parseSafeNumber(rawShip);
  }

  var totalCOD = 0;
  var rawTotal = o["المطلب تحصيله"] !== undefined ? o["المطلب تحصيله"] :
                 (o["المطلوب تحصيله"] !== undefined ? o["المطلوب تحصيله"] :
                 (o["التحصيل"] !== undefined ? o["التحصيل"] :
                 (o["المطلوب"] !== undefined ? o["المطلوب"] :
                 (o["إجمالي الكود"] !== undefined ? o["إجمالي الكود"] :
                 (o["الإجمالي"] !== undefined ? o["الإجمالي"] :
                 (o["الاجمالي"] !== undefined ? o["الاجمالي"] :
                 (o["إجمالي الأوردر"] !== undefined ? o["إجمالي الأوردر"] :
                 (o["total"] !== undefined ? o["total"] :
                 (o["totalCOD"] !== undefined ? o["totalCOD"] :
                 (o["total_cod"] !== undefined ? o["total_cod"] :
                 (o["cash_to_be_collected"] !== undefined ? o["cash_to_be_collected"] :
                 o["cash"])))))))))));
                 
  if (rawTotal !== undefined && rawTotal !== null && rawTotal !== "") {
    totalCOD = parseSafeNumber(rawTotal);
  }

  var prodPrice = 0;
  var rawProd = o["سعر المنتج"] !== undefined ? o["سعر المنتج"] :
                (o["المنتج"] !== undefined ? o["المنتج"] :
                (o["سعر المادة"] !== undefined ? o["سعر المادة"] :
                (o["price"] !== undefined ? o["price"] :
                (o["prodPrice"] !== undefined ? o["prodPrice"] :
                o["product_price"]))));
                
  if (rawProd !== undefined && rawProd !== null && rawProd !== "") {
    prodPrice = parseSafeNumber(rawProd);
  }

  var status = o.status || o["الحالة"] || "";
  var isPartial = ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status) || o.isPartial === true || o.isPartial === "true" || (o.returnSubStatus && o.returnSubStatus.indexOf("تسليم جزئي") !== -1);

  if (isPartial) {
    var partialAmt = Number(o.partialAmount !== undefined && o.partialAmount !== null ? o.partialAmount : (o.actualReceivedCash !== undefined && o.actualReceivedCash !== null ? o.actualReceivedCash : (totalCOD !== undefined && totalCOD !== null ? totalCOD : 0)));
    var originalProdPrice = o.originalProdPrice !== undefined && o.originalProdPrice !== null ? Number(o.originalProdPrice) : (o.prodPrice || prodPrice);
    if (originalProdPrice <= partialAmt && o.prodPrice > partialAmt) {
      originalProdPrice = Number(o.prodPrice);
    }
    return {
      prodPrice: isNaN(originalProdPrice) ? partialAmt : originalProdPrice,
      shipPrice: isNaN(shipPrice) ? 0 : shipPrice,
      totalCOD: isNaN(totalCOD) ? 0 : totalCOD
    };
  }

  if (totalCOD > 0) {
    prodPrice = totalCOD - shipPrice;
  } else if (prodPrice > 0 && shipPrice > 0 && totalCOD === 0) {
    totalCOD = prodPrice + shipPrice;
  }

  return {
    prodPrice: prodPrice,
    shipPrice: shipPrice,
    totalCOD: totalCOD
  };
}

interface LedgerProps {
  token: string;
  role: string;
  user: string;
  activeLedgerMode?: "supplier" | "courier";
  orders?: any[];
}

export default function Ledger({ token, role, user, activeLedgerMode, orders = [] }: LedgerProps) {
  const isSupplier = (role || "").toString().trim() === "مورد" || (role || "").toString().trim().includes("مورد");
  const isCourier = (role || "").toString().trim() === "مندوب" || (role || "").toString().trim().includes("مندوب");
  const isFinancial = (role || "").toString().trim() === "مدير" || (role || "").toString().trim() === "محاسب" || (role || "").toString().trim().includes("مدير") || (role || "").toString().trim().includes("محاسب");

  const [activeLedger, setActiveLedger] = useState<"supplier" | "courier">(
    activeLedgerMode || (isSupplier ? "supplier" : "courier")
  );

  useEffect(() => {
    if (activeLedgerMode) {
      setActiveLedger(activeLedgerMode);
    }
  }, [activeLedgerMode]);

  // --- Supplier Ledger States ---
  const [subscribes, setSubscribes] = useState<any[]>([]);
  const [liveBalance, setLiveBalance] = useState(0);
  const [supplierStats, setSupplierStats] = useState<any>(null);
  const [selectedSupplier, setSelectedSupplier] = useState(isSupplier ? user : "");
  const [allSuppliers, setAllSuppliers] = useState<any[]>([]);
  const [suppliersDetails, setSuppliersDetails] = useState<any[]>([]);
  const [payAmount, setPayAmount] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [supplierTransType, setSupplierTransType] = useState<"payout" | "withdrawal">("payout");
  const [submittingLedger, setSubmittingLedger] = useState(false);
  const [ledgerCache, setLedgerCache] = useState<Record<string, { subscribes: any[], liveBalance: number, stats: any, dailyLedger?: any }>>({});

  // --- New Daily Supplier Ledger States ---
  const [dailyLedgers, setDailyLedger] = useState<any>(null);
  const [daySearchQuery, setDaySearchQuery] = useState("");
  const [selectedDayOrdersDetail, setSelectedDayOrdersDetail] = useState<any[] | null>(null);
  const [selectedDayDate, setSelectedDayDate] = useState<string>("");
  const [selectedDayStatus, setSelectedDayStatus] = useState<string>("");
  const [settleDayProgress, setSettleDayProgress] = useState<string>("");
  const [modalSearchFilter, setModalSearchFilter] = useState<string>("");
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});
  const [expandedCourierDays, setExpandedCourierDays] = useState<Record<string, boolean>>({});

  const toggleDay = (dateStr: string) => {
    setExpandedDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  const toggleCourierDay = (dateStr: string) => {
    setExpandedCourierDays(prev => ({ ...prev, [dateStr]: !prev[dateStr] }));
  };

  // --- Courier Ledger States ---
  const [courierSummary, setCourierSummary] = useState<any>(null);
  const [courierTrs, setCourierTrs] = useState<any[]>([]);
  const [selectedCourier, setSelectedCourier] = useState(() => {
    if (isCourier) return user;
    const pre = localStorage.getItem("preselected_courier");
    if (pre) {
      localStorage.removeItem("preselected_courier");
      return pre;
    }
    return "";
  });
  const [allCouriers, setAllCouriers] = useState<any[]>([]);
  const [periodFilter, setPeriodFilter] = useState<"day" | "week" | "month">("month");
  const [adjustmentType, setAdjustmentType] = useState<"مكافأة" | "جزاء">("مكافأة");
  const [adjAmount, setAdjAmount] = useState("");
  const [adjDesc, setAdjDesc] = useState("");

  // --- Instant Settlement States ---
  const [closingAdjType, setClosingAdjType] = useState<"لا يوجد" | "مكافأة" | "جزاء">("لا يوجد");
  const [closingAdjAmount, setClosingAdjAmount] = useState("");
  const [closingAdjDesc, setClosingAdjDesc] = useState("");
  const [settling, setSettling] = useState(false);

  // --- Courier Handover States ---
  const [handoverAmount, setHandoverAmount] = useState("");
  const [handoverRef, setHandoverRef] = useState("");
  const [handoverDesc, setHandoverDesc] = useState("");

  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // --- Withdrawal requests states ---
  const [withdrawalRequests, setWithdrawalRequests] = useState<any[]>([]);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState("");
  const [withdrawalMethod, setWithdrawalMethod] = useState("");
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState("");
  const [actioningWithdrawalId, setActioningWithdrawalId] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState(false);

  async function fetchWithdrawalRequests() {
    setLoadingWithdrawals(true);
    try {
      const res = await apiCall("getWithdrawalRequests", token);
      if (res.ok) {
        setWithdrawalRequests(res.requests || []);
      }
    } catch (err) {
      console.error("Failed to fetch withdrawal requests", err);
    } finally {
      setLoadingWithdrawals(false);
    }
  }

  async function handleRequestWithdrawal(e: React.FormEvent) {
    e.preventDefault();
    setFeedback("");
    const amount = Number(withdrawalAmount);
    if (!withdrawalAmount || isNaN(amount) || amount <= 0) {
      setFeedback("يرجى إدخال مبلغ صحيح أكبر من الصفر.");
      return;
    }

    if (amount > liveBalance) {
      setFeedback(`عذراً، المبلغ المطلوب (${amount} ج.م) يتجاوز رصيدك المستحق الحالي (${liveBalance} ج.م).`);
      return;
    }

    if (!withdrawalMethod.trim()) {
      setFeedback("يرجى إدخال وسيلة الدفع ورقم التحويل (مثال: فودافون كاش - 010xxxxxxx).");
      return;
    }

    setSubmittingLedger(true);
    try {
      const res = await apiCall("requestWithdrawal", token, {
        supplier: isSupplier ? user : selectedSupplier,
        amount: amount,
        paymentMethod: withdrawalMethod
      });

      if (res.ok) {
        setFeedback("✅ تم تقديم طلب السحب بنجاح وهو قيد المراجعة حالياً.");
        setShowWithdrawalModal(false);
        setWithdrawalAmount("");
        setWithdrawalMethod("");
        // Reload
        await loadSupplierLedger();
        await fetchWithdrawalRequests();
      } else {
        setFeedback(`❌ فشل تقديم الطلب: ${res.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      setFeedback(`❌ حدث خطأ أثناء إرسال الطلب: ${err.message || err.toString()}`);
    } finally {
      setSubmittingLedger(false);
    }
  }

  async function handleApproveWithdrawal(id: string) {
    if (!window.confirm("هل أنت متأكد من الموافقة على طلب السحب وتحويل المبلغ؟ سيتم خصم القيمة من رصيد المورد وتسجيل قيد صرف في الخزانة.")) {
      return;
    }
    setFeedback("");
    setLoadingWithdrawals(true);
    try {
      const res = await apiCall("approveWithdrawal", token, {
        id: id,
        currentUser: user
      });
      if (res.ok) {
        setFeedback(`✅ ${res.msg || "تمت الموافقة وصرف الطلب بنجاح!"}`);
        await loadSupplierLedger();
        await fetchWithdrawalRequests();
      } else {
        setFeedback(`❌ فشل الموافقة على الطلب: ${res.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      setFeedback(`❌ حدث خطأ: ${err.message || err.toString()}`);
    } finally {
      setLoadingWithdrawals(false);
    }
  }

  async function handleRejectWithdrawal(id: string, reason: string) {
    if (!reason.trim()) {
      alert("يرجى كتابة سبب الرفض أولاً.");
      return;
    }
    setFeedback("");
    setLoadingWithdrawals(true);
    try {
      const res = await apiCall("rejectWithdrawal", token, {
        id: id,
        reason: reason,
        currentUser: user
      });
      if (res.ok) {
        setFeedback("✅ تم رفض طلب السحب وحفظ السبب بنجاح.");
        setIsRejecting(false);
        setWithdrawalReason("");
        setActioningWithdrawalId(null);
        await fetchWithdrawalRequests();
      } else {
        setFeedback(`❌ فشل رفض الطلب: ${res.error || "خطأ غير معروف"}`);
      }
    } catch (err: any) {
      setFeedback(`❌ حدث خطأ: ${err.message || err.toString()}`);
    } finally {
      setLoadingWithdrawals(false);
    }
  }

  // Populate drop-downs for Admin/Accountant
  async function fetchResourceLists() {
    try {
      const promises: Promise<any>[] = [apiCall("getSuppliers", token)];
      
      const financialCheck = isFinancial || role === "مشرف";
      if (financialCheck) {
        promises.push(apiCall("supplierAccounts", token));
        promises.push(apiCall("getCouriers", token));
      }

      const results = await Promise.all(promises);
      
      const resDetails = results[0];
      if (resDetails && resDetails.ok && resDetails.suppliers) {
        setSuppliersDetails(resDetails.suppliers);
      }

      if (financialCheck) {
        const resSuppliers = results[1];
        if (resSuppliers && resSuppliers.ok && resSuppliers.accounts && resSuppliers.accounts.length > 0) {
          setAllSuppliers(resSuppliers.accounts);
          if (!selectedSupplier) setSelectedSupplier(resSuppliers.accounts[0].name);
        }
        
        const resCouriers = results[2];
        if (resCouriers && resCouriers.ok && resCouriers.couriers && resCouriers.couriers.length > 0) {
          setAllCouriers(resCouriers.couriers);
          if (!selectedCourier) setSelectedCourier(resCouriers.couriers[0].name);
        }
      }
    } catch (err) {
      console.error("Failed to load resource lists in parallel", err);
    }
  }

  // --- Load Supplier accounts information ---
  async function loadSupplierLedger() {
    const targetSup = isSupplier ? user : selectedSupplier;
    if (!targetSup) return;

    setFeedback("");

    // Optimistically render from the client cache if available
    if (ledgerCache[targetSup]) {
      const cached = ledgerCache[targetSup];
      setSubscribes(cached.subscribes);
      setLiveBalance(cached.liveBalance);
      setSupplierStats(cached.stats);
      setDailyLedger(cached.dailyLedger || null);
      setLoading(false); // No full screen blocker
    } else {
      // Clear data to prevent old figures from sticking
      setSubscribes([]);
      setLiveBalance(0);
      setSupplierStats(null);
      setDailyLedger(null);
      setLoading(true);
    }

    try {
      const res = await apiCall("getSupplierLedger", token, {
        supplier: targetSup
      });
      if (res.ok) {
        const finalEntries = res.entries || [];
        const actualBalance = res.balance !== undefined ? res.balance : 0;
        const stats = res.stats || {
          totalOrdersCount: 0,
          totalGoodsUploaded: 0,
          deliveredOrdersCount: 0,
          deliveredOrdersValue: 0,
          returnsDeliveredCount: 0,
          returnsDeliveredValue: 0,
          paymentsValue: 0,
          reverseAdjustmentsValue: 0,
          outstanding: 0,
          rate: 0
        };

        // Update the client local cache
        setLedgerCache(prev => ({
          ...prev,
          [targetSup]: {
            subscribes: finalEntries,
            liveBalance: actualBalance,
            stats: stats,
            dailyLedger: res.dailyLedger || null
          }
        }));

        setSubscribes(finalEntries);
        setLiveBalance(actualBalance);
        setSupplierStats(stats);
        setDailyLedger(res.dailyLedger || null);
      } else {
        setFeedback(res.error || "خطأ أثناء تحميل كشف حساب المورد");
      }
    } catch (err) {
      setFeedback("حدث خطأ في الشبكة أثناء الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  }

  async function handleSettleDay(dateStr: string) {
    const targetSup = isSupplier ? user : selectedSupplier;
    if (!targetSup) return;
    if (!confirm(`هل أنت متأكد من تصفية وإقفال كاش تاريخ ${dateStr} للمورد (${targetSup}) وتسليمه كامل مستحقات هذا اليوم الحالية وتسجيل قفل المعاملة؟`)) {
      return;
    }
    setSettleDayProgress(dateStr);
    try {
      const res = await apiCall("settleSupplierDay", token, {
        supplier: targetSup,
        dateStr: dateStr
      });
      if (res.ok) {
        // Reload ledger
        await loadSupplierLedger();
      } else {
        alert(res.error || "فشل تصفية اليوم");
      }
    } catch (err) {
      alert("خطأ في الاتصال بالخادم أثناء التصفية");
    } finally {
      setSettleDayProgress("");
    }
  }

  // --- Load Courier salary summaries ---
  async function loadCourierLedger() {
    if (!selectedCourier && !isCourier) return;
    setLoading(true);
    setFeedback("");
    try {
      const res = await apiCall("getCourierLedger", token, {
        courier: isCourier ? user : selectedCourier,
        period: periodFilter
      });
      if (res.ok) {
        setCourierSummary(res.ledgerInfo);
        setCourierTrs(res.transactions || []);
      } else {
        setFeedback(res.error || "خطأ أثناء تحميل كشف حساب المندوب المالية");
      }
    } catch (err) {
      setFeedback("فشل الاتصال بالمسار المالي للمناديب");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchResourceLists();
  }, [token]);

  // Sync selectedSupplier with the user prop when it updates (especially on slow async logins)
  useEffect(() => {
    if (isSupplier && user) {
      setSelectedSupplier(user);
    }
  }, [isSupplier, user]);

  useEffect(() => {
    if (activeLedger === "supplier") {
      loadSupplierLedger();
      fetchWithdrawalRequests();
    } else {
      loadCourierLedger();
    }
  }, [activeLedger, selectedSupplier, selectedCourier, periodFilter, user]);

  // Submit payment to supplier (Deducted from Ledger & Cashbox)
  async function handleSupplierPayout(e: React.FormEvent) {
    e.preventDefault();
    if (!payAmount || Number(payAmount) <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }
    setSubmittingLedger(true);
    try {
      const isWithdrawal = supplierTransType === "withdrawal";
      const res = await apiCall("addSupplierPayment", token, {
        supplier: selectedSupplier,
        amount: Number(payAmount),
        desc: payDesc.trim() || (isWithdrawal ? `سحب مالي / تسوية عكسية من المورد: ${selectedSupplier}` : `صرف دفعة للمورد: ${selectedSupplier}`),
        transactionType: supplierTransType
      });
      if (res.ok) {
        setPayAmount("");
        setPayDesc("");
        setSupplierTransType("payout");
        loadSupplierLedger();
        alert(isWithdrawal ? "✅ تم تسجيل السحب وتسويته بالخزنة بنجاح" : "✅ تم تسجيل السداد المالي وصرفه من الخزينة بنجاح");
      } else {
        alert("⚠️ " + res.error);
      }
    } catch (err) {
      alert("عطل في تسجيل العملية المالية");
    } finally {
      setSubmittingLedger(false);
    }
  }

  // Submit Adjustment to Courier Salary Ledger (Bonuses / Penalties)
  async function handleCourierAdjustment(e: React.FormEvent) {
    e.preventDefault();
    if (!adjAmount || Number(adjAmount) <= 0) {
      alert("يرجى إرساء قيمة تعديل صحيحة");
      return;
    }
    
    const val = Number(adjAmount);
    const type = adjustmentType;
    const desc = adjDesc.trim() || `${adjustmentType} للمندوب ${selectedCourier}`;
    const courier = selectedCourier;

    // 1. Reset inputs immediately for responsive Fire & Forget
    setAdjAmount("");
    setAdjDesc("");

    // 2. Optimistically update local UI states immediately (0.1 seconds response)
    if (courierSummary) {
      const isBonus = type === "مكافأة";
      const nextBonusesSum = courierSummary.bonusesSum + (isBonus ? val : 0);
      const nextPenaltiesSum = courierSummary.penaltiesSum + (!isBonus ? val : 0);
      const nextNetSalary = courierSummary.netSalary + (isBonus ? val : -val);
      const nextTodayBonuses = (courierSummary.todayBonuses || 0) + (isBonus ? val : 0);
      const nextTodayPenalties = (courierSummary.todayPenalties || 0) + (!isBonus ? val : 0);
      const nextRequiredHandoverToday = (courierSummary.requiredHandoverToday || 0) + (isBonus ? val : -val);

      setCourierSummary({
        ...courierSummary,
        bonusesSum: nextBonusesSum,
        penaltiesSum: nextPenaltiesSum,
        netSalary: nextNetSalary,
        todayBonuses: nextTodayBonuses,
        todayPenalties: nextTodayPenalties,
        requiredHandoverToday: nextRequiredHandoverToday
      });
    }

    // Append a mock transaction record to the logs so the director/accountant sees it immediately
    const mockTx = {
      courier,
      date: new Date().toISOString(),
      type,
      tracking: "ADJUST",
      amount: val,
      desc
    };
    setCourierTrs(prev => [mockTx, ...prev]);

    // Show success alert immediately without any waiting
    alert(`✅ تم حفظ تسوية الـ ${type} بنجاح وبدء يوم جديد (مزامنة خلفية جاهزة)`);

    // 3. Dispatch bg-sync events and invoke background API Call
    window.dispatchEvent(new CustomEvent("bg-sync-start"));

    apiCall("addCourierAdjustment", token, {
      courier,
      type,
      amount: val,
      desc
    })
      .then((res) => {
        if (res && res.ok) {
          console.log("Asynchronous courier adjustment saved successfully");
          // Silently reload the actual server ledger values
          loadCourierLedger();
        } else {
          console.error("Asynchronous courier adjustment sync error:", res?.error);
        }
      })
      .catch((err) => {
        console.error("Asynchronous courier adjustment call failed:", err);
      })
      .finally(() => {
        window.dispatchEvent(new CustomEvent("bg-sync-end"));
      });
  }

  // New instant wallet settlement function
  async function handleInstantWalletSettlement(targetCourier: string, totalCashWallet: number, todayEarnedCommissions: number) {
    if (!targetCourier) return;
    if (!confirm(`هل أنت متأكد من اعتماد تصفية الحساب وإغلاق العهدة لـ (${targetCourier})؟ \n\nسيتم ترحيل مبلغ (${totalCashWallet.toLocaleString("ar")} ج.م) كإيداع بالخزينة الرئيسية، وإثبات عمولة مستحقة لليوم بقيمة (${todayEarnedCommissions.toLocaleString("ar")} ج.م).`)) {
      return;
    }

    setSettling(true);
    setFeedback("");
    try {
      const res = await apiCall("instantCourierSettlement", token, {
        courier: targetCourier,
        cashAmount: totalCashWallet,
        commissionAmount: todayEarnedCommissions,
        adjustmentType: closingAdjType === "لا يوجد" ? "" : closingAdjType,
        adjustmentAmount: closingAdjType === "لا يوجد" ? 0 : Number(closingAdjAmount || 0),
        adjustmentDesc: closingAdjDesc,
        currentUser: user
      });

      if (res && res.ok) {
        alert(res.msg || "تم اعتماد تصفية الحساب وإغلاق العهدة اليومية للمندوب بنجاح!");
        setClosingAdjType("لا يوجد");
        setClosingAdjAmount("");
        setClosingAdjDesc("");
        window.location.reload();
      } else {
        alert(`⚠️ خطأ أثناء التصفية: ${res?.error || "فشل الاتصال بالخادم"}`);
      }
    } catch (err: any) {
      alert(`⚠️ فشل التصفية: ${err?.toString() || "خطأ غير متوقع"}`);
    } finally {
      setSettling(false);
    }
  }

  // Settle and pull all courier active orders to warehouse
  async function handleSettleCourierOrders() {
    if (!selectedCourier) return;
    if (!confirm(`هل أنت متأكد من سحب جميع الشحنات وجرد المرتجعات الميدانية لـ (${selectedCourier})؟ \n\nسيتم سحب كافة الأوردرات المعلقة وتبرئة عهدة المندوب فوراً من الشاشة.`)) {
      return;
    }

    setSubmittingLedger(true);
    window.dispatchEvent(new CustomEvent("bg-sync-start"));

    apiCall("settleCourierOrders", token, {
      courier: selectedCourier
    })
      .then((res) => {
        if (res && res.ok) {
          alert(`✅ ${res.msg || "تم سحب وتصفية عهدة المندوب بالمستودع وتبرئته بنجاح!"}`);
          loadCourierLedger();
        } else {
          alert(`⚠️ عطل: ${res?.error || "فشل تصفية العهدة والفرز"}`);
        }
      })
      .catch((err) => {
        console.error("Settle courier orders error:", err);
        alert("⚠️ عطل عابر في تصفية عهدة المندوب");
      })
      .finally(() => {
        setSubmittingLedger(false);
        window.dispatchEvent(new CustomEvent("bg-sync-end"));
      });
  }

  // Monthly closing: freeze/settle orders, zero custody, and keep counters intact
  async function handleCloseCourierMonth() {
    if (!selectedCourier) return;
    if (!confirm(`⚠️ تحذير تقفيل شهري هام: هل أنت متأكد من تقفيل كشف حساب المندوب (${selectedCourier}) لشهر جديد؟\n\n- سيتم تجميد وترحيل كافة مبالغ الشحن والتحصيل وتصفير العهدة النقدية الحالية لتبدأ من 0 ج.م.\n- سيتم أرشفة الأوردرات كـ Settled تماماً.\n- لن تتأثر العدادات التاريخية لإنتاجية المندوب.`)) {
      return;
    }

    setSubmittingLedger(true);
    window.dispatchEvent(new CustomEvent("bg-sync-start"));

    apiCall("closeCourierMonth", token, {
      courier: selectedCourier
    })
      .then((res) => {
        if (res && res.ok) {
          alert(`✅ ${res.msg || "تم تقفيل وتصفير كشف الحساب الشهري للمندوب وبدء دورة جديدة بنجاح!"}`);
          loadCourierLedger();
        } else {
          alert(`⚠️ عطل: ${res?.error || "فشل تقفيل كشف الحساب"}`);
        }
      })
      .catch((err) => {
        console.error("Close courier month error:", err);
        alert("⚠️ عطل عابر في تقفيل الحساب");
      })
      .finally(() => {
        setSubmittingLedger(false);
        window.dispatchEvent(new CustomEvent("bg-sync-end"));
      });
  }

  // Submit Physical COD Handover from Courier directly to Centralized Cashbox
  async function handleCourierHandover(e: React.FormEvent) {
    e.preventDefault();
    if (!handoverAmount || Number(handoverAmount) <= 0) {
      alert("يرجى إدخال مبلغ صحيح للاستلام");
      return;
    }

    const val = Number(handoverAmount);
    const ref = handoverRef;
    const desc = handoverDesc.trim() || `استلام دفعة عهدة نقدية من المندوب: ${selectedCourier} بموجب وصل: ${handoverRef || "—"}`;
    const courier = selectedCourier;

    // 1. Reset inputs immediately for responsive Fire & Forget
    setHandoverAmount("");
    setHandoverRef("");
    setHandoverDesc("");

    // 2. Optimistically update local UI states immediately (0.1 seconds response)
    if (courierSummary) {
      const nextPaid = (courierSummary.totalPaidToCompany || 0) + val;
      const nextDeficit = (courierSummary.totalCollected || 0) - nextPaid;

      setCourierSummary({
        ...courierSummary,
        totalPaidToCompany: nextPaid,
        deficit: nextDeficit
      });
    }

    // Show success alert immediately
    alert(`✅ تم استلام دفعة عهدة المندوب بنجاح وتصفية العجز وجاري ترحيل التعديلات للخلفية...`);

    // 3. Dispatch bg-sync events and invoke background API Call
    window.dispatchEvent(new CustomEvent("bg-sync-start"));

    apiCall("addCashbox", token, {
      type: "استلام عهدة مندوب",
      ref: courier,
      amount: val,
      desc
    })
      .then((res) => {
        if (res && res.ok) {
          console.log("Asynchronous cashbox handover synchronization complete");
          loadCourierLedger();
        } else {
          console.error("Asynchronous cashbox handover saved, error during refresh:", res?.error);
        }
      })
      .catch((err) => {
        console.error("Asynchronous cashbox handover background call failed:", err);
      })
      .finally(() => {
        window.dispatchEvent(new CustomEvent("bg-sync-end"));
      });
  }

  return (
    <div className="p-4 space-y-6 select-none font-sans text-right">
      {/* Ledger Mode Filter (Hidden if activeLedgerMode is provided to ensure absolute view isolation) */}
      {isFinancial && !activeLedgerMode && (
        <div className="flex bg-slate-950 border border-white/6 rounded-xl p-1 max-w-[400px] mx-auto">
          <button
            onClick={() => setActiveLedger("courier")}
            className={`flex-1 text-center py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeLedger === "courier"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            🛵 كشف حساب المناديب
          </button>
          <button
            onClick={() => setActiveLedger("supplier")}
            className={`flex-1 text-center py-2.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
              activeLedger === "supplier"
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            📦 كشف حساب الموردين
          </button>
        </div>
      )}

      {/* --- SUPPLIER LEDGER WORKSPACE --- */}
      {activeLedger === "supplier" && (
        <div className="space-y-6">
          {/* Target Selector details for Financial staffs */}
          {isFinancial && (
            <div className="flex items-center justify-between gap-4 bg-slate-900 border border-white/6 p-4 rounded-xl shadow-inner">
              <span className="text-xs font-extrabold text-slate-400 whitespace-nowrap">اختر المورد المراد عرض حسابه بالأيام:</span>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none"
              >
                {allSuppliers.map((s, idx) => (
                  <option key={idx} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Active Supplier Header Card / KPI Banners */}
          <div className="bg-gradient-to-l from-slate-900 via-slate-950 to-slate-900 border-2 border-emerald-500/20 rounded-2xl p-6 text-center space-y-4 relative overflow-hidden shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl"></div>
            <div className="absolute top-3 left-3 text-emerald-500/10">
              <Wallet size={64} />
            </div>

            <span className="px-3.5 py-1.5 bg-emerald-950/40 border border-emerald-900/40 text-emerald-400 text-[10.5px] font-black rounded-full uppercase tracking-wider inline-flex items-center gap-1.5">
              <span>🏆 كشف الحساب التراكمي وتصفية كاش المورد</span>
              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping"></span>
            </span>

            <div className="text-4xl font-mono font-black text-emerald-400 tracking-tight">
              {Number(liveBalance || 0).toLocaleString("ar")}{" "}
              <span className="text-sm font-medium">جنيهاً مصرياً</span>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed font-bold max-w-2xl mx-auto">
              هذه القيمة تمثل مجموع مستحقات <span className="text-emerald-400">جميع الأيام المعلقة</span> (صافي مستحقات الأيام التي لم تصفى بعد)، وهي تتأثر تلقائياً بمجرد نقر المدير على زر التصفية اليومية.
            </p>

            {/* Quick Metrics */}
            {dailyLedgers && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-3 max-w-5xl mx-auto pt-2">
                <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center shadow-md">
                  <div className="text-[10px] font-black text-slate-400">إجمالي البضاعة المرفوعة</div>
                  <div className="text-sm font-mono font-bold text-slate-200 mt-1">
                    {Number(dailyLedgers.totalGoodsUploaded || 0).toLocaleString("ar")} ج.م
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center shadow-md">
                  <div className="text-[10px] font-black text-slate-405">إجمالي الدفعات المسددة</div>
                  <div className="text-sm font-mono font-bold text-indigo-400 mt-1">
                    {Number(dailyLedgers.globalPayments || 0).toLocaleString("ar")} ج.m
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center shadow-md">
                  <div className="text-[10px] font-black text-slate-400">إجمالي المرتجعات المستلمة</div>
                  <div className="text-sm font-mono font-bold text-red-400 mt-1">
                    {Number(dailyLedgers.returnsDeliveredValue || 0).toLocaleString("ar")} ج.م
                  </div>
                </div>
                <div className="bg-slate-950/85 border border-emerald-500/20 p-3 rounded-xl text-center shadow-md">
                  <div className="text-[10px] font-black text-emerald-400">إجمالي الصافي المستحق للمورد</div>
                  <div className="text-sm font-mono font-bold text-emerald-300 mt-1">
                    {Number(dailyLedgers.outstandingBalance || 0).toLocaleString("ar")} ج.م
                  </div>
                </div>
                <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center col-span-2 md:col-span-1 shadow-md">
                  <div className="text-[10px] font-black text-slate-400">حالة الأيام</div>
                  <div className="text-[10px] font-bold text-slate-300 mt-1 flex justify-around border-t border-white/5 pt-1">
                    <span className="text-red-350 font-bold">🔴 {dailyLedgers.days.filter((d: any) => !d.isSettled).length} معلق</span>
                    <span className="text-emerald-400 font-bold">🟢 {dailyLedgers.days.filter((d: any) => d.isSettled).length} مصفى</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Withdrawal Requests Section */}
          {(isSupplier || isFinancial) && (
            <div className="bg-slate-900 border border-white/6 rounded-2xl p-4 space-y-4 shadow-sm text-right">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="p-1 px-2 bg-pink-500/10 text-pink-400 rounded-md text-[10.5px]">💸</span>
                  <div>
                    <h3 className="text-xs font-black text-slate-200">بوابة طلبات سحب الرصيد للموردين</h3>
                    <p className="text-[9px] text-slate-400 mt-0.5">طلب سحب فوري أو متابعة حالة الدفعات المحولة</p>
                  </div>
                </div>
                {isSupplier && (
                  <button
                    onClick={() => setShowWithdrawalModal(true)}
                    className="px-4 py-2 bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-slate-950 font-black text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
                  >
                    <span>➕ طلب سحب جديد</span>
                  </button>
                )}
              </div>

              {/* List of Withdrawal Requests */}
              <div className="space-y-2">
                {loadingWithdrawals ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-slate-400 text-xs">
                    <Loader2 size={16} className="animate-spin text-amber-500" />
                    جاري تحميل طلبات السحب...
                  </div>
                ) : (
                  (() => {
                    // Filter requests
                    const filteredRequests = withdrawalRequests.filter(req => {
                      if (isSupplier) {
                        return req.supplier && req.supplier.toString().trim().toLowerCase() === user.trim().toLowerCase();
                      }
                      // For admin, we can show for current selected supplier or all
                      if (selectedSupplier) {
                        return req.supplier && req.supplier.toString().trim().toLowerCase() === selectedSupplier.trim().toLowerCase();
                      }
                      return true;
                    });

                    if (filteredRequests.length === 0) {
                      return (
                        <p className="text-[10px] text-slate-500 text-center py-4 font-bold">
                          لا توجد طلبات سحب مسجلة حالياً.
                        </p>
                      );
                    }

                    return (
                      <div className="overflow-x-auto">
                        <table className="w-full text-right border-collapse text-xs">
                          <thead>
                            <tr className="border-b border-white/5 text-[10px] text-slate-400 font-bold bg-slate-950/30">
                              <th className="p-2">رقم الطلب</th>
                              <th className="p-2">التاريخ</th>
                              {!isSupplier && <th className="p-2">المورد</th>}
                              <th className="p-2">المبلغ المطلوب</th>
                              <th className="p-2">وسيلة ورقم الدفع</th>
                              <th className="p-2 text-center">الحالة</th>
                              <th className="p-2">ملاحظات التحويل / الرفض</th>
                              {isFinancial && <th className="p-2 text-center">الإجراءات</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {filteredRequests.map((req, index) => {
                              const amt = Number(req.amount || 0);
                              return (
                                <tr key={req.id || index} className="border-b border-white/5 hover:bg-white/1">
                                  <td className="p-2 font-mono text-[10.5px] text-slate-400 font-bold">#{req.id}</td>
                                  <td className="p-2 text-slate-350">{req.date ? req.date.split("T")[0] : "—"}</td>
                                  {!isSupplier && <td className="p-2 font-black text-amber-400">{req.supplier}</td>}
                                  <td className="p-2 font-mono font-black text-emerald-400">
                                    {amt.toLocaleString("ar")} ج.م
                                  </td>
                                  <td className="p-2 font-medium text-slate-300">{req.paymentMethod || "—"}</td>
                                  <td className="p-2 text-center">
                                    {req.status === "معلق" ? (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-yellow-500/10 text-yellow-500 border border-yellow-500/25 animate-pulse">
                                        ⏳ معلق
                                      </span>
                                    ) : req.status === "مقبول" ? (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/10 text-emerald-450 border border-emerald-500/25">
                                        ✅ مقبول
                                      </span>
                                    ) : (
                                      <span className="inline-block px-2 py-0.5 rounded-full text-[9px] font-black bg-red-500/10 text-red-400 border border-red-500/25">
                                        ❌ مرفوض
                                      </span>
                                    )}
                                  </td>
                                  <td className="p-2 text-slate-405 text-[10.5px] max-w-[200px] truncate" title={req.notes}>
                                    {req.notes || "—"}
                                  </td>
                                  {isFinancial && (
                                    <td className="p-2 text-center">
                                      {req.status === "معلق" ? (
                                        <div className="flex items-center justify-center gap-1.5">
                                          <button
                                            onClick={() => handleApproveWithdrawal(req.id)}
                                            className="px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer transition-all active:scale-95"
                                            title="الموافقة والتحويل وصرف القيمة"
                                          >
                                            ✔ موافقة
                                          </button>
                                          <button
                                            onClick={() => {
                                              setActioningWithdrawalId(req.id);
                                              setIsRejecting(true);
                                              setWithdrawalReason("");
                                            }}
                                            className="px-2 py-1 bg-red-500 hover:bg-red-600 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer transition-all active:scale-95"
                                            title="رفض الطلب مع توضيح السبب"
                                          >
                                            ❌ رفض
                                          </button>
                                        </div>
                                      ) : (
                                        <span className="text-[10px] text-slate-500">—</span>
                                      )}
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    );
                  })()
                )}
              </div>
            </div>
          )}

          {/* Modal for Requesting Withdrawal */}
          {showWithdrawalModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 font-sans text-right">
              <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl relative">
                <button
                  type="button"
                  onClick={() => setShowWithdrawalModal(false)}
                  className="absolute top-4 left-4 text-slate-400 hover:text-white text-xs bg-slate-950/40 hover:bg-slate-950 px-2.5 py-1 rounded-lg border border-white/5 cursor-pointer font-sans"
                >
                  ✕ إغلاق
                </button>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-200">إنشاء طلب سحب رصيد جديد</h3>
                  <p className="text-[10px] text-slate-400">سيتم مراجعة الطلب وتحويل المبلغ المطلوب من قبل الإدارة المالية</p>
                </div>

                <form onSubmit={handleRequestWithdrawal} className="space-y-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-350">الرصيد المستحق الحالي:</label>
                    <div className="p-3 bg-slate-950 rounded-xl font-mono text-sm font-bold text-emerald-400">
                      {Number(liveBalance || 0).toLocaleString("ar")} ج.م
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-350">المبلغ المطلوب سحبه (ج.م):</label>
                    <input
                      type="number"
                      required
                      min="1"
                      max={liveBalance}
                      value={withdrawalAmount}
                      onChange={(e) => setWithdrawalAmount(e.target.value)}
                      placeholder="أدخل قيمة المبلغ..."
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-200 placeholder-slate-650 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-[10.5px] font-bold text-slate-350">وسيلة ورقم الدفع (InstaPay / فودافون كاش):</label>
                    <input
                      type="text"
                      required
                      value={withdrawalMethod}
                      onChange={(e) => setWithdrawalMethod(e.target.value)}
                      placeholder="مثال: InstaPay: user@instapay أو محفظة 010xxxxxxx"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-bold text-slate-200 placeholder-slate-650 focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingLedger}
                    className="w-full py-3 bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-lg hover:shadow-emerald-500/10 flex items-center justify-center gap-2"
                  >
                    {submittingLedger ? (
                      <>
                        <Loader2 size={14} className="animate-spin text-slate-950" />
                        جاري إرسال الطلب...
                      </>
                    ) : (
                      "🚀 تقديم طلب السحب"
                    )}
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Modal for Rejection Reason */}
          {isRejecting && actioningWithdrawalId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm p-4 font-sans text-right">
              <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-6 space-y-4 shadow-2xl relative">
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-red-400">تأكيد رفض طلب السحب #{actioningWithdrawalId}</h3>
                  <p className="text-[10px] text-slate-400">يرجى كتابة سبب الرفض ليتمكن المورد من معرفة التفاصيل</p>
                </div>

                <div className="space-y-3 pt-2">
                  <textarea
                    required
                    value={withdrawalReason}
                    onChange={(e) => setWithdrawalReason(e.target.value)}
                    placeholder="اكتب سبب الرفض هنا بالتفصيل..."
                    className="w-full min-h-[100px] bg-slate-950 border border-white/10 rounded-xl p-3 text-xs font-bold text-slate-200 placeholder-slate-650 focus:outline-none focus:border-red-500"
                  />

                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleRejectWithdrawal(actioningWithdrawalId, withdrawalReason)}
                      className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black text-xs rounded-xl cursor-pointer font-sans"
                    >
                      تأكيد الرفض ✖
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejecting(false);
                        setWithdrawalReason("");
                        setActioningWithdrawalId(null);
                      }}
                      className="flex-1 py-3 bg-slate-950 hover:bg-slate-900 text-slate-400 font-bold text-xs rounded-xl cursor-pointer border border-white/5 font-sans"
                    >
                      تراجع وإلغاء
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Days Explorer Block */}
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-white/6 p-4 rounded-2xl shadow-sm">
              <div className="flex items-center gap-2">
                <Calendar className="text-amber-500" size={18} />
                <h3 className="text-xs font-black text-slate-300">سجل كشوف الحساب اليومية التفصيلية للأيام والدفعات</h3>
              </div>
              <div className="relative w-full sm:w-[280px]">
                <span className="absolute inset-y-0 right-3 flex items-center pr-1 text-slate-550">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="ابحث بالتاريخ (مثال: 2026-06)..."
                  value={daySearchQuery}
                  onChange={(e) => setDaySearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-white/8 rounded-lg pr-9 pl-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="text-center py-16 space-y-3">
                <Loader2 size={36} className="text-amber-500 animate-spin mx-auto" />
                <div className="text-xs text-slate-400 animate-pulse font-bold">جاري حساب وتجميع كشف الأيام للمورد ديناميكياً...</div>
              </div>
            ) : !dailyLedgers || (dailyLedgers.days.length === 0 && (!dailyLedgers.paymentEntries || dailyLedgers.paymentEntries.length === 0)) ? (
              <div className="bg-slate-900/50 border border-white/4 rounded-2xl py-12 text-center text-xs text-slate-405 font-bold">
                🫙 لا يوجد أوردرات أو معاملات مسجلة كحساب يومي تحت اسم هذا المورد حالياً
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(() => {
                  const daysFiltered = dailyLedgers.days.map((d: any) => ({ ...d, timelineType: "day" }));
                  const paymentsFiltered = (dailyLedgers.paymentEntries || []).map((p: any) => ({ ...p, timelineType: "payment" }));
                  
                  const mergedTimeline = [...daysFiltered, ...paymentsFiltered];
                  
                  // Sort by date (descending)
                  mergedTimeline.sort((a, b) => {
                    const dateA = a.date ? a.date.split("T")[0] : "";
                    const dateB = b.date ? b.date.split("T")[0] : "";
                    return dateB.localeCompare(dateA);
                  });

                  const finalFiltered = mergedTimeline.filter((item: any) => {
                    if (!daySearchQuery) return true;
                    return item.date && item.date.includes(daySearchQuery);
                  });

                  if (finalFiltered.length === 0) {
                    return (
                      <div className="col-span-2 bg-slate-900/50 border border-white/4 rounded-2xl py-12 text-center text-xs text-slate-405 font-bold">
                        🔍 لا توجد أوردرات أو حركات سداد مطابقة للبحث حالياً
                      </div>
                    );
                  }

                  return finalFiltered.map((item: any, idx: number) => {
                    if (item.timelineType === "payment") {
                      const typeStr = (item.type || "").toString().trim();
                      const descStr = (item.desc || "").toString().trim();
                      
                      const isInflow = typeStr.includes("استلام") || typeStr.includes("مسترد") || descStr.includes("استلام") || descStr.includes("مسترد") || typeStr.includes("وارد") || descStr.includes("وارد");
                      const isAddition = typeStr.includes("تسوية إضافة") || typeStr.includes("إضافة") || typeStr.includes("اضافة") || typeStr.includes("تعديل رصيد إضافة");
                      const isDeduction = typeStr.includes("تسوية خصم") || typeStr.includes("خصم") || typeStr.includes("طرح") || typeStr.includes("سحب") || typeStr.includes("مسحوبات");
                      
                      let cardBg = "from-slate-900 to-indigo-950/20 border-indigo-500/10 hover:border-indigo-500/25";
                      let glowBg = "bg-indigo-500/5";
                      let textCol = "text-indigo-300";
                      let amountCol = "text-indigo-350";
                      let iconCol = "text-indigo-400";
                      let badgeBg = "bg-indigo-950/50 border-indigo-900/50 text-indigo-300";
                      let badgeText = "💳 دفعة نقدية مسددة";
                      let labelText = "القيمة المالية المصروفة للمورد";
                      let sign = "-";
                      
                      if (isInflow) {
                        cardBg = "from-slate-900 to-emerald-950/20 border-emerald-500/10 hover:border-emerald-500/25";
                        glowBg = "bg-emerald-500/5";
                        textCol = "text-emerald-300";
                        amountCol = "text-emerald-400 font-bold";
                        iconCol = "text-emerald-400";
                        badgeBg = "bg-emerald-950/50 border-emerald-900/50 text-emerald-300";
                        badgeText = "📥 استلام نقدية (إيراد)";
                        labelText = "القيمة المالية المستلمة من المورد";
                        sign = "-";
                      } else if (isAddition) {
                        cardBg = "from-slate-900 to-teal-950/20 border-teal-500/10 hover:border-teal-500/25";
                        glowBg = "bg-teal-500/5";
                        textCol = "text-teal-300";
                        amountCol = "text-teal-400";
                        iconCol = "text-teal-400";
                        badgeBg = "bg-teal-950/50 border-teal-900/50 text-teal-300";
                        badgeText = "➕ تسوية (إضافة رصيد)";
                        labelText = "قيمة التسوية الإيجابية للمورد";
                        sign = "+";
                      } else if (isDeduction) {
                        cardBg = "from-slate-900 to-rose-950/20 border-rose-500/10 hover:border-rose-500/25";
                        glowBg = "bg-rose-500/5";
                        textCol = "text-rose-300";
                        amountCol = "text-rose-450";
                        iconCol = "text-rose-400";
                        badgeBg = "bg-rose-950/50 border-rose-900/50 text-rose-300";
                        badgeText = "➖ تسوية (خصم رصيد)";
                        labelText = "قيمة التسوية السلبية للمورد";
                        sign = "-";
                      }

                      return (
                        <div
                          key={`p-${idx}`}
                          className={`bg-gradient-to-br ${cardBg} rounded-2xl p-5 space-y-4 shadow-md transition-all hover:translate-y-[-2px] relative overflow-hidden text-right`}
                        >
                          <div className={`absolute top-0 right-0 w-24 h-24 ${glowBg} rounded-full blur-2xl`}></div>
                          <div className="flex items-center justify-between border-b border-white/6 pb-2.5">
                            <span className={`text-xs font-black ${textCol} flex items-center gap-1.5`}>
                              <Wallet size={14} className={iconCol} />
                              <span>يوم: {item.date}</span>
                            </span>
                            <span className={`px-3 py-1 text-[10px] font-black rounded-lg border ${badgeBg} flex items-center gap-1`}>
                              <span>{badgeText}</span>
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="bg-slate-950/80 border border-white/5 p-3 rounded-xl flex justify-between items-center">
                              <span className="text-[10px] text-slate-400 font-bold block">{labelText}</span>
                              <span className={`text-sm font-mono font-black ${amountCol}`}>
                                {sign}{Number(item.amount || 0).toLocaleString("ar")} ج.م
                              </span>
                            </div>
                            <div className="bg-slate-950/60 border border-white/4 p-2.5 rounded-xl">
                              <span className="text-[9.5px] text-slate-400 block font-bold">البيان / تفاصيل المعاملة</span>
                              <span className="text-xs text-slate-300 font-medium block mt-1 leading-relaxed">
                                {item.desc || "حركة مالية وتصفية حساب"}
                              </span>
                            </div>
                            {item.tracking && (
                              <div className="text-[10px] text-slate-500 font-mono text-left pt-1">
                                الرقم المرجعي: {item.tracking}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }

                    const isPending = !item.isSettled;
                    const dateStr = item.date || "";
                    const isOpen = !!expandedDays[dateStr];

                    return (
                      <div
                        key={`d-${idx}`}
                        className={`bg-slate-900 border rounded-2xl shadow-md transition-all text-right overflow-hidden ${
                          isPending ? "border-amber-500/15 hover:border-amber-500/25" : "border-emerald-500/15 hover:border-emerald-500/25"
                        }`}
                      >
                        {/* Outward Collapsed Card Header */}
                        <div
                          onClick={() => toggleDay(dateStr)}
                          className="p-4 flex items-center justify-between cursor-pointer select-none bg-slate-950/40 hover:bg-slate-950/80 transition-all gap-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-right">
                            <span className="text-xs font-black text-slate-100 flex items-center gap-1.5">
                              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
                              <span>يوم: {dateStr}</span>
                            </span>
                            <span className="text-[11px] text-slate-400 font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-white/4">
                              المورد: {selectedSupplier || "غير محدد"}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[9px] text-slate-450 block font-bold leading-none">الصافي المالي:</span>
                              <span className="text-xs font-mono font-black text-emerald-400 mt-0.5 block">
                                {Number(item.netDues || 0).toLocaleString("ar")} ج.م
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <span
                                className={`px-2.5 py-0.5 text-[9px] font-black rounded ${
                                  isPending
                                    ? "bg-amber-950/40 border border-amber-900/40 text-amber-500"
                                    : "bg-emerald-950/40 border border-emerald-900/40 text-emerald-500"
                                }`}
                              >
                                {isPending ? "🔴 معلق" : "🟢 مصفى"}
                              </span>
                              {isOpen ? (
                                <ChevronUp size={16} className="text-slate-400" />
                              ) : (
                                <ChevronDown size={16} className="text-slate-400" />
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Expandable Panel */}
                        <div
                          className={`transition-all duration-300 ease-in-out ${
                            isOpen ? "max-h-[1200px] border-t border-white/6 p-5 opacity-100" : "max-h-0 overflow-hidden opacity-0 pointer-events-none"
                          }`}
                        >
                          <div className="space-y-4">
                            {/* Day Financial Grid Stats */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center">
                                <span className="text-[10px] text-slate-400 block font-black mb-1">【حساب البضاعة المرفوعة اليومية】</span>
                                <span className="text-sm font-mono font-black text-slate-200">
                                  {Number(item.totalWorkValue || 0).toLocaleString("ar")} ج.م
                                </span>
                              </div>
                              <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center">
                                <span className="text-[10px] text-slate-400 block font-black mb-1">【حساب النقدي (المدفوع كاش اليوم)】</span>
                                <span className="text-sm font-mono font-black text-indigo-450">
                                  {Number(item.cashPaid || 0).toLocaleString("ar")} ج.م
                                </span>
                              </div>
                              <div className="bg-slate-950/80 border border-white/4 p-3 rounded-xl text-center">
                                <span className="text-[10px] text-slate-400 block font-black mb-1">【حساب المرتجعات المستلمة اليوم】</span>
                                <span className="text-sm font-mono font-black text-red-400">
                                  {Number(item.returnedValueRefunded || 0).toLocaleString("ar")} ج.م
                                </span>
                              </div>
                            </div>

                            {/* Net Dues Container */}
                            <div className="bg-gradient-to-r from-emerald-950/30 to-slate-950 border border-emerald-500/20 p-4 rounded-xl flex items-center justify-between shadow-inner">
                              <div>
                                <span className="text-xs text-emerald-450 block font-black">【الصافي المستحق للمورد اليوم】</span>
                                <span className="text-[10px] text-slate-500 font-bold block mt-1">
                                  المعادلة الحسابية الصارمة: (البضاعة المرفوعة اليومية) - (المدفوع كاش اليوم) - (المرتجع المعتمد اليوم)
                                </span>
                              </div>
                              <div className="text-base font-mono font-black text-emerald-400 text-left">
                                {Number(item.netDues || 0).toLocaleString("ar")} ج.م
                              </div>
                            </div>

                            {/* Native WhatsApp Dispatcher Button */}
                            <button
                              type="button"
                              onClick={() => {
                                const targetSup = isSupplier ? user : selectedSupplier;
                                const matched = suppliersDetails.find(s => s && s.name && s.name.toString().trim().toLowerCase() === targetSup.toString().trim().toLowerCase());
                                let phoneNum = "";
                                if (matched && matched.phone && matched.phone !== "—" && matched.phone.trim() !== "") {
                                  phoneNum = matched.phone.toString().trim();
                                }
                                
                                if (!phoneNum) {
                                  const userInput = window.prompt("⚠️ لم يتم العثور على رقم هاتف مسجل لهذا المورد. يرجى إدخال رقم هاتف المورد لبدء محادثة واتساب (مثال: 01012345678):");
                                  if (!userInput) return;
                                  phoneNum = userInput.trim();
                                }

                                // clean the phone number: remove any leading +, spaces, or dashes
                                let cleanedPhone = phoneNum.replace(/[+\s\-]/g, "");
                                
                                // If it starts with 0 and is an Egyptian number (usually 11 digits starting with 01), prepend 2
                                if (cleanedPhone.startsWith("0") && cleanedPhone.length === 11) {
                                  cleanedPhone = "2" + cleanedPhone;
                                }

                                const msg = `السلام عليكم يا فندم، تفاصيل كشف حسابكم ليوم ${item.date} طرف شركة الشحن:\n- 📦 【حساب البضاعة المرفوعة اليومية】: ${(item.totalWorkValue || 0).toLocaleString("ar")} ج.م\n- 💵 【حساب النقدي (المدفوع كاش اليوم)】: ${(item.cashPaid || 0).toLocaleString("ar")} ج.م\n- 🔄 【حساب المرتجعات المستلمة اليوم】: ${(item.returnedValueRefunded || 0).toLocaleString("ar")} ج.م\n- 🔴 【الصافي المستحق للمورد اليوم】: ${(item.netDues || 0).toLocaleString("ar")} ج.م\n\nشكراً لتعاملكم معنا متاح للمراجعة.`;

                                const encodedText = encodeURIComponent(msg);
                                const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanedPhone}&text=${encodedText}`;
                                window.open(whatsappUrl, "_blank");
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all border border-emerald-400/20 active:scale-98 shadow-md hover:shadow-lg hover:-translate-y-0.5"
                            >
                              <span>📦 إرسال كشف الحساب بالواتساب</span>
                            </button>

                            {/* Actions Inside Card */}
                            <div className="grid grid-cols-2 gap-2 pt-1">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDayDate(item.date);
                                  setSelectedDayStatus(isPending ? "🔴 معلق لم يصفى" : "🟢 تم تصفية الكاش والمرتجع");
                                  setSelectedDayOrdersDetail(item.orders);
                                }}
                                className="bg-slate-950 hover:bg-slate-950/80 border border-white/8 text-slate-200 py-2.5 px-3 rounded-lg text-2xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                              >
                                <Eye size={13} className="text-amber-500" />
                                <span>تفاصيل أوردرات اليوم</span>
                              </button>

                              {isFinancial && isPending ? (
                                <button
                                  type="button"
                                  disabled={settleDayProgress === item.date}
                                  onClick={() => handleSettleDay(item.date)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-slate-950 py-2.5 px-3 rounded-lg text-2xs font-black flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                                >
                                  {settleDayProgress === item.date ? (
                                    <Loader2 size={13} className="animate-spin text-slate-950" />
                                  ) : (
                                    <CheckCircle2 size={13} className="text-slate-950" />
                                  )}
                                  <span>تقفيل وتسليم الكاش المالي</span>
                                </button>
                              ) : (
                                <div className="bg-emerald-950/30 border border-emerald-900/30 text-emerald-400 py-2.5 px-3 rounded-lg text-2xs font-bold flex items-center justify-center gap-1">
                                  <Check size={12} />
                                  <span>حساب مقفل ومصفى تماماً</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
       )}

       {/* --- COURIER LEDGER WORKSPACE --- (Fixes Courier Salary screen failure) */}
      {activeLedger === "courier" && (() => {
        const courierName = isCourier ? user : selectedCourier;

        // Find courier profile details from allCouriers list:
        const courierProfile = allCouriers.find(c => 
          c && c.name && c.name.toString().trim().toLowerCase() === courierName.toString().trim().toLowerCase()
        ) || {
          commission_success: 25,
          commission_return: 10,
          salary: 3000,
          base_fixed_salary: 3000
        };

        // Filter active orders assigned to this courier:
        const activeCourierOrders = (orders || []).filter(o => 
          o && o.courier && o.courier.toString().trim().toLowerCase() === courierName.toString().trim().toLowerCase() &&
          o.isSettled !== true && o.isSettled !== "true" && o.is_settled !== "true"
        );

        // Status-based categories:
        const isDelivered = (s: string) => ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(s);
        const isPartial = (s: string) => ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي", "مرتجع جزئي بالمستودع"].includes(s);
        const isReturnedPaid = (s: string, returnShippingType?: string) => 
          ["مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"].includes(s) || 
          (s === "مرتجع" && returnShippingType === "paid");

        // Sum calculations in 100% frontend cache:
        let totalDeliveredCash = 0;
        let totalPartialCash = 0;
        let totalReturnPaidCash = 0;

        let deliveredCount = 0;
        let partialCount = 0;
        let returnPaidCount = 0;
        let returnTotalCount = 0;

        activeCourierOrders.forEach(o => {
          // Skip unactivated orders ['جاهز للاستلام من المورد'] per rule (v72)
          if (o.status === "جاهز للاستلام من المورد") return;

          const financials = getOrderFinancials(o);
          
          if (isDelivered(o.status)) {
            totalDeliveredCash += financials.totalCOD;
            deliveredCount++;
          } else if (isPartial(o.status)) {
            totalPartialCash += Number(o.actualReceivedCash || o.partialAmount || 0);
            partialCount++;
          } else if (isReturnedPaid(o.status, o.returnShippingType)) {
            totalReturnPaidCash += financials.shipPrice;
            returnPaidCount++;
          }

          if (["مرتجع", "مرتجع جديد", "مرتجع جزئي", "قيد المرتجع"].includes(o.status)) {
            returnTotalCount++;
          }
        });

        const totalCashWallet = totalDeliveredCash + totalPartialCash + totalReturnPaidCash;

        const successCommission = Number(courierProfile.commission_success || 25);
        const returnCommission = Number(courierProfile.commission_return || 10);
        
        // Strike (fixed commission) x (delivered + partial) + (returned paid x return commission):
        const todayEarnedCommissions = (deliveredCount + partialCount) * successCommission + (returnPaidCount * returnCommission);
        const totalProductivity = (deliveredCount + partialCount) + returnTotalCount;

        return (
          <div className="space-y-6">
            {/* Target Courier selection detail */}
            {isFinancial && (
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-white/6 p-4 rounded-xl shadow-lg">
                <div className="flex items-center gap-2">
                  <Users className="text-amber-500" size={18} />
                  <span className="text-xs font-extrabold text-slate-300">اختر المندوب لمراجعة وتصفية الحساب اليومي:</span>
                </div>
                <select
                  value={selectedCourier}
                  onChange={(e) => setSelectedCourier(e.target.value)}
                  className="bg-slate-950 border border-white/10 rounded-lg px-3 py-2 text-xs font-bold text-slate-200 focus:outline-none w-full md:w-64 cursor-pointer hover:border-amber-500/50 transition-colors"
                >
                  <option value="">-- اختر مندوباً --</option>
                  {allCouriers.map((c, idx) => (
                    <option key={idx} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {courierName ? (
              <div className="space-y-6">
                {/* Profile Card */}
                <div className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                  <div className="space-y-1">
                    <h3 className="text-sm font-black text-slate-200">ملف وموازنة المندوب: {courierName}</h3>
                    <p className="text-[10px] text-slate-400 font-medium">الراتب الأساسي للشهر: {Number(courierProfile.salary || courierProfile.base_fixed_salary || 3000).toLocaleString("ar")} ج.م · عمولة التسليم: {successCommission} ج.م · عمولة المرتجع: {returnCommission} ج.م</p>
                  </div>
                  {courierProfile.phone && courierProfile.phone !== "—" && (
                    <a
                      href={`https://wa.me/${courierProfile.phone.toString().replace(/[^\d]/g, "")}`}
                      target="_blank"
                      referrerPolicy="no-referrer"
                      className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all flex items-center gap-1.5"
                    >
                      💬 واتساب المندوب
                    </a>
                  )}
                </div>

                {/* ⚡ High-Speed Agile Settlement Dashboard (Three Counters) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* 💰 Counter 1: Cash Wallet */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-5 rounded-2xl relative overflow-hidden shadow-xl space-y-3 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">💰 عهدة المندوب الكاش الفعلي في جيبه</span>
                      <span className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                        <Wallet size={16} />
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-black text-slate-100 font-mono">
                        {totalCashWallet.toLocaleString("ar")} <span className="text-xs font-bold text-amber-500">ج.م</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 leading-relaxed font-semibold">
                        مجموع كاش أوردرات التسليم الكلي والجزئي ومصاريف شحن المرتجعات المدفوعة حالياً ميدانياً.
                      </div>
                    </div>
                    <div className="border-t border-white/4 pt-2.5 grid grid-cols-3 gap-1.5 text-center">
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500 font-bold">تسليم كلي</div>
                        <div className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">{totalDeliveredCash.toLocaleString("ar")}</div>
                      </div>
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500 font-bold">تسليم جزئي</div>
                        <div className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">{totalPartialCash.toLocaleString("ar")}</div>
                      </div>
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500 font-bold">مرتجع مدفوع</div>
                        <div className="text-[10px] font-mono font-bold text-emerald-400 mt-0.5">{totalReturnPaidCash.toLocaleString("ar")}</div>
                      </div>
                    </div>
                  </div>

                  {/* 🎯 Counter 2: Earned Commissions */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-5 rounded-2xl relative overflow-hidden shadow-xl space-y-3 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">🎯 إجمالي العمولات المستحقة اليوم</span>
                      <span className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400">
                        <CheckCircle2 size={16} />
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-black text-emerald-400 font-mono">
                        {todayEarnedCommissions.toLocaleString("ar")} <span className="text-xs font-bold text-emerald-500">ج.م</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 leading-relaxed font-semibold">
                        عمولات التوصيل المستحقة عن وردية اليوم لجميع الأوردرات المنجزة والمسلمة جزئياً أو مرتجعاتها المدفوعة.
                      </div>
                    </div>
                    <div className="border-t border-white/4 pt-2.5 grid grid-cols-2 gap-1.5 text-center">
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500 font-bold">العمولة الكلية/الجزئية</div>
                        <div className="text-[10px] font-mono font-bold text-slate-300 mt-0.5">{successCommission} ج.م</div>
                      </div>
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500 font-bold">عمولة المرتجع</div>
                        <div className="text-[10px] font-mono font-bold text-slate-300 mt-0.5">{returnCommission} ج.م</div>
                      </div>
                    </div>
                  </div>

                  {/* 📊 Counter 3: Daily Productivity */}
                  <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-5 rounded-2xl relative overflow-hidden shadow-xl space-y-3 text-right">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">📊 إنتاجية اليوم (توصيل / مرتجع)</span>
                      <span className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                        <Clock size={16} />
                      </span>
                    </div>
                    <div className="space-y-1">
                      <div className="text-2xl font-black text-cyan-400 font-mono">
                        {totalProductivity} <span className="text-xs font-bold text-slate-400">أوردر منجز</span>
                      </div>
                      <div className="text-[9.5px] text-slate-500 leading-relaxed font-semibold">
                        مجموع الشحنات التي تم معالجتها ميدانياً وتم تحديث حالتها من قبل المندوب اليوم.
                      </div>
                    </div>
                    <div className="border-t border-white/4 pt-2.5 grid grid-cols-2 gap-1.5 text-center font-semibold">
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500">ناجح / جزئي</div>
                        <div className="text-xs font-bold text-emerald-400 mt-0.5">{(deliveredCount + partialCount)} شحنة</div>
                      </div>
                      <div className="bg-slate-950/40 p-1 rounded">
                        <div className="text-[9px] text-slate-500">مرتجعات كلية</div>
                        <div className="text-xs font-bold text-red-400 mt-0.5">{returnTotalCount} شحنة</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 🛠️ Active Settlements Controls & Form */}
                {isFinancial && (
                  <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4 text-right">
                    <div className="border-b border-white/6 pb-2">
                      <h3 className="text-xs font-black text-amber-500 flex items-center gap-1.5">
                        <Shield size={14} />
                        <span>اعتماد الإغلاق المالي وإثبات الذمم اليومية</span>
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-1">يُرجى إثبات أي تعديل مالي مصاحب للتصفية وتأكيد إغلاق الوردية.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 font-bold">نوع التسوية اليدوية المصاحبة للتصفية (اختياري)</label>
                        <select
                          value={closingAdjType}
                          onChange={(e) => setClosingAdjType(e.target.value as any)}
                          className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs focus:outline-none cursor-pointer"
                        >
                          <option value="لا يوجد">لا يوجد تسويات مرافقة</option>
                          <option value="مكافأة">مكافأة للمندوب (+)</option>
                          <option value="جزاء">خصم/جزاء على المندوب (-)</option>
                        </select>
                      </div>

                      {closingAdjType !== "لا يوجد" && (
                        <>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400 font-bold">قيمة التسوية (ج.م)*</label>
                            <input
                              type="number"
                              required
                              value={closingAdjAmount}
                              onChange={(e) => setClosingAdjAmount(e.target.value)}
                              placeholder="100"
                              className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="block text-[10px] text-slate-400 font-bold">السبب / التفاصيل</label>
                            <input
                              type="text"
                              required
                              value={closingAdjDesc}
                              onChange={(e) => setClosingAdjDesc(e.target.value)}
                              placeholder="تفاصيل المكافأة أو الخصم..."
                              className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs"
                            />
                          </div>
                        </>
                      )}
                    </div>

                    {/* Core Action Button */}
                    <div className="pt-3">
                      <button
                        type="button"
                        disabled={settling}
                        onClick={() => handleInstantWalletSettlement(courierName, totalCashWallet, todayEarnedCommissions)}
                        className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-98 shadow-md disabled:opacity-50 font-sans"
                      >
                        {settling ? (
                          <>
                            <Loader2 size={16} className="animate-spin" />
                            <span>جاري تصفية الحساب وإغلاق العهدة بالخزنة...</span>
                          </>
                        ) : (
                          <>
                            <CheckCircle2 size={16} />
                            <span>✅ اعتماد تصفية الحساب وإغلاق العهدة اليومية لـ ({courierName})</span>
                          </>
                        )}
                      </button>
                      <p className="text-[9px] text-slate-500 text-center mt-2 font-semibold">
                        * عند الضغط: سيتم ترحيل مبلغ الكاش ({totalCashWallet.toLocaleString("ar")} ج.م) كإيداع بالخزنة، وتسجيل عمولة ({todayEarnedCommissions.toLocaleString("ar")} ج.م) بملف المندوب، وتصفير عداد اليوم.
                      </p>
                    </div>
                  </div>
                )}

                {/* 📋 Active Orders List For Selected Courier */}
                <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4 text-right">
                  <h3 className="text-xs font-black text-slate-350 border-b border-white/6 pb-2">
                    📋 الشحنات النشطة بوردية المندوب حالياً ({activeCourierOrders.length} أوردر)
                  </h3>
                  
                  {activeCourierOrders.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-500 font-bold">
                      لا يوجد شحنات جارية مسندة للمندوب حالياً
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-white/6 rounded-xl">
                      <table className="w-full text-right text-xs border-collapse font-semibold">
                        <thead>
                          <tr className="bg-slate-950 border-b border-white/10 text-slate-400">
                            <th className="py-2 px-3">كود التتبع</th>
                            <th className="py-2 px-3">العميل</th>
                            <th className="py-2 px-3">العنوان / المحافظة</th>
                            <th className="py-2 px-3">الحالة الميدانية</th>
                            <th className="py-2 px-3 text-left">قيمة الكاش المحتسب للعهدة</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeCourierOrders.map((o, oIdx) => {
                            const financials = getOrderFinancials(o);
                            let contributedCash = 0;
                            let statusColor = "text-slate-450 bg-slate-950/40";
                            let cashColor = "text-slate-500";

                            if (isDelivered(o.status)) {
                              contributedCash = financials.totalCOD;
                              statusColor = "text-emerald-400 bg-emerald-950/20";
                              cashColor = "text-emerald-400 font-black";
                            } else if (isPartial(o.status)) {
                              contributedCash = Number(o.actualReceivedCash || o.partialAmount || 0);
                              statusColor = "text-amber-500 bg-amber-950/20";
                              cashColor = "text-amber-400 font-black";
                            } else if (isReturnedPaid(o.status, o.returnShippingType)) {
                              contributedCash = financials.shipPrice;
                              statusColor = "text-teal-400 bg-teal-950/20";
                              cashColor = "text-teal-400 font-black";
                            } else if (o.status === "مرتجع") {
                              statusColor = "text-red-400 bg-red-950/20";
                            }

                            return (
                              <tr key={oIdx} className="border-b border-white/5 hover:bg-slate-950/40">
                                <td className="py-2.5 px-3 font-mono text-slate-300">{o.tracking || o.trackingId}</td>
                                <td className="py-2.5 px-3 text-slate-200">{o.customer || o.custName || "—"}</td>
                                <td className="py-2.5 px-3 text-slate-450">{o.province || o.custProvince || "—"}</td>
                                <td className="py-2.5 px-3">
                                  <span className={`inline-block px-2 py-0.5 text-[9px] rounded-md font-bold ${statusColor}`}>
                                    {o.status}
                                  </span>
                                </td>
                                <td className={`py-2.5 px-3 text-left font-mono ${cashColor}`}>
                                  {contributedCash > 0 ? `+${contributedCash.toLocaleString("ar")} ج.م` : "—"}
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
            ) : (
              <div className="text-center py-12 bg-slate-900 border border-white/6 rounded-2xl text-slate-500 text-xs font-bold">
                يرجى اختيار المندوب من القائمة أعلاه لعرض كارت التقفيل اللحظي والعهدة الكاش.
              </div>
            )}
          </div>
        );
      })()}

      {/* 🔍 Deep-Dive Daily Financial Ledger Modal */}
      {selectedDayOrdersDetail && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-white/10 rounded-2xl w-full max-w-5xl max-h-[85vh] overflow-hidden flex flex-col shadow-2xl text-right animate-fadeIn">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-white/8 flex items-center justify-between bg-slate-900">
              <div className="space-y-1">
                <h3 className="text-sm font-black text-slate-100 flex items-center gap-2">
                  <Shield size={16} className="text-amber-500" />
                  <span>🔍 كشف الحساب التفصيلي للطلبات - ليوم {selectedDayDate}</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-bold">
                  حالة اليوم الحالية: <span className={selectedDayStatus === "pending" ? "text-amber-450" : "text-emerald-400"}>{selectedDayStatus === "pending" ? "🔴 معلق لم يصفى" : "🟢 تم تصفيته وقفل حسابه"}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedDayOrdersDetail(null);
                  setSelectedDayDate("");
                  setModalSearchFilter("");
                }}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="p-4 bg-slate-950 border-b border-white/4">
              <div className="relative">
                <span className="absolute inset-y-0 right-3 flex items-center pr-1 text-slate-550">
                  <Search size={14} />
                </span>
                <input
                  type="text"
                  placeholder="ابحث باسم العميل، رقم الهاتف، كود التتبع، أو حالة الأوردر..."
                  value={modalSearchFilter}
                  onChange={(e) => setModalSearchFilter(e.target.value)}
                  className="w-full bg-slate-900 border border-white/8 rounded-lg pr-9 pl-3 py-2 text-xs text-slate-200 outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="overflow-x-auto border border-white/6 rounded-xl">
                <table className="w-full text-right border-collapse text-2xs font-semibold">
                  <thead>
                    <tr className="bg-slate-900 text-slate-400 border-b border-white/6 font-bold">
                      <th className="p-3">رقم التتبع</th>
                      <th className="p-3">اسم العميل</th>
                      <th className="p-3">الهاتف</th>
                      <th className="p-3">المحافظة</th>
                      <th className="p-3">الحالة الحالية</th>
                      <th className="p-3 text-left">قيمة المنتج الصافي</th>
                      <th className="p-3 text-left">مصاريف الشحن</th>
                      <th className="p-3 text-left">COD المطلوب الكلي</th>
                      <th className="p-3 text-left">الكاش المحصل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/4">
                    {selectedDayOrdersDetail
                      .filter((o: any) => {
                        const term = modalSearchFilter.toLowerCase().trim();
                        if (!term) return true;
                        return (
                          (o.trackingId || "").toLowerCase().includes(term) ||
                          (o.custName || "").toLowerCase().includes(term) ||
                          (o.custPhone || "").toLowerCase().includes(term) ||
                          (o.status || "").toLowerCase().includes(term)
                        );
                      })
                      .map((o: any, oIdx: number) => {
                        const isDelivered = ["تم التسليم", "تسليم جزئي"].includes(o.status);
                        const isReturned = (o.status || "").includes("مرتجع") || ["قيد المرتجع"].includes(o.status);
                        return (
                          <tr key={oIdx} className="hover:bg-slate-900/40">
                            <td className="p-3 font-mono text-slate-300 select-all">{o.trackingId}</td>
                            <td className="p-3 text-slate-100 font-bold">{o.custName}</td>
                            <td className="p-3 font-mono text-slate-300">{o.custPhone}</td>
                            <td className="p-3 text-slate-400">{o.custProvince || "—"}</td>
                            <td className="p-3">
                              <span
                                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isDelivered
                                    ? "bg-emerald-950/50 text-emerald-400"
                                    : isReturned
                                    ? "bg-red-950/50 text-red-400"
                                    : "bg-slate-800 text-slate-200"
                                }`}
                              >
                                {o.status}
                              </span>
                            </td>
                            <td className="p-3 text-left font-mono text-slate-300">{(o.prodPrice || 0).toLocaleString("ar")} ج.م</td>
                            <td className="p-3 text-left font-mono text-slate-300">{(o.shipPrice || 0).toLocaleString("ar")} ج.م</td>
                            <td className="p-3 text-left font-mono text-amber-400">{(o.cod || 0).toLocaleString("ar")} ج.م</td>
                            <td className="p-3 text-left font-mono font-bold text-emerald-400">{(o.collectedAmount || 0).toLocaleString("ar")} ج.م</td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Bottom KPI Summary */}
            <div className="p-4 bg-slate-900 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-slate-950 border border-white/4 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-bold">عدد أوردرات اليوم المصنفة</span>
                <span className="text-sm font-mono font-black text-slate-100">{selectedDayOrdersDetail.length} أوردرات</span>
              </div>
              <div className="bg-slate-950 border border-white/4 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي كود المطلوب كلياً</span>
                <span className="text-sm font-mono font-black text-amber-400">
                  {selectedDayOrdersDetail.reduce((acc, cur) => acc + (cur.cod || 0), 0).toLocaleString("ar")} ج.م
                </span>
              </div>
              <div className="bg-slate-950 border border-white/4 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي الكاش المحصل الفعلي</span>
                <span className="text-sm font-mono font-black text-emerald-400">
                  {selectedDayOrdersDetail.reduce((acc, cur) => acc + (cur.collectedAmount || 0), 0).toLocaleString("ar")} ج.م
                </span>
              </div>
              <div className="bg-slate-950 border border-white/4 p-2.5 rounded-xl">
                <span className="text-[10px] text-slate-400 block font-bold">إجمالي شحن أوردرات اليوم</span>
                <span className="text-sm font-mono font-black text-slate-300">
                  {selectedDayOrdersDetail.reduce((acc, cur) => acc + (cur.shipPrice || 0), 0).toLocaleString("ar")} ج.م
                </span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-3 bg-slate-950 border-t border-white/4 text-left">
              <button
                type="button"
                onClick={() => {
                  setSelectedDayOrdersDetail(null);
                  setSelectedDayDate("");
                  setModalSearchFilter("");
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-5 rounded-lg text-xs font-black cursor-pointer transition-colors"
              >
                إغلاق الكشف التفصيلي
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
