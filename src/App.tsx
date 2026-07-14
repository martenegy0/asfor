import React, { useEffect, useState } from "react";
import { LogOut, RefreshCw, PlusCircle, LayoutDashboard, Truck, Wallet, FileText, Settings, Users, BookOpen, Layers, History, Calendar, Download, Activity } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiCall, getMockOrders, getMockExpenses, getMockCashboxEntries, getTodayDateStr } from "./utils";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Ledger from "./components/Ledger";
import Orders from "./components/Orders";
import Inputs from "./components/Inputs";
import DailyClosing from "./components/DailyClosing";
import SuppliersManagement from "./components/SuppliersManagement";
import OpsRoom from "./components/OpsRoom";
import ArchivePortal from "./components/ArchivePortal";
import { StaffPermissions } from "./components/StaffPermissions";

function computeDynamicCounters(rawList: any[], userRole: string, userLogin: string, cashboxBal: number) {
  const cleanRole = (userRole || "").toString().trim();
  const isAgent = cleanRole === "مندوب" || cleanRole.includes("مندوب");
  const isSupplier = cleanRole === "مورد" || cleanRole.includes("مورد");
  const isSupervisor = cleanRole === "مشرف" || cleanRole.includes("مشرف");

  const todayStr = getTodayDateStr();

  // 1. Strict Supplier Isolation Guardrail (Adhere to v135 established ledger)
  if (isSupplier) {
    const deliveredOrders = rawList.filter((o: any) => o.status === "تم التسليم" || o.status === "تم التسليم بنجاح");
    const cumulativeCollection = deliveredOrders.reduce((sum, o) => {
      return sum + (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
    }, 0);
    const todayDeliveredOrders = deliveredOrders.filter((o: any) => {
      const delDate = o.delivDate || o.updatedAt || "";
      return delDate.startsWith(todayStr);
    });
    const todayCollection = todayDeliveredOrders.reduce((sum, o) => {
      return sum + (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
    }, 0);

    return {
      total: rawList.length,
      delivered: deliveredOrders.length,
      returned: rawList.filter((o: any) => ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد"].includes(o.status)).length,
      active: rawList.filter((o: any) => ["خارج مع المندوب", "تم الإسناد", "قيد التنفيذ"].includes(o.status)).length,
      totalCOD: cumulativeCollection,
      todayCOD: todayCollection
    };
  }

  // 2. Courier active workload calculations (0 active workload once settled)
  if (isAgent) {
    const courierActiveOrders = rawList.filter((o: any) => {
      const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true || o.isClosed === true || o.isClosed === "true";
      return !isS;
    });

    const deliveredOrders = courierActiveOrders.filter((o: any) => o.status === "تم التسليم");
    const cumulativeCollection = deliveredOrders.reduce((sum, o) => {
      return sum + (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
    }, 0);
    const todayDeliveredOrders = deliveredOrders.filter((o: any) => {
      const delDate = o.delivDate || o.updatedAt || "";
      return delDate.startsWith(todayStr);
    });
    const todayCollection = todayDeliveredOrders.reduce((sum, o) => {
      return sum + (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
    }, 0);

    return {
      total: courierActiveOrders.length,
      delivered: deliveredOrders.length,
      returned: courierActiveOrders.filter((o: any) => ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد"].includes(o.status)).length,
      active: courierActiveOrders.filter((o: any) => ["خارج مع المندوب", "تم الإسناد", "قيد التنفيذ"].includes(o.status)).length,
      totalCOD: cumulativeCollection,
      todayCOD: todayCollection
    };
  }

  // 3. Admin, Supervisor, and Ops Officer roles (Smart Dynamic Operational Counters)
  const isUploadedToday = (o: any) => {
    return (o.createdAt && o.createdAt.startsWith(todayStr)) || (o.updatedAt && o.updatedAt.startsWith(todayStr)) || (o.orderDate && o.orderDate.startsWith(todayStr));
  };
  
  const isClosedOrArchived = (o: any) => {
    const status = o.status || "";
    return o.isArchived || o.isClosed || o.isSettled || o.is_settled === "true" || ["مؤرشف", "تم تسليم المرتجع للمورد وتصفية حسابه", "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد"].includes(status);
  };

  const activeDailyCycleOrders = rawList.filter((o: any) => {
    return isUploadedToday(o) || !isClosedOrArchived(o);
  });

  const dailyDeliveredOrders = rawList.filter((o: any) => {
    const status = o.status || "";
    const isDel = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
    const dateStr = o.delivDate || o.updatedAt || "";
    return isDel && dateStr.startsWith(todayStr);
  });

  const activeInProgressOrders = rawList.filter((o: any) => {
    const status = o.status || "";
    const isInField = ["قيد التنفيذ", "خارج مع المندوب", "تم الإسناد", "مسند"].includes(status);
    return isInField && !isClosedOrArchived(o);
  });

  const activeReturnsOrders = rawList.filter((o: any) => {
    const status = o.status || "";
    const isRet = ["مرتجع بالمستودع", "مرتجع بالستودع", "مرتجع", "مرتجع جديد", "مرتجع جزئي بالمستودع"].includes(status);
    const isReturnedToVendor = ["مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه"].includes(status);
    return isRet && !isReturnedToVendor && !isClosedOrArchived(o);
  });

  const todayCODCustodyOrders = rawList.filter((o: any) => {
    const status = o.status || "";
    const isDel = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
    const dateStr = o.delivDate || o.updatedAt || "";
    const isToday = dateStr.startsWith(todayStr);
    const isHeldByCourier = !o.isSettled && !o.isClosed && !o.isArchived && o.courier;
    return isDel && isToday && isHeldByCourier;
  });

  const getCODVal = (o: any) => Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));

  const todayCODCustodySum = todayCODCustodyOrders.reduce((sum, o) => sum + getCODVal(o), 0);

  const settledVaultOrders = rawList.filter((o: any) => {
    const status = o.status || "";
    const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true || o.isClosed || o.isArchived;
    const isDel = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
    return isS && isDel;
  });

  const settledVaultCash = settledVaultOrders.reduce((sum, o) => sum + getCODVal(o), 0);
  const vaultCash = (cleanRole === "مدير" || cleanRole === "محاسب") && cashboxBal > 0 ? cashboxBal : settledVaultCash;

  return {
    total: activeDailyCycleOrders.length,
    delivered: dailyDeliveredOrders.length,
    returned: activeReturnsOrders.length,
    active: activeInProgressOrders.length,
    totalCOD: vaultCash,
    todayCOD: todayCODCustodySum
  };
}

export default function App() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("");
  const [perms, setPerms] = useState("");
  const [activeTab, setActiveTab] = useState<string>("orders");
  const [isBgSyncing, setIsBgSyncing] = useState(false);

  // Load and refresh orders state
  const [orders, setOrders] = useState<any[]>([]);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const bgFetchTimeoutRef = React.useRef<any>(null);

  // --- Treasury / Cashbox lists and states (Admin & Accountant only!) ---
  const [cashboxEntries, setCashboxEntries] = useState<any[]>([]);
  const [cashboxBalance, setCashboxBalance] = useState(0);

  const runningStreetCash = React.useMemo(() => {
    return (orders || [])
      .filter((o) => {
        const s = (o.status || "").toString().trim();
        const isInStreet = ["مسند", "تم الإسناد", "تم الاسناد", "خارج مع المندوب", "خارج للتسليم", "خارج للتوصيل", "مع المندوب"].includes(s);
        return isInStreet && !o.isClosed;
      })
      .reduce((sum, o) => {
        const pPrice = Number(o.prodPrice || 0);
        const sPrice = Number(o.shipPrice || 0);
        const amount = o.totalCOD || (pPrice + sPrice);
        return sum + Number(amount || 0);
      }, 0);
  }, [orders]);
  const [cashModalOpen, setCashModalOpen] = useState(false);
  const [cashType, setCashType] = useState<"وارد" | "صادر" | "تحصيل مندوب" | "سداد مورد">("وارد");
  const [cashAmount, setCashAmount] = useState("");
  const [cashDesc, setCashDesc] = useState("");
  const [cashRef, setCashRef] = useState("");

  // --- Expenses lists and states ---
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [expModalOpen, setExpModalOpen] = useState(false);
  const [expCat, setExpCat] = useState("أخرى");
  const [expAmount, setExpAmount] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Users management states (Admin only!) ---
  const [usersList, setUsersList] = useState<any[]>([]);
  const [addUserModalOpen, setAddUserModalOpen] = useState(false);
  const [addedUsername, setAddedUsername] = useState("");
  const [addedRole, setAddedRole] = useState("مندوب");
  const [addedPass, setAddedPass] = useState("");
  const [addedEmail, setAddedEmail] = useState("");

  // --- Courier profile customization states ---
  const [courierEditModalOpen, setCourierEditModalOpen] = useState(false);
  const [selectedCourierName, setSelectedCourierName] = useState("");
  const [courierPhone, setCourierPhone] = useState("");
  const [courierRegion, setCourierRegion] = useState("");
  const [courierBaseSalary, setCourierBaseSalary] = useState(3000);
  const [courierCommissionSuccess, setCourierCommissionSuccess] = useState(25);
  const [courierCommissionReturn, setCourierCommissionReturn] = useState(10);
  const [courierHireDate, setCourierHireDate] = useState("");

  // --- Audit Log states ---
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(false);

  // --- Quick Success rate stats for current logged user ---
  const [quickTotal, setQuickTotal] = useState(0);
  const [quickDelivered, setQuickDelivered] = useState(0);
  const [quickReturned, setQuickReturned] = useState(0);
  const [quickActive, setQuickActive] = useState(0);
  const [quickTotalCOD, setQuickTotalCOD] = useState(0);
  const [quickTodayCOD, setQuickTodayCOD] = useState(0);
  const [supplierBalance, setSupplierBalance] = useState(0);

  // --- Real-time Manager Toast Notifications state & helper ---
  const [toasts, setToasts] = useState<any[]>([]);

  // Synthesized notification audio chime using HTML5 Web Audio API
  const playNotificationSound = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;

      // Tone 1: E5
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.1);

      gain1.gain.setValueAtTime(0, now);
      gain1.gain.linearRampToValueAtTime(0.12, now + 0.05);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      // Tone 2: A5
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(1318.51, now + 0.22); // E6

      gain2.gain.setValueAtTime(0, now + 0.08);
      gain2.gain.linearRampToValueAtTime(0.08, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.4);
    } catch (e) {
      console.warn("AudioContext notification sound failed", e);
    }
  };

  const triggerToastNotification = (toast: any) => {
    setToasts((prev) => {
      // Duplicates guarding
      if (prev.some((t) => t.tracking === toast.tracking && t.status === toast.status)) {
        return prev;
      }
      return [toast, ...prev];
    });
    playNotificationSound();
    
    // Auto remove after 6 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== toast.id));
    }, 6000);
  };

  // --- Restore session upon mounting (Fixes Refresh Logout Bug!) ---
  useEffect(() => {
    const savedToken = localStorage.getItem("fp_token");
    const savedUser = localStorage.getItem("fp_user");
    const savedRole = localStorage.getItem("fp_role");
    const savedPerms = localStorage.getItem("fp_perms");

    const cachedOrders = localStorage.getItem("fp_orders_cache");
    if (cachedOrders) {
      try {
        setOrders(JSON.parse(cachedOrders));
      } catch (e) {
        console.error("Failed to restore orders cache", e);
      }
    }

    const cachedCouriers = localStorage.getItem("fp_couriers_cache");
    if (cachedCouriers) {
      try {
        setCouriers(JSON.parse(cachedCouriers));
      } catch (e) {
        console.error("Failed to restore couriers cache", e);
      }
    }

    if (savedToken && savedUser && savedRole) {
      setToken(savedToken);
      setUsername(savedUser);
      setRole(savedRole);
      setPerms(savedPerms || "");
      refreshAllData(savedToken, savedRole, savedUser);
    }
  }, []);

  // Sync background state indicators asynchronously
  useEffect(() => {
    function handleStart() {
      setIsBgSyncing(true);
    }
    function handleEnd() {
      setIsBgSyncing(false);
    }
    window.addEventListener("bg-sync-start", handleStart);
    window.addEventListener("bg-sync-end", handleEnd);
    return () => {
      window.removeEventListener("bg-sync-start", handleStart);
      window.removeEventListener("bg-sync-end", handleEnd);
    };
  }, []);

  const exportCashboxToCSV = () => {
    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `سجل_الخزينة-${dateStr}`;

    const headers = [
      "البيان / الحركة",
      "النوع",
      "القيمة (ج.م)",
      "تاريخ الحركة",
      "الرصيد بعد الحركة (ج.م)",
      "رقم المرجع",
      "المسجل بواسطة"
    ];

    const BOM = "\uFEFF";
    const csvContent = [
      headers.join(","),
      ...cashboxEntries.map(e => {
        const row = [
          e.desc || e.type || "",
          e.type || "",
          e.amount || 0,
          e.date || "",
          e.balance || 0,
          e.ref || "",
          e.addedBy || ""
        ];

        return row.map(val => {
          const stringVal = typeof val === "string" ? val.replace(/"/g, '""') : String(val);
          return stringVal.includes(",") || stringVal.includes("\n") || stringVal.includes('"') 
            ? `"${stringVal}"` 
            : stringVal;
        }).join(",");
      })
    ].join("\n");

    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sync session on change
  function handleLoginSuccess(name: string, roleVal: string, tkVal: string, permsVal: string) {
    setToken(tkVal);
    setUsername(name);
    setRole(roleVal);
    setPerms(permsVal);

    localStorage.setItem("fp_token", tkVal);
    localStorage.setItem("fp_user", name);
    localStorage.setItem("fp_role", roleVal);
    localStorage.setItem("fp_perms", permsVal);

    // Default starting view tab based on roles
    if (roleVal === "مدير" || roleVal === "مشرف") {
      setActiveTab("orders");
    } else if (roleVal === "محاسب") {
      setActiveTab("cash");
    } else {
      setActiveTab("orders");
    }

    refreshAllData(tkVal, roleVal, name);
  }

  // --- Clean Logout (Fixes Blank Page Logout Bug!) ---
  function handleLogout() {
    setToken("");
    setUsername("");
    setRole("");
    setPerms("");
    setOrders([]);
    setCouriers([]);

    localStorage.removeItem("fp_token");
    localStorage.removeItem("fp_user");
    localStorage.removeItem("fp_role");
    localStorage.removeItem("fp_perms");

    // Revert tab details
    setActiveTab("orders");
  }

  // Dual data pull
  async function refreshAllData(tk = token, activeRole = role, activeUser = username) {
    if (!tk) return;
    if (bgFetchTimeoutRef.current) {
      clearTimeout(bgFetchTimeoutRef.current);
    }
    setLoadingOrders(true);
    try {
      const cleanRole = (activeRole || "").toString().trim();
      const isAgent = cleanRole === "مندوب" || cleanRole.includes("مندوب");
      const isSupplier = cleanRole === "مورد" || cleanRole.includes("مورد");
      const isReturnsOfficer = cleanRole === "مسؤول مرتجعات" || cleanRole.includes("مرتجعات");
      const isSupervisor = cleanRole === "مشرف" || cleanRole.includes("مشرف");

      // 1. Fetch Orders List (Stage 1: Fast initial load of active/current orders only)
      let rawOrders: any[] = [];
      try {
        const resOrd = await apiCall("getOrders", tk, { 
          todayOnly: isAgent,
          includeArchived: false // Default Lazy Loading: Exclude archived database initially for instant response
        });
        if (resOrd && resOrd.ok) {
          rawOrders = resOrd.orders || [];
        }
      } catch (err) {
        console.warn("getOrders api failed, using local/mock fallback", err);
      }

      let finalRaw = [...rawOrders];
      let orderList = [...finalRaw];

      // Strict client-side role filtering safety boundary
      const cleanUser = (activeUser || "").toString().trim().toLowerCase();

      if (isAgent) {
        orderList = orderList.filter((o: any) => o.courier && o.courier.toString().trim().toLowerCase() === cleanUser);
      } else if (isSupervisor) {
        const staffCached = localStorage.getItem("fp_staff_permissions_cache");
        let supervisedNames: string[] = [];
        if (staffCached) {
          try {
            const list = JSON.parse(staffCached);
            supervisedNames = list
              .filter((item: any) => (item.supervisor_id || "").toString().trim().toLowerCase() === cleanUser)
              .map((item: any) => (item.name || "").toString().trim().toLowerCase());
          } catch (e) {
            console.error("Error reading staff cache for supervisor filter", e);
          }
        }
        orderList = orderList.filter((o: any) => {
          const oCou = (o.courier || "").toString().trim().toLowerCase();
          return oCou && supervisedNames.includes(oCou);
        });
      } else if (isSupplier) {
        orderList = orderList.filter((o: any) => o.supplier && o.supplier.toString().trim().toLowerCase() === cleanUser);
      } else if (isReturnsOfficer) {
        orderList = orderList.filter((o: any) => 
          [
            "مرتجع",
            "مرتجع بالمستودع",
            "مرتجع جديد",
            "مرتجع جاري تسليمه للمكتب",
            "جاري الرجوع للمورد",
            "تم تسليم المرتجع للمورد",
            "جاهز للتسليم للمورد",
            "مرتجع تم تسليمه للمورد",
            "تم تسليم المرتجع للمورد وتصفية حسابه",
            "مرتجع جزئي بالمستودع",
            "قيد المرتجع",
            "التسليم للمورد",
            "جاري تجهيز المرتجع"
          ].includes(o.status) || 
          o.returnQueueStatus ||
          (o.status || "").toString().includes("مرتجع") ||
          (o.status || "").toString().includes("للمورد")
        );
      }

      setOrders(orderList);
      localStorage.setItem("fp_orders_cache", JSON.stringify(orderList));

      // Compute calculations programmatically (client-side) using dynamic helper
      const stats = computeDynamicCounters(orderList, role, username, cashboxBalance);
      setQuickTotal(stats.total);
      setQuickDelivered(stats.delivered);
      setQuickReturned(stats.returned);
      setQuickActive(stats.active);
      setQuickTotalCOD(stats.totalCOD);
      setQuickTodayCOD(stats.todayCOD);

      // Stage 2: Load archived orders in background if needed (e.g. for non-Agent roles to cover full historical searches)
      if (!isAgent) {
        bgFetchTimeoutRef.current = setTimeout(async () => {
          try {
            const resOrdFull = await apiCall("getOrders", tk, { 
              todayOnly: isAgent,
              includeArchived: true
            });
            if (resOrdFull && resOrdFull.ok) {
              const fullRaw = resOrdFull.orders || [];
              let fullOrderList = [...fullRaw];

              if (isAgent) {
                fullOrderList = fullOrderList.filter((o: any) => o.courier && o.courier.toString().trim().toLowerCase() === cleanUser);
              } else if (isSupervisor) {
                const staffCached = localStorage.getItem("fp_staff_permissions_cache");
                let supervisedNames: string[] = [];
                if (staffCached) {
                  try {
                    const list = JSON.parse(staffCached);
                    supervisedNames = list
                      .filter((item: any) => (item.supervisor_id || "").toString().trim().toLowerCase() === cleanUser)
                      .map((item: any) => (item.name || "").toString().trim().toLowerCase());
                  } catch (e) {
                    console.error("Error reading staff cache for lazy supervisor filter", e);
                  }
                }
                fullOrderList = fullOrderList.filter((o: any) => {
                  const oCou = (o.courier || "").toString().trim().toLowerCase();
                  return oCou && supervisedNames.includes(oCou);
                });
              } else if (isSupplier) {
                fullOrderList = fullOrderList.filter((o: any) => o.supplier && o.supplier.toString().trim().toLowerCase() === cleanUser);
              } else if (isReturnsOfficer) {
                fullOrderList = fullOrderList.filter((o: any) => 
                  [
                    "مرتجع",
                    "مرتجع بالمستودع",
                    "مرتجع جديد",
                    "مرتجع جاري تسليمه للمكتب",
                    "جاري الرجوع للمورد",
                    "تم تسليم المرتجع للمورد",
                    "جاهز للتسليم للمورد",
                    "مرتجع تم تسليمه للمورد",
                    "تم تسليم المرتجع للمورد وتصفية حسابه",
                    "مرتجع جزئي بالمستودع",
                    "قيد المرتجع",
                    "التسليم للمورد",
                    "جاري تجهيز المرتجع"
                  ].includes(o.status) || 
                  o.returnQueueStatus ||
                  (o.status || "").toString().includes("مرتجع") ||
                  (o.status || "").toString().includes("للمورد")
                );
              }

              setOrders(fullOrderList);
              localStorage.setItem("fp_orders_cache", JSON.stringify(fullOrderList));

              const stats = computeDynamicCounters(fullOrderList, role, username, cashboxBalance);
              setQuickTotal(stats.total);
              setQuickDelivered(stats.delivered);
              setQuickReturned(stats.returned);
              setQuickActive(stats.active);
              setQuickTotalCOD(stats.totalCOD);
              setQuickTodayCOD(stats.todayCOD);
            }
          } catch (bgErr) {
            console.warn("Background full orders fetch failed:", bgErr);
          }
        }, 600); // 600ms non-blocking staged delay
      }

      // 1.5. If the logged user is a supplier, retrieve their authentic outstanding cumulative balance
      if (isSupplier) {
        try {
          const resDash = await apiCall("supplierDashboard", tk, { supplier: activeUser });
          if (resDash && resDash.ok && resDash.stats) {
            setSupplierBalance(resDash.stats.due || 0);
          }
        } catch (e) {
          console.warn("supplierDashboard API fetch failed", e);
        }
      }

      // 2. Fetch couriers profiles
      const resCourier = await apiCall("getCouriers", tk);
      if (resCourier.ok) {
        setCouriers(resCourier.couriers || []);
        localStorage.setItem("fp_couriers_cache", JSON.stringify(resCourier.couriers || []));
      }

      // 3. Fetch specific financial lists if permitted
      const isFinance = activeRole === "مدير" || activeRole === "محاسب";
      if (isFinance) {
        fetchCashboxDetails(tk);
        fetchExpensesDetails(tk);
        loadAuditLogs(tk);
        if (activeRole === "مدير") {
          fetchUsersDetail(tk);
        }
      }
    } catch (err) {
      console.error("Orders fetching failed offline", err);
    } finally {
      setLoadingOrders(false);
    }
  }

  // --- central audit logging downloader ---
  async function loadAuditLogs(tk = token) {
    if (!tk) return;
    setLoadingAudits(true);
    try {
      const res = await apiCall("getAuditLog", tk);
      if (res.ok) {
        setAuditLogs(res.logs || []);
      }
    } catch (err) {
      console.error("Failed loading audit logs", err);
    } finally {
      setLoadingAudits(false);
    }
  }

  // --- Accountant operations triggers ---
  async function fetchCashboxDetails(tk = token) {
    try {
      const res = await apiCall("cashbox", tk);
      if (res.ok) {
        setCashboxEntries(res.entries || []);
        setCashboxBalance(res.balance !== undefined ? res.balance : 0);
      }
    } catch (e) {
      console.warn("Cashbox fetching error", e);
    }
  }

  async function fetchExpensesDetails(tk = token) {
    try {
      const res = await apiCall("expenses", tk);
      if (res.ok) {
        const serverExpenses = res.expenses || [];
        setExpenses(serverExpenses);
        setExpensesTotal(res.total !== undefined ? res.total : serverExpenses.reduce((sum, item) => sum + Number(item.amount || 0), 0));
      }
    } catch (e) {
      console.warn("Expenses list retrieval error", e);
    }
  }

  async function fetchUsersDetail(tk = token) {
    try {
      const res = await apiCall("getUsers", tk);
      if (res.ok) {
        setUsersList(res.users || []);
      }
    } catch (e) {
       console.warn("Users fetching logs error", e);
    }
  }

  // Submit Cash entry
  async function submitCashboxLog(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (!cashAmount || Number(cashAmount) <= 0) {
      alert("الطلب يحتاج إدخال مبلغ صحيح");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiCall("addCashbox", token, {
        desc: cashDesc.trim() || `حركة خزينة يدوية: ${cashType}`,
        type: cashType,
        amount: Number(cashAmount),
        ref: cashRef.trim()
      });
      if (res.ok) {
        setCashModalOpen(false);
        setCashAmount("");
        setCashDesc("");
        setCashRef("");
        fetchCashboxDetails();
        alert("✅ تم تسجيل حركة الخزينة وتصفيها بالدفتر اللحظي");
      } else {
        alert("⚠️ " + res.error);
      }
    } catch (err) {
       alert("فشل تسجيل حركة الخزينة");
    } finally {
       setIsSubmitting(false);
    }
  }

  // Submit Expense item
  async function submitExpenseLog(e: React.FormEvent) {
    e.preventDefault();
    if (isSubmitting) return;
    if (!expAmount || Number(expAmount) <= 0) {
      alert("يرجى كتابة مبلغ مصروف صحيح");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await apiCall("addExpense", token, {
        cat: expCat,
        desc: expDesc.trim(),
        amount: Number(expAmount)
      });
      if (res.ok) {
         setExpModalOpen(false);
         setExpAmount("");
         setExpDesc("");
         fetchExpensesDetails();
         fetchCashboxDetails(); // sync balances
         alert("✅ تم قيد المصروف وسداده من سحوبات الخزينة");
      } else {
        alert("⚠️ " + res.error);
      }
    } catch (err) {
      alert("عطل في تعيين المصروف");
    } finally {
       setIsSubmitting(false);
    }
  }

  // Add User Profile (Manager only)
  async function handleAddUserProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!addedUsername.trim() || !addedPass.trim() || !addedRole) {
      alert("يرجى ملء الحقول الإلزامية للمستخدم");
      return;
    }
    try {
      const res = await apiCall("addUser", token, {
        name: addedUsername.trim(),
        pass: addedPass.trim(),
        role: addedRole,
        email: addedEmail.trim()
      });
      if (res.ok) {
        setAddUserModalOpen(false);
        setAddedUsername("");
        setAddedPass("");
        setAddedEmail("");
        fetchUsersDetail();
        refreshAllData(); // Reload couriers lists
        alert("👥 تم إضافة المستخدم وتفعيله بنجاح");
      } else {
        alert("⚠️ " + res.error);
      }
    } catch (err) {
      alert("فشل قيد المستخدم الجديد");
    }
  }

  async function handleUpdateCourierProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedCourierName) return;

    try {
      const res = await apiCall("updateCourier", token, {
        name: selectedCourierName,
        phone: courierPhone,
        region: courierRegion,
        base_fixed_salary: Number(courierBaseSalary),
        commission_success: Number(courierCommissionSuccess),
        commission_return: Number(courierCommissionReturn),
        hire_date: courierHireDate
      });
      if (res.ok) {
        setCourierEditModalOpen(false);
        refreshAllData();
        alert("✅ تم تعديل وحفظ ثوابت عمولات وراتب المندوب بنجاح");
      } else {
        alert("⚠️ " + res.error);
      }
    } catch (err) {
      alert("عطل أثناء تحديث بيانات المندوب");
    }
  }

  async function toggleUserActivation(row: number, name: string, activeStatus: string, roleVal: string) {
    const nextStatus = activeStatus === "نعم" ? "لا" : "نعم";
    try {
      const res = await apiCall("updateUser", token, {
        row,
        name,
        role: roleVal,
        active: nextStatus,
        perms: ""
      });
      if (res.ok) {
        fetchUsersDetail();
        alert(`✅ تم ${nextStatus === "نعم" ? "تفعيل" : "إيقاف"} حساب المستخدم ${name}`);
      } else {
        alert("⚠️ " + res.error);
      }
    } catch (err) {
       alert("فشل تحديث وضع الحساب الشخصي");
    }
  }

  // Periodical reloading helper
  useEffect(() => {
    if (token) {
      refreshAllData(token, role, username);
      const tid = setInterval(() => refreshAllData(token, role, username), 30000); // refresh every 30s
      return () => clearInterval(tid);
    }
  }, [token, role, username, activeTab]);

  // If token is missing, direct show the Login Portal
  if (!token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // Role permissions definitions
  const cleanRoleState = (role || "").toString().trim();
  const isAgentState = cleanRoleState === "مندوب" || cleanRoleState.includes("مندوب");
  const isSupplierState = cleanRoleState === "مورد" || cleanRoleState.includes("مورد");
  const isReturnsOfficer = cleanRoleState === "مسؤول مرتجعات" || cleanRoleState.includes("مرتجع");
  const showDashTab = role === "مدير" || role === "مشرف";
  const showOpsRoomTab = role === "مدير";
  const showFinanceTabs = role === "مدير" || role === "محاسب";
  const showUsersTab = role === "مدير";
  const showAddInputTab = role === "مدير" || role === "مشرف" || role === "موظف عمليات" || isSupplierState;
  const showSupplierLedgerTab = isSupplierState || role === "مدير" || role === "محاسب";
  const showCourierLedgerTab = isAgentState || role === "مدير" || role === "محاسب";
  const showCouriersProfileTab = role === "مدير" || role === "محاسب" || role === "مشرف";
  const showSuppliersPageTab = role === "مدير" || role === "محاسب" || role === "مشرف";

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#040813] text-[#e2e8f0] relative select-none antialiased">
      {/* Brand Top Header Bar (الهيدر المطور) */}
      <header className="bg-slate-900/95 backdrop-blur-md border-b border-white/6 sticky top-0 z-30 px-4 py-3 flex items-center justify-between shadow-lg">
        {/* User Card */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-yellow-600 text-slate-950 font-black text-sm flex items-center justify-center shadow-md">
            {username[0]}
          </div>
          <div>
            <div className="text-xs font-black text-slate-100">{username}</div>
            <div className="text-[9px] font-bold text-amber-500 uppercase tracking-widest mt-0.5">{role}</div>
          </div>
          {isSupplierState && (
            <div className="mr-3 flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10.5px] font-black">
              <span>صافي المستحقات:</span>
              <span className="font-mono">{(supplierBalance || 0).toLocaleString("ar")} ج.م</span>
            </div>
          )}
          {isBgSyncing && (
            <div className="mr-3 flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-[9.5px] font-black animate-pulse">
              <RefreshCw size={11} className="animate-spin" />
              <span>جاري المزامنة بالخلفية...</span>
            </div>
          )}
        </div>

        {/* Global Action items */}
        <div className="flex gap-2">
          {/* Real-time sync trigger */}
          <button
            onClick={() => refreshAllData()}
            disabled={loadingOrders}
            className="p-2 text-slate-400 hover:text-slate-200 bg-slate-950 rounded-xl border border-white/6 cursor-pointer active:scale-95 transition-all text-xs flex items-center gap-1 font-bold"
          >
            <RefreshCw size={14} className={loadingOrders ? "animate-spin" : ""} />
            <span>تحديث</span>
          </button>

          {/* Master Logout cleanly redirecting */}
          <button
            onClick={handleLogout}
            className="p-2 text-red-400 hover:text-red-300 bg-slate-950 rounded-xl border border-red-950/20 cursor-pointer active:scale-95 transition-all text-xs font-bold"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      {/* Dynamic Summary Micro indicators counters */}
      {!isReturnsOfficer ? (
        <div className="grid grid-cols-2 md:grid-cols-6 border-b border-white/6 bg-slate-950 text-center text-xs py-2 md:h-14 items-center gap-y-2 md:gap-y-0">
          <div className="border-l border-white/4 space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-amber-500 font-mono">{quickTotal}</div>
            <div className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">
              {isSupplierState || isAgentState ? "إجمالي الطلبات" : "إجمالي الطلبات النشطة"}
            </div>
          </div>
          <div className="border-0 md:border-l border-white/4 space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-emerald-400 font-mono">{quickDelivered}</div>
            <div className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">
              {isSupplierState ? "تم التسليم" : "تم التسليم اليوم"}
            </div>
          </div>
          <div className="border-l border-white/4 space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-red-500 font-mono">{quickReturned}</div>
            <div className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">
              {isSupplierState ? "المرتجع" : "المرتجع النشط بالمستودع"}
            </div>
          </div>
          <div className="border-0 md:border-l border-white/4 space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-blue-400 font-mono">{quickActive}</div>
            <div className="text-[8px] font-extrabold text-slate-500 uppercase tracking-wider">
              {isSupplierState ? "قيد التنفيذ" : "قيد التنفيذ ميدانياً"}
            </div>
          </div>
          <div className="border-l border-white/4 space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-emerald-500 font-mono">{(quickTotalCOD || 0).toLocaleString("ar")} ج.م</div>
            <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest font-black leading-none py-0.5">
              {isSupplierState ? "التحصيل المتراكم" : "التحصيل المتراكم بالخزنة"}
            </div>
          </div>
          <div className="space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-amber-400 font-mono">{(quickTodayCOD || 0).toLocaleString("ar")} ج.م</div>
            <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest font-black leading-none py-0.5">
              {isSupplierState ? "تحصيل اليوم" : "تحصيل اليوم (حقيبة المناديب)"}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 border-b border-white/6 bg-slate-950 text-center text-xs py-2 md:h-14 items-center animate-fade-in">
          <div className="space-y-0.5 pointer-events-none">
            <div className="text-sm font-black text-red-500 font-mono">{quickReturned}</div>
            <div className="text-[8px] font-extrabold text-slate-400 uppercase tracking-widest font-black leading-none py-0.5">أوردرات قيد تصنيف المرتجعات الحالية</div>
          </div>
        </div>
      )}

      {/* Responsive Mobile Tab Selector & Desktop Tab Row */}
      <div className="block md:hidden bg-slate-900 border-b border-white/6 px-4 py-3">
        <label className="block text-[10px] font-black text-slate-400 mb-1">تصفح لوحة التحكم</label>
        <div className="relative">
          <select
            value={activeTab}
            onChange={(e) => setActiveTab(e.target.value)}
            className="w-full bg-slate-950 border border-white/10 rounded-xl px-4 py-3 text-xs font-black text-amber-500 outline-none appearance-none"
          >
            <option value="orders">🚛 الشحنات</option>
            {showDashTab && <option value="dash">📊 لوحة التحكم</option>}
            {showOpsRoomTab && <option value="ops_room">⚡ غرفة العمليات وجدول المناديب اللحظي</option>}
            {showAddInputTab && <option value="inputs">➕ إضافة أوردرات</option>}
            {showSupplierLedgerTab && <option value="supplier_ledger">📖 كشف حساب الموردين</option>}
            {showCourierLedgerTab && <option value="courier_ledger">📖 كشف حساب المناديب</option>}
            {showFinanceTabs && (
              <>
                <option value="cash">💵 الخزنة</option>
                <option value="exp">💸 المصروفات</option>
                <option value="closing">🗓️ التقفيل اليومي</option>
                <option value="audit">📜 سجلات التدقيق والأمان</option>
              </>
            )}
            {showUsersTab && <option value="users">👥 إدارة الصلاحيات</option>}
            {showCouriersProfileTab && <option value="couriers_profile">⚙️ ملفات المناديب المالّية</option>}
            {showSuppliersPageTab && <option value="suppliers">👥 كشف حساب وإدارة الموردين</option>}
            <option value="archive">🗄️ الأرشيف المركزي</option>
          </select>
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400 text-xs">
            ▼
          </div>
        </div>
      </div>

      {/* Tabs navigation row bar (Desktop only) */}
      <nav className="hidden md:flex bg-slate-900 border-b border-white/6 overflow-x-auto scrollbar-none scroll-smooth">
        <button
          onClick={() => setActiveTab("orders")}
          className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "orders" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <Truck size={14} />
          <span>الشحنات</span>
        </button>

        {showDashTab && (
          <button
            onClick={() => setActiveTab("dash")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "dash" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
          >
            <LayoutDashboard size={14} />
            <span>لوحة التحكم</span>
          </button>
        )}

        {showOpsRoomTab && (
          <button
            onClick={() => setActiveTab("ops_room")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "ops_room" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
          >
            <Activity size={14} />
            <span>غرفة العمليات وجدول المناديب اللحظي</span>
          </button>
        )}

        {showAddInputTab && (
          <button
            onClick={() => setActiveTab("inputs")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "inputs" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <PlusCircle size={14} />
            <span>إضافة أوردرات</span>
          </button>
        )}

        {showSupplierLedgerTab && (
          <button
            onClick={() => setActiveTab("supplier_ledger")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "supplier_ledger" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <BookOpen size={14} />
            <span>كشف حساب الموردين</span>
          </button>
        )}

        {showCourierLedgerTab && (
          <button
            onClick={() => setActiveTab("courier_ledger")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "courier_ledger" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <BookOpen size={14} />
            <span>كشف حساب المناديب</span>
          </button>
        )}

        {showFinanceTabs && (
          <>
            <button
              onClick={() => setActiveTab("cash")}
              className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "cash" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <Wallet size={14} />
              <span>الخزنة</span>
            </button>

            <button
              onClick={() => setActiveTab("exp")}
              className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "exp" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <FileText size={14} />
              <span>المصروفات</span>
            </button>

            <button
              onClick={() => setActiveTab("closing")}
              className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "closing" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <Calendar size={14} />
              <span>التقفيل اليومي</span>
            </button>

            <button
              onClick={() => setActiveTab("audit")}
              className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
                activeTab === "audit" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              <History size={14} />
              <span>سجلات التدقيق والأمان</span>
            </button>
          </>
        )}

        {showUsersTab && (
          <button
            onClick={() => setActiveTab("users")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "users" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Users size={14} />
            <span>إدارة الصلاحيات</span>
          </button>
        )}

        {showCouriersProfileTab && (
          <button
            onClick={() => setActiveTab("couriers_profile")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "couriers_profile" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Settings size={14} />
            <span>ملفات المناديب المالّية</span>
          </button>
        )}

        {showSuppliersPageTab && (
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "suppliers" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            <Users size={14} />
            <span>كشف حساب وإدارة الموردين</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("archive")}
          className={`px-5 py-4 text-xs font-black cursor-pointer transition-all border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            activeTab === "archive" ? "text-amber-500 border-amber-500" : "text-slate-400 border-transparent hover:text-slate-200"
          }`}
        >
          <span>🗄️</span>
          <span>الأرشيف المركزي</span>
        </button>
      </nav>

      {/* Main Pages router contents switcher */}
      <main className={`flex-1 pb-12 overflow-y-auto ${activeTab === "orders" ? "lg:overflow-hidden lg:pb-0" : ""}`}>
        {activeTab === "orders" && (
          <Orders
            token={token}
            role={role}
            username={username}
            orders={orders}
            setOrders={setOrders}
            couriers={couriers}
            onRefresh={() => refreshAllData()}
          />
        )}

        {activeTab === "dash" && (
          <Dashboard
            token={token}
            role={role}
            username={username}
            orders={orders}
            setOrders={setOrders}
            onRefresh={() => refreshAllData()}
            setActiveTab={setActiveTab}
          />
        )}

        {activeTab === "ops_room" && showOpsRoomTab && (
          <OpsRoom
            token={token}
            role={role}
            username={username}
            orders={orders}
            couriers={couriers}
            onRefresh={() => refreshAllData()}
          />
        )}

        {activeTab === "inputs" && (
          <Inputs
            token={token}
            role={role}
            user={username}
            onSuccess={() => {
              setActiveTab("orders");
              refreshAllData();
            }}
          />
        )}

        {activeTab === "supplier_ledger" && showSupplierLedgerTab && (
          <Ledger token={token} role={role} user={username} activeLedgerMode="supplier" orders={orders} />
        )}

        {activeTab === "courier_ledger" && showCourierLedgerTab && (
          <Ledger token={token} role={role} user={username} activeLedgerMode="courier" orders={orders} />
        )}

        {/* --- CASHBOX INTEGRATION (Only visible to accountant & admin per rules) --- */}
        {activeTab === "cash" && showFinanceTabs && (
          <div className="p-4 space-y-6 text-right">
            {/* Dual Grid block representing Cashbox + Backlog Street Custody */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
              {/* Cash Live Balance display */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-white/6 p-6 rounded-2xl text-center space-y-1 relative overflow-hidden">
                <div className="absolute top-2 left-2 text-emerald-500/10">
                  <Wallet size={64} />
                </div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest block text-center">
                  رصيد الخزنة الحالي المتوفر (ج.م)
                </div>
                <div className="text-3xl font-black text-emerald-400 block text-center">
                  {(cashboxBalance || 0).toLocaleString("ar")}{" "}
                  <span className="text-xs font-medium">ج.م</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-bold block text-center">
                   يشمل التحصيل اليومي المسدد من المندوبين مطروحاً منه مدفوعات الموردين والمصاريف.
                </p>
              </div>

              {/* Crucial Backlog Widget: "الباقي للتشغيل" */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 border border-amber-500/30 p-6 rounded-2xl text-center space-y-1 relative overflow-hidden">
                <div className="absolute top-2 left-2 text-amber-500/10">
                  <Truck size={64} />
                </div>
                <div className="text-xs font-black text-slate-400 uppercase tracking-widest block text-center">
                  كاش الشارع العالق "الباقي للتشغيل" 🚚
                </div>
                <div className="text-3xl font-black text-amber-500 block text-center">
                  {(runningStreetCash || 0).toLocaleString("ar")}{" "}
                  <span className="text-xs font-medium">ج.م</span>
                </div>
                <p className="text-[10px] text-slate-500 leading-relaxed font-bold block text-center">
                   إجمالي قيمة الأوردرات الموزعة مع المندوبين (مسند أو خارج للتسليم) الجاري توصيلها حالياً بالميدان.
                </p>
              </div>
            </div>

            {/* Admin triggers buttons to insert transaction */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setCashType("وارد");
                  setCashModalOpen(true);
                }}
                className="flex-1 py-3 bg-emerald-600 active:scale-98 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
              >
                💚 إيداع بالخزينة
              </button>
              <button
                onClick={() => {
                  setCashType("صادر");
                  setCashModalOpen(true);
                }}
                className="flex-1 py-3 bg-red-650 text-slate-200 font-black text-xs rounded-xl cursor-pointer"
              >
                🔴 سحب من الخزينة
              </button>
            </div>

            {/* Timelines of Treasury Logs */}
            <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-white/6 pb-2">
                <h3 className="text-xs font-black text-slate-400">
                   سجل حركات الخزينة بالتفصيل
                </h3>
                {cashboxEntries.length > 0 && (
                  <button
                    onClick={exportCashboxToCSV}
                    className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-slate-950 font-black text-[10px] rounded-xl flex items-center gap-1.5 cursor-pointer transition-all whitespace-nowrap"
                    title="تصدير سجل الخزينة بصيغة CSV"
                  >
                    <Download size={12} />
                    تصدير كـ CSV
                  </button>
                )}
              </div>
              {cashboxEntries.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">لا توجد قيود بالخزنة للوقت الحالي</div>
              ) : (
                <div className="space-y-2.5">
                  {cashboxEntries.map((e, idx) => {
                    const isCredit = ["وارد", "تحصيل مندوب"].includes(e.type);
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 p-4 border border-white/4 rounded-xl flex items-center justify-between hover:bg-slate-950/70"
                      >
                        <div>
                          <div className="text-xs font-bold text-slate-200">{e.desc || e.type}</div>
                          <div className="text-[9px] text-slate-550 mt-1 font-semibold">
                            {e.date} {e.ref ? `· مرجع: ${e.ref}` : ""} · بواسطة {e.addedBy}
                          </div>
                        </div>
                        <div className="text-left font-mono space-y-1">
                        <div className={`text-xs font-black ${isCredit ? "text-emerald-400" : "text-red-400"}`}>
                          {isCredit ? "+" : "-"}
                          {(e.amount || 0).toLocaleString("ar")} ج.م
                        </div>
                        <div className="text-[9px] text-slate-500 font-bold">
                          رصيد: {e.balance ? (e.balance).toLocaleString("ar") : "0"} ج
                        </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- EXPENSES TAB (Only Accountant & Admin) --- */}
        {activeTab === "exp" && showFinanceTabs && (
          <div className="p-4 space-y-6 text-right">
            {/* Expense Balance summary card */}
            <div className="bg-slate-900 border border-white/6 p-6 rounded-2xl text-center space-y-1 relative overflow-hidden">
              <div className="absolute top-2 left-2 text-red-500/10">
                <FileText size={64} />
              </div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-widest">
                إجمالي المصروفات المدفوعة (ج.م)
              </div>
              <div className="text-4xl font-black text-red-400">
                {(expenses.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0) || expensesTotal || 0).toLocaleString("ar")}{" "}
                <span className="text-sm font-medium">جنيهاً</span>
              </div>
              <button
                onClick={() => setExpModalOpen(true)}
                className="mt-3 inline-block px-5 py-2.5 bg-red-650 hover:bg-red-700 text-slate-200 text-xs font-black rounded-lg cursor-pointer"
              >
                💸 إضافة وتسجيل مصروف جديد
              </button>
            </div>

            {/* List of expenses timeline */}
            <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4">
              <h3 className="text-xs font-black text-slate-400 border-b border-white/6 pb-2">
                سجل المصروفات وموازنات التشغيل
              </h3>

              {expenses.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-500">لا توجد مصروفات مسجلة حالياً</div>
              ) : (
                <div className="space-y-2.5">
                  {expenses.map((e, idx) => (
                    <div
                      key={idx}
                      className="bg-slate-950 p-4 border border-white/4 rounded-xl flex items-center justify-between hover:bg-slate-950/70"
                    >
                      <div>
                        <div className="text-xs font-bold text-slate-200">{e.desc || e.cat}</div>
                        <div className="text-[9px] text-slate-500 mt-1 font-semibold">
                          {e.date} · الفئة: <span className="underline">{e.cat}</span> · صرفه: {e.by}
                        </div>
                      </div>
                      <div className="text-xs font-black font-mono text-red-400">
                        -{(e.amount || 0).toLocaleString("ar")} ج.م
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- DAILY CLOSING REPORT TAB (Only Accountant & Admin) --- */}
        {activeTab === "closing" && showFinanceTabs && (
          <DailyClosing token={token} role={role} user={username} orders={orders} />
        )}

        {/* --- USERS MANAGEMENT TAB (Odoo-Style RBAC & Hierarchy) --- */}
        {activeTab === "users" && showUsersTab && (
          <StaffPermissions
            token={token}
            role={role}
            username={username}
            onRefreshAll={() => refreshAllData()}
          />
        )}

        {/* --- COURIERS FINANCIAL PROFILES TAB (Admin/Accountant/Supervisor only) --- */}
        {activeTab === "couriers_profile" && showCouriersProfileTab && (
          <div className="p-4 space-y-6 text-right">
            <div className="flex items-center justify-between bg-slate-900 border border-white/6 p-4 rounded-xl">
              <div>
                <h3 className="text-xs font-black text-slate-100">📋 الملفات المالية وبيانات مناديب الشحن</h3>
                <p className="text-[10px] text-slate-500 mt-1">
                  تحديد الراتب الأساسي والعمولات الشهرية للمناديب لضمان الاحتساب الآلي في سجل التقفيل وكشف الرواتب.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {couriers.length === 0 ? (
                <div className="col-span-full text-center py-12 text-xs text-slate-500 bg-slate-900 border border-white/6 rounded-2xl animate-pulse">
                  جاري تحميل ملفات المناديب... للتسجيل يرجى تفعيل حساب لمندوب أولاً.
                </div>
              ) : (
                couriers.map((c: any) => {
                  const bSalary = c.base_fixed_salary !== undefined ? Number(c.base_fixed_salary) : Number(c.salary || 3000);
                  const commSuccess = c.commission_success !== undefined ? Number(c.commission_success) : Number(c.commission || 25);
                  const commReturn = c.commission_return !== undefined ? Number(c.commission_return) : 10;

                  return (
                    <div
                      key={c.name}
                      className="bg-slate-900 border border-white/6 rounded-2xl p-5 hover:border-amber-500/40 transition-all flex flex-col justify-between"
                      id={`courier-card-${c.name}`}
                    >
                      <div className="space-y-4">
                        <div className="flex justify-between items-start border-b border-white/6 pb-3">
                          <span className="text-[10px] font-bold text-emerald-450 bg-emerald-950/30 border border-emerald-900/30 px-2 py-0.5 rounded-lg">
                            {c.region || "غير محدد"}
                          </span>
                          <span className="text-xs font-black text-slate-100">{c.name}</span>
                        </div>

                        <div className="space-y-2.5">
                          <div className="flex justify-between text-[11px]">
                            <span className="text-slate-300 font-bold font-mono">{c.phone || "—"}</span>
                            <span className="text-slate-500">: الهاتف</span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-amber-500 font-extrabold font-mono">{bSalary.toLocaleString()} ج.م</span>
                            <span className="text-slate-500">: الراتب الثابت الأساسي</span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-emerald-400 font-extrabold font-mono">{commSuccess.toLocaleString()} ج.م</span>
                            <span className="text-slate-500">: عمولة التسليم الناجح</span>
                          </div>

                          <div className="flex justify-between text-[11px]">
                            <span className="text-red-400 font-extrabold font-mono">{commReturn.toLocaleString()} ج.م</span>
                            <span className="text-slate-550">: عمولة المرتجع العام</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-5 pt-3 border-t border-white/6">
                        <button
                          onClick={() => {
                            setSelectedCourierName(c.name);
                            setCourierPhone(c.phone || "");
                            setCourierRegion(c.region || "");
                            setCourierBaseSalary(bSalary);
                            setCourierCommissionSuccess(commSuccess);
                            setCourierCommissionReturn(commReturn);
                            setCourierHireDate(c.hire_date || "");
                            setCourierEditModalOpen(true);
                          }}
                          className="w-full py-2 bg-slate-950 hover:bg-slate-950/70 border border-white/8 rounded-xl text-[10px] font-black cursor-pointer text-amber-500 hover:text-amber-450 text-center transition-colors flex items-center justify-center gap-1"
                        >
                          <span>⚙️ تعديل الملف المالي للراتب والعمولات</span>
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* --- AUDIT LOG PANEL (Admin/Accountant/Supervisor only per rules) --- */}
        {activeTab === "audit" && showFinanceTabs && (
          <div className="p-4 space-y-6 text-right">
            <div className="flex items-center justify-between bg-slate-900 border border-white/6 p-4 rounded-xl">
              <div>
                <h3 className="text-xs font-black text-slate-100">🔒 سجلات التدقيق المالي ومراقب الأمان المركزي</h3>
                <p className="text-[10px] text-slate-500 mt-1">تتبع التعديلات والعمليات المالية الحرجة لمنع العجز المالي والائتماني.</p>
              </div>
              <button
                onClick={() => loadAuditLogs()}
                className="px-3.5 py-2 bg-slate-800 hover:bg-slate-750 text-slate-205 border border-white/8 font-black text-xs rounded-xl cursor-pointer"
              >
                تحديث السجل
              </button>
            </div>

            <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-3">
              {loadingAudits ? (
                <div className="text-center py-8 text-xs text-slate-500 animate-pulse">جاري تحميل سجلات التدقيق المالي...</div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-xs text-slate-500">
                  لا توجد سجلات تدقيق مالي مسجلة حالياً في النظام
                </div>
              ) : (
                <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
                  {auditLogs.map((log: any, idx: number) => {
                    return (
                      <div
                        key={idx}
                        className="bg-slate-950 border border-white/4 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-slate-950/70"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[10px] font-bold text-rose-405 bg-rose-950/20 px-1.5 py-0.5 rounded border border-rose-900/40">
                              {log.type}
                            </span>
                            <span className="text-xs font-bold text-slate-205">
                              بواسطة: {log.user}
                            </span>
                            <span className="text-[9px] font-mono font-bold text-slate-500">
                              {log.dateTime}
                            </span>
                          </div>
                          
                          <div className="text-xs text-slate-300 leading-relaxed font-bold">
                            العملية: <span className="font-mono text-slate-400">{log.reason}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 self-end md:self-center bg-slate-900 px-3 py-2 rounded-lg border border-white/4">
                          <div className="text-left font-mono text-[10px]">
                            <div className="text-slate-500 line-through">قبل: {log.oldVal}</div>
                            <div className="text-emerald-450 font-bold">بعد: {log.newVal}</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
        {activeTab === "suppliers" && showSuppliersPageTab && (
          <SuppliersManagement token={token} role={role} orders={orders} user={username} />
        )}
        {activeTab === "archive" && (
          <ArchivePortal
            token={token}
            role={role}
            username={username}
            orders={orders}
            onRefresh={() => refreshAllData()}
          />
        )}
      </main>

      {/* --- TREASURY ADDITION DIALOG BOX --- */}
      {cashModalOpen && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isSubmitting ? "pointer-events-none select-none opacity-90" : ""}`}>
          <form onSubmit={submitCashboxLog} className="bg-slate-900 border border-white/8 p-6 rounded-2xl w-full max-w-[380px] text-right space-y-4">
            <h3 className="text-sm font-black text-amber-550 border-b border-white/6 pb-2">
              ➕ إضافة حركة بالخزينة يدويا ({cashType})
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">مبلغ المعاملة بالجنيه المصري*</label>
                <input
                  type="number"
                  required
                  disabled={isSubmitting}
                  value={cashAmount}
                  onChange={(e) => setCashAmount(e.target.value)}
                  placeholder="3000"
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right font-mono disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">البيان / الوصف*</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={cashDesc}
                  onChange={(e) => setCashDesc(e.target.value)}
                  placeholder="قيد تسوية الخزنة..."
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">رقم المرجع (اختياري)</label>
                <input
                  type="text"
                  disabled={isSubmitting}
                  value={cashRef}
                  onChange={(e) => setCashRef(e.target.value)}
                  placeholder="REF-1033..."
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-75 text-slate-950 font-black text-xs rounded-xl cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? "جاري الحفظ..." : "تنفيد القيد المالي"}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setCashModalOpen(false)}
                className="px-4 py-3.5 bg-slate-950 text-slate-500 rounded-xl text-xs font-bold border border-white/6 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                إلغاء لخطأ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- EXPENSE ADDITION DIALOG BOX --- */}
      {expModalOpen && (
        <div className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${isSubmitting ? "pointer-events-none select-none opacity-90" : ""}`}>
          <form onSubmit={submitExpenseLog} className="bg-slate-900 border border-white/8 p-6 rounded-2xl w-full max-w-[380px] text-right space-y-4">
            <h3 className="text-sm font-black text-red-400 border-b border-white/6 pb-2">
              💸 تسجيل بند صرف ومصروف تشغيل رئيسي
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">فئة الصرف والترصيد</label>
                <select
                  value={expCat}
                  disabled={isSubmitting}
                  onChange={(e) => setExpCat(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-right disabled:opacity-50"
                >
                  <option value="مرتبات">مرتبات</option>
                  <option value="بنزين">بنزين وصيانة شاحنات</option>
                  <option value="إيجار">إيجار مخازن ومقرات</option>
                  <option value="إنترنت">إنترنت واتصالات</option>
                  <option value="تشغيل">مصاريف تشغيل ومطبوعات</option>
                  <option value="أخرى">أخرى</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">مبلغ المصروف بالجنيه*</label>
                <input
                  type="number"
                  required
                  disabled={isSubmitting}
                  value={expAmount}
                  onChange={(e) => setExpAmount(e.target.value)}
                  placeholder="250"
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right font-mono disabled:opacity-50"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">البيان / الوصف*</label>
                <input
                  type="text"
                  required
                  disabled={isSubmitting}
                  value={expDesc}
                  onChange={(e) => setExpDesc(e.target.value)}
                  placeholder="بنزين ووقود خط القاهرة سموحة..."
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right disabled:opacity-50"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 bg-red-650 hover:bg-red-700 disabled:bg-red-800 disabled:opacity-75 text-slate-200 font-black text-xs rounded-xl cursor-pointer disabled:cursor-not-allowed"
              >
                {isSubmitting ? "جاري الحفظ..." : "قيد المصروف الآن"}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setExpModalOpen(false)}
                className="px-4 py-3.5 bg-slate-950 text-slate-500 rounded-xl text-xs font-bold border border-white/6 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                إلغاء لخطأ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- ADD USER MODAL (Admin only) --- */}
      {addUserModalOpen && showUsersTab && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleAddUserProfile} className="bg-slate-900 border border-white/8 p-6 rounded-2xl w-full max-w-[400px] text-right space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-amber-550 border-b border-white/6 pb-2">
               👥 تسجيل وإدراج مستخدم جديد بالنظام
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-450 font-bold">اسم المستخدم (الاسم فريد بدون تكرار)*</label>
                <input
                  type="text"
                  required
                  value={addedUsername}
                  onChange={(e) => setAddedUsername(e.target.value)}
                  placeholder="اسم المستخدم للدخول..."
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-right"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-450 font-bold">الدور الوظيفي*</label>
                  <select
                    value={addedRole}
                    onChange={(e) => setAddedRole(e.target.value)}
                    className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-right"
                  >
                    <option value="مدير">مدير</option>
                    <option value="مشرف">مشرف</option>
                    <option value="موظف عمليات">موظف عمليات</option>
                    <option value="محاسب">محاسب</option>
                    <option value="مندوب">مندوب توصيل شحن</option>
                    <option value="مورد">مورد تجاري</option>
                    <option value="مسؤول مرتجعات">مسؤول مرتجعات</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-450 font-bold">الباسورد*</label>
                  <input
                    type="text"
                    required
                    value={addedPass}
                    onChange={(e) => setAddedPass(e.target.value)}
                    placeholder="كلمة المرور..."
                    className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-right"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-450 font-bold">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={addedEmail}
                  onChange={(e) => setAddedEmail(e.target.value)}
                  placeholder="asfive@yourmail.com"
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2.5 text-xs text-right"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
              >
                تفعيل المستخدم وإضافته
              </button>
              <button
                type="button"
                onClick={() => setAddUserModalOpen(false)}
                className="px-4 py-3.5 bg-slate-950 text-slate-400 rounded-xl text-xs font-bold border border-white/6 cursor-pointer"
              >
                إلغاء لخطأ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- COURIER FINANCE & SETTINGS EDIT MODAL (Admin/Authorized only) --- */}
      {courierEditModalOpen && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleUpdateCourierProfile} className="bg-slate-900 border border-white/8 p-6 rounded-2xl w-full max-w-[420px] text-right space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-amber-500 border-b border-white/6 pb-2 flex items-center gap-1.5 justify-end">
              <span>⚙️ تعديل الملف المالي وثوابت المندوب</span>
            </h3>

            <div className="bg-slate-950/40 p-3 rounded-lg border border-white/4">
              <div className="text-[10px] text-slate-400 font-bold">المندوب المختار:</div>
              <div className="text-xs font-black text-slate-100 mt-0.5">{selectedCourierName}</div>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-450 font-bold">الهاتف</label>
                  <input
                    type="text"
                    value={courierPhone}
                    onChange={(e) => setCourierPhone(e.target.value)}
                    placeholder="رقم الهاتف..."
                    className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[10px] text-slate-450 font-bold">منطقة التغطية</label>
                  <input
                    type="text"
                    value={courierRegion}
                    onChange={(e) => setCourierRegion(e.target.value)}
                    placeholder="الإسكندرية، طنطا..."
                    className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-amber-550 font-extrabold">الراتب الشهري الأساسي الثابت (ج.م)*</label>
                <input
                  type="number"
                  required
                  min="0"
                  value={courierBaseSalary}
                  onChange={(e) => setCourierBaseSalary(Number(e.target.value))}
                  placeholder="مثال: 4000..."
                  className="w-full bg-slate-950 text-slate-200 border border-amber-900/40 rounded-lg px-3 py-2 text-xs text-right font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-450 font-bold">تاريخ بدء المحاسبة / التعيين</label>
                <input
                  type="date"
                  value={courierHireDate}
                  onChange={(e) => setCourierHireDate(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-center font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[9px] text-slate-450 font-bold">عمولة التسليم الناجح (ج.م)*</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={courierCommissionSuccess}
                    onChange={(e) => setCourierCommissionSuccess(Number(e.target.value))}
                    placeholder="25"
                    className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right font-mono"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[9px] text-slate-450 font-bold">عمولة المرتجع العام (ج.م)*</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={courierCommissionReturn}
                    onChange={(e) => setCourierCommissionReturn(Number(e.target.value))}
                    placeholder="10"
                    className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
              >
                تحديث وحفظ الثوابت بالسيستم
              </button>
              <button
                type="button"
                onClick={() => setCourierEditModalOpen(false)}
                className="px-4 py-3 bg-slate-950 text-slate-400 rounded-xl text-xs font-bold border border-white/6 cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* 🔔 Toast notifications portal layout and system */}
      {role === "مدير" && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-3 max-w-md w-[380px] pointer-events-none">
          <AnimatePresence>
            {toasts.map((t) => {
              const isDelivered = t.status === "تم التسليم";
              return (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: 50, scale: 0.9 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 100, scale: 0.95 }}
                  className="pointer-events-auto w-full bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl p-4 shadow-2xl flex items-start gap-3 text-right"
                  style={{ direction: "rtl" }}
                >
                  <div className={`w-9 h-9 rounded-xl shrink-0 flex items-center justify-center font-bold text-xs ${
                    isDelivered 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : "bg-red-500/10 text-red-400 border border-red-500/20"
                  }`}>
                    {isDelivered ? "📦" : "↩"}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-black ${isDelivered ? "text-emerald-400" : "text-red-400"}`}>
                        {isDelivered ? "تم التسليم بنجاح" : "أوردر مرتجع بالكامل"}
                      </span>
                      <span className="text-[8px] font-mono text-amber-500 font-bold">#{t.tracking}</span>
                    </div>

                    <p className="text-xs font-black text-slate-100 leading-relaxed">
                      {isDelivered 
                        ? `قام المندوب (${t.courier}) بتسليم طلب العميل (${t.customer}) بنجاح.` 
                        : `قام المندوب (${t.courier}) بتحديد طلب العميل (${t.customer}) كمرتجع.`}
                    </p>

                    <p className="text-[10px] text-slate-450 leading-relaxed">
                      تم التحديث والمزامنة اللحظية بالخزينة والدفتر المالي.
                    </p>
                  </div>

                  <button
                    onClick={() => setToasts((prev) => prev.filter((item) => item.id !== t.id))}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
