/**
 * 🔒 نظام التشغيل والربط المركزي لجوجل شيت (مؤسسة فريند بلس - Friend Plus Shipping)
 * متوافق بشكل كامل 100% مع واجهة العمل الحديثة، المراقبة المالية، وتأمين النقدية ومنع العجز (Anti-Deficit Module).
 * 
 * 🛠️ طريقة التثبيت والاستخدام:
 * 1. افتح الجوجل شيت الخاص بك.
 * 2. اختر "Extensions" (الامتدادات) -> "Apps Script".
 * 3. احذف أي كود موجود وقم بلصق هذا الكود بالكامل.
 * 4. اكتب كلمة سر حماية الرابط (TOKEN) بالخلفية أو اتركها مطابقة للمتصفح.
 * 5. اضغط على زر "Deploy" -> "New deployment" -> اختر النوع "Web app".
 * 6. اجعل الصلاحيات "Execute as: Me" والوصول "Who has access: Anyone".
 * 7. انسخ رابط الويب وباسمه GOOGLE_SCRIPT_URL وضعه في ملف بيئة المتصفح (.env) أو إعدادات Vercel.
 */

// 🔑 توكن الحماية المركزي (يجب أن يطابق المرسل من التطبيق لضمان الأمان والخصوصية)
const ACCESS_TOKEN = "14014"; 

function hashPassword(password) {
  if (!password) return "";
  var rawHash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
  var hexString = "";
  for (var i = 0; i < rawHash.length; i++) {
    var byteValue = rawHash[i];
    if (byteValue < 0) {
      byteValue += 256;
    }
    var byteString = byteValue.toString(16);
    if (byteString.length == 1) {
      byteString = "0" + byteString;
    }
    hexString += byteString;
  }
  return hexString;
}

function verifyPassword(inputPass, storedPass) {
  if (!storedPass) return false;
  var cleanedStored = String(storedPass).trim();
  var cleanedInput = String(inputPass).trim();
  if (cleanedStored.length === 64 && /^[0-9a-fA-F]+$/.test(cleanedStored)) {
    return hashPassword(cleanedInput) === cleanedStored;
  }
  return cleanedInput === cleanedStored;
}

/**
 * 🚀 دالة التهيئة المباشرة (تشغيل يدوي)
 * اختر هذه الدالة (setup) من القائمة المنسدلة في الأعلى واضغط على "Run" أو "تشغيل"
 * لتهيئة وتجهيز جميع الجداول والترويسات داخل الجوجل شيت فوراً!
 */
function setup() {
  const sheets = initSheets();
  Logger.log("✅ تم تجهيز وتهيئة جميع جداول قاعدة بيانات الشيت بنجاح! تفقد الشيت الآن لتجد الجداول قد تم إنشاؤها تلقائياً.");
}

/**
 * 📊 إضافة قائمة مخصصة في الجوجل شيت للتشغيل والتنصيب المباشر بضغطة زر واحدة!
 * بعد حفظ السكريبت وإغلاقه، قم بإنعاش (Refresh) صفحة الجوجل شيت وستظهر لك القائمة في الأعلى.
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('🚛 نظام فريند بلس')
    .addItem('🛠️ تهيئة جداول النظام (Setup)', 'setup')
    .addToUi();
}

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return contentResponse({ ok: false, error: "لم يتم استقبال أي بيانات صالحة (Empty payload)" });
  }

  var requestData;
  try {
    requestData = JSON.parse(e.postData.contents);
  } catch(parseErr) {
    return contentResponse({ ok: false, error: "فشل تحليل البيانات المرسلة: " + parseErr.toString() });
  }

  var action = requestData.action;
  var token = requestData.token;

  // التحقق من صحة التوكن المركزي للأمان لمنع أي اختراق أو استدعاء خارجي
  if (token !== ACCESS_TOKEN) {
    return contentResponse({ ok: false, error: "صلاحية الرمز البرمجي (Token) غير صحيحة أو منتهية" });
  }

  // تحديد ما إذا كان الإجراء عبارة عن كتابة أو تعديل يحتاج إلى قفل حماية
  var writeActions = [
    "addOrder", "addBulk", "updateStatus", "updateOrder", "deleteOrder", 
    "bulkUpdate", "updateOrdersStatusBulk", "addSupplierPayment", 
    "addCourierAdjustment", "addCashbox", "addExpense", "addUser", 
    "registerUser", "updateUser", "updateCourier", "addDailyClosing",
    "settleCourierOrders", "settleSupplierDay", "requestWithdrawal",
    "approveWithdrawal", "rejectWithdrawal", "instantCourierSettlement",
    "saveStaffPermissions"
  ];
  
  var isWrite = writeActions.indexOf(action) !== -1;
  var lock = LockService.getScriptLock();
  var lockAcquired = false;

  if (isWrite) {
    try {
      // محاولة الحصول على قفل حماية لمنع حدوث تداخل في البيانات عند الطلبات المتزامنة
      lock.waitLock(15000);
      lockAcquired = true;
    } catch (err) {
      return contentResponse({ ok: false, error: "الخادم مشغول حالياً بطلب كتابة آخر، يرجى المحاولة بعد قليل." });
    }
  }

  try {
    const sheets = initSheets();
    let result = null;

    switch (action) {
      case "getOrders":
        result = getOrders(sheets, requestData);
        break;
      case "getArchivedOrders":
        result = getArchivedOrders(sheets);
        break;
      case "addSingleOrder":
      case "addOrder":
        result = addOrder(sheets, requestData);
        break;
      case "addBulk":
        result = addBulk(sheets, requestData);
        break;
      case "updateStatus":
        result = updateStatus(sheets, requestData);
        break;
      case "updateOrder":
        result = updateOrder(sheets, requestData);
        break;
      case "deleteOrder":
        result = deleteOrder(sheets, requestData);
        break;
      case "simulateCustomerLocationReply":
        result = simulateCustomerLocationReply(sheets, requestData);
        break;
      case "bulkUpdate":
        result = bulkUpdate(sheets, requestData);
        break;
      case "updateOrdersStatusBulk":
        result = updateOrdersStatusBulk(sheets, requestData);
        break;
      case "dashboard":
        result = getDashboardStats(sheets, requestData);
        break;
      case "getAuditLog":
        result = getAuditLog(sheets);
        break;
      case "getSupplierLedger":
        result = getSupplierLedger(sheets, requestData);
        break;
      case "settleSupplierDay":
        result = settleSupplierDay(sheets, requestData);
        break;
      case "saveSupplier":
        result = saveSupplier(sheets, requestData);
        break;
      case "supplierDashboard":
        result = getSupplierDashboard(sheets, requestData);
        break;
      case "supplierAccounts":
        result = getSupplierAccounts(sheets);
        break;
      case "addSupplierPayment":
        result = addSupplierPayment(sheets, requestData);
        break;
      case "getCourierLedger":
        result = getCourierLedger(sheets, requestData);
        break;
      case "getCourierInfo":
        result = getCourierInfo(sheets, requestData);
        break;
      case "addCourierAdjustment":
        result = addCourierAdjustment(sheets, requestData);
        break;
      case "settleCourierOrders":
        result = settleCourierOrders(sheets, requestData);
        break;
      case "instantCourierSettlement":
        result = instantCourierSettlement(sheets, requestData);
        break;
      case "closeCourierMonth":
        result = closeCourierMonth(sheets, requestData);
        break;
      case "statusHistory":
        result = getStatusHistory(sheets, requestData);
        break;
      case "cashbox":
        result = getCashbox(sheets);
        break;
      case "addCashbox":
        result = addCashbox(sheets, requestData);
        break;
      case "expenses":
        result = getExpenses(sheets);
        break;
      case "addExpense":
        result = addExpense(sheets, requestData);
        break;
      case "getUsers":
        result = getUsers(sheets);
        break;
      case "getStaffPermissions":
        result = getStaffPermissions(sheets, requestData);
        break;
      case "saveStaffPermissions":
        result = saveStaffPermissions(sheets, requestData);
        break;
      case "addUser":
      case "registerUser":
        result = registerUser(sheets, requestData);
        break;
      case "updateUser":
        result = updateUser(sheets, requestData);
        break;
      case "checkPhone":
        result = checkPhone(sheets, requestData);
        break;
      case "getCouriers":
        result = getCouriers(sheets, requestData);
        break;
      case "updateCourier":
        result = updateCourier(sheets, requestData);
        break;
      case "getSuppliers":
        result = getSuppliers(sheets);
        break;
      case "report":
        result = getReportStats(sheets, requestData);
        break;
      case "getDailyClosing":
        result = getDailyClosing(sheets);
        break;
      case "addDailyClosing":
        result = addDailyClosing(sheets, requestData);
        break;
      case "getWithdrawalRequests":
        result = getWithdrawalRequests(sheets);
        break;
      case "requestWithdrawal":
        result = requestWithdrawal(sheets, requestData);
        break;
      case "approveWithdrawal":
        result = approveWithdrawal(sheets, requestData);
        break;
      case "rejectWithdrawal":
        result = rejectWithdrawal(sheets, requestData);
        break;
      default:
        result = { ok: false, error: "الإجراء المطلوب غير مدعوم في السكريبت الحالي." };
    }

    return contentResponse(result);
  } catch (error) {
    return contentResponse({ ok: false, error: "حدث خطأ داخلي في معالجة الطلب: " + error.toString() });
  } finally {
    if (lockAcquired) {
      try {
        lock.releaseLock();
      } catch (lockErr) {
        // ignore
      }
    }
  }
}

function contentResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 🗂️ تهيئة وبناء الجداول تلقائياً إن لم تكن موجودة في الشيت
 */
function initSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const defs = {
    users: ["name", "role", "pass", "active", "email", "perms"],
    couriers: ["name", "phone", "commission", "salary", "region", "base_fixed_salary", "commission_success", "commission_return", "hire_date", "last_closing_date"],
    suppliers: ["name", "phone", "price", "notes", "openingBalance"],
    orders: [
      "tracking", "createdAt", "updatedAt", "orderDate", "supplier", "customer", 
      "phone", "phone2", "gov", "region", "address", "prodPrice", "shipPrice", 
      "totalCOD", "shipCost", "courier", "status", "prodType", "notes", "delivDate", "retDate", 
      "addedBy", "commission", "returnShippingType", "returnQueueStatus", "returnQueueAgent", "isSettledMonth", "موقع العميل/الخريطة",
      "originalProdPrice", "originalTotalCOD", "actualReceivedCash", "partialAmount", "isPartial", "returnSubStatus", "keptGoodsValue", "returnedGoodsValue"
    ],
    archivedOrders: [
      "tracking", "createdAt", "updatedAt", "orderDate", "supplier", "customer", 
      "phone", "phone2", "gov", "region", "address", "prodPrice", "shipPrice", 
      "totalCOD", "shipCost", "courier", "status", "prodType", "notes", "delivDate", "retDate", 
      "addedBy", "commission", "returnShippingType", "returnQueueStatus", "returnQueueAgent", "isSettled", "is_settled", "isSettledMonth", "موقع العميل/الخريطة",
      "originalProdPrice", "originalTotalCOD", "actualReceivedCash", "partialAmount", "isPartial", "returnSubStatus", "keptGoodsValue", "returnedGoodsValue"
    ],
    expenses: ["id", "date", "amount", "desc", "category", "addedBy", "isSettledMonth"],
    cashbox: ["date", "desc", "type", "amount", "ref", "addedBy", "isSettledMonth"],
    statusHistory: ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"],
    supplierLedger: ["supplier", "date", "type", "tracking", "amount", "desc"],
    supplierSettlements: ["supplier", "date", "status", "settledAt", "settledBy"],
    courierLedger: ["courier", "date", "type", "tracking", "amount", "desc", "isSettledMonth"],
    auditLog: ["user", "type", "dateTime", "oldVal", "newVal", "reason"],
    dailyClosing: ["date", "deliveredCount", "returnedCount", "totalCOD", "shippingCost", "addedBy"],
    withdrawalRequests: ["id", "date", "supplier", "amount", "paymentMethod", "status", "notes"],
    staffPermissions: ["name", "phone", "role", "salary", "perm_dashboard", "perm_orders", "perm_ledger", "perm_expenses", "perm_staff", "supervisor_id"]
  };

  // 🔄 قائمة مرادفات أسماء الشيتات (عربي / إنجليزي) لربط الشيتات الموجودة مسبقاً ومنع تكرارها
  const nameMappings = {
    users: ["المستخدمون", "المستخدمين", "الموظفين", "users"],
    couriers: ["المناديب", "اسم المندوب", "المندوبين", "مندوبي الشحن", "couriers"],
    suppliers: ["الموردين", "المورد المالي", "محل الأناقة", "suppliers"],
    orders: ["الطلبات", "الأوردرات", "الطلبيات", "orders"],
    archivedOrders: ["الأرشيف التاريخي", "الأرشيف", "الأرشيف التاريخي المعزول", "الطلبات المؤرشفة", "archivedOrders"],
    expenses: ["المصاريف", "المصروفات", "expenses"],
    cashbox: ["الخزنة", "حركة الخزينة", "الخزينة", "cashbox"],
    statusHistory: ["سجل الحالات", "حالات الشحنات", "حالات الشحنة", "statusHistory"],
    supplierLedger: ["كشف حساب الموردين", "حساب الموردين", "supplierLedger"],
    supplierSettlements: ["تصفية حسابات الموردين", "تصفية الموردين", "Supplier_Settlements", "supplierSettlements"],
    courierLedger: ["كشف حساب المناديب", "حساب المناديب", "حساب المندوبين", "courierLedger"],
    auditLog: ["سجل العمليات", "سجل التدقيق", "audit.log", "auditLog"],
    dailyClosing: ["التقفيل اليومي", "dailyClosing"],
    withdrawalRequests: ["Withdrawal_Requests", "طلبات السحب", "withdrawalRequests"],
    staffPermissions: ["صلاحيات الموظفين", "Staff_Permissions", "staffPermissions", "staff_permissions"]
  };

  const sheets = {};
  for (let key in defs) {
    let sheet = null;
    let fallbackName = key;
    if (key === "dailyClosing") {
      fallbackName = "التقفيل اليومي";
    } else if (key === "supplierSettlements") {
      fallbackName = "Supplier_Settlements";
    } else if (key === "withdrawalRequests") {
      fallbackName = "Withdrawal_Requests";
    }

    // البحث المتقدم بالأسماء المتوقعة
    const listNames = nameMappings[key] || [key];
    for (let i = 0; i < listNames.length; i++) {
      const nameToCheck = listNames[i];
      sheet = ss.getSheetByName(nameToCheck);
      if (sheet) {
        // وجدنا الشيت باسم مرادف، نقوم باعتماده وكسر البحث
        break;
      }
    }

    // إذا لم يعثر على الشيت بأي اسم مرادف، ننشئه بالاسم الافتراضي للمزامنة
    if (!sheet) {
      sheet = ss.insertSheet(fallbackName);
      sheet.appendRow(defs[key]);
      sheet.getRange(1, 1, 1, defs[key].length).setFontWeight("bold").setBackground("#f1f5f9");
    } else {
      // 🛡️ معالجة احترازية: محاذاة الأعمدة وإضافة الناقص منها تلقائياً لمنع أخطاء البيانات
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        sheet.appendRow(defs[key]);
        sheet.getRange(1, 1, 1, defs[key].length).setFontWeight("bold").setBackground("#f1f5f9");
      } else {
        const currentHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
          return h.toString().trim();
        });
        const expectedHeaders = defs[key];
        const missingHeaders = expectedHeaders.filter(function(h) {
          return h && currentHeaders.indexOf(h) === -1;
        });
        if (missingHeaders.length > 0) {
          const startCol = lastCol + 1;
          const range = sheet.getRange(1, startCol, 1, missingHeaders.length);
          range.setValues([missingHeaders]);
          range.setFontWeight("bold").setBackground("#e2e8f0"); // تظليل الأعمدة المدخلة حديثاً للشفافية
        }
      }
    }
    sheets[key] = sheet;
  }
  return sheets;
}

/**
 * 📄 تحويل جدول الشيت إلى مصفوفة كائنات مستندة على ترويسة الأعمدة
 */
function getTableData(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return [];
  const lastCol = sheet.getLastColumn();
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
  const rows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
  
  return rows.map(row => {
    let obj = {};
    headers.forEach((h, idx) => {
      let val = row[idx];
      // معالجة التواريخ لتجنب الاختلافات الزمنية لتبدو منسقة
      if (val instanceof Date) {
        obj[h] = Utilities.formatDate(val, "GMT+3", "yyyy-MM-dd HH:mm");
      } else {
        obj[h] = val;
      }
    });
    return obj;
  });
}

function appendToSheet(sheet, headers, obj) {
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : "");
  sheet.appendRow(row);
}

function now() {
  return Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd HH:mm:ss");
}

function nowDay() {
  return Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd");
}

function normalizeToDateString(dateInput) {
  if (!dateInput) return "";
  var str = dateInput.toString().trim();

  // 1. Matches YYYY-MM-DD or YYYY/MM/DD (with optional time)
  var matchYMD = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (matchYMD) {
    var y = matchYMD[1];
    var m = matchYMD[2].length === 1 ? "0" + matchYMD[2] : matchYMD[2];
    var d = matchYMD[3].length === 1 ? "0" + matchYMD[3] : matchYMD[3];
    return y + "-" + m + "-" + d;
  }

  // 2. Matches DD/MM/YYYY or DD-MM-YYYY (Egyptian/Arabic standard, with optional time)
  var matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (matchDMY) {
    var d = matchDMY[1].length === 1 ? "0" + matchDMY[1] : matchDMY[1];
    var m = matchDMY[2].length === 1 ? "0" + matchDMY[2] : matchDMY[2];
    var y = matchDMY[3];
    return y + "-" + m + "-" + d;
  }

  // 3. Matches DD/MM or DD-MM (with optional time, missing year)
  var matchDM = str.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (matchDM) {
    var d = matchDM[1].length === 1 ? "0" + matchDM[1] : matchDM = matchDM[1];
    var m = matchDM[2].length === 1 ? "0" + matchDM[2] : matchDM = matchDM[2];
    var y = "2026";
    try {
      y = new Date().getFullYear().toString();
    } catch (e) {}
    return y + "-" + m + "-" + d;
  }

  try {
    var dateObj = new Date(str);
    if (!isNaN(dateObj.getTime())) {
      var pad = function(n) { return n.toString().length === 1 ? "0" + n : n.toString(); };
      return dateObj.getFullYear() + "-" + pad(dateObj.getMonth() + 1) + "-" + pad(dateObj.getDate());
    }
  } catch (e) {}
  return str.substring(0, 10);
}

/**
 * دالة البحث السريع عن سطر أوردر بناءً على كود التتبع
 */
function findRowIndex(sheet, key, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return -1;
  const colIndex = getHeaderIndex(sheet, key);
  if (colIndex === -1) return -1;
  const vals = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
  for (let i = 0; i < vals.length; i++) {
    if (vals[i][0].toString().trim() === value.toString().trim()) {
      return i + 2; // +2 للتعويض عن الترويسة وبدء العد من 1
    }
  }
  return -1;
}

function getHeaderIndex(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (let i = 0; i < headers.length; i++) {
    if (headers[i].trim() === headerName) return i + 1;
  }
  return -1;
}

function updateRowByObject(sheet, rowIndex, obj) {
  const lastCol = sheet.getLastColumn();
  if (lastCol <= 0) return;
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
  headers.forEach((h, colIdx) => {
    if (h && obj[h] !== undefined) {
      sheet.getRange(rowIndex, colIdx + 1).setValue(obj[h]);
    }
  });
}

// ───────────────────────────────────────────────
// (أ) الدوال الرئيسية للتعامل مع الأوردرات
// ───────────────────────────────────────────────

function getOrders(sheets, d) {
  var orders = getTableData(sheets.orders) || [];
  orders.forEach(function(o) { if (o) o.isArchived = false; });
  var archived = [];
  try {
    archived = getTableData(sheets.archivedOrders) || [];
    archived.forEach(function(o) { if (o) o.isArchived = true; });
  } catch (e) {
    // Graceful fallback
  }
  var merged = orders.concat(archived);
  
  // De-duplicate by tracking ID to ensure no double-counting or duplicate entries
  var seen = {};
  var uniqueMerged = [];
  for (var i = 0; i < merged.length; i++) {
    var o = merged[i];
    if (!o) continue;
    var track = (o.tracking || "").toString().trim().toUpperCase();
    if (!track) {
      uniqueMerged.push(o);
      continue;
    }
    if (!seen[track]) {
      seen[track] = true;
      uniqueMerged.push(o);
    }
  }

  // Supervisor Hierarchy Filter in Google Sheets backend
  if (d && d.currentRole === "مشرف") {
    var supervisorName = (d.currentUser || "").toString().trim();
    var staffPermissionsList = getTableData(sheets.staffPermissions) || [];
    var supervisedNames = [];
    for (var j = 0; j < staffPermissionsList.length; j++) {
      var item = staffPermissionsList[j];
      if ((item.supervisor_id || "").toString().trim() === supervisorName) {
        supervisedNames.push((item.name || "").toString().trim());
      }
    }
    // Filter merged orders list to show only those assigned to supervised couriers
    uniqueMerged = uniqueMerged.filter(function(o) {
      var oCou = (o.courier || "").toString().trim();
      return oCou && supervisedNames.indexOf(oCou) !== -1;
    });
  }
  
  return { ok: true, orders: uniqueMerged };
}

function getArchivedOrders(sheets) {
  var list = [];
  try {
    list = getTableData(sheets.archivedOrders) || [];
  } catch (e) {
    // Graceful fallback
  }
  return { ok: true, orders: list };
}

function addOrder(sheets, d) {
  const o = d.order;
  if (!o) return { ok: false, error: "بيانات الأوردر مفقودة" };

  // Use already generated or supplied tracking id immediately without scanning sheet
  const trackingId = o.tracking || d.tracking || ("FP-" + Math.floor(100000 + Math.random() * 900000));

  // Strict backend check in sheets.orders and sheets.archivedOrders to completely block duplicates
  if (findRowIndex(sheets.orders, "tracking", trackingId) !== -1 ||
      (sheets.archivedOrders && findRowIndex(sheets.archivedOrders, "tracking", trackingId) !== -1)) {
    return { ok: false, error: "هذا الأوردر مسجل بالفعل" };
  }

  o.tracking = trackingId;

  const sPrice = Number(o.shipPrice || 60);
  const tCOD = Number(o.totalCOD || (Number(o.prodPrice || 0) + sPrice));
  const pPrice = tCOD - sPrice;

  // Courier Auto-Assignment by Region (Primary and Secondary)
  const couriers = getTableData(sheets.couriers) || [];
  let matchedCourier = null;
  const orderRegion = o.region || "";
  if (orderRegion) {
    const cleanOrderRegion = orderRegion.toString().trim().toLowerCase();
    if (cleanOrderRegion) {
      matchedCourier = couriers.find(function(c) {
        if (!c.region) return false;
        const regions = c.region.toString().split(/[,|،\s]+/).map(function(r) { return r.trim().toLowerCase(); }).filter(Boolean);
        if (regions.indexOf(cleanOrderRegion) !== -1) return true;

        const cleanCourierRegion = c.region.toString().trim().toLowerCase();
        if (cleanCourierRegion.indexOf(cleanOrderRegion) !== -1 || cleanOrderRegion.indexOf(cleanCourierRegion) !== -1) return true;

        const secRegion = c.secondary_region || c.secondaryRegion;
        if (secRegion) {
          const secRegions = secRegion.toString().split(/[,|،\s]+/).map(function(r) { return r.trim().toLowerCase(); }).filter(Boolean);
          if (secRegions.indexOf(cleanOrderRegion) !== -1) return true;
        }

        return false;
      });
    }
  }

  const isSupplier = d.currentRole === "مورد" || d.role === "مورد";
  const initialCourier = isSupplier ? "" : (matchedCourier ? matchedCourier.name : "");
  const initialStatus = isSupplier ? "جاهز للاستلام من المورد" : (matchedCourier ? "مُسند جديد" : "جديد");
  const initialCommission = isSupplier ? 0 : (matchedCourier ? Number(matchedCourier.commission || 25) : 0);

  const newOrder = {
    tracking: trackingId,
    createdAt: now(),
    updatedAt: now(),
    orderDate: o.orderDate || nowDay(),
    supplier: isSupplier ? d.currentUser : (o.supplier || "مورد عام"),
    customer: o.customer || "",
    phone: o.phone || "",
    phone2: o.phone2 || "",
    gov: o.gov || "القاهرة",
    region: o.region || "",
    address: o.address || "",
    prodPrice: pPrice,
    shipPrice: sPrice,
    totalCOD: tCOD,
    shipCost: sPrice,
    courier: initialCourier,
    status: initialStatus,
    prodType: o.prodType || "",
    notes: o.notes || "",
    delivDate: "",
    retDate: "",
    addedBy: d.currentUser || "إدارة",
    commission: initialCommission,
    returnShippingType: "",
    returnQueueStatus: "",
    returnQueueAgent: "",
    "موقع العميل/الخريطة": ""
  };

  // Append directly to the orders sheet using simple appendRow mapping
  const lastCol = sheets.orders.getLastColumn();
  const headers = sheets.orders.getRange(1, 1, 1, lastCol > 0 ? lastCol : 1).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
  appendToSheet(sheets.orders, headers, newOrder);

  // Trigger simulated interactive WhatsApp Webhook for location confirmation
  try {
    triggerCustomerLocationRequest(newOrder.tracking, newOrder.phone, newOrder.supplier);
  } catch (errLocation) {
    Logger.log("Failed to trigger location webhook simulation: " + errLocation.toString());
  }

  // Record Status History (fast append)
  appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
    tracking: newOrder.tracking,
    oldStatus: "",
    newStatus: initialStatus,
    updatedBy: d.currentUser || "موظف",
    dateTime: now()
  });

  return { ok: true, msg: "تم تسجيل الأوردر بنجاح", order: newOrder };
}

function addBulk(sheets, d) {
  const list = d.orders;
  if (!list || !list.length) return { ok: false, error: "لا توجد أوردرات للرفع" };

  const lastCol = sheets.orders.getLastColumn();
  const headers = sheets.orders.getRange(1, 1, 1, lastCol > 0 ? lastCol : 1).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
  let addedCount = 0;
  
  // Cache current last row to avoid reading getLastRow inside loop
  let currentLastRow = sheets.orders.getLastRow();
  const yearSuffix = Utilities.formatDate(new Date(), "GMT+3", "yy");
  const fallbackSupplier = d.supplier || "مورد عام";

  // Cache existing trackings to avoid repeating findRowIndex in loop
  const existingTrackings = {};
  if (currentLastRow > 1) {
    const colIndex = getHeaderIndex(sheets.orders, "tracking");
    if (colIndex !== -1) {
      const vals = sheets.orders.getRange(2, colIndex, currentLastRow - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        existingTrackings[vals[i][0].toString().trim()] = true;
      }
    }
  }

  // Pre-fetch all registered suppliers from sheets to check against dynamically
  const registeredSuppliers = getTableData(sheets.suppliers);
  // Pre-fetch all registered couriers
  const couriers = getTableData(sheets.couriers) || [];

  list.forEach(o => {
    if (!o.tracking) {
      let counter = 1000 + currentLastRow;
      let candidate = "FP-" + counter + "-" + yearSuffix;
      while (existingTrackings[candidate]) {
        counter++;
        candidate = "FP-" + counter + "-" + yearSuffix;
      }
      o.tracking = candidate;
      existingTrackings[candidate] = true;
      currentLastRow = counter - 1000 + 1; // update currentLastRow for subsequent generations
    }

    if (!existingTrackings[o.tracking]) {
      existingTrackings[o.tracking] = true; // reserve it
      // Resolve supplier row-by-row
      let orderSupplier = fallbackSupplier;
      if (d.currentRole === "مورد") {
        orderSupplier = d.currentUser;
      } else {
        const itemRowSupplier = (o.supplier || "").toString().trim();
        if (itemRowSupplier) {
          orderSupplier = itemRowSupplier;
          // Automap: if it doesn't exist in suppliers, append it to sheets.suppliers
          const matchedSup = registeredSuppliers.find(function(s) {
            return s.name && s.name.trim().toLowerCase() === itemRowSupplier.toLowerCase();
          });
          if (!matchedSup) {
            appendToSheet(sheets.suppliers, ["name", "phone", "price", "notes"], {
              name: itemRowSupplier,
              phone: "—",
              price: 60,
              notes: "تم تسجيله تلقائياً عن طريق رفع جماعي"
            });
            registeredSuppliers.push({ name: itemRowSupplier, phone: "—", price: 60, notes: "تم تسجيله تلقائياً عن طريق رفع جماعي" });
          }
        } else {
          orderSupplier = fallbackSupplier;
        }
      }

      // Resolve prices smartly (by reading total, shipping, product, cash to be collected from synonyms)
      let pPrice = Number(o.prodPrice) || 0;
      let sPrice = Number(o.shipPrice) || 0;
      let tCOD = Number(o.totalCOD) || 0;

      const rawShip = o["سعر الشحن"] || o["الشحن"] || o["تكلفة الشحن"] || o["مصاريف الشحن"] || o["shipping"] || o["shipPrice"] || o["ship_price"];
      const rawTotal = o["المطلوب تحصيله"] || o["التحصيل"] || o["المطلوب"] || o["إجمالي الكود"] || o["الإجمالي"] || o["الاجمالي"] || o["إجمالي الأوردر"] || o["total"] || o["totalCOD"] || o["total_cod"] || o["cash_to_be_collected"] || o["cash"];
      const rawProd = o["سعر المنتج"] || o["المنتج"] || o["سعر المادة"] || o["price"] || o["prodPrice"] || o["product_price"];

      if (sPrice === 0 && rawShip !== undefined && !isNaN(Number(rawShip))) {
        sPrice = Number(rawShip);
      }
      if (sPrice === 0) sPrice = 60; // default shipping fee fallback

      if (tCOD === 0 && rawTotal !== undefined && !isNaN(Number(rawTotal))) {
        tCOD = Number(rawTotal);
      }

      if (pPrice === 0 && rawProd !== undefined && !isNaN(Number(rawProd))) {
        pPrice = Number(rawProd);
      }

      // Enforce Formula: Supplier_Net_Balance = Total_Collected - Shipping_Fees
      if (tCOD > 0) {
        pPrice = tCOD - sPrice;
      } else if (pPrice > 0) {
        tCOD = pPrice + sPrice;
      } else {
        // Fallbacks
        pPrice = 200;
        tCOD = pPrice + sPrice;
      }

      // Courier Auto-Assignment by Region (Primary and Secondary)
      let matchedCourier = null;
      const orderRegion = o.region || "";
      if (orderRegion) {
        const cleanOrderRegion = orderRegion.toString().trim().toLowerCase();
        if (cleanOrderRegion) {
          matchedCourier = couriers.find(function(c) {
            if (!c.region) return false;
            const regions = c.region.toString().split(/[,|،\s]+/).map(function(r) { return r.trim().toLowerCase(); }).filter(Boolean);
            if (regions.indexOf(cleanOrderRegion) !== -1) return true;

            const cleanCourierRegion = c.region.toString().trim().toLowerCase();
            if (cleanCourierRegion.indexOf(cleanOrderRegion) !== -1 || cleanOrderRegion.indexOf(cleanCourierRegion) !== -1) return true;

            const secRegion = c.secondary_region || c.secondaryRegion;
            if (secRegion) {
              const secRegions = secRegion.toString().split(/[,|،\s]+/).map(function(r) { return r.trim().toLowerCase(); }).filter(Boolean);
              if (secRegions.indexOf(cleanOrderRegion) !== -1) return true;
            }

            return false;
          });
        }
      }

      const isSupplier = d.currentRole === "مورد" || d.role === "مورد";
      const initialCourier = isSupplier ? "" : (matchedCourier ? matchedCourier.name : "");
      const initialStatus = isSupplier ? "جاهز للاستلام من المورد" : (matchedCourier ? "مُسند جديد" : "جديد");
      const initialCommission = isSupplier ? 0 : (matchedCourier ? Number(matchedCourier.commission || 25) : 0);

      const draft = {
        tracking: o.tracking,
        createdAt: now(),
        updatedAt: now(),
        orderDate: o.orderDate || nowDay(),
        supplier: orderSupplier,
        customer: o.customer || "",
        phone: o.phone || "",
        phone2: o.phone2 || "",
        gov: o.gov || "القاهرة",
        region: o.region || "",
        address: o.address || "",
        prodPrice: pPrice,
        shipPrice: sPrice,
        totalCOD: tCOD,
        shipCost: sPrice,
        courier: initialCourier,
        status: initialStatus,
        prodType: o.prodType || "",
        notes: o.notes || "",
        delivDate: "",
        retDate: "",
        addedBy: d.currentUser || "إدارة",
        commission: initialCommission,
        returnShippingType: "",
        returnQueueStatus: "",
        returnQueueAgent: ""
      };

      appendToSheet(sheets.orders, headers, draft);

      // Record Status History
      appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
        tracking: draft.tracking,
        oldStatus: "",
        newStatus: initialStatus,
        updatedBy: d.currentUser || "موظف",
        dateTime: now()
      });

      addedCount++;
    }
  });

  return { ok: true, added: addedCount, msg: `تم رفع ${addedCount} أوردر بنجاح` };
}

function updateStatus(sheets, d) {
  let { tracking, status, returnShippingType, currentUser, currentRole, notes, delivDate, date, clearCourierWithSignature } = d;
  if (!tracking || !status) return { ok: false, error: "معاملات مسندة مفقودة" };

  if (status === "تم تسليم المرتجع للمورد وتصفية حسابه" || status === "تم تسليمه للمورد") status = "تم تسليم المرتجع للمورد";
  if (status === "تم التسليم بنجاح") status = "تم التسليم";
  if (status === "مؤجل بناءً على طلب العميل") status = "مؤجل";

  // 🚨 Security Guard & Role Enforcement for Apps Script
  const cleanRole = (currentRole || "").toString().trim();
  const isAdmin = cleanRole === "مدير" || cleanRole === "مشرف";
  const isAgent = cleanRole === "مندوب" || cleanRole.includes("مندوب");
  const isOps = cleanRole === "موظف عمليات" || cleanRole.includes("عمليات");
  const isReturnsOfficer = cleanRole === "مسؤول مرتجعات" || cleanRole.includes("مرتجع");
  const isSupplier = cleanRole === "مورد" || cleanRole.includes("مورد");

  let finalStatus = status;
  if (status === "تم تسليم المرتجع للمورد وتصفية حسابه") finalStatus = "تم تسليم المرتجع للمورد";
  if (status === "تم التسليم بنجاح") finalStatus = "تم التسليم";
  if (status === "مؤجل بناءً على طلب العميل") finalStatus = "مؤجل";

  if (isSupplier) {
    return { ok: false, error: "Unauthorized Action: المورد لا يمتلك صلاحية تعديل الحالة" };
  }

  if (isAgent) {
    const allowed = ["تم التسليم", "تم التسليم بنجاح", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "العميل رد وجاري التسليم", "مؤجل", "مؤجل بناءً على طلب العميل", "لا يوجد رد", "مرتجع", "خارج مع المندوب"];
    if (!allowed.includes(status)) {
      return { ok: false, error: "Unauthorized Action: غير مسموح للمندوب باختيار هذه الحالة" };
    }
  }

  if (isOps) {
    const allowed = ["تم رد العميل وجاري التنسيق", "لا يرد - محاولة أولى/ثانية", "تحديث نتيجة الاتصال", "مؤجل", "لا يوجد رد", "جديد", "خارج مع المندوب", "العميل لغى الأوردر / مرتجع", "مرتجع"];
    if (!allowed.includes(status)) {
      return { ok: false, error: "Unauthorized Action: غير مسموح لموظف العمليات باختيار هذه الحالة" };
    }
  }

  if (isReturnsOfficer) {
    const allowed = ["مرتجع جديد", "مرتجع جاري تسليمه للمكتب", "جاري الرجوع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", "تم تسليم المرتجع للمورد", "جديد"];
    if (!allowed.includes(status)) {
      return { ok: false, error: "Unauthorized Action: غير مسموح لمسؤول المرتجعات باختيار هذه الحالة" };
    }
  }

  let activeRowIndex = findRowIndex(sheets.orders, "tracking", tracking);
  let archivedRowIndex = findRowIndex(sheets.archivedOrders, "tracking", tracking);
  let orderIndex = activeRowIndex !== -1 ? activeRowIndex : archivedRowIndex;
  let targetSheet = activeRowIndex !== -1 ? sheets.orders : sheets.archivedOrders;
  
  if (orderIndex === -1) return { ok: false, error: "الأوردر المطلوب غير موجود" };

  const orders = getTableData(targetSheet);
  const order = orders.find(x => x.tracking === tracking);

  // Rider can only touch their own orders
  if (isAgent && order.courier !== currentUser) {
    return { ok: false, error: "Unauthorized Action: هذا الأوردر ليس مسنداً إليك" };
  }

  const oldStatus = order.status;

  // 🔒 Strict Status Workflow Lock: Prevent reverting back to 'جديد' once modified
  if (finalStatus === "جديد" && oldStatus !== "جديد") {
    return { ok: false, error: "قفل أمان: لا يمكن إرجاع حالة الأوردر إلى جديد بعد تعديله وتعديل حالته" };
  }

  if ((oldStatus === "تم التسليم" || oldStatus === "التسليم للمورد" || oldStatus === "تم تسليم المرتجع للمورد") && !isAdmin && cleanRole !== "محاسب") {
    return { ok: false, error: "لا يمكن تعديل حالة الأوردر المغلق مسبقاً إلا للمسؤولين والمدير" };
  }

  // الحالات الافتراضية للتحديث
  let updateObj = {
    status: finalStatus,
    updatedAt: now()
  };

  const cleanClearCourier = clearCourierWithSignature === true || clearCourierWithSignature === "true";
  if (cleanClearCourier) {
    if (order.courier) {
      updateObj.courierSignature = order.courier + " (توقيع تصفية المرتجع ✍️)";
      updateObj.lastCourier = order.courier;
      updateObj.courier = "";
    }
  }

  if (notes !== undefined && notes !== "") {
    updateObj.notes = notes;
  }
  const anyDate = date || delivDate;
  if (anyDate !== undefined && anyDate !== "") {
    updateObj.delivDate = anyDate;
  }

  // معالجة حالة المرتجع (مرتجع)
  if (finalStatus === "مرتجع") {
    if (!returnShippingType) {
      return { ok: false, error: "يرجى تحديد ما إذا كان العميل قد دفع الشحن أم رفض" };
    }
    updateObj.status = "مرتجع";
    updateObj.returnShippingType = returnShippingType;
    updateObj.retDate = now();

    // 1. حساب عمولة المندوب للمرتجع
    if (returnShippingType === "paid") {
      const couriers = getTableData(sheets.couriers);
      const courierProfile = couriers.find(c => c.name === order.courier);
      const commVal = courierProfile ? Number(courierProfile.commission || 25) : 25;
      updateObj.commission = commVal;

      appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
        courier: order.courier,
        date: now(),
        type: "مرتجع مدفوع الشحن",
        tracking: tracking,
        amount: commVal,
        desc: `عمولة مرتجع مدفوع الشحن للأوردر: ${tracking}`
      });
    } else {
      updateObj.commission = 0;
      appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
        courier: order.courier,
        date: now(),
        type: "مرتجع غير مدفوع الشحن",
        tracking: tracking,
        amount: 0,
        desc: `عمولة مرتجع غير مدفوع الشحن للأوردر: ${tracking}`
      });
    }

    // 2. تفعيل Queue المرتجعات تلقائياً للمتابعة
    updateObj.returnQueueStatus = "مرتجع جديد";
    const users = getTableData(sheets.users);
    const returnsAgent = users.find(u => u.role === "مسؤول مرتجعات" && u.active === "نعم");
    updateObj.returnQueueAgent = returnsAgent ? returnsAgent.name : "أحمد المرتجعات";
  }

  // معالجة تغيير أوضاع تتبع المرتجعات Queue
  const queueStatuses = ["مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد", "تم تسليم المرتجع للمورد"];
  if (queueStatuses.includes(status)) {
    updateObj.returnQueueStatus = status;
    if (status === "تم تسليم المرتجع للمورد") {
      updateObj.status = "التسليم للمورد";
      updateObj.retDate = now();
    }
  }

  // معالجة استلام المرتجع عند المورد وحسم حسابه المالي تلقائياً
  if (status === "التسليم للمورد" || status === "تم تسليم المرتجع للمورد" || status === "مرتجع تم تسليمه للمورد") {
    updateObj.retDate = now();
  }

  // معالجة الأوردرات المسلّمة (تم التسليم) وحركتها المالية بالخزنة المركزية لتجنب العجز
  if (status === "تم التسليم") {
    updateObj.delivDate = now();
    const couriers = getTableData(sheets.couriers);
    const courierProfile = couriers.find(c => c.name === order.courier);
    const commVal = courierProfile ? Number(courierProfile.commission || 25) : 25;
    updateObj.commission = commVal;

    // تسجيل عمولة التوصيل بدفتر المندوب
    appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
      courier: order.courier,
      date: now(),
      type: "تسليم",
      tracking: tracking,
      amount: commVal,
      desc: `عمولة تسليم الأوردر والتحصيل للأوردر: ${tracking}`
    });

  }

  if (status === "تسليم جزئي" || status === "تسليم جزئي - معلق للجرد") {
    updateObj.delivDate = now();
    const pAm = Number(d.partialAmount || order.totalCOD || 0);

    // Save original product price before modifying totalCOD!
    var financialsBefore = getOrderFinancials(order);
    if (!order.originalProdPrice) {
      updateObj.originalProdPrice = financialsBefore.prodPrice;
    }
    if (!order.originalTotalCOD) {
      updateObj.originalTotalCOD = financialsBefore.totalCOD;
    }

    const shipPrice = Number(order.shipPrice || financialsBefore.shipPrice || 60);
    const original_prod_price = Number(order.originalProdPrice || financialsBefore.prodPrice);
    const kept_goods_value = Math.max(0, pAm - shipPrice);
    const returned_goods_value = Math.max(0, original_prod_price - kept_goods_value);

    updateObj.totalCOD = pAm;
    updateObj.partialAmount = pAm;
    updateObj.actualReceivedCash = pAm;
    updateObj.keptGoodsValue = kept_goods_value;
    updateObj.returnedGoodsValue = returned_goods_value;
    updateObj.returnQueueStatus = "مرتجع جزئي بالمستودع";
    updateObj.isPartial = true;

    const couriers = getTableData(sheets.couriers);
    const courierProfile = couriers.find(c => c.name === order.courier);
    const commVal = courierProfile ? Number(courierProfile.commission || 25) : 25;
    updateObj.commission = commVal;

    appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
      courier: order.courier,
      date: now(),
      type: "تسليم جزئي",
      tracking: tracking,
      amount: commVal,
      desc: `عمولة تسليم جزئي للأوردر: ${tracking} (المبلغ الفعلي المستلم: ${pAm} ج.م)`
    });

  }

  if (status === "العميل رد وجاري التسليم") {
    updateObj.customerConfirmed = "true";
  }

  if (status === "مؤجل" || status === "مؤجل بالمستودع") {
    if (!order.firstPostponedDate) {
      updateObj.firstPostponedDate = now();
    }
  }

  // إتمام الحفظ والتعديل (التحديث الثنائي المتزامن للـ Active والأرشيف)
  let activeIndexForSave = findRowIndex(sheets.orders, "tracking", tracking);
  let archivedIndexForSave = findRowIndex(sheets.archivedOrders, "tracking", tracking);
  
  if (activeIndexForSave !== -1) {
    updateRowByObject(sheets.orders, activeIndexForSave, updateObj);
  }
  if (archivedIndexForSave !== -1) {
    updateRowByObject(sheets.archivedOrders, archivedIndexForSave, updateObj);
  }

  // منطق ترحيل البضائع الصارم والاسترجاع من الأرشيف:
  // إذا كان الأوردر في الأرشيف وتغيرت حالته إلى حالة نشطة غير صالحة للأرشفة (خارج مع المندوب، مؤجل، مرتجع في المستودع إلخ)،
  // فيتم إرجاعه للشيت النشط فوراً لضمان عدم ضياع عهدة البضائع ومنع ارتداد الحالة، ثم حذفه نهائياً من شيت الأرشيف.
  const eventualStatus = updateObj.status || oldStatus;
  const isEventualArchivable = ["تم التسليم", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(eventualStatus);
  
  if (archivedIndexForSave !== -1 && !isEventualArchivable) {
    const updatedArchivedData = getTableData(sheets.archivedOrders);
    const updatedOrderObj = updatedArchivedData.find(x => x.tracking === tracking);
    
    if (updatedOrderObj) {
      if (activeIndexForSave === -1) {
        const activeHeaders = ["tracking", "createdAt", "updatedAt", "orderDate", "supplier", "customer", "phone", "phone2", "gov", "region", "address", "prodPrice", "shipPrice", "totalCOD", "shipCost", "courier", "status", "prodType", "notes", "delivDate", "retDate", "addedBy", "commission", "returnShippingType", "returnQueueStatus", "returnQueueAgent", "موقع العميل/الخريطة"];
        appendToSheet(sheets.orders, activeHeaders, updatedOrderObj);
      }
      
      // حذفه نهائياً من الأرشيف لسلامة مخزون عهد المندوبين
      let freshArchivedIndex = findRowIndex(sheets.archivedOrders, "tracking", tracking);
      if (freshArchivedIndex !== -1) {
        sheets.archivedOrders.deleteRow(freshArchivedIndex);
      }
    }
  }

  // إثبات التغيير في سجل الحركات والأمان
  appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
    tracking: tracking,
    oldStatus: oldStatus,
    newStatus: status,
    updatedBy: currentUser || "خادم تلقائي",
    dateTime: now()
  });

  return { ok: true, tracking, status, msg: "تم تحديث حالة الأوردر بنجاح" };
}

function updateOrder(sheets, d) {
  const o = d.order;
  if (!o || !o.tracking) return { ok: false, error: "بيانات الأوردر المطلوب تعديله غير صحيحة" };

  let activeIndex = findRowIndex(sheets.orders, "tracking", o.tracking);
  let archivedIndex = findRowIndex(sheets.archivedOrders, "tracking", o.tracking);
  let orderIndex = activeIndex !== -1 ? activeIndex : archivedIndex;
  let targetSheet = activeIndex !== -1 ? sheets.orders : sheets.archivedOrders;
  
  if (orderIndex === -1) return { ok: false, error: "الأوردر غير موجود" };

  const orders = getTableData(targetSheet);
  const order = orders.find(x => x.tracking === o.tracking);

  const oldProd = Number(order.prodPrice || 0);
  const oldShip = Number(order.shipPrice || 0);
  const newProd = o.prodPrice !== undefined ? Number(o.prodPrice) : oldProd;
  const newShip = o.shipPrice !== undefined ? Number(o.shipPrice) : oldShip;

  // رصد ومراقبة التعديل المالي في سجل الأمان لمنع الاختلاس
  if (oldProd !== newProd || oldShip !== newShip) {
    o.prodPrice = newProd;
    o.shipPrice = newShip;
    o.totalCOD = newProd + newShip;
    o.shipCost = newShip;

    // تحديث كشف حساب المورد في الشيت أيضاً لمزامنة التغيير المالي
    const ledgerIndex = findRowIndex(sheets.supplierLedger, "tracking", o.tracking);
    if (ledgerIndex !== -1) {
      updateRowByObject(sheets.supplierLedger, ledgerIndex, {
        amount: newProd,
        desc: `تعديل قيمة أوردر مستلم ${o.tracking} (صافي حساب المورد: ${newProd} = الكلي ${o.totalCOD} - الشحن ${newShip})`
      });
    }

    appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
      user: d.currentUser || "إدارة",
      type: "تعديل مالي أوردر",
      dateTime: now(),
      oldVal: `سعر المنتج: ${oldProd} ج.م، الشحن: ${oldShip} ج.م`,
      newVal: `سعر المنتج: ${newProd} ج.م، الشحن: ${newShip} ج.م`,
      reason: d.reason || o.reason || "تجميع وتعديل الأسعار يدويًا بواسطة الإدارة"
    });
  }

  if (o.courier !== undefined) {
    const oldCourier = order.courier;
    if (o.courier === "reset_warehouse" || o.courier === "") {
      const prevStatus = order.status;
      o.lastCourier = oldCourier;
      o.lastCommission = order.commission;
      o.courier = "";
      o.commission = 0;
      
      // Strict status transitions on courier reset
      if (prevStatus === "مرتجع") {
        o.status = "مرتجع بالمستودع";
      } else if (prevStatus === "تسليم جزئي") {
        o.status = "مرتجع جزئي بالمستودع";
      } else if (prevStatus === "مؤجل") {
        o.status = "مؤجل"; // remains مؤجل
      } else if (prevStatus === "تم التسليم" || prevStatus === "تم التسليم بنجاح" || prevStatus === "تم التسليم (ناجح كاش)") {
        o.status = prevStatus; // remains تم التسليم
      } else {
        if (prevStatus !== "جديد") {
          // Strict state lock: keep original status to prevent resetting to 'جديد'
          o.status = prevStatus;
        }
      }
      
      if (o.status !== prevStatus) {
        appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
          tracking: o.tracking,
          oldStatus: prevStatus,
          newStatus: o.status,
          updatedBy: d.currentUser || "إدارة",
          dateTime: now()
        });
      }
    } else {
      o.courier = o.courier;
      // If assigned (and old courier was empty/different), transition status to 'تم الإسناد' per workflow
      if (o.courier && (!oldCourier || oldCourier === "reset_warehouse" || oldCourier === "") && order.status === "جديد") {
        o.status = "مُسند جديد";
        appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
          tracking: o.tracking,
          oldStatus: "جديد",
          newStatus: "مُسند جديد",
          updatedBy: d.currentUser || "إدارة",
          dateTime: now()
        });
      }
      const couriers = getTableData(sheets.couriers);
      const cProfile = couriers.find(c => c.name === o.courier);
      o.commission = cProfile ? Number(cProfile.commission || 25) : 25;
    }
  }

  o.updatedAt = now();

  // إتمام الحفظ والتعديل (التحديث الثنائي المتزامن للـ Active والأرشيف)
  let activeIndexForSave = findRowIndex(sheets.orders, "tracking", o.tracking);
  let archivedIndexForSave = findRowIndex(sheets.archivedOrders, "tracking", o.tracking);
  
  if (activeIndexForSave !== -1) {
    updateRowByObject(sheets.orders, activeIndexForSave, o);
  }
  if (archivedIndexForSave !== -1) {
    updateRowByObject(sheets.archivedOrders, archivedIndexForSave, o);
  }

  // منطق ترحيل البضائع الصارم والاسترجاع من الأرشيف:
  // إذا تغيرت حالة الأوردر إلى حالة نشطة غير صالحة للأرشفة جراء التعديل،
  // فيتم إرجاعه للشيت النشط فوراً لضمان عدم ضياع عهدة البضائع ومنع ارتداد الحالة، ثم حذفه نهائياً من شيت الأرشيف.
  const eventualStatus = o.status || order.status;
  const isEventualArchivable = ["تم التسليم", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(eventualStatus);
  
  if (archivedIndexForSave !== -1 && !isEventualArchivable) {
    const updatedArchivedData = getTableData(sheets.archivedOrders);
    const updatedOrderObj = updatedArchivedData.find(x => x.tracking === o.tracking);
    
    if (updatedOrderObj) {
      if (activeIndexForSave === -1) {
        const activeHeaders = ["tracking", "createdAt", "updatedAt", "orderDate", "supplier", "customer", "phone", "phone2", "gov", "region", "address", "prodPrice", "shipPrice", "totalCOD", "shipCost", "courier", "status", "prodType", "notes", "delivDate", "retDate", "addedBy", "commission", "returnShippingType", "returnQueueStatus", "returnQueueAgent", "موقع العميل/الخريطة"];
        appendToSheet(sheets.orders, activeHeaders, updatedOrderObj);
      }
      
      // حذفه نهائياً من الأرشيف لسلامة مخزون عهد المندوبين
      let freshArchivedIndex = findRowIndex(sheets.archivedOrders, "tracking", o.tracking);
      if (freshArchivedIndex !== -1) {
        sheets.archivedOrders.deleteRow(freshArchivedIndex);
      }
    }
  }

  return { ok: true, msg: "تم حفظ وتحديث الأوردر بالكامل بنجاح" };
}

function deleteOrder(sheets, d) {
  const { tracking, currentUser } = d;
  let orderIndex = findRowIndex(sheets.orders, "tracking", tracking);
  let targetSheet = sheets.orders;
  if (orderIndex === -1) {
    orderIndex = findRowIndex(sheets.archivedOrders, "tracking", tracking);
    if (orderIndex !== -1) {
      targetSheet = sheets.archivedOrders;
    }
  }
  if (orderIndex === -1) return { ok: false, error: "الأوردر غير موجود لحذفه" };

  targetSheet.deleteRow(orderIndex);

  // تسجيل عملية الحذف في سجلات المراقبة الأمنية
  appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
    user: currentUser || "إدارة",
    type: "حذف أوردر",
    dateTime: now(),
    oldVal: tracking,
    newVal: "—",
    reason: `حذف الأوردر كود: ${tracking} نهائياً بواسطة الإدارة`
  });

  return { ok: true, msg: "تم حذف الأوردر نهائياً بكل أمان" };
}

function bulkUpdate(sheets, d) {
  const { trackings, status, courier, bulkStatus, currentRole, currentUser, notes, delivDate, date } = d;
  if (!trackings || !trackings.length) return { ok: false, error: "يرجى تحديد الأوردرات المراد تعديلها" };

  // 🚨 Security Guard & Role Enforcement for Apps Script Bulk
  const cleanRole = (currentRole || "").toString().trim();
  const isAdmin = cleanRole === "مدير" || cleanRole === "مشرف";
  const isAgent = cleanRole === "مندوب" || cleanRole.includes("مندوب");
  const isOps = cleanRole === "موظف عمليات" || cleanRole.includes("عمليات");
  const isReturnsOfficer = cleanRole === "مسؤول مرتجعات" || cleanRole.includes("مرتجع");
  const isSupplier = cleanRole === "مورد" || cleanRole.includes("مورد");

  let targetStatus = status || bulkStatus;
  
  if (targetStatus === "تم تسليم المرتجع للمورد وتصفية حسابه") targetStatus = "تم تسليم المرتجع للمورد";
  if (targetStatus === "تم التسليم بنجاح") targetStatus = "تم التسليم";
  if (targetStatus === "مؤجل بناءً على طلب العميل") targetStatus = "مؤجل";

  if (isSupplier) {
    return { ok: false, error: "Unauthorized Action: المورد لا يمتلك صلاحية تعديل الحالات جماعياً" };
  }

  if (isAgent) {
    const allowed = ["تم التسليم", "مؤجل", "لا يوجد رد", "مرتجع"];
    if (targetStatus && !allowed.includes(targetStatus)) {
      return { ok: false, error: "Unauthorized Action: خطأ في صلاحيات المندوب لتحديث هذه الحالة جماعياً" };
    }
    if (courier !== undefined) {
      return { ok: false, error: "Unauthorized Action: المندوب لا يملك صلاحيات تعديل أو تعيين المناديب المسؤولين" };
    }
  }

  if (isOps) {
    const allowed = ["تم رد العميل وجاري التنسيق", "لا يرد - محاولة أولى/ثانية", "تحديث نتيجة الاتصال", "مؤجل", "لا يوجد رد", "جديد", "العميل لغى الأوردر / مرتجع", "مرتجع"];
    if (targetStatus && !allowed.includes(targetStatus)) {
      return { ok: false, error: "Unauthorized Action: خطأ في صلاحيات موظف العمليات لتحديث هذه الحالة جماعياً" };
    }
    if (courier !== undefined) {
      return { ok: false, error: "Unauthorized Action: موظف العمليات لا يملك صلاحية تعديل أو تعيين المناديب المسؤولين" };
    }
  }

  if (isReturnsOfficer) {
    const allowed = ["مرتجع جديد", "مرتجع جاري تسليمه للمكتب", "جاري الرجوع للمورد", "تم تسليم المرتجع للمورد", "جديد"];
    if (targetStatus && !allowed.includes(targetStatus)) {
      return { ok: false, error: "Unauthorized Action: خطأ في صلاحيات مسؤول المرتجعات المكتبية لتحديث هذه الحالة جماعياً" };
    }
    if (courier !== undefined) {
      return { ok: false, error: "Unauthorized Action: مسؤول المرتجعات لا يملك صلاحية تعديل أو تعيين المناديب المسؤولين" };
    }
  }

  const sheet = sheets.orders;
  const lastRow = sheet.getLastRow();
  if (lastRow <= 1) return { ok: true, msg: "لا توجد أوردرات للتحديث", done: 0 };

  const lastCol = sheet.getLastColumn();
  const range = sheet.getRange(1, 1, lastRow, lastCol);
  const data = range.getValues();
  
  const headers = data[0].map(h => h.toString().trim());
  const trackingIdx = headers.indexOf("tracking");
  const updatedAtIdx = headers.indexOf("updatedAt");
  const courierIdx = headers.indexOf("courier");
  const statusIdx = headers.indexOf("status");
  const notesIdx = headers.indexOf("notes");
  const delivDateIdx = headers.indexOf("delivDate");

  if (trackingIdx === -1) return { ok: false, error: "عمود الكود التتبعي غير موجود في شيت الأوردرات" };

  let updatedCount = 0;
  const trackingsSet = trackings.map(t => t.toString().trim().toUpperCase());
  const anyNotes = notes;
  const anyDate = date || delivDate;

  for (let r = 1; r < data.length; r++) {
    const rowTracking = data[r][trackingIdx].toString().trim().toUpperCase();
    if (trackingsSet.indexOf(rowTracking) !== -1) {
      // Security: Rider can only adjust their own assigned orders
      if (isAgent && courierIdx !== -1) {
        const rowCourierName = data[r][courierIdx].toString().trim();
        if (rowCourierName !== currentUser) {
          continue; // Skip security violation row
        }
      }

      if (updatedAtIdx !== -1) data[r][updatedAtIdx] = now();
      if (courier && courierIdx !== -1 && (isAdmin || cleanRole === "محاسب")) {
        data[r][courierIdx] = courier;
      }
      if (targetStatus && statusIdx !== -1) {
        data[r][statusIdx] = targetStatus;
      }
      if (anyNotes !== undefined && anyNotes !== "" && notesIdx !== -1) {
        data[r][notesIdx] = anyNotes;
      }
      if (anyDate !== undefined && anyDate !== "" && delivDateIdx !== -1) {
        data[r][delivDateIdx] = anyDate;
      }
      updatedCount++;
    }
  }

  if (updatedCount > 0) {
    range.setValues(data);
  }

  return { ok: true, msg: `تم تحديث وإسناد ${updatedCount} أوردر بنجاح بمستوى أمني وقائي عالي`, done: updatedCount };
}

function updateOrdersStatusBulk(sheets, d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // إجبار السيرفر على الانتظار حتى 10 ثوانٍ لو هناك ضغط عمليات متزامن

  try {
    const { updates, currentRole, currentUser } = d;
    if (!updates || !updates.length) return { ok: false, error: "يرجى تقديم مصفوفة التحديثات الجماعية" };

    // Role checks
    const cleanRole = (currentRole || "").toString().trim();
    const isAdmin = cleanRole === "مدير" || cleanRole === "مشرف";
    const isAgent = cleanRole === "مندوب" || cleanRole.includes("مندوب");
    const isOps = cleanRole === "موظف عمليات" || cleanRole.includes("عمليات");
    const isReturnsOfficer = cleanRole === "مسؤول مرتجعات" || cleanRole.includes("مرتجع");
    const isSupplier = cleanRole === "مورد" || cleanRole.includes("مورد");

    if (isSupplier) {
      return { ok: false, error: "Unauthorized Action: ليس للمورد صلاحية التعديل الجماعي" };
    }

    let updatedCount = 0;
    const couriers = getTableData(sheets.couriers);
    
    for (var i = 0; i < updates.length; i++) {
      const item = updates[i];
      const tr = (item.tracking || "").toString().trim().toUpperCase();
      if (!tr) continue;

      let activeRowIndex = findRowIndex(sheets.orders, "tracking", tr);
      let archivedRowIndex = findRowIndex(sheets.archivedOrders, "tracking", tr);
      let orderIndex = activeRowIndex !== -1 ? activeRowIndex : archivedRowIndex;
      let targetSheet = activeRowIndex !== -1 ? sheets.orders : sheets.archivedOrders;

      if (orderIndex === -1) continue;

      const orders = getTableData(targetSheet);
      const order = orders.find(x => x.tracking === tr);
      if (!order) continue;

      const rowCourierName = order.courier ? order.courier.toString().trim() : "";
      if (isAgent && rowCourierName !== currentUser) {
        continue; // Security check
      }

      // Role status validation
      let targetStatus = item.status;
      if (targetStatus === "تم تسليم المرتجع للمورد وتصفية حسابه" || targetStatus === "تم تسليمه للمورد") targetStatus = "تم تسليم المرتجع للمورد";
      if (targetStatus === "تم التسليم بنجاح") targetStatus = "تم التسليم";
      if (targetStatus === "مؤجل بناءً على طلب العميل") targetStatus = "مؤجل";

      if (targetStatus) {
        if (isAgent) {
          const allowed = ["تم التسليم", "مؤجل", "لا يوجد رد", "مرتجع", "خارج مع المندوب", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "العميل رد وجاري التسليم"];
          if (allowed.indexOf(targetStatus) === -1) continue;
        }
        if (isOps) {
          const allowed = ["تم رد العميل وجاري التنسيق", "لا يرد - محاولة أولى/ثانية", "تحديث نتيجة الاتصال", "مؤجل", "لا يوجد رد", "جديد", "خارج مع المندوب"];
          if (allowed.indexOf(targetStatus) === -1) continue;
        }
        if (isReturnsOfficer) {
          const allowed = ["مرتجع جديد", "مرتجع جاري تسليمه للمكتب", "جاري الرجوع للمورد", "تم تسليم المرتجع للمورد", "جديد"];
          if (allowed.indexOf(targetStatus) === -1) continue;
        }
      }

      const oldStatus = order.status;
      let updateObj = {
        updatedAt: now()
      };

      // Courier Assignment
      if (item.courier !== undefined && (isAdmin || cleanRole === "محاسب")) {
        const newCourier = item.courier;
        if (newCourier === "reset_warehouse" || newCourier === "") {
          updateObj.lastCourier = order.courier;
          updateObj.lastCommission = order.commission;
          updateObj.courier = "";
          updateObj.commission = 0;
          
          var nextStatus = oldStatus;
          if (oldStatus === "مرتجع") {
            nextStatus = "مرتجع بالمستودع";
          } else if (oldStatus === "تسليم جزئي") {
            nextStatus = "مرتجع جزئي بالمستودع";
          } else if (oldStatus === "مؤجل") {
            nextStatus = "مؤجل";
          } else if (oldStatus === "تم التسليم" || oldStatus === "تم التسليم بنجاح" || oldStatus === "تم التسليم (ناجح كاش)") {
            nextStatus = oldStatus;
          } else {
            if (oldStatus !== "جديد") {
              nextStatus = oldStatus;
            }
          }
          updateObj.status = nextStatus;
        } else if (newCourier !== rowCourierName) {
          updateObj.courier = newCourier;
          const cProfile = couriers.find(function(c) { return c.name === newCourier; });
          const comm = cProfile ? Number(cProfile.commission || 25) : 25;
          updateObj.commission = comm;

          if (oldStatus === "جديد") {
            updateObj.status = "مُسند جديد";
          }
        }
      }

      // Apply Status Override
      const finalStatus = targetStatus || updateObj.status || oldStatus;
      if (targetStatus !== undefined && targetStatus !== oldStatus) {
        updateObj.status = targetStatus;

        if (targetStatus === "تم التسليم") {
          const itemDate = item.date || item.delivDate || item.postponedDate;
          updateObj.delivDate = itemDate || now();
          
          const currentCourier = updateObj.courier !== undefined ? updateObj.courier : (order.courier || "");
          const cProfile = couriers.find(function(c) { return c.name === currentCourier; });
          const comm = cProfile ? Number(cProfile.commission || 25) : 25;

          appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
            courier: currentCourier,
            date: now(),
            type: "تسليم",
            tracking: tr,
            amount: comm,
            desc: "عمولة تسليم الأوردر جماعياً (الدفعة المجمعة): " + tr
          });

        }

         if (["مرتجع", "تم تسليم المرتجع للمورد", "التسليم للمورد", "مرتجع تم تسليمه للمورد"].indexOf(targetStatus) !== -1) {
          updateObj.retDate = now();
        }

        appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
          tracking: tr,
          oldStatus: oldStatus,
          newStatus: targetStatus,
          updatedBy: currentUser,
          dateTime: now()
        });
      }

      if (item.notes !== undefined) {
        updateObj.notes = item.notes;
      }

      // إتمام الحفظ والتعديل للسطر المستهدف (نشط أو أرشيف)
      let freshActiveIdx = findRowIndex(sheets.orders, "tracking", tr);
      let freshArchivedIdx = findRowIndex(sheets.archivedOrders, "tracking", tr);

      if (freshActiveIdx !== -1) {
        updateRowByObject(sheets.orders, freshActiveIdx, updateObj);
      }
      if (freshArchivedIdx !== -1) {
        updateRowByObject(sheets.archivedOrders, freshArchivedIdx, updateObj);
      }

      // منطق ترحيل البضائع الصارم والاسترجاع من الأرشيف:
      // إذا كان الأوردر في الأرشيف وتغيرت حالته إلى حالة نشطة غير صالحة للأرشفة (خارج مع المندوب، مؤجل، مرتجع في المستودع إلخ)،
      // فيتم إرجاعه للشيت النشط فوراً لضمان عدم ضياع عهدة البضائع ومنع ارتداد الحالة، ثم حذفه نهائياً من شيت الأرشيف.
      const eventualStatus = updateObj.status || oldStatus;
      const isEventualArchivable = ["تم التسليم", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(eventualStatus);

      if (freshArchivedIdx !== -1 && !isEventualArchivable) {
        const updatedArchivedData = getTableData(sheets.archivedOrders);
        const updatedOrderObj = updatedArchivedData.find(x => x.tracking === tr);
        if (updatedOrderObj) {
          let freshActiveIdxAfterSave = findRowIndex(sheets.orders, "tracking", tr);
          if (freshActiveIdxAfterSave === -1) {
            const activeHeaders = ["tracking", "createdAt", "updatedAt", "orderDate", "supplier", "customer", "phone", "phone2", "gov", "region", "address", "prodPrice", "shipPrice", "totalCOD", "shipCost", "courier", "status", "prodType", "notes", "delivDate", "retDate", "addedBy", "commission", "returnShippingType", "returnQueueStatus", "returnQueueAgent", "موقع العميل/الخريطة"];
            appendToSheet(sheets.orders, activeHeaders, updatedOrderObj);
          }
          let freshArchivedIndexAfterSave = findRowIndex(sheets.archivedOrders, "tracking", tr);
          if (freshArchivedIndexAfterSave !== -1) {
            sheets.archivedOrders.deleteRow(freshArchivedIndexAfterSave);
          }
        }
      }

      updatedCount++;
    }

    return { ok: true, msg: "تم ترحيل وتحديث الفوج الجماعي لـ " + updatedCount + " أوردر دفعة واحدة بنجاح تام", done: updatedCount };
  } finally {
    lock.releaseLock();
  }
}

// ───────────────────────────────────────────────
// (ب) لوحة الإحصائيات المركزية والأمان والتدقيق
// ───────────────────────────────────────────────

function getDashboardStats(sheets) {
  const orders = getTableData(sheets.orders);
  const couriers = getTableData(sheets.couriers);
  const suppliers = getTableData(sheets.suppliers);
  const expenses = getTableData(sheets.expenses);
  const cashbox = getTableData(sheets.cashbox);

  const total = orders.length;
  const delivered = orders.filter(o => o.status === "تم التسليم").length;
  const returned = orders.filter(o => {
    const isSomeReturn = ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد", "مرتجع جديد", "جاري تجهيز المرتجع", "جاهز للتسليم للمورد", "مرتجع والعميل دفع الشحن"].includes(o.status) || (o.status || "").indexOf("مرتجع") !== -1;
    const isDeliveredToSupplier = ["تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد"].includes(o.status);
    return isSomeReturn && !isDeliveredToSupplier;
  }).length;
  const shipping = orders.filter(o => o.status === "خارج مع المندوب" || o.status === "تم الإسناد").length;

  const rate = total > 0 ? ((delivered / (delivered + returned || 1)) * 100) : 0;
  const assignedPending = orders.filter(o => o.courier && o.courier !== "" && !["تم التسليم", "مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status)).length;

  // حساب حركة الخزنة
  const cashIn = cashbox.filter(c => ["تحصيل مندوب", "إيداع خزنة direct", "إيداع"].includes(c.type)).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cashOut = cashbox.filter(c => ["صرف مورد", "دفعة للمورد", "مصروفات"].includes(c.type) || c.type.startsWith("سداد")).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const cashBalance = cashIn - cashOut;

  return {
    ok: true,
    stats: {
      total,
      delivered,
      returned,
      shipping,
      assignedPending,
      rate: rate.toFixed(1) + "%",
      cashBalance,
      remainingStock: orders.filter(o => !["تم التسليم", "خارج مع المندوب", "مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع تم تسليمه للمورد"].includes(o.status)).length
    },
    couriers: couriers.map(c => ({ name: c.name, total: orders.filter(o => o.courier === c.name).length })),
    suppliers: suppliers.map(s => ({ name: s.name, total: orders.filter(o => isSameSupplier(o.supplier, s.name)).length })),
    bestCourier: couriers[0] ? couriers[0].name : "—",
    bestSupplier: suppliers[0] ? suppliers[0].name : "—"
  };
}

function getAuditLog(sheets) {
  const list = getTableData(sheets.auditLog);
  return { ok: true, logs: list.reverse() };
}

// ───────────────────────────────────────────────
// (ج) حركات حسابات الموردين والدفعات المالية
// ───────────────────────────────────────────────
// HELPER FOR GENUINE HUMAN PAYOUT CLASSIFICATION
// ───────────────────────────────────────────────
function getLedgerEntrySignedAmount(l) {
  if (!l) return 0;
  var type = (l.type || l["النوع"] || "").toString().trim();
  var amount = Number(l.amount || 0);
  if (isNaN(amount)) return 0;
  var absAmount = Math.abs(amount);

  if (type.indexOf("إضافة") !== -1 || type.indexOf("اضافة") !== -1) {
    return absAmount;
  }
  if (
    type.indexOf("خصم") !== -1 ||
    type.indexOf("طرح") !== -1 ||
    type.indexOf("دفع") !== -1 ||
    type.indexOf("صرف") !== -1 ||
    type.indexOf("سحب") !== -1 ||
    type.indexOf("مسحوبات") !== -1 ||
    type.indexOf("استلام") !== -1 ||
    type.indexOf("مسترد") !== -1 ||
    (l.tracking || "").toString().trim() === "CASH-PAY"
  ) {
    return -absAmount;
  }
  return amount;
}

function isHumanPayout(l) {
  if (!l) return false;
  var type = (l.type || "").toString().trim();
  var desc = (l.desc || "").toString().trim();
  var tracking = (l.tracking || "").toString().trim();
  
  var isPayOrAdj = ["دفع نقدي", "دفعة مورد", "صرف مورد", "دفعة", "مسحوبات", "سحب", "استلام نقدية", "مسترد نقدية", "تسوية رصيد", "تسوية إضافة", "تسوية خصم"].indexOf(type) !== -1 || 
                     type.indexOf("دفعة") !== -1 || 
                     type.indexOf("صرف") !== -1 || 
                     type.indexOf("سحب") !== -1 || 
                     type.indexOf("تسوية") !== -1 || 
                     type.indexOf("استلام") !== -1 || 
                     type.indexOf("مسترد") !== -1 || 
                     type.indexOf("خصم") !== -1 || 
                     type.indexOf("إضافة") !== -1 || 
                     type.indexOf("اضافة") !== -1 || 
                     type.indexOf("تعديل") !== -1 || 
                     type.indexOf("طرح") !== -1 || 
                     tracking === "CASH-PAY";
                     
  var isAutoOrReturn = type.indexOf("مرتجع") !== -1 || 
                         type.indexOf("أوردر") !== -1 ||
                         type.indexOf("حقوق") !== -1 ||
                         (tracking !== "" && tracking !== "—" && tracking !== "CASH-PAY" && tracking.indexOf("FP-") === 0);
                         
  return isPayOrAdj && !isAutoOrReturn;
}

function isReturnedDeliveredToSupplier(status) {
  var s = (status || "").toString().trim();
  return s === "تم تسليم المرتجع للمورد" || s === "تم تسليم المرتجع للمورد وتصفية حسابه";
}

function isSomeReturn(status) {
  var s = (status || "").toString().trim();
  var patterns = ["مرتجع", "مرفوض", "فشل", "مسترجع", "التسليم للمورد", "تصفية"];
  return patterns.some(function(p) {
    return s.indexOf(p) !== -1;
  });
}

function isSameSupplier(nameA, nameB) {
  if (!nameA || !nameB) return false;
  
  function normAr(str) {
    if (!str) return "";
    return str.toString()
      .trim()
      .toLowerCase()
      .replace(/[أإآإأ]/g, "ا")
      .replace(/[يى]/g, "ي")
      .replace(/[ة]/g, "ه")
      .replace(/\s+/g, " ")
      .trim();
  }
  
  return normAr(nameA) === normAr(nameB);
}

function normalizeDateStrAr(dateStr) {
  if (!dateStr) return "";
  var s = dateStr.toString().trim();
  var m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    var y = m[1];
    var mn = m[2];
    if (mn.length === 1) mn = "0" + mn;
    var d = m[3];
    if (d.length === 1) d = "0" + d;
    return y + "-" + mn + "-" + d;
  }
  return s.split("T")[0];
}

function calculateSupplierBalance(sheets, supplierName, preloadedDb) {
  var suppliersList = [];
  if (preloadedDb && preloadedDb.suppliers) {
    suppliersList = preloadedDb.suppliers;
  } else {
    try {
      suppliersList = getTableData(sheets.suppliers) || [];
    } catch (e) {}
  }
  var supplierProfile = suppliersList.find(function(s) {
    return s.name && isSameSupplier(s.name, supplierName);
  });
  var openingBalance = supplierProfile ? Number(supplierProfile.openingBalance || supplierProfile.opening_balance || 0) : 0;

  var allOrders = [];
  if (preloadedDb && preloadedDb.allOrders) {
    allOrders = preloadedDb.allOrders;
  } else {
    var orders = getTableData(sheets.orders) || [];
    var archived = [];
    try {
      archived = getTableData(sheets.archivedOrders) || [];
    } catch (e) {}
    allOrders = orders.concat(archived);
  }

  var rawSupOrders = allOrders.filter(function(o) {
    var oSup = o.supplier !== undefined ? o.supplier : (o["المورد"] !== undefined ? o["المورد"] : (o["اسم المورد"] !== undefined ? o["اسم المورد"] : (o["مورد"] !== undefined ? o["مورد"] : (o["merchant"] !== undefined ? o["merchant"] : (o["merchant_name"] !== undefined ? o["merchant_name"] : "")))));
    return isSameSupplier(oSup, supplierName);
  });

  // Dedup orders by tracking ID to ensure no double counting
  var dedupedMap = {};
  rawSupOrders.forEach(function(o) {
    var track = (o.tracking || o["رقم التتبع"] || o["ID"] || "").toString().trim();
    if (track) {
      dedupedMap[track] = o;
    } else {
      dedupedMap["RAND-" + Math.random()] = o;
    }
  });

  var supplierOrders = [];
  var keys = Object.keys(dedupedMap);
  for (var k = 0; k < keys.length; k++) {
    supplierOrders.push(dedupedMap[keys[k]]);
  }

  var ledgerEntries = [];
  if (preloadedDb && preloadedDb.supplierLedger) {
    ledgerEntries = preloadedDb.supplierLedger;
  } else {
    try {
      ledgerEntries = getTableData(sheets.supplierLedger) || [];
    } catch (e) {}
  }
  
  var rawLedger = ledgerEntries.filter(function(l) {
    var lSup = l.supplier || l["المورد"] || "";
    return isSameSupplier(lSup, supplierName);
  }).map(function(l) {
    return {
      type: (l.type || l["النوع"] || "").toString().trim(),
      tracking: (l.tracking || l["رقم التتبع"] || "").toString().trim(),
      amount: Number(l.amount || 0),
      desc: l.desc || l["البيان"] || "",
      date: l.date || ""
    };
  });

  // 1. Total uploaded goods (value of products only without shipping)
  var totalGoodsUploaded = supplierOrders.reduce(function(sum, o) {
    return sum + getOrderFinancials(o).prodPrice;
  }, 0);

  // 2. Returns delivered back to supplier
  var returnedOrders = supplierOrders.filter(function(o) {
    var status = (o.status || "").toString().trim();
    return isReturnedDeliveredToSupplier(status);
  });
  var returnsDeliveredValue = returnedOrders.reduce(function(sum, o) {
    var financials = getOrderFinancials(o);
    var status = (o.status || "").toString().trim();
    var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
    if (isPartial) {
      var shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
      var soldValue = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
      if (isNaN(soldValue)) soldValue = 0;
      var kept_goods_value = Math.max(0, soldValue - shipPrice);
      var unsoldPortion = financials.prodPrice - kept_goods_value;
      return sum + (unsoldPortion > 0 ? unsoldPortion : 0);
    }
    return sum + financials.prodPrice;
  }, 0);

  // 3. Kept goods value (strict rule for outstanding calculation)
  var totalKeptGoodsValue = supplierOrders.reduce(function(sum, o) {
    var status = (o.status || "").toString().trim();
    var financials = getOrderFinancials(o);
    var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].indexOf(status) !== -1;
    var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
    
    if (isDelivered) {
      return sum + financials.prodPrice;
    } else if (isPartial) {
      var shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
      var soldValue = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
      if (isNaN(soldValue)) soldValue = 0;
      var kept_goods_value = Math.max(0, soldValue - shipPrice);
      return sum + kept_goods_value;
    }
    return sum;
  }, 0);

  var adjustmentsAndPayments = rawLedger.filter(isHumanPayout);

  // Calculate net cash paid (all entries that are negative signed amounts)
  var paymentsValue = adjustmentsAndPayments.reduce(function(sum, l) {
    var signed = getLedgerEntrySignedAmount(l);
    return signed < 0 ? sum + Math.abs(signed) : sum;
  }, 0);

  // Calculate net adjustments (all entries that are positive signed amounts)
  var reverseAdjustmentsValue = adjustmentsAndPayments.reduce(function(sum, l) {
    var signed = getLedgerEntrySignedAmount(l);
    return signed > 0 ? sum + signed : sum;
  }, 0);

  var totalLedgerEffect = adjustmentsAndPayments.reduce(function(sum, l) {
    return sum + getLedgerEntrySignedAmount(l);
  }, 0);

  var outstanding =
    openingBalance +
    totalGoodsUploaded -
    returnsDeliveredValue +
    totalLedgerEffect;

  var totalOrdersCount = supplierOrders.length;
  var deliveredOrders = supplierOrders.filter(function(o) {
    var status = (o.status || "").toString().trim();
    return ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
  });
  var deliveredOrdersCount = deliveredOrders.length;
  var deliveredOrdersValue = totalKeptGoodsValue;

  var rate = totalOrdersCount
    ? Math.round((deliveredOrdersCount / totalOrdersCount) * 100)
    : 0;

  return {
    openingBalance: openingBalance,
    totalGoodsUploaded: totalGoodsUploaded,
    returnsDeliveredValue: returnsDeliveredValue,
    totalLedgerEffect: totalLedgerEffect,
    outstanding: outstanding,
    paymentsValue: paymentsValue,
    reverseAdjustmentsValue: reverseAdjustmentsValue,
    adjustmentsAndPayments: adjustmentsAndPayments,
    supplierOrders: supplierOrders,
    returnedOrders: returnedOrders,
    stats: {
      totalOrdersCount: totalOrdersCount,
      totalGoodsUploaded: totalGoodsUploaded,
      totalCOD: totalGoodsUploaded,
      deliveredOrdersCount: deliveredOrdersCount,
      deliveredOrdersValue: deliveredOrdersValue,
      returnsDeliveredCount: returnedOrders.length,
      returnsDeliveredValue: returnsDeliveredValue,
      paymentsValue: paymentsValue,
      reverseAdjustmentsValue: reverseAdjustmentsValue,
      outstanding: outstanding,
      rate: rate,
      openingBalance: openingBalance
    }
  };
}

function getSupplierUnifiedLedger(sheets, supplierName) {
  var calc = calculateSupplierBalance(sheets, supplierName);
  var openingBalance = calc.openingBalance;
  var supplierOrders = calc.supplierOrders;
  var returnedOrders = calc.returnedOrders;
  var adjustmentsAndPayments = calc.adjustmentsAndPayments;

  var entries = [];

  // A. Add opening balance entry if exists
  if (openingBalance !== 0) {
    entries.push({
      date: "2026-01-01",
      type: "رصيد افتتاحي",
      tracking: "OPENING-BALANCE",
      desc: "الرصيد الافتتاحي المرحل (سابق): " + openingBalance + " ج.م",
      amount: openingBalance
    });
  }

  // B. Process all orders of the supplier
  for (var i = 0; i < supplierOrders.length; i++) {
    var o = supplierOrders[i];
    var financials = getOrderFinancials(o);
    var status = (o.status || o["الحالة"] || "").toString().trim();
    var tracking = o.tracking || o["رقم التتبع"] || "";
    
    var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].indexOf(status) !== -1;
    var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
    var isReturned = isReturnedDeliveredToSupplier(status);

    if (isDelivered) {
      var prodPriceNum = financials.prodPrice;
      var orderDesc = "حقوق بضاعة أوردر رقم #" + tracking + " (تم التسليم بنجاح - صافي بضاعة: " + prodPriceNum + " ج.م)";
      entries.push({
        date: o.orderDate || o.createdAt || o["تاريخ الطلب"] || "",
        type: "حقوق بضاعة أوردر",
        tracking: tracking,
        amount: prodPriceNum,
        desc: orderDesc
      });
    } else if (isPartial) {
      var shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
      var actualReceived = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
      var keptValue = Math.max(0, actualReceived - shipPrice);
      var unsoldPortion = Math.max(0, financials.prodPrice - keptValue);
      
      var orderDesc = "";
      if (status === "مرتجع تم تسليمه للمورد" || status === "تم تسليم المرتجع للمورد") {
        orderDesc = "مرتجع تم تسليمه للمورد (جزئي) أوردر رقم #" + tracking + " (تم تصفية الحركة: المحصل الفعلي الصافي " + keptValue + " ج.م، وقيمة البضاعة المرجعة " + unsoldPortion + " ج.م، مصاريف الشحن " + shipPrice + " ج.م)";
      } else {
        orderDesc = "حقوق بضاعة جزئي أوردر رقم #" + tracking + " (تسليم جزئي: قيمة المستلم الصافي " + keptValue + " ج.م، قيمة المرتجع المستبعد " + unsoldPortion + " ج.م، مصاريف الشحن " + shipPrice + " ج.م)";
      }
      entries.push({
        date: o.orderDate || o.createdAt || o["تاريخ الطلب"] || "",
        type: "حقوق بضاعة جزئي",
        tracking: tracking,
        amount: keptValue,
        desc: orderDesc
      });
    } else if (isReturned) {
      // Just log the return with 0 financial effect since it wasn't credited
      var orderDesc = "أوردر مرتجع رقم #" + tracking + " (تم إرجاع البضاعة للمورد بالكامل - قيمة الحركة: 0 ج.م)";
      entries.push({
        date: o.returnDate || o.updatedAt || "",
        type: "مرتجع مخصوم",
        tracking: tracking,
        amount: 0,
        desc: orderDesc
      });
    } else {
      // For in-transit/pending/postponed orders, optionally list with 0 amount
      var orderDesc = "أوردر رقم #" + tracking + " (حالة: " + status + " - قيد المعالجة/لم يصفى بعد)";
      entries.push({
        date: o.orderDate || o.createdAt || "",
        type: "أوردر معلق",
        tracking: tracking,
        amount: 0,
        desc: orderDesc
      });
    }
  }

  // D. Payouts and adjustments with corrected signs
  for (var i = 0; i < adjustmentsAndPayments.length; i++) {
    var l = adjustmentsAndPayments[i];
    var type = (l.type || l["النوع"] || "").toString().trim();
    var amountSigned = getLedgerEntrySignedAmount(l);

    entries.push({
      date: l.date || "",
      type: type || "تعديل حساب",
      tracking: l.tracking || "CASH-PAY",
      amount: amountSigned,
      desc: l.desc || ("تسوية/دفعة مالية للمورد بمبلغ " + l.amount + " ج.م")
    });
  }

  // Sort entries chronologically to compute running balance correctly
  entries.sort(function(a, b) {
    var dateA = a.date || "";
    var dateB = b.date || "";
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    var typeOrder = {
      "رصيد افتتاحي": 0,
      "حقوق بضاعة أوردر": 1,
      "حقوق بضاعة جزئي": 1,
      "مرتجع مخصوم": 2
    };
    var orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 3;
    var orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 3;
    return orderA - orderB;
  });

  // Calculate live running balance Chronologically
  var runBal = 0;
  var finalEntries = entries.map(function(item) {
    runBal += item.amount;
    item.balanceAfter = runBal;
    return item;
  });

  return {
    entries: finalEntries.reverse(), // latest first
    balance: calc.outstanding,
    stats: calc.stats
  };
}

function getSupplierLedgerData(sheets, d) {
  var supplier = d.supplier;
  if (!supplier) {
    return { ok: false, error: "اسم المورد مطلوب" };
  }

  var calc = calculateSupplierBalance(sheets, supplier);
  var supplierOrders = calc.supplierOrders;
  var adjustmentsAndPayments = calc.adjustmentsAndPayments;

  // Group supplier orders by normalized date
  var ordersByDay = {};
  supplierOrders.forEach(function(o) {
    var rawDate = o.orderDate || o.createdAt || o["تاريخ الطلب"] || "";
    var normDate = normalizeDateStrAr(rawDate);
    if (!normDate) return;
    if (!ordersByDay[normDate]) {
      ordersByDay[normDate] = [];
    }
    ordersByDay[normDate].push(o);
  });

  // Settlements set
  var settlements = [];
  try {
    settlements = getTableData(sheets.supplierSettlements) || [];
  } catch (e) {}
  
  var settledDaysSet = {};
  settlements.forEach(function(s) {
    var sSup = s.supplier || s["المورد"] || "";
    if (isSameSupplier(sSup, supplier)) {
      var sDate = normalizeDateStrAr(s.date || s["التاريخ"] || "");
      if (sDate) {
        settledDaysSet[sDate] = true;
      }
    }
  });

  // Also check supplierLedger for settlements
  var ledgerEntries = [];
  try {
    ledgerEntries = getTableData(sheets.supplierLedger) || [];
  } catch (e) {}
  ledgerEntries.forEach(function(l) {
    var lSup = l.supplier || l["المورد"] || "";
    if (isSameSupplier(lSup, supplier)) {
      var type = (l.type || l["النوع"] || "").toString().trim();
      var tracking = (l.tracking || l["رقم التتبع"] || "").toString().trim();
      if (type === "تصفية يومية" && tracking.indexOf("SETTLE-") === 0) {
        var sDate = tracking.replace("SETTLE-", "").trim();
        settledDaysSet[sDate] = true;
      }
    }
  });

  var ledgerEntriesByDate = {};
  adjustmentsAndPayments.forEach(function(l) {
    var lDate = normalizeDateStrAr(l.date || "");
    if (lDate) {
      if (!ledgerEntriesByDate[lDate]) {
        ledgerEntriesByDate[lDate] = [];
      }
      ledgerEntriesByDate[lDate].push(l);
    }
  });

  // Compute metrics per day
  var daysList = [];
  var dayDates = Object.keys(ordersByDay);
  for (var i = 0; i < dayDates.length; i++) {
    var dayDate = dayDates[i];
    var dayOrders = ordersByDay[dayDate];

    var totalWorkValue = dayOrders.reduce(function(sum, o) {
      return sum + getOrderFinancials(o).prodPrice;
    }, 0);

    var totalActualCollected = dayOrders.reduce(function(sum, o) {
      var status = (o.status || "").toString().trim();
      var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].indexOf(status) !== -1;
      var isPartial = ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
      
      if (isDelivered) {
        return sum + getOrderFinancials(o).totalCOD;
      } else if (isPartial) {
        var partialAm = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
        return sum + (isNaN(partialAm) ? 0 : partialAm);
      }
      return sum;
    }, 0);

    var returnedValueRefunded = dayOrders.reduce(function(sum, o) {
      var status = (o.status || "").toString().trim();
      var isReturnedDelivered = isReturnedDeliveredToSupplier(status);
      if (isReturnedDelivered) {
        var financials = getOrderFinancials(o);
        var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(o.status || o["الحالة"] || "") !== -1;
        if (isPartial) {
          var shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
          var soldValue = Number(o.partialAmount || o.actualReceivedCash || o["المبلغ المحصل"] || 0);
          if (isNaN(soldValue)) soldValue = 0;
          var kept_goods_value = Math.max(0, soldValue - shipPrice);
          var unsoldPortion = financials.prodPrice - kept_goods_value;
          return sum + (unsoldPortion > 0 ? unsoldPortion : 0);
        }
        return sum + financials.prodPrice;
      }
      return sum;
    }, 0);

    var returnShippingFees = dayOrders.reduce(function(sum, o) {
      var status = (o.status || "").toString().trim();
      var isReturned = isSomeReturn(status);
      if (isReturned) {
        if (status === "مرتجع والعميل دفع الشحن") return sum;
        return sum + getOrderFinancials(o).shipPrice;
      }
      return sum;
    }, 0);

    var dayPayments = ledgerEntriesByDate[dayDate] || [];
    var totalPayoutsOnDay = dayPayments.reduce(function(sum, l) {
      var signed = getLedgerEntrySignedAmount(l);
      return signed < 0 ? sum + Math.abs(signed) : sum;
    }, 0);

    var totalAdditionsOnDay = dayPayments.reduce(function(sum, l) {
      var signed = getLedgerEntrySignedAmount(l);
      return signed > 0 ? sum + signed : sum;
    }, 0);

    var netDues = totalWorkValue - totalPayoutsOnDay - returnedValueRefunded + totalAdditionsOnDay;

    var netProductValue = dayOrders.reduce(function(sum, o) {
      var status = (o.status || "").toString().trim();
      var fin = getOrderFinancials(o);
      var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].indexOf(status) !== -1;
      var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
      if (isDelivered) {
        var netProduct = Number(fin.totalCOD) - Number(fin.shipPrice);
        return sum + (isNaN(netProduct) ? 0 : netProduct);
      } else if (isPartial) {
        var cash = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
        var shipPrice = Number(o.shipPrice || fin.shipPrice || 60);
        if (isNaN(cash)) cash = 0;
        return sum + Math.max(0, cash - shipPrice);
      }
      return sum;
    }, 0);

    var isSettled = !!settledDaysSet[dayDate];
    var statusLabel = isSettled ? "🟢 تم تصفية الكاش والمرتجع" : "🔴 معلق لم يصفى";

    daysList.push({
      date: dayDate,
      orderCount: dayOrders.length,
      totalWorkValue: totalWorkValue,
      totalActualCollected: totalActualCollected,
      returnedValueRefunded: returnedValueRefunded,
      returnShippingFees: returnShippingFees,
      cashPaid: totalPayoutsOnDay,
      netDues: netDues,
      netProductValue: netProductValue,
      isSettled: isSettled,
      status: statusLabel,
      orders: dayOrders.map(function(o) {
        var fin = getOrderFinancials(o);
        return {
          tracking: o.tracking || o["رقم التتبع"] || "",
          customer: o.customer || o["اسم العميل"] || "",
          phone: o.phone || o["الهاتف"] || "",
          status: o.status || "",
          prodPrice: fin.prodPrice,
          shipPrice: fin.shipPrice,
          totalCOD: fin.totalCOD,
          partialAmount: Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0)
        };
      })
    });
  }

  daysList.sort(function(a, b) {
    return b.date.localeCompare(a.date);
  });

  var overallNetProductValue = supplierOrders.reduce(function(sum, o) {
    var status = (o.status || "").toString().trim();
    var fin = getOrderFinancials(o);
    var isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].indexOf(status) !== -1;
    var isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].indexOf(status) !== -1;
    if (isDelivered) {
      return sum + (Number(fin.totalCOD) - Number(fin.shipPrice));
    } else if (isPartial) {
      var cash = Number(o.actualReceivedCash || o.partialAmount || o["المبلغ المحصل"] || 0);
      var shipPrice = Number(o.shipPrice || fin.shipPrice || 60);
      if (isNaN(cash)) cash = 0;
      return sum + Math.max(0, cash - shipPrice);
    }
    return sum;
  }, 0);

  var totalPaid = adjustmentsAndPayments.reduce(function(sum, l) {
    return sum + Math.abs(Number(l.amount || 0));
  }, 0);

  return {
    ok: true,
    days: daysList,
    outstandingBalance: calc.outstanding,
    totalGoodsUploaded: calc.totalGoodsUploaded,
    returnsDeliveredValue: calc.returnsDeliveredValue,
    overallNetProductValue: overallNetProductValue,
    globalPayments: totalPaid,
    openingBalance: calc.openingBalance,
    paymentEntries: adjustmentsAndPayments.map(function(l) {
      return {
        date: normalizeDateStrAr(l.date || ""),
        type: l.type || l["النوع"] || "",
        tracking: l.tracking || l["رقم التتبع"] || "",
        amount: Number(l.amount || 0),
        desc: l.desc || l["البيان"] || ""
      };
    })
  };
}

function getSupplierLedger(sheets, d) {
  var supplier = d.supplier;
  if (!supplier) {
    var ledger = getTableData(sheets.supplierLedger) || [];
    return { ok: true, ledger: ledger };
  }

  var unified = getSupplierUnifiedLedger(sheets, supplier);
  var dailyData = getSupplierLedgerData(sheets, d);

  return { 
    ok: true, 
    entries: unified.entries,
    balance: unified.balance,
    stats: unified.stats,
    dailyLedger: dailyData
  };
}

function settleSupplierDay(sheets, d) {
  var supplier = d.supplier;
  var dateStr = d.dateStr;
  var currentUser = d.currentUser;
  
  if (!supplier || !dateStr) {
    return { ok: false, error: "معلومات تصفية اليوم ناقصة" };
  }

  var settlements = [];
  try {
    settlements = getTableData(sheets.supplierSettlements) || [];
  } catch (e) {}
  
  var isAlreadySettled = settlements.some(function(s) {
    var sSup = s.supplier || s["المورد"] || "";
    return isSameSupplier(sSup, supplier) && normalizeDateStrAr(s.date || s["التاريخ"]) === normalizeDateStrAr(dateStr);
  });

  if (isAlreadySettled) {
    return { ok: true, msg: "هذا اليوم مصفى بالفعل بالشيت" };
  }

  // Append new settlement entry
  appendToSheet(sheets.supplierSettlements, ["supplier", "date", "status", "settledAt", "settledBy"], {
    supplier: supplier,
    date: dateStr,
    status: "مصفى ماليّاً",
    settledAt: now(),
    settledBy: currentUser || "إدارة الحسابات"
  });

  // Also write double entry to supplierLedger as settlement record (for general ledger sync)
  appendToSheet(sheets.supplierLedger, ["supplier", "date", "type", "tracking", "amount", "desc"], {
    supplier: supplier,
    date: dateStr,
    type: "تصفية يومية",
    tracking: "SETTLE-" + dateStr,
    amount: 0,
    desc: "🔐 [💵 تقفيل وتسليم كاش اليوم للمورد] - تم تصفية وقفل حساب اليوم تاريخ: " + dateStr + " بنجاح تصفية تامة✓"
  });

  return { ok: true, msg: "تم تسجيل تصفية اليوم وقفل حساب " + dateStr + " بنجاح" };
}

function parseSafeNumber(val) {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  var s = String(val).trim();
  if (s === "") return 0;
  var cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "").trim();
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

  return {
    prodPrice: isNaN(prodPrice) ? 0 : prodPrice,
    shipPrice: isNaN(shipPrice) ? 0 : shipPrice,
    totalCOD: isNaN(totalCOD) ? 0 : totalCOD
  };
}

function getSupplierDashboard(sheets, d) {
  const { supplier } = d;
  const orders = getTableData(sheets.orders);
  const ledger = getTableData(sheets.supplierLedger);

  const rawSupOrders = orders.filter(o => isSameSupplier(o.supplier, supplier));
  
  // Dedup rawSupOrders by tracking ID
  const uniqueSupOrdersMap = {};
  rawSupOrders.forEach(o => {
    var track = (o.tracking || "").toString().trim();
    if (track) {
      uniqueSupOrdersMap[track] = o;
    } else {
      uniqueSupOrdersMap["NO-TRACK-" + Math.random()] = o;
    }
  });
  const supOrders = Object.keys(uniqueSupOrdersMap).map(k => uniqueSupOrdersMap[k]);
  const total = supOrders.length;
  
  const deliveredOrders = supOrders.filter(o => o.status === "تم التسليم");
  const delivered = deliveredOrders.length;
  
  // 1. Total uploaded goods (value of products only without shipping)
  const totalGoodsUploaded = supOrders.reduce((sum, o) => {
    return sum + getOrderFinancials(o).prodPrice;
  }, 0);

  const returnedDGoods = supOrders.filter(o => isReturnedDeliveredToSupplier(o.status));
  const returned = supOrders.filter(o => isSomeReturn(o.status) && !isReturnedDeliveredToSupplier(o.status)).length;
  
  // 2. Returns delivered back to supplier ("تم تسليم المرتجع للمورد" or equivalent)
  const returnsDeliveredValue = returnedDGoods.reduce((sum, o) => {
    return sum + getOrderFinancials(o).prodPrice;
  }, 0);

  // 3. Cash payments paid to supplier (Strict signed human payout classification)
  const sLedger = ledger.filter(l => isSameSupplier(l.supplier, supplier));
  const totalPaid = sLedger.filter(isHumanPayout).reduce((sum, l) => sum + Math.abs(Number(l.amount || 0)), 0);

  // 4. Current outstanding balance based on formula: Outstanding = TotalGoodsUploaded - Returned - Paid
  const remaining = totalGoodsUploaded - returnsDeliveredValue - totalPaid;

  return {
    ok: true,
    stats: {
      total,
      delivered,
      returned,
      totalCredited: totalGoodsUploaded,
      totalPaid,
      remaining
    }
  };
}

function getSupplierAccounts(sheets) {
  const suppliers = getTableData(sheets.suppliers) || [];
  const orders = getTableData(sheets.orders) || [];
  var archivedOrders = [];
  try {
    archivedOrders = getTableData(sheets.archivedOrders) || [];
  } catch (e) {
    // Graceful fallback if sheet does not exist
  }
  const combinedOrders = orders.concat(archivedOrders);
  const supplierLedger = getTableData(sheets.supplierLedger) || [];

  const preloadedDb = {
    suppliers: suppliers,
    allOrders: combinedOrders,
    supplierLedger: supplierLedger
  };

  // Extract all unique names from both suppliers list and orders list
  const registeredNames = suppliers.map(function(s) { return s.name; }).filter(Boolean);
  const orderNames = combinedOrders.map(function(o) {
    var oSup = o.supplier !== undefined ? o.supplier : (o["المورد"] !== undefined ? o["المورد"] : (o["اسم المورد"] !== undefined ? o["اسم المورد"] : (o["مورد"] !== undefined ? o["مورد"] : (o["merchant"] !== undefined ? o["merchant"] : (o["merchant_name"] !== undefined ? o["merchant_name"] : "")))));
    return oSup;
  }).filter(Boolean);
  const allSupplierNames = [];
  const seenSuppliers = {};

  // Combine both arrays, preserving case, unique
  registeredNames.concat(orderNames).forEach(function(name) {
    const cleanName = name.toString().trim();
    if (cleanName && !seenSuppliers[cleanName.toLowerCase()]) {
      seenSuppliers[cleanName.toLowerCase()] = true;
      allSupplierNames.push(cleanName);
    }
  });

  const list = allSupplierNames.map(function(supplierName) {
    const sObj = suppliers.find(function(s) {
      return s.name && s.name.toString().trim().toLowerCase() === supplierName.toLowerCase();
    });

    const calc = calculateSupplierBalance(sheets, supplierName, preloadedDb);

    return {
      name: supplierName,
      phone: sObj ? (sObj.phone || "—") : "—",
      totalRevenue: calc.totalGoodsUploaded,
      totalCOD: calc.totalGoodsUploaded,
      returnsDelivered: calc.returnsDeliveredValue,
      returnsCount: calc.returnedOrders.length,
      paid: calc.paymentsValue,
      payments: calc.paymentsValue,
      balance: calc.outstanding,
      totalOrders: calc.stats.totalOrdersCount,
      deliveredOrders: calc.stats.deliveredOrdersCount,
      openingBalance: calc.openingBalance
    };
  });

  return { ok: true, accounts: list };
}

function addSupplierPayment(sheets, d) {
  const { supplier, amount, desc, currentUser, transactionType, adjustmentType, tracking } = d;
  const isSettlement = transactionType === "تصفية يومية" || (desc && desc.includes("تصفية يوم"));
  
  if (!isSettlement) {
    if (!supplier || !amount || Number(amount) === 0) return { ok: false, error: "قيمة الدفعة المالية المكتوبة غير صحيحة" };
  }

  const val = Math.abs(Number(amount || 0));
  const typeStr = transactionType || "payout"; // payout, inflow, adjustment

  let ledgerType = "دفع نقدي";
  let ledgerAmount = -val; // MUST BE NEGATIVE [-] for payout as per definitive ledger signs (deduction)
  let finalDesc = desc || "";

  if (typeStr === "inflow") {
    ledgerType = "استلام نقدية";
    ledgerAmount = -val; // MUST BE NEGATIVE [-] for inflow as per definitive ledger signs
    if (!finalDesc) {
      finalDesc = `استلام نقدية / إيراد للخزنة من المورد: ${supplier}`;
    }
  } else if (typeStr === "adjustment") {
    const isAdd = adjustmentType === "add";
    ledgerType = isAdd ? "تسوية إضافة" : "تسوية خصم";
    ledgerAmount = isAdd ? val : -val; // Follows the exact user selection
    if (!finalDesc) {
      finalDesc = `تسوية رصيد يدوي (${isAdd ? "إضافة" : "خصم"}) للمورد: ${supplier}`;
    }
  } else {
    // payout (default)
    ledgerType = "دفع نقدي";
    ledgerAmount = -val; // MUST BE NEGATIVE [-] for payout as per definitive ledger signs (deduction)
    if (!finalDesc) {
      finalDesc = `دفعة نقدية مسددة للمورد: ${supplier}`;
    }
  }

  // 1. قيد الخزانة (صرف الدفعة المادية من السند المركزي لتقليص النقدية أو إيداعها)
  if (typeStr !== "adjustment") {
    appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
      date: now(),
      desc: finalDesc + " (" + (typeStr === "inflow" ? "وارد" : "صرف") + " مورد)",
      type: typeStr === "inflow" ? "إيداع" : "سداد مورد",
      amount: val,
      ref: tracking || "SUPPAY",
      addedBy: currentUser || "إدارة الحسابات"
    });
  }

  // 2. قيد دفتر الأستاذ الخاص بالمورد لإعدام الدائنة أو زيادتها
  appendToSheet(sheets.supplierLedger, ["supplier", "date", "type", "tracking", "amount", "desc"], {
    supplier: supplier,
    date: d.date || now(),
    type: ledgerType,
    tracking: tracking || "CASH-PAY",
    amount: isSettlement ? 0 : ledgerAmount,
    desc: finalDesc
  });

  // 3. تدوين الحدث الأمني المهم في سجل التدقيق المالي
  appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
    user: currentUser || "حسابات",
    type: isSettlement ? "تصفية يومية للمورد" : (typeStr === "inflow" ? "استلام نقدية من مورد" : (typeStr === "adjustment" ? "تسوية رصيد مورد" : "سداد مورد / دفعة نقدية")),
    dateTime: now(),
    oldVal: "—",
    newVal: isSettlement ? `تصفية حسابات يومية للمورد: ${supplier}` : `حركة مالية للمورد: ${supplier} بمبلغ ${ledgerAmount} ج.م (النوع: ${ledgerType})`,
    reason: finalDesc
  });

  return { ok: true, msg: isSettlement ? "تم تصفية اليوم بنجاح في سجلات الشيت" : "تم تسجيل الحركة المالية للمورد بنجاح وتسويتها" };
}

// ───────────────────────────────────────────────
// (د) حسابات تصفية مناديب الشحن ومنع العجز (Deficit System)
// ───────────────────────────────────────────────

function getCourierLedger(sheets, d) {
  const { courier } = d;
  const ledger = getTableData(sheets.courierLedger);
  const couriers = getTableData(sheets.couriers);
  const orders = getTableData(sheets.orders);
  const cashbox = getTableData(sheets.cashbox);

  const courierObj = couriers.find(c => c.name === courier);
  
  // Calculations - using new persistent configs with backward-compatible defaults
  const basicSalary = courierObj ? Number(courierObj.base_fixed_salary !== undefined && courierObj.base_fixed_salary !== "" ? courierObj.base_fixed_salary : (courierObj.salary || 3000)) : 3000;
  const commissionSuccess = courierObj ? Number(courierObj.commission_success !== undefined && courierObj.commission_success !== "" ? courierObj.commission_success : (courierObj.commission || 25)) : 25;
  const commissionReturn = courierObj ? Number(courierObj.commission_return !== undefined && courierObj.commission_return !== "" ? courierObj.commission_return : 10) : 10;

  const courierOrders = orders.filter(o => o.courier === courier);
  const targetLedger = ledger.filter(l => l.courier === courier);

  const todayDate = nowDay();

  const returnStatuses = [
    "مرتجع", "مرتجع بالمستودع", "مرتجع جديد", "مرتجع جاري تسليمه للمكتب", 
    "جاري الرجوع للمورد", "تم تسليم المرتجع للمورد", "جاهز للتسليم للمورد", 
    "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", 
    "مرتجع جزئي بالمستودع", "قيد المرتجع", "التسليم للمورد", "جاري تجهيز المرتجع", 
    "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"
  ];

  const getOrderActualCollection = function(o) {
    if (!o) return 0;
    var status = (o.status || "").toString().trim();
    if ([
      "تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"
    ].indexOf(status) !== -1) {
      return Number(o.totalCOD !== undefined && o.totalCOD !== "" && o.totalCOD !== null ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
    }
    if ([
      "تسليم جزئي", "تسليم جزئي - معلق للجرد"
    ].indexOf(status) !== -1) {
      var raw = o.actualReceivedCash !== undefined ? o.actualReceivedCash : (o.partialAmount !== undefined ? o.partialAmount : (o["المبلغ المستلم"] !== undefined ? o["المبلغ المستلم"] : (o["التحصيل الجزئي"] !== undefined ? o["التحصيل الجزئي"] : (o["التحصيل"] !== undefined ? o["التحصيل"] : (o["المبلغ المحصل"] !== undefined ? o["المبلغ المحصل"] : (o["المبلغ المستلم الفعلي"] !== undefined ? o["المبلغ المستلم الفعلي"] : ""))))));
      if (raw !== undefined && raw !== null && raw !== "") {
        var val = Number(raw);
        if (!isNaN(val)) return val;
      }
      return 0;
    }
    if ([
      "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", "مرتجع وتم دفع الشحن"
    ].indexOf(status) !== -1 || (status === "مرتجع" && o.returnShippingType === "paid")) {
      return Number(o.shipPrice || o.shipCost || 0);
    }
    return 0;
  };

  // Strict Courier Settlement Calculations (Today's performance):
  const successOrdersToday = courierOrders.filter(o => 
    ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد"].indexOf((o.status || "").toString().trim()) !== -1 && 
    o.delivDate && o.delivDate.substring(0, 10) === todayDate
  );
  
  const returnedOrdersToday = courierOrders.filter(o => 
    returnStatuses.includes((o.status || "").toString().trim()) && 
    o.retDate && o.retDate.substring(0, 10) === todayDate
  );

  const todayDeliveredCount = successOrdersToday.length;
  const todayReturnedCount = returnedOrdersToday.length;

  const todayDeliveredCash = successOrdersToday.reduce((sum, o) => sum + getOrderActualCollection(o), 0) + returnedOrdersToday.reduce((sum, o) => sum + getOrderActualCollection(o), 0);
  const todayReturnedPaidCash = 0;

  const todayTotalCommission = (todayDeliveredCount * commissionSuccess) + (todayReturnedCount * commissionReturn);

  const deliveredCount = courierOrders.filter(o => 
    ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد"].indexOf((o.status || "").toString().trim()) !== -1
  ).length;
  const delivCommission = deliveredCount * commissionSuccess;

  const returnedCount = courierOrders.filter(o => returnStatuses.includes(o.status)).length;
  const returnedPaidCount = 0;
  const returnShippingCommission = 0;

  const bonusesSum = targetLedger.filter(l => l.type === "مكافأة").reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const penaltiesSum = targetLedger.filter(l => l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز").reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

  const todayBonuses = targetLedger.filter(l => l.type === "مكافأة" && l.date && l.date.substring(0, 10) === todayDate).reduce((sum, x) => sum + Math.abs(Number(x.amount || 0)), 0);
  const todayPenalties = targetLedger.filter(l => (l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز") && l.date && l.date.substring(0, 10) === todayDate).reduce((sum, x) => sum + Math.abs(Number(x.amount || 0)), 0);

  // 【الصافي المطلوب توريده من المندوب (العهدة)】: الصافي المطلوب = التحصيل الفعلي الميداني - عمولات المندوب اليومية
  const requiredHandoverToday = todayDeliveredCash - todayTotalCommission;

  const totalCollected = courierOrders.reduce((sum, o) => sum + getOrderActualCollection(o), 0);
  const totalPaidToCompany = cashbox.filter(item => item.type === "استلام عهدة مندوب" && item.ref === courier).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const deficit = totalCollected - totalPaidToCompany;

  // Cumulative Daily Ledger calculations for Apps Script
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysCount = daysInCurrentMonth || 30;

  const datesSet = {};
  courierOrders.forEach(o => {
    if (o.status === "تم التسليم" && o.delivDate) {
      datesSet[o.delivDate.substring(0, 10)] = true;
    }
    if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status) && o.retDate) {
      datesSet[o.retDate.substring(0, 10)] = true;
    }
  });

  datesSet[todayDate] = true;

  const todayDayNum = now.getDate();
  for (let dMonth = 1; dMonth <= todayDayNum; dMonth++) {
    const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dMonth).padStart(2, "0");
    datesSet[dateStr] = true;
  }

  const sortedDates = Object.keys(datesSet).sort();
  
  // Pre-group courier delivered and returned orders by date for O(1) daily lookup
  const deliveredByDate = {};
  const returnedByDate = {};
  courierOrders.forEach(function(o) {
    if (o.status === "تم التسليم" && o.delivDate) {
      const dStr = o.delivDate.substring(0, 10);
      deliveredByDate[dStr] = (deliveredByDate[dStr] || 0) + 1;
    }
    if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status) && o.retDate) {
      const dStr = o.retDate.substring(0, 10);
      returnedByDate[dStr] = (returnedByDate[dStr] || 0) + 1;
    }
  });

  let runningCumulative = 0;
  const dailyEarnings = sortedDates.map(dStr => {
    const deliveredDay = deliveredByDate[dStr] || 0;
    const returnedDay = returnedByDate[dStr] || 0;

    const baseEarning = Number((basicSalary / daysCount).toFixed(2));
    const delivEarning = deliveredDay * commissionSuccess;
    const retEarning = returnedDay * commissionReturn;
    const total = baseEarning + delivEarning + retEarning;
    runningCumulative += total;

    return {
      date: dStr,
      delivered: deliveredDay,
      returned: returnedDay,
      baseEarning,
      delivEarning,
      retEarning,
      total: Number(total.toFixed(2)),
      cumulative: Number(runningCumulative.toFixed(2))
    };
  });

  const netSalary = basicSalary + todayTotalCommission + bonusesSum - penaltiesSum;

  return {
    ok: true,
    ledgerInfo: {
      courierName: courier,
      basicSalary,
      base_fixed_salary: basicSalary,
      commission_success: commissionSuccess,
      commission_return: commissionReturn,
      deliveredCount,
      delivCommission,
      returnedCount,
      returnedPaidCount,
      returnShippingCommission,
      bonusesSum,
      penaltiesSum,
      netSalary,
      totalCollected,
      totalPaidToCompany,
      deficit,
      todayDeliveredCount,
      todayDelivCommission: todayTotalCommission, // backward compatibility
      todayDeliveredCash,
      todayReturnedPaidCash,
      todayTotalCommission,
      todayPenalties,
      todayBonuses,
      requiredHandoverToday,
      dailyEarnings: dailyEarnings.reverse() // Sort descending
    },
    transactions: targetLedger.reverse()
  };
}

function getCourierInfo(sheets, d) {
  const courierName = d.courier;
  const couriers = getTableData(sheets.couriers);
  const orders = getTableData(sheets.orders);
  const ledger = getTableData(sheets.courierLedger);
  const cashbox = getTableData(sheets.cashbox);

  const courierObj = couriers.find(c => c.name === courierName);
  if (!courierObj) return { ok: false, error: "المندوب غير مسجل" };

  const returnStatuses = [
    "مرتجع", "مرتجع بالمستودع", "مرتجع جديد", "مرتجع جاري تسليمه للمكتب", 
    "جاري الرجوع للمورد", "تم تسليم المرتجع للمورد", "جاهز للتسليم للمورد", 
    "مرتجع تم تسليمه للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه", 
    "مرتجع جزئي بالمستودع", "قيد المرتجع", "التسليم للمورد", "جاري تجهيز المرتجع", 
    "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن"
  ];

  const getOrderActualCollection = function(o) {
    if (!o) return 0;
    var status = (o.status || "").toString().trim();
    if ([
      "تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"
    ].indexOf(status) !== -1) {
      return Number(o.totalCOD !== undefined && o.totalCOD !== "" && o.totalCOD !== null ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
    }
    if ([
      "تسليم جزئي", "تسليم جزئي - معلق للجرد"
    ].indexOf(status) !== -1) {
      var raw = o.actualReceivedCash !== undefined ? o.actualReceivedCash : (o.partialAmount !== undefined ? o.partialAmount : (o["المبلغ المستلم"] !== undefined ? o["المبلغ المستلم"] : (o["التحصيل الجزئي"] !== undefined ? o["التحصيل الجزئي"] : (o["التحصيل"] !== undefined ? o["التحصيل"] : (o["المبلغ المحصل"] !== undefined ? o["المبلغ المحصل"] : (o["المبلغ المستلم الفعلي"] !== undefined ? o["المبلغ المستلم الفعلي"] : ""))))));
      if (raw !== undefined && raw !== null && raw !== "") {
        var val = Number(raw);
        if (!isNaN(val)) return val;
      }
      return 0;
    }
    if ([
      "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", "مرتجع وتم دفع الشحن"
    ].indexOf(status) !== -1 || (status === "مرتجع" && o.returnShippingType === "paid")) {
      return Number(o.shipPrice || o.shipCost || 0);
    }
    return 0;
  };

  const courierOrders = orders.filter(o => o.courier === courierName);
  const targetLedger = ledger.filter(l => l.courier === courierName);

  const basicSalary = courierObj ? Number(courierObj.base_fixed_salary !== undefined && courierObj.base_fixed_salary !== "" ? courierObj.base_fixed_salary : (courierObj.salary || 3000)) : 3000;
  const commissionSuccess = courierObj ? Number(courierObj.commission_success !== undefined && courierObj.commission_success !== "" ? courierObj.commission_success : (courierObj.commission || 25)) : 25;
  const commissionReturn = courierObj ? Number(courierObj.commission_return !== undefined && courierObj.commission_return !== "" ? courierObj.commission_return : 10) : 10;

  const todayDate = nowDay();

  // Strict Courier Settlement Calculations (Today's performance):
  const successOrdersToday = courierOrders.filter(o => 
    ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد"].indexOf((o.status || "").toString().trim()) !== -1 && 
    o.delivDate && o.delivDate.substring(0, 10) === todayDate
  );

  const returnedOrdersToday = courierOrders.filter(o => 
    returnStatuses.includes((o.status || "").toString().trim()) && 
    o.retDate && o.retDate.substring(0, 10) === todayDate
  );

  const todayDeliveredCount = successOrdersToday.length;
  const todayReturnedCount = returnedOrdersToday.length;

  const todayDeliveredCash = successOrdersToday.reduce((sum, o) => sum + getOrderActualCollection(o), 0) + returnedOrdersToday.reduce((sum, o) => sum + getOrderActualCollection(o), 0);
  const todayReturnedPaidCash = 0;

  const todayTotalCommission = (todayDeliveredCount * commissionSuccess) + (todayReturnedCount * commissionReturn);

  const delivCommission = targetLedger.filter(l => l.type === "تسليم").reduce((sum, item) => sum + Number(item.amount || commissionSuccess), 0);
  const returnShippingCommission = 0;
  const bonusesSum = targetLedger.filter(l => l.type === "مكافأة").reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);
  const penaltiesSum = targetLedger.filter(l => l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز").reduce((sum, item) => sum + Math.abs(Number(item.amount || 0)), 0);

  const todayBonuses = targetLedger.filter(l => l.type === "مكافأة" && l.date && l.date.substring(0, 10) === todayDate).reduce((sum, x) => sum + Math.abs(Number(x.amount || 0)), 0);
  const todayPenalties = targetLedger.filter(l => (l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز") && l.date && l.date.substring(0, 10) === todayDate).reduce((sum, x) => sum + Math.abs(Number(x.amount || 0)), 0);

  // 【الصافي المطلوب توريده من المندوب (العهدة)】: الصافي المطلوب = التحصيل الفعلي الميداني - عمولات المندوب اليومية
  const requiredHandoverToday = todayDeliveredCash - todayTotalCommission;

  const totalCollected = courierOrders.reduce((sum, o) => sum + getOrderActualCollection(o), 0);
  const totalPaidToCompany = cashbox.filter(item => item.type === "استلام عهدة مندوب" && item.ref === courierName).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const deficit = totalCollected - totalPaidToCompany;

  const netSalary = basicSalary + todayTotalCommission + bonusesSum - penaltiesSum;

  const todayDelivered = todayDeliveredCount;
  const todayDelivCommission = todayTotalCommission;
  const todayReturned = todayReturnedCount;

  // Cumulative Daily Ledger calculations for Apps Script
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
  const daysCount = daysInCurrentMonth || 30;

  const datesSet = {};
  const fullDeliveredStatuses = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"];
  courierOrders.forEach(o => {
    if (fullDeliveredStatuses.indexOf(o.status) !== -1 && o.delivDate) {
      datesSet[o.delivDate.substring(0, 10)] = true;
    }
    if (["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status) && o.retDate) {
      datesSet[o.retDate.substring(0, 10)] = true;
    }
  });

  datesSet[todayDate] = true;

  const todayDayNum = now.getDate();
  for (let dMonth = 1; dMonth <= todayDayNum; dMonth++) {
    const dateStr = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(dMonth).padStart(2, "0");
    datesSet[dateStr] = true;
  }

  const sortedDates = Object.keys(datesSet).sort();
  let runningCumulative = 0;
  const dailyEarnings = sortedDates.map(dStr => {
    const deliveredDay = courierOrders.filter(o => fullDeliveredStatuses.indexOf(o.status) !== -1 && o.delivDate && o.delivDate.substring(0, 10) === dStr).length;
    const returnedDay = courierOrders.filter(o => ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status) && o.retDate && o.retDate.substring(0, 10) === dStr).length;

    const baseEarning = Number((basicSalary / daysCount).toFixed(2));
    const delivEarning = deliveredDay * commissionSuccess;
    const retEarning = returnedDay * commissionReturn;
    const total = baseEarning + delivEarning + retEarning;
    runningCumulative += total;

    return {
      date: dStr,
      delivered: deliveredDay,
      returned: returnedDay,
      baseEarning,
      delivEarning,
      retEarning,
      total: Number(total.toFixed(2)),
      cumulative: Number(runningCumulative.toFixed(2))
    };
  });

  return {
    ok: true,
    summary: {
      courierName,
      basicSalary,
      base_fixed_salary: basicSalary,
      commission_success: commissionSuccess,
      commission_return: commissionReturn,
      deliveredCount: courierOrders.filter(o => fullDeliveredStatuses.indexOf(o.status) !== -1).length,
      returnedPaidCount: courierOrders.filter(o => o.status === "مرتجع" && o.returnShippingType === "paid").length,
      returnedCount: courierOrders.filter(o => ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status)).length,
      delivCommission,
      returnShippingCommission,
      bonusesSum,
      penaltiesSum,
      netSalary,
      totalCollected,
      totalPaidToCompany,
      deficit,
      todayDelivered,
      todayDelivCommission,
      todayReturned,
      todayReturnCommission: todayReturned * commissionSuccess,
      todayDeliveredCash,
      todayReturnedPaidCash,
      todayTotalCommission,
      todayPenalties,
      todayBonuses,
      requiredHandoverToday,
      dailyEarnings: dailyEarnings.reverse() // Sort descending
    },
    transactions: targetLedger.reverse()
  };
}

function addCourierAdjustment(sheets, d) {
  const { courier, type, amount, desc, currentUser } = d;
  if (!courier || !amount || Number(amount) <= 0) return { ok: false, error: "المبلغ المالي المكتوب لتسوية المندوب غير صحيح" };

  const val = Number(amount);

  // تسجيل القيد بدفتر العهد والمكافآت والجزاءات للمندوب
  appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
    courier: courier,
    date: now(),
    type: type, // 'مكافأة' أو 'جزاء' أو 'خصم عجز تلقائي'
    tracking: "—",
    amount: (type === "جزاء" || type === "خصم" || type === "خصم عجز" || type === "خصم عجز تلقائي") ? -val : val,
    desc: desc || `تسوية مالية يدوية من نوع ${type}`
  });

  // تسجيلها بالخزنة فوراً ليتطابق الحساب أوتوماتيكياً
  if (type === "مكافأة") {
    appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
      date: now(),
      desc: `مكافأة منصرفة للمندوب: ${courier} - ${desc || ''}`,
      type: "صرف",
      amount: val,
      ref: "BONUS",
      addedBy: currentUser || "إدارة الحسابات"
    });
  } else if (type === "جزاء" || type === "خصم" || type === "خصم عجز" || type === "خصم عجز تلقائي") {
    appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
      date: now(),
      desc: `تسوية خصم/جزاء مستقطع للمندوب: ${courier} - ${desc || ''}`,
      type: "استلام عهدة مندوب",
      amount: val,
      ref: "PENALTY",
      addedBy: currentUser || "إدارة الحسابات"
    });
  } else if (type === "استلام تصفية") {
    appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
      date: now(),
      desc: desc || `تسوية عجز مباشر مسترد للمندوب: ${courier}`,
      type: "استلام عهدة مندوب",
      amount: val,
      ref: courier,
      addedBy: currentUser || "إدارة العمليات"
    });
  }

  // تسجيل القيد الأمني في نظام التدقيق المالي
  appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
    user: currentUser || "إدارة الحسابات",
    type: `تسوية مندوب (${type})`,
    dateTime: now(),
    oldVal: "—",
    newVal: `${type}: ${val} ج.م للمندوب: ${courier}`,
    reason: desc || `تسجيل تسوية للمندوب: ${courier}`
  });

  return { ok: true, msg: "تم تسجيل التسوية المالية للمندوب بنجاح" };
}

// ───────────────────────────────────────────────
// (هـ) دوال الخزانة والمصروفات الإدارية والمستخدمين
// ───────────────────────────────────────────────

function getStatusHistory(sheets, d) {
  const list = getTableData(sheets.statusHistory);
  const filtered = list.filter(h => h.tracking === d.tracking);
  return { ok: true, history: filtered };
}

function getCashbox(sheets) {
  const list = getTableData(sheets.cashbox);
  const inSum = list.filter(function(c) {
    var t = c.type ? c.type.toString().trim() : "";
    return ["وارد", "تحصيل مندوب", "إيداع خزنة direct", "إيداع", "استلام عهدة مندوب", "إيداع بالخزنة"].indexOf(t) !== -1;
  }).reduce(function(sum, item) { return sum + Number(item.amount || 0); }, 0);
  
  const outSum = list.filter(function(c) {
    var t = c.type ? c.type.toString().trim() : "";
    return ["صادر", "صرف مورد", "دفعة للمورد", "مصروفات", "سحب من الخزنة", "صرف"].indexOf(t) !== -1 || t.indexOf("سداد") === 0;
  }).reduce(function(sum, item) { return sum + Number(item.amount || 0); }, 0);
  
  const balance = inSum - outSum;

  return { ok: true, entries: list.reverse(), balance: balance };
}

function addCashbox(sheets, d) {
  const { type, amount, desc, ref, currentUser } = d;
  if (!amount || Number(amount) <= 0) return { ok: false, error: "المبلغ المالي المكتوب غير صالح" };

  const val = Number(amount);

  const cashObj = {
    date: now(),
    desc: desc || "حركة توريد خزنة مباشرة",
    type: type, // 'إيداع خزنة direct' أو 'استلام عهدة مندوب'
    amount: val,
    ref: ref || "—",
    addedBy: currentUser || "الحسابات"
  };

  appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], cashObj);
  return { ok: true, msg: "تم إيداع المبلغ بالخزنة بنجاح وتصحيح العجز" };
}

function getExpenses(sheets) {
  const list = getTableData(sheets.expenses);
  return { ok: true, expenses: list };
}

function addExpense(sheets, d) {
  const { amount, desc, category, currentUser } = d;
  if (!amount || Number(amount) <= 0) return { ok: false, error: "قيمة الصرف للمصروفات غير صالحة" };

  const val = Number(amount);
  const idValue = "EXP-" + Math.floor(100000 + Math.random() * 900000);

  // 1. تسجيل المصروف بقيد جدول المصروفات الإدارية
  appendToSheet(sheets.expenses, ["id", "date", "amount", "desc", "category", "addedBy"], {
    id: idValue,
    date: nowHour(),
    amount: val,
    desc: desc,
    category: category,
    addedBy: currentUser || "عمليات"
  });

  // 2. ترحيل الأثر المالي فوراً لحسمه من الخزنة المركزية لضمان المطابقة
  appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
    date: now(),
    desc: `بند مصروفات إدارية: ${desc} (فئة: ${category})`,
    type: "مصروفات",
    amount: val,
    ref: idValue,
    addedBy: currentUser || "إدارة الحسابات"
  });

  return { ok: true, msg: "تم تسجيل وتسجيل المصروف الإداري وتحريره من الخزنة بنجاح" };
}

function nowHour() {
  return Utilities.formatDate(new Date(), "GMT+3", "yyyy-MM-dd HH:mm");
}

function getUsers(sheets) {
  const list = getTableData(sheets.users);
  return { ok: true, users: list };
}

function getPermissionsForRole(role) {
  const r = (role || "").toString().trim();
  if (r === "مدير") return "كاملة";
  if (r === "مشرف" || r === "موظف عمليات") return "توزيع ومتابعة";
  if (r === "محاسب") return "خزنة وحسابات وتقارير مالية";
  if (r === "مندوب" || r.indexOf("مندوب") > -1) return "أوردرات المندوب وتحديث الحالات";
  if (r === "مورد" || r.indexOf("مورد") > -1) return "إضافة أوردرات ورفع كشوفات";
  if (r === "مسؤول مرتجعات" || r === "موظف مرتجعات" || r === "موظف مرتجعات") return "متابعة المرتجعات";
  return "متابعة حالات فقط";
}

function addUser(sheets, d) {
  return registerUser(sheets, d);
}

function registerUser(sheets, d) {
  const userContainer = d.user || {};
  const name = (userContainer.name ? userContainer.name : d.name || "").toString().trim();
  const role = (userContainer.role ? userContainer.role : d.role || "").toString().trim();
  const pass = (userContainer.pass ? userContainer.pass : d.pass || "").toString().trim();
  const active = (userContainer.active ? userContainer.active : d.active || "نعم").toString().trim();
  const email = (userContainer.email ? userContainer.email : d.email || "").toString().trim();
  let assignedPerms = userContainer.perms || d.perms || "";

  // Ensure minimal required fields are checked properly
  if (!name || !role || !pass) {
    return { ok: false, error: "اسم المستخدم، الدور الوظيفي، وكلمة المرور حقول إجبارية" };
  }

  const usersSheet = sheets.users;
  const userIndex = findRowIndex(usersSheet, "name", name);
  if (userIndex !== -1) return { ok: false, error: "اسم الحساب المدخل مسجل به مستخدم آخر مسبقاً" };

  // Auto-map permissions based on role if not provided by UI
  if (!assignedPerms) {
    if (role === "مدير") assignedPerms = "كاملة";
    else if (role === "مشرف") assignedPerms = "توزيع ومتابعة";
    else if (role === "مندوب") assignedPerms = "معاينة الشحنات والتقفيل";
    else assignedPerms = "متابعة محدودة";
  }

  // Append row safely to the unified English users layout using key mappings with appendToSheet
  appendToSheet(usersSheet, ["name", "role", "pass", "active", "email", "perms"], {
    name: name,
    role: role,
    pass: hashPassword(pass),
    active: active,
    email: email || "—",
    perms: assignedPerms
  });

  // Auto-generate Courier Profile if the newly created user is a Courier
  if (role === "مندوب") {
    const couriersSheet = sheets.couriers;
    if (couriersSheet) {
      const courierIndex = findRowIndex(couriersSheet, "name", name);
      if (courierIndex === -1) {
        appendToSheet(couriersSheet, ["name", "phone", "commission", "salary", "region", "base_fixed_salary", "commission_success", "commission_return"], {
          name: name,
          phone: "—",
          commission: 20,
          salary: 3000,
          region: "—",
          base_fixed_salary: 3000,
          commission_success: 20,
          commission_return: 0
        });
      }
    }
  }

  // Auto-generate Supplier Profile if the newly created user is a Supplier
  if (role === "مورد") {
    const suppliersSheet = sheets.suppliers;
    if (suppliersSheet) {
      const supplierIndex = findRowIndex(suppliersSheet, "name", name);
      if (supplierIndex === -1) {
        appendToSheet(suppliersSheet, ["name", "phone", "price", "notes"], {
          name: name,
          phone: "—",
          price: 65,
          notes: "مورد جديد"
        });
      }
    }
  }

  return { ok: true, msg: "تم إنشاء الحساب وإعداد الصلاحيات والملف المالي بنجاح" };
}

function updateUser(sheets, d) {
  let u = d.user || {};
  if (!u.name) u.name = d.name;
  if (!u.role) u.role = d.role;
  if (!u.active) u.active = d.active;
  if (!u.perms) u.perms = d.perms;

  if (!u || !u.name) return { ok: false, error: "اسم الموظف مفقود لتحديث ملفه" };

  const userIndex = findRowIndex(sheets.users, "name", u.name);
  if (userIndex === -1) return { ok: false, error: "الموظف المطلوب غير موجود في النظام" };

  updateRowByObject(sheets.users, userIndex, u);
  return { ok: true, msg: "تم تحديث وحفظ تفاصيل حساب الموظف المختار" };
}

function checkPhone(sheets, d) {
  const { phone } = d;
  const orders = getTableData(sheets.orders);
  const found = orders.some(o => o.phone === phone || o.phone2 === phone);
  return { ok: true, exists: found };
}

function getCouriers(sheets, d) {
  const users = getTableData(sheets.users);
  const profiles = getTableData(sheets.couriers);

  let activeUsersCouriers = users.filter(function(u) {
    const role = (u.role || "").toString().trim();
    const active = (u.active || "").toString().trim();
    const name = (u.name || "").toString().trim();
    return (role === "مندوب" || role.indexOf("مندوب") > -1 || name === "عصفور") && active !== "لا";
  });

  // Supervisor Hierarchy Filter in Google Sheets backend
  var cleanRole = d ? (d.currentRole || "").toString().trim() : "";
  var currentUser = d ? (d.currentUser || "").toString().trim() : "";
  var isAdmin = cleanRole === "مدير";

  if (cleanRole === "مشرف" && currentUser) {
    var staffPermissionsList = getTableData(sheets.staffPermissions) || [];
    var supervisedNames = [];
    for (var j = 0; j < staffPermissionsList.length; j++) {
      var item = staffPermissionsList[j];
      if ((item.supervisor_id || "").toString().trim() === currentUser) {
        supervisedNames.push((item.name || "").toString().trim());
      }
    }
    activeUsersCouriers = activeUsersCouriers.filter(function(u) {
      var uName = (u.name || "").toString().trim();
      return supervisedNames.indexOf(uName) !== -1;
    });
  }

  const list = activeUsersCouriers.map(function(u) {
    const profile = profiles.find(function(c) {
      return (c.name || "").toString().trim() === (u.name || "").toString().trim();
    }) || {};

    return {
      name: u.name,
      phone: profile.phone || "—",
      commission: profile.commission !== undefined ? profile.commission : 25,
      salary: isAdmin ? (profile.salary !== undefined ? profile.salary : 3000) : null,
      region: profile.region || "—",
      base_fixed_salary: isAdmin ? (profile.base_fixed_salary !== undefined ? profile.base_fixed_salary : (profile.salary || 3000)) : null,
      commission_success: profile.commission_success !== undefined ? profile.commission_success : (profile.commission || 25),
      commission_return: profile.commission_return !== undefined ? profile.commission_return : 10
    };
  });

  return { ok: true, couriers: list };
}

function getSuppliers(sheets) {
  const list = getTableData(sheets.suppliers);
  return { ok: true, suppliers: list };
}

function getReportStats(sheets, d) {
  const { period } = d;
  const orders = getTableData(sheets.orders);
  let list = orders;

  const todayStr = nowDay();
  if (period === "today") {
    list = orders.filter(o => o.orderDate === todayStr);
  } else if (period === "pending") {
    list = orders.filter(o => o.status === "جاهز للشحن" || o.status === "جاري التجهيز");
  } else if (period === "return") {
    list = orders.filter(o => ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(o.status));
  } else if (period === "delivered") {
    list = orders.filter(o => o.status === "تم التسليم");
  }

  return { ok: true, count: list.length, orders: list };
}

function getDailyClosing(sheets) {
  const data = getTableData(sheets.dailyClosing);
  return { ok: true, records: data };
}

function addDailyClosing(sheets, d) {
  const { date, deliveredCount, returnedCount, totalCOD, shippingCost, currentUser } = d;
  if (!date) return { ok: false, error: "التاريخ مطلوب لتسجيل التقفيل اليومي" };

  const sheet = sheets.dailyClosing;
  const rowIndex = findRowIndex(sheet, "date", date);

  const closingObj = {
    date: date,
    deliveredCount: Number(deliveredCount || 0),
    returnedCount: Number(returnedCount || 0),
    totalCOD: Number(totalCOD || 0),
    shippingCost: Number(shippingCost || 0),
    addedBy: currentUser || "النظام"
  };

  if (rowIndex !== -1) {
    // تحديث صف التقفيل لموجود مسبقاً
    updateRowByObject(sheet, rowIndex, closingObj);
  } else {
    // إضافة صف جديد
    const headers = ["date", "deliveredCount", "returnedCount", "totalCOD", "shippingCost", "addedBy"];
    appendToSheet(sheet, headers, closingObj);
  }

  // تدوين التغيير المالي في سجل التدقيق الأمني لمنع التلاعب بالتقفيل
  appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
    user: currentUser || "محاسب",
    type: "ترصيد تقفيل يومي",
    dateTime: now(),
    oldVal: rowIndex !== -1 ? "تحديث تقرير موجود" : "تقرير جديد",
    newVal: `تقفيل ${date}: تسليم ${deliveredCount}أوردر، مرتجع ${returnedCount}أوردر، تحصيل ${totalCOD}ج.م، شحن ${shippingCost}ج.م`,
    reason: `تسجيل ومطابقة التقفيل اليومي المجمع لليوم المالي ${date}`
  });

  return { ok: true, msg: `تم حفظ تقرير التقفيل لليوم ${date} بالملفات المركزية للشيت بنجاح` };
}

function updateCourier(sheets, d) {
  const { name, phone, region, base_fixed_salary, commission_success, commission_return, hire_date } = d;
  if (!name) return { ok: false, error: "اسم المندوب مطلوب لتحديث البيانات" };

  const couriersSheet = sheets.couriers;
  const trimmedName = name.toString().trim();
  let courierIndex = -1;
  const lastRow = couriersSheet.getLastRow();
  if (lastRow > 1) {
    const colIndex = getHeaderIndex(couriersSheet, "name");
    if (colIndex !== -1) {
      const vals = couriersSheet.getRange(2, colIndex, lastRow - 1, 1).getValues();
      for (let i = 0; i < vals.length; i++) {
        if (vals[i][0].toString().trim().toLowerCase() === trimmedName.toLowerCase()) {
          courierIndex = i + 2;
          break;
        }
      }
    }
  }

  const courierObj = {
    name: trimmedName,
    phone: phone || "—",
    salary: Number(base_fixed_salary !== undefined ? base_fixed_salary : 3000),
    commission: Number(commission_success !== undefined ? commission_success : 25),
    region: region || "—",
    base_fixed_salary: Number(base_fixed_salary !== undefined ? base_fixed_salary : 3000),
    commission_success: Number(commission_success !== undefined ? commission_success : 25),
    commission_return: Number(commission_return !== undefined ? commission_return : 10),
    hire_date: hire_date || "",
    last_closing_date: ""
  };

  if (courierIndex === -1) {
    appendToSheet(couriersSheet, ["name", "phone", "commission", "salary", "region", "base_fixed_salary", "commission_success", "commission_return", "hire_date", "last_closing_date"], courierObj);
  } else {
    // If it exists, retrieve old last_closing_date to preserve it
    const lastClosingColIdx = getHeaderIndex(couriersSheet, "last_closing_date");
    if (lastClosingColIdx !== -1) {
      const oldLastClosing = couriersSheet.getRange(courierIndex, lastClosingColIdx).getValue();
      courierObj.last_closing_date = oldLastClosing ? oldLastClosing.toString().trim() : "";
    }
    updateRowByObject(couriersSheet, courierIndex, courierObj);
  }

  return { ok: true, msg: "تم تحديث وحفظ بيانات المندوب بنجاح بفولدر السيستم" };
}

function settleCourierOrders(sheets, d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const { courier, currentUser } = d;
    if (!courier) return { ok: false, error: "المندوب غير محدد" };

    const sheet = sheets.orders;
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { ok: true, msg: "لا توجد أوردرات للتحديث", settled: 0 };

    const lastCol = sheet.getLastColumn();
    const dataRange = sheet.getRange(1, 1, lastRow, lastCol);
    const data = dataRange.getValues();
    const headers = data[0].map(function(h) { return h ? h.toString().trim() : ""; });

    const trackingIdx = headers.indexOf("tracking");
    const courierIdx = headers.indexOf("courier");
    const statusIdx = headers.indexOf("status");
    const commissionIdx = headers.indexOf("commission");
    const lastCourierIdx = headers.indexOf("lastCourier");
    const lastCommissionIdx = headers.indexOf("lastCommission");
    const courierSignatureIdx = headers.indexOf("courierSignature");
    const updatedAtIdx = headers.indexOf("updatedAt");
    const isSettledIdx = headers.indexOf("isSettled");
    const is_settledIdx = headers.indexOf("is_settled");
    const partialAmountIdx = headers.indexOf("partialAmount");
    const actualReceivedCashIdx = headers.indexOf("actualReceivedCash");
    const returnReasonIdx = headers.indexOf("returnReason");
    const returnSubStatusIdx = headers.indexOf("returnSubStatus");

    if (trackingIdx === -1 || courierIdx === -1 || statusIdx === -1) {
      return { ok: false, error: "فشل التحقق: حقول الورقة غير مكتملة" };
    }

    let settledCount = 0;
    const nowCairoStr = now();
    const searchCourier = courier.toString().trim().toLowerCase();

    // Prepare Archived Orders sheet
    const archiveSheet = sheets.archivedOrders;
    const archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });

    // Process from back to front so row indices are structurally stable upon deletion
    for (let r = data.length - 1; r >= 1; r--) {
      const rowCourier = data[r][courierIdx] ? data[r][courierIdx].toString().trim() : "";
      if (rowCourier.toLowerCase() === searchCourier) {
        const trackingVal = data[r][trackingIdx] ? data[r][trackingIdx].toString().trim() : "";
        const oldStatus = data[r][statusIdx] ? data[r][statusIdx].toString().trim() : "";
        const oldCommission = data[r][commissionIdx] ? Number(data[r][commissionIdx] || 0) : 0;

        const rowIndex = r + 1;
        
        // Build data map for the current row to safely update properties dynamically
        const rowDataMap = {};
        for (let c = 0; c < headers.length; c++) {
          if (headers[c]) {
            rowDataMap[headers[c]] = data[r][c];
          }
        }

        rowDataMap["lastCourier"] = rowCourier;
        rowDataMap["lastCommission"] = oldCommission;

        let nextStatus = oldStatus;
        if (oldStatus === "مرتجع" || oldStatus === "مرتجع جديد") {
          nextStatus = "مرتجع بالمستودع";
          rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية المرتجع الميداني ✍️)";
        } else if (oldStatus === "تسليم جزئي" || oldStatus === "مرتجع جزئي" || oldStatus === "تسليم جزئي - معلق للجرد") {
          nextStatus = "مرتجع جزئي بالمستودع";
          rowDataMap["returnReason"] = "مرتجع جزئي متبقي";
          rowDataMap["returnSubStatus"] = "بضاعة متبقية من تسليم جزئي";
          rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية المرتجع الجزئي ✍️)";

          const partialAmt = rowDataMap["partialAmount"] !== undefined ? Number(rowDataMap["partialAmount"] || 0) : 0;
          const actualCash = Number(rowDataMap["actualReceivedCash"] || partialAmt || rowDataMap["totalCOD"] || 0);
          if (actualCash > 0) {
            appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
              date: nowCairoStr,
              desc: "تحصيل تصفية تسليم جزئي للشحنة رقم: " + trackingVal,
              type: "استلام عهدة مندوب",
              amount: actualCash,
              ref: courier,
              addedBy: currentUser || "إدارة"
            });
          }
        } else if (oldStatus === "مؤجل" || oldStatus === "Delayed" || oldStatus === "مؤجل من المندوب" || oldStatus === "مؤجل بناءً على طلب العميل") {
          nextStatus = "مؤجل بالمستودع";
          rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية المؤجل ✍️)";
        } else if (oldStatus === "لا يوجد رد" || oldStatus === "العميل لا يرد" || oldStatus === "No Answer" || oldStatus === "العميل لم يقم بالرد") {
          nextStatus = "لا يوجد رد بالمستودع";
          rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية عدم الرد ✍️)";
        }

        rowDataMap["status"] = nextStatus;
        var isSuccessfullyClosed = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي"].indexOf(oldStatus) !== -1;
        if (isSuccessfullyClosed) {
          rowDataMap["isSettled"] = "true";
          rowDataMap["is_settled"] = "true";
        } else {
          rowDataMap["courier"] = "";
          rowDataMap["commission"] = 0;
          rowDataMap["isSettled"] = "false";
          rowDataMap["is_settled"] = "false";
        }
        rowDataMap["updatedAt"] = nowCairoStr;

        // Record status change event
        appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
          tracking: trackingVal,
          oldStatus: oldStatus,
          newStatus: nextStatus,
          updatedBy: currentUser || "إدارة",
          dateTime: nowCairoStr
        });

        // Strict Archiving Logic:
        // Only "تم التسليم" and "التسليم للمورد" are allowed to be archived and deleted from the live sheets.
        // Orders with other warehouse states (like "مرتجع بالمستودع", "مرتجع جزئي بالمستودع", "مؤجل بالمستودع", "لا يوجد رد بالمستودع") MUST remain in the active sheet.
        var shouldArchive = false;
        if (nextStatus === "تم التسليم" || nextStatus === "تم التسليم بنجاح" || nextStatus === "تم التسليم (ناجح كاش)" || nextStatus === "التسليم للمورد" || nextStatus === "تم تسليم المرتجع للمورد") {
          shouldArchive = true;
        }

        if (shouldArchive) {
          // Populate values based on archive headers
          const archiveRowValues = [];
          for (let h = 0; h < archiveHeaders.length; h++) {
            const headerName = archiveHeaders[h];
            const val = rowDataMap[headerName] !== undefined ? rowDataMap[headerName] : "";
            archiveRowValues.push(val);
          }

          // Write row into archive sheet
          archiveSheet.appendRow(archiveRowValues);

          // Verify row duplication before deletion to protect logistics data integrity
          let lastArchRow = archiveSheet.getLastRow();
          let trColIdx = archiveHeaders.indexOf("tracking") + 1;
          let confirmTracking = "";
          if (trColIdx > 0 && lastArchRow > 0) {
            confirmTracking = archiveSheet.getRange(lastArchRow, trColIdx).getValue().toString().trim();
          }

          if (confirmTracking.toUpperCase() === trackingVal.toUpperCase()) {
            // Delete row from active orders sheet
            sheet.deleteRow(rowIndex);
            settledCount++;
          } else {
            // Verification failed, fallback: preserve in active sheet but update properties
            updateRowByObject(sheet, rowIndex, rowDataMap);
          }
        } else {
          // Keep in active sheet, just update in place!
          updateRowByObject(sheet, rowIndex, rowDataMap);
        }
      }
    }

    return { ok: true, settled: settledCount, msg: "تم ترحيل وتصفية " + settledCount + " شحنة إلى الأرشيف التاريخي وتطهير الشاشات الحية بنجاح ✓" };

  } catch (e) {
    return { ok: false, error: "خطأ في سكريبت جوجل شيت أثناء التسوية: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function triggerCustomerLocationRequest(orderId, customerPhone, supplierName) {
  Logger.log("[WhatsApp Bot Trigger] Sending location prompt to customer: " + customerPhone + " for order: " + orderId + " from: " + supplierName);
  var textMsg = "مرحباً بك يا فندم، معك شركة Asfoor للوجيستيات. لديك شحنة قادمة من [" + supplierName + "]. لتأكيد موافقتك على الشحنة وتسهيل وصول المندوب، برجاء الضغط على زر (إرسال الموقع الحقيقي / Share Location) أسفل هذه الرسالة.";
  Logger.log("Simulated interactive WhatsApp payload: " + textMsg);
}

function simulateCustomerLocationReply(sheets, d) {
  var tracking = d.tracking;
  var lat = d.lat || 30.0440;
  var lng = d.lng || 31.2350;
  if (!tracking) return { ok: false, error: "رقم التتبع مفقود" };

  var rIndex = findRowIndex(sheets.orders, "tracking", tracking);
  if (rIndex === -1) return { ok: false, error: "الأوردر المطلوب غير موجود بالشيت" };

  var updateObj = {
    "موقع العميل/الخريطة": lat + "," + lng,
    "updatedAt": now()
  };

  updateRowByObject(sheets.orders, rIndex, updateObj);
  return { 
    ok: true, 
    msg: "نجحت محاكاة استقبال اللوكيشن للعميل بالواتس تفاعلياً وتحديث شيت جوجل مباشرة",
    customerLocation: lat + "," + lng
  };
}

function saveSupplier(sheets, d) {
  var name = d.name;
  var phone = d.phone;
  var price = d.price;
  var notes = d.notes;
  var openingBalance = d.openingBalance;

  if (!name) return { ok: false, error: "اسم المورد مطلوب" };

  var rowIndex = findRowIndex(sheets.suppliers, "name", name);
  var headers = ["name", "phone", "price", "notes", "openingBalance"];

  var updateObj = {
    name: name,
    phone: phone || "",
    price: Number(price || 0),
    notes: notes || "",
    openingBalance: Number(openingBalance || 0)
  };

  if (rowIndex !== -1) {
    updateRowByObject(sheets.suppliers, rowIndex, updateObj);
  } else {
    appendToSheet(sheets.suppliers, headers, updateObj);
  }

  return { ok: true, msg: "تم حفظ وتحديث بيانات المورد بنجاح ✓" };
}

function closeCourierMonth(sheets, d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var courier = d.courier;
    var todayDate = d.todayDate;
    var currentUser = d.currentUser || "إدارة";
    
    if (!courier) return { ok: false, error: "المندوب غير محدد" };

    var nowCairoStr = now();
    var searchCourier = courier.toString().trim().toLowerCase();

    // 1. Move all live orders for this courier to archivedOrders sheet and mark isSettledMonth = "true"
    var ordersSheet = sheets.orders;
    var ordersLastRow = ordersSheet.getLastRow();
    if (ordersLastRow > 1) {
      var ordersHeaders = ordersSheet.getRange(1, 1, 1, ordersSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
      var ordersData = ordersSheet.getRange(1, 1, ordersLastRow, ordersSheet.getLastColumn()).getValues();

      var courierIdx = ordersHeaders.indexOf("courier");
      
      if (courierIdx !== -1) {
        // Process from bottom to top so deletion indices remain stable
        for (var r = ordersData.length - 1; r >= 1; r--) {
          var rowCourier = ordersData[r][courierIdx] ? ordersData[r][courierIdx].toString().trim() : "";
          if (rowCourier.toLowerCase() === searchCourier) {
            // Build object representation of this order row
            var orderObj = {};
            for (var c = 0; c < ordersHeaders.length; c++) {
              if (ordersHeaders[c]) {
                orderObj[ordersHeaders[c]] = ordersData[r][c];
              }
            }
            orderObj["isSettled"] = "true";
            orderObj["is_settled"] = "true";
            orderObj["isSettledMonth"] = "true";
            orderObj["updatedAt"] = nowCairoStr;

            var archHeaders = sheets.archivedOrders.getRange(1, 1, 1, sheets.archivedOrders.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
            appendToSheet(sheets.archivedOrders, archHeaders, orderObj);
            ordersSheet.deleteRow(r + 1);
          }
        }
      }
    }

    // 2. Set isSettledMonth = "true" on any already archived orders for this courier
    var archiveSheet = sheets.archivedOrders;
    var archLastRow = archiveSheet.getLastRow();
    if (archLastRow > 1) {
      var archHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
      var archData = archiveSheet.getRange(1, 1, archLastRow, archiveSheet.getLastColumn()).getValues();
      var archCourierIdx = archHeaders.indexOf("courier");
      var archIsSettledMonthIdx = archHeaders.indexOf("isSettledMonth");

      if (archCourierIdx !== -1 && archIsSettledMonthIdx !== -1) {
        for (var r = 1; r < archData.length; r++) {
          var rowCourier = archData[r][archCourierIdx] ? archData[r][archCourierIdx].toString().trim() : "";
          if (rowCourier.toLowerCase() === searchCourier) {
            archiveSheet.getRange(r + 1, archIsSettledMonthIdx + 1).setValue("true");
          }
        }
      }
    }

    // 3. Mark cashbox handovers for this courier as settled
    var cashboxSheet = sheets.cashbox;
    var cbLastRow = cashboxSheet.getLastRow();
    if (cbLastRow > 1) {
      var cbHeaders = cashboxSheet.getRange(1, 1, 1, cashboxSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
      var cbData = cashboxSheet.getRange(1, 1, cbLastRow, cashboxSheet.getLastColumn()).getValues();
      var cbTypeIdx = cbHeaders.indexOf("type");
      var cbRefIdx = cbHeaders.indexOf("ref");
      var cbIsSettledMonthIdx = cbHeaders.indexOf("isSettledMonth");

      if (cbTypeIdx !== -1 && cbRefIdx !== -1 && cbIsSettledMonthIdx !== -1) {
        for (var r = 1; r < cbData.length; r++) {
          var rowType = cbData[r][cbTypeIdx] ? cbData[r][cbTypeIdx].toString().trim() : "";
          var rowRef = cbData[r][cbRefIdx] ? cbData[r][cbRefIdx].toString().trim() : "";
          if (rowType === "استلام عهدة مندوب" && rowRef.toLowerCase() === searchCourier) {
            cashboxSheet.getRange(r + 1, cbIsSettledMonthIdx + 1).setValue("true");
          }
        }
      }
    }

    // 4. Mark expenses for this courier as settled
    var expensesSheet = sheets.expenses;
    var expLastRow = expensesSheet.getLastRow();
    if (expLastRow > 1) {
      var expHeaders = expensesSheet.getRange(1, 1, 1, expensesSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
      var expData = expensesSheet.getRange(1, 1, expLastRow, expensesSheet.getLastColumn()).getValues();
      var expByIdx = expHeaders.indexOf("addedBy");
      var expIsSettledMonthIdx = expHeaders.indexOf("isSettledMonth");

      if (expByIdx !== -1 && expIsSettledMonthIdx !== -1) {
        for (var r = 1; r < expData.length; r++) {
          var rowBy = expData[r][expByIdx] ? expData[r][expByIdx].toString().trim() : "";
          if (rowBy.toLowerCase() === searchCourier) {
            expensesSheet.getRange(r + 1, expIsSettledMonthIdx + 1).setValue("true");
          }
        }
      }
    }

    // 5. Mark courier ledger adjustments as settled
    var ledgerSheet = sheets.courierLedger;
    var ledLastRow = ledgerSheet.getLastRow();
    if (ledLastRow > 1) {
      var ledHeaders = ledgerSheet.getRange(1, 1, 1, ledgerSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });
      var ledData = ledgerSheet.getRange(1, 1, ledLastRow, ledgerSheet.getLastColumn()).getValues();
      var ledCourierIdx = ledHeaders.indexOf("courier");
      var ledIsSettledMonthIdx = ledHeaders.indexOf("isSettledMonth");

      if (ledCourierIdx !== -1 && ledIsSettledMonthIdx !== -1) {
        for (var r = 1; r < ledData.length; r++) {
          var rowCourier = ledData[r][ledCourierIdx] ? ledData[r][ledCourierIdx].toString().trim() : "";
          if (rowCourier.toLowerCase() === searchCourier) {
            ledgerSheet.getRange(r + 1, ledIsSettledMonthIdx + 1).setValue("true");
          }
        }
      }
    }

    // 6. Update last_closing_date in couriers sheet
    var couriersSheet = sheets.couriers;
    var cIndex = findRowIndex(couriersSheet, "name", courier);
    if (cIndex !== -1) {
      couriersSheet.getRange(cIndex, 10).setValue(todayDate || "");
    }

    // 7. Audit Log Entry
    appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
      user: currentUser,
      type: "تقفيل كشف حساب شهري للمندوب",
      dateTime: nowCairoStr,
      oldVal: "—",
      newVal: "تم تصفير وترحيل كشف المندوب: " + courier + " لشهر جديد وتعيين تاريخ الإقفال: " + todayDate,
      reason: "تأكيد الإقفال المالي الشهري وبدء فترة محاسبية جديدة"
    });

    return { ok: true, msg: "تم تقفيل شهر المندوب بنجاح ✓" };

  } catch(err) {
    return { ok: false, error: err.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getWithdrawalRequests(sheets) {
  try {
    const data = getTableData(sheets.withdrawalRequests) || [];
    return { ok: true, requests: data };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function requestWithdrawal(sheets, d) {
  try {
    const { supplier, amount, paymentMethod } = d;
    if (!supplier || !amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return { ok: false, error: "المبلغ المطلوب غير صحيح أو يجب أن يكون أكبر من الصفر." };
    }
    const val = Number(amount);

    // Calculate current outstanding balance
    const calc = calculateSupplierBalance(sheets, supplier);
    const balance = calc.outstanding;

    // Prevent request if amount exceeds outstanding balance
    if (val > balance) {
      return { ok: false, error: "المبلغ المطلوب (" + val + " ج.م) يتجاوز رصيدك المستحق الحالي (" + balance + " ج.م)" };
    }

    // Generate random unique ID
    const reqId = "WDR-" + Math.floor(100000 + Math.random() * 900000);

    appendToSheet(sheets.withdrawalRequests, ["id", "date", "supplier", "amount", "paymentMethod", "status", "notes"], {
      id: reqId,
      date: now(),
      supplier: supplier,
      amount: val,
      paymentMethod: paymentMethod || "",
      status: "معلق",
      notes: ""
    });

    return { ok: true, message: "تم تقديم طلب سحب الرصيد بنجاح وهو قيد المراجعة حالياً." };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function approveWithdrawal(sheets, d) {
  try {
    const { id, currentUser } = d;
    if (!id) return { ok: false, error: "معرف الطلب مفقود" };

    const rowIndex = findRowIndex(sheets.withdrawalRequests, "id", id);
    if (rowIndex === -1) {
      return { ok: false, error: "لم يتم العثور على طلب السحب" };
    }

    const requests = getTableData(sheets.withdrawalRequests) || [];
    const req = requests.find(r => r.id === id);
    if (!req) {
      return { ok: false, error: "لم يتم العثور على تفاصيل الطلب" };
    }

    if (req.status !== "معلق") {
      return { ok: false, error: "هذا الطلب تم معالجته مسبقاً وحالته الحالية: " + req.status };
    }

    const supplierName = req.supplier;
    const amount = Math.abs(Number(req.amount || 0));

    // Deduct from supplier ledger
    appendToSheet(sheets.supplierLedger, ["supplier", "date", "type", "tracking", "amount", "desc"], {
      supplier: supplierName,
      date: now(),
      type: "دفع نقدي",
      tracking: id,
      amount: -amount, // MUST BE NEGATIVE [-] for payout
      desc: "سحب رصيد مقبول (معرف الطلب: #" + id + ") عبر وسيلة الدفع: " + (req.paymentMethod || "")
    });

    // Add to cashbox
    appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
      date: now(),
      desc: "سحب رصيد مقبول (معرف الطلب: #" + id + ") للمورد: " + supplierName,
      type: "سداد مورد",
      amount: amount,
      ref: id,
      addedBy: currentUser || "إدارة الحسابات"
    });

    // Change status of the request to "مقبول"
    updateRowByObject(sheets.withdrawalRequests, rowIndex, {
      status: "مقبول",
      notes: "تم الموافقة والتحويل بواسطة " + (currentUser || "الأدمن") + " في " + now()
    });

    // Add audit log entry
    appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
      user: currentUser || "حسابات",
      type: "قبول طلب سحب رصيد مورد",
      dateTime: now(),
      oldVal: "معلق",
      newVal: "مقبول - تم التحويل بقيمة " + amount + " ج.م للمورد " + supplierName,
      reason: "موافقة الأدمن وصرف المبلغ من الخزينة"
    });

    return { ok: true, msg: "تمت الموافقة على طلب السحب رقم " + id + " بنجاح، وتم خصم " + amount + " ج.م من كشف حساب المورد وصرفه من الخزينة." };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function rejectWithdrawal(sheets, d) {
  try {
    const { id, reason, currentUser } = d;
    if (!id) return { ok: false, error: "معرف الطلب مفقود" };

    const rowIndex = findRowIndex(sheets.withdrawalRequests, "id", id);
    if (rowIndex === -1) {
      return { ok: false, error: "لم يتم العثور على طلب السحب" };
    }

    const requests = getTableData(sheets.withdrawalRequests) || [];
    const req = requests.find(r => r.id === id);
    if (!req) {
      return { ok: false, error: "لم يتم العثور على تفاصيل الطلب" };
    }

    if (req.status !== "معلق") {
      return { ok: false, error: "هذا الطلب تم معالجته مسبقاً وحالته الحالية: " + req.status };
    }

    updateRowByObject(sheets.withdrawalRequests, rowIndex, {
      status: "مرفوض",
      notes: (reason || "تم الرفض من الإدارة") + " (بواسطة " + (currentUser || "الأدمن") + " في " + now() + ")"
    });

    // Add audit log entry
    appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
      user: currentUser || "حسابات",
      type: "رفض طلب سحب رصيد مورد",
      dateTime: now(),
      oldVal: "معلق",
      newVal: "مرفوض - سبب الرفض: " + (reason || "تم الرفض من الإدارة"),
      reason: "رفض الإدارة لطلب سحب الرصيد"
    });

    return { ok: true, msg: "تم رفض طلب السحب رقم " + id + " بنجاح." };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

function instantCourierSettlement(sheets, d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    var courier = d.courier;
    var cashAmount = d.cashAmount;
    var commissionAmount = d.commissionAmount;
    var adjustmentType = d.adjustmentType;
    var adjustmentAmount = d.adjustmentAmount;
    var adjustmentDesc = d.adjustmentDesc;
    var currentUser = d.currentUser;

    if (!courier) return { ok: false, error: "المندوب غير محدد" };

    var nowCairoStr = now();

    // 1. If cashAmount > 0, record deposit in cashbox (Main Treasury)
    var cashVal = Number(cashAmount || 0);
    if (cashVal > 0) {
      appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
        date: nowCairoStr,
        desc: "تصفية كاش وإغلاق العهدة اليومية للمندوب: " + courier,
        type: "استلام عهدة مندوب",
        amount: cashVal,
        ref: courier,
        addedBy: currentUser || "إدارة الحسابات"
      });
    }

    // 2. Record commissions earned in courierLedger as a positive entry
    var commVal = Number(commissionAmount || 0);
    if (commVal > 0) {
      appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
        courier: courier,
        date: nowCairoStr,
        type: "عمولة توصيل",
        tracking: "—",
        amount: commVal,
        desc: "إجمالي العمولات المستحقة لليوم المصفى"
      });
    }

    // 3. Record adjustment if adjustmentAmount > 0
    var adjVal = Number(adjustmentAmount || 0);
    if (adjVal > 0 && adjustmentType) {
      appendToSheet(sheets.courierLedger, ["courier", "date", "type", "tracking", "amount", "desc"], {
        courier: courier,
        date: nowCairoStr,
        type: adjustmentType,
        tracking: "—",
        amount: adjustmentType === "جزاء" ? -adjVal : adjVal,
        desc: adjustmentDesc || ("تسوية يدوية مصاحبة للتصفية اليومية - " + adjustmentType)
      });

      if (adjustmentType === "مكافأة") {
        appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
          date: nowCairoStr,
          desc: "مكافأة منصرفة للمندوب مصاحبة للتصفية اليومية: " + courier + " - " + (adjustmentDesc || ""),
          type: "صرف",
          amount: adjVal,
          ref: "BONUS",
          addedBy: currentUser || "إدارة الحسابات"
        });
      } else if (adjustmentType === "جزاء") {
        appendToSheet(sheets.cashbox, ["date", "desc", "type", "amount", "ref", "addedBy"], {
          date: nowCairoStr,
          desc: "تسوية خصم/جزاء مستقطع مصاحب للتصفية اليومية للمندوب: " + courier + " - " + (adjustmentDesc || ""),
          type: "استلام عهدة مندوب",
          amount: adjVal,
          ref: "PENALTY",
          addedBy: currentUser || "إدارة الحسابات"
        });
      }
    }

    // 4. Now perform logical status settlement and archiving of active orders in Google Sheets
    var sheet = sheets.orders;
    var lastRow = sheet.getLastRow();
    var settledCount = 0;

    if (lastRow > 1) {
      var lastCol = sheet.getLastColumn();
      var dataRange = sheet.getRange(1, 1, lastRow, lastCol);
      var data = dataRange.getValues();
      var headers = data[0].map(function(h) { return h ? h.toString().trim() : ""; });

      var trackingIdx = headers.indexOf("tracking");
      var courierIdx = headers.indexOf("courier");
      var statusIdx = headers.indexOf("status");
      var commissionIdx = headers.indexOf("commission");
      var lastCourierIdx = headers.indexOf("lastCourier");
      var lastCommissionIdx = headers.indexOf("lastCommission");
      var courierSignatureIdx = headers.indexOf("courierSignature");
      var updatedAtIdx = headers.indexOf("updatedAt");
      var isSettledIdx = headers.indexOf("isSettled");
      var is_settledIdx = headers.indexOf("is_settled");
      var partialAmountIdx = headers.indexOf("partialAmount");
      var actualReceivedCashIdx = headers.indexOf("actualReceivedCash");

      if (trackingIdx !== -1 && courierIdx !== -1 && statusIdx !== -1) {
        var searchCourier = courier.toString().trim().toLowerCase();
        var archiveSheet = sheets.archivedOrders;
        var archiveHeaders = archiveSheet.getRange(1, 1, 1, archiveSheet.getLastColumn()).getValues()[0].map(function(h) { return h ? h.toString().trim() : ""; });

        for (var r = data.length - 1; r >= 1; r--) {
          var rowCourier = data[r][courierIdx] ? data[r][courierIdx].toString().trim() : "";
          if (rowCourier.toLowerCase() === searchCourier) {
            var trackingVal = data[r][trackingIdx] ? data[r][trackingIdx].toString().trim() : "";
            var oldStatus = data[r][statusIdx] ? data[r][statusIdx].toString().trim() : "";
            var oldCommission = data[r][commissionIdx] ? Number(data[r][commissionIdx] || 0) : 0;
            var rowIndex = r + 1;

            var rowDataMap = {};
            for (var c = 0; c < headers.length; c++) {
              if (headers[c]) {
                rowDataMap[headers[c]] = data[r][c];
              }
            }

            rowDataMap["lastCourier"] = rowCourier;
            rowDataMap["lastCommission"] = oldCommission;

            var nextStatus = oldStatus;
            if (oldStatus === "مرتجع" || oldStatus === "مرتجع جديد") {
              nextStatus = "مرتجع بالمستودع";
              rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية المرتجع الميداني ✍️)";
            } else if (oldStatus === "تسليم جزئي" || oldStatus === "مرتجع جزئي" || oldStatus === "تسليم جزئي - معلق للجرد") {
              nextStatus = "مرتجع جزئي بالمستودع";
              rowDataMap["returnReason"] = "مرتجع جزئي متبقي";
              rowDataMap["returnSubStatus"] = "بضاعة متبقية من تسليم جزئي";
              rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية المرتجع الجزئي ✍️)";
            } else if (oldStatus === "مؤجل" || oldStatus === "Delayed" || oldStatus === "مؤجل من المندوب" || oldStatus === "مؤجل بناءً على طلب العميل") {
              nextStatus = "مؤجل بالمستودع";
              rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية المؤجل ✍️)";
            } else if (oldStatus === "لا يوجد رد" || oldStatus === "العميل لا يرد" || oldStatus === "No Answer" || oldStatus === "العميل لم يقم بالرد") {
              nextStatus = "لا يوجد رد بالمستودع";
              rowDataMap["courierSignature"] = rowCourier + " (توقيع تصفية عدم الرد ✍️)";
            }

            rowDataMap["status"] = nextStatus;
            var isSuccessfullyClosed = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي"].indexOf(oldStatus) !== -1;
            var shouldArchive = (nextStatus === "تم التسليم" || nextStatus === "تم التسليم بنجاح" || nextStatus === "تم التسليم (ناجح كاش)" || nextStatus === "التسليم للمورد" || nextStatus === "تم تسليم المرتجع للمورد");

            if (isSuccessfullyClosed) {
              rowDataMap["isSettled"] = "true";
              rowDataMap["is_settled"] = "true";
              if (!shouldArchive) {
                rowDataMap["courier"] = "";
                rowDataMap["commission"] = 0;
              }
            } else {
              rowDataMap["courier"] = "";
              rowDataMap["commission"] = 0;
              rowDataMap["isSettled"] = "false";
              rowDataMap["is_settled"] = "false";
            }
            rowDataMap["updatedAt"] = nowCairoStr;

            // Record status history event
            appendToSheet(sheets.statusHistory, ["tracking", "oldStatus", "newStatus", "updatedBy", "dateTime"], {
              tracking: trackingVal,
              oldStatus: oldStatus,
              newStatus: nextStatus,
              updatedBy: currentUser || "إدارة",
              dateTime: nowCairoStr
            });

            if (shouldArchive) {
              var archiveRowValues = [];
              for (var h = 0; h < archiveHeaders.length; h++) {
                var headerName = archiveHeaders[h];
                var val = rowDataMap[headerName] !== undefined ? rowDataMap[headerName] : "";
                archiveRowValues.push(val);
              }
              archiveSheet.appendRow(archiveRowValues);
              
              var lastArchRow = archiveSheet.getLastRow();
              var trColIdx = archiveHeaders.indexOf("tracking") + 1;
              var confirmTracking = "";
              if (trColIdx > 0 && lastArchRow > 0) {
                confirmTracking = archiveSheet.getRange(lastArchRow, trColIdx).getValue().toString().trim();
              }

              if (confirmTracking.toUpperCase() === trackingVal.toUpperCase()) {
                sheet.deleteRow(rowIndex);
                settledCount++;
              } else {
                updateRowByObject(sheet, rowIndex, rowDataMap);
              }
            } else {
              updateRowByObject(sheet, rowIndex, rowDataMap);
            }
          }
        }
      }
    }

    // Write audit log entry
    appendToSheet(sheets.auditLog, ["user", "type", "dateTime", "oldVal", "newVal", "reason"], {
      user: currentUser || "إدارة الحسابات",
      type: "تصفية عهدة يومية فورية",
      dateTime: nowCairoStr,
      oldVal: "عامل: " + courier,
      newVal: "كاش: " + cashVal + " | عمولة: " + commVal,
      reason: "اعتماد تصفية الحساب وإغلاق العهدة اليومية"
    });

    return { 
      ok: true, 
      settled: settledCount, 
      msg: "✅ تم اعتماد تصفية الحساب وإغلاق العهدة اليومية للمندوب بنجاح! تم إيداع مبلغ " + cashVal + " ج.م بالخزنة كأثر فوري، وتصفير العداد لليوم الجديد."
    };

  } catch (e) {
    return { ok: false, error: "خطأ في سكريبت جوجل شيت أثناء التصفية الفورية: " + e.toString() };
  } finally {
    lock.releaseLock();
  }
}

function getStaffPermissions(sheets, d) {
  var list = getTableData(sheets.staffPermissions) || [];
  var cleanRole = d ? (d.currentRole || "").toString().trim() : "";
  var isAdmin = cleanRole === "مدير";
  
  // Salary protection: Hide salary from non-admins
  var safeList = list.map(function(item) {
    var copy = {};
    for (var k in item) {
      if (k === "salary" && !isAdmin) {
        copy[k] = ""; // strip salary
      } else {
        copy[k] = item[k];
      }
    }
    return copy;
  });
  
  return { ok: true, staff: safeList };
}

function saveStaffPermissions(sheets, d) {
  var staff = d.staff || {};
  if (!staff.name) return { ok: false, error: "اسم الموظف مفقود" };
  
  // Find or create in staff_permissions
  var staffIdx = findRowIndex(sheets.staffPermissions, "name", staff.name);
  if (staffIdx === -1) {
    appendToSheet(sheets.staffPermissions, ["name", "phone", "role", "salary", "perm_dashboard", "perm_orders", "perm_ledger", "perm_expenses", "perm_staff", "supervisor_id"], staff);
  } else {
    updateRowByObject(sheets.staffPermissions, staffIdx, staff);
  }
  
  // Make sure they have a matching login user in `users`
  var userIdx = findRowIndex(sheets.users, "name", staff.name);
  var userObj = {
    name: staff.name,
    role: staff.role,
    active: "نعم",
    pass: hashPassword(d.pass || "123456"), // default password if brand new
    email: staff.name + "@friendplus.com",
    perms: getPermissionsStringForStaff(staff)
  };
  
  if (userIdx === -1) {
    appendToSheet(sheets.users, ["name", "role", "pass", "active", "email", "perms"], userObj);
  } else {
    var updateObj = {
      role: staff.role,
      perms: getPermissionsStringForStaff(staff)
    };
    if (d.pass) {
      updateObj.pass = hashPassword(d.pass);
    }
    updateRowByObject(sheets.users, userIdx, updateObj);
  }

  // Also update or create courier profile if the role is "مندوب"
  var roleLower = (staff.role || "").toString().toLowerCase();
  if (roleLower === "مندوب" || roleLower.indexOf("مندوب") > -1) {
    var courierIdx = findRowIndex(sheets.couriers, "name", staff.name);
    var courierObj = {
      name: staff.name,
      phone: staff.phone,
      salary: staff.salary || 3000,
      base_fixed_salary: staff.salary || 3000,
      commission: 25,
      commission_success: 25,
      commission_return: 10,
      region: "—"
    };
    if (courierIdx === -1) {
      appendToSheet(sheets.couriers, ["name", "phone", "commission", "salary", "region", "base_fixed_salary", "commission_success", "commission_return", "hire_date", "last_closing_date"], courierObj);
    } else {
      updateRowByObject(sheets.couriers, courierIdx, {
        phone: staff.phone,
        salary: staff.salary || 3000,
        base_fixed_salary: staff.salary || 3000
      });
    }
  }

  return { ok: true, msg: "تم حفظ وتحديث بيانات وصلاحيات الموظف بنجاح" };
}

function getPermissionsStringForStaff(staff) {
  var p = [];
  if (staff.perm_dashboard === "true" || staff.perm_dashboard === true) p.push("لوحة القيادة");
  if (staff.perm_orders === "true" || staff.perm_orders === true) p.push("الطلبات");
  if (staff.perm_ledger === "true" || staff.perm_ledger === true) p.push("الحسابات");
  if (staff.perm_expenses === "true" || staff.perm_expenses === true) p.push("المصاريف");
  if (staff.perm_staff === "true" || staff.perm_staff === true) p.push("الموظفين");
  return p.join(" · ") || "صلاحيات أساسية";
}
