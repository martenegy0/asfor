import React, { useState, useRef, useEffect } from "react";
import { Search, MapPin, Phone, MessageSquare, Check, Truck, User, Calendar, Trash2, Edit3, ShieldAlert, ArrowLeftRight, Download, FileSpreadsheet, Upload, Loader2, XCircle, Printer, Camera, Layers } from "lucide-react";
import { apiCall, toWA, toWAUrl, getOrderWAMessage, getTodayDateStr, normalizeDateToYMD } from "../utils";
import { Html5Qrcode } from "html5-qrcode";
import MobileOrders from "./MobileOrders";
import { OrdersInMemorySQLIndex, useBackgroundAccounting, HighPerformanceVirtualList } from "../utils/performance";

const OrderCard = React.memo(({ o, isSel, isExpanded, isLoadingHistory, historyList, render }: any) => {
  return render(o);
}, (prev, next) => {
  return prev.isSel === next.isSel &&
         prev.isExpanded === next.isExpanded &&
         prev.isLoadingHistory === next.isLoadingHistory &&
         prev.historyList === next.historyList &&
         prev.o === next.o;
});

const getCoordsWithTimeout = () => {
  return new Promise<{ lat: number; lng: number }>((resolve) => {
    const EgyptCenter = { lat: 30.0444, lng: 31.2357 };
    
    // Generate simulated fallback coordinates as a robust safety mechanism (Egypt Cairo region)
    const getFallback = () => {
      const offsetLat = (Math.random() - 0.5) * 0.015;
      const offsetLng = (Math.random() - 0.5) * 0.015;
      return { 
        lat: Number((EgyptCenter.lat + offsetLat).toFixed(6)), 
        lng: Number((EgyptCenter.lng + offsetLng).toFixed(6)) 
      };
    };

    if (typeof window === "undefined" || !navigator.geolocation) {
      resolve(getFallback());
      return;
    }

    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(getFallback());
      }
    }, 1500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          if (pos.coords.latitude && pos.coords.longitude) {
            resolve({ 
              lat: Number(pos.coords.latitude.toFixed(6)), 
              lng: Number(pos.coords.longitude.toFixed(6)) 
            });
          } else {
            resolve(getFallback());
          }
        }
      },
      (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(getFallback());
        }
      },
      { enableHighAccuracy: true, timeout: 1200, maximumAge: 0 }
    );
  });
};

interface OrdersProps {
  token: string;
  role: string;
  username: string;
  orders: any[];
  setOrders?: React.Dispatch<React.SetStateAction<any[]>>;
  couriers: any[];
  onRefresh: () => void;
}

interface SearchableCourierSelectProps {
  value: string;
  onChange: (val: string) => void;
  couriers: any[];
  placeholder?: string;
  id?: string;
  showWarehouseReset?: boolean;
}

function SearchableCourierSelect({ value, onChange, couriers, placeholder = "اختر المندوب...", id, showWarehouseReset }: SearchableCourierSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Parse cached list if sheets fetch fails or to avoid sheets roundtripping
  const cachedCouriers = React.useMemo(() => {
    try {
      const cached = localStorage.getItem("fp_cached_couriers");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Merge to avoid missing newly registered items
          const merged = [...couriers];
          parsed.forEach((x: any) => {
            if (x && x.name && !merged.some(y => y.name === x.name)) {
              merged.push(x);
            }
          });
          return merged;
        }
      }
    } catch (e) {
      console.error(e);
    }
    // First open cache initialization
    if (couriers && couriers.length > 0) {
      localStorage.setItem("fp_cached_couriers", JSON.stringify(couriers));
    }
    return couriers;
  }, [couriers]);

  // Filter based on search query (by name or region)
  const filtered = React.useMemo(() => {
    return cachedCouriers.filter(c => 
      (c?.name || "").toString().toLowerCase().includes(search.toLowerCase()) ||
      (c?.region || "").toString().toLowerCase().includes(search.toLowerCase())
    );
  }, [cachedCouriers, search]);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCourier = cachedCouriers.find(c => c.name === value);

  return (
    <div ref={dropdownRef} className="relative w-full text-right" id={id}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-3 text-xs text-right flex items-center justify-between gap-2 min-h-[46px] cursor-pointer hover:border-amber-500/40 focus:ring-2 focus:ring-amber-500/20 transition-all font-black"
      >
        <span className="text-slate-400">▼</span>
        <span className="truncate">
          {value === "reset_warehouse" 
            ? "🔄 إعادة للمستودع (سحب من المندوب وإرجاعه طلب حر)"
            : selectedCourier 
              ? `👤 ${selectedCourier.name} (${selectedCourier.region || "شامل"})` 
              : placeholder}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1.5 w-full bg-slate-900 border border-white/12 rounded-2xl p-2.5 shadow-2xl z-[900] space-y-2 animate-in fade-in slide-in-from-top-1 duration-100">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 ابحث باسم المندوب أو المنطقة..."
            className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-right outline-none focus:border-amber-500/50"
            autoFocus
          />
          <div className="max-h-[180px] overflow-y-auto space-y-1 scrollbar-thin scrollbar-thumb-slate-700">
            {placeholder && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl text-xs flex items-center justify-between hover:bg-slate-950 border border-transparent hover:border-white/4 transition-all min-h-[44px] cursor-pointer ${!value ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "text-slate-400"}`}
              >
                <span>{placeholder}</span>
              </button>
            )}
            
            {showWarehouseReset && (
              <button
                type="button"
                onClick={() => {
                  onChange("reset_warehouse");
                  setIsOpen(false);
                  setSearch("");
                }}
                className={`w-full text-right px-3 py-2.5 rounded-xl text-xs flex items-center justify-between hover:bg-red-500/10 border border-transparent hover:border-red-500/25 transition-all min-h-[44px] cursor-pointer ${value === "reset_warehouse" ? "bg-red-500/25 text-red-400 border-red-500/35 font-semibold" : "text-red-300"}`}
              >
                <span className="text-[9px] bg-red-950/45 text-red-405 px-1.5 py-0.5 rounded border border-red-900/30 shrink-0">إجراء جماعي</span>
                <span className="truncate font-black text-right">🔄 إعادة للمستودع (إرجاعه كأوردر حر بقائمة الانتظار)</span>
              </button>
            )}
            {filtered.length === 0 ? (
              <div className="text-center py-4 text-[10px] text-slate-500 font-extrabold">لا يوجد مناديب مطابقين للبحث</div>
            ) : (
              filtered.map((c, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    onChange(c.name);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  className={`w-full text-right px-3 py-2.5 rounded-xl text-xs flex items-center justify-between hover:bg-slate-950 border border-transparent hover:border-white/4 transition-all min-h-[44px] cursor-pointer ${value === c.name ? "bg-amber-500/10 text-amber-500 border-amber-500/20 font-black" : "text-slate-300"}`}
                >
                  <span className="text-[10px] text-slate-550 font-normal bg-slate-950 px-2 py-0.5 rounded border border-white/4 shrink-0">
                    {c.region || "شامل"}
                  </span>
                  <span className="truncate font-black">{c.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function parseSafeNumber(val: any) {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  var s = String(val).trim();
  if (s === "") return 0;
  var cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  var num = Number(cleaned);
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
  if (isNaN(shipPrice)) shipPrice = 0;

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
  if (isNaN(totalCOD)) totalCOD = 0;

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
  if (isNaN(prodPrice)) prodPrice = 0;

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
    prodPrice: isNaN(prodPrice) ? 0 : prodPrice,
    shipPrice: isNaN(shipPrice) ? 0 : shipPrice,
    totalCOD: isNaN(totalCOD) ? 0 : totalCOD
  };
}

function getKeptGoodsValue(o: any) {
  var status = (o.status || "").toString().trim();
  var financials = getOrderFinancials(o);
  var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
  var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status);
  
  if (isDelivered) {
    return financials.prodPrice;
  } else if (isPartial) {
    var shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
    var soldValue = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
    if (isNaN(soldValue)) soldValue = 0;
    return Math.max(0, soldValue - shipPrice);
  }
  return 0;
}

export default function Orders({ token, role, username, orders, setOrders, couriers, onRefresh }: OrdersProps) {
  const [pendingTrackings, setPendingTrackings] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [mobileDrawerOrder, setMobileDrawerOrder] = useState<any | null>(null);
  const [barcodeScannerOpen, setBarcodeScannerOpen] = useState<boolean>(false);
  const [activeFilter, setActiveFilter] = useState("all");
  
  // Status History states for order level audit logs
  const [histories, setHistories] = useState<Record<string, any[]>>({});
  const [loadingHistories, setLoadingHistories] = useState<Record<string, boolean>>({});
  const [expandedHistories, setExpandedHistories] = useState<Record<string, boolean>>({});

  const isAdmin = (role || "").toString().trim() === "مدير" || (role || "").toString().trim().includes("مدير");
  const isSuper = (role || "").toString().trim() === "مشرف" || (role || "").toString().trim().includes("مشرف");
  const isOps = (role || "").toString().trim() === "موظف عمليات" || (role || "").toString().trim().includes("عمليات");
  const isAgent = (role || "").toString().trim() === "مندوب" || (role || "").toString().trim().includes("مندوب");
  const isSupplier = (role || "").toString().trim() === "مورد" || (role || "").toString().trim().includes("مورد");
  const isReturnsOfficer = (role || "").toString().trim() === "مسؤول مرتجعات" || (role || "").toString().trim().includes("مرتجعات");
  
  const canManage = isAdmin || isSuper;
  const canSelectBulk = isAdmin || isSuper || isOps || isAgent || isReturnsOfficer;

  // --- Courier specifications for dynamic calculations ---
  const currentCourierProfile = couriers.find((c: any) => c.name === username);
  const basicSalary = currentCourierProfile ? Number(currentCourierProfile.salary || 3000) : 3000;
  const rawCommission = currentCourierProfile ? Number(currentCourierProfile.commission || 25) : 25;

  const [courierExpenses, setCourierExpenses] = useState<number>(0);

  React.useEffect(() => {
    if (isAgent) {
      apiCall("expenses", token).then((res) => {
        if (res && res.ok && res.expenses) {
          const todayYMD = getTodayDateStr();
          const todaySum = res.expenses
            .filter((e: any) => e.dateTime && e.dateTime.substring(0, 10) === todayYMD)
            .reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);
          setCourierExpenses(todaySum);
        }
      });
    }
  }, [token, isAgent, orders]);

  const todayDateStr = getTodayDateStr();

  const handleSimulateLocation = async (tracking: string) => {
    const lat = (30.0444 + (Math.random() - 0.5) * 0.1).toFixed(6);
    const lng = (31.2357 + (Math.random() - 0.5) * 0.1).toFixed(6);
    try {
      const res = await apiCall("simulateCustomerLocationReply", token, { tracking, lat, lng });
      if (res && res.mapsUrl) {
        setOrders((prev: any[]) =>
          prev.map((o) =>
            o.tracking === tracking ? { ...o, "موقع العميل/الخريطة": res.mapsUrl } : o
          )
        );
        if (onRefresh) onRefresh();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const deDuplicatedOrders = React.useMemo(() => {
    if (!Array.isArray(orders)) return [];
    const seen = new Set();
    return orders.filter((o: any) => {
      if (!o) return false;
      const key = (o.tracking || o.id || "").toString().trim().toUpperCase();
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [orders]);

  // High-Speed In-Memory SQL Index (Blueprint v105)
  const ordersIndex = React.useMemo(() => {
    return new OrdersInMemorySQLIndex(deDuplicatedOrders);
  }, [deDuplicatedOrders]);

  const roleFilteredOrders = React.useMemo(() => {
    const isSearching = search.trim().length > 0;

    // Use our high-performance index to retrieve courier-specific orders in O(1)
    if (isAgent) {
      const courierOrders = ordersIndex.getByCourier(username);
      if (isSearching) return courierOrders;

      return courierOrders.filter((o: any) => {
        const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
        if (isS) return false;

        const orderDateYMD = normalizeDateToYMD(o.orderDate || o.createdAt);
        const updateDateYMD = o.updatedAt ? normalizeDateToYMD(o.updatedAt) : "";
        const delivDateYMD = o.delivDate ? normalizeDateToYMD(o.delivDate) : "";
        const retDateYMD = o.retDate ? normalizeDateToYMD(o.retDate) : "";
        const isClosedStatus = o.isClosed || ["تم التسليم", "مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"].includes(o.status);
        
        if (isClosedStatus) {
          const completedToday = (delivDateYMD === todayDateStr) || (retDateYMD === todayDateStr) || (updateDateYMD === todayDateStr);
          if (!completedToday) return false;
        }
        
        const activeOrUpdatedToday = (orderDateYMD === todayDateStr) || (updateDateYMD === todayDateStr) || !isClosedStatus;
        return activeOrUpdatedToday;
      });
    }

    if (isSupplier) {
      const supplierOrders = ordersIndex.getBySupplier(username);
      if (isSearching) return supplierOrders;
      return supplierOrders.filter((o: any) => {
        const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
        return !isS;
      });
    }

    // Strip settled orders out of active daily operations completely, EXCEPT when searching
    const activeUnsettledOrders = deDuplicatedOrders.filter((o: any) => {
      if (isSearching) return true;
      const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
      return !isS;
    });

    if (isReturnsOfficer) {
      if (isSearching) return deDuplicatedOrders;
      return deDuplicatedOrders.filter((o: any) => {
        const isHandedOver = ["تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه"].includes(o.status);
        if (isHandedOver) {
          const updateDateYMD = o.updatedAt ? normalizeDateToYMD(o.updatedAt) : o.retDate ? normalizeDateToYMD(o.retDate) : "";
          return updateDateYMD === todayDateStr;
        }
        const isTargetStatus = ["مرتجع بالمستودع", "تسليم جزئي", "مرتجع", "مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد", "جاري الرجوع للمورد"].includes(o.status);
        return isTargetStatus;
      });
    }

    if (isOps) {
      return activeUnsettledOrders.filter((o: any) => {
        if (isSearching) return true;

        const orderDateYMD = normalizeDateToYMD(o.orderDate || o.createdAt);
        const updateDateYMD = o.updatedAt ? normalizeDateToYMD(o.updatedAt) : "";
        const delivDateYMD = o.delivDate ? normalizeDateToYMD(o.delivDate) : "";
        const retDateYMD = o.retDate ? normalizeDateToYMD(o.retDate) : "";
        const isClosedStatus = o.isClosed || ["تم التسليم", "مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"].includes(o.status);
        
        if (isClosedStatus) {
          const completedToday = (delivDateYMD === todayDateStr) || (retDateYMD === todayDateStr) || (updateDateYMD === todayDateStr);
          if (!completedToday) return false;
        }
        
        const activeOrUpdatedToday = (orderDateYMD === todayDateStr) || (updateDateYMD === todayDateStr) || !isClosedStatus;
        return activeOrUpdatedToday;
      });
    }

    return activeUnsettledOrders;
  }, [deDuplicatedOrders, ordersIndex, isAgent, isSupplier, isReturnsOfficer, isOps, todayDateStr, search, username]);

  const todayDeliveredOrders = roleFilteredOrders.filter((o: any) => {
    const isMyDeliv = o.courier === username && o.status === "تم التسليم";
    if (!isMyDeliv) return false;
    const isDelivToday = o.delivDate && normalizeDateToYMD(o.delivDate) === todayDateStr;
    const isUpdatedToday = o.updatedAt && normalizeDateToYMD(o.updatedAt) === todayDateStr;
    return isDelivToday || isUpdatedToday;
  });
  const todayDeliveredCount = todayDeliveredOrders.length;
  const todayCommissions = todayDeliveredCount * rawCommission;


  const toggleHistory = async (tracking: string) => {
    const isExpanded = !expandedHistories[tracking];
    setExpandedHistories(prev => ({ ...prev, [tracking]: isExpanded }));
    if (isExpanded && !histories[tracking]) {
      setLoadingHistories(prev => ({ ...prev, [tracking]: true }));
      try {
        const res = await apiCall("statusHistory", token, { tracking });
        if (res && res.ok !== false && res.history) {
          setHistories(prev => ({ ...prev, [tracking]: res.history }));
        }
      } catch (e) {
        console.error("Error loading status history for: " + tracking, e);
      } finally {
        setLoadingHistories(prev => ({ ...prev, [tracking]: false }));
      }
    }
  };

  const [selectedDate, setSelectedDate] = useState<string>(getTodayDateStr());
  const [desktopSelectedTracking, setDesktopSelectedTracking] = useState<string | null>(null);
  const [selectedSupplierFilter, setSelectedSupplierFilter] = useState<string>("");
  const [selectedCourierFilter, setSelectedCourierFilter] = useState<string>("");
  const [selectedRegionFilter, setSelectedRegionFilter] = useState<string>("");
  const [showOperationalReport, setShowOperationalReport] = useState<boolean>(false);
  const [displayLimit, setDisplayLimit] = useState<number>(25);
  const [courierConfirmModal, setCourierConfirmModal] = useState<{
    tracking: string;
    status: string;
    title: string;
  } | null>(null);

  const [deliveryChoiceOrder, setDeliveryChoiceOrder] = useState<any>(null);
  const [partialAmountInput, setPartialAmountInput] = useState<string>("");
  const [isSubmitPartialLoading, setIsSubmitPartialLoading] = useState<boolean>(false);

  React.useEffect(() => {
    setDisplayLimit(25);
  }, [search, activeFilter, selectedDate, selectedSupplierFilter, selectedCourierFilter, showOperationalReport, selectedRegionFilter]);

  const lastDays = React.useMemo(() => {
    const days = [];
    const todayStr = getTodayDateStr(); // e.g. "2026-06-12"
    const todayDate = new Date(todayStr);

    for (let i = 0; i < 7; i++) {
      const d = new Date(todayDate);
      d.setDate(todayDate.getDate() - i);
      const pad = (n: number) => n.toString().padStart(2, "0");
      const ymd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      
      let label = "";
      if (i === 0) {
        label = "اليوم";
      } else if (i === 1) {
        label = "أمس";
      } else {
        const weekdays = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
        label = `${weekdays[d.getDay()]} ${d.getDate()}`;
      }
      days.push({ ymd, label, dayNum: d.getDate() });
    }
    return days;
  }, []);

  const [selected, setSelected] = useState<Set<string>>(new Set());

  // --- New state for Bulk Printing & Scanning (Blueprint v100) ---
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scannerStatus, setScannerStatus] = useState("تم إيقاف الكاميرا");
  const [scannerSelectedStatus, setScannerSelectedStatus] = useState("تم التسليم");
  const [scannerSelectedCourier, setScannerSelectedCourier] = useState("");
  const scannerRef = useRef<any>(null);

  function playBeep() {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.15);
    } catch (e) {
      console.log("Beep audio blocked:", e);
    }
  }

  function toggleCameraScan() {
    if (isScanning) {
      if (scannerRef.current) {
        scannerRef.current.stop().then(() => {
          setIsScanning(false);
          setScannerStatus("تم إيقاف الكاميرا");
        }).catch((err: any) => {
          console.error("Stop error:", err);
          setIsScanning(false);
        });
      } else {
        setIsScanning(false);
      }
    } else {
      setIsScanning(true);
      setScannerStatus("جاري تهيئة الكاميرا...");
      setTimeout(() => {
        try {
          const html5QrcodeScanner = new Html5Qrcode("camera-scanner-view");
          scannerRef.current = html5QrcodeScanner;
          html5QrcodeScanner.start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: (width, height) => {
                const minSide = Math.min(width, height);
                return { width: Math.round(minSide * 0.7), height: Math.round(minSide * 0.7) };
              }
            },
            (decodedText) => {
              playBeep();
              handleScannedBarcode(decodedText);
            },
            (errorMessage) => {
              // Ignore scanning errors
            }
          ).then(() => {
            setScannerStatus("✅ الكاميرا تعمل بنشاط، يرجى وضع الباركود أمام العدسة");
          }).catch(err => {
            setScannerStatus(`⚠️ فشل تشغيل الكاميرا: ${err.message || err}`);
            setIsScanning(false);
          });
        } catch (e: any) {
          setScannerStatus(`⚠️ خطأ في التهيئة: ${e.message || e}`);
          setIsScanning(false);
        }
      }, 500);
    }
  }

  async function handleScannedBarcode(trackingId: string) {
    if (!trackingId) return;
    const cleanId = trackingId.trim().toUpperCase();
    setScannerStatus(`⏳ جاري معالجة وتحديث الشحنة: ${cleanId}...`);

    const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedFields: any = {
      status: scannerSelectedStatus,
      updatedAt: nowEgyptStr,
    };
    if (scannerSelectedStatus === "تم التسليم") {
      updatedFields.delivDate = nowEgyptStr;
    }
    if (scannerSelectedCourier) {
      updatedFields.courier = scannerSelectedCourier;
    }

    if (setOrders) {
      setOrders(prev => {
        const next = prev.map(o => o.tracking === cleanId ? { ...o, ...updatedFields } : o);
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    try {
      if (scannerSelectedCourier) {
        await apiCall("assignCourier", token, { tracking: cleanId, courier: scannerSelectedCourier });
      }
      
      const coords = await getCoordsWithTimeout();
      const res = await apiCall("updateStatus", token, {
        tracking: cleanId,
        status: scannerSelectedStatus,
        lat: coords?.lat,
        lng: coords?.lng,
        actionLogText: `[تحديث تلقائي بالمسح الضوئي الكاميرا] تم تغيير الحالة إلى [${scannerSelectedStatus}]` + (scannerSelectedCourier ? ` وإسنادها للمندوب: ${scannerSelectedCourier}` : "")
      });
      if (res && res.ok) {
        setScannerStatus(`✅ تم تحديث الأوردر ${cleanId} بنجاح إلى [${scannerSelectedStatus}]!`);
        playBeep();
        onRefresh();
      } else {
        setScannerStatus(`⚠️ فشل التحديث بالخادم: ${res?.error || "خطأ مجهول"}`);
        onRefresh();
      }
    } catch (err: any) {
      setScannerStatus(`⚠️ خطأ في الشبكة أثناء تحديث ${cleanId}`);
      onRefresh();
    }
  }

  // Stop camera scanning when component unmounts to prevent leaks
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        try {
          scannerRef.current.stop();
        } catch (e) {
          // ignore
        }
      }
    };
  }, []);

  // --- Modals States ---
  const [editOrder, setEditOrder] = useState<any>(null);
  const [confirmingStatus, setConfirmingStatus] = useState<{ tracking: string; status: string } | null>(null);
  const [returnedSelectOpen, setReturnedSelectOpen] = useState(false);
  const [selectedReturnOrder, setSelectedReturnOrder] = useState<any>(null);

  // --- Ops Officer Call states ---
  const [opsUpdatingCall, setOpsUpdatingCall] = useState<{ [tracking: string]: boolean }>({});
  const [opsNotes, setOpsNotes] = useState<{ [tracking: string]: string }>({});
  const [opsDate, setOpsDate] = useState<{ [tracking: string]: string }>({});
  
  // --- Bulk updates states ---
  const [bulkModalOpen, setBulkModalOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkCourier, setBulkCourier] = useState("");

  // --- New Floating Action Bar States ---
  const [floatingStatus, setFloatingStatus] = useState("");
  const [floatingNotes, setFloatingNotes] = useState("");
  const [floatingDate, setFloatingDate] = useState("");
  const [floatingCourier, setFloatingCourier] = useState("");
  const [floatingSubmitting, setFloatingSubmitting] = useState(false);
  const [showAssignPopover, setShowAssignPopover] = useState(false);
  const [showStatusPopover, setShowStatusPopover] = useState(false);

  // --- Quick Reconciliation Portal States ---
  const [showReconPortal, setShowReconPortal] = useState(false);
  const [reconcileBarcode, setReconcileBarcode] = useState("");
  const [reconcileStatus, setReconcileStatus] = useState("تم التسليم");
  const [reconLoading, setReconLoading] = useState(false);
  const [reconFeedback, setReconFeedback] = useState("");
  const [reconExcelMsg, setReconExcelMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canReconcile = isAdmin || isSuper || isReturnsOfficer || (role || "").toString().includes("محاسب");

  async function handleSingleReconciliation() {
    if (!reconcileBarcode.trim()) {
      alert("يرجى إدخال أو قراءة كود كشف التتبع أولاً");
      return;
    }
    const targetTracking = reconcileBarcode.trim().toUpperCase();
    setReconLoading(true);
    setReconFeedback("");

    // --- OPTIMISTIC FE BACKUP ---
    const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedFields: any = {
      status: reconcileStatus,
      updatedAt: nowEgyptStr
    };
    if (reconcileStatus === "تم التسليم") {
      updatedFields.delivDate = nowEgyptStr;
    }

    if (setOrders) {
      setOrders(prev => {
        const next = prev.map(o => o.tracking === targetTracking ? { ...o, ...updatedFields } : o);
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    setReconcileBarcode("");
    setReconFeedback(`⚡ تم التحديث محلياً وجاري المزامنة في الخلفية...`);

    // --- BG API CALL ---
    getCoordsWithTimeout().then(coords => {
      apiCall("updateStatus", token, {
        tracking: targetTracking,
        status: reconcileStatus,
        lat: coords?.lat,
        lng: coords?.lng,
        reason: `تصفية سريعة عبر بوابة الباركود بالواجهة`
      }).then(res => {
        if (res && res.ok) {
          setReconFeedback(`✅ نجح تحديث الأوردر ${targetTracking} إلى [${reconcileStatus}]`);
          onRefresh();
        } else {
          setReconFeedback(`⚠️ تنبيه: فشل مزامنة الخادم لـ ${targetTracking} (${res?.error})`);
          onRefresh();
        }
      }).catch(err => {
        setReconFeedback(`⚠️ خطأ بالشبكة أثناء مزامنة ${targetTracking}`);
        onRefresh();
      }).finally(() => {
        setReconLoading(false);
      });
    });
  }

  function handleReconExcelUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) {
        alert("الملف فارغ أو لا يحتوي على صفوف تتبع صحيحة");
        return;
      }
      
      const parsedTrackings: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const row = lines[i];
        if (i === 0 && (row.toLowerCase().includes("tracking") || row.toLowerCase().includes("barcode") || row.includes("تتبع"))) {
          continue;
        }
        const cols = row.split(",");
        const tr = cols[0].replace(/["']/g, "").trim();
        if (tr) parsedTrackings.push(tr.toUpperCase());
      }

      if (parsedTrackings.length === 0) {
        alert("لم يتم العثور على أي أكواد تتبع صالحة بالملف");
        return;
      }

      setReconExcelMsg(`✅ تم استخراج ${parsedTrackings.length} كود تتبع جاهزة للتحديث الجماعي إلى [${reconcileStatus}]`);
      
      if (confirm(`هل أنت متأكد من رغبتك في تحديث ${parsedTrackings.length} أوردر دفعة واحدة إلى [${reconcileStatus}]؟`)) {
        setReconLoading(true);
        setReconFeedback("");

        // --- OPTIMISTIC BULK UPDATE ---
        const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);
        const updatedFields: any = {
          status: reconcileStatus,
          updatedAt: nowEgyptStr
        };
        if (reconcileStatus === "تم التسليم") {
          updatedFields.delivDate = nowEgyptStr;
        }

        if (setOrders) {
          setOrders(prev => {
            const next = prev.map(o => parsedTrackings.includes(o.tracking) ? { ...o, ...updatedFields } : o);
            localStorage.setItem("fp_cached_orders", JSON.stringify(next));
            return next;
          });
        }

        setReconFeedback(`⚡ تم التصفية المحلية لـ ${parsedTrackings.length} أوردر وجاري ترحيل التعديلات للخلفية...`);

        // --- API CALL ---
        try {
          const updatesList = parsedTrackings.map((tr) => ({
            tracking: tr,
            status: reconcileStatus
          }));
          const res = await apiCall("updateOrdersStatusBulk", token, {
            updates: updatesList
          });
          if (res && res.ok) {
            setReconFeedback(`⚡ نجح الارتجاع والتصفية لـ ${res.done} أوردر بنجاح تام!`);
            setReconExcelMsg("");
            if (fileInputRef.current) fileInputRef.current.value = "";
            onRefresh();
          } else {
            setReconFeedback(`⚠️ فشلت المزامنة الكلية للخلفية: ${res?.error}`);
            onRefresh();
          }
        } catch (err) {
          setReconFeedback("حدث خطأ أثناء الاتصال بالخادم للتصفية الجماعية ولكن تم التعديل محلياً");
          onRefresh();
        } finally {
          setReconLoading(false);
        }
      }
    };
    reader.readAsText(file);
  }

  const EgyptGovs = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية", "كفر الشيخ", "الغربية", "المنوفية",
    "البحيرة", "الإسماعيلية", "بور سعيد", "السويس", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان",
    "البحر الأحمر", "شمال سيناء", "جنوب سيناء", "مطروح", "الوادي الجديد", "بني سويف", "الفيوم"
  ];

  // Filters mapping
  const visibleOrders = React.useMemo(() => {
    return roleFilteredOrders
      .filter((o) => {
        // Strict role-based filter safety enforcement
        if (isAgent) {
          if (o.status === "جاهز للاستلام من المورد") return false;
          if (!o.courier || o.courier.toString().trim().toLowerCase() !== username.trim().toLowerCase()) return false;
        } else if (isSupplier) {
          if (!o.supplier || o.supplier.toString().trim().toLowerCase() !== username.trim().toLowerCase()) return false;
        } else if (isReturnsOfficer) {
          const isRet = ["مرتجع", "التسليم للمورد", "مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد", "تم تسليم المرتجع للمورد", "تم تسليمه للمورد", "مرتجع بالمستودع", "تسليم جزئي"].includes(o.status) || o.returnQueueStatus;
          if (!isRet) return false;
        }

        const hasSearch = !!search.trim();

        // Exclude delayed / unanswered hold-ups and pre-intake orders from the main "all" (الكل) tab list globally (do not hide from courier)
        if (!hasSearch && !isAgent && activeFilter === "all" && ["مؤجل", "لا يوجد رد", "العميل لم يقم بالرد", "جاهز للاستلام من المورد"].includes(o.status)) {
          return false;
        }

        // Filter by supplier if selected
        if (selectedSupplierFilter) {
          if (!o.supplier || o.supplier.toString().trim().toLowerCase() !== selectedSupplierFilter.toLowerCase()) {
            return false;
          }
        }

        // Filter by selected courier
        if (selectedCourierFilter) {
          if (!o.courier || o.courier.toString().trim().toLowerCase() !== selectedCourierFilter.toLowerCase()) {
            return false;
          }
        }

        // Filter by selected region / governorate
        if (selectedRegionFilter) {
          const rVal = selectedRegionFilter.trim().toLowerCase();
          const orderRegion = (o.region || "").toString().trim().toLowerCase();
          const orderGov = (o.gov || "").toString().trim().toLowerCase();
          if (!orderRegion.includes(rVal) && !orderGov.includes(rVal)) {
            return false;
          }
        }

        // Operational Daily Report Mode (groups New, Assigned, Pending, Coordinating statuses)
        if (!hasSearch && showOperationalReport) {
          const status = (o.status || "").toString().trim();
          const isOperational = ["جديد", "تم الإسناد", "مسند", "تم الاسناد", "مُسند جديد", "مؤجل", "لا يوجد رد", "العميل لم يقم بالرد", "تم رد العميل وجاري التنسيق", "العميل رد وجاري التسليم"].includes(status) || status.includes("رد وجاري");
          if (!isOperational) return false;
        } else if (!hasSearch && activeFilter !== "all") {
          // Logistic Status Categorization & Fallback mapping
          const status = (o.status || "").toString().trim();
          if (activeFilter === "جاهز للاستلام من المورد" && status !== "جاهز للاستلام من المورد") return false;
          if (activeFilter === "جديد" && status !== "جديد") return false;
          if (activeFilter === "مسند" && !["تم الإسناد", "مسند", "تم الاسناد", "مُسند جديد"].includes(status)) return false;
          if (activeFilter === "خارج مع المندوب" && !["خارج مع المندوب", "خارج للتسليم", "خارج للتوصيل", "مع المندوب"].includes(status)) return false;
          if (activeFilter === "العميل رد وجاري التسليم" && !["تم رد العميل وجاري التنسيق", "العميل رد وجاري التسليم"].includes(status) && !status.includes("رد وجاري")) return false;
          if (activeFilter === "تم التسليم" && !["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status)) return false;
          if (activeFilter === "تسليم جزئي" && !["تسليم جزئي", "تسليم جزئي - معلق للجرد"].includes(status)) return false;
          if (activeFilter === "مؤجل" && status !== "مؤجل") return false;
          if (activeFilter === "العميل لا يرد" && !["لا يوجد رد", "العميل لم يقم بالرد", "العميل لا يرد"].includes(status)) return false;
          if (activeFilter === "مرتجع بالمستودع" && !["مرتجع بالمستودع", "مرتجع", "مرتجع جديد", "مرتجع جاري تسليمه للمكتب", "العميل لغى الأوردر / مرتجع"].includes(status)) return false;
          if (activeFilter === "تم تسليمه للمورد" && !["تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "جاري الرجوع للمورد", "التسليم للمورد", "تم تسليمه للمورد"].includes(status)) return false;
          
          // Non-standard fallback filter matching
          if (!["جاهز للاستلام من المورد", "جديد", "مسند", "العميل رد وجاري التسليم", "تم التسليم", "تسليم جزئي", "مؤجل", "العميل لا يرد", "مرتجع بالمستودع", "تم تسليمه للمورد", "خارج مع المندوب"].includes(activeFilter)) {
            if (status !== activeFilter) return false;
          }
        }

        // Dynamic Date Filter - Filter by orderDate (or fallback to createdAt) matching selectedDateYMD (do not hide from courier view to capture complete custody)
        if (!hasSearch && !isAgent && selectedDate !== "all") {
          const orderDayStr = normalizeDateToYMD(o.orderDate || o.createdAt);
          if (orderDayStr !== selectedDate) return false;
        }

        if (hasSearch) {
          const q = search.toLowerCase().trim();
          return [
            o.tracking,
            o.customer,
            o.supplier,
            o.courier,
            o.phone,
            o.phone2,
            o.gov,
            o.region,
            o.address,
            o.notes,
            o.returnQueueStatus,
            o.customerId,
            o.customerCode,
            o.clientCode,
            o.customer_id,
            o.clientId
          ].some(field => field && field.toString().toLowerCase().includes(q));
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a.createdAt || "";
        const valB = b.createdAt || "";
        if (valA && valB) {
          const cmp = valB.localeCompare(valA);
          if (cmp !== 0) return cmp;
        }
        // Fallback
        const timeA = valA ? new Date(valA.replace(" ", "T")).getTime() : 0;
        const timeB = valB ? new Date(valB.replace(" ", "T")).getTime() : 0;
        return timeB - timeA;
      });
  }, [roleFilteredOrders, isAgent, username, activeFilter, isSupplier, isReturnsOfficer, selectedDate, search, selectedSupplierFilter, selectedCourierFilter, showOperationalReport, selectedRegionFilter]);

  // Background Worker-based Accounting & KPI calculations (Blueprint v105)
  const backgroundMetrics = useBackgroundAccounting(
    deDuplicatedOrders,
    selectedSupplierFilter,
    username,
    selectedDate,
    rawCommission,
    courierExpenses,
    todayDateStr
  );

  const filteredFinancials = backgroundMetrics.supplierFinancials;
  const backgroundCourierKPIs = backgroundMetrics.courierKPIs;

  const availableRegions = React.useMemo(() => {
    const regions = new Set<string>();
    (orders || []).forEach((o: any) => {
      if (o.region) regions.add(o.region.toString().trim());
      if (o.gov) regions.add(o.gov.toString().trim());
    });
    return Array.from(regions).filter(Boolean).sort();
  }, [orders]);

  const availableStatuses = [
    { key: "all", label: "🗓️ كافة الحالات" },
    { key: "جديد", label: "🆕 جديد" },
    { key: "مسند", label: "📋 مسند" },
    { key: "خارج مع المندوب", label: "🚚 خارج مع المندوب" },
    { key: "العميل رد وجاري التسليم", label: "📞 العميل رد وجاري التسليم" },
    { key: "تم التسليم", label: "✅ تم التسليم" },
    { key: "تسليم جزئي", label: "📦 تسليم جزئي" },
    { key: "مؤجل", label: "⏳ مؤجل" },
    { key: "العميل لا يرد", label: "📵 العميل لا يرد" },
    { key: "مرتجع بالمستودع", label: "📦 مرتجع بالمستودع" },
    { key: "تم تسليمه للمورد", label: "↩️ تم تسليمه للمورد" }
  ];

  // Today's hold-ups / suspended orders ("معلقات اليوم") for agent/courier view
  const suspendedOrders = React.useMemo(() => {
    if (!isAgent) return [];
    return roleFilteredOrders.filter((o) => {
      if (!o.courier || o.courier.toString().trim().toLowerCase() !== username.trim().toLowerCase()) return false;
      const isSuspended = ["مؤجل", "لا يوجد رد", "العميل لم يقم بالرد"].includes(o.status);
      if (!isSuspended) return false;

      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return [o.tracking, o.supplier, o.courier, o.customer, o.phone, o.gov, o.region, o.address, o.notes, o.returnQueueStatus]
          .join(" ")
          .toLowerCase()
          .includes(q);
      }
      return true;
    });
  }, [isAgent, roleFilteredOrders, username, search]);

  // Dynamic reactive count of orders within each status category, filtered by selected date and chosen supplier
  const statusCounts = React.useMemo(() => {
    // We filter by selected date AND chosen supplier (if any) to get exact count!
    const dayOrders = roleFilteredOrders.filter((o) => {
      // Date filter (do not hide active/unsettled custody from courier)
      if (selectedDate !== "all") {
        const isClosedStatus = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"].includes(o.status);
        if (isAgent && !isClosedStatus) {
          // Bypassed date filter for active custody
        } else {
          const orderDayStr = normalizeDateToYMD(o.orderDate || o.createdAt);
          if (orderDayStr !== selectedDate) return false;
        }
      }
      // Supplier filter
      if (selectedSupplierFilter) {
        if (!o.supplier || o.supplier.toString().trim().toLowerCase() !== selectedSupplierFilter.toLowerCase()) {
          return false;
        }
      }
      return true;
    });

    const counts: { [key: string]: number } = {
      all: dayOrders.length,
      "جاهز للاستلام من المورد": 0,
      "جديد": 0,
      "مسند": 0,
      "خارج مع المندوب": 0,
      "العميل رد وجاري التسليم": 0,
      "تم التسليم": 0,
      "تسليم جزئي": 0,
      "مؤجل": 0,
      "العميل لا يرد": 0,
      "مرتجع بالمستودع": 0,
      "تم تسليمه للمورد": 0
    };

    dayOrders.forEach((o) => {
      const status = (o.status || "").toString().trim();
      if (status === "جاهز للاستلام من المورد") counts["جاهز للاستلام من المورد"]++;
      else if (status === "جديد") counts["جديد"]++;
      else if (["تم الإسناد", "مسند", "تم الاسناد", "مُسند جديد"].includes(status)) counts["مسند"]++;
      else if (["خارج مع المندوب", "خارج للتسليم", "خارج للتوصيل", "مع المندوب"].includes(status)) counts["خارج مع المندوب"]++;
      else if (["تم رد العميل وجاري التنسيق", "العميل رد وجاري التسليم"].includes(status) || status.includes("رد وجاري")) counts["العميل رد وجاري التسليم"]++;
      else if (["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status)) counts["تم التسليم"]++;
      else if (["تسليم جزئي", "تسليم جزئي - معلق للجرد"].includes(status)) counts["تسليم جزئي"]++;
      else if (status === "مؤجل") counts["مؤجل"]++;
      else if (["لا يوجد رد", "العميل لم يقم بالرد", "العميل لا يرد"].includes(status)) counts["العميل لا يرد"]++;
      else if (["مرتجع بالمستودع", "مرتجع", "مرتجع جديد", "مرتجع جاري تسليمه للمكتب", "العميل لغى الأوردر / مرتجع"].includes(status)) counts["مرتجع بالمستودع"]++;
      else if (["تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "جاري الرجوع للمورد", "التسليم للمورد", "تم تسليمه للمورد"].includes(status)) counts["تم تسليمه للمورد"]++;
    });

    return counts;
  }, [roleFilteredOrders, selectedDate, selectedSupplierFilter, isAgent]);

  // Real-time metrics for selected supplier on specified date
  const selectedSupplierStats = React.useMemo(() => {
    if (!selectedSupplierFilter) return null;

    // Filter by supplier
    const supplierAllOrders = roleFilteredOrders.filter(
      (o) => o.supplier && o.supplier.toString().trim().toLowerCase() === selectedSupplierFilter.toLowerCase()
    );

    // Filter by date
    const supplierDayOrders = supplierAllOrders.filter((o) => {
      if (selectedDate !== "all") {
        return normalizeDateToYMD(o.orderDate || o.createdAt) === selectedDate;
      }
      return true;
    });

    const total = supplierDayOrders.length;
    const newCount = supplierDayOrders.filter(o => (o.status || "") === "جديد").length;
    
    const outForDelivery = supplierDayOrders.filter(o => {
      const status = (o.status || "").toString().trim();
      return ["خارج مع المندوب", "خارج للتسليم", "خارج للتوصيل", "مع المندوب"].includes(status);
    }).length;
    
    const delivered = supplierDayOrders.filter(o => {
      const status = (o.status || "").toString().trim();
      return ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي"].includes(status);
    }).length;
    
    const returnedInWarehouse = supplierDayOrders.filter(o => {
      const status = (o.status || "").toString().trim();
      return ["مرتجع بالمستودع", "مرتجع", "مرتجع جديد", "مرتجع جاري تسليمه للمكتب", "العميل لغى الأوردر / مرتجع"].includes(status);
    }).length;
    
    const returnedDelivered = supplierDayOrders.filter(o => {
      const status = (o.status || "").toString().trim();
      return ["تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "جاري الرجوع للمورد", "التسليم للمورد"].includes(status);
    }).length;
    
    const pendingUnaddressed = total - (newCount + outForDelivery + delivered + returnedInWarehouse + returnedDelivered);

    return {
      total,
      newCount,
      outForDelivery,
      delivered,
      returnedInWarehouse,
      returnedDelivered,
      pending: pendingUnaddressed >= 0 ? pendingUnaddressed : 0
    };
  }, [roleFilteredOrders, selectedSupplierFilter, selectedDate]);

  function toggleSelect(tracking: string) {
    const next = new Set(selected);
    if (next.has(tracking)) next.delete(tracking);
    else next.add(tracking);
    setSelected(next);
  }

  function toggleSelectAll() {
    if (selected.size === visibleOrders.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(visibleOrders.map((o) => o.tracking)));
    }
  }

  const exportToCSV = () => {
    const dateStr = new Date().toISOString().substring(0, 10);
    const filename = `الطلبات-${dateStr}`;

    const headers = [
      "رقم الشحنة",
      "العميل",
      "الهاتف",
      "الهاتف 2",
      "المحافظة",
      "المنطقة",
      "العنوان",
      "سعر المنتج",
      "سعر الشحن",
      "إجمالي التحصيل",
      "المورد",
      "المندوب",
      "الحالة",
      "ملاحظات",
      "تاريخ الإنشاء"
    ];

    const BOM = "\uFEFF";
    const csvContent = [
      headers.join(","),
      ...visibleOrders.map(o => {
        const totalCOD = o.totalCOD !== undefined ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
        
        const row = [
          o.tracking || "",
          o.customer || "",
          o.phone || "",
          o.phone2 || "",
          o.gov || "",
          o.region || "",
          o.address || "",
          o.prodPrice || 0,
          o.shipPrice || 0,
          totalCOD,
          o.supplier || "",
          o.courier || "",
          o.status || "",
          o.notes || "",
          o.createdAt || ""
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

  // --- Actions ---
  async function triggerStatusUpdate(
    tracking: string,
    status: string,
    returnShippingType = "",
    notes = "",
    delivDate = "",
    clearCourierWithSignature = false,
    partialAmount?: number
  ) {
    // If order was marked as 'مرتجع' and no shipping type chosen, open dialog (Third Point Fix!)
    if (status === "مرتجع" && !returnShippingType) {
      const ordObj = orders.find((o) => o.tracking === tracking);
      setSelectedReturnOrder(ordObj);
      setReturnedSelectOpen(true);
      return;
    }

    // Add to pending status changes to disable repeating clicks visually
    if (!isAgent) {
      setPendingTrackings((prev) => {
        const next = new Set(prev);
        next.add(tracking);
        return next;
      });
    } else {
      // For agents (couriers), let them feel instantaneous 100ms reaction time with zero blocking
      setPendingTrackings((prev) => {
        const next = new Set(prev);
        next.add(tracking);
        return next;
      });
      setTimeout(() => {
        setPendingTrackings((prev) => {
          const next = new Set(prev);
          next.delete(tracking);
          return next;
        });
      }, 100);
    }

    // --- OPTIMISTIC UI UPDATE ---
    const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const updatedFields: any = {
      status,
      updatedAt: nowEgyptStr,
    };
    if (clearCourierWithSignature) {
      const ordObj = orders.find((o) => o.tracking === tracking);
      if (ordObj && ordObj.courier) {
        updatedFields.courierSignature = `${ordObj.courier} (توقيع تصفية المرتجع الميداني ✍️)`;
        updatedFields.lastCourier = ordObj.courier;
        updatedFields.lastCommission = ordObj.commission;
        updatedFields.courier = "";
        updatedFields.commission = 0;

        // Strict status transitions matching server rules on courier clear
        const prevStatus = ordObj.status;
        if (prevStatus === "مرتجع") {
          updatedFields.status = "مرتجع بالمستودع";
        } else if (prevStatus === "تسليم جزئي") {
          updatedFields.status = "مرتجع جزئي بالمستودع";
        } else if (prevStatus === "مؤجل") {
          updatedFields.status = "مؤجل";
        } else if (["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(prevStatus)) {
          updatedFields.status = prevStatus;
        } else {
          updatedFields.status = "جديد";
        }
      }
    }
    if (notes) updatedFields.notes = notes;
    if (delivDate) updatedFields.delivDate = delivDate;

    if (status === "تم التسليم") {
      updatedFields.delivDate = delivDate || nowEgyptStr;
    } else if (["مرتجع", "التسليم للمورد", "مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد"].includes(status)) {
      updatedFields.retDate = nowEgyptStr;
    } else if (status === "جديد") {
      updatedFields.returnQueueStatus = undefined;
      updatedFields.returnQueueAgent = undefined;
      updatedFields.courier = "";
      updatedFields.commission = 0;
    } else if (status === "تسليم جزئي" || status === "تسليم جزئي - معلق للجرد") {
      updatedFields.isPartial = true;
      updatedFields.returnQueueStatus = "مرتجع جزئي بالمستودع";
      if (partialAmount !== undefined) {
        updatedFields.totalCOD = partialAmount;
        updatedFields.partialAmount = partialAmount;
        updatedFields.actualReceivedCash = partialAmount;
      }
    }
    if (returnShippingType) {
      updatedFields.returnShippingType = returnShippingType;
    }

    if (["مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد", "تم تسليم المرتجع للمورد"].includes(status)) {
      updatedFields.returnQueueStatus = status;
    }

    if (setOrders) {
      setOrders((prev) => {
        const next = prev.map((o) => (o.tracking === tracking ? { ...o, ...updatedFields } : o));
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    // Instantly close dialogs & reset multi selection to stay super slick
    setReturnedSelectOpen(false);
    setConfirmingStatus(null);
    setSelected(new Set());

    // --- BG API CALL ---
    getCoordsWithTimeout().then(coords => {
      apiCall("updateStatus", token, {
        tracking,
        status: updatedFields.status || status,
        returnShippingType,
        notes,
        delivDate,
        clearCourierWithSignature,
        partialAmount,
        lat: coords?.lat,
        lng: coords?.lng,
      })
        .then((res) => {
          if (res && res.ok) {
            console.log(`Successfully synced status of ${tracking} to [${status}] in BG`);
            if (!isAgent) {
              onRefresh();
            }
          } else {
            if (!isAgent) {
              alert(`⚠️ عطل مزامنة: فشل تحديث حالة الأوردر ${tracking} على السيرفر: ${res?.error || "خطأ غير معروف"}`);
              onRefresh();
            } else {
              console.error(`Courier BG sync issue for ${tracking}: ${res?.error}`);
            }
          }
        })
        .catch((err) => {
          console.error("BG sync error", err);
          if (!isAgent) {
            onRefresh();
          }
        })
        .finally(() => {
          if (!isAgent) {
            setPendingTrackings((prev) => {
              const next = new Set(prev);
              next.delete(tracking);
              return next;
            });
          }
        });
    });
  }

  async function toggleCustomerConfirmed(tracking: string) {
    const ordObj = orders.find((o) => o.tracking === tracking);
    if (!ordObj) return;

    const newValue = ordObj.customerConfirmed === "true" || ordObj.customerConfirmed === true ? "false" : "true";

    if (setOrders) {
      setOrders((prev) => {
        const next = prev.map((o) => (o.tracking === tracking ? { ...o, customerConfirmed: newValue } : o));
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    setPendingTrackings((prev) => {
      const next = new Set(prev);
      next.add(tracking);
      return next;
    });

    try {
      const res = await apiCall("updateStatus", token, {
        tracking,
        status: ordObj.status,
        customerConfirmed: newValue
      });
      if (!res || !res.ok) {
        alert("⚠️ فشل تحديث تأكيد العميل على السيرفر");
        onRefresh();
      }
    } catch (err) {
      console.error("Error setting customer confirm", err);
      onRefresh();
    } finally {
      setPendingTrackings((prev) => {
        const next = new Set(prev);
        next.delete(tracking);
        return next;
      });
    }
  }

  // Admin edit order detail saver
  async function saveAdminEdits(e: React.FormEvent) {
    e.preventDefault();
    if (!editOrder) return;
    const tracking = editOrder.tracking;
    const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);
    const adminFields = {
      customer: editOrder.customer,
      phone: editOrder.phone,
      phone2: editOrder.phone2,
      gov: editOrder.gov,
      region: editOrder.region,
      address: editOrder.address,
      prodPrice: Number(editOrder.prodPrice),
      shipPrice: Number(editOrder.shipPrice),
      courier: editOrder.courier,
      prodType: editOrder.prodType || "",
      notes: editOrder.notes,
      updatedAt: nowEgyptStr,
    };

    // --- OPTIMISTIC UI ---
    if (setOrders) {
      setOrders((prev) => {
        const next = prev.map((o) => (o.tracking === tracking ? { ...o, ...adminFields } : o));
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    setEditOrder(null);
    alert("⚡ تم الحفظ والتعديل محلياً فورا! جاري التحديث ومزامنة جوجل شيت في الخلفية...");

    // --- BG API CALL ---
    apiCall("updateOrder", token, {
      tracking,
      order: adminFields,
    })
      .then((res) => {
        if (res && res.ok) {
          console.log(`Successfully synced edit updates for ${tracking}`);
          onRefresh();
        } else {
          alert("⚠️ فشل الترحيل بالخلفية لـ " + tracking + ": " + res?.error);
          onRefresh();
        }
      })
      .catch((err) => {
        console.error("BG saveAdminEdits error", err);
        onRefresh();
      });
  }

  async function deleteOrderDirect(tracking: string) {
    if (!confirm(`⚠️ هل تريد حذف الأوردر ${tracking} نهائياً؟ \n\nلا يمكن التراجع عن هذه العملية وسيتم حذف سجلات حسابات المورد المرتبطة به.`)) {
      return;
    }

    // --- OPTIMISTIC UI ---
    if (setOrders) {
      setOrders((prev) => {
        const next = prev.filter((o) => o.tracking !== tracking);
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    setEditOrder(null);
    alert("🗑 تم الحذف محلياً فورا! جاري الترحيل النهائي للخادم في الخلفية...");

    // --- BG API CALL ---
    apiCall("deleteOrder", token, { tracking })
      .then((res) => {
        if (res && res.ok) {
          console.log(`Successfully synced delete of ${tracking}`);
          onRefresh();
        } else {
          alert("⚠️ فشلت حركة حذف الأوردر بالخلفية: " + res?.error);
          onRefresh();
        }
      })
      .catch((err) => {
        console.error("BG delete order error", err);
        onRefresh();
      });
  }

  // Bulk Manifest batch updates (Supervisor and Admin)
  async function saveBulkUpdate() {
    if (!bulkStatus && !bulkCourier) {
      alert("يرجى تحديد حالة أو مندوب للتوزيع الجماعي");
      return;
    }

    const trackingsToUpdate = Array.from(selected);
    const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);

    // Add all of these to pending trackings
    setPendingTrackings((prev) => {
      const next = new Set(prev);
      trackingsToUpdate.forEach((t) => next.add(t));
      return next;
    });

    // --- OPTIMISTIC UI ---
    const updatedFields: any = {
      updatedAt: nowEgyptStr,
    };
    if (bulkStatus) updatedFields.status = bulkStatus;
    if (bulkCourier) {
      if (bulkCourier === "reset_warehouse") {
        updatedFields.courier = "";
        updatedFields.commission = 0;
      } else {
        updatedFields.courier = bulkCourier;
      }
    }

    if (setOrders) {
      setOrders((prev) => {
        const next = prev.map((o) => {
          if (trackingsToUpdate.includes(o.tracking)) {
            const extra: any = {};
            if (bulkCourier === "reset_warehouse") {
              if (!["مرتجع", "تسليم جزئي", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع بالمستودع", "مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد"].includes(o.status)) {
                extra.status = o.status;
              }
            }
            return { ...o, ...updatedFields, ...extra };
          }
          return o;
        });
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    setBulkModalOpen(false);
    setBulkStatus("");
    setBulkCourier("");
    setSelected(new Set());

    alert(`⚡ تم إسناد وتعديل ${trackingsToUpdate.length} أوردر محلياً فورا، جاري التوزيع في الخلفية...`);

    // --- BG API CALL ---
    const updatesList = trackingsToUpdate.map((tr) => ({
      tracking: tr,
      status: bulkStatus || undefined,
      courier: bulkCourier || undefined,
    }));
    apiCall("updateOrdersStatusBulk", token, {
      updates: updatesList,
    })
      .then((res) => {
        if (res && res.ok) {
          console.log(`Bulk sync completed successfully for ${res.done} orders`);
          onRefresh();
        } else {
          alert(`⚠️ عطل مزامنة جماعية: ${res?.error}`);
          onRefresh();
        }
      })
      .catch((err) => {
        console.error("BG bulk sync error", err);
        onRefresh();
      })
      .finally(() => {
        setPendingTrackings((prev) => {
          const next = new Set(prev);
          trackingsToUpdate.forEach((t) => next.delete(t));
          return next;
        });
      });
  }

  // Floating Action Bar Role-Based Bulk updates
  async function saveFloatingBulkUpdate() {
    if (!floatingStatus && !floatingCourier && !floatingNotes && !floatingDate) {
      alert("يرجى اختيار حالة أو مندوب أو إدخال ملاحظات وتاريخ التحديث");
      return;
    }

    const trackingsToUpdate = Array.from(selected);
    const nowEgyptStr = new Date().toISOString().replace("T", " ").substring(0, 16);

    setPendingTrackings((prev) => {
      const next = new Set(prev);
      trackingsToUpdate.forEach((t) => next.add(t));
      return next;
    });

    // --- OPTIMISTIC UI ---
    const updatedFields: any = {
      updatedAt: nowEgyptStr,
    };
    if (floatingStatus) {
      let mapped = floatingStatus;
      if (mapped === "تم التسليم بنجاح") mapped = "تم التسليم";
      if (mapped === "مؤجل بناءً على طلب العميل") mapped = "مؤجل";
      if (mapped === "تم تسليم المرتجع للمورد وتصفية حسابه") mapped = "تم تسليم المرتجع للمورد";
      updatedFields.status = mapped;
    }
    if (floatingNotes) {
      updatedFields.notes = floatingNotes;
    }
    if (floatingDate) {
      updatedFields.delivDate = floatingDate;
    }
    if (floatingCourier) {
      if (floatingCourier === "reset_warehouse") {
        updatedFields.courier = "";
        updatedFields.commission = 0;
      } else {
        updatedFields.courier = floatingCourier;
      }
    }

    if (setOrders) {
      setOrders((prev) => {
        const next = prev.map((o) => {
          if (trackingsToUpdate.includes(o.tracking)) {
            const extra: any = {};
            if (floatingCourier === "reset_warehouse") {
              if (!["مرتجع", "تسليم جزئي", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع بالمستودع", "مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد"].includes(o.status)) {
                extra.status = o.status;
              }
            }
            return { ...o, ...updatedFields, ...extra };
          }
          return o;
        });
        localStorage.setItem("fp_cached_orders", JSON.stringify(next));
        return next;
      });
    }

    setFloatingStatus("");
    setFloatingCourier("");
    setFloatingNotes("");
    setFloatingDate("");
    setSelected(new Set());
    setShowAssignPopover(false);
    setShowStatusPopover(false);

    alert(`⚡ جاري إرسال ومزامنة التعديل الجماعي لـ ${trackingsToUpdate.length} شحنات...`);

    // --- BG API CALL ---
    const updatesList = trackingsToUpdate.map((tr) => ({
      tracking: tr,
      status: floatingStatus || undefined,
      courier: floatingCourier || undefined,
      notes: floatingNotes || undefined,
      date: floatingDate || undefined,
    }));
    apiCall("updateOrdersStatusBulk", token, {
      updates: updatesList,
    })
      .then((res) => {
        if (res && res.ok) {
          console.log(`Floating bulk update success for ${res.done} orders`);
          onRefresh();
        } else {
          alert(`⚠️ خطأ في حفظ التحديث الجماعي: ${res?.error || "صلاحيات غير كافية"}`);
          onRefresh();
        }
      })
      .catch((err) => {
        console.error("Floating bulk sync error", err);
        onRefresh();
      })
      .finally(() => {
        setPendingTrackings((prev) => {
          const next = new Set(prev);
          trackingsToUpdate.forEach((t) => next.delete(t));
          return next;
        });
      });
  }

  const getBadgeStyle = (status: string) => {
    switch (status) {
      case "جاهز للاستلام من المورد": return "bg-pink-950/45 text-pink-400 border border-pink-900/30 font-extrabold";
      case "جديد": return "bg-blue-950/40 text-blue-400 border border-blue-900/30";
      case "تم الإسناد": return "bg-indigo-950/40 text-indigo-400 border border-indigo-900/30";
      case "مُسند جديد": return "bg-sky-950/40 text-sky-400 border border-sky-900/30 font-bold";
      case "خارج مع المندوب": return "bg-amber-950/40 text-amber-500 border border-amber-900/30";
      case "تم التسليم": return "bg-emerald-950/40 text-emerald-400 border border-emerald-900/30";
      case "مرتجع": return "bg-red-950/40 text-red-550 border border-red-900/30";
      case "مؤجل": return "bg-orange-950/40 text-orange-400 border border-orange-900/30";
      case "لا يوجد رد": return "bg-slate-900/80 text-slate-400 border border-slate-700/30";
      case "التسليم للمورد": return "bg-rose-950/20 text-rose-550 border border-rose-900/30";
      case "تم تسليم المرتجع للمورد": return "bg-purple-950/20 text-purple-400 border border-purple-900/30";
      case "العميل رد وجاري التسليم": return "bg-lime-950 text-lime-400 border border-lime-900/40 font-black animate-pulse";
      case "تسليم جزئي - معلق للجرد": return "bg-amber-950 text-amber-400 border border-amber-800 font-extrabold";
      default: return "bg-slate-900 text-slate-400 border border-slate-800";
    }
  };

  const renderChangeHistory = (tracking: string) => {
    const list = histories[tracking] || [];
    const isLoading = !!loadingHistories[tracking];
    const isExpanded = !!expandedHistories[tracking];

    return (
      <div className="border-t border-white/6 pt-3 mt-3 space-y-2">
        <button
          type="button"
          onClick={() => toggleHistory(tracking)}
          className="flex items-center gap-1.5 text-[10.5px] text-amber-500 hover:text-amber-400 font-black cursor-pointer bg-slate-950/40 hover:bg-slate-950 px-2.5 py-1.5 rounded-lg border border-white/6 select-none transition-all"
        >
          <span>📜 {isExpanded ? "إخفاء سجل حركة الشحنة" : "عرض سجل حركة الشحنة (حالة الأوردر)"}</span>
          {isLoading && <Loader2 size={10} className="animate-spin text-amber-500" />}
        </button>

        {isExpanded && (
          <div className="bg-slate-950/60 rounded-xl p-3 border border-white/4 space-y-2 text-right" dir="rtl">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[10.5px] text-slate-500 font-bold">
                <Loader2 size={12} className="animate-spin" />
                <span>جاري تحميل سجل الحركات...</span>
              </div>
            ) : list.length === 0 ? (
              <p className="text-[10px] text-slate-550 font-bold py-1">لا توجد حركات مسجلة لهذه الشحنة حتى الآن.</p>
            ) : (
              <div className="space-y-2.5 relative border-r-2 border-slate-800 pr-3.5 mr-1.5 py-1">
                {list.map((h, i) => (
                  <div key={i} className="relative text-[10px]">
                    {/* Circle marker */}
                    <span className="absolute right-[-19.5px] top-[4px] w-2.5 h-2.5 rounded-full bg-amber-500 border border-slate-900 shadow-sm" />
                    
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-200">{h.dateTime}</span>
                        <span className="text-slate-505 text-slate-400">· بواسطة:</span>
                        <span className="font-black text-indigo-400">{h.updatedBy}</span>
                      </div>
                    </div>
                    <div className="mt-1 flex items-center gap-2 flex-wrap text-[10px] text-slate-305">
                      <span>القديمة:</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-white/4 text-slate-400 font-bold">
                        {h.oldStatus || "غير محدد"}
                      </span>
                      <span>◀</span>
                      <span className="px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/20 text-amber-500 font-black">
                        {h.newStatus || "جديد"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderOrderCard = (o: any) => {
    const isSel = selected.has(o.tracking);
    const statusType = (o.status || "").toString();
    let cardBorderStyle = "border-slate-700/80";
    let cardBgClass = "bg-slate-900/95";
    
    if (statusType === "العميل رد وجاري التسليم") {
      cardBorderStyle = "border-r-4 border-r-lime-400 border-lime-400/40";
      cardBgClass = "bg-lime-950/25 border-lime-400/60 shadow-[0_0_20px_rgba(163,230,53,0.3)] animate-pulse border-r-4";
    } else if (statusType === "لا يوجد رد") {
      cardBorderStyle = "border-r-4 border-r-rose-600 border-rose-500/40";
      cardBgClass = "bg-rose-950/20 border-rose-600/65 animate-pulse shadow-[0_0_15px_rgba(239,68,68,0.25)] border-r-4";
    } else if (o.customerConfirmed === "true" || o.customerConfirmed === true) {
      cardBorderStyle = "border-r-4 border-r-emerald-500 border-emerald-500/40";
      cardBgClass = "bg-emerald-950/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]";
    } else if (statusType === "تم التسليم" || statusType === "تسليم جزئي - معلق للجرد") {
      cardBorderStyle = "border-r-4 border-r-emerald-500 border-y-slate-700/70 border-l-slate-700/70";
      cardBgClass = "bg-emerald-950/10";
    } else if (statusType.includes("مرتجع")) {
      cardBorderStyle = "border-r-4 border-r-red-500 border-y-slate-700/70 border-l-slate-700/70";
      cardBgClass = "bg-red-950/15";
    } else if (
      statusType.includes("تجهيز") || 
      statusType.includes("شحن") || 
      statusType === "جديد" || 
      statusType === "تم الإسناد" ||
      statusType === "خارج مع المندوب"
    ) {
      cardBorderStyle = "border-r-4 border-r-amber-500 border-y-slate-700/70 border-l-slate-700/70";
      cardBgClass = "bg-amber-950/10";
    }

    return (
      <div
        key={o.tracking}
        className={`border shadow-sm rounded-xl p-5 mb-4 relative transition-all ${cardBgClass} ${cardBorderStyle} ${
          isSel ? "ring-2 ring-amber-500/10" : ""
        }`}
      >
        {/* Header components */}
        <div className="flex items-start justify-between border-b border-white/4 pb-3">
          <div className="flex items-center gap-3">
            {canSelectBulk && (
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggleSelect(o.tracking)}
                className="w-4 h-4 rounded border-white/10 bg-slate-950 text-amber-500 accent-amber-500 cursor-pointer"
              />
            )}
            <div>
              <div className="text-sm font-black text-amber-500 tracking-wider flex items-center gap-2">
                <span>{o.tracking}</span>
                {/* Edit & Delete panels inline with Tracking ID to prevent overlaps */}
                {isAdmin && (
                  <div className="flex gap-1 mr-2 font-sans">
                    <button
                      onClick={() => setEditOrder(o)}
                      className="p-1 px-1.5 bg-slate-950 text-indigo-400 hover:text-indigo-200 rounded-md border border-white/6 cursor-pointer"
                      title="تعديل الأوردر"
                    >
                      <Edit3 size={11} />
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`هل أنت متأكد من حذف الشحنة كلياً؟ ${o.tracking}`)) {
                          apiCall("deleteOrder", token, { tracking: o.tracking }).then((res) => {
                            if (res.ok) onRefresh();
                            else alert("فشل الحذف: " + res.error);
                          });
                        }
                      }}
                      className="p-1 px-1.5 bg-slate-950 text-red-400 hover:text-red-200 rounded-md border border-white/6 cursor-pointer"
                      title="حذف الأوردر"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-slate-500 font-bold block mt-0.5 font-mono">
                {o.createdAt.substring(0, 10)} {o.supplier && `· ${o.supplier}`}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {(o.isArchived === true || o.isArchived === "true" || o.isSettled === true || o.isSettled === "true" || o.is_settled === true || o.is_settled === "true") && (
              <span className="text-[9px] font-extrabold bg-indigo-950 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded shadow-sm">
                📦 مؤرشف
              </span>
            )}
            {o.returnShippingType && (
              <span className="text-[8.5px] font-black bg-purple-950 text-purple-400 border border-purple-900/30 px-1.5 py-0.5 rounded">
                شحن مرتجع: {o.returnShippingType === "paid" ? "مدفوع بالكامل" : "غير مدفوع"}
              </span>
            )}
            {(o.status === "مرتجع بالمستودع" || o.status === "مرتجع في المستودع" || o.status === "مرتجع جزئي بالمستودع") && (o.isPartial === true || o.isPartial === "true" || Number(o.actualReceivedCash || o.partialAmount || 0) > 0) && (
              <span className="text-[10px] font-extrabold bg-red-950 text-amber-400 border border-red-500/40 px-2 py-0.5 rounded shadow-sm animate-pulse whitespace-nowrap">
                ⚠️ مرتجع جزئي (المحصل: {o.actualReceivedCash || o.partialAmount || 0} ج.م)
              </span>
            )}
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${getBadgeStyle(o.status)}`}>
              {o.status}
            </span>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 text-xs text-slate-300 mt-3">
          <div className="space-y-1.5 col-span-1">
            <div className="flex items-center gap-2 font-black text-slate-200">
              <User size={13} className="text-slate-500 shrink-0" />
              <span>العميل: {o.customer || "مجهول الاسم"}</span>
            </div>
            <div className="flex items-center gap-2 font-mono text-slate-200">
              <Phone size={13} className="text-emerald-500 shrink-0" />
              <span>الهاتف: {o.phone || "—"} {o.phone2 ? `· ${o.phone2}` : ""}</span>
            </div>
          </div>

          <div className="space-y-1.5 border-t md:border-t-0 md:border-r border-white/4 pt-3.5 md:pt-0 md:pr-3.5 flex flex-col justify-between col-span-1">
            <div className="flex items-start gap-1.5 flex-col">
              <div className="flex items-start gap-1.5">
                <MapPin size={13} className="text-slate-500 mt-0.5 shrink-0" />
                <span className="text-xs">العنوان: <span className="font-bold text-slate-200">{o.gov} · {o.region} · {o.address}</span></span>
              </div>
              
              {o["موقع العميل/الخريطة"] ? (
                <span className="inline-flex items-center gap-1.5 text-[9.5px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30 font-bold font-mono mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  📍 تم ربط الموقع الفعلي للعميل عبر واتساب
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => handleSimulateLocation(o.tracking)}
                  className="mt-1.5 text-[9px] bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer"
                >
                  💬 محاكاة استقبال موقع العميل (واتساب)
                </button>
              )}
            </div>
            <a
              href={o["موقع العميل/الخريطة"] || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.gov} ${o.region} ${o.address}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`shrink-0 border font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer max-w-fit mt-1 ${
                o["موقع العميل/الخريطة"]
                  ? "bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-500/35 text-emerald-300"
                  : "bg-indigo-500/20 hover:bg-indigo-500/35 border-indigo-500/30 text-indigo-300"
              }`}
            >
              <MapPin size={11} className={o["موقع العميل/الخريطة"] ? "text-emerald-400 shrink-0" : "text-indigo-400 shrink-0"} />
              <span>{o["موقع العميل/الخريطة"] ? "عرض لوكيشن العميل الفعلي" : "توجيه الخرائط GPS"}</span>
            </a>
          </div>
        </div>

        {/* Settle info */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-white/4 mt-3">
          <div className="text-slate-300 flex items-center gap-2">
            <span className="text-sm font-mono shrink-0">💵</span>
            <span>إجمالي التحصيل المستحق: <span className="text-sm font-black text-emerald-400 font-mono">{(o.totalCOD || o.prodPrice || 0).toLocaleString("ar")} ج.م</span></span>
          </div>
          <span className="text-[9px] text-slate-500 font-bold font-mono">
            منتج: {o.prodPrice} · شحن: {o.shipPrice}
          </span>
        </div>

        {/* Hide or show sensitive courier assignments & display handover signature */}
        {!isSupplier && o.courier && (
          <div className="flex items-center gap-2 text-slate-300 border-t border-white/4 pt-2 mt-2">
            <Truck size={14} className="text-slate-500 shrink-0" />
            <span>المندوب الحالي: <span className="font-bold text-indigo-400">{o.courier}</span></span>
          </div>
        )}

        {!isSupplier && (o.courierSignature || o.lastCourier) && (
          <div className="flex items-center gap-2 text-purple-300 border-t border-purple-500/20 bg-purple-950/20 px-3 py-2.5 rounded-xl mt-2 select-text text-right" dir="rtl">
            <span className="text-sm shrink-0">✍️</span>
            <span className="text-[11px] font-bold">
              توقيع ذمة المندوب السابق: <span className="font-sans underline decoration-dotted font-black text-slate-100">{o.courierSignature || `${o.lastCourier} (توقيع تصفية المرتجع)`}</span>
            </span>
          </div>
        )}

        {o.notes ? (
          <div className="p-2.5 bg-slate-950/40 rounded-xl text-[11px] text-slate-400 border border-white/4 leading-relaxed mt-2">
            💬 <span className="font-bold">ملاحظات:</span> {o.notes}
          </div>
        ) : (
          <div className="p-2 bg-slate-950/20 rounded-xl text-[10px] text-slate-500 italic mt-2 text-center">
            لا توجد ملاحظات مسجلة على هذه الشحنة بعد.
          </div>
        )}

        {/* CS Action Logs Timeline (Blueprint v100) */}
        {o.actionLogs && o.actionLogs.length > 0 && (
          <div className="mt-3 bg-slate-950/60 p-3 rounded-xl border border-white/4 text-right space-y-2">
            <span className="text-[10px] font-black text-amber-500 block">📊 جدول زمني للإجراءات وخدمة العملاء (CS Timeline):</span>
            <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pl-1">
              {o.actionLogs.map((log: any, lIdx: number) => (
                <div key={lIdx} className="relative flex gap-2.5 items-start text-[10.5px] border-r-2 border-white/10 pr-3 pb-1">
                  <div className="absolute right-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow shadow-amber-500" />
                  <div className="flex-1 space-y-0.5 leading-relaxed">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-300">{log.user || "نظام لوجستي آلي"}</span>
                      <span className="text-[9px] font-mono text-slate-500">{log.dateTime}</span>
                    </div>
                    <p className="text-slate-400 font-medium">{log.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* نظام الملاحظات السياقية وبوابة الواتساب السريعة للاتصال والتصعيد */}
        <div className="mt-3.5 pt-3 border-t border-white/4 space-y-2">
          <div className="flex flex-col md:flex-row gap-2">
            <input
              id={`quick-note-input-${o.tracking}`}
              type="text"
              placeholder="اكتب نتيجة الاتصال أو ملاحظة جديدة لدمجها..."
              className="flex-1 bg-slate-950/80 border border-white/6 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-medium"
            />
            <div className="flex gap-1.5 shrink-0">
              <button
                type="button"
                onClick={async () => {
                  const el = document.getElementById(`quick-note-input-${o.tracking}`) as HTMLInputElement | null;
                  if (el && el.value.trim()) {
                    const newNote = el.value.trim();
                    const now = new Date();
                    const timeStr = now.toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' });
                    const appendedNotes = o.notes 
                      ? `${o.notes} | ${newNote} (${username} ${timeStr})`
                      : `${newNote} (${username} ${timeStr})`;
                    
                    el.disabled = true;
                    try {
                      await triggerStatusUpdate(o.tracking, o.status, o.returnShippingType || "", appendedNotes, o.delivDate || "");
                      el.value = "";
                    } catch (e) {
                      console.error(e);
                    } finally {
                      el.disabled = false;
                    }
                  }
                }}
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg cursor-pointer transition active:scale-95"
              >
                حفظ الملاحظة
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById(`quick-note-input-${o.tracking}`) as HTMLInputElement | null;
                  const noteVal = el ? el.value.trim() : "";
                  const msg = `🚨 *طلب تصعيد فني بخصوص الشحنة* 🚨
- *رقم الشحنة:* ${o.tracking}
- *العميل:* ${o.customer || "—"}
- *الهاتف:* ${o.phone || "—"}
- *المحافظة/المنطقة:* ${o.gov || "—"} · ${o.region || "—"}
- *المبلغ المالي:* ${o.totalCOD || o.prodPrice || 0} ج.م
- *الموظف الحالي:* ${username} (${role})
- *الملاحظة المكتوبة:* ${noteVal || o.notes || "لا توجد ملاحظة مكتوبة بعد"}`;
                  
                  const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                  window.open(waUrl, "_blank");
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-lg flex items-center gap-1 cursor-pointer transition active:scale-95"
                title="تصعيد المشكلة للدعم الفني والواتساب مباشرة"
              >
                <span>📞</span> التصعيد للدعم
              </button>
            </div>
          </div>
        </div>

        {o.returnQueueStatus && (
          <div className="p-3 bg-purple-950/10 border border-purple-900/30 rounded-xl text-[11px] text-purple-300 flex items-center justify-between mt-2">
            <span className="font-semibold flex items-center gap-1.5">
              <ArrowLeftRight size={13} className="shrink-0" />
              قائمة المرتجع: <span className="font-black underline">{o.returnQueueStatus}</span>
            </span>
            <span>مسؤول المتابعة: <span className="font-bold underline">{o.returnQueueAgent || "لم يعين"}</span></span>
          </div>
        )}

        {isOps && (
          <div className="col-span-1 md:col-span-2 bg-[#0a1128] p-4 rounded-xl border border-indigo-500/30 text-right space-y-3" dir="rtl">
            <div className="flex items-center gap-1.5 text-indigo-400">
              <span className="text-sm">🎧</span>
              <span className="text-xs font-black">لوحة متابعة موظف العمليات والاتصال:</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-slate-400 font-bold">تسجيل نتيجة المكالمة التفصيلية:</span>
                <textarea
                  id={`notes-input-${o.tracking}`}
                  defaultValue={o.notes || ""}
                  placeholder="شرح تواصل العميل، رغبته، أو تفاصيل المتابعة الحالية..."
                  className="bg-slate-900 border border-white/8 text-xs text-slate-100 rounded-lg p-2 focus:border-indigo-500 font-medium h-16 resize-none w-full"
                />
              </div>

              <div className="flex flex-col gap-2 justify-between">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold">تاريخ التوصيل الفعلي المتوقع:</span>
                  <input
                    id={`date-input-${o.tracking}`}
                    type="date"
                    defaultValue={o.delivDate ? o.delivDate.substring(0, 10) : ""}
                    className="bg-slate-900 border border-white/8 text-xs text-slate-100 rounded-lg p-1.5 focus:border-indigo-500 font-semibold w-full mt-1"
                  />
                </div>

                <div className="flex flex-col gap-1 mt-1">
                  <span className="text-[10px] text-indigo-400 font-bold">تعديل الحالة مع حفظ البيانات أعلاه:</span>
                  <select
                    disabled={pendingTrackings.has(o.tracking)}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val) {
                        const notesEl = document.getElementById(`notes-input-${o.tracking}`) as HTMLTextAreaElement | null;
                        const dateEl = document.getElementById(`date-input-${o.tracking}`) as HTMLInputElement | null;
                        const currentNotes = notesEl ? notesEl.value : (o.notes || "");
                        const currentDate = dateEl ? dateEl.value : (o.delivDate || "");
                        
                        triggerStatusUpdate(o.tracking, val, "", currentNotes, currentDate);
                        e.target.value = ""; // Reset value after trigger
                      }
                    }}
                    className="bg-slate-900 border border-white/10 text-xs text-slate-100 rounded-lg p-1.5 focus:border-indigo-500 font-bold focus:ring-0 cursor-pointer w-full"
                  >
                    <option value="">-- اختر الحالة الجديدة --</option>
                    <option value="تم رد العميل وجاري التنسيق">تم رد العميل وجاري التنسيق</option>
                    <option value="مؤجل">مؤجل (تأجيل الطلب)</option>
                    <option value="لا يوجد رد">لا يوجد رد (محاولة تواصل)</option>
                    <option value="العميل لغى الأوردر / مرتجع">العميل لغى الأوردر / مرتجع ❌</option>
                    {o.status === "جديد" && (
                      <option value="جديد">إرجاع الأوردر لحالة "جديد"</option>
                    )}
                  </select>
                </div>
              </div>
            </div>

            {o.status === "لا يرد" && (
              <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/20 flex flex-col gap-2 mt-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-amber-400">🚨 تم تصنيف الأوردر كـ "لا يرد"</span>
                  <button
                    type="button"
                    onClick={() => setOpsUpdatingCall(prev => ({ ...prev, [o.tracking]: !prev[o.tracking] }))}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-slate-100 font-extrabold text-[10px] rounded-lg cursor-pointer"
                  >
                    {opsUpdatingCall[o.tracking] ? "إلغاء التحديث" : "📞 تحديث نتيجة الاتصال (رد العميل)"}
                  </button>
                </div>
                {opsUpdatingCall[o.tracking] && (
                  <div className="space-y-3 border-t border-white/6 pt-2 select-text text-right" dir="rtl">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-355 font-bold">ملاحظات رد العميل (إجباري) *</span>
                      <textarea
                        placeholder="اكتب ملاحظات رد وتواصل العميل هنا..."
                        className="bg-slate-900 border border-indigo-500/40 text-xs text-slate-100 rounded-lg p-2 font-medium h-14 resize-none w-full"
                        value={opsNotes[o.tracking] || ""}
                        onChange={(e) => setOpsNotes(prev => ({ ...prev, [o.tracking]: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-355 font-bold">تاريخ الاستلام المؤجل (إجباري) *</span>
                      <input
                        type="date"
                        className="bg-slate-900 border border-indigo-500/40 text-xs text-slate-100 rounded-lg p-2 font-black w-full"
                        value={opsDate[o.tracking] || ""}
                        onChange={(e) => setOpsDate(prev => ({ ...prev, [o.tracking]: e.target.value }))}
                      />
                    </div>
                    <button
                      type="button"
                      disabled={pendingTrackings.has(o.tracking)}
                      onClick={() => {
                        const userNotes = opsNotes[o.tracking] || "";
                        const userDate = opsDate[o.tracking] || "";
                        if (!userNotes.trim()) {
                          alert("يرجى إدخال ملاحظات رد العميل أولاً (إجباري)");
                          return;
                        }
                        if (!userDate.trim()) {
                          alert("يرجى تحديد تاريخ الاستلام المؤجل أولاً (إجباري)");
                          return;
                        }
                        triggerStatusUpdate(o.tracking, "تم رد العميل وجاري التنسيق", "", userNotes, userDate);
                      }}
                      className="w-full py-2 bg-gradient-to-r from-emerald-500 to-indigo-600 text-slate-100 font-extrabold text-[11px] rounded-lg cursor-pointer hover:opacity-90"
                    >
                      تحديث الحالة إلى "تم رد العميل وجاري التنسيق" وكتابة التقارير
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}




        {/* Action Controls */}
        {o.status === "تسليم جزئي - معلق للجرد" ? (
          <div className="border-t border-rose-500/20 pt-3 text-center bg-rose-950/20 rounded-xl p-3 border border-rose-500/30 flex flex-col items-center gap-1.5 mt-2 animate-pulse">
            <span className="text-xs font-black text-rose-400 flex items-center gap-1.5">
              <span>🔒</span>
              <span>معلق للجرد: يرجى تسليم المتبقي للمستودع الليلة للتصفية</span>
            </span>
            <span className="text-[10px] text-slate-405 text-slate-400 font-bold">
              لقد سجلت تسليماً جزئياً بمبلغ {o.partialAmount || o.totalCOD} ج.م. لا يمكن تعديل الأوردر حالياً.
            </span>
          </div>
        ) : o.status !== "تم التسليم" && !isSupplier && (
          <div className="border-t border-white/6 pt-3 flex flex-wrap gap-2 justify-end">
            {isAgent && o.courier === username && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setDeliveryChoiceOrder(o);
                    setPartialAmountInput("");
                  }}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-slate-950 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin text-slate-950" />}
                  <span>✅ تم التسليم والتحصيل</span>
                </button>
                {o.status !== "العميل رد وجاري التسليم" && (
                  <button
                    type="button"
                    onClick={() => triggerStatusUpdate(o.tracking, "العميل رد وجاري التسليم")}
                    disabled={pendingTrackings.has(o.tracking)}
                    className={`px-3 py-1.5 bg-lime-550 bg-lime-500 hover:bg-lime-600 active:scale-98 text-slate-950 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                      pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                    }`}
                  >
                    <span>📞 العميل رد وجاري التسليم</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCourierConfirmModal({
                    tracking: o.tracking,
                    status: "مرتجع",
                    title: "اختيار مرتجع"
                  })}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-3 py-1.5 bg-red-605 bg-red-650 hover:bg-red-750 text-slate-200 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin text-slate-200" />}
                  <span>↩ اختيار مرتجع</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCourierConfirmModal({
                    tracking: o.tracking,
                    status: "مؤجل",
                    title: "تم التأجيل"
                  })}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-3 py-1.5 bg-slate-800 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin text-slate-300" />}
                  <span>⏰ تم التأجيل</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCourierConfirmModal({
                    tracking: o.tracking,
                    status: "لا يوجد رد",
                    title: "لا يرد"
                  })}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-3 py-1.5 bg-slate-950 text-slate-400 font-bold text-[10px] rounded-lg cursor-pointer border border-white/4 flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin text-slate-400" />}
                  <span>📵 لا يرد</span>
                </button>
              </>
            )}

            {canManage && (
              <>
                <button
                  onClick={() => triggerStatusUpdate(o.tracking, "خارج مع المندوب")}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-2.5 py-1 bg-slate-950 text-amber-500 border border-amber-500/20 text-[9px] font-black rounded hover:bg-slate-900 cursor-pointer flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={10} className="animate-spin text-amber-500" />}
                  <span>🚚 خارج للتسليم</span>
                </button>
                <button
                  onClick={() => triggerStatusUpdate(o.tracking, "تم التسليم")}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-2.5 py-1 bg-emerald-600 text-slate-950 text-[9px] font-black rounded hover:bg-emerald-700 cursor-pointer flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={10} className="animate-spin text-slate-950" />}
                  <span>تسليم سريع</span>
                </button>
                <button
                  onClick={() => triggerStatusUpdate(o.tracking, "مرتجع")}
                  disabled={pendingTrackings.has(o.tracking)}
                  className={`px-2.5 py-1 bg-slate-950 text-red-400 border border-red-900/20 text-[9px] font-black rounded hover:bg-slate-900 cursor-pointer flex items-center gap-1 ${
                    pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                  }`}
                >
                  {pendingTrackings.has(o.tracking) && <Loader2 size={10} className="animate-spin text-red-500" />}
                  <span>مرتجع سريع</span>
                </button>
                {o.courier && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من سحب هذا الأوردر وتبرئة المندوب (${o.courier}) بالتوقيع الإلكتروني للمرتجع؟`)) {
                        triggerStatusUpdate(o.tracking, "مرتجع بالمستودع", "", "", "", true);
                      }
                    }}
                    disabled={pendingTrackings.has(o.tracking)}
                    className="px-2.5 py-1 bg-purple-950 text-purple-300 border border-purple-500/30 text-[9px] font-black rounded hover:bg-purple-900 cursor-pointer flex items-center gap-1 shrink-0"
                    title="سحب وتصفية عهدة المندوب بالتوقيع"
                  >
                    <span>✍️ سحب وتوقيع المصفى</span>
                  </button>
                )}
              </>
            )}
          </div>
        )}

            {isReturnsOfficer && (
              <div className="flex flex-col gap-3 bg-slate-950 p-3.5 rounded-xl border border-purple-500/30 w-full text-right" dir="rtl">
                <div className="flex items-center gap-1.5 text-purple-400">
                  <span className="text-sm">🔄</span>
                  <span className="text-xs font-black">الدورة المستندية والخطوات اللوجستية للمرتجع:</span>
                </div>
                
                {/* Exclusive returns clerk action button */}
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-lg space-y-1.5 text-right">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-emerald-400 font-extrabold">🚨 إجراء حصري لمسؤول المرتجعات:</span>
                    <span className="text-[9px] text-emerald-500 font-medium">(خروج من العهدة تصفية تامة)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`هل أنت متأكد من تسليم هذا المرتجع للمورد (${o.supplier || "غير معروف"}) وتصفية حسابه الصافي التراكمي؟`)) {
                        triggerStatusUpdate(o.tracking, "تم تسليمه للمورد");
                      }
                    }}
                    disabled={pendingTrackings.has(o.tracking)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-black rounded-lg cursor-pointer transition-colors"
                  >
                    <span>🤝 تم تسليم المرتجع للمورد</span>
                  </button>
                </div>
              </div>
            )}

        {/* Clean isolated communication */}
        {o.phone && (() => {
          const rawPhone = o.phone.toString().trim();
          const formattedPhone = rawPhone.startsWith('0') ? rawPhone : '0' + rawPhone;
          return (
            <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/6 col-span-1 md:col-span-2">
              <a
                href={`tel:${formattedPhone}`}
                className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-blue-600/10 text-blue-400 bg-blue-950/20 border border-blue-900/30 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-colors text-center"
              >
                <Phone size={13} className="shrink-0" />
                <span>اتصال هاتفي</span>
              </a>
              <a
                href={toWAUrl(o.phone, getOrderWAMessage(o))}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-emerald-600/10 text-emerald-400 bg-emerald-950/20 border border-emerald-950/30 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-colors text-center font-sans"
              >
                <MessageSquare size={13} className="shrink-0" />
                <span>اتصال واتساب</span>
              </a>
            </div>
          );
        })()}

        {/* Dynamic collapsible audit log change history */}
        {renderChangeHistory(o.tracking)}
      </div>
    );
  };

  const renderCompactMobileCard = (o: any) => {
    const isSel = selected.has(o.tracking);
    const statusType = (o.status || "").toString();
    const totalCODValue = o.totalCOD !== undefined ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));

    let cardBorderStyle = "border-slate-800";
    let cardBgClass = "bg-slate-900/90";

    if (statusType === "العميل رد وجاري التسليم") {
      cardBorderStyle = "border-r-4 border-r-lime-400 border-lime-500/30";
      cardBgClass = "bg-lime-950/15 border-lime-400/50 shadow-md";
    } else if (statusType === "لا يوجد رد") {
      cardBorderStyle = "border-r-4 border-r-rose-500 border-rose-500/30";
      cardBgClass = "bg-rose-950/15 border-rose-600/50 animate-pulse";
    } else if (o.customerConfirmed === "true" || o.customerConfirmed === true) {
      cardBorderStyle = "border-r-4 border-r-emerald-500 border-emerald-500/30";
      cardBgClass = "bg-emerald-950/15";
    } else if (statusType === "تم التسليم" || statusType === "تسليم جزئي - معلق للجرد") {
      cardBorderStyle = "border-r-4 border-r-emerald-500";
      cardBgClass = "bg-emerald-950/10";
    } else if (statusType.includes("مرتجع")) {
      cardBorderStyle = "border-r-4 border-r-red-500";
      cardBgClass = "bg-red-950/15";
    } else if (statusType === "جديد") {
      cardBorderStyle = "border-r-4 border-r-blue-500";
      cardBgClass = "bg-blue-950/10";
    }

    return (
      <div
        key={o.tracking}
        className={`border rounded-xl p-3.5 mb-3 transition-all ${cardBgClass} ${cardBorderStyle} ${
          isSel ? "ring-1 ring-amber-500" : ""
        }`}
      >
        <div className="flex items-center justify-between pb-2 border-b border-white/4">
          <div className="flex items-center gap-1.5">
            {canSelectBulk && (
              <input
                type="checkbox"
                checked={isSel}
                onChange={() => toggleSelect(o.tracking)}
                className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 accent-amber-500 cursor-pointer"
              />
            )}
            <span className="text-xs font-black text-amber-500 font-mono">{o.tracking}</span>
          </div>
          <div className="flex items-center gap-1">
            {(o.status === "مرتجع بالمستودع" || o.status === "مرتجع في المستودع" || o.status === "مرتجع جزئي بالمستودع") && (o.isPartial === true || o.isPartial === "true" || Number(o.actualReceivedCash || o.partialAmount || 0) > 0) && (
              <span className="text-[9px] font-extrabold bg-red-950 text-amber-400 border border-red-500/40 px-1.5 py-0.5 rounded shadow-sm animate-pulse whitespace-nowrap">
                ⚠️ مرتجع جزئي ({o.actualReceivedCash || o.partialAmount || 0} ج.م)
              </span>
            )}
            <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-full ${getBadgeStyle(o.status)}`}>
              {o.status}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-2 gap-y-1 py-1.5 text-[11px] text-slate-300">
          <div>
            <span className="text-[9px] text-slate-500 block">العميل</span>
            <span className="font-extrabold text-slate-200">{o.customer || "مجهول الاسم"}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block">المحافظة / المنطقة</span>
            <span className="font-black text-slate-100 truncate block">{o.gov} · {o.region}</span>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block">المندوب</span>
            <span className="font-bold text-indigo-400 truncate block">
              {o.courier ? `👤 ${o.courier}` : <span className="text-red-400 font-bold">لم يسند ⚠️</span>}
            </span>
          </div>
          <div className="text-left">
            <span className="text-[9px] text-slate-500 block">الصافي المالي</span>
            <span className="text-xs font-black text-emerald-402 text-emerald-400 font-mono">
              {totalCODValue.toLocaleString("ar")} ج.م
            </span>
          </div>
        </div>

        <div className="border-t border-white/4 pt-1.5 flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1">
            {o.phone && (() => {
              const rawPhone = o.phone.toString().trim();
              const formattedPhone = rawPhone.startsWith('0') ? rawPhone : '0' + rawPhone;
              return (
                <>
                  <a
                    href={`tel:${formattedPhone}`}
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 text-blue-400 rounded-lg border border-white/6 flex items-center justify-center cursor-pointer"
                  >
                    <Phone size={11} />
                  </a>
                  <a
                    href={toWAUrl(o.phone, getOrderWAMessage(o))}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 bg-slate-950 hover:bg-slate-850 text-emerald-400 rounded-lg border border-white/6 flex items-center justify-center cursor-pointer"
                  >
                    <MessageSquare size={11} />
                  </a>
                </>
              );
            })()}
          </div>
          
          <button
            onClick={() => setMobileDrawerOrder(o)}
            className="px-3 py-1 bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-0.5"
          >
            <span>🛠️ إجراء سريع</span>
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="font-sans text-right select-none space-y-4">
      {/* 🔍 Advanced Filter Bar / شريط التصفية المتقدم */}
      <div className="mx-4 p-4 bg-slate-900 border border-white/6 rounded-2xl space-y-4 text-right animate-fadeIn lg:hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2 bg-amber-500/15 text-amber-500 rounded-xl text-xs shrink-0">🎛️</span>
            <div>
              <h3 className="text-xs font-black text-slate-100">بوابة الفلترة الذكية والتصفية المتقدمة</h3>
              <p className="text-[10px] text-slate-400 font-medium mt-0.5">قم بتصفية الشحنات والبحث الفوري حسب المنطقة، الحالة، أو التاريخ دون إبطاء النظام</p>
            </div>
          </div>
          
          {(selectedRegionFilter || selectedDate !== "all" || activeFilter !== "all" || search.trim() || selectedSupplierFilter || selectedCourierFilter) && (
            <button
              onClick={() => {
                setSelectedRegionFilter("");
                setSelectedDate("all");
                setActiveFilter("all");
                setSearch("");
                setSelectedSupplierFilter("");
                setSelectedCourierFilter("");
                setSelected(new Set());
              }}
              className="text-[10px] text-red-400 hover:text-red-300 transition-all font-black cursor-pointer border border-red-900/30 bg-red-950/20 px-3 py-1.5 rounded-xl flex items-center gap-1.5 self-end sm:self-auto"
            >
              <span>🔄 إعادة تعيين كافة الفلاتر</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* 1. Date Filter Dropdown/Input */}
          <div className="space-y-1.5 text-right">
            <label className="text-[10px] font-black text-slate-400 block">📅 تاريخ الطلب</label>
            <div className="flex gap-2">
              <select
                value={selectedDate === "all" ? "all" : lastDays.some(d => d.ymd === selectedDate) ? selectedDate : "custom"}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "all") {
                    setSelectedDate("all");
                  } else if (val === "custom") {
                    setSelectedDate(getTodayDateStr());
                  } else {
                    setSelectedDate(val);
                  }
                  setSelected(new Set());
                }}
                className="flex-1 bg-slate-950 border border-white/6 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none text-right focus:border-amber-500 cursor-pointer"
              >
                <option value="all">🗓️ جميع الأوقات (تصفية مفتوحة)</option>
                {lastDays.map(d => (
                  <option key={d.ymd} value={d.ymd}>{d.label} ({d.ymd})</option>
                ))}
                <option value="custom">📅 تاريخ مخصص...</option>
              </select>

              {(selectedDate !== "all" && !lastDays.some(d => d.ymd === selectedDate)) && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setSelectedDate(e.target.value);
                    } else {
                      setSelectedDate("all");
                    }
                    setSelected(new Set());
                  }}
                  className="bg-slate-950 border border-amber-500/40 rounded-xl py-1 px-2 text-xs font-mono text-amber-400 font-bold outline-none text-center cursor-pointer"
                />
              )}
            </div>
          </div>

          {/* 2. Status Filter Dropdown */}
          <div className="space-y-1.5 text-right">
            <label className="text-[10px] font-black text-slate-400 block">⚙️ حالة الشحنة</label>
            <select
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value);
                setSelected(new Set());
              }}
              className="w-full bg-slate-950 border border-white/6 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none text-right focus:border-amber-500 cursor-pointer"
            >
              {availableStatuses.map(s => (
                <option key={s.key} value={s.key}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* 3. Region Filter Dropdown */}
          <div className="space-y-1.5 text-right">
            <label className="text-[10px] font-black text-slate-400 block">📍 المنطقة / المحافظة</label>
            <select
              value={selectedRegionFilter}
              onChange={(e) => {
                setSelectedRegionFilter(e.target.value);
                setSelected(new Set());
              }}
              className="w-full bg-slate-950 border border-white/6 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none text-right focus:border-amber-500 cursor-pointer"
            >
              <option value="">🗺️ كافة المناطق والمحافظات</option>
              {availableRegions.map(reg => (
                <option key={reg} value={reg}>📍 {reg}</option>
              ))}
            </select>
          </div>

          {/* 4. Advanced Admin Supplier Dropdown Filter */}
          <div className="space-y-1.5 text-right">
            <label className="text-[10px] font-black text-slate-400 block">👤 تصفية حسب المورد</label>
            <select
              value={selectedSupplierFilter}
              onChange={(e) => {
                setSelectedSupplierFilter(e.target.value);
                setSelected(new Set());
              }}
              className="w-full bg-slate-950 border border-white/6 rounded-xl py-2 px-3 text-xs font-bold text-slate-200 outline-none text-right focus:border-amber-500 cursor-pointer text-ellipsis overflow-hidden whitespace-nowrap"
            >
              <option value="">👤 كل الموردين (تصفية مفتوحة)</option>
              {Array.from(new Set(
                (orders || [])
                  .map((o: any) => o.supplier)
                  .filter(Boolean)
                  .map((s: any) => s.toString().trim())
              ))
              .sort((a, b) => a.localeCompare(b, "ar"))
              .map((sup: string) => (
                <option key={sup} value={sup}>👤 {sup}</option>
              ))}
            </select>
          </div>

          {/* 5. Instant Stats */}
          <div className="bg-slate-950 border border-white/4 rounded-xl p-3 flex flex-col justify-between sm:col-span-2 md:col-span-1">
            <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold">
              <span>طرد مطابق للتصفية:</span>
              <span className="font-mono text-amber-400 font-black text-xs">{visibleOrders.length}</span>
            </div>
            
            {selectedSupplierFilter && (
              <div className="mt-1.5 pt-1.5 border-t border-white/5 flex flex-col gap-1 text-right animate-fadeIn">
                <div className="flex items-center justify-between text-[9px] font-bold text-emerald-400 bg-emerald-950/35 border border-emerald-500/15 px-1.5 py-1 rounded-lg">
                  <span className="shrink-0">💰 صافي المطابقة:</span>
                  <span className="font-mono font-black text-xs text-amber-400">{filteredFinancials.netValue.toLocaleString("ar")} ج.م</span>
                </div>
                <div className="text-[8px] text-slate-500 text-right leading-none">
                  (بضاعة: {filteredFinancials.keptGoodsValue.toLocaleString("ar")} - مسددة: {filteredFinancials.settledValue.toLocaleString("ar")})
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-1.5 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[9px] text-slate-400 font-medium leading-none">تحديث فوري دون تحميل</span>
            </div>
          </div>
        </div>
      </div>

      {/* 📱 Mobile Interface (visible on block md:hidden) */}
      <MobileOrders
        orders={orders}
        setOrders={setOrders || (() => {})}
        token={token}
        role={role}
        isAdmin={isAdmin}
        isSuper={isSuper}
        isOps={isOps}
        isAgent={isAgent}
        canManage={canManage}
        canSelectBulk={canSelectBulk}
        canReconcile={canReconcile}
        visibleOrders={visibleOrders}
        statusCounts={statusCounts}
        couriers={couriers}
        search={search}
        setSearch={setSearch}
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        selectedSupplierFilter={selectedSupplierFilter}
        setSelectedSupplierFilter={setSelectedSupplierFilter}
        triggerStatusUpdate={triggerStatusUpdate}
        onRefresh={onRefresh}
        selected={selected}
        setSelected={setSelected}
        getBadgeStyle={getBadgeStyle}
        getOrderWAMessage={getOrderWAMessage}
        toWAUrl={toWAUrl}
        setReturnedSelectOpen={setReturnedSelectOpen}
        setSelectedReturnOrder={setSelectedReturnOrder}
        setDeliveryChoiceOrder={setDeliveryChoiceOrder}
        setPartialAmountInput={setPartialAmountInput}
        histories={histories}
        loadingHistories={loadingHistories}
        expandedHistories={expandedHistories}
        toggleHistory={toggleHistory}
      />

      {/* 🖥️ Desktop Interface (visible on hidden lg:block) */}
      <div className="hidden lg:flex lg:flex-col lg:h-[calc(100vh-130px)] lg:max-h-[calc(100vh-130px)] lg:overflow-hidden space-y-3 pb-3" id="desktop-portal-main">
        {/* Top Control Bar / شريط التحكم العلوي */}
        <div className="flex bg-[#070d1a] px-4 py-2 border border-white/6 rounded-2xl items-center flex-wrap gap-2.5 shrink-0" dir="rtl">
          <div className="relative flex-1 min-w-[200px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 ابحث برقم الأوردر، تليفون، عميل أو مورد..."
              className="w-full bg-slate-900 border border-white/6 rounded-xl py-2 pr-10 pl-4 text-xs font-bold text-slate-200 placeholder-slate-500 text-right outline-none focus:border-amber-500/20"
            />
          </div>

          <div className="relative min-w-[170px]">
            <select
              value={selectedSupplierFilter}
              onChange={(e) => {
                setSelectedSupplierFilter(e.target.value);
                setSelected(new Set());
              }}
              className="bg-slate-900 border border-white/6 rounded-xl py-2 px-3 text-xs font-black text-amber-400 outline-none text-right focus:border-amber-500 hover:bg-slate-850 cursor-pointer w-full"
            >
              <option value="">👤 كافة الشحنات (كل الموردين)</option>
              {Array.from(new Set(
                (roleFilteredOrders || [])
                  .map((o: any) => o.supplier)
                  .filter(Boolean)
                  .map((s: any) => s.toString().trim())
              ))
              .sort()
              .map((sup: string) => (
                <option key={sup} value={sup}>{sup}</option>
              ))}
            </select>
          </div>

          {/* Active Representatives Dropdown Filter / فلتر المندوبين البديل للشريط الجانبي */}
          {(isAdmin || isSuper || isOps) && (
            <div className="relative min-w-[170px]">
              <select
                value={selectedCourierFilter}
                onChange={(e) => {
                  setSelectedCourierFilter(e.target.value);
                  setSelected(new Set());
                }}
                className="bg-slate-900 border border-white/6 rounded-xl py-2 px-3 text-xs font-black text-amber-400 outline-none text-right focus:border-amber-500 hover:bg-slate-850 cursor-pointer w-full text-ellipsis overflow-hidden"
              >
                <option value="">👤 كل مناديب التوصيل</option>
                {Array.from(new Set(roleFilteredOrders.map(o => o.courier).filter(Boolean)))
                .map((courierName: any, idx: number) => (
                  <option key={idx} value={courierName}>👤 {courierName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-2">
            {(isAdmin || isSuper || isOps) && (
              <button
                onClick={() => setShowOperationalReport(!showOperationalReport)}
                className={`px-3 py-1.5 text-[10px] rounded-xl font-black flex items-center gap-1 cursor-pointer transition-all ${
                  showOperationalReport ? "bg-amber-500 text-slate-950" : "bg-slate-900 border border-white/8 text-amber-500"
                }`}
              >
                <span>📋 التقرير العملياتي</span>
              </button>
            )}
            {canReconcile && (
              <button
                onClick={() => setShowReconPortal(!showReconPortal)}
                className={`px-3 py-1.5 text-[10px] rounded-xl font-black flex items-center gap-1 cursor-pointer transition-all ${
                  showReconPortal ? "bg-amber-500 text-slate-950" : "bg-slate-900 border border-white/8 text-amber-500"
                }`}
              >
                <span>⚡ الباركود والإكسيل</span>
              </button>
            )}
            {canSelectBulk && (
              <button
                onClick={toggleSelectAll}
                className="px-3 py-1.5 bg-slate-900 border border-white/8 rounded-xl text-[10px] text-slate-300 font-extrabold cursor-pointer transition-colors"
              >
                {selected.size === visibleOrders.length ? "إلغاء التحديد" : "تحديد الكل"}
              </button>
            )}
            {(isAdmin || isSuper || isOps || (role || "").toString().toLowerCase().includes("محاسب")) && (
              <button
                onClick={exportToCSV}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black text-[10px] rounded-xl flex items-center gap-1 cursor-pointer transition-all"
              >
                <Download size={11} />
                <span>تصدير CSV</span>
              </button>
            )}
          </div>
        </div>

        {/* Main Work Space splits / تقسيمات بيئة العمل الرئيسية */}
        <div id="desktop-portal-main" className="hidden lg:flex flex-1 min-h-0 gap-4 overflow-hidden" dir="rtl">
          {/* Right Panel: Master List (35% Width) / الجانب الأيمن: قائمة الشحنات المكثفة */}
          <div className="w-[35%] h-full flex flex-col bg-[#070d1a]/85 border border-white/6 rounded-2xl p-3 overflow-hidden select-none">
            {/* Horizontal Scrollable Category Ribbon */}
            <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1.5 border-b border-white/5 scrollbar-none shrink-0" dir="rtl">
              {[
                { key: "all", label: "الكل" },
                { key: "جاهز للاستلام من المورد", label: "⏳ جاهز" },
                { key: "جديد", label: "🆕 جديد" },
                { key: "مسند", label: "📋 مسند" },
                { key: "خارج مع المندوب", label: "🚚 مع المندوب" },
                { key: "العميل رد وجاري التسليم", label: "📞 لرد وجاري" },
                { key: "تم التسليم", label: "✅ تم التسليم" },
                { key: "تسليم جزئي", label: "📦 جزئي" },
                { key: "مؤجل", label: "⏳ مؤجل" },
                { key: "العميل لا يرد", label: "📵 لا يرد" },
                { key: "مرتجع بالمستودع", label: "📦 بالمستودع" },
                { key: "تم تسليمه للمورد", label: "↩️ للمورد" }
              ].map((f) => {
                const isSel = activeFilter === f.key;
                const count = statusCounts[f.key] || 0;
                return (
                  <button
                    key={f.key}
                    onClick={() => {
                      setActiveFilter(f.key);
                      setSelected(new Set());
                    }}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                      isSel ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow-md" : "bg-slate-900 border-white/6 text-slate-300 hover:bg-slate-850"
                    }`}
                  >
                    <span>{f.label}</span>
                    <span className={`text-[10px] font-mono font-black rounded px-1 ${isSel ? "bg-slate-950/20 text-slate-950" : "bg-slate-950 text-amber-500"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Compact Dynamic Date Ribbon */}
            <div className="flex gap-1 overflow-x-auto pb-1.5 mb-1.5 border-b border-white/5 scrollbar-none shrink-0" dir="rtl">
              <button
                onClick={() => setSelectedDate("all")}
                className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                  selectedDate === "all" ? "bg-amber-500 text-slate-950 border-amber-500 font-black" : "bg-slate-900 border-white/6 text-slate-300 hover:bg-slate-850"
                }`}
              >
                <span>الكل ({roleFilteredOrders.filter(o => !o.isArchived && o.status !== "مؤرشف").length})</span>
              </button>
              {lastDays.map((day) => {
                const dayOrders = roleFilteredOrders.filter((o: any) => normalizeDateToYMD(o.orderDate || o.createdAt) === day.ymd);
                const count = dayOrders.length;
                const isSel = selectedDate === day.ymd;
                if (count === 0 && !isSel) return null;
                return (
                  <button
                    key={day.ymd}
                    onClick={() => setSelectedDate(day.ymd)}
                    className={`px-2.5 py-1 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-all whitespace-nowrap shrink-0 ${
                      isSel ? "bg-amber-500 text-slate-950 border-amber-500 font-black" : "bg-slate-900 border-white/6 text-slate-300 hover:bg-slate-850"
                    }`}
                  >
                    <span>{day.label}</span>
                    <span className="text-[10px] font-mono opacity-80 ml-1">({count})</span>
                  </button>
                );
              })}
            </div>

            {/* List Header */}
            <div className="flex items-center justify-between pb-1.5 mb-1.5 text-[10.5px] text-slate-400 font-bold px-1 shrink-0">
              <span>القائمة الفورية لطلبات الفرز ({visibleOrders.length})</span>
              <span className="text-[9.5px] text-amber-500">اضغط للشحن والإجراء سريعاً</span>
            </div>

            {/* High-Density Orders List (56px Rows) */}
            <div className="flex-1 overflow-hidden">
              <HighPerformanceVirtualList
                items={visibleOrders}
                itemHeight={56}
                containerHeight="100%"
                renderItem={(o: any) => {
                  const isSelected = desktopSelectedTracking === o.tracking;
                  const totalCODValue = o.totalCOD !== undefined ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
                  return (
                    <div
                      key={o.tracking}
                      onClick={() => setDesktopSelectedTracking(o.tracking)}
                      className={`h-[56px] max-h-[56px] flex items-center justify-between px-3 py-1.5 border-b border-white/5 transition-all cursor-pointer select-none text-right ${
                        isSelected
                          ? "bg-amber-500/10 border-r-4 border-r-amber-500 font-black"
                          : "hover:bg-slate-900/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        {canSelectBulk && (
                          <input
                            type="checkbox"
                            checked={selected.has(o.tracking)}
                            onChange={(e) => {
                              e.stopPropagation();
                              toggleSelect(o.tracking);
                            }}
                            className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 accent-amber-500 cursor-pointer shrink-0"
                          />
                        )}
                        <div className="flex flex-col text-right truncate">
                          <span className="font-mono text-xs font-black text-amber-500">{o.tracking}</span>
                          <span className="text-[10.5px] text-slate-200 font-bold truncate max-w-[120px]" title={o.customer}>
                            {o.customer || "مجهول"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex flex-col items-end text-left shrink-0">
                          <span className="text-[11px] font-black text-emerald-400 font-mono">
                            {totalCODValue.toLocaleString("ar")} ج.م
                          </span>
                          <span className="text-[9px] text-slate-400 font-bold">📍 {o.gov}</span>
                        </div>
                        <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${getBadgeStyle(o.status)}`}>
                          {o.status}
                        </span>
                      </div>
                    </div>
                  );
                }}
              />
            </div>
          </div>

          {/* Left Panel: Details & Action Console (65% Width) / الجانب الأيسر: لوحة تفاصيل العمليات */}
          <div className="w-[65%] h-full flex flex-col bg-[#0a101f]/60 rounded-2xl border border-white/6 p-5 overflow-y-auto scrollbar-thin space-y-4">
            {/* 1. Barcode Reconciliation Panel (Collapsible Card) */}
            {showReconPortal && canReconcile && (
              <div className="p-4 bg-slate-950 border border-amber-500/30 rounded-xl space-y-3 text-right">
                <div className="flex items-center justify-between border-b border-white/6 pb-2">
                  <span className="text-xs font-black text-amber-400">⚡ بوابة التصفية السريعة والتحكم في الشحنات</span>
                  <button onClick={() => setShowReconPortal(false)} className="text-slate-400 text-[10px] hover:text-white">إغلاق ×</button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <label className="block text-[10px] text-slate-400">رقم التتبع (FP-XXXX-XX)</label>
                    <input
                      type="text"
                      value={reconcileBarcode}
                      onChange={(e) => setReconcileBarcode(e.target.value)}
                      placeholder="اكتب رقم التتبع واضغط Enter..."
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs font-black text-slate-200 outline-none text-right"
                      onKeyDown={(e) => { if (e.key === "Enter") handleSingleReconciliation(); }}
                    />
                    <select
                      value={reconcileStatus}
                      onChange={(e) => setReconcileStatus(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-slate-200"
                    >
                      <option value="تم التسليم">✅ تم التسليم</option>
                      <option value="مرتجع">↩️ مرتجع (تجهيز تصفية)</option>
                      <option value="تم تسليم المرتجع للمورد">📦 تصفية المرتجع للمورد</option>
                      <option value="خارج مع المندوب">🚚 خارج مع المندوب</option>
                    </select>
                    <button onClick={handleSingleReconciliation} disabled={reconLoading} className="w-full py-1.5 bg-amber-500 text-slate-950 font-black text-[10px] rounded-lg">تحديث الحالة</button>
                  </div>
                  <div className="space-y-2 border-r border-white/5 pr-3">
                    <span className="text-[10px] font-bold text-slate-400 block">📄 رفع ملف تصفية سريع (CSV)</span>
                    <button onClick={() => fileInputRef.current?.click()} className="w-full py-2 bg-slate-900 text-slate-300 border border-white/8 rounded-lg text-[10.5px]">رفع شيت للتصفية</button>
                    <input type="file" ref={fileInputRef} accept=".csv" onChange={handleReconExcelUpload} className="hidden" />
                    {reconExcelMsg && <div className="text-[9.5px] text-emerald-400 mt-1 bg-emerald-950/20 p-1.5 rounded">{reconExcelMsg}</div>}
                  </div>
                </div>
                {reconFeedback && <div className="text-[10px] text-amber-400 text-center font-bold bg-slate-900 p-1.5 rounded">{reconFeedback}</div>}
              </div>
            )}

            {/* 2. Supplier Dashboard Stats (Collapsible Card) */}
            {selectedSupplierStats && (
              <div className="p-3.5 bg-gradient-to-br from-amber-600/10 to-[#070d1a] border border-amber-500/20 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-white/5 pb-1.5">
                  <span className="text-xs font-black text-slate-200">📊 إحصائيات المورد <span className="text-amber-400">{selectedSupplierFilter}</span></span>
                  <button onClick={() => setSelectedSupplierFilter("")} className="text-[10px] text-red-400 hover:text-red-300">✕ إلغاء الفلترة</button>
                </div>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5 text-center">
                  <div className="p-1 bg-slate-950/50 rounded-lg"><div className="text-[8px] text-slate-400">إجمالي</div><div className="font-mono text-xs font-black">{selectedSupplierStats.total}</div></div>
                  <div className="p-1 bg-slate-950/50 rounded-lg text-blue-400"><div className="text-[8px]">جديد</div><div className="font-mono text-xs font-black">{selectedSupplierStats.newCount}</div></div>
                  <div className="p-1 bg-slate-950/50 rounded-lg text-yellow-500"><div className="text-[8px]">خارج</div><div className="font-mono text-xs font-black">{selectedSupplierStats.outForDelivery}</div></div>
                  <div className="p-1 bg-slate-950/50 rounded-lg text-emerald-400"><div className="text-[8px]">تم تسليم</div><div className="font-mono text-xs font-black">{selectedSupplierStats.delivered}</div></div>
                  <div className="p-1 bg-slate-950/50 rounded-lg text-amber-500"><div className="text-[8px]">مرتجع</div><div className="font-mono text-xs font-black">{selectedSupplierStats.returnedInWarehouse}</div></div>
                  <div className="p-1 bg-slate-950/50 rounded-lg text-red-400"><div className="text-[8px]">للمورد</div><div className="font-mono text-xs font-black">{selectedSupplierStats.returnedDelivered}</div></div>
                  <div className="p-1 bg-slate-950/50 rounded-lg text-purple-400"><div className="text-[8px]">مؤجل</div><div className="font-mono text-xs font-black">{selectedSupplierStats.pending}</div></div>
                </div>
              </div>
            )}

            {/* 3. Courier Operational counters (Collapsible Card) */}
            {isAgent && (() => {
              const myTotal = backgroundCourierKPIs.myTotal;
              const myDelivered = backgroundCourierKPIs.myDelivered;
              const myPartialDelivered = backgroundCourierKPIs.myPartialDelivered;
              const myReturned = backgroundCourierKPIs.myReturned;
              const mySuspended = backgroundCourierKPIs.mySuspended;
              const myRemaining = backgroundCourierKPIs.myRemaining;
              const totalReceivedCashInHand = backgroundCourierKPIs.totalReceivedCashInHand;
              const totalCommissionsEarned = backgroundCourierKPIs.totalCommissionsEarned;
              const netRequiredHandover = backgroundCourierKPIs.netRequiredHandover;
              return (
                <div className="p-4 bg-gradient-to-br from-indigo-950/10 to-slate-950 border border-white/6 rounded-xl space-y-3 text-right">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="text-xs font-black text-slate-200">💸 لوحة تسوية المندوب المالية والعهد</span>
                    <span className="text-[8.5px] font-bold text-indigo-400">حسابات التوريد الآلية</span>
                  </div>
                  <div className="grid grid-cols-6 gap-2 text-center text-[10.5px]">
                    <div className="p-1.5 bg-slate-900 rounded-lg"><div>إجمالي</div><div className="font-mono font-black text-slate-200">{myTotal}</div></div>
                    <div className="p-1.5 bg-emerald-950/15 rounded-lg text-emerald-400"><div>تسليم</div><div className="font-mono font-black">{myDelivered}</div></div>
                    <div className="p-1.5 bg-cyan-950/15 rounded-lg text-cyan-400"><div>جزئي</div><div className="font-mono font-black">{myPartialDelivered}</div></div>
                    <div className="p-1.5 bg-red-950/15 rounded-lg text-red-400"><div>مرتجع</div><div className="font-mono font-black">{myReturned}</div></div>
                    <div className="p-1.5 bg-amber-950/15 rounded-lg text-amber-500"><div>معلق</div><div className="font-mono font-black">{mySuspended}</div></div>
                    <div className="p-1.5 bg-blue-950/15 rounded-lg text-blue-400"><div>الحقيبة</div><div className="font-mono font-black">{myRemaining}</div></div>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5 pt-1.5 border-t border-white/5 text-[10.5px]">
                    <div><span className="text-slate-400 block text-[9px]">💵 كاش مستلم:</span><span className="font-mono font-black text-emerald-400">{totalReceivedCashInHand.toLocaleString("ar")} ج.م</span></div>
                    <div><span className="text-slate-400 block text-[9px]">🎖️ عمولاتك:</span><span className="font-mono font-black text-indigo-400">-{totalCommissionsEarned.toLocaleString("ar")} ج.م</span></div>
                    <div><span className="text-slate-400 block text-[9px]">⛽ عهد وتوريدات:</span><span className="font-mono font-black text-indigo-300">{netRequiredHandover.toLocaleString("ar")} ج.م</span></div>
                  </div>
                </div>
              );
            })()}

            {/* Core Order Card display or placeholder / عرض بيانات الأوردر الفردي */}
            {(() => {
              const activeOrder = desktopSelectedTracking 
                ? visibleOrders.find((o: any) => o.tracking === desktopSelectedTracking) 
                : null;
              
              if (!activeOrder) {
                return (
                  <div className="flex flex-col items-center justify-center flex-1 text-center p-8 space-y-3 text-slate-400 select-none">
                    <div className="w-14 h-14 rounded-2xl bg-slate-950/50 border border-white/6 flex items-center justify-center text-2xl animate-pulse">
                      📦
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-xs font-black text-slate-200">يرجى تحديد شحنة من القائمة اليمنى لعرض تفاصيلها واتخاذ الإجراءات</h4>
                      <p className="text-[10px] text-slate-500 max-w-sm leading-relaxed mx-auto">
                        تسمح اللوحة المقسومة باستعراض الشحنات بسرعة فائقة، وتعديل الحالات، والتواصل مع المندوب أو المورد والعملاء في ثوانٍ.
                      </p>
                    </div>
                  </div>
                );
              }

              return (
                <div className="animate-in fade-in duration-200">
                  <OrderCard
                    key={activeOrder.tracking}
                    o={activeOrder}
                    isSel={selected.has(activeOrder.tracking)}
                    isExpanded={!!expandedHistories[activeOrder.tracking]}
                    isLoadingHistory={!!loadingHistories[activeOrder.tracking]}
                    historyList={histories[activeOrder.tracking]}
                    render={renderOrderCard}
                  />
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Floating Smart Action Bar (Bulk Action with Role-Based Permissions) */}
      {selected.size > 0 && canSelectBulk && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 w-[95%] lg:w-[70%] xl:w-[60%] max-w-5xl bg-slate-950/95 backdrop-blur-lg border border-amber-500/40 rounded-2xl md:rounded-full p-3 px-5 shadow-[0_-10px_40px_rgba(0,0,0,0.85),0_0_25px_rgba(245,158,11,0.15)] z-[9999] text-right flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300" dir="rtl">
          
          {/* Right Section: Counter Tag and Deselect All Button */}
          <div className="flex items-center justify-between w-full md:w-auto gap-3">
            <span className="text-xs font-black text-amber-400 bg-amber-500/10 px-3.5 py-2 rounded-full border border-amber-500/20 flex items-center gap-1.5 shrink-0 select-none">
              <span className="animate-pulse">⚡</span>
              <span>تم تحديد <strong className="font-mono text-sm text-white px-0.5">{selected.size}</strong> شحنة</span>
            </span>
            <button
              onClick={() => {
                setSelected(new Set());
                setFloatingStatus("");
                setFloatingCourier("");
                setFloatingNotes("");
                setFloatingDate("");
                setShowAssignPopover(false);
                setShowStatusPopover(false);
              }}
              className="text-[10px] text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-950 px-3 py-2 rounded-full border border-white/6 font-bold cursor-pointer transition-all shrink-0"
            >
              إلغاء التحديد
            </button>
          </div>

          {/* Left Section: Compact Dropdowns & Actions */}
          <div className="flex items-center gap-3 w-full md:w-auto justify-end relative flex-wrap md:flex-nowrap">
            
            {/* 1. Assign to Courier Button & Popover (Admins & Supervisors only) */}
            {(isAdmin || isSuper) && (
              <div className="relative">
                <button
                  onClick={() => {
                    setShowAssignPopover(!showAssignPopover);
                    setShowStatusPopover(false);
                  }}
                  className={`px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                    showAssignPopover
                      ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow-lg"
                      : "bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800"
                  }`}
                >
                  <span>🚚</span>
                  <span>إسناد لمندوب</span>
                  {floatingCourier && (
                    <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                      {floatingCourier === "reset_warehouse" ? "المستودع" : floatingCourier}
                    </span>
                  )}
                </button>

                {/* Courier Popover Menu */}
                {showAssignPopover && (
                  <div className="absolute bottom-full mb-3 right-0 md:right-auto md:left-0 w-72 bg-slate-950/98 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl z-[99999] space-y-3 text-right text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
                    <div className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="font-black text-amber-400">إسناد لمندوب جماعياً</span>
                      <button 
                        onClick={() => setShowAssignPopover(false)}
                        className="text-slate-400 hover:text-white font-bold"
                      >
                        ×
                      </button>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="block text-[10px] text-slate-400 font-bold">المندوب المسؤول</label>
                        <SearchableCourierSelect
                          value={floatingCourier}
                          onChange={(val) => setFloatingCourier(val)}
                          couriers={couriers}
                          placeholder="-- اختر المندوب --"
                          showWarehouseReset={true}
                        />
                      </div>
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={async () => {
                            if (!floatingCourier) {
                              alert("يرجى تحديد مندوب أولاً");
                              return;
                            }
                            await saveFloatingBulkUpdate();
                            setShowAssignPopover(false);
                          }}
                          className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center"
                        >
                          تأكيد الإسناد
                        </button>
                        <button
                          onClick={() => setShowAssignPopover(false)}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-white/8 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 2. Batch Update Status Button & Popover */}
            <div className="relative">
              <button
                onClick={() => {
                  setShowStatusPopover(!showStatusPopover);
                  setShowAssignPopover(false);
                }}
                className={`px-4 py-2 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer ${
                  showStatusPopover
                    ? "bg-amber-500 text-slate-950 border-amber-500 font-extrabold shadow-lg"
                    : "bg-slate-900 text-slate-200 border-white/10 hover:bg-slate-800"
                }`}
              >
                <span>⚙️</span>
                <span>تغيير الحالة</span>
                {floatingStatus && (
                  <span className="bg-amber-500/20 text-amber-300 text-[9px] px-1.5 py-0.5 rounded-full font-mono font-bold">
                    {floatingStatus}
                  </span>
                )}
              </button>

              {/* Status Popover Menu */}
              {showStatusPopover && (
                <div className="absolute bottom-full mb-3 left-0 w-80 bg-slate-950/98 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-4 shadow-2xl z-[99999] space-y-3 text-right text-xs animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <span className="font-black text-amber-400">تغيير حالة الشحنات جماعياً</span>
                    <button 
                      onClick={() => setShowStatusPopover(false)}
                      className="text-slate-400 hover:text-white font-bold"
                    >
                      ×
                    </button>
                  </div>
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="block text-[10px] text-slate-400 font-bold">تحديد الحالة الجديدة</label>
                      <select
                        value={floatingStatus}
                        onChange={(e) => setFloatingStatus(e.target.value)}
                        className="w-full bg-slate-900 text-slate-100 border border-white/8 rounded-xl px-2.5 py-2 text-xs text-right cursor-pointer focus:outline-none focus:border-amber-500"
                      >
                        {isReturnsOfficer && (
                          <>
                            <option value="">-- اختر إجراء المرتجعات الجماعي --</option>
                            <option value="تم تسليم المرتجع للمورد">تم تسليم المرتجع للمورد وتصفية حسابه</option>
                          </>
                        )}

                        {isOps && (
                          <>
                            <option value="">-- اختر إجراء العمليات الجماعي --</option>
                            <option value="تم رد العميل وجاري التنسيق">تم رد العميل وجاري التنسيق</option>
                            <option value="لا يرد - محاولة أولى/ثانية">لا يرد - محاولة أولى/ثانية</option>
                            <option value="تحديث نتيجة الاتصال">تحديث نتيجة الاتصال</option>
                            <option value="العميل لغى الأوردر / مرتجع">العميل لغى الأوردر / مرتجع ❌</option>
                          </>
                        )}

                        {isAgent && (
                          <>
                            <option value="">-- اختر إجراء التوصيل الجماعي المندوب --</option>
                            <option value="تم التسليم بنجاح">تم التسليم بنجاح</option>
                            <option value="مؤجل بناءً على طلب العميل">مؤجل بناءً على طلب العميل</option>
                          </>
                        )}

                        {(isAdmin || isSuper) && (
                          <>
                            <option value="">-- اختر حالة الأوردرات المحددة --</option>
                            {Array.from(selected).every(tr => orders.find(x => x.tracking === tr)?.status === "جديد") && (
                              <option value="جديد">جديد (إعادة للانتظار)</option>
                            )}
                            <option value="تم الإسناد">تم الإسناد</option>
                            <option value="مُسند جديد">مُسند جديد</option>
                            <option value="خارج مع المندوب">خارج مع المندوب</option>
                            <option value="تم التسليم">تم التسليم (ناجح كاش)</option>
                            <option value="تسليم جزئي">تسليم جزئي</option>
                            <option value="العميل رد وجاري التسليم">العميل رد وجاري التسليم</option>
                            <option value="مرتجع بالمستودع">مرتجع بالمستودع</option>
                            <option value="تم تسليم المرتجع للمورد">تم تسليم المرتجع للمورد</option>
                            <option value="مرتجع">مرتجع (من طرف العميل)</option>
                            <option value="مؤجل">مؤجل (متابعة لاحقة)</option>
                            <option value="لا يوجد رد">لا يوجد رد</option>
                          </>
                        )}
                      </select>
                    </div>

                    {/* Sub-fields for Operations logs or delay captures */}
                    {(isOps || isAdmin || isSuper || floatingStatus === "مؤجل بناءً على طلب العميل" || floatingStatus === "تحديث نتيجة الاتصال") && (
                      <div className="grid grid-cols-2 gap-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="space-y-1">
                          <label className="block text-[10px] text-indigo-400 font-bold">الملاحظات الجماعية</label>
                          <input
                            type="text"
                            value={floatingNotes}
                            onChange={(e) => setFloatingNotes(e.target.value)}
                            placeholder="ملاحظات الاتصال الهاتفي..."
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1.5 text-[10px] text-right text-slate-200 placeholder-slate-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="block text-[10px] text-indigo-400 font-bold">التاريخ المؤجل</label>
                          <input
                            type="date"
                            value={floatingDate}
                            onChange={(e) => setFloatingDate(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-2.5 py-1 text-[10px] text-slate-200 [color-scheme:dark] text-center"
                          />
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={async () => {
                          if (!floatingStatus) {
                            alert("يرجى اختيار حالة أولاً");
                            return;
                          }
                          await saveFloatingBulkUpdate();
                          setShowStatusPopover(false);
                        }}
                        className="flex-1 py-2 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer shadow-md transition-all active:scale-95 text-center"
                      >
                        تأكيد الحالة
                      </button>
                      <button
                        onClick={() => setShowStatusPopover(false)}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-white/8 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Print Thermal Labels Button */}
            <button
              onClick={() => setIsPrintModalOpen(true)}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-white/8 text-slate-200 font-bold text-xs rounded-full cursor-pointer transition-all flex items-center justify-center gap-1.5 shadow-md"
              title="طباعة ملصقات حرارية جماعية"
            >
              <Printer size={13} className="text-amber-500 animate-pulse" />
              <span>طباعة الملصقات ({selected.size})</span>
            </button>

          </div>
        </div>
      )}

      {/* Orders List Workspace with Quick Representative Selection Sidebar */}
      <div className="px-4 lg:hidden">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-start">
          
          {/* Active Representatives Sidebar Selector (Show for Admins, Supervisors and Operations) */}
          {(isAdmin || isSuper || isOps) && (
            <div className="lg:col-span-1 bg-slate-900/80 p-4 rounded-2xl border border-white/6 h-fit space-y-4 text-right" dir="rtl">
              <div className="flex items-center justify-between border-b border-white/5 pb-2.5">
                <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 select-none">
                  <span>👤</span> مندوبو التوصيل النشطون ({Array.from(new Set(roleFilteredOrders.map(o => o.courier).filter(Boolean))).length})
                </span>
                {selectedCourierFilter && (
                  <button
                    onClick={() => setSelectedCourierFilter("")}
                    className="text-[10px] text-red-400 hover:text-red-300 transition-colors font-extrabold cursor-pointer border border-red-900/30 bg-red-950/20 px-2 py-0.5 rounded"
                  >
                    إلغاء ×
                  </button>
                )}
              </div>
              
              <div className="flex flex-row lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible lg:max-h-[500px] overflow-y-auto scrollbar-thin pb-2 lg:pb-0">
                {/* Select All Couriers */}
                <button
                  onClick={() => setSelectedCourierFilter("")}
                  className={`w-full text-right p-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer shrink-0 min-w-[200px] lg:min-w-0 ${
                    !selectedCourierFilter
                      ? "bg-amber-500 text-slate-950 border-amber-500 font-black shadow-lg shadow-amber-500/10"
                      : "bg-slate-950 text-slate-300 border-white/4 hover:text-white hover:border-white/10"
                  }`}
                >
                  <span className="font-black">كل مناديب التوصيل (عرض الكل)</span>
                  <span className={`text-[9.5px] px-1.5 py-0.5 rounded font-mono font-bold ${
                    !selectedCourierFilter ? "bg-amber-600/30 text-amber-950" : "bg-slate-900 text-slate-400"
                  }`}>
                    {roleFilteredOrders.filter(o => o.courier).length} طرد
                  </span>
                </button>

                {/* Individual Couriers with count of active orders */}
                {Array.from(new Set(
                  (roleFilteredOrders || [])
                    .map((o: any) => o.courier)
                    .filter(Boolean)
                    .map((c: any) => c.toString().trim())
                ))
                .sort()
                .map((courierNameRaw) => {
                  const courierName = String(courierNameRaw);
                  const activeCountForCourier = roleFilteredOrders.filter(
                    (o: any) => o.courier && o.courier.toString().trim().toLowerCase() === courierName.toLowerCase()
                  ).length;
                  
                  const isSelected = selectedCourierFilter.toLowerCase() === courierName.toLowerCase();

                  return (
                    <button
                      key={courierName}
                      onClick={() => setSelectedCourierFilter(isSelected ? "" : courierName)}
                      className={`w-full text-right p-3 rounded-xl text-xs font-bold transition-all border flex items-center justify-between cursor-pointer shrink-0 min-w-[170px] lg:min-w-0 ${
                        isSelected
                          ? "bg-purple-600 text-white border-purple-500 font-black shadow-md shadow-purple-500/15"
                          : "bg-slate-950 text-slate-350 border-white/4 hover:text-white"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="opacity-75">👤</span>
                        <span className="truncate">{courierName}</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                        isSelected ? "bg-purple-950 text-purple-300" : "bg-slate-900 text-slate-400"
                      }`}>
                        {activeCountForCourier} طرد
                      </span>
                    </button>
                  );
                })}

                {/* If no couriers have orders */}
                {roleFilteredOrders.filter(o => o.courier).length === 0 && (
                  <p className="text-[10px] text-slate-500 text-center py-4 w-full select-none font-sans font-bold">لا يوجد مناديب نشطين اليوم</p>
                )}
              </div>
            </div>
          )}

          {/* Orders list workspace itself (takes 3 grid cols on desktop, full-width on mobile or if sidebar hidden) */}
          <div className={`${(isAdmin || isSuper || isOps) ? "lg:col-span-3 space-y-4 pb-4" : "col-span-1 lg:col-span-4 space-y-4 pb-4"} w-full`}>
            {visibleOrders.length === 0 ? (
              <div className="text-center py-12 text-xs text-slate-500 space-y-2 bg-slate-900/20 rounded-2xl border border-white/4 p-8">
                <div>📭</div>
                <p>لا توجد شحنات مطابقة لخيارات التصفية الحالية</p>
                {selectedCourierFilter && (
                  <button 
                    onClick={() => setSelectedCourierFilter("")}
                    className="text-[10px] text-amber-500 underline font-black cursor-pointer bg-amber-950/10 px-2 py-1 rounded border border-amber-900/30"
                  >
                    رؤية شحنات بقية المناديب
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* 1. Single-Column Scrolling Layout for tablet/medium viewports (lg:hidden) */}
                <div className="block lg:hidden">
                  <HighPerformanceVirtualList
                    items={visibleOrders}
                    itemHeight={320}
                    containerHeight="720px"
                    renderItem={(o: any) => (
                      <OrderCard
                        key={o.tracking}
                        o={o}
                        isSel={selected.has(o.tracking)}
                        isExpanded={!!expandedHistories[o.tracking]}
                        isLoadingHistory={!!loadingHistories[o.tracking]}
                        historyList={histories[o.tracking]}
                        render={renderOrderCard}
                      />
                    )}
                  />
                </div>

                {/* 2. Master-Detail Split Screen Layout for desktop/laptop viewports (lg:flex) */}
                <div className="hidden lg:flex gap-4 h-[780px] overflow-hidden text-right" dir="rtl">
                  {/* Left Panel: Detail & Actions (65%) */}
                  <div className="w-[65%] flex flex-col h-full bg-[#0a101f]/60 rounded-2xl border border-white/6 p-5 overflow-y-auto scrollbar-thin space-y-4">
                    {(() => {
                      const activeOrder = desktopSelectedTracking 
                        ? visibleOrders.find((o: any) => o.tracking === desktopSelectedTracking) 
                        : null;
                      
                      if (!activeOrder) {
                        return (
                          <div className="flex flex-col items-center justify-center h-full text-center p-8 space-y-4 text-slate-400 select-none">
                            <div className="w-16 h-16 rounded-2xl bg-slate-950/50 border border-white/6 flex items-center justify-center text-3xl animate-pulse">
                              📦
                            </div>
                            <div className="space-y-1">
                              <h4 className="text-sm font-black text-slate-200">بوابة تفاصيل الشحنات اللوجستية</h4>
                              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                                يرجى اختيار شحنة من القائمة اليسرى لعرض كافة البيانات التاريخية، والملاحظات، والإجراءات اللوجستية المتاحة لها.
                              </p>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <OrderCard
                            key={activeOrder.tracking}
                            o={activeOrder}
                            isSel={selected.has(activeOrder.tracking)}
                            isExpanded={!!expandedHistories[activeOrder.tracking]}
                            isLoadingHistory={!!loadingHistories[activeOrder.tracking]}
                            historyList={histories[activeOrder.tracking]}
                            render={renderOrderCard}
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {/* Right Panel: Master List (35%) */}
                  <div className="w-[35%] flex flex-col h-full bg-slate-900/60 rounded-2xl border border-white/6 p-3 overflow-hidden">
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 text-xs text-slate-400 font-bold px-1 select-none">
                      <span>القائمة المدمجة ({visibleOrders.length})</span>
                      <span className="text-[10px]">اضغط على الطلب لعرض تفاصيله</span>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <HighPerformanceVirtualList
                        items={visibleOrders}
                        itemHeight={70}
                        containerHeight="100%"
                        renderItem={(o: any) => {
                          const isSelected = desktopSelectedTracking === o.tracking;
                          const totalCODValue = o.totalCOD !== undefined ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0));
                          return (
                            <div
                              key={o.tracking}
                              onClick={() => setDesktopSelectedTracking(o.tracking)}
                              className={`h-[68px] flex flex-col justify-between p-2.5 rounded-xl border transition-all cursor-pointer select-none text-right mb-1.5 ${
                                isSelected
                                  ? "bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/5 border-r-4 border-r-amber-500 font-black"
                                  : "bg-slate-950/60 border-white/4 hover:bg-slate-900/60 hover:border-white/10"
                              }`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <div className="flex items-center gap-1 font-mono text-[11px] font-extrabold text-amber-550 text-amber-500">
                                  {canSelectBulk && (
                                    <input
                                      type="checkbox"
                                      checked={selected.has(o.tracking)}
                                      onChange={(e) => {
                                        e.stopPropagation(); // Don't trigger row selection details
                                        toggleSelect(o.tracking);
                                      }}
                                      className="w-3.5 h-3.5 rounded border-white/10 bg-slate-950 text-amber-500 accent-amber-500 cursor-pointer"
                                    />
                                  )}
                                  <span>{o.tracking}</span>
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-slate-300 font-bold truncate max-w-[150px]">
                                  <span className="truncate">📍 {o.gov}</span>
                                  <span className={`text-[8.5px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${getBadgeStyle(o.status)}`}>
                                    {o.status}
                                  </span>
                                </div>
                              </div>
                              
                              <div className="flex items-center justify-between text-xs mt-0.5">
                                <span className="font-bold text-slate-300 truncate max-w-[120px]">{o.customer || "مجهول"}</span>
                                <span className="font-black text-emerald-400 font-mono text-[11px]">
                                  {totalCODValue.toLocaleString("ar")} ج.م
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      </div>

      {/* Today's hold-ups ("معلقات اليوم") at the bottom of the courier screen */}
      {isAgent && suspendedOrders.length > 0 && (
        <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center justify-between px-4">
            <h3 className="text-xs font-black text-amber-500 bg-amber-950/20 px-4 py-2 border border-amber-900/40 rounded-xl flex items-center gap-2">
              <span>⏳ معلقات اليوم (المؤجلات وعدم الرد) ({suspendedOrders.length})</span>
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">شحنات معلقة تحتاج إعادة محاولة لاحقاً</p>
          </div>
          <div className="px-4 space-y-4">
            {suspendedOrders.map((o) => (
              <OrderCard
                key={o.tracking}
                o={o}
                isSel={selected.has(o.tracking)}
                isExpanded={!!expandedHistories[o.tracking]}
                isLoadingHistory={!!loadingHistories[o.tracking]}
                historyList={histories[o.tracking]}
                render={renderOrderCard}
              />
            ))}
          </div>
        </div>
      )}

      {/* Swallow old list map compile-safely to bypass duplicate rendering logic */}
      {false && (
        <div className="hidden">
          {visibleOrders.map((o) => {
            const isSel = selected.has(o.tracking);
            return (
              <div
                key={o.tracking}
                className={`bg-slate-900 border rounded-2xl p-5 space-y-4 relative transition-all ${
                  isSel ? "border-amber-500 ring-2 ring-amber-500/10" : "border-white/6"
                }`}
              >
                {/* Header components */}
                <div className="flex items-start justify-between border-b border-white/4 pb-3">
                  <div className="flex items-center gap-3">
                    {canSelectBulk && (
                      <input
                        type="checkbox"
                        checked={isSel}
                        onChange={() => toggleSelect(o.tracking)}
                        className="w-4 h-4 rounded border-white/10 bg-slate-950 text-amber-500 accent-amber-500 cursor-pointer"
                      />
                    )}
                    <div>
                      <div className="text-sm font-black text-amber-550 tracking-wider flex items-center gap-2">
                        <span>{o.tracking}</span>
                        {/* Edit & Delete panels inline with Tracking ID to prevent overlaps */}
                        {isAdmin && (
                          <div className="flex gap-1 mr-2">
                            <button
                              onClick={() => setEditOrder(o)}
                              className="p-1 px-1.5 bg-slate-950 text-indigo-400 hover:text-indigo-200 rounded-md border border-white/6 cursor-pointer"
                              title="تعديل الأوردر"
                            >
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={() => deleteOrderDirect(o.tracking)}
                              className="p-1 px-1.5 bg-slate-950 text-red-400 hover:text-red-200 rounded-md border border-white/6 cursor-pointer"
                              title="حذف الأوردر"
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 font-bold mt-0.5">
                        {o.createdAt.substring(0, 10)} {o.supplier && `· ${o.supplier}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {(o.status === "مرتجع بالمستودع" || o.status === "مرتجع في المستودع" || o.status === "مرتجع جزئي بالمستودع") && (o.isPartial === true || o.isPartial === "true" || Number(o.actualReceivedCash || o.partialAmount || 0) > 0) && (
                      <span className="px-1.5 py-0.5 text-[8.5px] font-black bg-red-950 text-amber-400 border border-red-500/40 rounded shadow-sm animate-pulse whitespace-nowrap">
                        ⚠️ مرتجع جزئي ({o.actualReceivedCash || o.partialAmount || 0} ج.م)
                      </span>
                    )}
                    <span className={`px-2 py-0.5 text-[9px] font-black rounded ${getBadgeStyle(o.status)}`}>
                      {o.status}
                    </span>
                  </div>
                </div>

                {/* Details components (hide/show sensitive elements as per role controls) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-y-2.5 gap-x-4 text-xs">
                  {/* Customer customer name */}
                  <div className="flex items-center gap-2 text-slate-350">
                    <User size={14} className="text-slate-500" />
                    <span>العميل: <span className="font-bold text-slate-200">{o.customer || "غير مسجل"}</span></span>
                  </div>

                  {/* Telephone display without secondary a button duplication */}
                  {o.phone && (
                    <div className="flex items-center gap-2 text-slate-350 font-mono">
                      <Phone size={14} className="text-slate-500" />
                      <span>الهاتف: <span className="text-slate-200 font-bold">{o.phone}</span> {o.phone2 && ` / ${o.phone2}`}</span>
                    </div>
                  )}

                  {/* Shipping address details */}
                  <div className="flex items-center justify-between gap-2 text-slate-350 bg-slate-900/40 p-2.5 rounded-xl border border-white/5 flex-col md:flex-row align-start md:align-center">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <MapPin size={14} className="text-slate-500" />
                        <span className="text-xs">العنوان: <span className="font-bold text-slate-250">{o.gov} · {o.region} · {o.address}</span></span>
                      </div>
                      
                      {o["موقع العميل/الخريطة"] ? (
                        <div className="inline-flex items-center gap-1.5 text-[9.5px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-900/30 font-bold font-mono max-w-fit mt-0.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          📍 تم ربط الموقع الفعلي للعميل عبر واتساب
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSimulateLocation(o.tracking)}
                          className="mt-1 text-[9px] bg-amber-500/10 hover:bg-amber-500/25 border border-amber-500/35 text-amber-300 font-bold px-2 py-0.5 rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer max-w-fit"
                        >
                          💬 محاكاة استقبال موقع العميل (واتساب)
                        </button>
                      )}
                    </div>
                    <a
                      href={o["موقع العميل/الخريطة"] || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.gov} ${o.region} ${o.address}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`shrink-0 border font-bold text-[10px] px-2.5 py-1.5 rounded-lg flex items-center gap-1 transition active:scale-95 cursor-pointer ${
                        o["موقع العميل/الخريطة"]
                          ? "bg-emerald-500/20 hover:bg-emerald-500/35 border-emerald-500/35 text-emerald-300"
                          : "bg-indigo-500/20 hover:bg-indigo-500/35 border-indigo-500/30 text-indigo-300"
                      }`}
                    >
                      <MapPin size={11} className={o["موقع العميل/الخريطة"] ? "text-emerald-400" : "text-indigo-400"} />
                      <span>{o["موقع العميل/الخريطة"] ? "عرض لوكيشن العميل الفعلي" : "توجيه الخرائط GPS"}</span>
                    </a>
                  </div>

                  {/* Financial settle details */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="text-slate-350 flex items-center gap-2">
                      <span className="text-sm">💵</span>
                      <span>إجمالي التحصيل المستحق: <span className="text-sm font-black text-emerald-400 font-mono">{(o.totalCOD || o.prodPrice || 0).toLocaleString("ar")} ج.م</span></span>
                    </div>
                    <span className="text-[9px] text-slate-500 font-bold font-mono">
                      منتج: {o.prodPrice} · شحن: {o.shipPrice}
                    </span>
                  </div>

                  {/* Hide or show sensitive courier assignments for Suppliers / Couriers */}
                  {!isSupplier && o.courier && (
                    <div className="flex items-center gap-2 text-slate-350">
                      <Truck size={14} className="text-slate-500" />
                      <span>المندوب: <span className="font-bold text-indigo-400">{o.courier}</span></span>
                    </div>
                  )}

                   {o.notes ? (
                    <div className="col-span-1 md:col-span-2 p-2.5 bg-slate-950/40 rounded-xl text-[11px] text-slate-400 border border-white/4 leading-relaxed">
                      💬 <span className="font-bold">ملاحظات:</span> {o.notes}
                    </div>
                  ) : (
                    <div className="col-span-1 md:col-span-2 p-2 bg-slate-950/20 rounded-xl text-[10px] text-slate-500 italic text-center">
                      لا توجد ملاحظات مسجلة على هذه الشحنة بعد.
                    </div>
                  )}

                  {/* CS Action Logs Timeline (Blueprint v100) */}
                  {o.actionLogs && o.actionLogs.length > 0 && (
                    <div className="col-span-1 md:col-span-2 bg-slate-950/60 p-3 rounded-xl border border-white/4 text-right space-y-2">
                      <span className="text-[10px] font-black text-amber-500 block">📊 جدول زمني للإجراءات وخدمة العملاء (CS Timeline):</span>
                      <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-thin pl-1">
                        {o.actionLogs.map((log: any, lIdx: number) => (
                          <div key={lIdx} className="relative flex gap-2.5 items-start text-[10.5px] border-r-2 border-white/10 pr-3 pb-1">
                            <div className="absolute right-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-amber-500/80 shadow shadow-amber-500" />
                            <div className="flex-1 space-y-0.5 leading-relaxed">
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-slate-300">{log.user || "نظام لوجستي آلي"}</span>
                                <span className="text-[9px] font-mono text-slate-500">{log.dateTime}</span>
                              </div>
                              <p className="text-slate-400 font-medium">{log.text}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* نظام الملاحظات السياقية وبوابة الواتساب السريعة للاتصال والتصعيد */}
                  <div className="col-span-1 md:col-span-2 mt-1 pt-2 border-t border-white/4 space-y-2">
                    <div className="flex flex-col md:flex-row gap-2">
                      <input
                        id={`quick-note-compact-${o.tracking}`}
                        type="text"
                        placeholder="اكتب نتيجة الاتصال أو ملاحظة جديدة لدمجها..."
                        className="flex-1 bg-slate-950/80 border border-white/6 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-amber-500 font-medium"
                      />
                      <div className="flex gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={async () => {
                            const el = document.getElementById(`quick-note-compact-${o.tracking}`) as HTMLInputElement | null;
                            if (el && el.value.trim()) {
                              const newNote = el.value.trim();
                              const now = new Date();
                              const timeStr = now.toLocaleTimeString("ar-EG", { hour: '2-digit', minute: '2-digit' });
                              const appendedNotes = o.notes 
                                ? `${o.notes} | ${newNote} (${username} ${timeStr})`
                                : `${newNote} (${username} ${timeStr})`;
                              
                              el.disabled = true;
                              try {
                                await triggerStatusUpdate(o.tracking, o.status, o.returnShippingType || "", appendedNotes, o.delivDate || "");
                                el.value = "";
                              } catch (e) {
                                console.error(e);
                              } finally {
                                el.disabled = false;
                              }
                            }
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-[10px] rounded-lg cursor-pointer transition active:scale-95"
                        >
                          حفظ الملاحظة
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const el = document.getElementById(`quick-note-compact-${o.tracking}`) as HTMLInputElement | null;
                            const noteVal = el ? el.value.trim() : "";
                            const msg = `🚨 *طلب تصعيد فني بخصوص الشحنة* 🚨
- *رقم الشحنة:* ${o.tracking}
- *العميل:* ${o.customer || "—"}
- *الهاتف:* ${o.phone || "—"}
- *المحافظة/المنطقة:* ${o.gov || "—"} · ${o.region || "—"}
- *المبلغ المالي:* ${o.totalCOD || o.prodPrice || 0} ج.م
- *الموظف الحالي:* ${username} (${role})
- *الملاحظة المكتوبة:* ${noteVal || o.notes || "لا توجد ملاحظة مكتوبة بعد"}`;
                            
                            const waUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
                            window.open(waUrl, "_blank");
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-[10px] rounded-lg flex items-center gap-1 cursor-pointer transition active:scale-95"
                          title="تصعيد المشكلة للدعم الفني والواتساب مباشرة"
                        >
                          <span>📞</span> التصعيد للدعم
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Returns management officer details (Return Queue indicators) */}
                  {o.returnQueueStatus && (
                    <div className="col-span-1 md:col-span-2 p-3 bg-purple-950/10 border border-purple-900/30 rounded-xl text-[11px] text-purple-300 flex items-center justify-between">
                      <span className="font-semibold flex items-center gap-1.5">
                        <ArrowLeftRight size={13} />
                        قائمة المرتجع: <span className="font-black underline">{o.returnQueueStatus}</span>
                      </span>
                      <span>مسؤول المتابعة: <span className="font-bold underline">{o.returnQueueAgent || "لم يعين"}</span></span>
                    </div>
                  )}

                  {isOps && (
                    <div className="col-span-1 md:col-span-2 bg-[#0a1128] p-4 rounded-xl border border-indigo-500/30 text-right space-y-3" dir="rtl">
                      <div className="flex items-center gap-1.5 text-indigo-400">
                        <span className="text-sm">🎧</span>
                        <span className="text-xs font-black">لوحة متابعة موظف العمليات والاتصال:</span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 font-bold">تسجيل نتيجة المكالمة التفصيلية:</span>
                          <textarea
                            id={`notes-compact-${o.tracking}`}
                            defaultValue={o.notes || ""}
                            placeholder="شرح تواصل العميل، رغبته، أو تفاصيل المتابعة الحالية..."
                            className="bg-slate-900 border border-white/8 text-xs text-slate-100 rounded-lg p-2 focus:border-indigo-500 font-medium h-16 resize-none w-full"
                          />
                        </div>

                        <div className="flex flex-col gap-2 justify-between">
                          <div>
                            <span className="text-[10px] text-slate-400 font-bold">تاريخ التوصيل الفعلي المتوقع:</span>
                            <input
                              id={`date-compact-${o.tracking}`}
                              type="date"
                              defaultValue={o.delivDate ? o.delivDate.substring(0, 10) : ""}
                              className="bg-slate-900 border border-white/8 text-xs text-slate-100 rounded-lg p-1.5 focus:border-indigo-500 font-semibold w-full mt-1"
                            />
                          </div>

                          <div className="flex flex-col gap-1 mt-1">
                            <span className="text-[10px] text-indigo-400 font-bold">تعديل الحالة مع حفظ البيانات أعلاه:</span>
                            <select
                              disabled={pendingTrackings.has(o.tracking)}
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  const notesEl = document.getElementById(`notes-compact-${o.tracking}`) as HTMLTextAreaElement | null;
                                  const dateEl = document.getElementById(`date-compact-${o.tracking}`) as HTMLInputElement | null;
                                  const currentNotes = notesEl ? notesEl.value : (o.notes || "");
                                  const currentDate = dateEl ? dateEl.value : (o.delivDate || "");
                                  
                                  triggerStatusUpdate(o.tracking, val, "", currentNotes, currentDate);
                                  e.target.value = ""; // Reset value after trigger
                                }
                              }}
                              className="bg-slate-900 border border-white/10 text-xs text-slate-100 rounded-lg p-1.5 focus:border-indigo-500 font-bold focus:ring-0 cursor-pointer w-full"
                            >
                              <option value="">-- اختر الحالة الجديدة --</option>
                              <option value="تم رد العميل وجاري التنسيق">تم رد العميل وجاري التنسيق</option>
                              <option value="مؤجل">مؤجل (تأجيل الطلب)</option>
                              <option value="لا يوجد رد">لا يوجد رد (محاولة تواصل)</option>
                              <option value="العميل لغى الأوردر / مرتجع">العميل لغى الأوردر / مرتجع ❌</option>
                              {o.status === "جديد" && (
                                <option value="جديد">إرجاع الأوردر لحالة "جديد"</option>
                              )}
                            </select>
                          </div>
                        </div>
                      </div>

                      {o.status === "لا يرد" && (
                        <div className="bg-slate-950/60 p-3 rounded-xl border border-amber-500/20 flex flex-col gap-2 mt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-black text-amber-400">🚨 تم تصنيف الأوردر كـ "لا يرد"</span>
                            <button
                              type="button"
                              onClick={() => setOpsUpdatingCall(prev => ({ ...prev, [o.tracking]: !prev[o.tracking] }))}
                              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-slate-100 font-extrabold text-[10px] rounded-lg cursor-pointer"
                            >
                              {opsUpdatingCall[o.tracking] ? "إلغاء التحديث" : "📞 تحديث نتيجة الاتصال (رد العميل)"}
                            </button>
                          </div>
                          {opsUpdatingCall[o.tracking] && (
                            <div className="space-y-3 border-t border-white/6 pt-2 select-text text-right" dir="rtl">
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-355 font-bold">ملاحظات رد العميل (إجباري) *</span>
                                <textarea
                                  placeholder="اكتب ملاحظات رد وتواصل العميل هنا..."
                                  className="bg-slate-900 border border-indigo-500/40 text-xs text-slate-100 rounded-lg p-2 font-medium h-14 resize-none w-full"
                                  value={opsNotes[o.tracking] || ""}
                                  onChange={(e) => setOpsNotes(prev => ({ ...prev, [o.tracking]: e.target.value }))}
                                />
                              </div>
                              <div className="flex flex-col gap-1">
                                <span className="text-[10px] text-slate-355 font-bold">تاريخ الاستلام المؤجل (إجباري) *</span>
                                <input
                                  type="date"
                                  className="bg-slate-900 border border-indigo-500/40 text-xs text-slate-100 rounded-lg p-2 font-black w-full"
                                  value={opsDate[o.tracking] || ""}
                                  onChange={(e) => setOpsDate(prev => ({ ...prev, [o.tracking]: e.target.value }))}
                                />
                              </div>
                              <button
                                type="button"
                                disabled={pendingTrackings.has(o.tracking)}
                                onClick={() => {
                                  const userNotes = opsNotes[o.tracking] || "";
                                  const userDate = opsDate[o.tracking] || "";
                                  if (!userNotes.trim()) {
                                    alert("يرجى إدخال ملاحظات رد العميل أولاً (إجباري)");
                                    return;
                                  }
                                  if (!userDate.trim()) {
                                    alert("يرجى تحديد تاريخ الاستلام المؤجل أولاً (إجباري)");
                                    return;
                                  }
                                  triggerStatusUpdate(o.tracking, "تم رد العميل وجاري التنسيق", "", userNotes, userDate);
                                }}
                                className="w-full py-2 bg-gradient-to-r from-emerald-500 to-indigo-600 text-slate-100 font-extrabold text-[11px] rounded-lg cursor-pointer hover:opacity-90"
                              >
                                تحديث الحالة إلى "تم رد العميل وجاري التنسيق" وكتابة التقارير
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Individual Action Controls */}
                {/* 1. Normal transition status controls (Hide state buttons for Suppliers (Mored) Per User Rules!) */}
                {o.status !== "تم التسليم" && !isSupplier && (
                  <div className="border-t border-white/6 pt-3 flex flex-wrap gap-2 justify-end">
                    {/* Courier quick controls */}
                    {isAgent && o.courier === username && (
                      <>
                        <button
                          onClick={() => toggleCustomerConfirmed(o.tracking)}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-3 py-1.5 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 active:scale-98 transition ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          } ${
                            o.customerConfirmed === "true" || o.customerConfirmed === true
                              ? "bg-emerald-600 hover:bg-emerald-700 text-slate-950"
                              : "bg-amber-500 hover:bg-amber-600 text-slate-950"
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin" />}
                          <span>{o.customerConfirmed === "true" || o.customerConfirmed === true ? "📞 تم الرد والتأكيد ✓" : "📞 تم الرد والتأكيد؟"}</span>
                        </button>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "تم التسليم")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-slate-950 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin" />}
                          <span>✅ تم التسليم والتحصيل</span>
                        </button>
                        <button
                          onClick={() => {
                            const amtStr = prompt("يرجى إدخال المبلغ المستلم الفعلي من العميل (ج.م):", o.totalCOD || "");
                            if (amtStr === null) return;
                            const amt = parseFloat(amtStr);
                            if (isNaN(amt) || amt < 0) {
                              alert("⚠️ يرجى إدخال مبلغ صحيح");
                              return;
                            }
                            triggerStatusUpdate(o.tracking, "تسليم جزئي", "", "", "", false, amt);
                          }}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-3 py-1.5 bg-cyan-605 text-slate-950 hover:bg-cyan-650 active:scale-98 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin" />}
                          <span>📦 تسليم جزئي</span>
                        </button>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "مرتجع")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-3 py-1.5 bg-red-650 hover:bg-red-700 text-slate-200 font-black text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin" />}
                          <span>↩ اختيار مرتجع</span>
                        </button>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "مؤجل")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-3 py-1.5 bg-slate-800 text-slate-300 font-bold text-[10px] rounded-lg cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin" />}
                          <span>⏰ تم التأجيل</span>
                        </button>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "لا يوجد رد")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-3 py-1.5 bg-slate-950 text-slate-400 font-bold text-[10px] rounded-lg cursor-pointer border border-white/4 flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={11} className="animate-spin" />}
                          <span>📵 لا يرد</span>
                        </button>
                      </>
                    )}

                    {/* Admin and Supervisor assignments actions */}
                    {canManage && (
                      <>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "خارج مع المندوب")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-2.5 py-1 bg-slate-950 text-amber-500 border border-amber-500/20 text-[9px] font-black rounded hover:bg-slate-900 cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={10} className="animate-spin" />}
                          <span>🚚 خارج للتسليم</span>
                        </button>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "تم التسليم")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-2.5 py-1 bg-emerald-600 text-slate-950 text-[9px] font-black rounded hover:bg-emerald-700 cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={10} className="animate-spin" />}
                          <span>تسليم سريع</span>
                        </button>
                        <button
                          onClick={() => triggerStatusUpdate(o.tracking, "مرتجع")}
                          disabled={pendingTrackings.has(o.tracking)}
                          className={`px-2.5 py-1 bg-slate-950 text-red-400 border border-red-900/20 text-[9px] font-black rounded hover:bg-slate-900 cursor-pointer flex items-center gap-1 ${
                            pendingTrackings.has(o.tracking) ? "opacity-50 pointer-events-none" : ""
                          }`}
                        >
                          {pendingTrackings.has(o.tracking) && <Loader2 size={10} className="animate-spin" />}
                          <span>مرتجع سريع</span>
                        </button>
                      </>
                    )}

                    {/* Returns Officer specific status transitions */}
                    {isReturnsOfficer && (
                      <div className="flex flex-col gap-3 bg-slate-950 p-3.5 rounded-xl border border-purple-500/30 w-full text-right" dir="rtl">
                        <div className="flex items-center gap-1.5 text-purple-400">
                          <span className="text-sm">🔄</span>
                          <span className="text-xs font-black">الدورة المستندية والخطوات اللوجستية للمرتجع:</span>
                        </div>
                        
                        {/* Exclusive returns clerk action button */}
                        <div className="bg-emerald-950/20 border border-emerald-500/20 p-2.5 rounded-lg space-y-1.5 text-right">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] text-emerald-400 font-extrabold">🚨 إجراء حصري لمسؤول المرتجعات:</span>
                            <span className="text-[9px] text-emerald-500 font-medium">(خروج من العهدة تصفية تامة)</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`هل أنت متأكد من تسليم هذا المرتجع للمورد (${o.supplier || "غير معروف"}) وتصفية حسابه الصافي التراكمي؟`)) {
                                triggerStatusUpdate(o.tracking, "تم تسليمه للمورد");
                              }
                            }}
                            disabled={pendingTrackings.has(o.tracking)}
                            className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 text-xs font-black rounded-lg cursor-pointer transition-colors"
                          >
                            <span>🤝 تم تسليم المرتجع للمورد</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Clean, isolated mobile connection row at the bottom of each order */}
                {o.phone && (() => {
                  const rawPhone = o.phone.toString().trim();
                  const formattedPhone = rawPhone.startsWith('0') ? rawPhone : '0' + rawPhone;
                  return (
                    <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/6">
                      <a
                        href={`tel:${formattedPhone}`}
                        className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-blue-600/10 text-blue-400 bg-blue-950/20 border border-blue-900/30 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-colors text-center"
                      >
                        <Phone size={13} />
                        <span>اتصال هاتفي</span>
                      </a>
                      <a
                        href={toWAUrl(o.phone, getOrderWAMessage(o))}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-center gap-1.5 py-2.5 hover:bg-emerald-600/10 text-emerald-400 bg-emerald-950/20 border border-emerald-950/30 rounded-xl text-xs font-black tracking-wide cursor-pointer transition-colors text-center font-sans"
                      >
                        <MessageSquare size={13} />
                        <span>اتصال واتساب</span>
                      </a>
                    </div>
                  );
                })()}
              </div>
            );
          })}`
        </div>
      )}

      {/* --- MODAL 1: RETURN SHIPPING SELECTION POPUP (Third Point Fix!) --- */}
      {returnedSelectOpen && selectedReturnOrder && !isSupplier && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/8 p-6 rounded-t-2xl md:rounded-2xl w-full max-w-[420px] text-right space-y-4">
            <h3 className="text-sm font-black text-rose-450 border-b border-white/6 pb-2">
              ↩️ تحديد سلوك تصفية الشحن المرتجع
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed font-semibold">
              يقوم المندوب حالياً بإرجاع الأوردر <span className="text-amber-500 font-bold underline font-mono">{selectedReturnOrder.tracking}</span> للمكتب الرئيسي.
              <br />
              يرجى تحديد ما إذا دفع الزبون تكلفة الشحن أم رفض الدفع:
            </p>

            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => triggerStatusUpdate(selectedReturnOrder.tracking, "مرتجع", "paid")}
                className="w-full py-3 bg-emerald-950/20 text-emerald-400 border border-emerald-900/40 hover:bg-emerald-950/45 rounded-xl text-xs font-black cursor-pointer leading-relaxed"
              >
                1. مرتجع والعميل دفع الشحن (يتم احتساب عمولة المندوب)
              </button>

              <button
                onClick={() => triggerStatusUpdate(selectedReturnOrder.tracking, "مرتجع", "unpaid")}
                className="w-full py-3 bg-red-950/20 text-red-400 border border-red-900/40 hover:bg-red-950/45 rounded-xl text-xs font-black cursor-pointer leading-relaxed"
              >
                2. مرتجع والعميل رفض دفع الشحن (العمولة = 0 + قائمة المتابعة)
              </button>
            </div>

            <button
              onClick={() => {
                setReturnedSelectOpen(false);
                setSelectedReturnOrder(null);
              }}
              className="w-full py-2 bg-slate-950 text-slate-500 text-[10px] font-bold rounded-lg border border-white/4"
            >
              إلغاء لخطأ
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL 2: BULK ASSIGNMENTS MANIFEST MODAL (canManage only) --- */}
      {bulkModalOpen && canManage && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/8 p-6 rounded-2xl w-full max-w-[420px] text-right space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-amber-550 border-b border-white/6 pb-2">
              🔗 توزيع وإسناد وتحديث جماعي لعدد {selected.size} طلبات
            </h3>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">الحالة الجديدة للطلبات</label>
                <select
                  value={bulkStatus}
                  onChange={(e) => setBulkStatus(e.target.value)}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-right"
                >
                  <option value="">-- لا يتم تغيير الحالة --</option>
                  <option value="مُسند جديد">مُسند جديد</option>
                  <option value="خارج مع المندوب">خارج مع المندوب</option>
                  <option value="تم التسليم">تم التسليم</option>
                  <option value="مرتجع">مرتجع</option>
                  <option value="مؤجل">مؤجل</option>
                  <option value="لا يوجد رد">لا يوجد رد</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">تعيين أو تغيير المندوب المسؤول</label>
                <SearchableCourierSelect
                  value={bulkCourier}
                  onChange={(val) => setBulkCourier(val)}
                  couriers={couriers}
                  placeholder="-- بقاء المندوب كما هو --"
                  showWarehouseReset={true}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={saveBulkUpdate}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
              >
                تطبيق التغييرات لجميع المحدد
              </button>
              <button
                onClick={() => setBulkModalOpen(false)}
                className="px-4 py-3 bg-slate-950 text-slate-400 rounded-xl text-xs font-bold border border-white/6 cursor-pointer"
              >
                إلغاء لخطأ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: ADMIN DETAIL ORDER MODIFER MODAL --- */}
      {editOrder && isAdmin && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form onSubmit={saveAdminEdits} className="bg-slate-900 border border-white/8 p-6 rounded-2xl w-full max-w-[480px] text-right space-y-4 my-8">
            <h3 className="text-sm font-black text-indigo-400 border-b border-white/6 pb-2">
              ✏️ تعديل ومراجعة بيانات الشحنة {editOrder.tracking}
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1 text-right">
                <label className="block text-[9px] text-slate-450 font-bold">اسم المستلم*</label>
                <input
                  type="text"
                  required
                  value={editOrder.customer}
                  onChange={(e) => setEditOrder({ ...editOrder, customer: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs text-right"
                />
              </div>

              <div className="space-y-1 text-right">
                <label className="block text-[9px] text-slate-450 font-bold">المندوب المسؤول للتسليم</label>
                <SearchableCourierSelect
                  value={editOrder.courier || ""}
                  onChange={(val) => setEditOrder({ ...editOrder, courier: val })}
                  couriers={couriers}
                  placeholder="بدون مندوب"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">تليفون العميل</label>
                <input
                  type="text"
                  required
                  value={editOrder.phone}
                  onChange={(e) => setEditOrder({ ...editOrder, phone: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs font-mono text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">تليفون بديل</label>
                <input
                  type="text"
                  value={editOrder.phone2 || ""}
                  onChange={(e) => setEditOrder({ ...editOrder, phone2: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs font-mono text-right"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">محافظة المستلم</label>
                <select
                  value={editOrder.gov}
                  onChange={(e) => setEditOrder({ ...editOrder, gov: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs"
                >
                  {EgyptGovs.map((g, idx) => (
                    <option key={idx} value={g}>{g}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">المنطقة</label>
                <input
                  type="text"
                  value={editOrder.region}
                  onChange={(e) => setEditOrder({ ...editOrder, region: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs text-right"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold">العنوان الكامل بالتفصيل</label>
              <input
                type="text"
                value={editOrder.address}
                onChange={(e) => setEditOrder({ ...editOrder, address: e.target.value })}
                className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs text-right"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">سعر المنتج (حق المورد)</label>
                <input
                  type="number"
                  required
                  value={editOrder.prodPrice}
                  onChange={(e) => setEditOrder({ ...editOrder, prodPrice: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs font-mono text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[10px] text-slate-400 font-bold">سعر شحن الشركة (حق الشركة)</label>
                <input
                  type="number"
                  required
                  value={editOrder.shipPrice}
                  onChange={(e) => setEditOrder({ ...editOrder, shipPrice: e.target.value })}
                  className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs font-mono text-right"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold">اسم/نوع المنتج الفعلي (المحتويات)</label>
              <input
                type="text"
                value={editOrder.prodType || ""}
                onChange={(e) => setEditOrder({ ...editOrder, prodType: e.target.value })}
                className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs text-right font-sans"
                placeholder="مثال: حذاء كلاسيك جلد طبيعي أسود"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] text-slate-400 font-bold">ملاحظات ووصاية الأوردر</label>
              <input
                type="text"
                value={editOrder.notes}
                onChange={(e) => setEditOrder({ ...editOrder, notes: e.target.value })}
                className="w-full bg-slate-950 text-slate-200 border border-white/8 px-3 py-2.5 rounded-lg text-xs text-right"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 bg-indigo-650 hover:bg-indigo-700 text-slate-100 font-black text-xs rounded-xl cursor-pointer"
              >
                حفظ وحفظ التعديلات
              </button>
              <button
                type="button"
                onClick={() => setEditOrder(null)}
                className="px-4 py-3.5 bg-slate-950 text-slate-500 rounded-xl text-xs font-bold border border-white/6 cursor-pointer"
              >
                إلغاء لخطأ
              </button>
            </div>
          </form>
        </div>
      )}

      {/* --- MODAL 4: COURIER CORRECTION / ACCIDENTAL CLICK PREVENTION MODAL --- */}
      {courierConfirmModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-white/8 p-6 rounded-t-2xl md:rounded-2xl w-full max-w-[420px] text-right space-y-4 shadow-2xl">
            <h3 className="text-sm font-black text-amber-500 border-b border-white/6 pb-2 flex items-center gap-2">
              <span>⚠️ تأكيد تغيير حالة الأوردر</span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              هل أنت متأكد من تغيير حالة الشحنة <span className="text-amber-500 font-bold underline font-mono">{courierConfirmModal.tracking}</span> إلى <span className="text-emerald-400 font-bold">[{courierConfirmModal.title}]</span>؟
            </p>
            
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const { tracking, status } = courierConfirmModal;
                  setCourierConfirmModal(null);
                  triggerStatusUpdate(tracking, status);
                }}
                className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-slate-950 font-black text-xs rounded-xl cursor-pointer active:scale-98 transition-transform"
              >
                نعم، متأكد
              </button>
              <button
                type="button"
                onClick={() => setCourierConfirmModal(null)}
                className="px-5 py-3 bg-slate-950 text-slate-400 hover:text-slate-200 rounded-xl text-xs font-bold border border-white/6 cursor-pointer"
              >
                إلغاء التغيير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 5: NEW ENHANCED COURIER DELIVERED FLOW (FULL OR PARTIAL DELIVERY) --- */}
      {deliveryChoiceOrder && !isSupplier && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fadeIn" dir="rtl">
          <div className="bg-slate-900 border border-emerald-500/30 p-6 rounded-2xl w-full max-w-[460px] text-right space-y-5 shadow-2xl relative">
            <button
              onClick={() => {
                setDeliveryChoiceOrder(null);
                setPartialAmountInput("");
              }}
              className="absolute top-4 left-4 text-slate-500 hover:text-slate-300 transition-colors"
            >
              ✕
            </button>
            <div className="text-center space-y-2">
              <span className="text-3xl">🚚</span>
              <h3 className="text-base font-black text-emerald-400">خيارات تسليم الأوردر {deliveryChoiceOrder.tracking}</h3>
              <p className="text-xs text-slate-400 font-bold">يرجى اختيار نوع التسليم وتأكيد الأرقام المالية:</p>
            </div>

            {/* Option 1: Full Delivery */}
            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-emerald-400">1. تسليم كلي</span>
                <span className="text-xs font-mono font-bold text-slate-300">{deliveryChoiceOrder.totalCOD || deliveryChoiceOrder.price || 0} ج.م</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                يتم تأكيد استلام كامل المبلغ وكتابة كامل القيمة {deliveryChoiceOrder.totalCOD || deliveryChoiceOrder.price || 0} ج.م في كاش المندوب.
              </p>
              <button
                type="button"
                onClick={() => {
                  const tracking = deliveryChoiceOrder.tracking;
                  const originalCOD = Number(deliveryChoiceOrder.totalCOD || deliveryChoiceOrder.price || 0);
                  setDeliveryChoiceOrder(null);
                  triggerStatusUpdate(tracking, "تم التسليم", "", "", "", false, originalCOD);
                }}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-slate-950 font-black text-xs rounded-lg transition-all"
              >
                تأكيد تسليم كلي ({deliveryChoiceOrder.totalCOD || deliveryChoiceOrder.price || 0} ج.م)
              </button>
            </div>

            {/* Option 2: Partial Delivery */}
            <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-amber-400">2. تسليم جزئي (معلق للجرد)</span>
                <span className="text-[10px] text-amber-500 font-bold">يتطلب إدخال الكاش الفعلي ✍️</span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                في حالة رفض العميل لبعض محتويات الشحنة، يتم استلام جزء من الكاش، وتحويل الباقي لمرتجع جزئي معلق للجرد بالمستودع.
              </p>
              
              <div className="space-y-1">
                <label className="text-[10px] text-indigo-300 font-black block">الكاش الفعلي المحصل من العميل (ج.م) *</label>
                <input
                  type="number"
                  placeholder="مثال: 150"
                  value={partialAmountInput}
                  onChange={(e) => setPartialAmountInput(e.target.value)}
                  className="w-full bg-slate-950 text-slate-100 border border-amber-500/30 rounded-lg px-3 py-2 text-xs font-mono text-center outline-none focus:border-amber-500"
                />
              </div>

              <button
                type="button"
                disabled={isSubmitPartialLoading}
                onClick={async () => {
                  const tracking = deliveryChoiceOrder.tracking;
                  const cleanCOD = Number(deliveryChoiceOrder.totalCOD || deliveryChoiceOrder.price || 0);
                  const pAmount = Number(partialAmountInput);

                  if (isNaN(pAmount) || pAmount <= 0) {
                    alert("⚠️ الرجاء إدخال مبلغ صحيح (أكبر من الصفر) للتسليم الجزئي");
                    return;
                  }
                  if (pAmount >= cleanCOD) {
                    alert(`⚠️ للتسليم الجزئي، يجب أن يكون المبلغ المدخل أقل من المبلغ الإجمالي (${cleanCOD} ج.م). إذا تم استلام المبلغ بالكامل يرجى اختيار [تسليم كلي].`);
                    return;
                  }

                  setIsSubmitPartialLoading(true);
                  try {
                    await triggerStatusUpdate(tracking, "تسليم جزئي - معلق للجرد", "", "", "", false, pAmount);
                    setDeliveryChoiceOrder(null);
                    setPartialAmountInput("");
                  } catch (err) {
                    console.error(err);
                  } finally {
                    setIsSubmitPartialLoading(false);
                  }
                }}
                className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 text-slate-950 font-black text-xs rounded-lg cursor-pointer hover:opacity-90 active:scale-98 transition-all flex items-center justify-center gap-2"
              >
                {isSubmitPartialLoading ? (
                  <Loader2 size={12} className="animate-spin text-slate-950" />
                ) : (
                  <span>🔒 تأكيد التسليم الجزئي وتحويل {partialAmountInput || "0"} ج.م للعهدة</span>
                )}
              </button>
            </div>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setDeliveryChoiceOrder(null);
                  setPartialAmountInput("");
                }}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-300"
              >
                تراجع وإغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Thermal Bulk Labels Printing Modal Overlay (Blueprint v100) --- */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 overflow-y-auto no-print">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-3xl w-full space-y-6 text-right font-sans shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/6 pb-4">
              <div className="flex items-center gap-2">
                <Printer className="text-amber-500 animate-pulse" size={20} />
                <h3 className="text-base font-black text-slate-150">بوابة طباعة الملصقات الحرارية الجماعية (4×6)</h3>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
              >
                إغلاق النافذة ✕
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3.5 rounded-xl leading-relaxed">
              💡 سيقوم المتصفح تلقائياً بتهيئة الطباعة لجميع الملصقات المختارة (عدد الملصقات: {orders.filter(o => selected.has(o.tracking)).length}). يرجى التأكد من اختيار حجم الورق المناسب في معالج طباعة نظام التشغيل لديك (موصى به: 100mm × 150mm أو 4×6 بوصة).
            </div>

            {/* Print Area Preview */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-400 block">معاينة مباشرة لشكل بوليصة الشحن الحرارية:</span>
              <div className="border border-white/6 rounded-xl overflow-hidden bg-slate-950 p-4 max-h-[380px] overflow-y-auto space-y-6 scrollbar-thin">
                
                {/* Simulated/Printable Thermal Stickers Container */}
                <div id="thermal-print-area" className="space-y-8 bg-slate-950 p-2">
                  {orders.filter(o => selected.has(o.tracking)).map((o, idx) => (
                    <div
                      key={o.id || o.tracking || idx}
                      className="print-page-break bg-white text-black p-5 border-4 border-black rounded-lg w-full max-w-[380px] mx-auto text-right font-sans space-y-4 shadow-lg select-none"
                      style={{ direction: "rtl", minHeight: "520px" }}
                    >
                      {/* Logo and Brand Header */}
                      <div className="flex items-center justify-between border-b-2 border-black pb-2">
                        <span className="text-[13px] font-black tracking-wider text-black">ASFOOR LOGISTICS</span>
                        <span className="text-[10px] font-black border border-black px-1.5 py-0.5 rounded">شحن سريع ⚡</span>
                      </div>

                      {/* Barcode and Tracking Number */}
                      <div className="text-center space-y-1 py-1 border-b-2 border-dashed border-black">
                        <div className="text-lg font-black tracking-widest font-mono select-all">{o.tracking}</div>
                        <div className="flex justify-center py-1.5 bg-white">
                          {/* Zero-dependency instant QR code generator URL */}
                          <img
                            src={`https://chart.googleapis.com/chart?chs=130x130&cht=qr&chl=${encodeURIComponent(o.tracking)}&choe=UTF-8`}
                            alt="QR"
                            className="w-24 h-24 border border-black/10 p-1"
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      </div>

                      {/* Main COD Box */}
                      <div className="bg-black text-white p-3 rounded-md text-center space-y-0.5">
                        <span className="text-[9px] block uppercase font-bold text-slate-300">المبلغ المطلوب تحصيله (COD)</span>
                        <span className="text-xl font-black tracking-tight font-sans">
                          {(Number(o.totalCOD || o.price || 0)).toLocaleString("ar-EG")} جنيه مصري
                        </span>
                      </div>

                      {/* Receiver and Sender Details */}
                      <div className="grid grid-cols-1 gap-2.5 text-xs text-right leading-relaxed border-t-2 border-black pt-3">
                        <div>
                          <span className="font-bold underline text-[10px] text-gray-700 block">👤 المرسل إليه (المستلم):</span>
                          <div className="font-black text-[13px] text-black mt-0.5">{o.customer || "غير مسجل"}</div>
                          <div className="font-bold font-mono text-[12px]">{o.phone || "غير مسجل"}</div>
                        </div>

                        <div>
                          <span className="font-bold underline text-[10px] text-gray-700 block">📍 عنوان التوصيل الفعلي:</span>
                          <div className="font-black text-[12.5px] text-black mt-0.5">{o.gov || "القاهرة"} - {o.region || "وسط البلد"}</div>
                          <div className="text-[11.5px] font-semibold text-gray-800">{o.address || "العنوان بالتفصيل"}</div>
                        </div>

                        <div className="border-t border-black/20 pt-2 flex items-center justify-between">
                          <div>
                            <span className="font-bold text-[9px] text-gray-500 block">📦 المورد (الراسل):</span>
                            <span className="font-black text-[11px] text-black">{o.supplier || "غير مسجل"}</span>
                          </div>
                          <div className="text-left">
                            <span className="font-bold text-[9px] text-gray-500 block">تاريخ الشحنة:</span>
                            <span className="font-mono text-[10.5px] text-black">{o.orderDate || o.createdAt?.split(" ")[0] || "-"}</span>
                          </div>
                        </div>
                      </div>

                      {/* Shipping Instruction & Brand Footer */}
                      <div className="border-t-2 border-black pt-2 text-center">
                        {o.notes && (
                          <div className="bg-gray-150 p-1.5 rounded text-[10px] font-bold text-gray-800 mb-2 leading-relaxed text-right border border-black/10">
                            💬 ملحوظة: {o.notes}
                          </div>
                        )}
                        <p className="text-[9px] font-black text-black">
                          🚚 يرجى فحص الطرد بحضور المندوب - شكراً لتعاملكم معنا!
                        </p>
                      </div>
                    </div>
                  ))}

                </div>
              </div>
            </div>

            {/* Custom Print Media Styles Injection */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #thermal-print-area, #thermal-print-area * {
                  visibility: visible !important;
                }
                #thermal-print-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .no-print {
                  display: none !important;
                }
                .print-page-break {
                  page-break-after: always !important;
                  break-after: page !important;
                  border: none !important;
                  box-shadow: none !important;
                  margin-bottom: 0 !important;
                  padding-bottom: 10mm !important;
                }
              }
            `}</style>

            {/* Modal Footer */}
            <div className="flex gap-2.5 pt-4 border-t border-white/6 justify-end">
              <button
                onClick={() => window.print()}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-2 transition-transform active:scale-[0.98] cursor-pointer"
              >
                <Printer size={14} />
                <span>🖨️ ابدأ طباعة الملصقات الحرارية الآن</span>
              </button>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                رجوع
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
