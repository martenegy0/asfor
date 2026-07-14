import React, { useState, useEffect, useMemo, useRef } from "react";

/**
 * --- HELPER FUNCTIONS FOR INLINE WEB WORKER ---
 */
function parseSafeNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s === "") return 0;
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function getOrderFinancials(o: any) {
  if (!o) return { prodPrice: 0, shipPrice: 0, totalCOD: 0 };
  
  let shipPrice = 0;
  const rawShip = o["سعر الشحن"] !== undefined ? o["سعر الشحن"] :
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

  let totalCOD = 0;
  const rawTotal = o["المطلب تحصيله"] !== undefined ? o["المطلب تحصيله"] :
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

  let prodPrice = 0;
  const rawProd = o["سعر المنتج"] !== undefined ? o["سعر المنتج"] :
                  (o["المنتج"] !== undefined ? o["المنتج"] :
                  (o["سعر المادة"] !== undefined ? o["سعر المادة"] :
                  (o["price"] !== undefined ? o["price"] :
                  (o["prodPrice"] !== undefined ? o["prodPrice"] :
                  o["product_price"]))));
                  
  if (rawProd !== undefined && rawProd !== null && rawProd !== "") {
    prodPrice = parseSafeNumber(rawProd);
  }
  if (isNaN(prodPrice)) prodPrice = 0;

  const status = o.status || o["الحالة"] || "";
  const isPartial = ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status) || o.isPartial === true || o.isPartial === "true" || (o.returnSubStatus && o.returnSubStatus.indexOf("تسليم جزئي") !== -1);

  if (isPartial) {
    const partialAmt = Number(o.partialAmount !== undefined && o.partialAmount !== null ? o.partialAmount : (o.actualReceivedCash !== undefined && o.actualReceivedCash !== null ? o.actualReceivedCash : (totalCOD !== undefined && totalCOD !== null ? totalCOD : 0)));
    let originalProdPrice = o.originalProdPrice !== undefined && o.originalProdPrice !== null ? Number(o.originalProdPrice) : (o.prodPrice || prodPrice);
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

function normalizeDateToYMD(dateInput: any): string {
  if (!dateInput) return "";
  const str = dateInput.toString().trim();

  // 1. Matches YYYY-MM-DD or YYYY/MM/DD
  const matchYMD = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (matchYMD) {
    const y = matchYMD[1];
    const m = matchYMD[2].padStart(2, "0");
    const d = matchYMD[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. Matches DD/MM/YYYY or DD-MM-YYYY
  const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (matchDMY) {
    const d = matchDMY[1].padStart(2, "0");
    const m = matchDMY[2].padStart(2, "0");
    const y = matchDMY[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Matches DD/MM or DD-MM (without year)
  const matchDM = str.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (matchDM) {
    const d = matchDM[1].padStart(2, "0");
    const m = matchDM[2].padStart(2, "0");
    const y = new Date().getFullYear().toString();
    return `${y}-${m}-${d}`;
  }

  try {
    const dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${dateObj.getFullYear()}-${pad(dateObj.getMonth() + 1)}-${pad(dateObj.getDate())}`;
    }
  } catch (e) {}

  return str.substring(0, 10);
}

/**
 * --- IN-MEMORY SQL-STYLE DATABASE INDEX ---
 * Pre-builds fast Hash Maps for O(1) complexity operations
 */
export class OrdersInMemorySQLIndex {
  private ordersById: Map<string, any> = new Map();
  private ordersByCourier: Map<string, any[]> = new Map();
  private ordersBySupplier: Map<string, any[]> = new Map();
  private ordersByStatus: Map<string, any[]> = new Map();
  private ordersByDate: Map<string, any[]> = new Map();
  private ordersBySupplierAndDate: Map<string, any[]> = new Map();
  private ordersByCourierAndDate: Map<string, any[]> = new Map();

  constructor(orders: any[]) {
    this.reindex(orders);
  }

  public reindex(orders: any[]) {
    this.ordersById.clear();
    this.ordersByCourier.clear();
    this.ordersBySupplier.clear();
    this.ordersByStatus.clear();
    this.ordersByDate.clear();
    this.ordersBySupplierAndDate.clear();
    this.ordersByCourierAndDate.clear();

    if (!Array.isArray(orders)) return;

    for (let i = 0; i < orders.length; i++) {
      const o = orders[i];
      if (!o) continue;

      // 1. By ID (Tracking)
      const tracking = (o.tracking || o.id || "").toString().trim().toUpperCase();
      if (tracking) {
        this.ordersById.set(tracking, o);
      }

      // 2. By Courier
      const courier = (o.courier || o.lastCourier || "").toString().trim().toLowerCase();
      if (courier) {
        if (!this.ordersByCourier.has(courier)) {
          this.ordersByCourier.set(courier, []);
        }
        this.ordersByCourier.get(courier)!.push(o);
      }

      // 3. By Supplier
      const supplier = (o.supplier || "").toString().trim().toLowerCase();
      if (supplier) {
        if (!this.ordersBySupplier.has(supplier)) {
          this.ordersBySupplier.set(supplier, []);
        }
        this.ordersBySupplier.get(supplier)!.push(o);
      }

      // 4. By Status
      const status = (o.status || "").toString().trim();
      if (status) {
        if (!this.ordersByStatus.has(status)) {
          this.ordersByStatus.set(status, []);
        }
        this.ordersByStatus.get(status)!.push(o);
      }

      // 5. By Date
      const dateStr = normalizeDateToYMD(o.orderDate || o.createdAt);
      if (dateStr) {
        if (!this.ordersByDate.has(dateStr)) {
          this.ordersByDate.set(dateStr, []);
        }
        this.ordersByDate.get(dateStr)!.push(o);
      }

      // 6. Joint Index: Supplier & Date
      if (supplier && dateStr) {
        const key = `${supplier}_${dateStr}`;
        if (!this.ordersBySupplierAndDate.has(key)) {
          this.ordersBySupplierAndDate.set(key, []);
        }
        this.ordersBySupplierAndDate.get(key)!.push(o);
      }

      // 7. Joint Index: Courier & Date
      if (courier && dateStr) {
        const key = `${courier}_${dateStr}`;
        if (!this.ordersByCourierAndDate.has(key)) {
          this.ordersByCourierAndDate.set(key, []);
        }
        this.ordersByCourierAndDate.get(key)!.push(o);
      }
    }
  }

  public getById(id: string): any | undefined {
    if (!id) return undefined;
    return this.ordersById.get(id.trim().toUpperCase());
  }

  public getByCourier(courier: string): any[] {
    if (!courier) return [];
    return this.ordersByCourier.get(courier.trim().toLowerCase()) || [];
  }

  public getBySupplier(supplier: string): any[] {
    if (!supplier) return [];
    return this.ordersBySupplier.get(supplier.trim().toLowerCase()) || [];
  }

  public getByStatus(status: string): any[] {
    if (!status) return [];
    return this.ordersByStatus.get(status.trim()) || [];
  }

  public getByDate(date: string): any[] {
    if (!date) return [];
    return this.ordersByDate.get(date.trim()) || [];
  }

  public getBySupplierAndDate(supplier: string, date: string): any[] {
    if (!supplier || !date) return [];
    if (date === "all") return this.getBySupplier(supplier);
    const key = `${supplier.trim().toLowerCase()}_${date.trim()}`;
    return this.ordersBySupplierAndDate.get(key) || [];
  }

  public getByCourierAndDate(courier: string, date: string): any[] {
    if (!courier || !date) return [];
    if (date === "all") return this.getByCourier(courier);
    const key = `${courier.trim().toLowerCase()}_${date.trim()}`;
    return this.ordersByCourierAndDate.get(key) || [];
  }
}

/**
 * --- INLINE WEB WORKER CODE STRING ---
 * Performs heavy bookkeeping and analytics computations off-thread
 */
const backgroundWorkerCode = `
  // Mini polyfills for the worker environment
  function parseSafeNumber(val) {
    if (val === undefined || val === null) return 0;
    if (typeof val === "number") return val;
    var s = String(val).trim();
    if (s === "") return 0;
    var cleaned = s.replace(/,/g, "").replace(/[^\\d.-]/g, "").trim();
    var num = Number(cleaned);
    return isNaN(num) ? 0 : num;
  }

  function getOrderFinancials(o) {
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
    return { prodPrice, shipPrice, totalCOD };
  }

  function normalizeDateToYMD(dateInput) {
    if (!dateInput) return "";
    var str = dateInput.toString().trim();
    var matchYMD = str.match(/^(\\d{4})[-/](\\d{1,2})[-/](\\d{1,2})/);
    if (matchYMD) {
      return matchYMD[1] + "-" + matchYMD[2].padStart(2, "0") + "-" + matchYMD[3].padStart(2, "0");
    }
    var matchDMY = str.match(/^(\\d{1,2})[-/](\\d{1,2})[-/](\\d{4})/);
    if (matchDMY) {
      return matchDMY[3] + "-" + matchDMY[2].padStart(2, "0") + "-" + matchDMY[1].padStart(2, "0");
    }
    return str.substring(0, 10);
  }

  self.onmessage = function(e) {
    var data = e.data;
    var action = data.action;
    var orders = data.orders || [];

    if (action === "calculateAllMetrics") {
      var selectedSupplierFilter = data.selectedSupplierFilter;
      var username = data.username;
      var selectedDate = data.selectedDate || "all";
      var todayDateStr = data.todayDateStr;
      var rawCommission = Number(data.rawCommission || 25);
      var courierExpenses = Number(data.courierExpenses || 0);

      // 1. Supplier Financial Calculations
      var keptGoodsValue = 0;
      var settledValue = 0;
      
      orders.forEach(function(o) {
        if (!selectedSupplierFilter) return;
        var oSup = (o.supplier || "").toString().trim().toLowerCase();
        var fSup = selectedSupplierFilter.toString().trim().toLowerCase();
        if (oSup !== fSup) return;

        var financials = getOrderFinancials(o);
        var status = (o.status || "").toString().trim();
        var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
        var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status);
        
        var oKept = 0;
        if (isDelivered) {
          oKept = financials.prodPrice;
        } else if (isPartial) {
          var shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
          var soldValue = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
          if (isNaN(soldValue)) soldValue = 0;
          oKept = Math.max(0, soldValue - shipPrice);
        }

        keptGoodsValue += oKept;

        var isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === true || o.is_settled === "true";
        if (isS) {
          settledValue += oKept;
        }
      });

      var supplierFinancialsResult = {
        keptGoodsValue: keptGoodsValue,
        settledValue: settledValue,
        netValue: Math.max(0, keptGoodsValue - settledValue)
      };

      // 2. Courier Analytics and Handover Calculations
      var targetDateStr = selectedDate === "all" ? todayDateStr : selectedDate;
      var myActiveOrders = [];
      var myTotal = 0;
      var myDelivered = 0;
      var myPartialDelivered = 0;
      var myReturned = 0;
      var mySuspended = 0;
      var myRemaining = 0;

      var agentDeliveredOrders = [];
      var agentPartialDeliveredOrders = [];
      var agentCustomerPaidReturns = [];

      orders.forEach(function(o) {
        var oCou = (o.courier || o.lastCourier || "").toString().trim().toLowerCase();
        var fCou = (username || "").toString().trim().toLowerCase();
        if (oCou !== fCou) return;

        var isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true || o.isClosed === true || o.isClosed === "true";
        if (isS) return; // Instantly resets all counters for settled workload!

        myActiveOrders.push(o);

        var orderDayStr = normalizeDateToYMD(o.orderDate || o.createdAt);
        if (orderDayStr === targetDateStr) {
          myTotal++;
        }

        var status = (o.status || "").toString().trim();
        var delivDateYMD = o.delivDate ? normalizeDateToYMD(o.delivDate) : "";
        var retDateYMD = o.retDate ? normalizeDateToYMD(o.retDate) : "";
        var updateDateYMD = o.updatedAt ? normalizeDateToYMD(o.updatedAt) : "";

        if (status === "تم التسليم" && delivDateYMD === targetDateStr) {
          myDelivered++;
          agentDeliveredOrders.push(o);
        } else if ((status === "تسليم جزئي" || status === "تسليم جزئي - معلق للجرد") && delivDateYMD === targetDateStr) {
          myPartialDelivered++;
          agentPartialDeliveredOrders.push(o);
        } else if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع بالمستودع", "مرتجع جزئي بالمستودع"].includes(status) && retDateYMD === targetDateStr) {
          myReturned++;
        }

        if (["مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", (status === "مرتجع" && o.returnShippingType === "paid")].includes(status) && retDateYMD === targetDateStr) {
          agentCustomerPaidReturns.push(o);
        }

        if (["مؤجل", "لا يوجد رد", "العميل لم يقم بالرد", "العميل لا يرد", "مؤجل بالمستودع", "لا يوجد رد بالمستودع"].includes(status) && updateDateYMD === targetDateStr) {
          mySuspended++;
        }

        var isClosed = o.isClosed || ["تم التسليم", "تسليم جزئي", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي - معلق للجرد", "مرتجع", "مرتجع بالمستودع", "مرتجع جزئي بالمستودع", "تم تسليمه للمورد", "مرتجع تم تسليمه للمورد"].includes(status);
        var isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
        if (!isClosed && !isS) {
          myRemaining++;
        }
      });

      var totalCODDelivered = 0;
      agentDeliveredOrders.forEach(function(o) {
        totalCODDelivered += Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
      });

      var totalCODPartial = 0;
      agentPartialDeliveredOrders.forEach(function(o) {
        var amt = o.partialAmount !== undefined && o.partialAmount !== null && o.partialAmount !== "" ? Number(o.partialAmount) :
                  (o.actualReceivedCash !== undefined && o.actualReceivedCash !== null && o.actualReceivedCash !== "" ? Number(o.actualReceivedCash) : Number(o.totalCOD || 0));
        totalCODPartial += amt;
      });

      var totalShipReturnsPaidByCust = 0;
      agentCustomerPaidReturns.forEach(function(o) {
        totalShipReturnsPaidByCust += Number(o.shipPrice || o.shipCost || 0);
      });

      var totalReceivedCashInHand = totalCODDelivered + totalCODPartial + totalShipReturnsPaidByCust;
      var totalCommissionsEarned = ((agentDeliveredOrders.length + agentPartialDeliveredOrders.length) * rawCommission) + (agentCustomerPaidReturns.length * rawCommission);
      var netRequiredHandover = totalReceivedCashInHand - totalCommissionsEarned - courierExpenses;

      self.postMessage({
        action: "allMetricsCalculated",
        supplierFinancials: supplierFinancialsResult,
        courierKPIs: {
          myTotal: myTotal,
          myDelivered: myDelivered,
          myPartialDelivered: myPartialDelivered,
          myReturned: myReturned,
          mySuspended: mySuspended,
          myRemaining: myRemaining,
          totalReceivedCashInHand: totalReceivedCashInHand,
          totalCommissionsEarned: totalCommissionsEarned,
          netRequiredHandover: netRequiredHandover,
          agentDeliveredCount: agentDeliveredOrders.length,
          agentPartialCount: agentPartialDeliveredOrders.length,
          agentPaidReturnsCount: agentCustomerPaidReturns.length,
          totalCODDelivered: totalCODDelivered,
          totalCODPartial: totalCODPartial,
          totalShipReturnsPaidByCust: totalShipReturnsPaidByCust
        }
      });
    }
  };
`;

/**
 * --- ASYNC BACKGROUND ACCOUNTING HOOK ---
 * Keeps main thread free by computing financials in a background thread
 */
export function useBackgroundAccounting(
  orders: any[],
  selectedSupplierFilter: string,
  username: string,
  selectedDate: string,
  rawCommission: number,
  courierExpenses: number,
  todayDateStr: string
) {
  const [metrics, setMetrics] = useState({
    supplierFinancials: { keptGoodsValue: 0, settledValue: 0, netValue: 0 },
    courierKPIs: {
      myTotal: 0,
      myDelivered: 0,
      myPartialDelivered: 0,
      myReturned: 0,
      mySuspended: 0,
      myRemaining: 0,
      totalReceivedCashInHand: 0,
      totalCommissionsEarned: 0,
      netRequiredHandover: 0,
      agentDeliveredCount: 0,
      agentPartialCount: 0,
      agentPaidReturnsCount: 0,
      totalCODDelivered: 0,
      totalCODPartial: 0,
      totalShipReturnsPaidByCust: 0
    },
    loading: false
  });

  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      const blob = new Blob([backgroundWorkerCode], { type: "application/javascript" });
      const worker = new Worker(URL.createObjectURL(blob));
      workerRef.current = worker;

      worker.onmessage = (e) => {
        if (e.data && e.data.action === "allMetricsCalculated") {
          setMetrics({
            supplierFinancials: e.data.supplierFinancials,
            courierKPIs: e.data.courierKPIs,
            loading: false
          });
        }
      };

      return () => {
        worker.terminate();
      };
    } catch (e) {
      console.warn("Web Worker initialization failed. Falling back to main-thread async fallback.", e);
    }
  }, []);

  useEffect(() => {
    if (!orders || orders.length === 0) return;

    if (workerRef.current) {
      setMetrics((prev) => ({ ...prev, loading: true }));
      workerRef.current.postMessage({
        action: "calculateAllMetrics",
        orders,
        selectedSupplierFilter,
        username,
        selectedDate,
        rawCommission,
        courierExpenses,
        todayDateStr
      });
    } else {
      // Fallback: Immediate calculation on main thread using micro-tasks
      setTimeout(() => {
        // Calculate Supplier Financials
        let keptGoodsValue = 0;
        let settledValue = 0;
        orders.forEach((o: any) => {
          if (!selectedSupplierFilter) return;
          const oSup = (o.supplier || "").toString().trim().toLowerCase();
          const fSup = selectedSupplierFilter.toString().trim().toLowerCase();
          if (oSup !== fSup) return;

          const financials = getOrderFinancials(o);
          const status = (o.status || "").toString().trim();
          const isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
          const isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status);
          
          let oKept = 0;
          if (isDelivered) {
            oKept = financials.prodPrice;
          } else if (isPartial) {
            const shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
            let soldValue = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
            if (isNaN(soldValue)) soldValue = 0;
            oKept = Math.max(0, soldValue - shipPrice);
          }

          keptGoodsValue += oKept;

          const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === true || o.is_settled === "true";
          if (isS) {
            settledValue += oKept;
          }
        });

        // Calculate Courier KPI
        const targetDateStr = selectedDate === "all" ? todayDateStr : selectedDate;
        let myTotal = 0, myDelivered = 0, myPartialDelivered = 0, myReturned = 0, mySuspended = 0, myRemaining = 0;
        const agentDeliveredOrders: any[] = [];
        const agentPartialDeliveredOrders: any[] = [];
        const agentCustomerPaidReturns: any[] = [];

        orders.forEach((o: any) => {
          const oCou = (o.courier || o.lastCourier || "").toString().trim().toLowerCase();
          const fCou = (username || "").toString().trim().toLowerCase();
          if (oCou !== fCou) return;

          const isSActive = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true || o.isClosed === true || o.isClosed === "true";
          if (isSActive) return; // Instantly resets all counters for settled workload!

          const orderDayStr = normalizeDateToYMD(o.orderDate || o.createdAt);
          if (orderDayStr === targetDateStr) {
            myTotal++;
          }

          const status = (o.status || "").toString().trim();
          const delivDateYMD = o.delivDate ? normalizeDateToYMD(o.delivDate) : "";
          const retDateYMD = o.retDate ? normalizeDateToYMD(o.retDate) : "";
          const updateDateYMD = o.updatedAt ? normalizeDateToYMD(o.updatedAt) : "";

          if (status === "تم التسليم" && delivDateYMD === targetDateStr) {
            myDelivered++;
            agentDeliveredOrders.push(o);
          } else if ((status === "تسليم جزئي" || status === "تسليم جزئي - معلق للجرد") && delivDateYMD === targetDateStr) {
            myPartialDelivered++;
            agentPartialDeliveredOrders.push(o);
          } else if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع بالمستودع", "مرتجع جزئي بالمستودع"].includes(status) && retDateYMD === targetDateStr) {
            myReturned++;
          }

          if (["مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", (status === "مرتجع" && o.returnShippingType === "paid")].includes(status) && retDateYMD === targetDateStr) {
            agentCustomerPaidReturns.push(o);
          }

          if (["مؤجل", "لا يوجد رد", "العميل لم يقم بالرد", "العميل لا يرد", "مؤجل بالمستودع", "لا يوجد رد بالمستودع"].includes(status) && updateDateYMD === targetDateStr) {
            mySuspended++;
          }

          const isClosed = o.isClosed || ["تم التسليم", "تسليم جزئي", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي - معلق للجرد", "مرتجع", "مرتجع بالمستودع", "مرتجع جزئي بالمستودع", "تم تسليمه للمورد", "مرتجع تم تسليمه للمورد"].includes(status);
          const isS = o.isSettled === true || o.isSettled === "true" || o.is_settled === "true" || o.is_settled === true;
          if (!isClosed && !isS) {
            myRemaining++;
          }
        });

        const totalCODDelivered = agentDeliveredOrders.reduce((sum, o) => sum + Number(o.totalCOD || (Number(o.prodPrice || 0) + Number(o.shipPrice || 0))), 0);
        const totalCODPartial = agentPartialDeliveredOrders.reduce((sum, o) => {
          const amt = o.partialAmount !== undefined && o.partialAmount !== null && o.partialAmount !== "" ? Number(o.partialAmount) :
                      (o.actualReceivedCash !== undefined && o.actualReceivedCash !== null && o.actualReceivedCash !== "" ? Number(o.actualReceivedCash) : Number(o.totalCOD || 0));
          return sum + amt;
        }, 0);
        const totalShipReturnsPaidByCust = agentCustomerPaidReturns.reduce((sum, o) => sum + Number(o.shipPrice || o.shipCost || 0), 0);

        const totalReceivedCashInHand = totalCODDelivered + totalCODPartial + totalShipReturnsPaidByCust;
        const totalCommissionsEarned = ((agentDeliveredOrders.length + agentPartialDeliveredOrders.length) * rawCommission) + (agentCustomerPaidReturns.length * rawCommission);
        const netRequiredHandover = totalReceivedCashInHand - totalCommissionsEarned - courierExpenses;

        setMetrics({
          supplierFinancials: {
            keptGoodsValue,
            settledValue,
            netValue: Math.max(0, keptGoodsValue - settledValue)
          },
          courierKPIs: {
            myTotal,
            myDelivered,
            myPartialDelivered,
            myReturned,
            mySuspended,
            myRemaining,
            totalReceivedCashInHand,
            totalCommissionsEarned,
            netRequiredHandover,
            agentDeliveredCount: agentDeliveredOrders.length,
            agentPartialCount: agentPartialDeliveredOrders.length,
            agentPaidReturnsCount: agentCustomerPaidReturns.length,
            totalCODDelivered: totalCODDelivered,
            totalCODPartial: totalCODPartial,
            totalShipReturnsPaidByCust: totalShipReturnsPaidByCust
          },
          loading: false
        });
      }, 0);
    }
  }, [orders, selectedSupplierFilter, username, selectedDate, rawCommission, courierExpenses, todayDateStr]);

  return metrics;
}

/**
 * --- DYNAMIC ULTRA-LIGHTWEIGHT VIRTUALIZED CONTAINER ---
 * Only renders list cards actually visible within the scrolling view area
 */
interface HighPerformanceVirtualListProps<T> {
  items: T[];
  itemHeight: number; // estimated average height of an item in pixels
  renderItem: (item: T, index: number) => React.ReactNode;
  containerHeight?: string; // height value like "600px" or "100%"
}

export function HighPerformanceVirtualList<T>({
  items,
  itemHeight,
  renderItem,
  containerHeight = "650px"
}: HighPerformanceVirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleHeight, setVisibleHeight] = useState(650);

  useEffect(() => {
    if (containerRef.current) {
      setVisibleHeight(containerRef.current.clientHeight || 650);
      
      const resizeObserver = new ResizeObserver((entries) => {
        for (let entry of entries) {
          setVisibleHeight(entry.contentRect.height || 650);
        }
      });
      resizeObserver.observe(containerRef.current);
      return () => resizeObserver.disconnect();
    }
  }, []);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(event.currentTarget.scrollTop);
  };

  const { startIndex, endIndex, padTop, padBottom } = useMemo(() => {
    const totalCount = items.length;
    
    // Calculate start and end indexes with dynamic safety buffer offsets
    const overscan = 4;
    const rawStartIndex = Math.floor(scrollTop / itemHeight);
    const rawEndIndex = Math.ceil((scrollTop + visibleHeight) / itemHeight);

    const startIndex = Math.max(0, rawStartIndex - overscan);
    const endIndex = Math.min(totalCount - 1, rawEndIndex + overscan);

    const padTop = startIndex * itemHeight;
    const padBottom = Math.max(0, (totalCount - 1 - endIndex) * itemHeight);

    return { startIndex, endIndex, padTop, padBottom };
  }, [items.length, scrollTop, visibleHeight, itemHeight]);

  const visibleItems = useMemo(() => {
    return items.slice(startIndex, endIndex + 1);
  }, [items, startIndex, endIndex]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-y-auto w-full scrollbar-thin scrollbar-thumb-slate-700 select-none pr-1"
      style={{ height: containerHeight }}
    >
      <div style={{ paddingTop: `${padTop}px`, paddingBottom: `${padBottom}px` }}>
        {visibleItems.map((item, index) => renderItem(item, startIndex + index))}
      </div>
    </div>
  );
}
