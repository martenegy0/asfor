import React, { useEffect, useState } from "react";
import { 
  TrendingUp, 
  Award, 
  Calendar, 
  Wallet, 
  CheckCircle2, 
  AlertTriangle, 
  Truck, 
  Layers, 
  Search, 
  BarChart3, 
  Package, 
  ShieldCheck, 
  RefreshCw,
  Phone,
  MessageSquare,
  MapPin,
  X,
  Sparkles,
  Check,
  Send,
  AlertCircle,
  Eye,
  Filter,
  DollarSign
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { apiCall, getTodayDateStr, normalizeDateToYMD } from "../utils";

export interface CustodyAlert {
  id: string;
  courierName: string;
  type: "unsettled_cash" | "pending_return" | "delayed_custody" | "pending_delay";
  title: string;
  description: string;
  severity: "high" | "medium" | "low";
  orderCount: number;
  totalValue: number;
  ordersList: any[];
}

export function computeCustodyAlerts(ordersList: any[]): CustodyAlert[] {
  if (!ordersList || !Array.isArray(ordersList)) return [];
  const alertsMap: { [key: string]: CustodyAlert } = {};
  const todayStr = getTodayDateStr();

  ordersList.forEach(o => {
    if (o.isClosed || o.isArchived) return;
    if (!o.courier || o.courier.toString().trim() === "") return;
    const courier = o.courier.toString().trim();
    const statusStr = (o.status || "").toString().trim();

    const isDelivered = statusStr === "تم التسليم" || statusStr === "تم التسليم بنجاح" || statusStr === "تم التسليم (ناجح كاش)";
    const isReturn = ["مرتجع", "مرتجع جديد", "مرفوض", "فشل", "مسترجع", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", "العميل لغى الأوردر / مرتجع"].includes(statusStr);
    const isDelayedOrNoAnswer = ["مؤجل", "Delayed", "مؤجل من المندوب", "مؤجل بناءً على طلب العميل", "لا يوجد رد", "العميل لا يرد", "No Answer", "العميل لم يقم بالرد"].includes(statusStr);
    const isActiveDelivery = ["مع المندوب", "خارج للتسليم", "خارج مع المندوب", "تم الإسناد"].includes(statusStr);

    const isSettledValue = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;

    // Check 1: Delivered but NOT settled in cashbox/ledger (Unreconciled Cash Alert)
    if (isDelivered && !isSettledValue) {
      const alertKey = `${courier}-unsettled_cash`;
      const codAmount = Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
      if (!alertsMap[alertKey]) {
        alertsMap[alertKey] = {
          id: alertKey,
          courierName: courier,
          type: "unsettled_cash",
          title: `كاش تسليمات معلق مع المندوب`,
          description: `المندوب لديه شحنات تم تسليمها بنجاح للعملاء، ولكن لم يُورد الكاش الخاص بها للخزنة رسمياً بعد.`,
          severity: "high",
          orderCount: 0,
          totalValue: 0,
          ordersList: []
        };
      }
      alertsMap[alertKey].orderCount++;
      alertsMap[alertKey].totalValue += codAmount;
      alertsMap[alertKey].ordersList.push(o);
    }

    // Check 2: Returned but NOT checked in (Pending Return Stock Alert)
    if (isReturn && !isSettledValue) {
      // Returned statuses are changed to "مرتجع بالمستودع" once settled/received physically.
      // If the status is still raw "مرتجع", the physical package hasn't been scanned/received at the office yet.
      const alertKey = `${courier}-pending_return`;
      const prodAmount = Number(o.prodPrice || 0);
      if (!alertsMap[alertKey]) {
        alertsMap[alertKey] = {
          id: alertKey,
          courierName: courier,
          type: "pending_return",
          title: `بضائع مرتجعة معلقة بالميدان`,
          description: `سجل المندوب شحنات كمرتجع، ولكن لم يتم تسليم الطرود وجردها بالمكتب لتبرئة ذمته اللوجستية.`,
          severity: "high",
          orderCount: 0,
          totalValue: 0,
          ordersList: []
        };
      }
      alertsMap[alertKey].orderCount++;
      alertsMap[alertKey].totalValue += prodAmount;
      alertsMap[alertKey].ordersList.push(o);
    }

    // Check 3: Delayed/No Answer but NOT checked in (Pending Delay Verification Alert)
    if (isDelayedOrNoAnswer && !isSettledValue) {
      // Delayed/No Answer are converted to "... بالمستودع" when checked-in/settled in the office.
      const alertKey = `${courier}-pending_delay`;
      const codAmount = Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
      if (!alertsMap[alertKey]) {
        alertsMap[alertKey] = {
          id: alertKey,
          courierName: courier,
          type: "pending_delay",
          title: `شحنات مؤجلة/عدم رد معلقة`,
          description: `سجل المندوب تأجيل أو عدم رد العميل، ولم يتم إرجاع الطرود للفرع لتحديث حالتها أو إعادة جدولتها.`,
          severity: "medium",
          orderCount: 0,
          totalValue: 0,
          ordersList: []
        };
      }
      alertsMap[alertKey].orderCount++;
      alertsMap[alertKey].totalValue += codAmount;
      alertsMap[alertKey].ordersList.push(o);
    }

    // Check 4: Dispatched for more than 24h without any update (Delayed Custody)
    if (isActiveDelivery) {
      const oDate = o.orderDate || o.createdAt || "";
      const isYesterdayOrOlder = oDate && oDate.substring(0, 10) !== todayStr;
      if (isYesterdayOrOlder) {
        const alertKey = `${courier}-delayed_custody`;
        const codAmount = Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
        if (!alertsMap[alertKey]) {
          alertsMap[alertKey] = {
            id: alertKey,
            courierName: courier,
            type: "delayed_custody",
            title: `شحنات خارجة بالشارع تجاوزت 24 ساعة`,
            description: `شحنات معلقة بالشارع مع المندوب للتسليم ولم تسوّ حالتها (تسليم/ارتجاع/تأجيل) لأكثر من يوم كامل.`,
            severity: "medium",
            orderCount: 0,
            totalValue: 0,
            ordersList: []
          };
        }
        alertsMap[alertKey].orderCount++;
        alertsMap[alertKey].totalValue += codAmount;
        alertsMap[alertKey].ordersList.push(o);
      }
    }
  });

  return Object.values(alertsMap).sort((a, b) => {
    const sevOrder = { high: 0, medium: 1, low: 2 };
    if (sevOrder[a.severity] !== sevOrder[b.severity]) {
      return sevOrder[a.severity] - sevOrder[b.severity];
    }
    return b.totalValue - a.totalValue;
  });
}

interface DashboardProps {
  token: string;
  role?: string;
  username?: string;
  orders?: any[];
  setOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  onRefresh?: () => void;
  setActiveTab?: (tab: string) => void;
}

export default function Dashboard({ 
  token, 
  role, 
  username, 
  orders, 
  setOrders, 
  onRefresh, 
  setActiveTab 
}: DashboardProps) {
  const [stats, setStats] = useState<any>(null);
  const [couriers, setCouriers] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [bestCourier, setBestCourier] = useState("—");
  const [bestSupplier, setBestSupplier] = useState("—");
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState("");
  const [allOrders, setAllOrders] = useState<any[]>([]);
  const [dashboardSubTab, setDashboardSubTab] = useState<"daily" | "owner">("daily");

  const [settling, setSettling] = useState(false);
  const [settleSuccess, setSettleSuccess] = useState(false);

  // Drilldown Modal Statuses
  const [activeDrilldown, setActiveDrilldown] = useState<"street" | "warehouse" | "active_operational" | "supplier_returns" | "pending_return_settlement" | null>(null);
  const [selectedCourierBag, setSelectedCourierBag] = useState<string | null>(null);

  // Fast Coordination Panel Statuses
  const [coordinatingOrder, setCoordinatingOrder] = useState<any | null>(null);
  const [coordinationStatus, setCoordinationStatus] = useState<string>("العميل رد وجاري التسليم");
  const [coordinationNotes, setCoordinationNotes] = useState<string>("");
  const [savingCoordination, setSavingCoordination] = useState<boolean>(false);
  const [coordinationSuccessMsg, setCoordinationSuccessMsg] = useState<string>("");

  // Search inside modals
  const [modalSearch, setModalSearch] = useState("");

  // expanded alert row ID
  const [expandedAlertId, setExpandedAlertId] = useState<string | null>(null);

  const custodyAlerts = React.useMemo(() => computeCustodyAlerts(allOrders), [allOrders]);

  async function loadData() {
    setLoading(true);
    setErrorMsg("");
    try {
      let serverOrders: any[] = [];
      if (orders && orders.length > 0) {
        serverOrders = orders;
      } else {
        try {
          const resOrd = await apiCall("getOrders", token);
          if (resOrd && resOrd.ok && Array.isArray(resOrd.orders)) {
            serverOrders = resOrd.orders;
          }
        } catch (err) {
          console.warn("Could not load server orders to compute dashboard stats", err);
        }
      }

      setAllOrders(serverOrders);
      const todayStr = getTodayDateStr();

      // Precision Client-Side metrics
      let dStats = {
        total: 0,
        todayTotal: 0,
        delivered: 0,
        returned: 0,
        returnedDeliveredToSupplier: 0,
        returnedDeliveredToSupplierValue: 0,
        pending: 0,
        active: 0,
        assignedPending: 0,
        totalCOD: 0,
        todayCOD: 0,
        profit: 0,
        remainingStock: 0,
        remainingStockValue: 0,
        marketPendingCount: 0,
        marketPendingValue: 0,
        activeOperationalStockCount: 0,
        activeOperationalStockValue: 0,
        supplierReturnStockCount: 0,
        supplierReturnStockValue: 0,
        pendingReturnSettlementCount: 0,
        pendingReturnSettlementValue: 0
      };

      const courierStats: { [name: string]: { total: number; delivered: number; returned: number; cod: number } } = {};
      const supplierStats: { [name: string]: { total: number; delivered: number; returned: number; pendingStreetCount: number; pendingStreetCOD: number } } = {};

      for (const o of serverOrders) {
        const createdAtDate = o.createdAt || o.orderDate || "";
        const isCreatedToday = createdAtDate.startsWith(todayStr);

        if (isCreatedToday) {
          dStats.todayTotal++; 
        }

        const statusStr = (o.status || "").toString().trim();
        const deliveredToSupplierPatterns = [
          "تم تسليم المرتجع للمورد",
          "تم تسليمه للمورد",
          "مرتجع تم تسليمه للمورد",
          "التسليم للمورد",
          "تم تسليم المرتجع للمورد وتصفية حسابه",
          "تسليم المرتجع للمورد"
        ];
        const isHandedOverToSupplier = deliveredToSupplierPatterns.some(p => statusStr.includes(p));
        const isDelivered = statusStr === "تم التسليم" || statusStr === "تم التسليم بنجاح";

        const isSettled = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;

        const isSettledOffice = isSettled || [
          "مرتجع بالمستودع",
          "مرتجع جزئي بالمستودع",
          "مؤجل بالمستودع",
          "لا يوجد رد بالمستودع",
          "تم تسليم المرتجع للمورد",
          "مرتجع تم تسليمه للمورد",
          "التسليم للمورد",
          "تم تسليم المرتجع للمورد وتصفية حسابه",
          "مؤرشف"
        ].includes(statusStr);

        // 1. المخزون المتبقي الحقيقي للتشغيل بالمكتب (Shelves only: جديد + مؤجل بالمستودع + لا يوجد رد بالمستودع)
        const isRealWarehouseOperationalStock = statusStr === "جديد" || statusStr === "مؤجل بالمستودع" || statusStr === "لا يوجد رد بالمستودع";

        // 2. صافي المرتجعات بالمكتب (Checked-in returned orders only: مرتجع بالمستودع + مرتجع جزئي بالمستودع)
        const isRealWarehouseReturnStock = statusStr === "مرتجع بالمستودع" || statusStr === "مرتجع جزئي بالمستودع" || statusStr === "العميل لغى الأوردر / مرتجع";

        // 3. إجمالي العهدة المعلقة بالخارج (Street custody: assigned courier, but not settled/checked-in yet)
        const isAssignedOnStreet = o.courier && o.courier.toString().trim() !== "" && !isSettledOffice;

        if (isRealWarehouseOperationalStock && !o.isArchived && statusStr !== "مؤرشف" && !o.isClosed && !isSettled) {
          dStats.activeOperationalStockCount++;
          dStats.activeOperationalStockValue += Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
        }

        if (isRealWarehouseReturnStock && !isHandedOverToSupplier && !o.isArchived && statusStr !== "مؤرشف" && !isSettled) {
          dStats.supplierReturnStockCount++;
          dStats.supplierReturnStockValue += Number(o.prodPrice || 0); // product net price
        }

        const isPendingReturnSettlement = ["مرتجع", "مرتجع جديد", "مرفوض", "فشل", "مسترجع", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", "العميل لغى الأوردر / مرتجع"].includes(statusStr) && !isSettled && !o.isArchived && !o.isClosed;
        if (isPendingReturnSettlement) {
          dStats.pendingReturnSettlementCount++;
          dStats.pendingReturnSettlementValue += Number(o.prodPrice || 0);
        }

        if (isAssignedOnStreet && !o.isArchived && statusStr !== "مؤرشف" && !o.isClosed && !isSettled) {
          dStats.assignedPending++;
          (dStats as any).streetCustodyValue = ((dStats as any).streetCustodyValue || 0) + Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
        }

        // Warehouse stock metrics: not delivered to customer AND not returned to supplier/archived
        if (!isDelivered && !isHandedOverToSupplier && statusStr !== "مؤرشف" && !o.isArchived) {
          dStats.remainingStock++;
          dStats.remainingStockValue += (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
        }

        // Backlog (الباقي للتشغيل)
        const isTerminalForBacklog = [
          "تم التسليم",
          "تم التسليم بنجاح",
          "تم تسليم المرتجع للمورد",
          "مرتجع تم تسليمه للمورد",
          "مرتجع بالمستودع",
          "مؤرشف"
        ].includes(statusStr) || o.isArchived || o.isClosed;

        if (!isTerminalForBacklog) {
          dStats.marketPendingCount++;
          dStats.marketPendingValue += Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
        }

        if (o.isClosed) {
          continue;
        }

        dStats.total++;

        const isSomeReturn = ["مرتجع", "مرفوض", "فشل", "مسترجع", "تسليم جزئي", "مرتجع جزئي"].some(p => statusStr.includes(p)) || isHandedOverToSupplier;

        if (isDelivered) {
          dStats.delivered++;
          const codAmount = Number(o.prodPrice || 0) + Number(o.shipPrice || 0);
          dStats.totalCOD += codAmount;
          dStats.profit += Number(o.shipPrice || 0);

          const delDate = o.delivDate || "";
          if (delDate.startsWith(todayStr)) {
            dStats.todayCOD += codAmount;
          }
        } else if (isSomeReturn) {
          if (isHandedOverToSupplier) {
            dStats.returnedDeliveredToSupplier++;
            dStats.returnedDeliveredToSupplierValue += Number(o.prodPrice || 0);
          } else {
            dStats.returned++;
          }
        } else if (["جديد", "تم الإسناد", "مؤجل", "لا يوجد رد", "العميل لم يقم بالرد"].includes(o.status)) {
          dStats.pending++;
        } else if (o.status === "خارج مع المندوب" || o.status === "خارج للتسليم" || o.status === "مع المندوب") {
          dStats.active++;
        }

        const oDateYMD = (o.orderDate || o.createdAt || "").toString().substring(0, 10);
        const isActionToday = oDateYMD === todayStr;

        if (isActionToday) {
          if (o.courier) {
            const cName = o.courier.toString().trim();
            if (cName) {
              if (!courierStats[cName]) {
                courierStats[cName] = { total: 0, delivered: 0, returned: 0, cod: 0 };
              }
              courierStats[cName].total++;
              if (isDelivered) {
                courierStats[cName].delivered++;
                courierStats[cName].cod += (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
              } else if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع والعميل دفع الشحن"].includes(o.status)) {
                courierStats[cName].returned++;
              }
            }
          }
        }

        // -------------------------------------------------------------
        // UNRESTRICTED ALL-TIME SUPPLIER METRICS COMPILATION
        // -------------------------------------------------------------
        if (o.supplier) {
          const sName = o.supplier.toString().trim();
          if (sName) {
            if (!supplierStats[sName]) {
              supplierStats[sName] = { 
                total: 0, 
                delivered: 0, 
                returned: 0, 
                pendingStreetCount: 0, 
                pendingStreetCOD: 0 
              };
            }
            supplierStats[sName].total++;
            if (isDelivered) {
              supplierStats[sName].delivered++;
            } else if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع والعميل دفع الشحن"].includes(statusStr)) {
              supplierStats[sName].returned++;
            }

            // check if active in street custody
            const isSettledValue = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
            const isSomeReturnedTerminal = ["تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع بالمستودع", "مؤرشف"].includes(statusStr);
            const isStreetActive = o.courier && o.courier !== "" && !isDelivered && !isSomeReturnedTerminal && !o.isClosed && !isSettledValue;
            
            if (isStreetActive) {
              supplierStats[sName].pendingStreetCount++;
              const itemCOD = Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
              supplierStats[sName].pendingStreetCOD += itemCOD;
            }
          }
        }
      }

      const formattedCouriers = Object.entries(courierStats).map(([name, cs]: any) => {
        const remaining = Math.max(0, cs.total - cs.delivered - cs.returned);
        const rate = cs.total ? Math.round((cs.delivered / cs.total) * 100) : 0;
        return { name, ...cs, remaining, rate };
      });

      const formattedSuppliers = Object.entries(supplierStats).map(([name, ss]: any) => {
        const rate = ss.total ? Math.round((ss.delivered / ss.total) * 100) : 0;
        return { name, ...ss, rate };
      });

      const bestCourierObj = [...formattedCouriers].sort((a, b) => b.delivered - a.delivered)[0];
      const bestSupplierObj = [...formattedSuppliers].sort((a, b) => b.delivered - a.delivered)[0];
      const rate = dStats.total ? Math.round((dStats.delivered / dStats.total) * 100) : 0;

      setStats({ ...dStats, rate });
      setCouriers(formattedCouriers.sort((a, b) => b.delivered - a.delivered));
      setSuppliers(formattedSuppliers.sort((a, b) => b.delivered - a.delivered));
      setBestCourier(bestCourierObj ? bestCourierObj.name : "—");
      setBestSupplier(bestSupplierObj ? bestSupplierObj.name : "—");

    } catch (err) {
      console.error("Dashboard statistics computation failed", err);
      setErrorMsg("عطل في الاتصال بالخادم، لم يتم جلب التقارير اللحظية");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token, orders]);

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400 text-sm select-none flex flex-col items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 rounded-full border-4 border-amber-500/20 border-t-amber-500 animate-spin mb-4" />
        <p className="font-sans font-black tracking-wider text-xs">جاري جلب وموافاة المؤشرات الميدانية والمالية الحية بقية اليوم...</p>
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="p-8 m-4 bg-red-950/20 border border-red-900/40 text-red-400 rounded-xl text-center text-sm">
        ⚠️ {errorMsg}
        <button onClick={loadData} className="block mx-auto mt-4 px-4 py-2 bg-red-900/45 text-slate-200 text-xs rounded-lg font-bold">
          إعادة المحاولة
        </button>
      </div>
    );
  }

  const s = stats || { total: 0, todayTotal: 0, delivered: 0, returned: 0, pending: 0, active: 0, assignedPending: 0, totalCOD: 0, todayCOD: 0, profit: 0, rate: 0, remainingStock: 0, remainingStockValue: 0, marketPendingCount: 0, marketPendingValue: 0, activeOperationalStockCount: 0, activeOperationalStockValue: 0, supplierReturnStockCount: 0, supplierReturnStockValue: 0 };

  const getRateColor = (r: number) => {
    if (r >= 75) return "text-emerald-400 bg-emerald-950/20 border border-emerald-950/30";
    if (r >= 50) return "text-amber-400 bg-amber-950/20 border border-amber-950/30";
    return "text-red-400 bg-red-950/20 border border-red-955/30";
  };

  const isManagerOrAccountant = (role || "").toString().trim() === "مدير" || 
                                (role || "").toString().trim().includes("مدير") || 
                                (role || "").toString().trim() === "محاسب" || 
                                (role || "").toString().trim().includes("محاسب");

  const todayStr = getTodayDateStr();
  
  // Calculate today's pending settlement orders for vault closing
  const todDelivered = allOrders.filter(o => 
    !o.isClosed && 
    (o.status === "تم التسليم" || o.status === "تم التسليم بنجاح") && 
    o.delivDate && 
    o.delivDate.substring(0, 10) === todayStr
  );
  
  const todReturned = allOrders.filter(o => 
    !o.isClosed && 
    ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"].includes(o.status) && 
    o.retDate && 
    o.retDate.substring(0, 10) === todayStr
  );

  const todayCODVal = todDelivered.reduce((sum, o) => sum + (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)), 0);
  const shippingCostVal = todDelivered.reduce((sum, o) => sum + Number(o.shipPrice || o.shipCost || 25), 0);

  // -------------------------------------------------------------
  // DILIGENT CUSTODY ENGINE (إحصائيات حقيبة الشارع وبطاقات المناديب الفردية)
  // -------------------------------------------------------------
  const streetCustodyCouriers: {[name: string]: {
    name: string;
    totalActive: number;
    delivered: number;
    returned: number;
    delayed: number;
    noAnswer: number;
    cashPending: number;
    ordersList: any[];
    pendingDays: number;
  }} = {};

  allOrders.forEach(o => {
    // Only capture orders actively in street custody (assigned but not yet fully settled or returned to supplier)
    if (o.isClosed || o.isArchived) return;
    if (!o.courier || o.courier.toString().trim() === "") return;
    const cName = o.courier.toString().trim();
    
    if (!streetCustodyCouriers[cName]) {
      streetCustodyCouriers[cName] = {
        name: cName,
        totalActive: 0,
        delivered: 0,
        returned: 0,
        delayed: 0,
        noAnswer: 0,
        cashPending: 0,
        ordersList: [],
        pendingDays: 0
      };
    }

    const stat = (o.status || "").toString().trim();
    const isDelivered = stat === "تم التسليم" || stat === "تم التسليم بنجاح" || stat === "تم التسليم (ناجح كاش)";
    const isReturn = ["مرتجع", "مرفوض", "فشل", "مسترجع"].some(p => stat.includes(p));
    const isDelayed = ["مؤجل", "Delayed", "مؤجل من المندوب", "مؤجل بناءً على طلب العميل"].includes(stat);
    const isNoAnswer = ["لا يوجد رد", "العميل لا يرد", "No Answer", "العميل لم يقم بالرد"].includes(stat);

    streetCustodyCouriers[cName].totalActive++;
    streetCustodyCouriers[cName].ordersList.push(o);

    if (isDelivered) {
      streetCustodyCouriers[cName].delivered++;
      // Live cash in the courier's hand
      streetCustodyCouriers[cName].cashPending += (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
    } else if (isReturn) {
      streetCustodyCouriers[cName].returned++;
    } else if (isDelayed) {
      streetCustodyCouriers[cName].delayed++;
    } else if (isNoAnswer) {
      streetCustodyCouriers[cName].noAnswer++;
    }
  });

  // Calculate pending days for each courier (duration since the oldest active order in custody)
  Object.values(streetCustodyCouriers).forEach(c => {
    let minDateMs = Date.now();
    let hasValidDate = false;
    c.ordersList.forEach(o => {
      const dStr = o.updatedAt || o.date || o.createdAt || o.created;
      if (dStr) {
        const ms = Date.parse(dStr);
        if (!isNaN(ms)) {
          if (ms < minDateMs) {
            minDateMs = ms;
          }
          hasValidDate = true;
        }
      }
    });
    const diffMs = Date.now() - minDateMs;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    c.pendingDays = hasValidDate ? (diffDays < 0 ? 0 : diffDays) : 0;
  });

  const liveCouriersList = Object.values(streetCustodyCouriers).sort((a, b) => b.cashPending - a.cashPending);

  // -------------------------------------------------------------
  // FAST BOTTLENECK FINDER (تجميع المعلقات الفورية لاتخاذ الإجراء)
  // -------------------------------------------------------------
  const bottleneckOrders = allOrders.filter(o => {
    if (o.isClosed || o.isArchived) return false;
    const stat = (o.status || "").toString().trim();
    return [
      "لا يوجد رد", 
      "العميل لا يرد", 
      "No Answer", 
      "العميل لم يقم بالرد", 
      "مؤجل", 
      "Delayed", 
      "مؤجل من المندوب", 
      "مؤجل بناءً على طلب العميل"
    ].includes(stat);
  });

  // Calculate lists for Clickable Cards Drilldown Modals
  // 1. Street Custody Active Orders List: All active orders that are assigned to a courier and not completed
  const streetCustodyOrders = allOrders.filter(o => {
    if (o.isClosed || o.isArchived) return false;
    const stat = (o.status || "").toString().trim();
    const isSettled = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
    const isSettledOffice = isSettled || [
      "مرتجع بالمستودع",
      "مرتجع جزئي بالمستودع",
      "مؤجل بالمستودع",
      "لا يوجد رد بالمستودع",
      "تم تسليم المرتجع للمورد",
      "مرتجع تم تسليمه للمورد",
      "التسليم للمورد",
      "تم تسليم المرتجع للمورد وتصفية حسابه",
      "مؤرشف"
    ].includes(stat);
    return o.courier && o.courier.toString().trim() !== "" && !isSettledOffice;
  });

  // 2. Warehouse Inventory Orders List
  const warehouseOrders = allOrders.filter(o => {
    if (o.isClosed || o.isArchived) return false;
    const stat = (o.status || "").toString().trim();
    // In warehouse if: status is new, delayed back, returned back, or simply unassigned
    const deliveredToSupplierPatterns = [
      "تم تسليم المرتجع للمورد",
      "مرتجع تم تسليمه للمورد",
      "التسليم للمورد",
      "تم تسليم المرتجع للمورد وتصفية حسابه"
    ];
    const isHandedOverToSupplier = deliveredToSupplierPatterns.some(p => stat.includes(p));
    const isDelivered = stat === "تم التسليم" || stat === "تم التسليم بنجاح";

    if (isDelivered || isHandedOverToSupplier) return false;
    
    // Unassigned or returned to warehouse
    return !o.courier || ["جديد", "مرتجع بالمستودع", "مؤجل بالمستودع", "لا يوجد رد بالمستودع", "مرتجع جزئي بالمستودع"].includes(stat);
  });

  // 3. Active Operational Stock Orders List
  const activeOperationalStockOrders = allOrders.filter(o => {
    if (o.isClosed || o.isArchived) return false;
    const isSettled = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
    if (isSettled) return false;
    const stat = (o.status || "").toString().trim();
    return stat === "جديد" || stat === "مؤجل بالمستودع" || stat === "لا يوجد رد بالمستودع";
  });

  // 4. Supplier Return Stock Orders List
  const supplierReturnStockOrders = allOrders.filter(o => {
    if (o.isClosed || o.isArchived) return false;
    const isSettled = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
    if (isSettled) return false;
    const stat = (o.status || "").toString().trim();
    const deliveredToSupplierPatterns = [
      "تم تسليم المرتجع للمورد",
      "مرتجع تم تسليمه للمورد",
      "التسليم للمورد",
      "تم تسليم المرتجع للمورد وتصفية حسابه",
      "تسليم المرتجع للمورد"
    ];
    const isHandedOverToSupplier = deliveredToSupplierPatterns.some(p => stat.includes(p));
    if (isHandedOverToSupplier) return false;
    return stat === "مرتجع بالمستودع" || stat === "مرتجع جزئي بالمستودع";
  });

  // 5. Returned Orders Awaiting Settlement/Liquidation at the office (marked as return by courier but not physically checked-in/settled yet)
  const pendingReturnSettlementOrders = allOrders.filter(o => {
    if (o.isClosed || o.isArchived) return false;
    const isSettled = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
    if (isSettled) return false;
    const stat = (o.status || "").toString().trim();
    const isReturn = ["مرتجع", "مرتجع جديد", "مرفوض", "فشل", "مسترجع", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"].includes(stat);
    return isReturn;
  });

  // -------------------------------------------------------------
  // FAST COORDINATION SUBMITTER (إرسال تحديث الأوردر للخلفية والذاكرة المحلية فوراً)
  // -------------------------------------------------------------
  const handleSaveCoordination = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coordinatingOrder) return;
    setSavingCoordination(true);
    setCoordinationSuccessMsg("");

    const targetTracking = coordinatingOrder.tracking;
    try {
      const payload = {
        tracking: targetTracking,
        status: coordinationStatus,
        notes: coordinationNotes.trim() ? `${coordinationNotes.trim()} [تنسيق عمليات 📞]` : coordinationNotes
      };

      // 1. Optimistic state change for absolute instant speed
      if (setOrders) {
        setOrders(prev => prev.map(o => {
          if (o.tracking === targetTracking) {
            return { 
              ...o, 
              status: coordinationStatus, 
              notes: payload.notes 
            };
          }
          return o;
        }));
      }

      // 2. Also update local scoped component tracking state immediately
      setAllOrders(prev => prev.map(o => {
        if (o.tracking === targetTracking) {
          return { 
            ...o, 
            status: coordinationStatus, 
            notes: payload.notes 
          };
        }
        return o;
      }));

      // 3. Fire asynchronous API write in the background
      apiCall("updateStatus", token, payload)
        .then((res) => {
          if (res && res.ok) {
            console.log("Asynchronous coordination API call succeeded background-sync");
            if (onRefresh) onRefresh();
          } else {
            console.warn("Background-sync returned not ok", res);
          }
        })
        .catch(err => console.error("Coordination sync failed", err));

      setCoordinationSuccessMsg("✓ تم حفظ تعديل الحالة والتنسيق بنجاح وترحيلها للخلفية مجاناً دون انتظار.");
      setTimeout(() => {
        setCoordinatingOrder(null);
        setCoordinationSuccessMsg("");
        setCoordinationNotes("");
      }, 2000);

    } catch (err: any) {
      alert("خطأ أثناء تنسيق الأوردر: " + err.message);
    } finally {
      setSavingCoordination(false);
    }
  };

  const getWhatsAppLink = (phone: string, customerName: string, tracking: string, status: string) => {
    const cleanPhone = phone.toString().trim().replace(/^0+/, "");
    const textMsg = `سلام عليكم يا أستاذ/ة ${customerName}، معاك خدمة عملاء من شركة الشحن بخصوص شحنتك رقم (${tracking}) وحالتها الحالية هي (${status}). حابين ننسق مع حضرتك للتسليم اليوم؟`;
    return `https://api.whatsapp.com/send?phone=20${cleanPhone}&text=${encodeURIComponent(textMsg)}`;
  };

  return (
    <div className="p-4 space-y-6 select-none font-sans text-right" id="dashboard-interactive-root">
      
      {/* Tab Selectors for Admin/Accountant role */}
      {isManagerOrAccountant && (
        <div className="flex border-b border-white/10 gap-2 pb-0 mb-4 font-sans justify-start">
          <button
            id="tab-btn-daily"
            onClick={() => setDashboardSubTab("daily")}
            className={`pb-2 px-4 text-xs font-black cursor-pointer transition-all border-b-2 outline-none ${
              dashboardSubTab === "daily"
                ? "text-amber-500 border-amber-500"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            ⚙️ لوحة التشغيل اليومية الحية وعمليات الميدان
          </button>
          <button
            id="tab-btn-owner"
            onClick={() => setDashboardSubTab("owner")}
            className={`pb-2 px-4 text-xs font-black cursor-pointer transition-all border-b-2 outline-none ${
              dashboardSubTab === "owner"
                ? "text-amber-500 border-amber-500 font-bold"
                : "text-slate-400 border-transparent hover:text-slate-200"
            }`}
          >
            🔒 لوحة المالك والمالية التراكمية (Owner Dashboard)
          </button>
        </div>
      )}

      {/* Owner Navigation Banner */}
      {isManagerOrAccountant && dashboardSubTab === "owner" && (
        <div className="bg-slate-900/80 border border-amber-500/15 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <span className="p-2 bg-amber-500/10 text-amber-500 rounded-xl">
              <ShieldCheck size={18} />
            </span>
            <div>
              <h2 className="text-xs font-black text-slate-100">بوابة تصفية الحساب المركزي وإقفال الخزنة اليومية</h2>
              <p className="text-[10px] text-slate-400 font-bold mt-0.5">يمكنك الآن تسوية حركات اليومية وترحيلها مباشرة من صفحة المكتب المخصص.</p>
            </div>
          </div>
          <button
            id="btn-goto-closing"
            onClick={() => {
              if (setActiveTab) setActiveTab("closing");
            }}
            className="px-4 py-2 bg-amber-500 text-slate-950 hover:bg-amber-450 active:scale-95 text-xs font-black rounded-xl transition-all cursor-pointer shadow-md flex items-center gap-1.5 whitespace-nowrap"
          >
            <span>الذهاب لصفحة تصفية اليومية وإغلاق الخزنة ⚙️</span>
          </button>
        </div>
      )}

      {/* Render Sub Tabs */}
      {(!isManagerOrAccountant || dashboardSubTab === "daily") ? (
        
        /* ⚙️ LIVE INTERACTIVE OPERATIONS DASHBOARD */
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-r-4 border-amber-500 pr-3">
            <div>
              <h3 className="text-sm font-black text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>⚡ غرفه التحكم والتشغيل الميدانية الحية</span>
                <span className="p-1 text-[8px] tracking-widest leading-none bg-emerald-500/10 text-emerald-400 font-black rounded border border-emerald-500/20 uppercase">Live 100% Sync</span>
              </h3>
              <p className="text-[10px] text-slate-400 font-extrabold mt-1">كروت اليوم تفاعلية؛ اضغط على أي كارت للبحث وتصفح الشحنات وإدارة التنسيق الميداني فورياً.</p>
            </div>
            
            <button 
              id="dashboard-force-reload-btn"
              onClick={loadData}
              className="px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-amber-500/30 text-amber-400 hover:text-amber-350 rounded-xl font-black text-[10px] flex items-center gap-1 self-start sm:self-center transition-all shadow-md active:scale-95 cursor-pointer"
            >
              <RefreshCw size={12} className="animate-spin-once" />
              <span>تحديث البيانات اللحظية 🔄</span>
            </button>
          </div>

          {/* CUSTODY RECONCILIATION ALERTS SYSTEM */}
          {isManagerOrAccountant && custodyAlerts.length > 0 && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/60 border border-red-500/20 rounded-2xl p-6 shadow-xl"
              id="custody-reconciliation-alerts-box"
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4 mb-4">
                <div className="flex items-start gap-3">
                  <span className="p-2.5 bg-red-500/10 text-red-400 rounded-xl mt-0.5">
                    <AlertTriangle size={22} className="animate-pulse" />
                  </span>
                  <div>
                    <h3 className="text-xs font-black text-slate-100 flex items-center gap-2">
                      <span>🚨 نظام مطابقة العهد وجرد ذمم المناديب الحية</span>
                      <span className="px-1.5 py-0.5 text-[8px] bg-red-950 text-red-400 font-extrabold rounded-md border border-red-500/10">مراجعة الجرد الليلة</span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-bold mt-1">
                      تم رصد <strong className="text-red-400 font-mono font-black">{custodyAlerts.length}</strong> تعارضات جردية/ذمم مالية معلقة بين العهدة بالخارج والمسجل بالمكتب. يرجى تصفية المناديب وسحب أوردراتهم.
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold font-sans">
                    إجمالي الكاش/البضائع المعلق:
                  </span>
                  <span className="px-2.5 py-1 bg-red-950/40 border border-red-500/20 rounded-xl text-xs font-black font-mono text-red-400">
                    {custodyAlerts.reduce((sum, a) => sum + a.totalValue, 0).toLocaleString("ar")} ج.م
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                {custodyAlerts.map((alert) => {
                  const isExpanded = expandedAlertId === alert.id;
                  const severityColors = {
                    high: "border-red-500/20 bg-red-950/5 text-red-400 hover:bg-red-955/10",
                    medium: "border-amber-500/15 bg-amber-950/5 text-amber-400 hover:bg-amber-955/10",
                    low: "border-blue-500/15 bg-blue-950/5 text-blue-400 hover:bg-blue-955/10"
                  };

                  return (
                    <div 
                      key={alert.id}
                      className={`border rounded-xl transition-all duration-200 overflow-hidden ${severityColors[alert.severity]}`}
                    >
                      <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none">
                        <div 
                          className="flex items-start gap-3 flex-1"
                          onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                        >
                          <span className={`p-1.5 rounded-lg text-xs font-bold leading-none shrink-0 ${
                            alert.severity === "high" ? "bg-red-500/10 text-red-400" : "bg-amber-500/10 text-amber-400"
                          }`}>
                            {alert.severity === "high" ? "🚨 حرج" : "⚠️ تنبيه"}
                          </span>
                          
                          <div>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[11px] font-black text-slate-200 font-sans">
                                المندوب: <strong className="text-amber-400 font-extrabold">{alert.courierName}</strong>
                              </span>
                              <span className="text-slate-500 text-xs select-none">•</span>
                              <span className="text-[10px] font-bold text-slate-300">
                                {alert.title}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-400 font-bold mt-1 leading-relaxed">
                              {alert.description}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                          <div className="text-left">
                            <span className="text-[9px] text-slate-500 block font-bold font-sans">عدد الشحنات</span>
                            <span className="text-xs font-black text-slate-300 font-mono">{alert.orderCount} أوردر</span>
                          </div>
                          <div className="text-left border-l border-white/5 pl-3">
                            <span className="text-[9px] text-slate-500 block font-bold font-sans">
                              {alert.type === "pending_return" ? "قيمة المرتجع" : "كاش الشارع المعلق"}
                            </span>
                            <span className="text-xs font-black font-mono text-emerald-400">{alert.totalValue.toLocaleString("ar")} ج.م</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 pl-1 font-sans">
                            <button
                              onClick={() => {
                                localStorage.setItem("preselected_courier", alert.courierName);
                                if (setActiveTab) setActiveTab("courier_ledger");
                              }}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white rounded-lg text-[9px] font-black flex items-center gap-1 transition-all border border-white/5 shadow cursor-pointer active:scale-95"
                              title="الذهاب لكشف حساب المندوب لتسوية وجرد هذا الحساب فوراً"
                            >
                              <span>تصفية وجرد ⚙️</span>
                            </button>
                            
                            <button
                              onClick={() => setExpandedAlertId(isExpanded ? null : alert.id)}
                              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-all cursor-pointer font-sans"
                            >
                              <span>{isExpanded ? "▲ إخفاء" : "▼ تفاصيل"}</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: "auto" }}
                            exit={{ height: 0 }}
                            className="border-t border-white/5 bg-slate-950/40 overflow-hidden font-sans"
                          >
                            <div className="p-4">
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider mb-2 pr-1 flex items-center justify-between">
                                <span>📋 تفاصيل الشحنات المعلقة بالتعارض ({alert.ordersList.length}):</span>
                                <span className="text-[8px] text-slate-500">مستخرج من قاعدة البيانات الحية للفرع</span>
                              </div>
                              
                              <div className="overflow-x-auto rounded-lg border border-white/5 bg-slate-950/60 max-h-[250px] overflow-y-auto">
                                <table className="w-full text-right text-xs">
                                  <thead>
                                    <tr className="bg-white/5 text-slate-350 font-black border-b border-white/5">
                                      <th className="p-2 text-[9px]">رقم التتبع (Tracking)</th>
                                      <th className="p-2 text-[9px]">العميل والهاتف</th>
                                      <th className="p-2 text-[9px]">المحافظة / العنوان</th>
                                      <th className="p-2 text-[9px] text-center">المستلم / القيمة</th>
                                      <th className="p-2 text-[9px] text-center">حالة الشارع</th>
                                      <th className="p-2 text-[9px] text-center">التحكم الفوري</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-white/5 font-medium">
                                    {alert.ordersList.map((o, idx) => {
                                      const cod = Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
                                      return (
                                        <tr key={idx} className="hover:bg-white/5 transition-all text-slate-300">
                                          <td className="p-2 font-mono text-[10px] text-slate-400">{o.tracking || "—"}</td>
                                          <td className="p-2">
                                            <div className="font-extrabold text-[10px] text-slate-250">{o.customer || "—"}</div>
                                            <div className="text-[8px] font-mono text-slate-500 mt-0.5">{o.phone || "—"}</div>
                                          </td>
                                          <td className="p-2">
                                            <div className="text-[10px] text-slate-350">{o.city || "—"}</div>
                                            <div className="text-[8px] text-slate-500 max-w-[150px] truncate">{o.address || ""}</div>
                                          </td>
                                          <td className="p-2 text-center">
                                            <span className="text-[10px] font-black font-mono text-emerald-400">{cod.toLocaleString("ar")} ج.م</span>
                                          </td>
                                          <td className="p-2 text-center">
                                            <span className={`px-2 py-0.5 text-[8px] font-black rounded-full border ${
                                              o.status === "تم التسليم" ? "bg-emerald-950 text-emerald-400 border-emerald-900" :
                                              ["مرتجع", "مرفوض", "فشل"].some(x => o.status.includes(x)) ? "bg-red-950 text-red-400 border-red-900" :
                                              "bg-amber-950 text-amber-400 border-amber-900"
                                            }`}>
                                              {o.status || "—"}
                                            </span>
                                          </td>
                                          <td className="p-2 text-center">
                                            <button
                                              onClick={() => setCoordinatingOrder(o)}
                                              className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 rounded font-black text-[9px] transition-all cursor-pointer font-sans"
                                            >
                                              تنسيق فوري ⚡
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* Interactive Metric Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            
            {/* Card 1: Today's Orders */}
            <div 
              id="card-today-orders"
              className="bg-slate-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[143px] transition-all"
            >
              <div className="absolute top-2 left-2 text-amber-500/5">
                <Calendar size={52} />
              </div>
              <div className="text-3xl font-black text-amber-400 font-mono">{s.todayTotal}</div>
              <div className="text-[11px] font-black text-slate-300 mt-1 uppercase tracking-wider">تشغيل اليوم (الأوردرات الحالية)</div>
              <p className="text-[10px] text-slate-400 font-bold mt-1">إجمالي الحالات التي سُجلت بالمكتب والشارع اليوم</p>
            </div>

            {/* Card 2a: Active Operational Stock */}
            <div 
              id="card-active-operational-stock"
              onClick={() => {
                setModalSearch("");
                setActiveDrilldown("active_operational");
              }}
              className="bg-slate-900 border border-white/5 hover:border-orange-500/30 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[143px] transition-all cursor-pointer group hover:scale-[1.02] active:scale-95 duration-200 hover:shadow-xl hover:shadow-orange-950/5"
              title="اضغط لتفقد قائمة المخزون التشغيلي وجرده"
            >
              <div className="absolute top-2 left-2 text-orange-500/5 group-hover:text-orange-500/10 transition-colors">
                <Package size={52} />
              </div>
              <div>
                <div className="text-3xl font-black text-orange-500 font-mono flex items-baseline gap-1">
                  <span>{s.activeOperationalStockCount ?? 0}</span> 
                  <span className="text-xs font-bold text-slate-450 text-slate-400">طلب</span>
                </div>
                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wider flex items-center gap-1 font-sans">
                  <span>المخزون التشغيلي للتشغيل</span>
                  <span className="text-[8px] px-1 bg-orange-950 text-orange-400 rounded">افحص 🔍</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center">
                <div className="text-[9px] font-extrabold text-slate-400">القيمة الفورية للبضائع</div>
                <div className="text-xs font-black text-emerald-400 font-mono">{(s.activeOperationalStockValue || 0).toLocaleString("ar")} ج.م</div>
              </div>
            </div>

            {/* Card 2b: Supplier Return Stock */}
            <div 
              id="card-supplier-returns-stock"
              onClick={() => {
                setModalSearch("");
                setActiveDrilldown("supplier_returns");
              }}
              className="bg-slate-900 border border-white/5 hover:border-rose-500/30 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[143px] transition-all cursor-pointer group hover:scale-[1.02] active:scale-95 duration-200 hover:shadow-xl hover:shadow-rose-950/5"
              title="اضغط لتفقد قائمة عهدة المرتجعات بالمكتب"
            >
              <div className="absolute top-2 left-2 text-rose-500/5 group-hover:text-rose-500/10 transition-colors">
                <RefreshCw size={52} className="rotate-12" />
              </div>
              <div>
                <div className="text-3xl font-black text-rose-450 font-mono flex items-baseline gap-1">
                  <span>{s.supplierReturnStockCount ?? 0}</span> 
                  <span className="text-xs font-bold text-slate-450 text-slate-400">طلب</span>
                </div>
                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wider flex items-center gap-1 font-sans">
                  <span>عهدة المرتجعات بالمكتب</span>
                  <span className="text-[8px] px-1 bg-rose-950 text-rose-400 rounded">افحص 🔍</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center">
                <div className="text-[9px] font-extrabold text-slate-400">قيمة المرتجعات الراكدة</div>
                <div className="text-xs font-black text-rose-400 font-mono">{(s.supplierReturnStockValue || 0).toLocaleString("ar")} ج.م</div>
              </div>
            </div>

            {/* Card 3: Active deliveries on street (Clickable!) */}
            <div 
              id="card-street-deliveries"
              onClick={() => {
                setModalSearch("");
                setActiveDrilldown("street");
              }}
              className="bg-slate-900 border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[143px] transition-all cursor-pointer group hover:scale-[1.02] active:scale-95 duration-200 hover:shadow-xl hover:shadow-blue-950/5"
              title="اضغط لتفقد الأوردرات النشطة مع المناديب حالياً"
            >
              <div className="absolute top-2 left-2 text-blue-500/5 group-hover:text-blue-500/10 transition-colors">
                <Truck size={52} className="rotate-6" />
              </div>
              <div>
                <div className="text-3xl font-black text-blue-400 font-mono flex items-baseline gap-1">
                  <span>{s.assignedPending}</span>
                  <span className="text-xs font-bold text-slate-400">طلب</span>
                </div>
                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wider flex items-center gap-1 font-sans">
                  <span>شحنات قيد التوصيل بالشارع حالياً</span>
                  <span className="text-[8px] px-1 bg-blue-950 text-blue-400 rounded">افحص 🔍</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center">
                <div className="text-[9px] font-extrabold text-slate-400">إجمالي العهدة المعلقة بالخارج</div>
                <div className="text-xs font-black text-blue-400 font-mono">{((s as any).streetCustodyValue || 0).toLocaleString("ar")} ج.م</div>
              </div>
            </div>

            {/* Card 4: Backlog / الباقي للتشغيل */}
            <div 
              id="card-market-backlog"
              className="bg-slate-900 border border-white/5 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[143px]"
            >
              <div className="absolute top-2 left-2 text-violet-500/5">
                <RefreshCw size={52} className="text-violet-500/10" />
              </div>
              <div>
                <div className="text-3xl font-black text-violet-400 font-mono">{s.marketPendingCount} <span className="text-xs font-bold text-slate-400">طلب</span></div>
                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wider">المعلقات الكلية النشطة بالسوق</div>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center">
                <div className="text-[9px] font-bold text-slate-400">المبلغ التقديري المتوقع</div>
                <div className="text-xs font-black text-violet-300 font-mono">{(s.marketPendingValue || 0).toLocaleString("ar")} ج.م</div>
              </div>
            </div>

            {/* Card 5: Returned Orders Awaiting Settlement */}
            <div 
              id="card-pending-return-settlement"
              onClick={() => {
                setModalSearch("");
                setActiveDrilldown("pending_return_settlement");
              }}
              className="bg-slate-900 border border-white/5 hover:border-red-500/30 rounded-2xl p-6 relative overflow-hidden flex flex-col justify-between min-h-[143px] transition-all cursor-pointer group hover:scale-[1.02] active:scale-95 duration-200 hover:shadow-xl hover:shadow-red-950/5"
              title="اضغط لتفقد المرتجعات المعلقة مع المناديب وجردها"
            >
              <div className="absolute top-2 left-2 text-red-500/5 group-hover:text-red-500/10 transition-colors">
                <AlertTriangle size={52} className="rotate-12" />
              </div>
              <div>
                <div className="text-3xl font-black text-red-400 font-mono flex items-baseline gap-1">
                  <span>{s.pendingReturnSettlementCount ?? 0}</span> 
                  <span className="text-xs font-bold text-slate-400">طلب</span>
                </div>
                <div className="text-[11px] font-black text-slate-200 mt-1 uppercase tracking-wider flex items-center gap-1 font-sans">
                  <span>مرتجعات بانتظار التصفية في المكتب</span>
                  <span className="text-[8px] px-1 bg-red-950 text-red-400 rounded">افحص 🔍</span>
                </div>
              </div>
              <div className="border-t border-white/5 pt-2 mt-2 flex justify-between items-center">
                <div className="text-[9px] font-extrabold text-slate-400">قيمة المرتجعات المعلقة</div>
                <div className="text-xs font-black text-red-400 font-mono">{(s.pendingReturnSettlementValue || 0).toLocaleString("ar")} ج.م</div>
              </div>
            </div>
          </div>

          {/* SECTION: OPERATIONAL BOTTLENECKS (قسم التدخل السريع والطوارئ) */}
          <div id="section-operational-bottlenecks" className="bg-slate-900/60 border border-red-500/10 rounded-3xl p-6 space-y-4 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-3xl" />
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-white/5 pb-3">
              <div>
                <h3 className="text-xs font-black text-red-400 flex items-center gap-1.5 uppercase tracking-wider">
                  <AlertCircle size={15} />
                  <span>🚨 مركز التدخل السريع واللحاق بالطلبات (Street Bottlenecks)</span>
                </h3>
                <p className="text-[10.5px] text-slate-400 font-bold mt-1">
                  أوردرات الميدان التي تم وسمها كـ (<span className="text-red-300">لا يرد</span>) أو (<span className="text-amber-300 font-black">مؤجل</span>) من المندوب. اتصل بالعميل الآن لإنقاذ الشحنة وتثبيت موعد بديل.
                </p>
              </div>
              <span className="px-2.5 py-1 bg-red-950/40 text-red-400 text-[10px] font-black rounded-lg border border-red-900/30">
                {bottleneckOrders.length} معوقات تحتاج حل ⚠️
              </span>
            </div>

            {bottleneckOrders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-400 font-bold bg-slate-950/30 rounded-2xl border border-white/5">
                🍀 لا توجد معوقات تشغيلية حالياً بالشارع، ذمم العملاء والمناديب مستجيبة للتسليم بنسبة 100%!
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[460px] overflow-y-auto pr-1">
                {bottleneckOrders.slice(0, 15).map((o, idx) => {
                  const stat = (o.status || "").trim();
                  const isNoAnswer = ["لا يوجد رد", "العميل لا يرد", "No Answer", "العميل لم يقم بالرد"].includes(stat);
                  
                  return (
                    <div 
                      key={idx} 
                      className={`p-4 bg-slate-900 border ${isNoAnswer ? 'border-red-950/80 hover:border-red-500/30' : 'border-amber-950/80 hover:border-amber-500/30'} rounded-2xl flex flex-col justify-between space-y-3 shadow-md hover:shadow-lg transition-all relative`}
                    >
                      <div>
                        {/* Header Status & Code */}
                        <div className="flex items-center justify-between mb-2">
                          <code className="text-[10px] font-mono font-black text-slate-400 tracking-wider bg-slate-950 px-1.5 py-0.5 rounded">{o.tracking}</code>
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black ${isNoAnswer ? 'bg-red-950/60 text-red-400 border border-red-900/40' : 'bg-amber-950/60 text-amber-400 border border-amber-900/40'}`}>
                            {stat}
                          </span>
                        </div>

                        {/* Customer Information */}
                        <h4 className="text-xs font-black text-slate-100 flex items-center gap-1">
                          <span>{o.custName || "بدون اسم عميل"}</span>
                        </h4>
                        
                        {/* Logistics Details */}
                        <div className="text-[10px] text-slate-400 space-y-0.5 mt-2 font-bold font-sans">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">📍 المنطقة:</span>
                            <span>{o.gov} - {o.region}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">🛵 المندوب:</span>
                            <span className="text-amber-400">{o.courier || "لم يسند"}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="text-slate-500">📦 التاجر:</span>
                            <span className="text-purple-400">{o.supplier}</span>
                          </div>
                        </div>

                        {/* Order Notes */}
                        {o.notes && (
                          <div className="mt-2.5 p-1.5 bg-slate-950 rounded text-[9.5px] text-slate-400 border border-white/5 font-medium leading-relaxed overflow-hidden text-ellipsis whitespace-nowrap" title={o.notes}>
                            💬 {o.notes}
                          </div>
                        )}
                      </div>

                      {/* Fast Coordination Actions bar */}
                      <div className="flex gap-1.5 pt-2 border-t border-white/5 mt-auto">
                        <a 
                          href={`tel:${o.phone}`}
                          className="flex-1 py-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 rounded-lg text-center font-black text-[9.5px] flex items-center justify-center gap-1 border border-emerald-900/30 tracking-wide"
                        >
                          <Phone size={11} />
                          <span>اتصال 📞</span>
                        </a>

                        <a 
                          href={getWhatsAppLink(o.phone || o.phone2 || "", o.custName || "عميلنا الكريم", o.tracking, stat)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 py-1.5 bg-blue-900/40 hover:bg-blue-900/60 text-blue-400 rounded-lg text-center font-black text-[9.5px] flex items-center justify-center gap-1 border border-blue-900/30 tracking-wide"
                        >
                          <MessageSquare size={11} />
                          <span>واتساب 💬</span>
                        </a>

                        <button 
                          onClick={() => {
                            setCoordinatingOrder(o);
                            setCoordinationStatus("العميل رد وجاري التسليم");
                            setCoordinationNotes("");
                          }}
                          className="flex-1 py-1.5 bg-purple-900/40 hover:bg-purple-900/60 text-purple-400 rounded-lg text-center font-black text-[9.5px] flex items-center justify-center gap-1 border border-purple-900/30 tracking-wide cursor-pointer"
                        >
                          <Check size={11} />
                          <span>تنسيق فوري 🖊️</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {bottleneckOrders.length > 15 && (
              <p className="text-[9px] text-left text-slate-500 font-extrabold italic">أظهرنا أول 15 معوقاً طارئاً للاختصار... تصفح البقية من قائمة البحث الشاملة أو بوابة الشحنات.</p>
            )}
          </div>

          {/* SECTION: LIVE STREET CUSTODY GRID (جدول حقائب الشارع الحية) */}
          <div id="section-live-street-custody-grid" className="bg-slate-900 border border-white/5 rounded-3xl p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <div>
                <h3 className="text-xs font-black text-slate-200 tracking-wider flex items-center gap-2">
                  <span>🛵 حقائب ومناديب الشحنات الميدانية الحية (Live Street Custody Grid)</span>
                </h3>
                <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">مراقبة الشحنات والعهدة اللحظية المودعة كاش بمسؤولية المناديب حالياً في الشارع</p>
              </div>
              <span className="p-1 px-2.5 bg-emerald-950 text-emerald-400 rounded-full font-black text-[9.5px]">نشط الآن: {liveCouriersList.length} مناديب</span>
            </div>

            {liveCouriersList.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-500 font-bold">لا يوجد ليدربورد أو حقائب نشطة في ذمة المناديب حالياً</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-black border-b border-white/5 text-right">
                      <th className="p-3">اسم المندوب</th>
                      <th className="p-3 text-center">عهدة الشحنات الكلية</th>
                      <th className="p-3 text-center text-emerald-400">تم التسليم والتحصيل</th>
                      <th className="p-3 text-center text-red-400">مرتجعات معلقة</th>
                      <th className="p-3 text-center text-amber-400 font-extrabold">مؤجل ميداني</th>
                      <th className="p-3 text-center text-red-300">أطقم لا يرد</th>
                      <th className="p-3 text-center text-rose-400">أيام التعليق (Pending Days)</th>
                      <th className="p-3 text-left text-emerald-400">الكاش بعهدته (Unsettled Cash)</th>
                      <th className="p-3 text-center">أدوات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {liveCouriersList.map((c, index) => {
                      return (
                        <tr key={index} className="border-b border-white/4 hover:bg-slate-950/60 transition-colors">
                          <td 
                            onClick={() => setSelectedCourierBag(c.name)}
                            className="p-3 font-black text-slate-100 hover:text-amber-500 transition-colors cursor-pointer"
                          >
                            👤 {c.name}
                          </td>
                          <td className="p-3 text-center font-mono font-bold text-slate-300">{c.totalActive}</td>
                          <td className="p-3 text-center font-mono font-bold text-emerald-400">{c.delivered}</td>
                          <td className="p-3 text-center font-mono font-bold text-red-400">{c.returned}</td>
                          <td className="p-3 text-center font-mono font-bold text-amber-500">{c.delayed}</td>
                          <td className="p-3 text-center font-mono font-bold text-red-300">{c.noAnswer}</td>
                          <td className="p-3 text-center font-mono font-bold text-rose-400 bg-rose-950/10">
                            ⏳ {c.pendingDays} {c.pendingDays === 1 ? "يوم" : "أيام"}
                          </td>
                          <td className="p-3 text-left font-mono font-black text-emerald-400 bg-emerald-950/20">
                            💰 {(c.cashPending || 0).toLocaleString("ar")} <span className="text-[9.5px]">ج.م</span>
                          </td>
                          <td className="p-3 text-center">
                            <button 
                              onClick={() => setSelectedCourierBag(c.name)}
                              className="px-2 py-1 bg-slate-950 hover:bg-slate-800 text-amber-400 hover:text-amber-300 text-[10px] font-black rounded border border-white/5 transition-all cursor-pointer"
                            >
                              فحص الحقيبة 🔎
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {!isManagerOrAccountant && (
            <div className="p-4 mt-4 bg-orange-950/10 border border-orange-900/15 rounded-xl text-center">
              <p className="text-[10px] font-black text-orange-400">
                🔒 تم حجب وإخفاء التحصيلات التراكمية التاريخية ومؤشرات الإدارة والمالية الكلية تلقائياً لدواعي الأمان. الأرقام تظهر للمالك والمدراء فقط من خلال لوحة المالك المخصصة.
              </p>
            </div>
          )}
        </div>
      ) : (
        
        /* 🔒 CUMULATIVE HISTORIC RECONCILIATION FOR CENTRAL MANAGEMENT & OWNERS */
        <div className="space-y-4 pt-2">
          <div className="flex items-center gap-2 border-r-4 border-amber-500 pr-3">
            <h3 className="text-xs font-black text-amber-500 tracking-wider">
              🔒 لوحة الإدارة المركزية وحسابات التراكمية (صلاحيات المالك والمحاسبة فقط)
            </h3>
          </div>

          {/* Cumulative Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Total System Orders */}
            <div className="bg-slate-900 border border-amber-500/10 rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-2 left-2 text-amber-500/5">
                <Layers size={40} />
              </div>
              <div className="text-2xl font-black text-amber-500 font-mono">{s.total}</div>
              <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">إجمالي الطلبات المستلمة</div>
            </div>

            {/* Delivered Orders */}
            <div className="bg-slate-900 border border-amber-500/10 rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-2 left-2 text-emerald-500/5">
                <CheckCircle2 size={40} />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">{s.delivered}</div>
              <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">تم التسليم والتحصيل</div>
              <div className="text-[9px] text-slate-400 font-bold mt-1 inline-block px-1 py-0.2 rounded bg-emerald-950/20">
                 نسبة {s.rate}% نجاح
              </div>
            </div>

            {/* Returned Orders */}
            <div className="bg-slate-900 border border-amber-500/10 rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-2 left-2 text-red-500/5">
                <AlertTriangle size={40} />
              </div>
              <div className="text-2xl font-black text-red-400 font-mono">{s.returned}</div>
              <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">عهدة مرتجعات المكتب</div>
            </div>

            {/* Returned Delivered to Supplier Card */}
            <div className="bg-slate-900 border border-amber-500/10 rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-2 left-2 text-indigo-500/5">
                <CheckCircle2 size={40} />
              </div>
              <div className="text-2xl font-black text-indigo-400 font-mono">{s.returnedDeliveredToSupplier || 0}</div>
              <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">مرتجع مسلم للمورد</div>
              <div className="text-[9px] text-indigo-400 font-bold mt-1 font-mono">
                 {(s.returnedDeliveredToSupplierValue || 0).toLocaleString("ar")} ج.م
              </div>
            </div>

            {/* Total Cumulative Cashbox In COD */}
            <div className="bg-slate-900 border border-amber-500/10 rounded-2xl p-5 text-center relative overflow-hidden">
              <div className="absolute top-2 left-2 text-emerald-500/5">
                <Wallet size={40} />
              </div>
              <div className="text-2xl font-black text-emerald-400 font-mono">
                {(s.totalCOD || 0).toLocaleString("ar")}
              </div>
              <div className="text-[10px] font-black text-slate-400 mt-1 uppercase tracking-wider">التحصيل التراكمي الكلي</div>
              <div className="text-[8px] text-slate-300 font-bold mt-1">شامل كافة التحويلات والمنتجات المسلّمة</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* Today's Actual Cashbox Net Revenue */}
            <div className="bg-slate-900 border border-emerald-500/15 rounded-2xl p-6 text-center space-y-1 relative overflow-hidden">
              <div className="absolute top-2 left-2 text-emerald-500/5">
                <TrendingUp size={44} />
              </div>
              <div className="text-xs font-black text-slate-400">صافي تحصيل خزنة اليوم الدفتري الفعلي</div>
              <div className="text-3xl font-black text-emerald-400 font-mono">
                {(s.todayCOD || 0).toLocaleString("ar")} <span className="text-sm">ج.م</span>
              </div>
              <p className="text-[10px] text-slate-500 font-bold">كل المبالغ المحصلة المودعة عهداً اليوم للتسليم</p>
            </div>

            {/* High Performers Courier */}
            <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 flex items-center justify-between font-sans">
              <div className="flex items-center gap-3">
                <span className="text-2xl ring-4 ring-purple-900/10 p-2.5 rounded-xl bg-purple-950/20">🛵</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">أفضل مندوب تسليم</div>
                  <div className="text-sm font-black text-purple-400 mt-0.5">{bestCourier}</div>
                </div>
              </div>
              <div className="text-[9px] bg-purple-950/25 text-purple-300 font-bold px-2 py-1 rounded-lg">
                الأكثر تسليماً
              </div>
            </div>

            {/* High Performers Supplier */}
            <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 flex items-center justify-between font-sans">
              <div className="flex items-center gap-3">
                <span className="text-2xl ring-4 ring-amber-900/10 p-2.5 rounded-xl bg-amber-950/20 font-mono">📦</span>
                <div>
                  <div className="text-[10px] text-slate-400 font-bold">أفضل مورد للشركة</div>
                  <div className="text-sm font-black text-amber-400 mt-0.5">{bestSupplier}</div>
                </div>
              </div>
              <div className="text-[9px] bg-amber-950/25 text-amber-300 font-bold px-2 py-1 rounded-lg">
                الأكثر مبيعات
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboards Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 pt-2" id="leaderboards-grid">
        
        {/* Couriers Leaderboard */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-200 tracking-wider">🛵 أفضل مناديب اليوم (تسليمات اليومية)</h3>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">مؤشرات أداء مناديب الشحن لطلبات اليومية الحالية</p>
            </div>
            <BarChart3 size={16} className="text-amber-500" />
          </div>
          {couriers.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-bold">لا يوجد أوردرات عمل مخصصة للمناديب اليوم بعد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-black border-b border-white/5 text-right">
                    <th className="p-3">المندوب</th>
                    <th className="p-3 text-center">أوردرات اليوم</th>
                    <th className="p-3 text-center text-emerald-400">المستلم اليوم</th>
                    <th className="p-3 text-center text-red-400">المرتجع اليوم</th>
                    <th className="p-3 text-center">متبقي شحن بالشارع</th>
                    <th className="p-3 text-center">النسبة</th>
                    <th className="p-3 text-left text-emerald-400">تحصيل اليوم</th>
                  </tr>
                </thead>
                <tbody>
                  {couriers.map((c: any, index: number) => (
                    <tr key={index} className="border-b border-white/4 hover:bg-slate-950/50 transition-colors">
                      <td className="p-3 font-bold text-slate-100">{c.name}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-400">{c.total}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-400">{c.delivered}</td>
                      <td className="p-3 text-center font-mono font-bold text-red-400">{c.returned}</td>
                      <td className="p-3 text-center font-mono font-black text-amber-500 bg-amber-500/5">{c.remaining}</td>
                      <td className="p-3 text-center">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${getRateColor(c.rate)}`}>
                          {c.rate}%
                        </span>
                      </td>
                      <td className="p-3 text-left font-mono font-bold text-emerald-400 bg-emerald-950/5">
                        {(c.cod || 0).toLocaleString("ar")} <span className="text-[10px]">ج.م</span>
                      </td>
                     </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Suppliers Leaderboard */}
        <div className="bg-slate-900 border border-white/5 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h3 className="text-xs font-black text-slate-200 tracking-wider">📦 السجل التراكمي الشامل لأداء وحركة الموردين</h3>
              <p className="text-[9px] text-slate-400 font-bold mt-0.5">مؤشرات عهدة الشارع، نسبة التسليم التراكمية، ومستحقات الموردين بالخارج</p>
            </div>
            <BarChart3 size={16} className="text-indigo-400" />
          </div>
          {suppliers.length === 0 ? (
            <div className="text-center py-10 text-xs text-slate-500 font-bold">لا يوجد أوردرات عمل مخصصة للموردين في النظام بعد</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-950 text-slate-400 font-black border-b border-white/5 text-right">
                    <th className="p-3">اسم المورد والتاجر</th>
                    <th className="p-3 text-center">إجمالي الطلبات</th>
                    <th className="p-3 text-center text-emerald-400">ناجح ومستلم</th>
                    <th className="p-3 text-center text-red-400">راجع ومرتجع</th>
                    <th className="p-3 text-center text-amber-400">المعلق بالشارع حالياً</th>
                    <th className="p-3 text-center text-emerald-400">كاش معلق بالشحنات</th>
                    <th className="p-3 text-left">النسبة التراكمية</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((sl: any, index: number) => (
                    <tr key={index} className="border-b border-white/4 hover:bg-slate-950/50 transition-colors">
                      <td className="p-3 font-bold text-slate-100">{sl.name}</td>
                      <td className="p-3 text-center font-mono font-bold text-slate-400">{sl.total}</td>
                      <td className="p-3 text-center font-mono font-bold text-emerald-400">{sl.delivered}</td>
                      <td className="p-3 text-center font-mono font-bold text-red-400">{sl.returned}</td>
                      <td className="p-3 text-center font-mono font-black text-amber-500 bg-amber-500/5">
                        {sl.pendingStreetCount || 0} شحنة
                      </td>
                      <td className="p-3 text-center font-mono font-black text-emerald-400 bg-emerald-950/5">
                        {(sl.pendingStreetCOD || 0).toLocaleString("ar")} <span className="text-[10px] font-sans text-slate-400 font-bold">ج.م</span>
                      </td>
                      <td className="p-3 text-left">
                        <span className={`px-1.5 py-0.5 rounded font-mono font-bold text-[10px] ${getRateColor(sl.rate)}`}>
                          {sl.rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* -------------------------------------------------------------
          MODAL 1: Clicked Metric Card Drilldown (Street or Warehouse)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {activeDrilldown && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-200 tracking-wider flex items-center gap-2">
                    {activeDrilldown === "street" ? (
                      <>
                        <Truck className="text-blue-400" size={16} />
                        <span>كشف الأوردرات النشطة بالشارع حالياً مع المناديب (Street Custody)</span>
                      </>
                    ) : activeDrilldown === "active_operational" ? (
                      <>
                        <Package className="text-orange-400" size={16} />
                        <span>كشف المخزون التشغيلي للتشغيل (Active Operational Stock)</span>
                      </>
                    ) : activeDrilldown === "supplier_returns" ? (
                      <>
                        <RefreshCw className="text-rose-400" size={16} />
                        <span>كشف عهدة المرتجعات بالمكتب (Supplier Return Stock)</span>
                      </>
                    ) : activeDrilldown === "pending_return_settlement" ? (
                      <>
                        <AlertTriangle className="text-red-400" size={16} />
                        <span>كشف الأوردرات المرتجعة بانتظار التصفية في المكتب</span>
                      </>
                    ) : (
                      <>
                        <Package className="text-orange-400" size={16} />
                        <span>كشف البضائع المتواجدة كلياً بالمستودع والجاهزة للتحرك</span>
                      </>
                    )}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    {activeDrilldown === "street" 
                      ? `تم العثور على ${streetCustodyOrders.length} أوردرات نشطة لم يتأكد قفل تصفيتها بعد.` 
                      : activeDrilldown === "active_operational"
                      ? `تم العثور على ${activeOperationalStockOrders.length} أوردرات نشطة بالمستودع لفرزها وإعادة جدولتها.`
                      : activeDrilldown === "supplier_returns"
                      ? `تم العثور على ${supplierReturnStockOrders.length} أوردرات مرتجعة وبواقي تسليم جزئي منتظرة للموردين.`
                      : activeDrilldown === "pending_return_settlement"
                      ? `تم العثور على ${pendingReturnSettlementOrders.length} أوردرات مرتجعة معلقة بالخارج وبانتظار تصفية عهدة المناديب.`
                      : `تم العثور على ${warehouseOrders.length} أوردرات في ذمة الرفوف داخل المستودع.`}
                  </p>
                </div>

                <button 
                  onClick={() => setActiveDrilldown(null)}
                  className="p-1.5 bg-slate-950 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Inside Drilldown */}
              <div className="p-4 bg-slate-950/20 border-b border-white/5 flex gap-2">
                <div className="relative flex-1">
                  <span className="absolute inset-y-0 right-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input 
                    type="text"
                    value={modalSearch}
                    onChange={(e) => setModalSearch(e.target.value)}
                    placeholder="ابحث بكود تتبع الأوردر، اسم العميل، التاجر، المندوب، أو رقم الموبايل..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pr-9 pl-3 py-2 text-xs font-sans text-slate-200 outline-none focus:border-amber-500/40 transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Table Data inside Modal */}
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const items = 
                    activeDrilldown === "street" ? streetCustodyOrders :
                    activeDrilldown === "active_operational" ? activeOperationalStockOrders :
                    activeDrilldown === "supplier_returns" ? supplierReturnStockOrders :
                    activeDrilldown === "pending_return_settlement" ? pendingReturnSettlementOrders :
                    warehouseOrders;
                  const filtered = items.filter(o => {
                    if (!modalSearch.trim()) return true;
                    const q = modalSearch.toLowerCase().trim();
                    return [
                      o.tracking,
                      o.custName,
                      o.supplier,
                      o.courier,
                      o.phone,
                      o.notes,
                      o.gov,
                      o.region,
                      o.status
                    ].some(v => (v || "").toString().toLowerCase().includes(q));
                  });

                  if (filtered.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 text-xs font-bold font-sans">
                        ❌ لا توجد أوردرات مطابقة للبحث داخل هذا الملف حالياً.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 font-extrabold border-b border-white/5 text-right">
                            <th className="p-3">كود الأوردر</th>
                            <th className="p-3">اسم المستلم</th>
                            <th className="p-3">رقم الموبايل</th>
                            <th className="p-3">المحافظة والمنطقة</th>
                            <th className="p-3 text-center">المندوب</th>
                            <th className="p-3 text-center">المورد</th>
                            <th className="p-3 text-center">سعر المنتج</th>
                            <th className="p-3 text-center">الحالة الحالية</th>
                            <th className="p-3">أدوات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((o, idx) => {
                            return (
                              <tr key={idx} className="border-b border-white/4 hover:bg-slate-950/40 transition-all">
                                <td className="p-3 font-mono font-black text-slate-300 bg-slate-950/20">{o.tracking}</td>
                                <td className="p-3 font-extrabold text-slate-100">{o.custName}</td>
                                <td className="p-3 font-mono text-slate-400 font-semibold">{o.phone || o.phone2 || "—"}</td>
                                <td className="p-3 text-slate-300 font-semibold">{o.gov} - {o.region}</td>
                                <td className="p-3 text-center font-bold text-amber-400">{o.courier || "—"}</td>
                                <td className="p-3 text-center font-semibold text-purple-400">{o.supplier}</td>
                                <td className="p-3 text-center font-mono font-black text-emerald-400">
                                  {((Number(o.prodPrice || 0) + Number(o.shipPrice || 0))).toLocaleString("ar")} ج.م
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 font-black border border-white/5">
                                    {o.status}
                                  </span>
                                </td>
                                <td className="p-3">
                                  <div className="flex gap-1">
                                    <a 
                                      href={`tel:${o.phone}`}
                                      className="p-1 px-1.5 bg-emerald-900/40 hover:bg-emerald-900/60 text-emerald-400 border border-emerald-900/40 rounded transition-all text-[10px] font-black"
                                    >
                                      اتصل
                                    </a>
                                    <button 
                                      onClick={() => {
                                        setCoordinatingOrder(o);
                                        setCoordinationStatus(o.status);
                                        setCoordinationNotes(o.notes || "");
                                        setActiveDrilldown(null);
                                      }}
                                      className="p-1 px-1.5 bg-purple-900/40 hover:bg-purple-900/70 text-purple-400 border border-purple-900/40 rounded transition-all text-[10px] font-black cursor-pointer"
                                    >
                                      تنسيق
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Close Button footer bar */}
              <div className="p-4 border-t border-white/5 bg-slate-950/60 flex justify-end">
                <button 
                  onClick={() => setActiveDrilldown(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  إغلاق النافذة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          MODAL 2: Courier Bag Full Interrogation Modal
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {selectedCourierBag && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5 bg-slate-950/40 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-slate-200 tracking-wider flex items-center gap-2">
                    <Truck className="text-amber-500" size={16} />
                    <span>تفاصيل حقيبة المندوب الميدانية الحية: 👤 ({selectedCourierBag})</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-medium mt-1">
                    جرد الأوردرات النشطة المقارنة وكميات الكاش والطلبات بعهدتهم بالشارع قبل التصفية.
                  </p>
                </div>

                <button 
                  onClick={() => setSelectedCourierBag(null)}
                  className="p-1.5 bg-slate-950 rounded-xl text-slate-400 hover:text-white transition-all border border-white/5 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Metrics Inside Bag */}
              <div className="p-4 bg-slate-950/40 border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-4 font-sans text-center">
                <div className="p-3 bg-slate-900 rounded-xl border border-white/5">
                  <div className="text-[9px] text-slate-500 font-bold">عهدة الشحنات</div>
                  <div className="text-base font-black text-amber-500 font-mono">
                    {streetCustodyCouriers[selectedCourierBag]?.totalActive || 0} شحنة
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-white/5">
                  <div className="text-[9px] text-slate-500 font-bold">تم التسليم كاش</div>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    {streetCustodyCouriers[selectedCourierBag]?.delivered || 0} شحنة
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-white/5">
                  <div className="text-[9px] text-slate-500 font-bold">مؤجلات ومعلقات بالحقيبة</div>
                  <div className="text-base font-black text-yellow-500 font-mono">
                    {streetCustodyCouriers[selectedCourierBag]?.delayed || 0} شحنة
                  </div>
                </div>

                <div className="p-3 bg-slate-900 rounded-xl border border-emerald-900/30 bg-emerald-950/10">
                  <div className="text-[9px] text-emerald-400 font-bold uppercase">إجمالي كاش معلق بالحقيبة</div>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    {(streetCustodyCouriers[selectedCourierBag]?.cashPending || 0).toLocaleString("ar")} ج.م
                  </div>
                </div>
              </div>

              {/* Courier active orders list */}
              <div className="flex-1 overflow-y-auto p-4">
                {(() => {
                  const bagOrdersList = streetCustodyCouriers[selectedCourierBag]?.ordersList || [];
                  if (bagOrdersList.length === 0) {
                    return (
                      <div className="text-center py-12 text-slate-400 text-xs font-bold font-sans">
                        ❌ حقيبة المندوب خالية تماماً حالياً من أي أوردرات نشطة.
                      </div>
                    );
                  }

                  return (
                    <div className="overflow-x-auto rounded-xl border border-white/5">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-950 text-slate-400 font-extrabold border-b border-white/5 text-right">
                            <th className="p-3">كود الأوردر</th>
                            <th className="p-3">العميل المستلم</th>
                            <th className="p-3">رقم الهاتف</th>
                            <th className="p-3">المحافظة والمنطقة</th>
                            <th className="p-3 text-center">التاجر</th>
                            <th className="p-3 text-center">السعر والتحصيل</th>
                            <th className="p-3 text-center">حالة الطرد الحالية</th>
                            <th className="p-3 text-left">ملاحظات</th>
                            <th className="p-3 text-center">أدوات</th>
                          </tr>
                        </thead>
                        <tbody>
                          {bagOrdersList.map((o, idx) => {
                            return (
                              <tr key={idx} className="border-b border-white/4 hover:bg-slate-950/40 transition-all">
                                <td className="p-3 font-mono font-black text-slate-300 bg-slate-950/20">{o.tracking}</td>
                                <td className="p-3 font-extrabold text-slate-100">{o.custName}</td>
                                <td className="p-3 font-mono text-slate-400 font-semibold">{o.phone || o.phone2 || "—"}</td>
                                <td className="p-3 text-slate-300 font-semibold">{o.gov} - {o.region}</td>
                                <td className="p-3 text-center font-semibold text-purple-400">{o.supplier}</td>
                                <td className="p-3 text-center font-mono font-black text-emerald-400">
                                  {((Number(o.prodPrice || 0) + Number(o.shipPrice || 0))).toLocaleString("ar")} ج.م
                                </td>
                                <td className="p-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] bg-slate-950 font-black border border-white/5">
                                    {o.status}
                                  </span>
                                </td>
                                <td className="p-3 text-slate-400 font-semibold italic text-[11px] max-w-[120px] truncate" title={o.notes}>
                                  {o.notes || "—"}
                                </td>
                                <td className="p-3 text-center">
                                  <button 
                                    onClick={() => {
                                      setCoordinatingOrder(o);
                                      setCoordinationStatus(o.status);
                                      setCoordinationNotes(o.notes || "");
                                      setSelectedCourierBag(null);
                                    }}
                                    className="p-1 px-2 bg-purple-900/40 hover:bg-purple-900/70 text-purple-400 border border-purple-900/40 rounded transition-all text-[10px] font-black cursor-pointer"
                                  >
                                    تنسيق فوري 📞
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>

              {/* Close footer */}
              <div className="p-4 border-t border-white/5 bg-slate-950/60 flex justify-end">
                <button 
                  onClick={() => setSelectedCourierBag(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-100 rounded-xl text-xs font-black transition-all cursor-pointer"
                >
                  إغلاق نافذة الحقيبة
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* -------------------------------------------------------------
          MODAL 3: Fast Coordination Action Panel (التنسيق الفوري للأوردرات)
          ------------------------------------------------------------- */}
      <AnimatePresence>
        {coordinatingOrder && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-[60] p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-950 border border-slate-800 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden text-right leading-relaxed"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-white/5 bg-slate-900 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black text-amber-500 tracking-wider flex items-center gap-1.5">
                    <Sparkles size={14} />
                    <span>تنسيق عمليات سريع وإرسال تعديل الشحنة</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-bold mt-1">أوردر كود: ({coordinatingOrder.tracking})</p>
                </div>
                <button 
                  onClick={() => setCoordinatingOrder(null)}
                  className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-white/5 text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  <X size={15} />
                </button>
              </div>

              <form onSubmit={handleSaveCoordination} className="p-6 space-y-4">
                {coordinationSuccessMsg && (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-990/30 text-emerald-400 rounded-xl text-xs font-black text-center animate-pulse">
                    {coordinationSuccessMsg}
                  </div>
                )}

                {/* Info summary */}
                <div className="bg-slate-900/60 p-3 rounded-xl border border-white/5 space-y-1 text-xs">
                  <div><span className="text-slate-500 font-bold">👤 المستلم:</span> <span className="font-extrabold text-slate-100">{coordinatingOrder.custName}</span></div>
                  <div><span className="text-slate-500 font-bold">📍 العنوان:</span> <span className="text-slate-300 font-semibold">{coordinatingOrder.gov} - {coordinatingOrder.region} - {coordinatingOrder.address}</span></div>
                  <div><span className="text-slate-500 font-bold">🛵 المندوب:</span> <span className="text-amber-400 font-extrabold">{coordinatingOrder.courier || "لم يسند"}</span></div>
                  <div><span className="text-slate-500 font-bold">💰 السعر الكلي:</span> <span className="text-emerald-450 text-emerald-400 font-mono font-black">{((Number(coordinatingOrder.prodPrice || 0) + Number(coordinatingOrder.shipPrice || 0))).toLocaleString("ar")} ج.م</span></div>
                </div>

                {/* Status Selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-black text-slate-400">تغيير الحالة اللوجستية للدعم والمزامنة اليومية:</label>
                  <select 
                    value={coordinationStatus}
                    onChange={(e) => setCoordinationStatus(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs font-black text-amber-500 outline-none focus:border-amber-500/50"
                  >
                    <option value="العميل رد وجاري التسليم font-bold">العميل رد وجاري التسليم 📞</option>
                    <option value="تم رد العميل وجاري التنسيق">تم رد العميل وجاري التنسيق ✔️</option>
                    <option value="جديد">إعادة الأوردر كـ (جديد بالمستودع) 📦</option>
                    <option value="تم التسليم">تم التسليم بنجاح (تسوية كاش) 💰</option>
                    <option value="مؤجل">مؤجل ميداني ⏳</option>
                    <option value="لا يوجد رد">لا يوجد رد من العميل 🚨</option>
                  </select>
                </div>

                {/* Notes Input */}
                <div className="space-y-1.5 border-dashed border-t border-white/5 pt-3">
                  <label className="text-[11px] font-black text-slate-400">إضافة توجيه إداري أو ملاحظات التنسيق الميداني (Notes):</label>
                  <textarea 
                    rows={3}
                    value={coordinationNotes}
                    onChange={(e) => setCoordinationNotes(e.target.value)}
                    placeholder="اكتب التوجيه مثلاً: تم الاتصال بالعميل وأكد شحن الطلب يوم السبت القادم 📞."
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 outline-none focus:border-amber-500/50 font-semibold resize-none pr-3"
                  />
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-3">
                  <button 
                    type="submit"
                    disabled={savingCoordination}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-450 disabled:bg-slate-800 text-slate-950 rounded-xl text-xs font-black font-sans transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    {savingCoordination ? (
                      <>
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-950/20 border-t-slate-950 animate-spin" />
                        <span>جاري حفظ المزامنة...</span>
                      </>
                    ) : (
                      <>
                        <Check size={14} />
                        <span>تأكيد المزامنة وحفظ التوجيه ✍️</span>
                      </>
                    )}
                  </button>

                  <button 
                    type="button"
                    onClick={() => setCoordinatingOrder(null)}
                    className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-350 border border-white/5 rounded-xl text-xs font-semibold font-sans cursor-pointer"
                  >
                    إلغاء التنسيق
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
