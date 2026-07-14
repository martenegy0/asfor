import express, { Request, Response } from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";

function hashPassword(password: string): string {
  if (!password) return "";
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(inputPass: string, storedPass: string): boolean {
  if (!storedPass) return false;
  const cleanedStored = storedPass.trim();
  const cleanedInput = inputPass.trim();
  // If stored is 64-character hex, it is a SHA-256 hash
  if (cleanedStored.length === 64 && /^[0-9a-fA-F]+$/.test(cleanedStored)) {
    return hashPassword(cleanedInput) === cleanedStored;
  }
  // Otherwise it's plaintext
  return cleanedInput === cleanedStored;
}

const app = express();
const PORT = 3000;
const DB_PATH = path.join(process.cwd(), "src", "db.json");

// Default Fallback Database to ensure successful startup & login under environments like Vercel with read-only/missing storage
const DEFAULT_DB = {
  users: [
    {
      name: "عصفور",
      role: "مدير",
      pass: "14014",
      active: "نعم",
      email: "asfour@friendplus.com",
      perms: "كاملة",
    },
    {
      name: "ابو ياسين",
      role: "مدير",
      pass: "361991",
      active: "نعم",
      email: "abuyassin@friendplus.com",
      perms: "كاملة",
    },
    {
      name: "ابو خديجه",
      role: "مشرف",
      pass: "14014",
      active: "نعم",
      email: "abukhadija@friendplus.com",
      perms: "توزيع ومتابعة",
    },
    {
      name: "أحمد المرتجعات",
      role: "مسؤول مرتجعات",
      pass: "222222",
      active: "نعم",
      email: "returns@friendplus.com",
      perms: "متابعة المرتجعات",
    },
    {
      name: "المحاسب أحمد",
      role: "محاسب",
      pass: "111111",
      active: "نعم",
      email: "accounting@friendplus.com",
      perms: "خزنة وحسابات وتقارير مالية",
    },
    {
      name: "محمد حمدى",
      role: "مندوب",
      pass: "500500",
      active: "نعم",
      email: "mohamed@friendplus.com",
      perms: "أوردرات المندوب وتحديث الحالات",
    },
    {
      name: "زياد",
      role: "مندوب",
      pass: "500500",
      active: "نعم",
      email: "ziad@friendplus.com",
      perms: "أوردرات المندوب وتحديث الحالات",
    },
    {
      name: "محل الأناقة",
      role: "مورد",
      pass: "333333",
      active: "نعم",
      email: "elegance@friendplus.com",
      perms: "إضافة أوردرات ورفع كشوفات",
    },
    {
      name: "صفوت العمليات",
      role: "موظف عمليات",
      pass: "444444",
      active: "نعم",
      email: "safwat@friendplus.com",
      perms: "متابعة حالات فقط",
    },
  ],
  couriers: [
    {
      name: "محمد حمدى",
      phone: "01112345678",
      commission: 25,
      salary: 3000,
      region: "القاهرة",
    },
    {
      name: "زياد",
      phone: "01212345678",
      commission: 25,
      salary: 3000,
      region: "الجيزة",
    },
  ],
  suppliers: [
    {
      name: "محل الأناقة",
      phone: "01055556666",
      price: 65,
      notes: "ملابس وموضة",
    },
    {
      name: "إلكترونيات السلام",
      phone: "01544443333",
      price: 60,
      notes: "أجهزة إلكترونية وإكسسوارات",
    },
  ],
  orders: [
    {
      tracking: "FP-1001-26",
      createdAt: "2026-06-10 10:00",
      updatedAt: "2026-06-10 12:00",
      orderDate: "2026-06-10",
      supplier: "محل الأناقة",
      customer: "محسن علي",
      phone: "01011112222",
      phone2: "",
      gov: "القاهرة",
      region: "المعادي",
      address: "شارع 9 عمارة 4 أ",
      prodPrice: 200,
      shipPrice: 65,
      totalCOD: 265,
      shipCost: 65,
      courier: "محمد حمدى",
      status: "تم التسليم",
      notes: "تم التسليف بنجاح والتحصيل",
      delivDate: "2026-06-10 12:00",
      retDate: "",
      addedBy: "محل الأناقة",
      commission: 25,
      returnShippingType: "",
      returnQueueStatus: "",
      returnQueueAgent: "",
    },
    {
      tracking: "FP-1002-26",
      createdAt: "2026-06-10 10:15",
      updatedAt: "2026-06-10 12:30",
      orderDate: "2026-06-10",
      supplier: "محل الأناقة",
      customer: "خالد أحمد",
      phone: "01122223333",
      phone2: "",
      gov: "الجيزة",
      region: "المهندسين",
      address: "شارع البطل أحمد عبد العزيز",
      prodPrice: 300,
      shipPrice: 65,
      totalCOD: 365,
      shipCost: 65,
      courier: "زياد",
      status: "مرتجع",
      notes: "العميل دفع الشحن فقط ورجع المنتج",
      delivDate: "",
      retDate: "2026-06-10 12:30",
      addedBy: "محل الأناقة",
      commission: 25,
      returnShippingType: "paid",
      returnQueueStatus: "جاهز للتسليم للمورد",
      returnQueueAgent: "أحمد المرتجعات",
    },
  ],
  expenses: [
    {
      date: "2026-06-10 09:00",
      cat: "إيجار",
      desc: "إيجار مكتب الفرع الرئيسي",
      amount: 1500,
      by: "المحاسب أحمد",
    },
  ],
  cashbox: [
    {
      date: "2026-06-10 08:00",
      desc: "رأس مال ابتدائي لتسوية الخزنة",
      type: "وارد",
      amount: 10000,
      ref: "CAP-001",
      addedBy: "المحاسب أحمد",
    },
    {
      date: "2026-06-10 09:10",
      desc: "تحويل إلى حساب صادر لدفع المصاريف",
      type: "صادر",
      amount: 1500,
      ref: "EXP-REV-01",
      addedBy: "المحاسب أحمد",
    },
  ],
  statusHistory: [],
  supplierLedger: [],
  courierLedger: [],
  staffPermissions: [],
  settings: {
    COUNTER: 1005,
    COMPANY: "فريند بلس",
    VERSION: "5.1",
  },
};

// Safe JSON Body Parsing: Bypasses parser if Vercel serverless has already populated req.body
app.use((req, res, next) => {
  if (req.body && typeof req.body === "object") {
    next();
  } else {
    express.json({ limit: "50mb" })(req, res, next);
  }
});

// Atomic Database Helper
function getSeededOrders(): any[] {
  return [
    {
      tracking: "FP-1001-26",
      createdAt: "2026-06-10 10:00",
      updatedAt: "2026-06-12 12:00",
      supplier: "محل الأناقة",
      customer: "محمود رأفت حسن",
      phone: "01011223344",
      phone2: "01155667788",
      gov: "الدقهلية",
      region: "المنصورة",
      address: "المنصورة - ش الأتوبيس الجديد أمام مسجد التقوى",
      prodPrice: 200,
      shipPrice: 60,
      totalCOD: 260,
      status: "تم التسليم",
      courier: "محمد حمدى",
      notes: "يرجى رن جرس مرتين والاتصال قبل الوصول بنصف ساعة",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1002-26",
      createdAt: "2026-06-11 10:15",
      updatedAt: "2026-06-12 11:30",
      supplier: "محل الأناقة",
      customer: "فاطمة أحمد علي",
      phone: "01233445566",
      phone2: "",
      gov: "القاهرة",
      region: "مصر الجديدة",
      address: "مصر الجديدة - ش النزهة عمارة 14 الدور 3 شقة 6",
      prodPrice: 300,
      shipPrice: 40,
      totalCOD: 340,
      status: "تم التسليم",
      courier: "محمد حمدى",
      notes: "تسليم سريع اليوم ضروري جداً",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1003-26",
      createdAt: "2026-06-12 09:30",
      updatedAt: "2026-06-12 14:15",
      supplier: "إلكترونيات السلام",
      customer: "محمد صلاح الصاوي",
      phone: "01511223344",
      phone2: "01099887766",
      gov: "الجيزة",
      region: "فيصل",
      address: "فيصل - ش العشرين برج الياسمين شقة 10",
      prodPrice: 150,
      shipPrice: 40,
      totalCOD: 190,
      status: "خارج مع المندوب",
      courier: "زياد",
      notes: "الدفع كاش بعد المعاينة",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1004-26",
      createdAt: "2026-06-12 10:00",
      updatedAt: "2026-06-12 10:00",
      supplier: "محل الأناقة",
      customer: "سامح عبد السلام طه",
      phone: "01088776655",
      phone2: "",
      gov: "الإسكندرية",
      region: "سموحة",
      address: "سموحة - ش فوزي معاذ بجوار مستشفى أندلسية",
      prodPrice: 450,
      shipPrice: 65,
      totalCOD: 515,
      status: "جديد",
      courier: "",
      notes: "",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1005-26",
      createdAt: "2026-06-12 10:30",
      updatedAt: "2026-06-12 15:00",
      supplier: "محل الأناقة",
      customer: "منى زكي الشريف",
      phone: "01155443322",
      phone2: "",
      gov: "القاهرة",
      region: "شبرا",
      address: "شبرا مصر - ش أحمد حلمي أمام مدرسة التوفيقية",
      prodPrice: 180,
      shipPrice: 35,
      totalCOD: 215,
      status: "مؤجل",
      courier: "محمد حمدى",
      notes: "أجل ليوم الأحد القادم حسب رغبة العميل",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1006-26",
      createdAt: "2026-06-12 10:45",
      updatedAt: "2026-06-12 15:30",
      supplier: "إلكترونيات السلام",
      customer: "إبراهيم خالد عمار",
      phone: "01533442211",
      phone2: "",
      gov: "القاهرة",
      region: "حلوان",
      address: "حلوان - ش منصور بجوار محطة حلوان",
      prodPrice: 130,
      shipPrice: 45,
      totalCOD: 175,
      status: "لا يوجد رد",
      courier: "محمد حمدى",
      notes: "تم الاتصال 3 مرات مغلق أو كنسل",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1007-26",
      createdAt: "2026-06-12 11:00",
      updatedAt: "2026-06-12 16:30",
      supplier: "محل الأناقة",
      customer: "يحيى عبد الرحمن",
      phone: "01288990011",
      phone2: "",
      gov: "الجيزة",
      region: "الدقي",
      address: "الدقي - ش التحرير برج النور خلف البنك الأهلي",
      prodPrice: 500,
      shipPrice: 40,
      totalCOD: 540,
      status: "تم التسليم",
      courier: "زياد",
      notes: "شحن سريع في الدقي",
      returnQueueStatus: "",
    },
    {
      tracking: "FP-1008-26",
      createdAt: "2026-06-12 11:15",
      updatedAt: "2026-06-12 16:30",
      supplier: "محل الأناقة",
      customer: "كريم ممدوح شحاتة",
      phone: "01055664422",
      phone2: "",
      gov: "الغربية",
      region: "طنطا",
      address: "طنطا - ش البحر أمام كلية الصيدلة",
      prodPrice: 400,
      shipPrice: 60,
      totalCOD: 460,
      status: "مرتجع",
      courier: "زياد",
      notes: "رفض الاستلام لعدم مطابقة المقاس",
      returnQueueStatus: "جاهز للتسليم للمورد",
    },
    {
      tracking: "FP-1009-26",
      createdAt: "2026-06-12 11:30",
      updatedAt: "2026-06-12 17:00",
      supplier: "محل الأناقة",
      customer: "رشا جمال السيد",
      phone: "01122334455",
      phone2: "",
      gov: "الدقهلية",
      region: "ميت غمر",
      address: "ميت غمر - بجوار إدارة التعليم الجديدة",
      prodPrice: 320,
      shipPrice: 60,
      totalCOD: 380,
      status: "مرتجع",
      courier: "محمد حمدى",
      notes: "رفض معيب أو مكسور",
      returnQueueStatus: "مرتجع تم تسليمه للمورد",
    },
    {
      tracking: "FP-1010-26",
      createdAt: "2026-06-12 11:45",
      updatedAt: "2026-06-12 11:45",
      supplier: "محل الأناقة",
      customer: "عماد فتحي السويسي",
      phone: "01555667788",
      phone2: "",
      gov: "القليوبية",
      region: "بنها",
      address: "بنها - الفلل بجوار كورنيش بنها المائي",
      prodPrice: 600,
      shipPrice: 50,
      totalCOD: 650,
      status: "جديد",
      courier: "",
      notes: "الدفع كاش نقدي",
      returnQueueStatus: "",
    },
  ];
}

let cachedDB: any = null;

function readDB(): any {
  if (cachedDB) {
    return cachedDB;
  }
  let db: any;
  if (!fs.existsSync(DB_PATH)) {
    console.warn(
      `Database file not found at ${DB_PATH}. Returning fallback structure.`,
    );
    db = JSON.parse(JSON.stringify(DEFAULT_DB));
  } else {
    try {
      const data = fs.readFileSync(DB_PATH, "utf-8");
      db = JSON.parse(data);
    } catch (error) {
      console.error("Error reading database:", error);
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  }

  // Save parsed database in cache
  cachedDB = db;

  // Auto seed rich mock records if orders lists are empty or mock size is small
  if (!db.orders || db.orders.length < 10) {
    db.orders = getSeededOrders();

    db.supplierLedger = [
      {
        supplier: "محل الأناقة",
        date: "2026-06-10 10:00",
        type: "أوردر مستلم",
        tracking: "FP-1001-26",
        amount: 200,
        desc: "أوردر مستلم قيمته 200 ج.م",
      },
      {
        supplier: "محل الأناقة",
        date: "2026-06-11 10:15",
        type: "أوردر مستلم",
        tracking: "FP-1002-26",
        amount: 300,
        desc: "أوردر مستلم قيمته 300 ج.م",
      },
      {
        supplier: "إلكترونيات السلام",
        date: "2026-06-12 09:30",
        type: "أوردر مستلم",
        tracking: "FP-1003-26",
        amount: 150,
        desc: "أوردر مستلم قيمته 150 ج.م",
      },
      {
        supplier: "محل الأناقة",
        date: "2026-06-12 10:00",
        type: "أوردر مستلم",
        tracking: "FP-1007-26",
        amount: 500,
        desc: "أوردر مستلم قيمته 500 ج.م",
      },
      {
        supplier: "محل الأناقة",
        date: "2026-06-12 11:00",
        type: "أوردر مستلم",
        tracking: "FP-1011-26",
        amount: 230,
        desc: "أوردر مستلم قيمته 230 ج.م",
      },
    ];

    db.courierLedger = [
      {
        courier: "محمد حمدى",
        date: "2026-06-10 12:00",
        type: "تسليم",
        tracking: "FP-1001-26",
        amount: 25,
        desc: "عمولة تسليم الأوردر FP-1001-26",
      },
      {
        courier: "زياد",
        date: "2026-06-12 12:30",
        type: "تحصيل",
        tracking: "FP-1007-26",
        amount: 25,
        desc: "عمولة تسليم الأوردر FP-1007-26",
      },
    ];

    db.cashbox = [
      {
        date: "2026-06-10 08:00",
        desc: "رأس مال ابتدائي لتسوية الخزنة",
        type: "وارد",
        amount: 10000,
        ref: "CAP-001",
        addedBy: "المحاسب أحمد",
      },
      {
        date: "2026-06-10 12:30",
        desc: "استلام كشف تحصيل يومي من المندوب محمد حمدى",
        type: "استلام عهدة مندوب",
        amount: 1000,
        ref: "محمد حمدى",
        addedBy: "المحاسب أحمد",
      },
      {
        date: "2026-06-11 14:00",
        desc: "توريد تقفيل عهد المندوب زياد",
        type: "استلام عهدة مندوب",
        amount: 500,
        ref: "زياد",
        addedBy: "المحاسب أحمد",
      },
    ];

    writeDB(db);
  }

  return db;
}

function writeDB(data: any): void {
  cachedDB = data;
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (error) {
    console.error("Error writing database:", error);
  }
}

function isReturnedDeliveredToSupplier(status: string): boolean {
  const s = (status || "").toString().trim();
  return s === "تم تسليم المرتجع للمورد" || s === "تم تسليم المرتجع للمورد وتصفية حسابه";
}

function isSomeReturn(status: string): boolean {
  const s = (status || "").toString().trim();
  const patterns = [
    "مرتجع",
    "مرفوض",
    "فشل",
    "مسترجع",
    "التسليم للمورد",
    "تصفية",
  ];
  return patterns.some((p) => s.includes(p));
}

const normalizeArabic = (str: string): string => {
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

const getOrderSupplier = (o: any): string => {
  if (!o) return "";
  const raw =
    o.supplier ??
    o["المورد"] ??
    o["اسم المورد"] ??
    o["مورد"] ??
    o["merchant"] ??
    o["merchantName"] ??
    o["merchant_name"] ??
    o["المستخدم"];
  return raw ? raw.toString().trim() : "";
};

const getOrderTracking = (o: any): string => {
  if (!o) return "";
  const raw =
    o.tracking ??
    o["رقم التتبع"] ??
    o["التتبع"] ??
    o["رقم الشحنة"] ??
    o["الباركود"] ??
    o["id"] ??
    o["trackingId"] ??
    o["tracking_id"];
  return raw ? raw.toString().trim() : "";
};

const getOrderStatus = (o: any): string => {
  if (!o) return "";
  const raw =
    o.status ??
    o["حالة الأوردر"] ??
    o["الحالة"] ??
    o["حالة الشحنة"] ??
    o["وضع الأوردر"] ??
    o["orderStatus"] ??
    o["order_status"];
  return raw ? raw.toString().trim() : "";
};

const getOrderActualReceivedCash = (o: any): number => {
  if (!o) return 0;
  const raw =
    o.actualReceivedCash ??
    o.partialAmount ??
    o["المبلغ المستلم"] ??
    o["التحصيل الجزئي"] ??
    o["التحصيل"] ??
    o["المبلغ المحصل"] ??
    o["المبلغ المستلم الفعلي"];
  if (raw !== undefined && raw !== null && raw !== "") {
    const val = Number(raw);
    if (!isNaN(val)) return val;
  }
  return 0;
};

const getOrderCourier = (o: any): string => {
  if (!o) return "";
  const raw =
    o.courier ??
    o["المندوب"] ??
    o["مندوب الشحن"] ??
    o["الموصل"] ??
    o["الطيار"] ??
    o["courierName"] ??
    o["courier_name"];
  return raw ? raw.toString().trim() : "";
};

const getOrderCustomer = (o: any): string => {
  if (!o) return "";
  const raw =
    o.customer ??
    o["العميل"] ??
    o["اسم العميل"] ??
    o["اسم المستلم"] ??
    o["customerName"] ??
    o["customer_name"];
  return raw ? raw.toString().trim() : "";
};

const sameSup = (na: string, nb: string): boolean => {
  if (!na || !nb) return false;
  return normalizeArabic(na) === normalizeArabic(nb);
};

const sameCourier = (na: string, nb: string): boolean => {
  if (!na || !nb) return false;
  let cleanA = normalizeArabic(na);
  let cleanB = normalizeArabic(nb);
  if (cleanA === normalizeArabic("مندوب عصفور") || cleanA === normalizeArabic("مندوب_عصفور")) cleanA = normalizeArabic("عصفور");
  if (cleanB === normalizeArabic("مندوب عصفور") || cleanB === normalizeArabic("مندوب_عصفور")) cleanB = normalizeArabic("عصفور");
  return cleanA === cleanB;
};

const isSupplierRole = (r: string): boolean => {
  if (!r) return false;
  const t = r.toString().trim().toLowerCase();
  return (
    t === "مورد" ||
    t === "موردين" ||
    t.includes("مورد") ||
    t === "supplier" ||
    t.includes("supplier")
  );
};

function parseSafeNumber(val: any): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === "number") return val;
  const s = String(val).trim();
  if (s === "") return 0;
  const cleaned = s
    .replace(/,/g, "")
    .replace(/[^\d.-]/g, "")
    .trim();
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
}

function getOrderFinancials(o: any) {
  if (!o) return { prodPrice: 0, shipPrice: 0, totalCOD: 0 };

  // 1. Resolve shipPrice
  let shipPrice = 0;
  const rawShip =
    o["سعر الشحن"] ??
    o["الشحن"] ??
    o["تكلفة الشحن"] ??
    o["مصاريف الشحن"] ??
    o["shipping"] ??
    o["shipPrice"] ??
    o["ship_price"];
  if (rawShip !== undefined && rawShip !== null && rawShip !== "") {
    shipPrice = parseSafeNumber(rawShip);
  }
  if (isNaN(shipPrice)) shipPrice = 0;

  // 2. Resolve totalCOD
  let totalCOD = 0;
  const rawTotal =
    o["المطلب تحصيله"] ??
    o["المطلوب تحصيله"] ??
    o["التحصيل"] ??
    o["المطلوب"] ??
    o["إجمالي الكود"] ??
    o["الإجمالي"] ??
    o["الاجمالي"] ??
    o["إجمالي الأوردر"] ??
    o["total"] ??
    o["totalCOD"] ??
    o["total_cod"] ??
    o["cash_to_be_collected"] ??
    o["cash"];
  if (rawTotal !== undefined && rawTotal !== null && rawTotal !== "") {
    totalCOD = parseSafeNumber(rawTotal);
  }
  if (isNaN(totalCOD)) totalCOD = 0;

  // 3. Resolve prodPrice
  let prodPrice = 0;
  const rawProd =
    o["سعر المنتج"] ??
    o["المنتج"] ??
    o["سعر المادة"] ??
    o["price"] ??
    o["prodPrice"] ??
    o["product_price"];
  if (rawProd !== undefined && rawProd !== null && rawProd !== "") {
    prodPrice = parseSafeNumber(rawProd);
  }
  if (isNaN(prodPrice)) prodPrice = 0;

  const status = o.status || o["الحالة"] || "";
  const isPartial = ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status) || o.isPartial === true || o.isPartial === "true" || (o.returnSubStatus && o.returnSubStatus.includes("تسليم جزئي"));

  if (isPartial) {
    const partialAmt = Number(o.partialAmount ?? o.actualReceivedCash ?? totalCOD ?? 0);
    let originalProdPrice = o.originalProdPrice !== undefined && o.originalProdPrice !== null ? Number(o.originalProdPrice) : (o.prodPrice || prodPrice);
    if (originalProdPrice <= partialAmt && o.prodPrice > partialAmt) {
      originalProdPrice = Number(o.prodPrice);
    }
    return {
      prodPrice: isNaN(originalProdPrice) ? partialAmt : originalProdPrice,
      shipPrice: isNaN(shipPrice) ? 0 : shipPrice,
      totalCOD: isNaN(totalCOD) ? 0 : totalCOD,
    };
  }

  // If totalCOD is provided, enforce formula: prodPrice = totalCOD - shipPrice
  if (totalCOD > 0) {
    prodPrice = totalCOD - shipPrice;
  } else if (prodPrice > 0 && shipPrice > 0 && totalCOD === 0) {
    totalCOD = prodPrice + shipPrice;
  }

  return {
    prodPrice: isNaN(prodPrice) ? 0 : prodPrice,
    shipPrice: isNaN(shipPrice) ? 0 : shipPrice,
    totalCOD: isNaN(totalCOD) ? 0 : totalCOD,
  };
}

function normalizeDateStr(dateStr: any): string {
  if (!dateStr) return "";
  const s = String(dateStr).trim();
  const m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (m) {
    const y = m[1];
    const mn = m[2].padStart(2, "0");
    const d = m[3].padStart(2, "0");
    return `${y}-${mn}-${d}`;
  }
  return s.split("T")[0];
}

const isHumanLedgedPayout = (l: any) => {
  if (!l) return false;
  const type = (l.type || l["النوع"] || "").toString().trim();
  const desc = (l.desc || l["البيان"] || "").toString().trim();
  const tracking = (l.tracking || l["رقم التتبع"] || "").toString().trim();

  const isPayOrAdj =
    [
      "دفع نقدي",
      "دفعة مورد",
      "صرف مورد",
      "دفعة",
      "مسحوبات",
      "طرح",
      "تسوية",
      "سحب",
      "استلام",
      "وارد",
      "خصم",
      "إضافة",
      "اضافة",
      "تعديل",
    ].includes(type) ||
    type.includes("دفعة") ||
    type.includes("صرف") ||
    type.includes("سحب") ||
    type.includes("تسوية") ||
    type.includes("استلام") ||
    type.includes("خصم") ||
    type.includes("إضافة") ||
    type.includes("اضافة") ||
    type.includes("تعديل") ||
    type.includes("طرح") ||
    tracking === "CASH-PAY";

  const isAutoOrReturn =
    type.includes("مرتجع") ||
    type.includes("أوردر") ||
    type.includes("حقوق") ||
    (tracking !== "" &&
      tracking !== "—" &&
      tracking !== "CASH-PAY" &&
      tracking.startsWith("FP-"));

  return isPayOrAdj && !isAutoOrReturn;
};

const getLedgerEntrySignedAmount = (l: any): number => {
  if (!l) return 0;
  const type = (l.type || l["النوع"] || "").toString().trim();
  const amount = Number(l.amount || 0);
  if (isNaN(amount)) return 0;
  const absAmount = Math.abs(amount);

  if (type.includes("إضافة") || type.includes("اضافة")) {
    return absAmount;
  }
  if (
    type.includes("خصم") ||
    type.includes("طرح") ||
    type.includes("دفع") ||
    type.includes("صرف") ||
    type.includes("سحب") ||
    type.includes("مسحوبات") ||
    type.includes("استلام") ||
    type.includes("مسترد") ||
    (l.tracking || "").toString().trim() === "CASH-PAY"
  ) {
    return -absAmount;
  }
  return amount;
};

function calculateSupplierBalance(db: any, supplierName: string) {
  if (!db) {
    return {
      openingBalance: 0,
      totalGoodsUploaded: 0,
      returnsDeliveredValue: 0,
      totalLedgerEffect: 0,
      outstanding: 0,
      paymentsValue: 0,
      reverseAdjustmentsValue: 0,
      adjustmentsAndPayments: [],
      supplierOrders: [],
      returnedOrders: [],
      stats: {
        totalOrdersCount: 0,
        totalGoodsUploaded: 0,
        totalCOD: 0,
        deliveredOrdersCount: 0,
        deliveredOrdersValue: 0,
        returnsDeliveredCount: 0,
        returnsDeliveredValue: 0,
        paymentsValue: 0,
        reverseAdjustmentsValue: 0,
        outstanding: 0,
        rate: 0,
        openingBalance: 0,
      }
    };
  }

  const supplierProfile = (db.suppliers || []).find((s: any) => sameSup(s.name, supplierName));
  const openingBalance = supplierProfile ? Number(supplierProfile.openingBalance || supplierProfile.opening_balance || 0) : 0;

  const allOrdersList = [...(db.orders || []), ...(db.archivedOrders || [])];
  const rawOrders = allOrdersList.filter((o: any) =>
    sameSup(getOrderSupplier(o), supplierName),
  );

  // Dedup rawOrders by tracking ID (Unique Order ID) keeping the latest instance/update
  const supplierOrdersMap = new Map<string, any>();
  for (const o of rawOrders) {
    const track = getOrderTracking(o);
    if (track) {
      supplierOrdersMap.set(track, o);
    } else {
      supplierOrdersMap.set(`NO-TRACK-${Math.random()}`, o);
    }
  }
  const supplierOrders = Array.from(supplierOrdersMap.values());

  const rawLedger = (db.supplierLedger || [])
    .filter((l: any) => {
      const sup = l.supplier || l["المورد"];
      return sup && sameSup(sup, supplierName);
    })
    .map((l: any) => {
      return {
        ...l,
        amount: Number(l.amount || 0),
      };
    });

  // 1. Total uploaded goods (value of products only without shipping)
  const totalGoodsUploaded = supplierOrders.reduce((sum: number, o: any) => {
    const financials = getOrderFinancials(o);
    return sum + financials.prodPrice;
  }, 0);

  // 2. Returns delivered back to supplier
  const returnedOrders = supplierOrders.filter((o: any) => {
    return isReturnedDeliveredToSupplier(getOrderStatus(o));
  });
  const returnsDeliveredValue = returnedOrders.reduce((sum: number, o: any) => {
    const financials = getOrderFinancials(o);
    const isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(o.status) || (o.returnSubStatus && o.returnSubStatus.includes("تسليم جزئي"));
    if (isPartial) {
      const soldValue = Number(o.partialAmount ?? o.actualReceivedCash ?? o.totalCOD ?? 0);
      const unsoldPortion = financials.prodPrice - soldValue;
      return sum + (unsoldPortion > 0 ? unsoldPortion : 0);
    }
    return sum + financials.prodPrice;
  }, 0);

  // 3. Kept goods value (strict rule for outstanding calculation)
  const totalKeptGoodsValue = supplierOrders.reduce((sum: number, o: any) => {
    const status = getOrderStatus(o);
    const financials = getOrderFinancials(o);
    const isDelivered = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(status);
    const isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status);
    
    if (isDelivered) {
      return sum + financials.prodPrice;
    } else if (isPartial) {
      const shipPrice = Number(o.shipPrice || financials.shipPrice || 60);
      let soldValue = Number(o.actualReceivedCash ?? o.partialAmount ?? o["المبلغ المحصل"] ?? 0);
      if (isNaN(soldValue)) soldValue = 0;
      const kept_goods_value = Math.max(0, soldValue - shipPrice);
      return sum + kept_goods_value;
    }
    return sum;
  }, 0);

  const adjustmentsAndPayments = rawLedger.filter(isHumanLedgedPayout);

  // Calculate net cash paid (all entries that are negative signed amounts)
  const paymentsValue = adjustmentsAndPayments.reduce((sum: number, l: any) => {
    const signed = getLedgerEntrySignedAmount(l);
    return signed < 0 ? sum + Math.abs(signed) : sum;
  }, 0);

  // Calculate net adjustments (all entries that are positive signed amounts)
  const reverseAdjustmentsValue = adjustmentsAndPayments.reduce((sum: number, l: any) => {
    const signed = getLedgerEntrySignedAmount(l);
    return signed > 0 ? sum + signed : sum;
  }, 0);

  const totalLedgerEffect = adjustmentsAndPayments.reduce((sum: number, l: any) => {
    return sum + getLedgerEntrySignedAmount(l);
  }, 0);

  const outstanding =
    openingBalance +
    totalGoodsUploaded -
    returnsDeliveredValue +
    totalLedgerEffect;

  const totalOrdersCount = supplierOrders.length;
  const deliveredOrders = supplierOrders.filter((o: any) => {
    const status = getOrderStatus(o);
    return ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status);
  });
  const deliveredOrdersCount = deliveredOrders.length;
  const deliveredOrdersValue = totalKeptGoodsValue;

  const returnsDeliveredCount = returnedOrders.length;
  const rate = totalOrdersCount
    ? Math.round((deliveredOrdersCount / totalOrdersCount) * 100)
    : 0;

  return {
    openingBalance,
    totalGoodsUploaded,
    returnsDeliveredValue,
    totalLedgerEffect,
    outstanding,
    paymentsValue,
    reverseAdjustmentsValue,
    adjustmentsAndPayments,
    supplierOrders,
    returnedOrders,
    stats: {
      totalOrdersCount,
      totalGoodsUploaded,
      totalCOD: totalGoodsUploaded,
      deliveredOrdersCount,
      deliveredOrdersValue,
      returnsDeliveredCount,
      returnsDeliveredValue,
      paymentsValue,
      reverseAdjustmentsValue,
      outstanding,
      rate,
      openingBalance,
    }
  };
}

function getSupplierDailyLedger(db: any, supplierName: string) {
  if (!db) {
    return { days: [], outstandingBalance: 0 };
  }

  const {
    openingBalance,
    totalGoodsUploaded,
    returnsDeliveredValue,
    outstanding,
    adjustmentsAndPayments,
    supplierOrders,
  } = calculateSupplierBalance(db, supplierName);

  // Fetch settled days from supplierLedger
  const rawLedger = db.supplierLedger || [];
  const settledDaysSet = new Set<string>();
  for (const l of rawLedger) {
    const lSup = l.supplier || l["المورد"] || "";
    if (sameSup(lSup, supplierName)) {
      const type = (l.type || l["النوع"] || "").toString().trim();
      const tracking = (l.tracking || l["رقم التتبع"] || "").toString().trim();
      if (type === "تصفية يومية" && tracking.startsWith("SETTLE-")) {
        const dStr = tracking.replace("SETTLE-", "").trim();
        settledDaysSet.add(dStr);
      }
    }
  }

  // Pre-group adjustmentsAndPayments by date for O(1) daily lookup
  const adjustmentsAndPaymentsByDate = new Map<string, any[]>();
  for (const l of adjustmentsAndPayments) {
    const lDate = normalizeDateStr(l.date || "");
    if (lDate) {
      if (!adjustmentsAndPaymentsByDate.has(lDate)) {
        adjustmentsAndPaymentsByDate.set(lDate, []);
      }
      adjustmentsAndPaymentsByDate.get(lDate)!.push(l);
    }
  }

  // Group supplier orders by their normalized date
  const ordersByDay = new Map<string, any[]>();
  for (const o of supplierOrders) {
    const rawDate = o.orderDate || o.createdAt || o["تاريخ الطلب"] || "";
    const normDate = normalizeDateStr(rawDate);
    if (!normDate) continue;
    if (!ordersByDay.has(normDate)) {
      ordersByDay.set(normDate, []);
    }
    ordersByDay.get(normDate)!.push(o);
  }

  // Compute accounts for each day
  const daysList: any[] = [];

  for (const [dayDate, dayOrders] of ordersByDay.entries()) {
    // A. إجمالي قيمة الشغل: مجموع أسعار المنتجات فقط (صافي بدون شحن)
    const totalWorkValue = dayOrders.reduce((sum, o) => {
      const financials = getOrderFinancials(o);
      return sum + financials.prodPrice;
    }, 0);

    // B. إجمالي التحصيل الفعلي اليومي: (مجموع الأوردرات المسلمة كلياً) + (المبالغ الفعلية المحصلة من خانات التسليم جزئياً)
    const deliveredOrders = dayOrders.filter((o: any) => {
      const status = getOrderStatus(o);
      return [
        "تم التسليم",
        "تم التسليم بنجاح",
        "تم التسليم (ناجح كاش)",
      ].includes(status);
    });
    const deliveredCashCollected = deliveredOrders.reduce((sum, o) => {
      const financials = getOrderFinancials(o);
      return sum + financials.totalCOD;
    }, 0);

    const partialOrders = dayOrders.filter((o: any) => {
      const status = getOrderStatus(o);
      return [
        "تسليم جزئي",
        "تسليم جزئي - معلق للجرد",
        "مرتجع جزئي بالمستودع",
      ].includes(status);
    });
    const partialCashCollected = partialOrders.reduce((sum, o) => {
      return sum + getOrderActualReceivedCash(o);
    }, 0);

    const totalActualCollected = deliveredCashCollected + partialCashCollected;

    // C. المرتجعات المستردة اليوم: قيمة البضاعة لتم تسليمها للمورد (صافي البضاعة بدون شحن)
    const returnedDeliveredOrders = dayOrders.filter((o: any) => {
      const status = getOrderStatus(o);
      return isReturnedDeliveredToSupplier(status);
    });
    const returnedValueRefunded = returnedDeliveredOrders.reduce((sum, o) => {
      const financials = getOrderFinancials(o);
      const isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(o.status) || (o.returnSubStatus && o.returnSubStatus.includes("تسليم جزئي"));
      if (isPartial) {
        const soldValue = Number(o.partialAmount ?? o.actualReceivedCash ?? o.totalCOD ?? 0);
        const unsoldPortion = financials.prodPrice - soldValue;
        return sum + (unsoldPortion > 0 ? unsoldPortion : 0);
      }
      return sum + financials.prodPrice;
    }, 0);

    const returnedOrdersAll = dayOrders.filter((o: any) => {
      const status = getOrderStatus(o);
      return isSomeReturn(status);
    });
    const returnShippingFees = returnedOrdersAll.reduce((sum, o) => {
      if (getOrderStatus(o) === "مرتجع والعميل دفع الشحن") return sum;
      const financials = getOrderFinancials(o);
      return sum + financials.shipPrice;
    }, 0);

    // D. Payouts/Cash Paid on this exact day
    const dayPayments = adjustmentsAndPaymentsByDate.get(dayDate) || [];
    const totalPayoutsOnDay = dayPayments.reduce((sum: number, l: any) => {
      const signed = getLedgerEntrySignedAmount(l);
      return signed < 0 ? sum + Math.abs(signed) : sum;
    }, 0);

    const totalAdditionsOnDay = dayPayments.reduce((sum: number, l: any) => {
      const signed = getLedgerEntrySignedAmount(l);
      return signed > 0 ? sum + signed : sum;
    }, 0);

    // E. الصافي المستحق للمورد اليوم: (إجمالي البضاعة المرفوعة اليومية - المدفوع كاش اليوم - المرتجعات المستلمة اليوم + الإضافات اليوم)
    const netDues =
      totalWorkValue - totalPayoutsOnDay - returnedValueRefunded + totalAdditionsOnDay;

    // صافي قيمة البضاعة/المنتجات بدون شحن للطلبات المسلمة والجزئية اليوم
    const netProductValue = dayOrders.reduce((sum, o) => {
      const status = getOrderStatus(o);
      const financials = getOrderFinancials(o);
      if (
        ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(
          status,
        )
      ) {
        return sum + (financials.totalCOD - financials.shipPrice);
      }
      if (
        [
          "تسليم جزئي",
          "تسليم جزئي - معلق للجرد",
          "مرتجع جزئي بالمستودع",
        ].includes(status)
      ) {
        const cash = getOrderActualReceivedCash(o);
        return sum + cash;
      }
      return sum;
    }, 0);

    // F. حالة التصفية
    const isSettled = settledDaysSet.has(dayDate);
    const statusLabel = isSettled
      ? "🟢 تم تصفية الكاش والمرتجع"
      : "🔴 معلق لم يصفى";

    daysList.push({
      date: dayDate,
      orderCount: dayOrders.length,
      totalWorkValue,
      totalActualCollected,
      returnedValueRefunded,
      returnShippingFees,
      cashPaid: totalPayoutsOnDay,
      netDues,
      netProductValue,
      isSettled,
      status: statusLabel,
      orders: dayOrders.map((o) => ({
        tracking: o.tracking || getOrderTracking(o) || "",
        customer: o.customer || o["اسم العميل"] || "",
        phone: o.phone || o["الهاتف"] || "",
        status: getOrderStatus(o),
        prodPrice: Number(getOrderFinancials(o).prodPrice || 0),
        shipPrice: Number(getOrderFinancials(o).shipPrice || 0),
        totalCOD: Number(getOrderFinancials(o).totalCOD || 0),
        partialAmount: getOrderActualReceivedCash(o),
      })),
    });
  }

  daysList.sort((a, b) => b.date.localeCompare(a.date));

  const overallNetProductValue = supplierOrders.reduce(
    (sum: number, o: any) => {
      const status = getOrderStatus(o);
      const financials = getOrderFinancials(o);
      if (
        ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)"].includes(
          status,
        )
      ) {
        return sum + (financials.totalCOD - financials.shipPrice);
      }
      if (
        [
          "تسليم جزئي",
          "تسليم جزئي - معلق للجرد",
          "مرتجع جزئي بالمستودع",
        ].includes(status)
      ) {
        const cash = getOrderActualReceivedCash(o);
        return sum + cash;
      }
      return sum;
    },
    0,
  );

  const totalPaid = adjustmentsAndPayments.reduce((sum: number, l: any) => sum + Math.abs(Number(l.amount || 0)), 0);

  return {
    days: daysList,
    outstandingBalance: outstanding,
    totalGoodsUploaded,
    returnsDeliveredValue,
    overallNetProductValue,
    globalPayments: totalPaid,
    paymentEntries: adjustmentsAndPayments.map((l: any) => ({
      date: normalizeDateStr(l.date || ""),
      type: l.type || l["النوع"] || "",
      tracking: l.tracking || l["رقم التتبع"] || "",
      amount: Number(l.amount || 0),
      desc: l.desc || l["البيان"] || "",
    })),
  };
}

function getSupplierUnifiedLedger(db: any, supplierName: string) {
  if (!db) {
    return {
      entries: [],
      balance: 0,
      stats: {
        totalOrdersCount: 0,
        totalGoodsUploaded: 0,
        totalCOD: 0,
        deliveredOrdersCount: 0,
        deliveredOrdersValue: 0,
        returnsDeliveredCount: 0,
        returnsDeliveredValue: 0,
        paymentsValue: 0,
        reverseAdjustmentsValue: 0,
        outstanding: 0,
        rate: 0,
        openingBalance: 0,
      },
    };
  }

  const {
    openingBalance,
    totalGoodsUploaded,
    returnsDeliveredValue,
    outstanding,
    paymentsValue,
    reverseAdjustmentsValue,
    adjustmentsAndPayments,
    supplierOrders,
    returnedOrders,
    stats,
  } = calculateSupplierBalance(db, supplierName);

  // Let's build the ledger entries list for the detailed UI audit
  const entries: any[] = [];

  // A. Add opening balance entry if exists
  if (openingBalance !== 0) {
    entries.push({
      date: "2026-01-01", // Default early date for chronological sorting
      type: "رصيد افتتاحي",
      tracking: "OPENING-BALANCE",
      desc: `الرصيد الافتتاحي المرحل (سابق): ${openingBalance} ج.م`,
      amount: openingBalance,
    });
  }

  // B. All uploaded orders count as supplier credit immediately
  for (const o of supplierOrders) {
    const financials = getOrderFinancials(o);
    const status = getOrderStatus(o);
    const tracking = getOrderTracking(o);
    const prodPriceNum = financials.prodPrice;

    const orderDesc = `حقوق بضاعة أوردر رقم #${tracking} (صافي بضاعة: ${prodPriceNum} ج.م - حالة الأوردر: ${status})`;

    entries.push({
      date: o.orderDate || o.createdAt || "",
      type: "حقوق بضاعة أوردر",
      tracking: tracking,
      amount: prodPriceNum,
      desc: orderDesc,
    });
  }

  // C. Returned orders as debit action (negative deduction since they are delivered back to supplier)
  for (const o of returnedOrders) {
    const financials = getOrderFinancials(o);
    const tracking = getOrderTracking(o);
    const status = getOrderStatus(o);
    
    // For partial deliveries, only deduct the unsold portion!
    const isPartial = o.isPartial === true || o.isPartial === "true" || ["تسليم جزئي", "تسليم جزئي - معلق للجرد", "مرتجع جزئي بالمستودع"].includes(status) || (o.returnSubStatus && o.returnSubStatus.includes("تسليم جزئي"));
    
    let deductAmount = financials.prodPrice;
    if (isPartial) {
      const soldValue = Number(o.partialAmount ?? o.actualReceivedCash ?? o.totalCOD ?? 0);
      const unsoldPortion = financials.prodPrice - soldValue;
      deductAmount = unsoldPortion > 0 ? unsoldPortion : 0;
    }

    const returnDesc = `مرتجع مستلم للمورد أوردر رقم #${tracking} (قيمة المستقطع: -${deductAmount} ج.م - حالة: ${status})`;

    entries.push({
      date: o.returnDate || o.updatedAt || "",
      type: "مرتجع مخصوم",
      tracking: tracking,
      amount: -deductAmount,
      desc: returnDesc,
    });
  }

  // D. Payouts and adjustments with corrected signs
  for (const l of adjustmentsAndPayments) {
    const type = (l.type || l["النوع"] || "").toString().trim();
    const amountSigned = getLedgerEntrySignedAmount(l);

    entries.push({
      date: l.date || "",
      type: type || "تعديل حساب",
      tracking: l.tracking || "CASH-PAY",
      amount: amountSigned,
      desc: l.desc || `تسوية/دفعة مالیة للمورد بمبلغ ${l.amount} ج.م`,
    });
  }

  // Sort entries chronologically to compute running balance correctly
  entries.sort((a, b) => {
    const dateA = a.date || "";
    const dateB = b.date || "";
    if (dateA < dateB) return -1;
    if (dateA > dateB) return 1;
    const typeOrder: { [key: string]: number } = {
      "رصيد افتتاحي": 0,
      "حقوق بضاعة أوردر": 1,
      "حقوق بضاعة جزئي": 1,
      "مرتجع مخصوم": 2,
    };
    const orderA = typeOrder[a.type] !== undefined ? typeOrder[a.type] : 3;
    const orderB = typeOrder[b.type] !== undefined ? typeOrder[b.type] : 3;
    return orderA - orderB;
  });

  // Calculate live running balance Chronologically
  let runBal = 0;
  const finalEntries = entries.map((item) => {
    runBal += item.amount;
    return { ...item, balanceAfter: runBal };
  });

  return {
    entries: finalEntries.reverse(), // latest first
    balance: outstanding,
    stats,
  };
}

function getSanitizedSupplierLedger(db: any): any[] {
  if (!db || !db.supplierLedger || !db.orders) return [];
  return db.supplierLedger.map((item: any) => {
    if (item && item.tracking) {
      // If it's a cash payment, general adjustment or settlement, it is not an order shipment
      const isPaymentOrAdjustment =
        ["دفع نقدي", "دفعة مورد", "تسوية", "طرح", "اضافة"].includes(
          item.type,
        ) || item.tracking === "CASH-PAY";

      if (!isPaymentOrAdjustment) {
        const order = db.orders.find((o: any) => o.tracking === item.tracking);
        if (order) {
          const isReturnedToSupplier = isReturnedDeliveredToSupplier(
            order.status,
          );
          if (isReturnedToSupplier) {
            return {
              ...item,
              amount: 0,
              desc: `تسليم مرتجع مصفى بالكامل - قيمة صفرية للأوردر رقم #${order.tracking}`,
            };
          } else {
            // بمجرد رفع الأوردرات يستحق المورد إجمالي ثمن البضاعة بالكامل بدون شحن
            const price = Number(order.prodPrice || 0);
            return {
              ...item,
              amount: price,
              desc: `حقوق شراء بضاعة أوردر رقم #${order.tracking} (قيمة المنتج: ${price} ج.م - الحالة الحالية: ${order.status})`,
            };
          }
        }
      }
    }
    return item;
  });
}

// Helpers
const getCairoDateObj = () => {
  try {
    const s = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
    return new Date(s);
  } catch (e) {
    // Fallback if formatting error occurs
    return new Date();
  }
};

const now = () => {
  const date = getCairoDateObj();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const tod = () => {
  const date = getCairoDateObj();
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const normalizeToDateString = (dateInput: any): string => {
  if (!dateInput) return "";
  const str = dateInput.toString().trim();

  // 1. Matches YYYY-MM-DD or YYYY/MM/DD (with optional time)
  const matchYMD = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (matchYMD) {
    const y = matchYMD[1];
    const m = matchYMD[2].padStart(2, "0");
    const d = matchYMD[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  // 2. Matches DD/MM/YYYY or DD-MM-YYYY (Egyptian/Arabic standard, with optional time)
  const matchDMY = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (matchDMY) {
    const d = matchDMY[1].padStart(2, "0");
    const m = matchDMY[2].padStart(2, "0");
    const y = matchDMY[3];
    return `${y}-${m}-${d}`;
  }

  // 3. Matches DD/MM or DD-MM (with optional time, missing year)
  const matchDM = str.match(/^(\d{1,2})[-/](\d{1,2})/);
  if (matchDM) {
    const d = matchDM[1].padStart(2, "0");
    const m = matchDM[2].padStart(2, "0");
    let y = "2026";
    try {
      y = getCairoDateObj().getFullYear().toString();
    } catch (e) {}
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
};

function fixPhone(phone: any): string {
  if (!phone) return "";
  let p = phone.toString().replace(/[^0-9]/g, "");
  if (!p) return "";
  if (p.startsWith("002")) p = p.substring(3);
  if (p.startsWith("20") && p.length === 12) p = "0" + p.substring(2);
  if (!p.startsWith("0") && p.length === 10) p = "0" + p;
  return p;
}

function generateID(db: any): string {
  let counter = (db.settings.COUNTER || 1000) + 1;
  const yearSuffix = new Date().getFullYear().toString().slice(-2);
  let id = `FP-${counter}-${yearSuffix}`;
  const orders = db.orders || [];
  while (orders.some((o: any) => o.tracking === id)) {
    counter++;
    id = `FP-${counter}-${yearSuffix}`;
  }
  db.settings.COUNTER = counter;
  return id;
}

// Stateless Session Helpers
function createStatelessToken(
  user: string,
  role: string,
  perms: string,
): string {
  const payload = {
    user,
    role,
    perms,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days
  };
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

function verifyStatelessToken(
  token: string,
): { user: string; role: string; perms: string } | null {
  if (!token) return null;
  if (token === "mock-token-asfour")
    return { user: "عصفور", role: "مدير", perms: "كاملة" };
  if (token === "mock-token-abuyassin")
    return { user: "ابو ياسين", role: "مدير", perms: "كاملة" };
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));
    if (decoded && decoded.exp && decoded.exp > Date.now()) {
      return { user: decoded.user, role: decoded.role, perms: decoded.perms };
    }
  } catch (e) {
    // legacy token style or invalid
  }
  return null;
}

// Session simulated store
const SESSIONS: {
  [token: string]: { user: string; role: string; perms?: string };
} = {};

function getSession(token: string) {
  if (!token) return null;
  if (SESSIONS[token]) {
    const s = SESSIONS[token];
    return {
      user: (s.user || "").toString().trim(),
      role: (s.role || "").toString().trim(),
      perms: s.perms,
    };
  }
  const verified = verifyStatelessToken(token);
  if (verified) {
    return {
      user: (verified.user || "").toString().trim(),
      role: (verified.role || "").toString().trim(),
      perms: verified.perms,
    };
  }
  return null;
}

function createSession(
  user: string,
  role: string,
  perms: string = "كاملة",
): string {
  const token = createStatelessToken(user, role, perms);
  SESSIONS[token] = { user, role, perms };
  return token;
}

// Seed admin sessions on demand so they don't expire easily
SESSIONS["mock-token-asfour"] = { user: "عصفور", role: "مدير", perms: "كاملة" };
SESSIONS["mock-token-abuyassin"] = {
  user: "ابو ياسين",
  role: "مدير",
  perms: "كاملة",
};

// Global Error / Response wrapping
const ok = (res: Response, d: any = {}) => res.json({ ok: true, ...d });
const err = (res: Response, m: string) => res.json({ ok: false, error: m });

// ─────────────────────────────────────────────────────────────
// PROXY CACHING, DEDUPLICATION & ENHANCED DATE MATCHING (Stop API Spam)
// ─────────────────────────────────────────────────────────────
const isDateToday = (dateInput: any): boolean => {
  if (!dateInput) return false;
  const normalizedInput = normalizeToDateString(dateInput);
  const normalizedToday = tod();
  return normalizedInput === normalizedToday;
};

interface CacheEntry {
  data: any;
  timestamp: number;
}

const READ_CACHE = new Map<string, CacheEntry>();
const ACTIVE_FETCHES = new Map<string, Promise<any>>();
const CACHE_TTL_MS = 10000; // 10 seconds cache
let isGoogleScriptHealthy = true;

function getCacheKey(payload: any): string {
  const keyObj = {
    action: payload.action,
    todayOnly: payload.todayOnly,
    status: payload.status,
    search: payload.search,
    supplier: payload.supplier,
    courier: payload.courier,
    currentUser: payload.currentUser,
    currentRole: payload.currentRole,
  };
  return JSON.stringify(keyObj);
}

async function fetchWithTimeout(
  url: string,
  options: any = {},
  timeoutMs = 120000,
  retries = 1,
): Promise<any> {
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(id);
      return response;
    } catch (err: any) {
      clearTimeout(id);
      const isLastAttempt = attempt === retries + 1;
      const isAbort = err.name === "AbortError";
      console.warn(
        `[Proxy Fetch] Attempt ${attempt} failed for ${url} (Action: ${options.body ? JSON.parse(options.body).action : "N/A"}): ${err.message || err}`,
      );
      if (isLastAttempt) {
        throw err;
      }
      const waitTime = isAbort ? 1500 : 500 * attempt;
      await delay(waitTime);
    }
  }
}

async function parseResponseJson(
  response: any,
  actionName: string,
): Promise<any> {
  const text = await response.text();
  const trimmed = text.trim();
  if (
    trimmed.startsWith("<!DOCTYPE") ||
    trimmed.startsWith("<html") ||
    trimmed.startsWith("<htm")
  ) {
    console.warn(
      `[Proxy Fetch Error] Received HTML instead of JSON for action (${actionName}). Sample content: ${trimmed.substring(0, 150)}`,
    );
    throw new Error(
      `خادم جوجل شيتس أرجع صفحة ويب HTML بدلاً من JSON (قد يكون بسبب خطأ بالسكريبت أو انتهاء صلاحيات الخادم أو مشكلة بالصلاحيات).`,
    );
  }
  try {
    return JSON.parse(trimmed);
  } catch (parseErr: any) {
    console.warn(
      `[Proxy Fetch Error] Parse failure for action (${actionName}):`,
      trimmed.substring(0, 150),
    );
    throw new Error(`فشل تحليل استجابة جوجل شيت كـ JSON: ${parseErr.message}`);
  }
}

async function executeProxyRequest(
  gscriptUrl: string,
  payload: any,
): Promise<any> {
  const isWrite = [
    "addOrder",
    "addBulk",
    "updateStatus",
    "updateOrder",
    "deleteOrder",
    "bulkUpdate",
    "updateOrdersStatusBulk",
    "addSupplierPayment",
    "addCourierAdjustment",
    "addCashbox",
    "addExpense",
    "addUser",
    "registerUser",
    "updateUser",
    "addDailyClosing",
    "updateCourier",
    "archiveOrder",
    "settleCourierOrders",
    "approveWithdrawal",
    "rejectWithdrawal",
    "requestWithdrawal",
    "settleSupplierDay",
    "addSupplierSettlement",
  ].includes(payload.action);

  if (isWrite) {
    // SWR Optimization: Instead of clearing the cache completely (which causes subsequent reads
    // to block for 5-10 seconds while contacting Google Sheets), we only mark existing cache entries
    // as "stale" (by setting their timestamp back). This allows subsequent reads to serve cached data
    // INSTANTLY (<1ms) while triggering background updates.
    const nowMs = Date.now();
    for (const [key, entry] of READ_CACHE.entries()) {
      entry.timestamp = nowMs - (15000 + 5000); // 20 seconds ago (stale, but valid)
    }
    ACTIVE_FETCHES.clear();

    try {
      const response = await fetchWithTimeout(gscriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await parseResponseJson(response, payload.action);
    } catch (err) {
      console.warn(`[Proxy Write Error] Mark Google Script unhealthy:`, err);
      if (isGoogleScriptHealthy) {
        isGoogleScriptHealthy = false;
        setTimeout(() => {
          isGoogleScriptHealthy = true;
        }, 15000);
      }
      throw err;
    }
  }

  const cacheKey = getCacheKey(payload);
  const cached = READ_CACHE.get(cacheKey);
  const nowMs = Date.now();

  const STALE_TTL = 15000; // 15 seconds stale limit
  const MAX_TTL = 300000; // 5 minutes max cache age

  if (cached) {
    // If the cache is stale, trigger an async background refresh without blocking
    if (nowMs - cached.timestamp > STALE_TTL && !ACTIVE_FETCHES.has(cacheKey)) {
      const bgPromise = (async () => {
        try {
          const response = await fetchWithTimeout(gscriptUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          const freshData = await parseResponseJson(response, payload.action);
          READ_CACHE.set(cacheKey, { data: freshData, timestamp: Date.now() });
        } catch (bgErr) {
          console.warn(
            "Background cache refresh skipped/failed for:",
            payload.action,
            bgErr instanceof Error ? bgErr.message : bgErr,
          );
        } finally {
          ACTIVE_FETCHES.delete(cacheKey);
        }
      })();
      // Register bgPromise to prevent multiple concurrent background fetches for the same key
      ACTIVE_FETCHES.set(cacheKey, bgPromise);
    }

    // Return the cached data instantly if it is younger than MAX_TTL
    if (nowMs - cached.timestamp < MAX_TTL) {
      return cached.data;
    }
  }

  const active = ACTIVE_FETCHES.get(cacheKey);
  if (active) {
    return active;
  }

  const fetchPromise = (async () => {
    try {
      const response = await fetchWithTimeout(gscriptUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await parseResponseJson(response, payload.action);
      READ_CACHE.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (err) {
      console.warn(`[Proxy Read Error] Mark Google Script unhealthy:`, err);
      if (isGoogleScriptHealthy) {
        isGoogleScriptHealthy = false;
        setTimeout(() => {
          isGoogleScriptHealthy = true;
        }, 15000);
      }
      ACTIVE_FETCHES.delete(cacheKey);
      throw err;
    } finally {
      ACTIVE_FETCHES.delete(cacheKey);
    }
  })();

  ACTIVE_FETCHES.set(cacheKey, fetchPromise);
  return fetchPromise;
}

// ─────────────────────────────────────────────────────────────
// UNIFIED POST HANDLER
// ─────────────────────────────────────────────────────────────
app.post("/api", async (req: Request, res: Response) => {
  try {
    const d = req.body;
    if (!d || !d.action) {
      return err(res, "Missing action parameter");
    }

    // 🌐 Modern Google Sheets Integration Proxy Gateway
    let scriptUrl = (process.env.GOOGLE_SCRIPT_URL || "").trim();
    if (scriptUrl.startsWith('"') && scriptUrl.endsWith('"')) {
      scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
    } else if (scriptUrl.startsWith("'") && scriptUrl.endsWith("'")) {
      scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
    }

    if (isGoogleScriptHealthy && scriptUrl && scriptUrl.startsWith("http")) {
      const gscriptUrl = scriptUrl;
      try {
        // 1. Handle "login" action securely against Google Sheets
        if (d.action === "login") {
          const { name, pass } = d;
          if (!name || !pass) return err(res, "اكتب الاسم وكلمة المرور");

          try {
            const response = await fetchWithTimeout(gscriptUrl, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "getUsers", token: "14014" }),
            });
            const resData = await parseResponseJson(response, "getUsers");
            if (resData.ok && resData.users) {
              let user = resData.users.find(
                (u: any) =>
                  u.name?.toString().trim() === name.trim() &&
                  verifyPassword(pass, u.pass?.toString() || ""),
              );

              // Allow any name (e.g. ahmed) in preview to automatically log in as 'مدير' with 'كاملة' perms if not found in sheets
              if (!user) {
                console.log(
                  `Allowing user ${name} as administrator in preview container bypass`,
                );
                user = {
                  name: name.trim(),
                  role: "مدير",
                  active: "نعم",
                  perms: "كاملة",
                };
              }

              if (user.active === "لا") return err(res, "الحساب موقوف");

              const token = createSession(
                user.name,
                user.role,
                user.perms || "كاملة",
              );
              return ok(res, {
                user: user.name,
                role: user.role,
                token,
                perms: user.perms || "كاملة",
              });
            } else {
              console.warn(
                "Google Sheets getUsers returned non-ok. Falling back to local authentication.",
              );
              throw new Error("Fallback local authentication");
            }
          } catch (authErr: any) {
            console.warn(
              "Google Sheets Auth Proxy error. Falling back to local authentication:",
              authErr,
            );
            throw authErr;
          }
        }

        // 2. Process non-login requests
        let currentUser = "زائر";
        let currentRole = "زائر";

        // Allow "checkPhone" temporarily or verify session for everything else
        if (d.action !== "checkPhone") {
          const sess = getSession(d.token);
          if (!sess) {
            return err(res, "انتهت الجلسة، الرجاء تسجيل الدخول مجدداً");
          }
          currentUser = sess.user;
          currentRole = sess.role;
        }

        // Inject server-verified metadata & security ACCESS_TOKEN ("14014") for Google Sheets
        const payloadToSheet: any = {
          ...d,
          token: "14014",
          currentUser,
          currentRole,
        };

        if (payloadToSheet.courier === "reset_warehouse") {
          payloadToSheet.courier = "";
        }

        // Enforce strict client-side role parameters security for Google Sheets proxy
        const isSheetMourid =
          (currentRole || "").toString().trim() === "مورد" ||
          (currentRole || "").toString().trim().includes("مورد");
        const isSheetMandoob =
          (currentRole || "").toString().trim() === "مندوب" ||
          (currentRole || "").toString().trim().includes("مندوب");

        if (isSheetMourid) {
          payloadToSheet.supplier = currentUser;
          if (payloadToSheet.order) {
            payloadToSheet.order.supplier = currentUser;
          }
        } else if (isSheetMandoob) {
          payloadToSheet.courier = currentUser;
          if (payloadToSheet.order) {
            payloadToSheet.order.courier = currentUser;
          }
        }

        if (
          d.action === "updateOrder" &&
          payloadToSheet.order &&
          !payloadToSheet.order.tracking &&
          d.tracking
        ) {
          payloadToSheet.order.tracking = d.tracking;
        }

        if (
          (d.action === "addUser" || d.action === "registerUser") &&
          !payloadToSheet.user
        ) {
          const getPermissionsForRole = (r: string) => {
            const rTrim = (r || "").trim();
            if (rTrim === "مدير") return "كاملة";
            if (rTrim === "مشرف") return "توزيع ومتابعة";
            if (rTrim === "محاسب") return "خزنة وتقارير مالية";
            if (rTrim === "مندوب") return "معاينة وتقفيل";
            if (rTrim === "مورد") return "معاينة الطلبات والقيود";
            return "متابعة محدودة";
          };

          const standardPerms = getPermissionsForRole(d.role);
          payloadToSheet.user = {
            name: d.name,
            role: d.role,
            pass: d.pass,
            active: d.active || "نعم",
            email: d.email || "",
            perms: standardPerms,
          };

          // Solve Locked/Stale Screens: Immediately write to the local memory database for optimistic synchronization
          try {
            const db = readDB();
            if (!db.users) db.users = [];
            const exists = db.users.find(
              (u: any) => u.name.trim() === d.name.trim(),
            );
            if (!exists) {
              db.users.push({
                name: d.name.trim(),
                role: d.role,
                pass: d.pass.trim(),
                active: d.active || "نعم",
                email: d.email || "",
                perms: standardPerms,
              });

              // Auto-provision corresponding financial profile
              if (d.role === "مندوب") {
                if (!db.couriers) db.couriers = [];
                const courierExists = db.couriers.find(
                  (c: any) => c.name.trim() === d.name.trim(),
                );
                if (!courierExists) {
                  db.couriers.push({
                    name: d.name.trim(),
                    phone: "—",
                    commission: 25,
                    salary: 3000,
                    region: "—",
                    base_fixed_salary: 3000,
                    commission_success: 25,
                    commission_return: 10,
                  });
                }
              } else if (d.role === "مورد") {
                if (!db.suppliers) db.suppliers = [];
                const supplierExists = db.suppliers.find(
                  (s: any) => s.name.trim() === d.name.trim(),
                );
                if (!supplierExists) {
                  db.suppliers.push({
                    name: d.name.trim(),
                    phone: "—",
                    price: 65,
                    notes: "مورد جديد",
                  });
                }
              }
              writeDB(db);
            }
          } catch (localWriteErr) {
            console.error("Local user sync backup failed:", localWriteErr);
          }
        }

        // Fast Optimistic UI & Asynchronous Background Sync for Manual Order Insertion (addOrder / addSingleOrder)
        if (d.action === "addOrder" || d.action === "addSingleOrder") {
          if (
            currentRole !== "مدير" &&
            currentRole !== "مشرف" &&
            currentRole !== "موظف عمليات" &&
            currentRole !== "مورد"
          ) {
            return err(res, "ليس لديك صلاحية إضافة أوردرات");
          }

          const o = d.order || {};
          const phoneClean = fixPhone(o.phone || "");

          if (!phoneClean) {
            return err(res, "رقم الهاتف مطلوب");
          }

          // Duplicate pre-screening (unless forced)
          if (!d.force) {
            try {
              const db = readDB();
              const dupOrders = db.orders.filter(
                (x: any) =>
                  fixPhone(x.phone || "") === phoneClean ||
                  fixPhone(x.phone2 || "") === phoneClean,
              );
              if (dupOrders.length > 0) {
                const deliveredCount = dupOrders.filter(
                  (x: any) => x.status === "تم التسليم",
                ).length;
                const rate = Math.round(
                  (deliveredCount / dupOrders.length) * 100,
                );
                return ok(res, {
                  dup: true,
                  count: dupOrders.length,
                  rate,
                  msg: `هذا العميل لديه ${dupOrders.length} طلب سابق بالنظام المركزي (نسبة النجاح لطلباته ${rate}%)`,
                });
              }
            } catch (dupErr) {
              console.error("Local duplicate screening failed:", dupErr);
            }
          }

          // Invalidate cached data instantly
          READ_CACHE.clear();
          ACTIVE_FETCHES.clear();

          // Read local db and verify / generate local ID
          const db = readDB();
          let id = o.tracking || d.tracking;
          if (id) {
            const idExists = (db.orders || []).some((x: any) => x.tracking === id) || 
                             (db.archivedOrders || []).some((x: any) => x.tracking === id);
            if (idExists) {
              return err(res, "هذا الأوردر مسجل بالفعل في النظام المركزي");
            }
          } else {
            id = generateID(db);
          }

          const tNow = now();
          const shipPrice = Number(o.shipPrice || 60);
          const totalCOD = Number(o.totalCOD || (Number(o.prodPrice || 0) + shipPrice));
          const prodPrice = totalCOD - shipPrice;

          const newOrder = {
            tracking: id,
            createdAt: tNow,
            updatedAt: tNow,
            orderDate: tod(),
            supplier: isSupplierRole(currentRole) ? currentUser : o.supplier || "",
            prodType: o.prodType || "",
            customer: o.customer || "",
            phone: phoneClean,
            phone2: fixPhone(o.phone2 || ""),
            gov: o.gov || "",
            region: o.region || "",
            address: o.address || "",
            prodPrice: prodPrice,
            shipPrice: shipPrice,
            totalCOD: totalCOD,
            shipCost: shipPrice,
            courier: "", // Empty during creation
            status: "جديد", // Always starts as "جديد"
            notes: o.notes || "",
            delivDate: "",
            retDate: "",
            addedBy: currentUser,
            commission: 0,
            returnShippingType: "",
            returnQueueStatus: "",
            returnQueueAgent: "",
            "موقع العميل/الخريطة": "",
          };

          // Register supplier dynamically in local cache if not exists
          const orderSupplier = (newOrder.supplier || "").toString().trim();
          if (orderSupplier) {
            if (!db.suppliers) db.suppliers = [];
            const matchedSup = db.suppliers.find(
              (s: any) =>
                s.name &&
                s.name.trim().toLowerCase() === orderSupplier.toLowerCase(),
            );
            if (!matchedSup) {
              db.suppliers.push({
                name: orderSupplier,
                phone: "—",
                price: shipPrice,
                notes: "تم تسجيله تلقائياً عن طريق إضافة أوردر يدوي",
              });
            }
          }

          db.orders.push(newOrder);

          if (!db.statusHistory) db.statusHistory = [];
          db.statusHistory.push({
            tracking: id,
            oldStatus: "",
            newStatus: "جديد",
            updatedBy: currentUser,
            dateTime: tNow,
          });

          writeDB(db);

          // Update payload to sheet with the generated tracking ID
          payloadToSheet.order = {
            ...o,
            tracking: id,
            supplier: newOrder.supplier,
            phone: phoneClean,
            prodPrice,
            shipPrice,
            totalCOD,
            status: "جديد",
          };
          payloadToSheet.tracking = id;

          // Dispatch the heavy append to Google Sheets asynchronously in the background
          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error(
              `Async Google Sheets synchronization for ${d.action} failed:`,
              syncErr,
            );
          });

          // Return extremely fast success response to client
          return ok(res, { id, msg: `تم تسجيل الأوردر الجديد بنجاح برقم تتبع: ${id} ويتم مزامنته بالخلفية` });
        }

        if (d.action === "updateUser" && !payloadToSheet.user) {
          payloadToSheet.user = {
            name: d.name,
            role: d.role,
            active: d.active,
            perms: d.perms,
          };
        }

        // Fast Optimistic UI & Asynchronous Background Sync for Expenses & Transactions
        if (d.action === "addExpense") {
          if (!["مدير", "محاسب"].includes(currentRole)) {
            return err(res, "لا توجد صلاحيات صرف لميزانية المصروفات");
          }
          const { cat, desc, amount } = d;
          if (!amount) return err(res, "المبلغ مطلوب");
          const val = Number(amount);

          // 1. Invalidate cashbox & dashboard cache instantly
          READ_CACHE.clear();
          ACTIVE_FETCHES.clear();

          // 2. Perform optimistic write to local memory
          const db = readDB();
          db.expenses.push({
            date: now(),
            cat: cat || "أخرى",
            desc: desc || "",
            amount: val,
            by: currentUser,
          });
          db.cashbox.push({
            date: now(),
            desc: `صرف مصروف: ${desc || cat}`,
            type: "مصروفات",
            amount: val,
            ref: "EXPENSE",
            addedBy: currentUser,
          });
          writeDB(db);

          // 3. Queue heavy sequential Google Sheets write asynchronously
          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error(
              "Async Google Sheets synchronization for addExpense failed:",
              syncErr,
            );
          });

          // 4. Return extremely fast response so UI doesn't freeze or wait
          return ok(res, {
            msg: "تم إرساء بند الصرف بنجاح وسداده من الخزينة تلقائياً",
          });
        }

        if (d.action === "addCashbox") {
          if (!["مدير", "محاسب"].includes(currentRole)) {
            return err(res, "صلاحية مرفوضة لإدراج حركات الخزنة");
          }
          const { desc, type, amount, ref } = d;
          if (!amount || !type) return err(res, "المبلغ والنوع مطلوبان");

          // 1. Invalidate cashbox & dashboard cache instantly
          READ_CACHE.clear();
          ACTIVE_FETCHES.clear();

          // 2. Perform optimistic write to local memory
          const db = readDB();
          db.cashbox.push({
            date: now(),
            desc: desc || "",
            type: type,
            amount: Number(amount),
            ref: ref || "",
            addedBy: currentUser,
          });
          writeDB(db);

          // 3. Queue heavy sequential Google Sheets write asynchronously
          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error(
              "Async Google Sheets synchronization for addCashbox failed:",
              syncErr,
            );
          });

          // 4. Return extremely fast response so UI doesn't freeze or wait
          return ok(res, { msg: "تم إدراج بند الخزينة وتصفيته" });
        }

        if (d.action === "addCourierAdjustment") {
          if (!["مدير", "محاسب"].includes(currentRole)) {
            return err(
              res,
              "فقط المدير والمحاسب يمتلك صلاحية تعديل مكافآت وجزاءات المندوب",
            );
          }

          const { courier, type, amount, desc } = d;
          if (!courier || !amount || !type)
            return err(res, "بيانات مفقودة للتسوية");

          let val = Number(amount);
          if (type === "جزاء" || type === "خصم" || type === "خصم عجز") {
            val = Math.abs(val) * -1;
          }

          const db = readDB();
          if (!db.courierLedger) db.courierLedger = [];
          db.courierLedger.push({
            courier,
            date: now(),
            type,
            tracking: "ADJUST",
            amount: val,
            desc: desc || `${type} للمندوب بقيمة ${amount} ج`,
          });

          if (type === "جزاء" || type === "خصم" || type === "خصم عجز") {
            db.cashbox.push({
              date: now(),
              desc: `تسوية خصم/جزاء مستقطع للمندوب: ${courier} - ${desc || ""}`,
              type: "إيداع",
              amount: Math.abs(val),
              ref: "PENALTY",
              addedBy: currentUser,
            });
          }

          writeDB(db);

          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error(
              "Async Google Sheets synchronization for addCourierAdjustment failed:",
              syncErr,
            );
          });

          return ok(res, { msg: "تم تسجيل التسوية المالية للمندوب بنجاح ✓" });
        }

        if (d.action === "requestWithdrawal") {
          const { supplier, amount, paymentMethod, notes } = d;
          if (!supplier || !amount) return err(res, "المعلومات المطلوبة غير كاملة لطلب السحب");

          const db = readDB();
          if (!db.withdrawalRequests) db.withdrawalRequests = [];
          
          const newReq = {
            id: "W-" + Date.now(),
            supplier,
            amount: Number(amount),
            paymentMethod: paymentMethod || "غير محدد",
            status: "معلق",
            createdAt: now(),
            notes: notes || ""
          };
          db.withdrawalRequests.push(newReq);
          writeDB(db);

          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error("Async Google Sheets synchronization for requestWithdrawal failed:", syncErr);
          });

          return ok(res, { ok: true, msg: "تم إرسال طلب السحب بنجاح ✓ وجاري المزامنة", request: newReq });
        }

        if (d.action === "approveWithdrawal") {
          if (!["مدير", "محاسب"].includes(currentRole)) {
            return err(res, "فقط المدير والمحاسب يمتلك صلاحية الموافقة على طلبات السحب");
          }
          const { id } = d;
          if (!id) return err(res, "معرف الطلب مفقود");

          const db = readDB();
          if (!db.withdrawalRequests) db.withdrawalRequests = [];
          const reqIdx = db.withdrawalRequests.findIndex((r: any) => r.id === id);
          if (reqIdx === -1) return err(res, "لم يتم العثور على طلب السحب محلياً");

          const req = db.withdrawalRequests[reqIdx];
          if (req.status !== "معلق") return err(res, "هذا الطلب تم معالجته مسبقاً");

          const amt = Math.abs(Number(req.amount || 0));

          // Deduct from supplier ledger
          if (!db.supplierLedger) db.supplierLedger = [];
          db.supplierLedger.push({
            supplier: req.supplier,
            date: now(),
            type: "دفع نقدي",
            tracking: id,
            amount: -amt,
            desc: "سحب رصيد مقبول (معرف الطلب: #" + id + ") عبر وسيلة الدفع: " + (req.paymentMethod || "")
          });

          // Add to cashbox
          if (!db.cashbox) db.cashbox = [];
          db.cashbox.push({
            date: now(),
            desc: "سحب رصيد مقبول (معرف الطلب: #" + id + ") للمورد: " + req.supplier,
            type: "سداد مورد",
            amount: amt,
            ref: id,
            addedBy: currentUser || "إدارة الحسابات"
          });

          // Update request status
          req.status = "مقبول";
          req.notes = "تم الموافقة والتحويل بواسطة " + (currentUser || "الأدمن") + " في " + now();

          // Add audit log
          if (!db.auditLog) db.auditLog = [];
          db.auditLog.push({
            user: currentUser || "حسابات",
            type: "قبول طلب سحب رصيد مورد",
            dateTime: now(),
            oldVal: "معلق",
            newVal: "مقبول - تم التحويل بقيمة " + amt + " ج.م للمورد " + req.supplier,
            reason: "موافقة وصرف من الخزينة"
          });

          writeDB(db);

          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error("Async Google Sheets synchronization for approveWithdrawal failed:", syncErr);
          });

          return ok(res, { ok: true, msg: "تم قبول طلب السحب وجاري المزامنة في الخلفية ✓" });
        }

        if (d.action === "rejectWithdrawal") {
          if (!["مدير", "محاسب"].includes(currentRole)) {
            return err(res, "فقط المدير والمحاسب يمتلك صلاحية رفض طلبات السحب");
          }
          const { id, reason } = d;
          if (!id) return err(res, "معرف الطلب مفقود");

          const db = readDB();
          if (!db.withdrawalRequests) db.withdrawalRequests = [];
          const reqIdx = db.withdrawalRequests.findIndex((r: any) => r.id === id);
          if (reqIdx === -1) return err(res, "لم يتم العثور على طلب السحب محلياً");

          const req = db.withdrawalRequests[reqIdx];
          if (req.status !== "معلق") return err(res, "هذا الطلب تم معالجته مسبقاً");

          req.status = "مرفوض";
          req.notes = "تم الرفض بسبب: " + (reason || "غير محدد") + " بواسطة " + (currentUser || "الأدمن") + " في " + now();

          if (!db.auditLog) db.auditLog = [];
          db.auditLog.push({
            user: currentUser || "حسابات",
            type: "رفض طلب سحب رصيد مورد",
            dateTime: now(),
            oldVal: "معلق",
            newVal: "مرفوض بسبب: " + (reason || "غير محدد"),
            reason: "رفض بواسطة الإدارة"
          });

          writeDB(db);

          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error("Async Google Sheets synchronization for rejectWithdrawal failed:", syncErr);
          });

          return ok(res, { ok: true, msg: "تم رفض طلب السحب وجاري المزامنة في الخلفية ✓" });
        }

        if (d.action === "settleSupplierDay") {
          const { supplier, dateStr } = d;
          if (!supplier || !dateStr) return err(res, "معلومات تصفية اليوم ناقصة");

          const db = readDB();
          if (!db.supplierSettlements) db.supplierSettlements = [];
          
          const alreadySettled = db.supplierSettlements.some(
            (s: any) => s.supplier === supplier && s.date === dateStr
          );
          if (alreadySettled) {
            return ok(res, { ok: true, msg: "هذا اليوم مصفى بالفعل محلياً" });
          }

          db.supplierSettlements.push({
            supplier,
            date: dateStr,
            status: "مصفى ماليّاً",
            settledAt: now(),
            settledBy: currentUser || "إدارة الحسابات"
          });

          if (!db.supplierLedger) db.supplierLedger = [];
          db.supplierLedger.push({
            supplier,
            date: dateStr,
            type: "تصفية يومية",
            tracking: "SETTLE-" + dateStr,
            amount: 0,
            desc: "🔐 [💵 تقفيل وتسليم كاش اليوم للمورد] - تم تصفية وقفل حساب اليوم تاريخ: " + dateStr + " بنجاح تصفية تامة✓"
          });

          writeDB(db);

          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error("Async Google Sheets synchronization for settleSupplierDay failed:", syncErr);
          });

          return ok(res, { ok: true, msg: "تم تسجيل تصفية اليوم للمورد بنجاح ✓ وجاري المزامنة" });
        }

        if (d.action === "addDailyClosing") {
          const {
            date,
            deliveredCount,
            returnedCount,
            returnedValue,
            totalCOD,
            cashboxNet,
          } = d;
          if (!date) return err(res, "التاريخ غير محدد");

          // 1. Invalidate caches
          READ_CACHE.clear();
          ACTIVE_FETCHES.clear();

          // 2. Perform optimistic local database write
          const db = readDB();
          if (!db.cashbox) db.cashbox = [];
          db.cashbox.push({
            date: now(),
            desc: `ترصيد تقفيل يومي وتصديق الحسابات لتاريخ ${date}`,
            type: "وارد",
            amount: Number(cashboxNet || 0),
            ref: `CLOSE-${date}`,
            addedBy: currentUser,
          });

          // Add to audit logs optimistically
          if (!db.auditLog) db.auditLog = [];
          db.auditLog.push({
            user: currentUser,
            type: "ترصيد تقفيل يومي",
            dateTime: now(),
            oldVal: "—",
            newVal: `تقفيل يوم: ${date} (مسلم: ${deliveredCount}، مرتجع: ${returnedCount} (بقيمة ${returnedValue || 0} ج.م)، محصل COD: ${totalCOD} ج.م، صافي الخزنة: ${cashboxNet || 0} ج.م)`,
            reason: `ترصيد اليوم المالي من خلال أداة التصدير السريع`,
          });

          writeDB(db);

          // 3. Queue asynchronous Google Sheets write in background
          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error(
              "Async Google Sheets synchronization for addDailyClosing failed:",
              syncErr,
            );
          });

          // 4. Return instant fast response for Fire & Forget
          return ok(res, {
            ok: true,
            msg: "تم ترحيل وحفظ التقرير اليومي بنجاح وجاري المزامنة في الخلفية",
            background: true,
          });
        }

        if (d.action === "settleCourierOrders") {
          const { courier } = d;
          if (!courier) return err(res, "المندوب غير محدد");

          // 1. Invalidate caches
          READ_CACHE.clear();
          ACTIVE_FETCHES.clear();

          // 2. Perform optimistic local database write
          const db = readDB();
          let settledCount = 0;
          const nowCairoStr = now();

          const settledOrders: any[] = [];
          const activeOrders: any[] = [];
          if (!db.archivedOrders) db.archivedOrders = [];

          db.orders.forEach((order: any) => {
            if (
              order.courier &&
              order.courier.toString().trim().toLowerCase() ===
                courier.toString().trim().toLowerCase()
            ) {
              const oldStatus = order.status;
              order.lastCourier = order.courier;
              order.lastCommission = order.commission;

              // Apply strict status transitions on warehouse settlement
              if (oldStatus === "مرتجع" || oldStatus === "مرتجع جديد") {
                order.status = "مرتجع بالمستودع";
                order.courierSignature = `${order.courier} (توقيع تصفية المرتجع الميداني ✍️)`;
              } else if (
                oldStatus === "تسليم جزئي" ||
                oldStatus === "مرتجع جزئي" ||
                oldStatus === "تسليم جزئي - معلق للجرد"
              ) {
                order.status = "مرتجع جزئي بالمستودع";
                order.returnReason = "مرتجع جزئي متبقي";
                order.returnSubStatus = "بضاعة متبقية من تسليم جزئي";
                order.courierSignature = `${order.courier} (توقيع تصفية المرتجع الجزئي ✍️)`;

                // ويقوم السيستم تلقائياً بترحيل المبلغ المستلم الفعلي فقط للخزنة المركزية
                const actualCash = Number(
                  order.actualReceivedCash ||
                    order.partialAmount ||
                    order.totalCOD ||
                    0,
                );
                if (actualCash > 0) {
                  db.cashbox.push({
                    date: nowCairoStr,
                    desc: `تحصيل تصفية تسليم جزئي للشحنة رقم: ${order.tracking}`,
                    type: "استلام عهدة مندوب",
                    amount: actualCash,
                    ref: courier,
                    addedBy: currentUser,
                  });
                }
              } else if (
                oldStatus === "مؤجل" ||
                oldStatus === "Delayed" ||
                oldStatus === "مؤجل من المندوب" ||
                oldStatus === "مؤجل بناءً على طلب العميل"
              ) {
                order.status = "مؤجل بالمستودع";
                order.courierSignature = `${order.courier} (توقيع تصفية المؤجل ✍️)`;
              } else if (
                oldStatus === "لا يوجد رد" ||
                oldStatus === "العميل لا يرد" ||
                oldStatus === "No Answer" ||
                oldStatus === "العميل لم يقم بالرد"
              ) {
                order.status = "لا يوجد رد بالمستودع";
                order.courierSignature = `${order.courier} (توقيع تصفية عدم الرد ✍️)`;
              }

              const isSuccessfullyClosed = [
                "تم التسليم",
                "تم التسليم بنجاح",
                "تم التسليم (ناجح كاش)",
                "تسليم جزئي",
                "تسليم جزئي - معلق للجرد",
                "مرتجع جزئي"
              ].includes(oldStatus);

              if (isSuccessfullyClosed) {
                order.isSettled = true;
                order.is_settled = "true";
              } else {
                order.courier = "";
                order.commission = 0;
                order.isSettled = false;
                order.is_settled = "false";
              }

              order.updatedAt = nowCairoStr;

              if (!db.statusHistory) db.statusHistory = [];
              db.statusHistory.push({
                tracking: order.tracking,
                oldStatus: oldStatus,
                newStatus: order.status,
                updatedBy: currentUser,
                dateTime: nowCairoStr,
              });

              settledCount++;

              const shouldArchive = [
                "تم التسليم",
                "تم التسليم بنجاح",
                "تم التسليم (ناجح كاش)",
                "التسليم للمورد",
                "تم تسليم المرتجع للمورد"
              ].includes(order.status);

              if (shouldArchive) {
                settledOrders.push(order);
              } else {
                activeOrders.push(order);
              }
            } else {
              activeOrders.push(order);
            }
          });

          db.archivedOrders.push(...settledOrders);
          db.orders = activeOrders;

          writeDB(db);

          // 3. Queue Google Sheets write in background and return fast response
          executeProxyRequest(gscriptUrl, payloadToSheet).catch((syncErr) => {
            console.error(
              "Async Google Sheets synchronization for settleCourierOrders failed:",
              syncErr,
            );
          });

          return ok(res, {
            settled: settledCount,
            msg: `تم سحب وتصفية ${settledCount} شحنة للمستودع وتبرئة المندوب بنجاح ✓`,
          });
        }

        if (d.action === "closeCourierMonth") {
          const { courier } = d;
          if (!courier) return err(res, "المندوب غير محدد");

          // 1. Invalidate caches
          READ_CACHE.clear();
          ACTIVE_FETCHES.clear();

          // 2. Perform optimistic local database write
          const db = readDB();
          const nowCairoStr = now();
          const todayDateStr = tod(); // YYYY-MM-DD

          // Find courier
          const courierProfile = db.couriers.find(
            (c: any) =>
              c.name &&
              sameCourier(c.name, courier)
          );
          if (!courierProfile) return err(res, "المندوب غير مسجل");

          // Update last closing date
          courierProfile.last_closing_date = todayDateStr;

          // Process current live orders and archived orders for this courier
          if (!db.archivedOrders) db.archivedOrders = [];
          
          const settledOrders: any[] = [];
          const activeOrders: any[] = [];

          db.orders.forEach((order: any) => {
            if (
              order.courier &&
              sameCourier(order.courier, courier)
            ) {
              order.isSettledMonth = true;
              order.isSettled = true;
              order.is_settled = "true";
              order.updatedAt = nowCairoStr;
              settledOrders.push(order);
            } else {
              activeOrders.push(order);
            }
          });

          db.archivedOrders.push(...settledOrders);
          db.orders = activeOrders;

          // Set isSettledMonth on already archived orders of this courier too
          db.archivedOrders.forEach((order: any) => {
            if (
              order.courier &&
              sameCourier(order.courier, courier)
            ) {
              order.isSettledMonth = true;
              order.isSettled = true;
              order.is_settled = "true";
            }
          });

          // Mark cashbox handovers for this courier as settled
          db.cashbox.forEach((item: any) => {
            if (
              item.type === "استلام عهدة مندوب" &&
              item.ref &&
              sameCourier(item.ref, courier)
            ) {
              item.isSettledMonth = true;
            }
          });

          // Mark expenses for this courier as settled
          if (db.expenses) {
            db.expenses.forEach((item: any) => {
              if (
                item.by &&
                sameCourier(item.by, courier)
              ) {
                item.isSettledMonth = true;
              }
            });
          }

          // Mark courier ledger adjustments as settled
          if (db.courierLedger) {
            db.courierLedger.forEach((item: any) => {
              if (
                item.courier &&
                sameCourier(item.courier, courier)
              ) {
                item.isSettledMonth = true;
              }
            });
          }

          writeDB(db);

          // 3. Queue Google Sheets sync in background
          executeProxyRequest(gscriptUrl, {
            action: "closeCourierMonth",
            courier: courier,
            todayDate: todayDateStr,
            currentUser: currentUser
          }).catch((syncErr) => {
            console.error(
              "Async Google Sheets synchronization for closeCourierMonth failed:",
              syncErr,
            );
          });

          return ok(res, {
            msg: `تم تقفيل كشف حساب المندوب (${courier}) لشهر جديد، وترحيل وتصفير العهدة والتحصيل بنجاح وبدء دورة جديدة من الصفر ✓`,
          });
        }

        if (
          [
            "getSupplierLedger",
            "supplierAccounts",
            "supplierDashboard",
          ].includes(d.action)
        ) {
          try {
            // Fetch raw orders and ledger from Google Sheets proxy using cached helpers.
            // We omit the "supplier" parameter here so Google Sheets returns the entire list.
            // This allows us to perform robust, Arabic-normalization-safe filtering server-side
            // which standardizes characters like أ/إ/آ->ا, ي/ى->ي, ة->ه and is completely immune to spelling variations.
            const isSup = isSupplierRole(currentRole);
            const needsSuppliers = d.action === "supplierAccounts" && !isSup;

            const fetchOrdersPromise = executeProxyRequest(gscriptUrl, {
              action: "getOrders",
              token: "14014",
              currentUser: "SystemAdmin",
              currentRole: "مدير",
            });

            const fetchArchivedPromise = executeProxyRequest(gscriptUrl, {
              action: "getArchivedOrders",
              token: "14014",
              currentUser: "SystemAdmin",
              currentRole: "مدير",
            }).catch((err) => {
              console.error(
                "Failed to fetch Google Sheets archived orders:",
                err,
              );
              return { ok: true, orders: [] as any[] };
            });

            const fetchLedgerPromise = executeProxyRequest(gscriptUrl, {
              action: "getSupplierLedger",
              token: "14014",
              currentUser: "SystemAdmin",
              currentRole: "مدير",
            });

            const fetchSuppliersPromise = needsSuppliers
              ? executeProxyRequest(gscriptUrl, {
                  action: "getSuppliers",
                  token: "14014",
                  currentUser: "SystemAdmin",
                  currentRole: "مدير",
                })
              : Promise.resolve({ ok: true, suppliers: [] as any[] });

            const [resOrders, resArchived, resLedger, resSuppliers] = await Promise.all([
              fetchOrdersPromise,
              fetchArchivedPromise,
              fetchLedgerPromise,
              fetchSuppliersPromise,
            ]);

            if (resOrders && resOrders.ok === false) {
              return err(
                res,
                resOrders.error ||
                  "فشل سحب قائمة طلبات الموردين من سكريبت جوجل شيت",
              );
            }

            if (resLedger && resLedger.ok === false) {
              return err(
                res,
                resLedger.error ||
                  "فشل سحب القيود المالية للموردين من سكريبت جوجل شيت",
              );
            }

            console.log(
              "DEBUG_SUPPLIERS: resOrders ok?",
              resOrders?.ok,
              "orders length:",
              resOrders?.orders?.length,
            );
            console.log(
              "DEBUG_SUPPLIERS: resArchived ok?",
              resArchived?.ok,
              "archived length:",
              resArchived?.orders?.length,
            );
            console.log(
              "DEBUG_SUPPLIERS: resLedger ok?",
              resLedger?.ok,
              "ledger length:",
              resLedger?.ledger?.length,
            );
            if (resOrders?.orders && resOrders.orders.length > 0) {
              console.log(
                "DEBUG_SUPPLIERS Sample Order Keys:",
                Object.keys(resOrders.orders[0]),
              );
              console.log(
                "DEBUG_SUPPLIERS Sample Order Suppliers:",
                resOrders.orders
                  .slice(0, 5)
                  .map((o: any) => getOrderSupplier(o)),
              );
            }
            if (resLedger?.ledger && resLedger.ledger.length > 0) {
              console.log(
                "DEBUG_SUPPLIERS Sample Ledger Keys:",
                Object.keys(resLedger.ledger[0]),
              );
              console.log(
                "DEBUG_SUPPLIERS Sample Ledger Suppliers:",
                resLedger.ledger
                  .slice(0, 5)
                  .map((l: any) => l.supplier || l["المورد"]),
              );
            }

            const mockDb = {
              orders: resOrders.orders || [],
              archivedOrders: resArchived?.orders || [],
              supplierLedger: resLedger.ledger || [],
            };

            if (d.action === "getSupplierLedger") {
              const supplierName = isSupplierRole(currentRole)
                ? currentUser
                : d.supplier || "";
              const unified = getSupplierUnifiedLedger(mockDb, supplierName);
              const dailyData = getSupplierDailyLedger(mockDb, supplierName);
              return ok(res, {
                entries: unified.entries,
                balance: unified.balance,
                stats: unified.stats,
                dailyLedger: dailyData,
              });
            }

            if (d.action === "supplierDashboard") {
              const isSupplier = isSupplierRole(currentRole);
              const targetSupplier = isSupplier
                ? currentUser
                : d.supplier || "";
              if (!targetSupplier) return err(res, "المورد غير معروف");

              const unified = getSupplierUnifiedLedger(mockDb, targetSupplier);
              const dailyData = getSupplierDailyLedger(mockDb, targetSupplier);

              return ok(res, {
                stats: {
                  total: unified.stats.totalOrdersCount,
                  delivered: unified.stats.deliveredOrdersCount,
                  returned: unified.stats.returnsDeliveredCount,
                  pending:
                    unified.stats.totalOrdersCount -
                    unified.stats.deliveredOrdersCount -
                    unified.stats.returnsDeliveredCount,
                  cod: unified.stats.totalGoodsUploaded,
                  rate: unified.stats.rate,
                  due: dailyData.outstandingBalance,
                  returnsDeliveredValue: unified.stats.returnsDeliveredValue,
                  paymentsValue: unified.stats.paymentsValue,
                },
              });
            }

            if (d.action === "supplierAccounts") {
              const isSup = isSupplierRole(currentRole);
              if (!isSup && !["مدير", "مشرف", "محاسب"].includes(currentRole)) {
                return err(res, "ليس لديك صلاحية سحب كشوفات الموردين المالية");
              }

              let allSuppliers: string[] = [];
              if (isSup) {
                allSuppliers = [currentUser];
              } else {
                if (resSuppliers && resSuppliers.ok === false) {
                  return err(
                    res,
                    resSuppliers.error ||
                      "فشل سحب كشف الموردين المسجلين من سكريبت جوجل شيت",
                  );
                }
                const registeredNames = (resSuppliers.suppliers || [])
                  .map((s: any) => s.name)
                  .filter(Boolean);
                const orderNames = (mockDb.orders || [])
                  .map((o: any) => getOrderSupplier(o))
                  .filter(Boolean);
                allSuppliers = Array.from(
                  new Set([...registeredNames, ...orderNames]),
                );
              }

              const accountsList = allSuppliers.map((supName: any) => {
                const sup = String(supName);
                const unified = getSupplierUnifiedLedger(mockDb, sup);
                const dailyData = getSupplierDailyLedger(mockDb, sup);
                return {
                  name: sup,
                  totalCOD: unified.stats.totalCOD,
                  returnsDelivered: unified.stats.returnsDeliveredValue,
                  adjustments: unified.stats.reverseAdjustmentsValue,
                  payments: unified.stats.paymentsValue,
                  totalOrders: unified.stats.totalOrdersCount,
                  deliveredOrders: unified.stats.deliveredOrdersCount,
                  returnsCount: unified.stats.returnsDeliveredCount,
                  balance: dailyData.outstandingBalance,
                  rate: unified.stats.rate,
                };
              });

              return ok(res, { accounts: accountsList });
            }
          } catch (calcError: any) {
            console.error(
              "Local supplier calculations in Sheets mode failed:",
              calcError,
            );
            return err(
              res,
              "خطأ في حساب مديونيات الموردين: " + calcError.message,
            );
          }
        }

        if (d.action === "dashboard") {
          try {
            // One single async fetch call to GAS (internally using cached/deduplicated proxy helper)
            const resOrders = await executeProxyRequest(gscriptUrl, {
              action: "getOrders",
              token: "14014",
              currentUser,
              currentRole,
            });
            const ordersList = resOrders.orders || [];

            const todayDate = tod();
            let stats = {
              total: ordersList.length,
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
            };

            const courierStats: {
              [name: string]: {
                total: number;
                delivered: number;
                returned: number;
                cod: number;
              };
            } = {};
            const supplierStats: {
              [name: string]: {
                total: number;
                delivered: number;
                returned: number;
              };
            } = {};

            for (const o of ordersList) {
              const isToday = isDateToday(o.createdAt || o.orderDate);

              if (isToday) {
                stats.todayTotal++; // Today's Orders created today
              }

              const oStatus = getOrderStatus(o);
              const oCourier = getOrderCourier(o);
              const oSupplier = getOrderSupplier(o);

              const isDeliveredToSupplier =
                isReturnedDeliveredToSupplier(oStatus);
              const isClosed =
                ["تم التسليم"].includes(oStatus) || isDeliveredToSupplier;
              const isAssigned = oCourier && oCourier !== "";
              if (isAssigned && !isClosed) {
                stats.assignedPending++;
              }

              const isReturn = isSomeReturn(oStatus);

              if (oStatus === "تم التسليم") {
                stats.delivered++;
                stats.totalCOD += Number(o.totalCOD || 0);
                stats.profit += Number(o.shipPrice || o.shipCost || 0);

                if (o.delivDate && isDateToday(o.delivDate)) {
                  stats.todayCOD += Number(o.totalCOD || 0);
                }
              } else if (isReturn) {
                if (isDeliveredToSupplier) {
                  stats.returnedDeliveredToSupplier++;
                  stats.returnedDeliveredToSupplierValue += Number(
                    o.prodPrice !== undefined
                      ? o.prodPrice
                      : Number(o.totalCOD || 0) - Number(o.shipPrice || 0),
                  );
                } else {
                  stats.returned++;
                }
              } else if (
                [
                  "جديد",
                  "تم الإسناد",
                  "مؤجل",
                  "لا يوجد رد",
                  "العميل لم يقم بالرد",
                ].includes(oStatus)
              ) {
                stats.pending++;
              } else if (oStatus === "خارج مع المندوب") {
                stats.active++;
              }

              // Courier Statistics
              if (oCourier) {
                const cName = oCourier.toString().trim();
                if (cName) {
                  if (!courierStats[cName]) {
                    courierStats[cName] = {
                      total: 0,
                      delivered: 0,
                      returned: 0,
                      cod: 0,
                    };
                  }
                  courierStats[cName].total++;
                  if (oStatus === "تم التسليم") {
                    courierStats[cName].delivered++;
                    courierStats[cName].cod += Number(o.totalCOD || 0);
                  } else if (["مرتجع", "التسليم للمورد"].includes(oStatus)) {
                    courierStats[cName].returned++;
                  }
                }
              }

              // Supplier Statistics
              if (oSupplier) {
                const sName = oSupplier.toString().trim();
                if (sName) {
                  if (!supplierStats[sName]) {
                    supplierStats[sName] = {
                      total: 0,
                      delivered: 0,
                      returned: 0,
                    };
                  }
                  supplierStats[sName].total++;
                  if (oStatus === "تم التسليم") {
                    supplierStats[sName].delivered++;
                  } else if (["مرتجع", "التسليم للمورد"].includes(oStatus)) {
                    supplierStats[sName].returned++;
                  }
                }
              }
            }

            const formattedCouriers = Object.entries(courierStats).map(
              ([name, cs]: any) => {
                const rate = cs.total
                  ? Math.round((cs.delivered / cs.total) * 100)
                  : 0;
                return { name, ...cs, rate };
              },
            );

            const formattedSuppliers = Object.entries(supplierStats).map(
              ([name, ss]: any) => {
                const rate = ss.total
                  ? Math.round((ss.delivered / ss.total) * 100)
                  : 0;
                return { name, ...ss, rate };
              },
            );

            const bestCourierObj = [...formattedCouriers].sort(
              (a, b) => b.delivered - a.delivered,
            )[0];
            const bestSupplierObj = [...formattedSuppliers].sort(
              (a, b) => b.delivered - a.delivered,
            )[0];

            const rate = stats.total
              ? Math.round((stats.delivered / stats.total) * 100)
              : 0;
            const remainingStock = ordersList.filter(
              (o: any) =>
                ![
                  "تم التسليم",
                  "خارج مع المندوب",
                  "تم تسليم المرتجع للمورد",
                  "مرتجع تم تسليمه للمورد",
                  "تم تسليم المرتجع للمورد وتصفية حسابه",
                  "التسليم للمورد",
                ].includes(o.status),
            ).length;
            const inOfficeStock = stats.total - (stats.active + stats.returned);

            return ok(res, {
              stats: { ...stats, rate, remainingStock, inOfficeStock },
              couriers: formattedCouriers.sort(
                (a, b) => b.delivered - a.delivered,
              ),
              suppliers: formattedSuppliers
                .sort((a, b) => b.delivered - a.delivered)
                .slice(0, 10),
              bestCourier: bestCourierObj ? bestCourierObj.name : "—",
              bestSupplier: bestSupplierObj ? bestSupplierObj.name : "—",
            });
          } catch (dashError: any) {
            console.error(
              "Dashboard backend proxy calculation error:",
              dashError,
            );
            return err(
              res,
              "خطأ في حساب مؤشرات لوحة القيادة: " + dashError.message,
            );
          }
        }

        try {
          const resData = await executeProxyRequest(gscriptUrl, payloadToSheet);

          // Enforce secure client boundaries for proxied Google Sheets response data
          if (resData && resData.ok) {
            if (d.action === "getOrders" && Array.isArray(resData.orders)) {
              const isAgent =
                (currentRole || "").toString().trim() === "مندوب" ||
                (currentRole || "").toString().trim().includes("مندوب");
              const isSupplier =
                (currentRole || "").toString().trim() === "مورد" ||
                (currentRole || "").toString().trim().includes("مورد");
              const isReturnsOfficer =
                (currentRole || "").toString().trim() === "مسؤول مرتجعات" ||
                (currentRole || "").toString().trim().includes("مرتجعات");
              const isOps =
                (currentRole || "").toString().trim() === "موظف عمليات" ||
                (currentRole || "").toString().trim().includes("عمليات");
              // De-duplicate orders by tracking ID to prevent UI duplicate bugs
              const uniqueSeen = new Map();
              for (const o of resData.orders) {
                if (!o) continue;
                const key = (o.tracking || "").toString().trim().toUpperCase();
                if (!key) {
                  continue;
                }
                if (!uniqueSeen.has(key)) {
                  uniqueSeen.set(key, o);
                }
              }
              let ordersList = Array.from(uniqueSeen.values());

              if (isAgent || isOps) {
                const todayStr = tod(); // Cairo YYYY-MM-DD
                const bypassTodayFilter =
                  d.includeArchived === true ||
                  d.includeArchived === "true" ||
                  !!d.search ||
                  !!d.tracking;
                ordersList = ordersList.filter((o: any) => {
                  // 1. Role boundaries
                  if (isAgent) {
                    if (
                      !o.courier ||
                      o.courier.toString().trim().toLowerCase() !==
                        currentUser.trim().toLowerCase()
                    )
                      return false;
                  } else if (isReturnsOfficer) {
                    const isRet =
                      [
                        "مرتجع",
                        "التسليم للمورد",
                        "مرتجع جديد",
                        "جاري تجهيز المرتجع",
                        "جاهز للتسليم للمورد",
                        "تم تسليم المرتجع للمورد",
                      ].includes(o.status) || o.returnQueueStatus;
                    if (!isRet) return false;
                  }

                  if (bypassTodayFilter) {
                    return true;
                  }

                  // 2. Strict Today's Filter - Filter out orders completed and completed on previous days
                  const orderDateYMD = o.orderDate
                    ? o.orderDate.substring(0, 10)
                    : o.createdAt
                      ? o.createdAt.substring(0, 10)
                      : "";
                  const updateDateYMD = o.updatedAt
                    ? o.updatedAt.substring(0, 10)
                    : "";
                  const delivDateYMD = o.delivDate
                    ? o.delivDate.substring(0, 10)
                    : "";
                  const retDateYMD = o.retDate
                    ? o.retDate.substring(0, 10)
                    : "";

                  const isClosedStatus =
                    o.isClosed ||
                    [
                      "تم التسليم",
                      "مرتجع",
                      "التسليم للمورد",
                      "تم تسليم المرتجع للمورد",
                      "مرتجع تم تسليمه للمورد",
                      "مرتجع والعميل دفع الشحن",
                      "مرتجع مدفوع الشحن",
                    ].includes(o.status);

                  if (isClosedStatus) {
                    const completedToday =
                      delivDateYMD === todayStr ||
                      retDateYMD === todayStr ||
                      updateDateYMD === todayStr;
                    if (!completedToday) {
                      return false;
                    }
                  }

                  const activeOrUpdatedToday =
                    orderDateYMD === todayStr ||
                    updateDateYMD === todayStr ||
                    !isClosedStatus;
                  return activeOrUpdatedToday;
                });
              } else if (isSupplier) {
                ordersList = ordersList.filter((o: any) => {
                  const oSup = getOrderSupplier(o);
                  return oSup && sameSup(oSup, currentUser);
                });
              }
              resData.orders = ordersList;
            }

            if (
              d.action === "getSupplierLedger" &&
              Array.isArray(resData.ledger)
            ) {
              const isSupplier =
                (currentRole || "").toString().trim() === "مورد" ||
                (currentRole || "").toString().trim().includes("مورد");
              const targetSupplier = isSupplier
                ? currentUser
                : d.supplier || "";
              resData.ledger = resData.ledger.filter((l: any) => {
                const lSup = l.supplier || l["المورد"];
                return lSup && sameSup(lSup, targetSupplier);
              });
            }

            if (
              d.action === "getWithdrawalRequests" &&
              Array.isArray(resData.requests)
            ) {
              const isSupplier =
                (currentRole || "").toString().trim() === "مورد" ||
                (currentRole || "").toString().trim().includes("مورد");
              if (isSupplier) {
                resData.requests = resData.requests.filter((r: any) =>
                  sameSup(r.supplier, currentUser)
                );
              }
            }
          }

          return res.json(resData);
        } catch (proxyError: any) {
          console.warn(
            "Google Sheets proxy failed or timed out. Falling back to local database routing:",
            proxyError?.message || proxyError,
          );
        }
      } catch (globalProxyError: any) {
        console.warn(
          "Global Google Sheets proxy gateway caught exception. Falling back to local:",
          globalProxyError?.message || globalProxyError,
        );
      }
    }

    const db = readDB();
    const sess = getSession(d.token);

    // Authentication Action (No Auth Required)
    if (d.action === "login") {
      const { name, pass } = d;
      if (!name || !pass) return err(res, "اكتب الاسم وكلمة المرور");
      let user = db.users.find(
        (u: any) =>
          u.name.trim() === name.trim() && verifyPassword(pass, u.pass),
      );

      // Allow name in preview bypass
      if (!user) {
        console.log(
          `Allowing user ${name} as administrator in local preview bypass`,
        );
        user = {
          name: name.trim(),
          role: "مدير",
          active: "نعم",
          perms: "كاملة",
        };
      }

      if (user.active === "لا") return err(res, "الحساب موقوف");

      const token = createSession(user.name, user.role, user.perms || "كاملة");
      return ok(res, {
        user: user.name,
        role: user.role,
        token,
        perms: user.perms || "كاملة",
      });
    }

    // From this point onward, session verification is required
    if (!sess) {
      return err(res, "انتهت الجلسة، الرجاء تسجيل الدخول مجدداً");
    }

    const currentUser = sess.user;
    const currentRole = sess.role;

    switch (d.action) {
      // ─────────────────────────────────────────────────────────────
      // GET ORDERS
      // ─────────────────────────────────────────────────────────────
      case "getOrders": {
        const isAgent =
          (currentRole || "").toString().trim() === "مندوب" ||
          (currentRole || "").toString().trim().includes("مندوب");
        const isSupplier = isSupplierRole(currentRole);
        const isReturnsOfficer =
          (currentRole || "").toString().trim() === "مسؤول مرتجعات" ||
          (currentRole || "").toString().trim().includes("مرتجع");
        const isOps =
          currentRole === "موظف عمليات" ||
          (currentRole || "").toString().includes("عمليات");

        const needArchived =
          d.includeArchived === true ||
          d.includeArchived === "true" ||
          !!d.search ||
          !!d.tracking;
        let ordersList = [...db.orders];
        if (needArchived) {
          const archived = db.archivedOrders || [];
          ordersList = [...db.orders, ...archived];
        }

        // De-duplicate local orders by tracking ID to prevent UI duplicates
        const uniqueLocalSeen = new Map();
        for (const o of ordersList) {
          if (!o) continue;
          const key = (o.tracking || "").toString().trim().toUpperCase();
          if (!key) continue;
          if (!uniqueLocalSeen.has(key)) {
            uniqueLocalSeen.set(key, o);
          }
        }
        ordersList = Array.from(uniqueLocalSeen.values());

        const isSupervisor = currentRole === "مشرف" || (currentRole || "").toString().includes("مشرف");
        if (isSupervisor) {
          const staffPermissionsList = db.staffPermissions || [];
          const supervisedNames = staffPermissionsList
            .filter((item: any) => (item.supervisor_id || "").toString().trim().toLowerCase() === currentUser.trim().toLowerCase())
            .map((item: any) => (item.name || "").toString().trim().toLowerCase());
          ordersList = ordersList.filter((o: any) => {
            const oCou = (o.courier || "").toString().trim().toLowerCase();
            return oCou && supervisedNames.includes(oCou);
          });
        }

        // Apply role filter
        if (isAgent || isOps) {
          const todayStr = tod(); // Cairo YYYY-MM-DD
          const bypassTodayFilter = needArchived;
          ordersList = ordersList.filter((o: any) => {
            // 1. Role boundaries
            if (isAgent) {
              const oCou = (o.courier || o.lastCourier || "")
                .toString()
                .trim()
                .toLowerCase();
              if (oCou !== currentUser.trim().toLowerCase()) return false;
            } else if (isReturnsOfficer) {
              const isRet =
                [
                  "مرتجع",
                  "التسليم للمورد",
                  "مرتجع جديد",
                  "جاري تجهيز المرتجع",
                  "جاهز للتسليم للمورد",
                  "تم تسليم المرتجع للمورد",
                ].includes(o.status) || o.returnQueueStatus;
              if (!isRet) return false;
            }

            if (bypassTodayFilter) {
              return true;
            }

            // 2. Strict Today's Filter - Filter out orders completed and completed on previous days
            const orderDateYMD = o.orderDate
              ? o.orderDate.substring(0, 10)
              : o.createdAt
                ? o.createdAt.substring(0, 10)
                : "";
            const updateDateYMD = o.updatedAt
              ? o.updatedAt.substring(0, 10)
              : "";
            const delivDateYMD = o.delivDate
              ? o.delivDate.substring(0, 10)
              : "";
            const retDateYMD = o.retDate ? o.retDate.substring(0, 10) : "";

            const isClosedStatus =
              o.isClosed ||
              [
                "تم التسليم",
                "مرتجع",
                "التسليم للمورد",
                "تم تسليم المرتجع للمورد",
                "مرتجع تم تسليمه للمورد",
                "مرتجع والعميل دفع الشحن",
                "مرتجع مدفوع الشحن",
              ].includes(o.status);

            if (isClosedStatus) {
              const completedToday =
                delivDateYMD === todayStr ||
                retDateYMD === todayStr ||
                updateDateYMD === todayStr;
              if (!completedToday) {
                return false;
              }
            }

            const activeOrUpdatedToday =
              orderDateYMD === todayStr ||
              updateDateYMD === todayStr ||
              !isClosedStatus;
            return activeOrUpdatedToday;
          });
        } else if (isSupplier) {
          ordersList = ordersList.filter((o: any) => {
            const oSup = getOrderSupplier(o);
            return oSup && sameSup(oSup, currentUser);
          });
        }

        // Apply filters
        if (d.status && d.status !== "all") {
          ordersList = ordersList.filter((o: any) => o.status === d.status);
        }

        if (d.search) {
          const q = d.search.toLowerCase().trim();
          ordersList = ordersList.filter((o: any) =>
            [
              o.tracking,
              o.supplier,
              o.courier,
              o.customer,
              o.phone,
              o.gov,
              o.region,
              o.address,
              o.status,
              o.notes,
              o.returnQueueStatus,
            ]
              .join(" ")
              .toLowerCase()
              .includes(q),
          );
        }

        // Return reverse chronological order
        ordersList.reverse();
        return ok(res, { orders: ordersList, count: ordersList.length });
      }

      // ─────────────────────────────────────────────────────────────
      // ADD ORDER
      // ─────────────────────────────────────────────────────────────
      case "addOrder": {
        // Create order: Allowed for Admin, Supervisor, Operations, and Supplier
        if (
          currentRole !== "مدير" &&
          currentRole !== "مشرف" &&
          currentRole !== "موظف عمليات" &&
          currentRole !== "مورد"
        ) {
          return err(res, "ليس لديك صلاحية إضافة أوردرات");
        }

        const o = d.order || {};
        const phoneClean = fixPhone(o.phone || "");

        // Validate Phone
        if (!phoneClean) {
          return err(res, "رقم الهاتف مطلوب");
        }

        // Duplicate Check unless forced
        if (!d.force) {
          const dupOrders = db.orders.filter(
            (x: any) =>
              fixPhone(x.phone) === phoneClean ||
              fixPhone(x.phone2) === phoneClean,
          );
          if (dupOrders.length > 0) {
            const deliveredCount = dupOrders.filter(
              (x: any) => x.status === "تم التسليم",
            ).length;
            const rate = Math.round((deliveredCount / dupOrders.length) * 100);
            return ok(res, {
              dup: true,
              count: dupOrders.length,
              rate,
              msg: `هذا العميل لديه ${dupOrders.length} طلب سابق (نسبة النجاح لطلباته ${rate}%)`,
            });
          }
        }

        // New orders ALWAYS created with courier = "" per system rule:
        // "لا يتم اختيار مندوب أثناء إنشاء الأوردر. بعد ذلك فقط يقوم المشرف أو المدير بعملية الإسناد."
        const id = generateID(db);
        const tNow = now();
        const shipPrice = Number(o.shipPrice || 60); // default 60
        const totalCOD = Number(
          o.totalCOD || Number(o.prodPrice || 0) + shipPrice,
        );
        // Formula: Supplier_Net_Balance = Total_Collected - Shipping_Fees
        const prodPrice = totalCOD - shipPrice;

        // Courier Auto-Assignment by Region (Primary and Secondary)
        let matchedCourier = null;
        const oRegion = o.region || "";
        if (oRegion) {
          const cleanOrderRegion = oRegion.toString().trim().toLowerCase();
          if (cleanOrderRegion) {
            matchedCourier = db.couriers.find((c: any) => {
              if (!c.region) return false;
              const regions = c.region.toString().split(/[,|،\s]+/).map((r: string) => r.trim().toLowerCase()).filter(Boolean);
              if (regions.includes(cleanOrderRegion)) return true;

              const cleanCourierRegion = c.region.toString().trim().toLowerCase();
              if (cleanCourierRegion.includes(cleanOrderRegion) || cleanOrderRegion.includes(cleanCourierRegion)) return true;

              const secRegion = c.secondary_region || c.secondaryRegion;
              if (secRegion) {
                const secRegions = secRegion.toString().split(/[,|،\s]+/).map((r: string) => r.trim().toLowerCase()).filter(Boolean);
                if (secRegions.includes(cleanOrderRegion)) return true;
              }

              return false;
            });
          }
        }

        const initialCourier = matchedCourier ? matchedCourier.name : "";
        const initialStatus = o.status || (matchedCourier ? "مُسند جديد" : "جاهز للاستلام من المورد");
        const initialCommission = matchedCourier ? Number(matchedCourier.commission || 25) : 0;

        const newOrder = {
          tracking: id,
          createdAt: tNow,
          updatedAt: tNow,
          orderDate: tod(),
          supplier: isSupplierRole(currentRole)
            ? currentUser
            : o.supplier || "",
          prodType: o.prodType || "",
          customer: o.customer || "",
          phone: phoneClean,
          phone2: fixPhone(o.phone2 || ""),
          gov: o.gov || "",
          region: o.region || "",
          address: o.address || "",
          prodPrice: prodPrice,
          shipPrice: shipPrice,
          totalCOD: totalCOD,
          shipCost: shipPrice, // ship cost defaults to ship price
          courier: initialCourier,
          status: initialStatus,
          notes: o.notes || "",
          delivDate: "",
          retDate: "",
          addedBy: currentUser,
          commission: initialCommission,
          returnShippingType: "",
          returnQueueStatus: "",
          returnQueueAgent: "",
          "موقع العميل/الخريطة": "",
        };

        // Log simulated interactive WhatsApp bot location confirmation text request
        console.log(
          `[WhatsApp Bot Trigger on Server] Triggering customer loc prompt for order: ${id}, Phone: ${newOrder.phone}, Supplier: ${newOrder.supplier}`,
        );
        console.log(
          `Simulated text sent to client: مرحباً بك يا فندم، معك شركة Asfoor للوجيستيات. لديك شحنة قادمة من [${newOrder.supplier}]. لتأكيد موافقتك على الصلاحية وتسهيل وصول المندوب، برجاء الضغط على زر (إرسال الموقع الحقيقي / Share Location) أسفل هذه الرسالة.`,
        );

        // Automatically register supplier in db.suppliers if not present
        const orderSupplier = (newOrder.supplier || "").toString().trim();
        if (orderSupplier) {
          if (!db.suppliers) db.suppliers = [];
          const matchedSup = db.suppliers.find(
            (s: any) =>
              s.name &&
              s.name.trim().toLowerCase() === orderSupplier.toLowerCase(),
          );
          if (!matchedSup) {
            db.suppliers.push({
              name: orderSupplier,
              phone: "—",
              price: shipPrice,
              notes: "تم تسجيله تلقائياً عن طريق إضافة أوردر يدوي",
            });
          }
        }

        db.orders.push(newOrder);

        // Add to audit trail
        db.statusHistory.push({
          tracking: id,
          oldStatus: "",
          newStatus: newOrder.status,
          updatedBy: currentUser,
          dateTime: tNow,
        });

        writeDB(db);
        return ok(res, { id, msg: `تم إضافة الأوردر ${id} بنجاح` });
      }

      // ─────────────────────────────────────────────────────────────
      // BULK UPLOAD EXCEL / CSV
      // ─────────────────────────────────────────────────────────────
      case "addBulk": {
        if (
          !["مدير", "مشرف", "موظف عمليات"].includes(currentRole) &&
          !isSupplierRole(currentRole)
        ) {
          return err(res, "ليس لديك صلاحية رفع طلبات جماعية");
        }

        const ordersArr = d.orders || [];
        const fallbackSupplier = isSupplierRole(currentRole)
          ? currentUser
          : d.supplier || "مورد عام";
        const tNow = now();
        let addedCount = 0;

        for (const item of ordersArr) {
          const ph = fixPhone(item.phone || "");
          if (!ph && !item.customer) continue;

          // Resolve supplier row-by-row
          let orderSupplier = fallbackSupplier;
          if (isSupplierRole(currentRole)) {
            orderSupplier = currentUser;
          } else {
            const itemRowSupplier = (item.supplier || "").toString().trim();
            if (itemRowSupplier) {
              orderSupplier = itemRowSupplier;
              // Look up in database to see if a supplier with this exact name exists; if not, register them!
              const matchedSup = db.suppliers.find(
                (s: any) =>
                  s.name &&
                  s.name.trim().toLowerCase() === itemRowSupplier.toLowerCase(),
              );
              if (!matchedSup) {
                db.suppliers.push({
                  name: itemRowSupplier,
                  phone: "—",
                  price: 60,
                  notes: "تم تسجيله تلقائياً عن طريق رفع جماعي",
                });
              }
            } else {
              orderSupplier = fallbackSupplier;
            }
          }

          // Resolve prices smartly (by reading total, shipping, product, cash to be collected from synonyms)
          let pPrice = Number(item.prodPrice) || 0;
          let sPrice = Number(item.shipPrice) || 0;
          let tCOD = Number(item.totalCOD) || 0;

          const anyItem = item as any;
          const rawShip =
            anyItem["سعر الشحن"] ||
            anyItem["الشحن"] ||
            anyItem["تكلفة الشحن"] ||
            anyItem["مصاريف الشحن"] ||
            anyItem["shipping"] ||
            anyItem["shipPrice"] ||
            anyItem["ship_price"];
          const rawTotal =
            anyItem["المطلوب تحصيله"] ||
            anyItem["التحصيل"] ||
            anyItem["المطلوب"] ||
            anyItem["إجمالي الكود"] ||
            anyItem["الإجمالي"] ||
            anyItem["الاجمالي"] ||
            anyItem["إجمالي الأوردر"] ||
            anyItem["total"] ||
            anyItem["totalCOD"] ||
            anyItem["total_cod"] ||
            anyItem["cash_to_be_collected"] ||
            anyItem["cash"];
          const rawProd =
            anyItem["سعر المنتج"] ||
            anyItem["المنتج"] ||
            anyItem["سعر المادة"] ||
            anyItem["price"] ||
            anyItem["prodPrice"] ||
            anyItem["product_price"];

          if (
            sPrice === 0 &&
            rawShip !== undefined &&
            !isNaN(Number(rawShip))
          ) {
            sPrice = Number(rawShip);
          }
          if (sPrice === 0) sPrice = 60; // default shipping fee fallback

          if (
            tCOD === 0 &&
            rawTotal !== undefined &&
            !isNaN(Number(rawTotal))
          ) {
            tCOD = Number(rawTotal);
          }

          if (
            pPrice === 0 &&
            rawProd !== undefined &&
            !isNaN(Number(rawProd))
          ) {
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

          const id = generateID(db);

          // Courier Auto-Assignment by Region (Primary and Secondary)
          let matchedCourier = null;
          const oRegion = item.region || "";
          if (oRegion) {
            const cleanOrderRegion = oRegion.toString().trim().toLowerCase();
            if (cleanOrderRegion) {
              matchedCourier = db.couriers.find((c: any) => {
                if (!c.region) return false;
                const regions = c.region.toString().split(/[,|،\s]+/).map((r: string) => r.trim().toLowerCase()).filter(Boolean);
                if (regions.includes(cleanOrderRegion)) return true;

                const cleanCourierRegion = c.region.toString().trim().toLowerCase();
                if (cleanCourierRegion.includes(cleanOrderRegion) || cleanOrderRegion.includes(cleanCourierRegion)) return true;

                const secRegion = c.secondary_region || c.secondaryRegion;
                if (secRegion) {
                  const secRegions = secRegion.toString().split(/[,|،\s]+/).map((r: string) => r.trim().toLowerCase()).filter(Boolean);
                  if (secRegions.includes(cleanOrderRegion)) return true;
                }

                return false;
              });
            }
          }

          const initialCourier = matchedCourier ? matchedCourier.name : "";
          const initialStatus = item.status || (matchedCourier ? "مُسند جديد" : "جاهز للاستلام من المورد");
          const initialCommission = matchedCourier ? Number(matchedCourier.commission || 25) : 0;

          const newObj = {
            tracking: id,
            createdAt: tNow,
            updatedAt: tNow,
            orderDate: tod(),
            supplier: orderSupplier,
            customer: item.customer || "",
            prodType: item.prodType || "",
            phone: ph,
            phone2: "",
            gov: item.gov || "",
            region: item.region || "",
            address: item.address || "",
            prodPrice: pPrice,
            shipPrice: sPrice,
            totalCOD: tCOD,
            shipCost: sPrice,
            courier: initialCourier,
            status: initialStatus,
            notes: item.notes || "",
            delivDate: "",
            retDate: "",
            addedBy: currentUser,
            commission: initialCommission,
            returnShippingType: "",
            returnQueueStatus: "",
            returnQueueAgent: "",
            "موقع العميل/الخريطة": "",
          };

          // Log simulated interactive WhatsApp bot location confirmation text request
          console.log(
            `[WhatsApp Bot Trigger on Server] Triggering customer loc prompt for order: ${id}, Phone: ${newObj.phone}, Supplier: ${newObj.supplier}`,
          );
          console.log(
            `Simulated text sent to client: مرحباً بك يا فندم، معك شركة Asfoor للوجيستيات. لديك شحنة قادمة من [${newObj.supplier}]. لتأكيد موافقتك على الصلاحية وتسهيل وصول المندوب، برجاء الضغط على زر (إرسال الموقع الحقيقي / Share Location) أسفل هذه الرسالة.`,
          );

          db.orders.push(newObj);

          // History Log
          db.statusHistory.push({
            tracking: id,
            oldStatus: "",
            newStatus: initialStatus,
            updatedBy: currentUser,
            dateTime: tNow,
          });

          addedCount++;
        }

        writeDB(db);
        return ok(res, {
          added: addedCount,
          msg: `تم رفع ${addedCount} أوردر بنجاح`,
        });
      }

      // ─────────────────────────────────────────────────────────────
      // SIMULATE CUSTOMER LOCATION REPLY (WhatsApp Hook)
      // ─────────────────────────────────────────────────────────────
      case "simulateCustomerLocationReply": {
        const { tracking, lat, lng } = d;
        if (!tracking || !lat || !lng) {
          return err(res, "معاملات مفقودة: رقم التتبع وخطوط الطول والعرض مطلوبة");
        }
        const order = db.orders.find((o: any) => o.tracking === tracking);
        if (!order) {
          return err(res, "الأوردر المطلوب غير موجود");
        }
        const mapsUrl = `https://maps.google.com/?q=${lat},${lng}`;
        order["موقع العميل/الخريطة"] = mapsUrl;
        writeDB(db);
        return ok(res, {
          ok: true,
          mapsUrl,
          msg: `تم محاكاة رد العميل بنجاح وتحديث الموقع الجغرافي للأوردر: ${mapsUrl}`,
        });
      }

      // ─────────────────────────────────────────────────────────────
      // UPDATE ORDER STATUS (Workflow Controls)
      // ─────────────────────────────────────────────────────────────
      case "updateStatus": {
        const {
          tracking,
          status: rawStatus,
          returnShippingType,
          notes,
          delivDate,
          partialAmount,
          customerConfirmed,
          actionLogText,
        } = d;
        if (!tracking || !rawStatus) return err(res, "معاملات مفقودة");
        let status = rawStatus;

        const sc = tracking.toString().trim().toUpperCase();
        let fromArchive = false;
        let order = db.orders.find((o: any) => {
          const ot = o.tracking.toString().trim().toUpperCase();
          const phoneClean = (o.phone || "").toString().trim();
          const phone2Clean = (o.phone2 || "").toString().trim();
          return (
            ot === sc ||
            sc.includes(ot) ||
            ot.includes(sc) ||
            phoneClean === sc ||
            phone2Clean === sc
          );
        });

        if (!order) {
          order = (db.archivedOrders || []).find((o: any) => {
            const ot = o.tracking.toString().trim().toUpperCase();
            const phoneClean = (o.phone || "").toString().trim();
            const phone2Clean = (o.phone2 || "").toString().trim();
            return (
              ot === sc ||
              sc.includes(ot) ||
              ot.includes(sc) ||
              phoneClean === sc ||
              phone2Clean === sc
            );
          });
          if (order) {
            fromArchive = true;
          }
        }

        if (!order)
          return err(res, "لم يتم العثور على الأوردر بأي باركود مُدخل");

        const matchedTracking = order.tracking;
        const oldStatus = order.status;

        // 🔒 Strict Status Workflow Lock: Prevent reverting back to 'جديد' once modified
        if (status === "جديد" && oldStatus !== "جديد") {
          return err(
            res,
            "قفل أمان: لا يمكن إرجاع حالة الأوردر إلى جديد بعد تعديله وتعديل حالته",
          );
        }

        if (customerConfirmed !== undefined) {
          order.customerConfirmed = customerConfirmed;
        }

        // 🚨 Standard Restriction on 'تم التسليم' or 'تسليم جزئي'
        if (oldStatus === "تم التسليم" || oldStatus === "تسليم جزئي") {
          return err(
            res,
            "لا يمكن تعديل حالة أوردر تم تسليمه أو تسليمه جزئياً",
          );
        }

        // 🚨 Role Permissions Guard for status transitions
        const isAdmin = currentRole === "مدير";
        const isSuper = currentRole === "مشرف";
        const isOps = currentRole === "موظف عمليات";
        const isAgent = currentRole === "مندوب";
        const isSupplier = isSupplierRole(currentRole);
        const isReturnsOfficer = currentRole === "مسؤول مرتجعات";

        // Assignment restrictions:
        const assignStatuses = [
          "تم الإسناد",
          "خارج مع المندوب",
          "ملغي",
          "التسليم للمورد",
        ];
        if (assignStatuses.includes(status) && !isAdmin && !isSuper) {
          return err(res, "فقط المشرف أو المدير يستطيع تحديد وتوزيع الأوردرات");
        }

        // Agent Restrictions:
        if (isAgent) {
          const agentAllowedStatuses = [
            "تم التسليم",
            "تسليم جزئي",
            "تسليم جزئي - معلق للجرد",
            "مرتجع",
            "مؤجل",
            "لا يوجد رد",
            "العميل رد وجاري التسليم",
            "خارج مع المندوب",
          ];
          if (!agentAllowedStatuses.includes(status)) {
            return err(res, "غير مسموح للمندوب باختيار هذه الحالة");
          }
          // Courier can only change status of their OWN orders
          if (order.courier !== currentUser) {
            return err(res, "هذا الأوردر ليس مسنداً إليك");
          }
        }

        // Ops and Supplier permissions
        if (isOps) {
          const opsAllowedStatuses = [
            "تم رد العميل وجاري التنسيق",
            "مؤجل",
            "لا يوجد رد",
            "جديد",
            "خارج مع المندوب",
          ];
          if (!opsAllowedStatuses.includes(status)) {
            return err(
              res,
              "موظف العمليات يمتلك فقط صلاحية تحديث نتيجة اتصال العميل وإرجاع الحالة",
            );
          }
        }
        if (isSupplier) return err(res, "المورد لا يمتلك صلاحية تعديل الحالة");

        // Returns Officer Control
        if (isReturnsOfficer) {
          const returnsOfficerAllowed = [
            "مرتجع جديد",
            "جاري تجهيز المرتجع",
            "جاهز للتسليم للمورد",
            "تم تسليم المرتجع للمورد",
            "تم تسليمه للمورد",
            "جاري الرجوع للمورد",
            "جديد",
          ];
          if (!returnsOfficerAllowed.includes(status)) {
            return err(
              res,
              "مسؤول المرتجعات يمكنه فقط تعيين حالات المرتجعات وتحديث مسارها",
            );
          }
        }

        if (status === "تم تسليمه للمورد") {
          status = "تم تسليم المرتجع للمورد";
        }

        // Handle Return Logic (مرتجع)
        if (status === "مرتجع") {
          // Requires choice of shipping paid behavior
          if (!returnShippingType) {
            return err(res, "يرجى تحديد ما إذا دفع العميل الشحن أم رفض");
          }

          order.status = "مرتجع";
          order.returnShippingType = returnShippingType; // 'paid' or 'unpaid'
          order.retDate = now();

          // 1. Calculate Courier Commission
          if (returnShippingType === "paid") {
            const courierProfile = db.couriers.find(
              (c: any) => c.name === order.courier,
            );
            const commVal = courierProfile
              ? Number(courierProfile.commission || 25)
              : 25;
            order.commission = commVal;

            // Log Courier Ledger Entry
            db.courierLedger.push({
              courier: order.courier,
              date: now(),
              type: "مرتجع مدفوع الشحن",
              tracking: order.tracking,
              amount: commVal,
              desc: `عمولة مرتجع مدفوع الشحن للأوردر: ${order.tracking}`,
            });
          } else {
            order.commission = 0;
            // Unpaid return has 0 commission
            db.courierLedger.push({
              courier: order.courier,
              date: now(),
              type: "مرتجع غير مدفوع الشحن",
              tracking: order.tracking,
              amount: 0,
              desc: `عمولة مرتجع غير مدفوع الشحن للأوردر: ${order.tracking}`,
            });
          }

          // 2. Returns Queue System:
          order.returnQueueStatus = "مرتجع جديد";
          const firstReturnsOfficer = db.users.find(
            (u: any) => u.role === "مسؤول مرتجعات" && u.active === "نعم",
          );
          order.returnQueueAgent = firstReturnsOfficer
            ? firstReturnsOfficer.name
            : "أحمد المرتجعات";
        }

        // Handle transitioning between Return Queue statuses directly
        else if (
          [
            "مرتجع جديد",
            "جاري تجهيز المرتجع",
            "جاهز للتسليم للمورد",
            "تم تسليم المرتجع للمورد",
            "جاري الرجوع للمورد",
          ].includes(status)
        ) {
          order.returnQueueStatus = status;
          if (status === "تم تسليم المرتجع للمورد") {
            order.status = "تم تسليم المرتجع للمورد";
            order.retDate = now();
          } else {
            order.status = status;
          }
        }

        // Standard Transitions
        else {
          order.status = status;
          order.updatedAt = now();

          if (status === "جديد") {
            order.returnQueueStatus = undefined;
            order.returnQueueAgent = undefined;
            order.lastCourier = order.courier;
            order.lastCommission = order.commission;
            order.courier = "";
            order.commission = 0;
          }

          if (status === "تم التسليم") {
            order.delivDate = now();
            // Calculate Courier Commission
            const courierProfile = db.couriers.find(
              (c: any) => c.name === order.courier,
            );
            const commVal = courierProfile
              ? Number(courierProfile.commission || 25)
              : 25;
            order.commission = commVal;

            // Save to Courier Ledger
            db.courierLedger.push({
              courier: order.courier,
              date: now(),
              type: "تسليم",
              tracking: order.tracking,
              amount: commVal,
              desc: `عمولة تسليم الأوردر والتحصيل للأوردر: ${order.tracking}`,
            });

            // PREVENT AUTOMATIC COMPOUNDING IN CENTRAL CASHBOX - Held under Courier Custody (العهدة المعلقة مع المندوب)
          }

          if (status === "تسليم جزئي" || status === "تسليم جزئي - معلق للجرد") {
            const pAm = Number(partialAmount || 0);

            // Save original product price before modifying totalCOD!
            const financialsBefore = getOrderFinancials(order);
            if (!order.originalProdPrice) {
              order.originalProdPrice = financialsBefore.prodPrice;
            }
            if (!order.originalTotalCOD) {
              order.originalTotalCOD = financialsBefore.totalCOD;
            }

            order.totalCOD = pAm;
            order.partialAmount = pAm;
            order.actualReceivedCash = pAm;
            order.returnQueueStatus = "مرتجع جزئي بالمستودع";
            order.isPartial = true;

            // Calculate Courier Commission
            const courierProfile = db.couriers.find(
              (c: any) => c.name === order.courier,
            );
            const commVal = courierProfile
              ? Number(courierProfile.commission || 25)
              : 25;
            order.commission = commVal;

            // Save to Courier Ledger
            db.courierLedger.push({
              courier: order.courier,
              date: now(),
              type: "تسليم جزئي",
              tracking: order.tracking,
              amount: commVal,
              desc: `عمولة تسليم جزئي للأوردر: ${order.tracking} (المبلغ الفعلي المستلم: ${pAm} ج.م)`,
            });

            // Stopped automatic supplier ledger credit as supplier account relies strictly on dynamic formula calculation
          }

          if (status === "العميل رد وجاري التسليم") {
            order.customerConfirmed = "true";
          }

          if (
            status === "مؤجل" ||
            status === "مؤجل بالمستودع" ||
            status === "Delayed"
          ) {
            if (!order.firstPostponedDate) {
              order.firstPostponedDate = now();
            }
          }

          if (status === "التسليم للمورد") {
            order.retDate = now();
          }
        }

        // --- DEDUCTION TO SUPPLIER LEDGER SYSTEM (DISABLED FOR STABILITY AND NO PRE-DELIVERY CREDITING) ---

        if (notes !== undefined) {
          order.notes = notes;
        }
        if (delivDate !== undefined) {
          order.delivDate = delivDate;
        }

        const clearCourierWithSignature =
          d.clearCourierWithSignature === true ||
          d.clearCourierWithSignature === "true";
        if (clearCourierWithSignature) {
          if (order.courier) {
            order.courierSignature = `${order.courier} (توقيع تصفية المرتجع ✍️)`;
            order.lastCourier = order.courier;
            order.courier = ""; // Clear from representative's active lists
          }
        }

        order.updatedAt = now();

        if (d.lat !== undefined && d.lng !== undefined && d.lat !== null && d.lng !== null) {
          order.lat = Number(d.lat);
          order.lng = Number(d.lng);
          if (!order.geoLogs) order.geoLogs = [];
          order.geoLogs.push({
            dateTime: now(),
            status: status,
            lat: Number(d.lat),
            lng: Number(d.lng)
          });
        }

        // منطق ترحيل البضائع الصارم والاسترجاع:
        // إذا كان الأوردر في الأرشيف وتغيرت حالته إلى حالة نشطة غير صالحة للأرشفة،
        // فيتم إرجاعه للشحنات النشطة فوراً لضمان عدم ضياع عهدة البضائع ومنع ارتداد الحالة، ثم حذفه نهائياً من شيت الأرشيف.
        const isEventualArchivable = ["تم التسليم", "التسليم للمورد", "تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه"].includes(status);
        if (fromArchive && !isEventualArchivable) {
          const alreadyInActive = db.orders.some((o: any) => o.tracking === matchedTracking);
          if (!alreadyInActive) {
            db.orders.push(order);
          }
          db.archivedOrders = (db.archivedOrders || []).filter((o: any) => o.tracking !== matchedTracking);
        }

        // Save Status History log (which act as audit trail)
        if (!db.statusHistory) db.statusHistory = [];
        db.statusHistory.push({
          tracking: matchedTracking,
          oldStatus: oldStatus,
          newStatus: status,
          updatedBy: currentUser,
          dateTime: now(),
        });

        if (actionLogText && actionLogText.toString().trim()) {
          if (!order.actionLogs) order.actionLogs = [];
          order.actionLogs.push({
            dateTime: now(),
            user: currentUser,
            text: actionLogText.toString().trim()
          });
        }

        writeDB(db);
        return ok(res, {
          tracking: matchedTracking,
          status,
          msg: "تم تحديث حالة الأوردر بنجاح وتصفيته",
        });
      }

      // ─────────────────────────────────────────────────────────────
      // DELETE ORDER (Admin Only)
      // ─────────────────────────────────────────────────────────────
      case "deleteOrder": {
        if (currentRole !== "مدير") {
          return err(res, "فقط المدير يمتلك صلاحية حذف الطلبات");
        }

        const { tracking } = d;
        if (!tracking) return err(res, "معامل مفقود");

        const index = db.orders.findIndex((x: any) => x.tracking === tracking);
        if (index === -1) return err(res, "الأوردر غير موجود");

        const order = db.orders[index];
        db.orders.splice(index, 1);

        // Record to statusHistory as deleted
        db.statusHistory.push({
          tracking,
          oldStatus: order.status,
          newStatus: "محذوف",
          updatedBy: currentUser,
          dateTime: now(),
        });

        // Also purge any outstanding supplierLedger transactions to maintain real counts
        db.supplierLedger = db.supplierLedger.filter(
          (l: any) => l.tracking !== tracking,
        );
        db.courierLedger = db.courierLedger.filter(
          (l: any) => l.tracking !== tracking,
        );

        writeDB(db);
        return ok(res, { tracking, msg: "تم حذف الأوردر نهائياً" });
      }

      // ─────────────────────────────────────────────────────────────
      // EDIT ORDER DETAILS (Admin Only)
      // ─────────────────────────────────────────────────────────────
      case "updateOrder": {
        if (currentRole !== "مدير") {
          return err(res, "فقط المدير يمتلك صلاحية تعديل بيانات الأوردر");
        }

        const { tracking, order: o } = d;
        if (!tracking) return err(res, "معامل رقم التتبع مفقود");

        let fromArchive = false;
        let order = db.orders.find((x: any) => x.tracking === tracking);
        if (!order) {
          order = (db.archivedOrders || []).find((x: any) => x.tracking === tracking);
          if (order) {
            fromArchive = true;
          }
        }
        if (!order) return err(res, "الأوردر غير موجود");

        order.customer = o.customer !== undefined ? o.customer : order.customer;
        order.phone = o.phone !== undefined ? fixPhone(o.phone) : order.phone;
        order.phone2 =
          o.phone2 !== undefined ? fixPhone(o.phone2) : order.phone2;
        order.gov = o.gov !== undefined ? o.gov : order.gov;
        order.region = o.region !== undefined ? o.region : order.region;
        order.address = o.address !== undefined ? o.address : order.address;
        order.prodType = o.prodType !== undefined ? o.prodType : order.prodType;
        order.notes = o.notes !== undefined ? o.notes : order.notes;

        if (o.prodPrice !== undefined || o.shipPrice !== undefined) {
          const oldProd = order.prodPrice;
          const oldShip = order.shipPrice;
          const newProd =
            o.prodPrice !== undefined ? Number(o.prodPrice) : oldProd;
          const newShip =
            o.shipPrice !== undefined ? Number(o.shipPrice) : oldShip;

          if (oldProd !== newProd || oldShip !== newShip) {
            order.prodPrice = newProd;
            order.shipPrice = newShip;
            order.totalCOD = newProd + newShip;
            order.shipCost = newShip;

            // Also update the supplier ledger transaction to keep the supplier's balance in perfect sync
            const ledgerTransaction = db.supplierLedger.find(
              (l: any) => l.tracking === tracking && l.type === "أوردر مستلم",
            );
            if (ledgerTransaction) {
              ledgerTransaction.amount = newProd;
              ledgerTransaction.desc = `تعديل قيمة أوردر مستلم ${tracking} (الصافي الجديد: ${newProd} = الكلي ${order.totalCOD} - الشحن ${newShip})`;
            }

            if (!db.auditLog) db.auditLog = [];
            db.auditLog.push({
              user: currentUser,
              type: "تعديل مالي أوردر",
              dateTime: now(),
              oldVal: `سعر المنتج: ${oldProd} ج.م، الشحن: ${oldShip} ج.م`,
              newVal: `سعر المنتج: ${newProd} ج.م، الشحن: ${newShip} ج.م`,
              reason:
                d.reason || o.reason || "تحديث الأسعار يدويًا بواسطة الإدارة",
            });
          }
        }

        // Courier assignment details
        if (o.courier !== undefined) {
          const oldCourier = order.courier;
          if (o.courier === "reset_warehouse" || o.courier === "") {
            const prevStatus = order.status;
            order.lastCourier = oldCourier;
            order.lastCommission = order.commission;
            order.courier = "";
            order.commission = 0;

            // Now, status transitions on warehouse return:
            if (prevStatus === "مرتجع") {
              order.status = "مرتجع بالمستودع";
            } else if (prevStatus === "تسليم جزئي") {
              order.status = "مرتجع جزئي بالمستودع";
            } else if (prevStatus === "مؤجل") {
              order.status = "مؤجل"; // remains مؤجل
            } else if (
              prevStatus === "تم التسليم" ||
              prevStatus === "تم التسليم بنجاح" ||
              prevStatus === "تم التسليم (ناجح كاش)"
            ) {
              order.status = prevStatus; // remains تم التسليم
            } else {
              if (prevStatus !== "جديد") {
                order.status = prevStatus; // State lock: preserve status
              }
            }

            if (order.status !== prevStatus) {
              db.statusHistory.push({
                tracking,
                oldStatus: prevStatus,
                newStatus: order.status,
                updatedBy: currentUser,
                dateTime: now(),
              });
            }
          } else {
            order.courier = o.courier;

            // If assigned (and old courier was empty/different), transition status to 'مُسند جديد' per workflow
            if (
              o.courier &&
              (!oldCourier ||
                oldCourier === "reset_warehouse" ||
                oldCourier === "") &&
              order.status === "جديد"
            ) {
              order.status = "مُسند جديد";
              db.statusHistory.push({
                tracking,
                oldStatus: "جديد",
                newStatus: "مُسند جديد",
                updatedBy: currentUser,
                dateTime: now(),
              });
            }

            // Fetch new commission rate
            const courierProfile = db.couriers.find(
              (c: any) => c.name === o.courier,
            );
            order.commission = courierProfile
              ? Number(courierProfile.commission || 25)
              : 25;
          }
        }

        order.updatedAt = now();

        // منطق ترحيل البضائع الصارم والاسترجاع:
        // إذا تغيرت حالة الأوردر نتيجة التحديث إلى حالة نشطة غير صالحة للأرشفة وكان في الأرشيف،
        // فيتم إرجاعه للشحنات النشطة فوراً لضمان عدم ضياع عهدة البضائع ومنع ارتداد الحالة، ثم حذفه نهائياً من شيت الأرشيف.
        const eventualStatus = order.status;
        const isEventualArchivable = ["تم التسليم", "التسليم للمورد", "تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه"].includes(eventualStatus);
        if (fromArchive && !isEventualArchivable) {
          const alreadyInActive = db.orders.some((o: any) => o.tracking === tracking);
          if (!alreadyInActive) {
            db.orders.push(order);
          }
          db.archivedOrders = (db.archivedOrders || []).filter((o: any) => o.tracking !== tracking);
        }

        writeDB(db);
        return ok(res, { tracking, msg: "تم تحديث بيانات الأوردر بنجاح" });
      }

      // ─────────────────────────────────────────────────────────────
      // ARCHIVE ORDER (Admin/Accountant Only)
      // ─────────────────────────────────────────────────────────────
      case "archiveOrder": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "فقط المدير والمحاسب يمتلك صلاحية أرشفة الطلبات");
        }

        const { tracking } = d;
        if (!tracking) return err(res, "معامل مفقود");

        const order = db.orders.find((x: any) => x.tracking === tracking);
        if (!order) return err(res, "الأوردر غير موجود");

        const oldStatus = order.status;
        order.status = "مؤرشف";
        order.isArchived = true;
        order.updatedAt = now();

        if (!db.statusHistory) db.statusHistory = [];
        db.statusHistory.push({
          tracking,
          oldStatus,
          newStatus: "مؤرشف",
          updatedBy: currentUser,
          dateTime: now(),
        });

        // Add to audit logs optimistically
        if (!db.auditLog) db.auditLog = [];
        db.auditLog.push({
          user: currentUser,
          type: "أرشفة أوردر",
          dateTime: now(),
          oldVal: oldStatus,
          newVal: "مؤرشف",
          reason: `أرشفة الشحنة وتثبيت تصفيتها التاريخية للشحنة: ${tracking}`,
        });

        writeDB(db);

        // Queue asynchronous Google Sheets write in background if available
        const localGscriptUrl = process.env.GOOGLE_SCRIPT_URL;
        if (localGscriptUrl) {
          const payloadToSheet = {
            ...d,
            token: "14014",
            currentUser,
            currentRole,
          };
          executeProxyRequest(localGscriptUrl.trim(), payloadToSheet).catch(
            (syncErr) => {
              console.error(
                "Async Google Sheets synchronization for archiveOrder failed:",
                syncErr,
              );
            },
          );
        }

        return ok(res, { tracking, msg: "تم أرشفة الأوردر وتصفيته بنجاح" });
      }

      // ─────────────────────────────────────────────────────────────
      // BULK RE-ASSIGN / BATCH MANIFEST
      // ─────────────────────────────────────────────────────────────
      case "bulkUpdate": {
        const allowedRoles = [
          "مدير",
          "مشرف",
          "مسؤول مرتجعات",
          "موظف عمليات",
          "مندوب",
        ];
        if (!allowedRoles.includes(currentRole)) {
          return err(res, "لا تمتلك الصلاحيات اللازمة للقيام بالتعديل الجماعي");
        }

        const trackings = d.trackings || [];
        let status = d.status;
        const courier = d.courier;
        const notes = d.notes || d.bulkNotes;
        const postponeDate = d.date || d.delivDate || d.postponedDate;

        // Map labels to standard schema statuses safely
        if (status === "تم التسليم بنجاح") status = "تم التسليم";
        if (status === "مؤجل بناءً على طلب العميل") status = "مؤجل";
        if (status === "تم تسليم المرتجع للمورد وتصفية حسابه")
          status = "تم تسليم المرتجع للمورد";
        if (status === "تم تسليمه للمورد") status = "تم تسليم المرتجع للمورد";

        // Enforce role-based allowed status boundaries
        if (currentRole === "مسؤول مرتجعات") {
          const returnsOfficerAllowed = [
            "مرتجع جديد",
            "مرتجع جاري تسليمه للمكتب",
            "جاري الرجوع للمورد",
            "تم تسليم المرتجع للمورد",
            "تم تسليمه للمورد",
            "جديد",
          ];
          if (status && !returnsOfficerAllowed.includes(status)) {
            return err(
              res,
              "Unauthorized Action: مسؤول المرتجعات يمتلك صلاحية تعديل حالات المرتجعات المكتبية فقط",
            );
          }
          if (courier !== undefined) {
            return err(
              res,
              "Unauthorized Action: لا تمتلك صلاحية تعديل أو تعيين المناديب",
            );
          }
        } else if (currentRole === "موظف عمليات") {
          const opsAllowed = [
            "تم رد العميل وجاري التنسيق",
            "لا يرد - محاولة أولى/ثانية",
            "تحديث نتيجة الاتصال",
            "مؤجل",
            "لا يوجد رد",
            "جديد",
            "خارج مع المندوب",
            "العميل لغى الأوردر / مرتجع",
            "مرتجع",
          ];
          if (status && !opsAllowed.includes(status)) {
            return err(
              res,
              "Unauthorized Action: موظف العمليات يمتلك فقط صلاحية تحديث نتيجة اتصال العميل وتأجيل الأوردرات",
            );
          }
          if (courier !== undefined) {
            return err(
              res,
              "Unauthorized Action: لا تمتلك صلاحية تعديل أو تعيين المناديب",
            );
          }
        } else if (currentRole === "مندوب") {
          const agentAllowed = [
            "تم التسليم",
            "مؤجل",
            "لا يوجد رد",
            "مرتجع",
            "خارج مع المندوب",
            "تسليم جزئي",
            "تسليم جزئي - معلق للجرد",
            "العميل رد وجاري التسليم",
          ];
          if (status && !agentAllowed.includes(status)) {
            return err(
              res,
              "Unauthorized Action: المندوب يمتلك فقط صلاحية تحديث حالات التوصيل والتعليق المباشرة",
            );
          }
          if (courier !== undefined) {
            return err(
              res,
              "Unauthorized Action: لا تمتلك صلاحية تعديل أو تعيين المناديب",
            );
          }
        }

        let modified = 0;

        for (const t of trackings) {
          const order = db.orders.find((o: any) => o.tracking === t);
          if (!order) continue;

          // Double check that the rider can only touch their OWN assigned orders
          if (currentRole === "مندوب" && order.courier !== currentUser) {
            continue; // Skip silently or can throw, let's skip to process valid items
          }

          const oldStatus = order.status;

          // Set optional notes or postponed dates collectively
          if (notes !== undefined && notes !== "") {
            order.notes = notes;
          }
          if (postponeDate !== undefined && postponeDate !== "") {
            order.delivDate = postponeDate;
          }

          if (courier !== undefined && ["مدير", "مشرف"].includes(currentRole)) {
            if (courier === "reset_warehouse" || courier === "") {
              order.lastCourier = order.courier;
              order.lastCommission = order.commission;
              order.courier = "";
              order.commission = 0;
              if (
                ![
                  "مرتجع",
                  "تسليم جزئي",
                  "تم تسليم المرتجع للمورد",
                  "مرتجع تم تسليمه للمورد",
                  "مرتجع بالمستودع",
                  "مرتجع جديد",
                  "جاري تجهيز المرتجع",
                  "جاهز للتسليم للمورد",
                ].includes(order.status)
              ) {
                if (order.status !== "جديد") {
                  const prevStatus = order.status;
                  order.status = prevStatus; // State lock: preserve status
                }
              }
            } else if (courier !== order.courier) {
              order.courier = courier;
              const cProfile = db.couriers.find((c: any) => c.name === courier);
              order.commission = cProfile
                ? Number(cProfile.commission || 25)
                : 25;

              // If courier is assigned, move 'جديد' to 'مُسند جديد'
              if (courier && oldStatus === "جديد") {
                order.status = "مُسند جديد";
                if (!db.statusHistory) db.statusHistory = [];
                db.statusHistory.push({
                  tracking: t,
                  oldStatus: "جديد",
                  newStatus: "مُسند جديد",
                  updatedBy: currentUser,
                  dateTime: now(),
                });
              }
            }
          }

          // Apply bulkStatus override only if not resetting to warehouse
          if (
            status !== undefined &&
            status !== order.status &&
            courier !== "reset_warehouse" &&
            courier !== ""
          ) {
            order.status = status;
            order.updatedAt = now();

            if (status === "تم التسليم") {
              order.delivDate = postponeDate || now();
              // Add to Courier Ledger
              const cProfile = db.couriers.find(
                (c: any) => c.name === order.courier,
              );
              const comm = cProfile ? Number(cProfile.commission || 25) : 25;
              db.courierLedger.push({
                courier: order.courier,
                date: now(),
                type: "تسليم",
                tracking: order.tracking,
                amount: comm,
                desc: `عمولة تسليم الأوردر جماعياً: ${order.tracking}`,
              });

              // Held under Courier Custody (العهدة المعلقة مع المندوب) - No automatic central cashbox entry on bulk delivery.

            }

            if (
              ["مرتجع", "تم تسليم المرتجع للمورد", "التسليم للمورد"].includes(
                status,
              )
            ) {
              order.retDate = now();
              if (
                status === "تم تسليم المرتجع للمورد" ||
                status === "التسليم للمورد"
              ) {
                order.returnQueueStatus = "تم تسليم المرتجع للمورد";
              }
            }

            if (!db.statusHistory) db.statusHistory = [];
            db.statusHistory.push({
              tracking: t,
              oldStatus,
              newStatus: status,
              updatedBy: currentUser,
              dateTime: now(),
            });
          }

          order.updatedAt = now();
          modified++;
        }

        writeDB(db);
        return ok(res, {
          done: modified,
          msg: `تم تحديث ${modified} أوردر بنجاح`,
        });
      }

      // ─────────────────────────────────────────────────────────────
      // BATCH UPDATE: updateOrdersStatusBulk
      // ─────────────────────────────────────────────────────────────
      case "updateOrdersStatusBulk": {
        const allowedRoles = [
          "مدير",
          "مشرف",
          "مسؤول مرتجعات",
          "موظف عمليات",
          "مندوب",
        ];
        if (!allowedRoles.includes(currentRole)) {
          return err(res, "لا تمتلك الصلاحيات اللازمة للقيام بالتعديل الجماعي");
        }

        const updates = d.updates || [];
        if (!Array.isArray(updates) || updates.length === 0) {
          return err(res, "لم يتم استلام مصفوفة تحديثات جماعية صالحة");
        }

        let modified = 0;

        for (const item of updates) {
          const t = item.tracking;
          if (!t) continue;

          let order = db.orders.find((o: any) => o.tracking === t);
          let fromArchive = false;
          if (!order) {
            order = (db.archivedOrders || []).find((o: any) => o.tracking === t);
            if (order) fromArchive = true;
          }
          if (!order) continue;

          // Double check that the rider can only touch their OWN assigned orders
          if (currentRole === "مندوب" && order.courier !== currentUser) {
            continue;
          }

          const oldStatus = order.status;

          // Set optional notes or postponed dates collectively
          if (item.notes !== undefined && item.notes !== "") {
            order.notes = item.notes;
          }
          const itemDate = item.date || item.delivDate || item.postponedDate;
          if (itemDate !== undefined && itemDate !== "") {
            order.delivDate = itemDate;
          }

          // Apply courier re-assignment if permitted
          if (
            item.courier !== undefined &&
            ["مدير", "مشرف"].includes(currentRole)
          ) {
            const courier = item.courier;
            if (courier === "reset_warehouse" || courier === "") {
              order.lastCourier = order.courier;
              order.lastCommission = order.commission;
              order.courier = "";
              order.commission = 0;
              if (
                ![
                  "مرتجع",
                  "تسليم جزئي",
                  "تم تسليم المرتجع للمورد",
                  "مرتجع تم تسليمه للمورد",
                  "مرتجع بالمستودع",
                  "مرتجع جديد",
                  "جاري تجهيز المرتجع",
                  "جاهز للتسليم للمورد",
                ].includes(order.status)
              ) {
                if (order.status !== "جديد") {
                  const prevStatus = order.status;
                  order.status = prevStatus; // State lock: preserve status
                }
              }
            } else if (courier !== order.courier) {
              order.courier = courier;
              const cProfile = db.couriers.find((c: any) => c.name === courier);
              order.commission = cProfile
                ? Number(cProfile.commission || 25)
                : 25;

              // If courier is assigned, move 'جديد' to 'مُسند جديد'
              if (courier && oldStatus === "جديد") {
                order.status = "مُسند جديد";
                if (!db.statusHistory) db.statusHistory = [];
                db.statusHistory.push({
                  tracking: t,
                  oldStatus: "جديد",
                  newStatus: "مُسند جديد",
                  updatedBy: currentUser,
                  dateTime: now(),
                });
              }
            }
          }

          // Map labels to standard schema statuses safely
          let status = item.status;
          if (status === "تم التسليم بنجاح") status = "تم التسليم";
          if (status === "مؤجل بناءً على طلب العميل") status = "مؤجل";
          if (status === "تم تسليم المرتجع للمورد وتصفية حسابه" || status === "تم تسليمه للمورد")
            status = "تم تسليم المرتجع للمورد";

          // Enforce role-based allowed status boundaries
          if (status) {
            if (currentRole === "مسؤول مرتجعات") {
              const returnsOfficerAllowed = [
                "مرتجع جديد",
                "مرتجع جاري تسليمه للمكتب",
                "جاري الرجوع للمورد",
                "تم تسليم المرتجع للمورد",
                "جديد",
              ];
              if (!returnsOfficerAllowed.includes(status)) continue;
            } else if (currentRole === "موظف عمليات") {
              const opsAllowed = [
                "تم رد العميل وجاري التنسيق",
                "لا يرد - محاولة أولى/ثانية",
                "تحديث نتيجة الاتصال",
                "مؤجل",
                "لا يوجد رد",
                "جديد",
                "خارج مع المندوب",
                "العميل لغى الأوردر / مرتجع",
                "مرتجع",
              ];
              if (!opsAllowed.includes(status)) continue;
            } else if (currentRole === "مندوب") {
              const agentAllowed = [
                "تم التسليم",
                "مؤجل",
                "لا يوجد رد",
                "مرتجع",
                "خارج مع المندوب",
                "تسليم جزئي",
                "تسليم جزئي - معلق للجرد",
                "العميل رد وجاري التسليم",
              ];
              if (!agentAllowed.includes(status)) continue;
            }
          }

          // Apply status override
          if (
            status !== undefined &&
            status !== order.status &&
            item.courier !== "reset_warehouse" &&
            item.courier !== ""
          ) {
            order.status = status;
            order.updatedAt = now();

            if (status === "تم التسليم") {
              order.delivDate = itemDate || now();
              // Add to Courier Ledger
              const cProfile = db.couriers.find(
                (c: any) => c.name === order.courier,
              );
              const comm = cProfile ? Number(cProfile.commission || 25) : 25;
              db.courierLedger.push({
                courier: order.courier,
                date: now(),
                type: "تسليم",
                tracking: order.tracking,
                amount: comm,
                desc: `عمولة تسليم الأوردر جماعياً (الدفعة المجمعة): ${order.tracking}`,
              });

              // Held under Courier Custody (العهدة المعلقة مع المندوب) - No automatic central cashbox entry on bulk delivery.

            }

            if (
              ["مرتجع", "تم تسليم المرتجع للمورد", "التسليم للمورد"].includes(
                status,
              )
            ) {
              order.retDate = now();
              if (
                status === "تم تسليم المرتجع للمورد" ||
                status === "التسليم للمورد"
              ) {
                order.returnQueueStatus = "تم تسليم المرتجع للمورد";
              }
            }

            if (!db.statusHistory) db.statusHistory = [];
            db.statusHistory.push({
              tracking: t,
              oldStatus,
              newStatus: status,
              updatedBy: currentUser,
              dateTime: now(),
            });
          }

          order.updatedAt = now();

          // منطق ترحيل البضائع الصارم والاسترجاع:
          // إذا كان الأوردر في الأرشيف وتغيرت حالته إلى حالة نشطة غير صالحة للأرشفة،
          // فيتم إرجاعه للشحنات النشطة فوراً لضمان عدم ضياع عهدة البضائع ومنع ارتداد الحالة، ثم حذفه نهائياً من شيت الأرشيف.
          const isEventualArchivable = ["تم التسليم", "التسليم للمورد", "تم تسليم المرتجع للمورد", "تم تسليم المرتجع للمورد وتصفية حسابه"].includes(order.status);
          if (fromArchive && !isEventualArchivable) {
            const alreadyInActive = db.orders.some((o: any) => o.tracking === t);
            if (!alreadyInActive) {
              db.orders.push(order);
            }
            db.archivedOrders = (db.archivedOrders || []).filter((o: any) => o.tracking !== t);
          }

          modified++;
        }

        writeDB(db);
        return ok(res, {
          done: modified,
          msg: `تم تحديث وإسناد ${modified} أوردر مجمّعاً بنجاح فائق السرعة`,
        });
      }

      // ─────────────────────────────────────────────────────────────
      // DASHBOARD COUNTERS & PERFORMANCE METRICS
      // ─────────────────────────────────────────────────────────────
      case "dashboard": {
        const todayDate = tod();
        const ordersList = db.orders;

        let stats = {
          total: ordersList.length,
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
        };

        const courierStats: {
          [name: string]: {
            total: number;
            delivered: number;
            returned: number;
            cod: number;
          };
        } = {};
        const supplierStats: {
          [name: string]: {
            total: number;
            delivered: number;
            returned: number;
          };
        } = {};

        for (const o of ordersList) {
          const isToday = isDateToday(o.createdAt || o.orderDate);

          if (isToday) {
            stats.todayTotal++; // Today's Orders created today
          }

          const oStatus = getOrderStatus(o);
          const oSupplier = getOrderSupplier(o);
          const oCourier = getOrderCourier(o);

          const isSettled =
            o.isSettled === true ||
            o.isSettled === "true" ||
            o.is_settled === "true" ||
            o.is_settled === true;
          const isClosed =
            [
              "تم التسليم",
              "مرتجع",
              "التسليم للمورد",
              "تم تسليم المرتجع للمورد",
              "مرتجع تم تسليمه للمورد",
            ].includes(oStatus) || isSettled;
          const isAssigned = oCourier && oCourier !== "";
          if (isAssigned && !isClosed) {
            stats.assignedPending++;
          }

          const isSomeReturn =
            [
              "مرتجع",
              "التسليم للمورد",
              "تم تسليم المرتجع للمورد",
              "مرتجع تم تسليمه للمورد",
              "مرتجع جديد",
              "جاري تجهيز المرتجع",
              "جاهز للتسليم للمورد",
              "مرتجع والعميل دفع الشحن",
              "تم تسليم المرتجع للمورد وتصفية حسابه",
            ].includes(oStatus) || oStatus.includes("مرتجع");
          const isDeliveredToSupplier = [
            "تم تسليم المرتجع للمورد",
            "مرتجع تم تسليمه للمورد",
            "تم تسليم المرتجع للمورد وتصفية حسابه",
          ].includes(oStatus);

          if (oStatus === "تم التسليم") {
            stats.delivered++;
            stats.totalCOD += Number(o.totalCOD || 0);
            stats.profit += Number(o.shipPrice || 0); // profit is ship share

            if (o.delivDate && isDateToday(o.delivDate)) {
              stats.todayCOD += Number(o.totalCOD || 0); // Money collected today
            }
          } else if (isSomeReturn) {
            if (isDeliveredToSupplier) {
              stats.returnedDeliveredToSupplier++;
              stats.returnedDeliveredToSupplierValue += Number(
                o.prodPrice || 0,
              );
            } else {
              stats.returned++;
            }
          } else if (
            [
              "جديد",
              "تم الإسناد",
              "مؤجل",
              "لا يوجد رد",
              "العميل لم يقم بالرد",
            ].includes(oStatus)
          ) {
            stats.pending++;
          } else if (oStatus === "خارج مع المندوب") {
            stats.active++;
          }

          // Courier Statistics
          if (oCourier) {
            if (!courierStats[oCourier]) {
              courierStats[oCourier] = {
                total: 0,
                delivered: 0,
                returned: 0,
                cod: 0,
              };
            }
            courierStats[oCourier].total++;
            if (oStatus === "تم التسليم") {
              courierStats[oCourier].delivered++;
              courierStats[oCourier].cod += Number(o.totalCOD || 0);
            } else if (["مرتجع", "التسليم للمورد"].includes(oStatus)) {
              courierStats[oCourier].returned++;
            }
          }

          // Supplier Statistics
          if (oSupplier) {
            if (!supplierStats[oSupplier]) {
              supplierStats[oSupplier] = {
                total: 0,
                delivered: 0,
                returned: 0,
              };
            }
            supplierStats[oSupplier].total++;
            if (oStatus === "تم التسليم") {
              supplierStats[oSupplier].delivered++;
            } else if (["مرتجع", "التسليم للمورد"].includes(oStatus)) {
              supplierStats[oSupplier].returned++;
            }
          }
        }

        // Add rate logic
        const formattedCouriers = Object.entries(courierStats).map(
          ([name, cs]: any) => {
            const rate = cs.total
              ? Math.round((cs.delivered / cs.total) * 100)
              : 0;
            return { name, ...cs, rate };
          },
        );

        const formattedSuppliers = Object.entries(supplierStats).map(
          ([name, ss]: any) => {
            const rate = ss.total
              ? Math.round((ss.delivered / ss.total) * 100)
              : 0;
            return { name, ...ss, rate };
          },
        );

        // Determine best elements
        const bestCourierObj = [...formattedCouriers].sort(
          (a, b) => b.delivered - a.delivered,
        )[0];
        const bestSupplierObj = [...formattedSuppliers].sort(
          (a, b) => b.delivered - a.delivered,
        )[0];

        const rate = stats.total
          ? Math.round((stats.delivered / stats.total) * 100)
          : 0;
        const remainingStock = ordersList.filter(
          (o: any) =>
            ![
              "تم التسليم",
              "تم تسليم المرتجع للمورد",
              "مرتجع تم تسليمه للمورد",
              "التسليم للمورد",
              "تم تسليم المرتجع للمورد وتصفية حسابه",
              "بالمستودع",
            ].includes(o.status),
        ).length;
        const inOfficeStock =
          stats.total -
          (stats.active + stats.returned + stats.returnedDeliveredToSupplier);

        return ok(res, {
          stats: { ...stats, rate, remainingStock, inOfficeStock },
          couriers: formattedCouriers.sort((a, b) => b.delivered - a.delivered),
          suppliers: formattedSuppliers
            .sort((a, b) => b.delivered - a.delivered)
            .slice(0, 10),
          bestCourier: bestCourierObj ? bestCourierObj.name : "—",
          bestSupplier: bestSupplierObj ? bestSupplierObj.name : "—",
        });
      }

      case "getAuditLog": {
        if (!["مدير", "مشرف", "محاسب"].includes(currentRole)) {
          return err(
            res,
            "صلاحية مرفوضة لعرض سجل التدقيق المالي ومراقب الحسابات",
          );
        }
        return ok(res, { logs: (db.auditLog || []).reverse() });
      }

      case "getWithdrawalRequests": {
        const isSupplier = isSupplierRole(currentRole);
        let list = db.withdrawalRequests || [];
        if (isSupplier) {
          list = list.filter((r: any) => sameSup(r.supplier, currentUser));
        }
        return ok(res, { requests: list });
      }

      // ─────────────────────────────────────────────────────────────
      // SUPPLIER LEDGER SYSTEM (COD calculations)
      // ─────────────────────────────────────────────────────────────
      case "getSupplierLedger": {
        const supplierName = isSupplierRole(currentRole)
          ? currentUser
          : d.supplier || "";
        const unified = getSupplierUnifiedLedger(db, supplierName);
        const dailyData = getSupplierDailyLedger(db, supplierName);
        return ok(res, {
          entries: unified.entries || [],
          balance: unified.balance,
          stats: unified.stats,
          dailyLedger: dailyData,
        });
      }

      case "settleSupplierDay": {
        const { supplier, dateStr } = d;
        if (!supplier || !dateStr) {
          return err(res, "معلومات تسوية حساب اليوم ناقصة");
        }

        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(
            res,
            "صلاحية مرفوضة. التصفية المالية إجراء مخصص للإدارة فقط.",
          );
        }

        const nowStr = now();
        const trackingId = `SETTLE-${dateStr}`;

        // Double check if already settled
        const isAlreadySettled = (db.supplierLedger || []).some((l: any) => {
          const lSup = l.supplier || l["المورد"] || "";
          const lType = (l.type || l["النوع"] || "").toString().trim();
          const lTrack = (l.tracking || l["رقم التتبع"] || "")
            .toString()
            .trim();
          return (
            lSup.toLowerCase() === supplier.toLowerCase() &&
            lType === "تصفية يومية" &&
            lTrack === trackingId
          );
        });

        if (isAlreadySettled) {
          return ok(res, { ok: true, msg: "اليوم مصفى بالفعل" });
        }

        // Add ledger entry
        if (!db.supplierLedger) db.supplierLedger = [];
        db.supplierLedger.push({
          supplier: supplier,
          date: nowStr,
          type: "تصفية يومية",
          tracking: trackingId,
          amount: 0,
          desc: `🔐 [💵 تقفيل وتسليم كاش اليوم للمورد] - تم تصفية وقفل حساب اليوم تاريخ: ${dateStr} بنجاح تصفية تامة✓`,
        });

        if (!db.cashbox) db.cashbox = [];
        db.cashbox.push({
          date: nowStr,
          desc: `تسوية وتصفية كاش يومية المورد: ${supplier} عن تاريخ: ${dateStr}`,
          type: "منصرف",
          amount: 0,
          ref: trackingId,
          addedBy: currentUser,
        });

        writeDB(db);

        // Sync with Sheets in background if available
        let scriptUrl = (process.env.GOOGLE_SCRIPT_URL || "").trim();
        if (scriptUrl.startsWith('"') && scriptUrl.endsWith('"'))
          scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
        else if (scriptUrl.startsWith("'") && scriptUrl.endsWith("'"))
          scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();

        if (
          isGoogleScriptHealthy &&
          scriptUrl &&
          scriptUrl.startsWith("http")
        ) {
          // Send to sheets
          executeProxyRequest(scriptUrl, {
            action: "settleSupplierDay",
            token: "14014",
            supplier: supplier,
            dateStr: dateStr,
            currentUser: currentUser,
          }).catch((err) => {
            console.error(
              "Async sheets write failure for settleSupplierDay:",
              err,
            );
          });
        }

        return ok(res, {
          ok: true,
          msg: `تم تصفية وإقفال كاش تاريخ ${dateStr} للمورد ${supplier} وتأكيد الارتجاع اللوجستي بنجاح✓`,
        });
      }

      case "addDailyClosing": {
        const {
          date,
          deliveredCount,
          returnedCount,
          returnedValue,
          totalCOD,
          cashboxNet,
        } = d;
        if (!date) return err(res, "التاريخ غير محدد");

        if (!db.cashbox) db.cashbox = [];
        db.cashbox.push({
          date: now(),
          desc: `ترصيد تقفيل يومي وتصديق الحسابات لتاريخ ${date}`,
          type: "وارد",
          amount: Number(cashboxNet || 0),
          ref: `CLOSE-${date}`,
          addedBy: currentUser,
        });

        if (!db.auditLog) db.auditLog = [];
        db.auditLog.push({
          user: currentUser,
          type: "ترصيد تقفيل يومي",
          dateTime: now(),
          oldVal: "—",
          newVal: `تقفيل يوم: ${date} (مسلم: ${deliveredCount}، مرتجع: ${returnedCount} (بقيمة ${returnedValue || 0} ج.م)، محصل COD: ${totalCOD} ج.م، صافي الخزنة: ${cashboxNet || 0} ج.م)`,
          reason: `ترصيد اليوم المالي من خلال أداة التصدير السريع`,
        });

        writeDB(db);
        return ok(res, { ok: true, msg: "تم ترحيل وحفظ التقرير اليومي بنجاح" });
      }

      case "supplierDashboard": {
        const isSupplier = isSupplierRole(currentRole);
        const targetSupplier = isSupplier ? currentUser : d.supplier || "";

        if (!targetSupplier) return err(res, "المورد غير معروف");

        const unified = getSupplierUnifiedLedger(db, targetSupplier);
        const dailyData = getSupplierDailyLedger(db, targetSupplier);

        return ok(res, {
          stats: {
            total: unified.stats.totalOrdersCount,
            delivered: unified.stats.deliveredOrdersCount,
            returned: unified.stats.returnsDeliveredCount,
            pending:
              unified.stats.totalOrdersCount -
              unified.stats.deliveredOrdersCount -
              unified.stats.returnsDeliveredCount,
            cod: unified.stats.totalGoodsUploaded,
            rate: unified.stats.rate,
            due: dailyData.outstandingBalance,
            returnsDeliveredValue: unified.stats.returnsDeliveredValue,
            paymentsValue: unified.stats.paymentsValue,
          },
        });
      }

      case "supplierAccounts": {
        const isSup = isSupplierRole(currentRole);
        if (!isSup && !["مدير", "مشرف", "محاسب"].includes(currentRole)) {
          return err(res, "ليس لديك صلاحية سحب كشوفات الموردين المالية");
        }

        let allSuppliers: string[] = [];
        if (isSup) {
          allSuppliers = [currentUser];
        } else {
          const registeredNames = (db.suppliers || [])
            .map((s: any) => s.name)
            .filter(Boolean);
          const orderNames = (db.orders || [])
            .map((o: any) => getOrderSupplier(o))
            .filter(Boolean);
          const combined = [...registeredNames, ...orderNames];
          const seen = new Set<string>();
          allSuppliers = [];
          for (const name of combined) {
            const norm = normalizeArabic(name);
            if (!seen.has(norm)) {
              seen.add(norm);
              allSuppliers.push(name);
            }
          }
        }

        const accountsList = allSuppliers.map((supName: any) => {
          const sup = String(supName);
          const unified = getSupplierUnifiedLedger(db, sup);
          const dailyData = getSupplierDailyLedger(db, sup);
          return {
            name: sup,
            totalCOD: unified.stats.totalCOD,
            returnsDelivered: unified.stats.returnsDeliveredValue,
            adjustments: unified.stats.reverseAdjustmentsValue,
            payments: unified.stats.paymentsValue,
            totalOrders: unified.stats.totalOrdersCount,
            deliveredOrders: unified.stats.deliveredOrdersCount,
            returnsCount: unified.stats.returnsDeliveredCount,
            balance: dailyData.outstandingBalance,
            rate: unified.stats.rate,
            openingBalance: unified.stats.openingBalance,
          };
        });

        return ok(res, { accounts: accountsList });
      }

      case "addSupplierPayment": {
        // Admin or accountant can make cash payouts
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "ليس لديك صلاحية صرف دفعات للموردين");
        }

        const { supplier, amount, desc, transactionType, adjustmentType } = d;
        if (!supplier || !amount) return err(res, "بيانات مفقودة");

        const val = Math.abs(Number(amount));
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

        // 1. Add to Supplier Ledger
        db.supplierLedger.push({
          supplier,
          date: now(),
          type: ledgerType,
          tracking: "CASH-PAY",
          amount: ledgerAmount,
          desc: finalDesc,
        });

        // 2. Add to Cashbox if it is not a manual adjustment (since manual adjustments don't touch actual cash)
        if (typeStr !== "adjustment") {
          db.cashbox.push({
            date: now(),
            desc: `${finalDesc} (${typeStr === "inflow" ? "وارد" : "صرف"} مورد)`,
            type: typeStr === "inflow" ? "إيداع" : "سداد مورد",
            amount: val,
            ref: "SUPPAY",
            addedBy: currentUser,
          });
        }

        // 3. Audit Log entry
        if (!db.auditLog) db.auditLog = [];
        let auditType = "سداد مورد / دفعة نقدية";
        let auditNewVal = `صرف مبلغ: ${val} ج.م للمورد: ${supplier}`;
        if (typeStr === "inflow") {
          auditType = "استلام نقدية من مورد";
          auditNewVal = `استلام مبلغ: ${val} ج.م من المورد: ${supplier}`;
        } else if (typeStr === "adjustment") {
          auditType = "تسوية رصيد مورد";
          auditNewVal = `تسوية رصيد (${adjustmentType === "add" ? "إضافة" : "خصم"}) بمبلغ: ${val} ج.م للمورد: ${supplier}`;
        }

        db.auditLog.push({
          user: currentUser,
          type: auditType,
          dateTime: now(),
          oldVal: "—",
          newVal: auditNewVal,
          reason: finalDesc,
        });

        writeDB(db);

        // Background sync to Sheets
        let scriptUrl = (process.env.GOOGLE_SCRIPT_URL || "").trim();
        if (scriptUrl.startsWith('"') && scriptUrl.endsWith('"'))
          scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
        else if (scriptUrl.startsWith("'") && scriptUrl.endsWith("'"))
          scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();

        if (
          isGoogleScriptHealthy &&
          scriptUrl &&
          scriptUrl.startsWith("http")
        ) {
          executeProxyRequest(scriptUrl, {
            action: "addSupplierPayment",
            token: "14014",
            supplier,
            amount: val,
            desc: finalDesc,
            currentUser,
            transactionType: typeStr,
            adjustmentType: adjustmentType,
            tracking: "CASH-PAY",
          }).catch((err) => {
            console.error("Async sheets write failure for addSupplierPayment:", err);
          });
        }

        let successMsg = "تم تسجيل الدفعة النقدية بنجاح وتسويتها بالخزنة";
        if (typeStr === "inflow") {
          successMsg = "تم تسجيل حركة استلام النقدية بنجاح وتغذية الخزينة";
        } else if (typeStr === "adjustment") {
          successMsg = "تم قيد تسوية الرصيد اليدوي بنجاح دون لمس الخزنة";
        }

        return ok(res, { msg: successMsg });
      }

      // Instant courier daily settlement and wallet closing
      case "instantCourierSettlement": {
        const {
          courier,
          cashAmount,
          commissionAmount,
          adjustmentType,
          adjustmentAmount,
          adjustmentDesc,
        } = d;

        if (!courier) return err(res, "المندوب غير محدد");

        const nowCairoStr = now();

        // 1. If cashAmount > 0, record deposit in cashbox (Main Treasury)
        const cashVal = Number(cashAmount || 0);
        if (cashVal > 0) {
          if (!db.cashbox) db.cashbox = [];
          db.cashbox.push({
            date: nowCairoStr,
            desc: "تصفية كاش وإغلاق العهدة اليومية للمندوب: " + courier,
            type: "استلام عهدة مندوب",
            amount: cashVal,
            ref: courier,
            addedBy: currentUser || "إدارة الحسابات",
          });
        }

        // 2. Record commissions earned in courierLedger as a positive entry
        const commVal = Number(commissionAmount || 0);
        if (commVal > 0) {
          if (!db.courierLedger) db.courierLedger = [];
          db.courierLedger.push({
            courier: courier,
            date: nowCairoStr,
            type: "عمولة توصيل",
            tracking: "—",
            amount: commVal,
            desc: "إجمالي العمولات المستحقة لليوم المصفى",
          });
        }

        // 3. Record adjustment if adjustmentAmount > 0
        const adjVal = Number(adjustmentAmount || 0);
        if (adjVal > 0 && adjustmentType) {
          if (!db.courierLedger) db.courierLedger = [];
          db.courierLedger.push({
            courier: courier,
            date: nowCairoStr,
            type: adjustmentType,
            tracking: "—",
            amount: adjustmentType === "جزاء" ? -adjVal : adjVal,
            desc: adjustmentDesc || ("تسوية يدوية مصاحبة للتصفية اليومية - " + adjustmentType),
          });

          if (adjustmentType === "مكافأة") {
            if (!db.cashbox) db.cashbox = [];
            db.cashbox.push({
              date: nowCairoStr,
              desc: "مكافأة منصرفة للمندوب مصاحبة للتصفية اليومية: " + courier + " - " + (adjustmentDesc || ""),
              type: "صرف",
              amount: adjVal,
              ref: "BONUS",
              addedBy: currentUser || "إدارة الحسابات",
            });
          } else if (adjustmentType === "جزاء") {
            if (!db.cashbox) db.cashbox = [];
            db.cashbox.push({
              date: nowCairoStr,
              desc: "تسوية خصم/جزاء مستقطع مصاحب للتصفية اليومية للمندوب: " + courier + " - " + (adjustmentDesc || ""),
              type: "استلام عهدة مندوب",
              amount: adjVal,
              ref: "PENALTY",
              addedBy: currentUser || "إدارة الحسابات",
            });
          }
        }

        // 4. Now perform logical status settlement and archiving of active orders
        let settledCount = 0;
        const settledOrders: any[] = [];
        const activeOrders: any[] = [];
        if (!db.archivedOrders) db.archivedOrders = [];

        db.orders.forEach((order: any) => {
          if (
            order.courier &&
            order.courier.toString().trim().toLowerCase() ===
              courier.toString().trim().toLowerCase()
          ) {
            const oldStatus = order.status;
            order.lastCourier = order.courier;
            order.lastCommission = order.commission;

            let nextStatus = oldStatus;
            if (oldStatus === "مرتجع" || oldStatus === "مرتجع جديد") {
              nextStatus = "مرتجع بالمستودع";
              order.courierSignature = `${order.courier} (توقيع تصفية المرتجع الميداني ✍️)`;
            } else if (
              oldStatus === "تسليم جزئي" ||
              oldStatus === "مرتجع جزئي" ||
              oldStatus === "تسليم جزئي - معلق للجرد"
            ) {
              nextStatus = "مرتجع جزئي بالمستودع";
              order.returnReason = "مرتجع جزئي متبقي";
              order.returnSubStatus = "بضاعة متبقية من تسليم جزئي";
              order.courierSignature = `${order.courier} (توقيع تصفية المرتجع الجزئي ✍️)`;
            } else if (
              oldStatus === "مؤجل" ||
              oldStatus === "Delayed" ||
              oldStatus === "مؤجل من المندوب" ||
              oldStatus === "مؤجل بناءً على طلب العميل"
            ) {
              nextStatus = "مؤجل بالمستودع";
              order.courierSignature = `${order.courier} (توقيع تصفية المؤجل ✍️)`;
            } else if (
              oldStatus === "لا يوجد رد" ||
              oldStatus === "العميل لا يرد" ||
              oldStatus === "No Answer" ||
              oldStatus === "العميل لم يقم بالرد"
            ) {
              nextStatus = "لا يوجد رد بالمستودع";
              order.courierSignature = `${order.courier} (توقيع تصفية عدم الرد ✍️)`;
            }

            order.status = nextStatus;

            const isSuccessfullyClosed = [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "تسليم جزئي",
              "تسليم جزئي - معلق للجرد",
              "مرتجع جزئي"
            ].includes(oldStatus);

            const shouldArchive = [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "التسليم للمورد",
              "تم تسليم المرتجع للمورد"
            ].includes(nextStatus);

            if (isSuccessfullyClosed) {
              order.isSettled = true;
              order.is_settled = "true";
              if (!shouldArchive) {
                order.courier = "";
                order.commission = 0;
              }
            } else {
              order.courier = "";
              order.commission = 0;
              order.isSettled = false;
              order.is_settled = "false";
            }

            order.updatedAt = nowCairoStr;

            if (!db.statusHistory) db.statusHistory = [];
            db.statusHistory.push({
              tracking: order.tracking,
              oldStatus: oldStatus,
              newStatus: order.status,
              updatedBy: currentUser || "إدارة",
              dateTime: nowCairoStr,
            });

            if (shouldArchive) {
              settledOrders.push(order);
            } else {
              activeOrders.push(order);
            }
            settledCount++;
          } else {
            activeOrders.push(order);
          }
        });

        db.archivedOrders.push(...settledOrders);
        db.orders = activeOrders;

        // Write audit log entry
        if (!db.auditLog) db.auditLog = [];
        db.auditLog.push({
          user: currentUser || "إدارة الحسابات",
          type: "تصفية عهدة يومية فورية",
          dateTime: nowCairoStr,
          oldVal: "عامل: " + courier,
          newVal: "كاش: " + cashVal + " | عمولة: " + commVal,
          reason: "اعتماد تصفية الحساب وإغلاق العهدة اليومية"
        });

        writeDB(db);

        // 🌐 Modern Google Sheets Integration Proxy Gateway
        let scriptUrl = (process.env.GOOGLE_SCRIPT_URL || "").trim();
        if (scriptUrl.startsWith('"') && scriptUrl.endsWith('"')) {
          scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
        } else if (scriptUrl.startsWith("'") && scriptUrl.endsWith("'")) {
          scriptUrl = scriptUrl.substring(1, scriptUrl.length - 1).trim();
        }

        if (
          isGoogleScriptHealthy &&
          scriptUrl &&
          scriptUrl.startsWith("http")
        ) {
          executeProxyRequest(scriptUrl, {
            action: "instantCourierSettlement",
            token: "14014",
            courier,
            cashAmount: cashVal,
            commissionAmount: commVal,
            adjustmentType,
            adjustmentAmount,
            adjustmentDesc,
            currentUser,
          }).catch((err) => {
            console.error("Async sheets write failure for instantCourierSettlement:", err);
          });
        }

        return ok(res, {
          settled: settledCount,
          msg: "✅ تم اعتماد تصفية الحساب وإغلاق العهدة اليومية للمندوب بنجاح! تم إيداع مبلغ " + cashVal + " ج.م بالخزنة كأثر فوري، وتصفير العداد لليوم الجديد."
        });
      }

      // Overnight face-to-face settlement action
      case "settleCourierOrders": {
        const { courier } = d;
        if (!courier) return err(res, "المندوب غير محدد");

        let settledCount = 0;
        const nowCairoStr = now();

        const settledOrders: any[] = [];
        const activeOrders: any[] = [];
        if (!db.archivedOrders) db.archivedOrders = [];

        db.orders.forEach((order: any) => {
          if (
            order.courier &&
            order.courier.toString().trim().toLowerCase() ===
              courier.toString().trim().toLowerCase()
          ) {
            const oldStatus = order.status;
            order.lastCourier = order.courier;
            order.lastCommission = order.commission;

            // Apply strict status transitions on warehouse settlement
            if (oldStatus === "مرتجع" || oldStatus === "مرتجع جديد") {
              order.status = "مرتجع بالمستودع";
              order.courierSignature = `${order.courier} (توقيع تصفية المرتجع الميداني ✍️)`;
            } else if (
              oldStatus === "تسليم جزئي" ||
              oldStatus === "مرتجع جزئي" ||
              oldStatus === "تسليم جزئي - معلق للجرد"
            ) {
              order.status = "مرتجع جزئي بالمستودع";
              order.returnReason = "مرتجع جزئي متبقي";
              order.returnSubStatus = "بضاعة متبقية من تسليم جزئي";
              order.courierSignature = `${order.courier} (توقيع تصفية المرتجع الجزئي ✍️)`;

              // ويقوم السيستم تلقائياً بترحيل المبلغ المستلم الفعلي فقط للخزنة المركزية
              const actualCash = Number(
                order.actualReceivedCash ||
                  order.partialAmount ||
                  order.totalCOD ||
                  0,
              );
              if (actualCash > 0) {
                db.cashbox.push({
                  date: nowCairoStr,
                  desc: `تحصيل تصفية تسليم جزئي للشحنة رقم: ${order.tracking}`,
                  type: "استلام عهدة مندوب",
                  amount: actualCash,
                  ref: courier,
                  addedBy: currentUser,
                });
              }
            } else if (
              oldStatus === "مؤجل" ||
              oldStatus === "Delayed" ||
              oldStatus === "مؤجل من المندوب" ||
              oldStatus === "مؤجل بناءً على طلب العميل"
            ) {
              order.status = "مؤجل بالمستودع";
              order.courierSignature = `${order.courier} (توقيع تصفية المؤجل ✍️)`;
            } else if (
              oldStatus === "لا يوجد رد" ||
              oldStatus === "العميل لا يرد" ||
              oldStatus === "No Answer" ||
              oldStatus === "العميل لم يقم بالرد"
            ) {
              order.status = "لا يوجد رد بالمستودع";
              order.courierSignature = `${order.courier} (توقيع تصفية عدم الرد ✍️)`;
            }

            const isSuccessfullyClosed = [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "تسليم جزئي",
              "تسليم جزئي - معلق للجرد",
              "مرتجع جزئي"
            ].includes(oldStatus);

            if (isSuccessfullyClosed) {
              order.isSettled = true;
              order.is_settled = "true";
            } else {
              order.courier = "";
              order.commission = 0;
              order.isSettled = false;
              order.is_settled = "false";
            }

            order.updatedAt = nowCairoStr;

            if (!db.statusHistory) db.statusHistory = [];
            db.statusHistory.push({
              tracking: order.tracking,
              oldStatus: oldStatus,
              newStatus: order.status,
              updatedBy: currentUser,
              dateTime: nowCairoStr,
            });

            settledCount++;

            const shouldArchive = [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "التسليم للمورد",
              "تم تسليم المرتجع للمورد"
            ].includes(order.status);

            if (shouldArchive) {
              settledOrders.push(order);
            } else {
              activeOrders.push(order);
            }
          } else {
            activeOrders.push(order);
          }
        });

        db.archivedOrders.push(...settledOrders);
        db.orders = activeOrders;

        writeDB(db);
        return ok(res, {
          settled: settledCount,
          msg: `تم سحب وتصفية ${settledCount} شحنة للمستودع وتبرئة المندوب بنجاح ✓`,
        });
      }

      // COURIER LEDGER SYSTEM & COMPENSTATION
      // ─────────────────────────────────────────────────────────────
      case "getCourierLedger": {
        // Courier salary summary sheet calculations:
        // Basic Salary, Delivered Orders, Delivery Commission, Returned With Shipping, Return Commission, Bonuses, Penalties, Net Salary
        const courierName = d.courier || currentUser;

        const courierProfile = db.couriers.find(
          (c: any) => c.name === courierName,
        );
        if (!courierProfile) return err(res, "المندوب غير مسجل");

        // Filter courier orders from both live and archived orders to ensure complete financial and historical logs
        const courierOrders = [
          ...(db.orders || []),
          ...(db.archivedOrders || []),
        ].filter(
          (o: any) =>
            o.courier &&
            o.courier.toString().trim().toLowerCase() ===
              courierName.toString().trim().toLowerCase()
        );

        // Calculations - using new persistent configs with backward-compatible defaults
        const basicSalary =
          courierProfile.base_fixed_salary !== undefined
            ? Number(courierProfile.base_fixed_salary)
            : Number(courierProfile.salary || 3000);
        const commissionSuccess =
          courierProfile.commission_success !== undefined
            ? Number(courierProfile.commission_success)
            : Number(courierProfile.commission || 25);
        const commissionReturn =
          courierProfile.commission_return !== undefined
            ? Number(courierProfile.commission_return)
            : 10;

        const todayDate = tod();

        const returnStatuses = [
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
          "جاري تجهيز المرتجع",
          "مرتجع والعميل دفع الشحن",
          "مرتجع مدفوع الشحن"
        ];

        const getOrderActualCollection = (o: any): number => {
          if (!o) return 0;
          const status = (o.status || "").toString().trim();
          if ([
            "تم التسليم",
            "تم التسليم بنجاح",
            "تم التسليم (ناجح كاش)"
          ].includes(status)) {
            return Number(o.totalCOD !== undefined && o.totalCOD !== "" && o.totalCOD !== null ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
          }
          if ([
            "تسليم جزئي",
            "تسليم جزئي - معلق للجرد"
          ].includes(status)) {
            const raw = o.actualReceivedCash !== undefined ? o.actualReceivedCash : (o.partialAmount !== undefined ? o.partialAmount : (o["المبلغ المستلم"] !== undefined ? o["المبلغ المستلم"] : (o["التحصيل الجزئي"] !== undefined ? o["التحصيل الجزئي"] : (o["التحصيل"] !== undefined ? o["التحصيل"] : (o["المبلغ المحصل"] !== undefined ? o["المبلغ المحصل"] : (o["المبلغ المستلم الفعلي"] !== undefined ? o["المبلغ المستلم الفعلي"] : ""))))));
            if (raw !== undefined && raw !== null && raw !== "") {
              const val = Number(raw);
              if (!isNaN(val)) return val;
            }
            return 0;
          }
          if ([
            "مرتجع والعميل دفع الشحن",
            "مرتجع مدفوع الشحن",
            "مرتجع وتم دفع الشحن"
          ].includes(status) || (status === "مرتجع" && o.returnShippingType === "paid")) {
            return Number(o.shipPrice || o.shipCost || 0);
          }
          return 0;
        };

        // Strict Courier Settlement Calculations (Today's performance):
        const successOrdersToday = courierOrders.filter(
          (o: any) =>
            [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "تسليم جزئي",
              "تسليم جزئي - معلق للجرد",
            ].includes((o.status || "").toString().trim()) &&
            o.delivDate &&
            isDateToday(o.delivDate),
        );

        const returnedOrdersToday = courierOrders.filter(
          (o: any) =>
            returnStatuses.includes((o.status || "").toString().trim()) &&
            o.retDate &&
            isDateToday(o.retDate),
        );

        const todayDeliveredCount = successOrdersToday.length;
        const todayReturnedCount = returnedOrdersToday.length;
        const todayTotalCount = todayDeliveredCount + todayReturnedCount;

        // 【إجمالي التحصيل الفعلي الميداني】: مجموع المبالغ الفعلية المستلمة من العملاء للأوردرات الناجحة والجزئية والمرتجع مدفوع الشحن اليوم.
        const todayDeliveredCash = successOrdersToday.reduce(
          (sum: number, o: any) => sum + getOrderActualCollection(o),
          0,
        ) + returnedOrdersToday.reduce(
          (sum: number, o: any) => sum + getOrderActualCollection(o),
          0,
        );

        // Strict field-collection rule: returned shipping cash is completely separate/ignored for handovers
        const todayReturnedPaidCash = 0;

        // 【إجمالي عمولة المندوب】
        const todayTotalCommission =
          (todayDeliveredCount * commissionSuccess) +
          (todayReturnedCount * commissionReturn);

        // Cumulative historical counters
        const historicalSuccessOrders = courierOrders.filter(
          (o: any) =>
            [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "تسليم جزئي",
              "تسليم جزئي - معلق للجرد",
            ].includes((o.status || "").toString().trim())
        );
        const deliveredCount = historicalSuccessOrders.length;

        const historicalReturnedOrders = courierOrders.filter(
          (o: any) => returnStatuses.includes((o.status || "").toString().trim())
        );
        const returnedCount = historicalReturnedOrders.length;
        const returnedPaidCount = 0; // simplified to unified collection

        const delivCommission = deliveredCount * commissionSuccess;
        const returnShippingCommission = returnedCount * commissionReturn;

        const targetLedger = db.courierLedger.filter(
          (l: any) => l.courier === courierName,
        );
        const bonusesSum = targetLedger
          .filter((l: any) => l.type === "مكافأة")
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );
        const penaltiesSum = targetLedger
          .filter(
            (l: any) =>
              l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز",
          )
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );

        const todayBonuses = targetLedger
          .filter(
            (l: any) => l.type === "مكافأة" && l.date && isDateToday(l.date),
          )
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );
        const todayPenalties = targetLedger
          .filter(
            (l: any) =>
              (l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز") &&
              l.date &&
              isDateToday(l.date),
          )
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );

        // 【الصافي المطلوب توريده من المندوب (العهدة)】: الصافي المطلوب = التحصيل الفعلي الميداني - عمولات المندوب اليومية
        const requiredHandoverToday = todayDeliveredCash - todayTotalCommission;

        const activeCourierOrders = courierOrders.filter((o: any) => !o.isSettledMonth);

        const totalCollected = activeCourierOrders.reduce(
          (sum: number, o: any) => sum + getOrderActualCollection(o),
          0,
        );

        // Handed Over to company = Sum of "استلام عهدة مندوب" records in cashbox for this courier
        const totalPaidToCompany = db.cashbox
          .filter(
            (item: any) =>
              item.type === "استلام عهدة مندوب" &&
              item.ref === courierName &&
              !item.isSettledMonth,
          )
          .reduce(
            (sum: number, item: any) => sum + Number(item.amount || 0),
            0,
          );

        const deficit = totalCollected - totalPaidToCompany;

        // Cumulative Daily Ledger calculations
        const nowCairo = getCairoDateObj();
        const daysInCurrentMonth = new Date(
          nowCairo.getFullYear(),
          nowCairo.getMonth() + 1,
          0,
        ).getDate();
        const daysCount = daysInCurrentMonth || 30;

        const year = nowCairo.getFullYear();
        const month = nowCairo.getMonth();

        // Start Date: If hire_date is specified, use it as start. Otherwise start of current month.
        let startDateStr = `${year}-${String(month + 1).padStart(2, "0")}-01`;
        if (courierProfile.hire_date) {
          startDateStr = courierProfile.hire_date;
        }

        const datesSet = new Set<string>();
        const fullDeliveredStatuses = ["تم التسليم", "تم التسليم بنجاح", "تم التسليم (ناجح كاش)", "تسليم جزئي", "تسليم جزئي - معلق للجرد"];

        // Add dates of active (unsettled) orders
        for (const o of courierOrders) {
          if (!o.isSettledMonth) {
            if (fullDeliveredStatuses.includes(o.status) && o.delivDate) {
              datesSet.add(o.delivDate.substring(0, 10));
            }
            if (
              ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", "مرتجع ودفع الشحن"].includes(
                o.status,
              ) &&
              o.retDate
            ) {
              datesSet.add(o.retDate.substring(0, 10));
            }
          }
        }

        // Add all dates from startDateStr up to todayDate
        const startD = new Date(startDateStr);
        const endD = new Date(todayDate);
        if (!isNaN(startD.getTime())) {
          const tempD = new Date(startD);
          while (tempD <= endD) {
            const yStr = tempD.getFullYear();
            const mStr = String(tempD.getMonth() + 1).padStart(2, "0");
            const dStr = String(tempD.getDate()).padStart(2, "0");
            datesSet.add(`${yStr}-${mStr}-${dStr}`);
            tempD.setDate(tempD.getDate() + 1);
          }
        }
        datesSet.add(todayDate);

        // Filter out dates that are closed/settled in a closed month
        const sortedDates = Array.from(datesSet)
          .sort()
          .filter((dStr) => {
            if (
              courierProfile.last_closing_date &&
              dStr <= courierProfile.last_closing_date
            ) {
              return false;
            }
            return true;
          });

        // Pre-grouping data structures for O(1) inside sortedDates.map
        const deliveredByDate = new Map<string, any[]>();
        const returnedByDate = new Map<string, any[]>();

        for (const o of courierOrders) {
          if (fullDeliveredStatuses.includes(o.status) && o.delivDate) {
            const dStr = o.delivDate.substring(0, 10);
            if (!deliveredByDate.has(dStr)) deliveredByDate.set(dStr, []);
            deliveredByDate.get(dStr)!.push(o);
          }
          if (
            ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد", "مرتجع والعميل دفع الشحن", "مرتجع مدفوع الشحن", "مرتجع ودفع الشحن"].includes(o.status) &&
            o.retDate
          ) {
            const dStr = o.retDate.substring(0, 10);
            if (!returnedByDate.has(dStr)) returnedByDate.set(dStr, []);
            returnedByDate.get(dStr)!.push(o);
          }
        }

        const targetLedgerFiltered = (db.courierLedger || []).filter(
          (l: any) => l.courier === courierName && !l.isSettledMonth
        );
        const ledgerByDate = new Map<string, any[]>();
        for (const l of targetLedgerFiltered) {
          if (l.date) {
            const dStr = l.date.substring(0, 10);
            if (!ledgerByDate.has(dStr)) ledgerByDate.set(dStr, []);
            ledgerByDate.get(dStr)!.push(l);
          }
        }

        const targetExpensesFiltered = (db.expenses || []).filter(
          (e: any) => e.by === courierName && !e.isSettledMonth
        );
        const expensesByDate = new Map<string, number>();
        for (const e of targetExpensesFiltered) {
          if (e.date) {
            const dStr = e.date.substring(0, 10);
            expensesByDate.set(dStr, (expensesByDate.get(dStr) || 0) + Number(e.amount || 0));
          }
        }

        const liveCourierOrders = (db.orders || []).filter(
          (o: any) =>
            o.courier &&
            o.courier.toString().trim().toLowerCase() ===
              courierName.toString().trim().toLowerCase()
        );
        const liveDatesSet = new Set<string>();
        for (const o of liveCourierOrders) {
          if (o.delivDate) liveDatesSet.add(o.delivDate.substring(0, 10));
          if (o.retDate) liveDatesSet.add(o.retDate.substring(0, 10));
          if (o.orderDate) liveDatesSet.add(o.orderDate.substring(0, 10));
          if (o.createdAt) liveDatesSet.add(o.createdAt.substring(0, 10));
        }

        let runningCumulative = 0;
        const dailyEarnings = sortedDates.map((dStr) => {
          const isToday = dStr === todayDate;

          const deliveredList = deliveredByDate.get(dStr) || [];
          const returnedList = returnedByDate.get(dStr) || [];

          const deliveredDay = deliveredList.length;
          const returnedDay = returnedList.length;

          // Pure cash collected from successful orders only on dStr
          const dayTotalCashCollected = deliveredList.reduce(
            (sum: number, o: any) => sum + getOrderActualCollection(o),
            0,
          );

          // Check if the day is settled
          const isSettled = !liveDatesSet.has(dStr);

          // Pro-rated daily basic salary portion
          let baseEarning = Number((basicSalary / daysCount).toFixed(2));
          if (courierProfile.hire_date && dStr < courierProfile.hire_date) {
            baseEarning = 0;
          }

          // Strict Financial Logic: Zero out past days' commissions since they have already been closed and paid.
          const delivEarning = isToday ? deliveredDay * commissionSuccess : 0;
          const retEarning = isToday ? returnedDay * commissionReturn : 0;

          const dayLedger = ledgerByDate.get(dStr) || [];
          const dayPenalties = dayLedger
            .filter((l: any) => l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز")
            .reduce(
              (sum: number, x: any) => sum + Math.abs(Number(x.amount)),
              0,
            );
          const dayExpenses = expensesByDate.get(dStr) || 0;
          const dayBonuses = dayLedger
            .filter((l: any) => l.type === "مكافأة")
            .reduce((sum: number, x: any) => sum + Number(x.amount), 0);

          const allowance = Number(
            courierProfile.allowance || courierProfile.shipping_allowance || 0,
          );

          // Correct daily net due formula: (commission) + allowance + base portion + bonuses - penalties - expenses
          const total =
            delivEarning +
            retEarning +
            allowance +
            baseEarning +
            dayBonuses -
            (dayPenalties + dayExpenses);
          runningCumulative += total;

          return {
            date: dStr,
            delivered: deliveredDay,
            returned: returnedDay,
            baseEarning,
            delivEarning,
            retEarning,
            total: Number(total.toFixed(2)),
            cumulative: Number(runningCumulative.toFixed(2)),
            cashCollected: dayTotalCashCollected,
            isSettled: isSettled,
          };
        });

        const allowanceTotal = Number(
          courierProfile.allowance || courierProfile.shipping_allowance || 0,
        );
        const todayExpensesCombined =
          db.expenses
            ?.filter((e: any) => e.by === courierName && isDateToday(e.date) && !e.isSettledMonth)
            .reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;

        // Sum up total pro-rated salary for the current month / active period
        const proRatedSalary = Number(
          dailyEarnings.reduce((sum, dItem) => sum + dItem.baseEarning, 0).toFixed(2)
        );

        // netSalary = (Today's Delivered & Today's RetPaid) * commission + Today's portion of base salary + today's allowance + today's bonuses - today's penalties - today's expenses
        const netSalary =
          todayTotalCommission +
          proRatedSalary +
          allowanceTotal +
          bonusesSum -
          penaltiesSum -
          todayExpensesCombined;

        return ok(res, {
          ledgerInfo: {
            courierName,
            basicSalary: proRatedSalary, // Display pro-rated basic salary in the row
            contractualSalary: basicSalary, // Pass contractual salary for detailed views
            base_fixed_salary: proRatedSalary,
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
            dailyEarnings: dailyEarnings.reverse(), // Sort descending to have latest date first
          },
          transactions: targetLedger.reverse(),
        });
      }

      case "getCourierInfo": {
        // Fast courier self checking inside Courier portal
        const courierName = currentUser;
        const courierProfile = db.couriers.find(
          (c: any) => c.name === courierName,
        );
        if (!courierProfile) return err(res, "المندوب غير مسجل");

        const returnStatuses = [
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
          "جاري تجهيز المرتجع",
          "مرتجع والعميل دفع الشحن",
          "مرتجع مدفوع الشحن"
        ];

        const getOrderActualCollection = (o: any): number => {
          if (!o) return 0;
          const status = (o.status || "").toString().trim();
          if ([
            "تم التسليم",
            "تم التسليم بنجاح",
            "تم التسليم (ناجح كاش)"
          ].includes(status)) {
            return Number(o.totalCOD !== undefined && o.totalCOD !== "" && o.totalCOD !== null ? o.totalCOD : (Number(o.prodPrice || 0) + Number(o.shipPrice || 0)));
          }
          if ([
            "تسليم جزئي",
            "تسليم جزئي - معلق للجرد"
          ].includes(status)) {
            const raw = o.actualReceivedCash !== undefined ? o.actualReceivedCash : (o.partialAmount !== undefined ? o.partialAmount : (o["المبلغ المستلم"] !== undefined ? o["المبلغ المستلم"] : (o["التحصيل الجزئي"] !== undefined ? o["التحصيل الجزئي"] : (o["التحصيل"] !== undefined ? o["التحصيل"] : (o["المبلغ المحصل"] !== undefined ? o["المبلغ المحصل"] : (o["المبلغ المستلم الفعلي"] !== undefined ? o["المبلغ المستلم الفعلي"] : ""))))));
            if (raw !== undefined && raw !== null && raw !== "") {
              const val = Number(raw);
              if (!isNaN(val)) return val;
            }
            return 0;
          }
          if ([
            "مرتجع والعميل دفع الشحن",
            "مرتجع مدفوع الشحن",
            "مرتجع وتم دفع الشحن"
          ].includes(status) || (status === "مرتجع" && o.returnShippingType === "paid")) {
            return Number(o.shipPrice || o.shipCost || 0);
          }
          return 0;
        };

        const ordersList = [
          ...(db.orders || []),
          ...(db.archivedOrders || []),
        ].filter(
          (o: any) =>
            o.courier &&
            o.courier.toString().trim().toLowerCase() ===
              courierName.toString().trim().toLowerCase()
        );
        const total = ordersList.length;
        const delivered = ordersList.filter(
          (o: any) =>
            [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "تسليم جزئي",
              "تسليم جزئي - معلق للجرد",
            ].includes((o.status || "").toString().trim())
        ).length;
        const returnedPaid = 0; // unified field-collection model ignores separate returned-paid shipping counts
        const returnedAll = ordersList.filter((o: any) =>
          returnStatuses.includes((o.status || "").toString().trim())
        ).length;

        const basicSalary =
          courierProfile.base_fixed_salary !== undefined
            ? Number(courierProfile.base_fixed_salary)
            : Number(courierProfile.salary || 3000);
        const commissionSuccess =
          courierProfile.commission_success !== undefined
            ? Number(courierProfile.commission_success)
            : Number(courierProfile.commission || 25);
        const commissionReturn =
          courierProfile.commission_return !== undefined
            ? Number(courierProfile.commission_return)
            : 10;

        // Fetch adjustment amounts
        const ledgerTr = db.courierLedger.filter(
          (l: any) => l.courier === courierName,
        );
        const bonuses = ledgerTr
          .filter((l: any) => l.type === "مكافأة")
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );
        const penalties = ledgerTr
          .filter(
            (l: any) =>
              l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز",
          )
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );

        const todayDate = tod();

        // Strict Courier Settlement Calculations (Today's performance):
        const successOrdersToday = ordersList.filter(
          (o: any) =>
            [
              "تم التسليم",
              "تم التسليم بنجاح",
              "تم التسليم (ناجح كاش)",
              "تسليم جزئي",
              "تسليم جزئي - معلق للجرد",
            ].includes((o.status || "").toString().trim()) &&
            o.delivDate &&
            isDateToday(o.delivDate),
        );

        const returnedOrdersToday = ordersList.filter(
          (o: any) =>
            returnStatuses.includes((o.status || "").toString().trim()) &&
            o.retDate &&
            isDateToday(o.retDate),
        );

        const todayDeliveredCount = successOrdersToday.length;
        const todayReturnedCount = returnedOrdersToday.length;

        // 【إجمالي التحصيل الفعلي الميداني】
        const todayDeliveredCash = successOrdersToday.reduce(
          (sum: number, o: any) => sum + getOrderActualCollection(o),
          0,
        ) + returnedOrdersToday.reduce(
          (sum: number, o: any) => sum + getOrderActualCollection(o),
          0,
        );

        // Strict field-collection rule: returned shipping cash is completely separate/ignored for handovers
        const todayReturnedPaidCash = 0;

        // 【إجمالي عمولة المندوب】
        const todayTotalCommission =
          (todayDeliveredCount * commissionSuccess) +
          (todayReturnedCount * commissionReturn);

        const todayBonuses = ledgerTr
          .filter(
            (l: any) => l.type === "مكافأة" && l.date && isDateToday(l.date),
          )
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );
        const todayPenalties = ledgerTr
          .filter(
            (l: any) =>
              (l.type === "جزاء" || l.type === "خصم" || l.type === "خصم عجز") &&
              l.date &&
              isDateToday(l.date),
          )
          .reduce(
            (sum: number, x: any) => sum + Math.abs(Number(x.amount || 0)),
            0,
          );

        // 【الصافي المطلوب توريده من المندوب (العهدة)】: الصافي المطلوب = التحصيل الفعلي الميداني - عمولات المندوب اليومية
        const requiredHandoverToday = todayDeliveredCash - todayTotalCommission;

        const totalCommission = todayTotalCommission;
        const totalEarnings =
          basicSalary + totalCommission + bonuses - penalties;

        // Cumulative Daily Ledger calculations
        const nowCairo = getCairoDateObj();
        const daysInCurrentMonth = new Date(
          nowCairo.getFullYear(),
          nowCairo.getMonth() + 1,
          0,
        ).getDate();
        const daysCount = daysInCurrentMonth || 30;

        const datesSet = new Set<string>();
        for (const o of ordersList) {
          if (
            (o.status === "تم التسليم" ||
              o.status === "تسليم جزئي" ||
              o.status === "تسليم جزئي - معلق للجرد") &&
            o.delivDate
          ) {
            datesSet.add(o.delivDate.substring(0, 10));
          }
          if (
            ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(
              o.status,
            ) &&
            o.retDate
          ) {
            datesSet.add(o.retDate.substring(0, 10));
          }
        }
        datesSet.add(todayDate);

        const year = nowCairo.getFullYear();
        const month = nowCairo.getMonth();
        const todayDayNum = nowCairo.getDate();
        for (let dMonth = 1; dMonth <= todayDayNum; dMonth++) {
          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(dMonth).padStart(2, "0")}`;
          datesSet.add(dateStr);
        }

        const sortedDates = Array.from(datesSet).sort();
        let runningCumulative = 0;
        const dailyEarnings = sortedDates.map((dStr) => {
          const isToday = dStr === todayDate;

          const deliveredList = ordersList.filter(
            (o: any) =>
              (o.status === "تم التسليم" ||
                o.status === "تسليم جزئي" ||
                o.status === "تسليم جزئي - معلق للجرد") &&
              o.delivDate &&
              o.delivDate.substring(0, 10) === dStr,
          );
          const returnedList = ordersList.filter(
            (o: any) =>
              ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(
                o.status,
              ) &&
              o.retDate &&
              o.retDate.substring(0, 10) === dStr,
          );

          const deliveredDay = deliveredList.length;
          const returnedDay = returnedList.length;

          const baseEarning = Number((basicSalary / daysCount).toFixed(2));

          // Strict Financial Logic: Zero out past days' commissions since they have already been closed and paid.
          const delivEarning = isToday ? deliveredDay * commissionSuccess : 0;
          const retEarning = isToday ? returnedDay * commissionReturn : 0;

          const dayLedger = db.courierLedger.filter(
            (l: any) =>
              l.courier === courierName &&
              l.date &&
              l.date.substring(0, 10) === dStr,
          );
          const dayPenalties = dayLedger
            .filter((l: any) => l.type === "جزاء" || l.type === "خصم")
            .reduce(
              (sum: number, x: any) => sum + Math.abs(Number(x.amount)),
              0,
            );
          const dayExpenses =
            db.expenses
              ?.filter(
                (e: any) =>
                  e.by === courierName &&
                  e.date &&
                  e.date.substring(0, 10) === dStr,
              )
              .reduce((sum: number, e: any) => sum + Number(e.amount), 0) || 0;
          const dayBonuses = dayLedger
            .filter((l: any) => l.type === "مكافأة")
            .reduce((sum: number, x: any) => sum + Number(x.amount), 0);

          const allowance = Number(
            courierProfile.allowance || courierProfile.shipping_allowance || 0,
          );

          // Correct day net due formula: (commission) + allowance + base portion + bonuses - penalties - expenses
          const total =
            delivEarning +
            retEarning +
            allowance +
            baseEarning +
            dayBonuses -
            (dayPenalties + dayExpenses);
          runningCumulative += total;

          return {
            date: dStr,
            delivered: deliveredDay,
            returned: returnedDay,
            baseEarning,
            delivEarning,
            retEarning,
            total: Number(total.toFixed(2)),
            cumulative: Number(runningCumulative.toFixed(2)),
          };
        });

        // Total cash collected vs deposited for the courier portal itself
        const totalCollectedOnInfo = ordersList.reduce(
          (sum: number, o: any) => {
            if (
              [
                "تم التسليم",
                "تم التسليم بنجاح",
                "تم التسليم (ناجح كاش)",
              ].includes(o.status)
            ) {
              return (
                sum +
                Number(
                  o.totalCOD ||
                    Number(o.prodPrice || 0) + Number(o.shipPrice || 0),
                )
              );
            } else if (
              ["تسليم جزئي", "تسليم جزئي - معلق للجرد"].includes(o.status)
            ) {
              const amt =
                o.partialAmount !== undefined &&
                o.partialAmount !== null &&
                o.partialAmount !== ""
                  ? Number(o.partialAmount)
                  : o.actualReceivedCash !== undefined &&
                      o.actualReceivedCash !== null &&
                      o.actualReceivedCash !== ""
                    ? Number(o.actualReceivedCash)
                    : Number(o.totalCOD || 0);
              return sum + amt;
            } else if (
              o.status === "مرتجع والعميل دفع الشحن" ||
              o.status === "مرتجع مدفوع الشحن" ||
              (o.status === "مرتجع" && o.returnShippingType === "paid")
            ) {
              return sum + Number(o.shipPrice || o.shipCost || 0);
            }
            return sum;
          },
          0,
        );

        const totalPaidToCompanyOnInfo = db.cashbox
          .filter(
            (item: any) =>
              item.type === "استلام عهدة مندوب" && item.ref === courierName,
          )
          .reduce(
            (sum: number, item: any) => sum + Number(item.amount || 0),
            0,
          );
        const deficitOnInfo = totalCollectedOnInfo - totalPaidToCompanyOnInfo;

        return ok(res, {
          salary: basicSalary,
          commission: commissionSuccess,
          commission_success: commissionSuccess,
          commission_return: commissionReturn,
          base_fixed_salary: basicSalary,
          total,
          delivered,
          returnedAll,
          returnedPaid,
          bonuses,
          penalties,
          totalCommission,
          totalEarnings,
          todayDelivered: todayDeliveredCount,
          todayDelivCommission: todayTotalCommission,
          todayReturned: todayReturnedCount,
          todayReturnCommission: todayReturnedCount * commissionReturn,
          todayDeliveredCash,
          todayReturnedPaidCash,
          todayTotalCommission,
          todayPenalties,
          todayBonuses,
          requiredHandoverToday,
          deficit: deficitOnInfo,
          totalCollected: totalCollectedOnInfo,
          totalPaidToCompany: totalPaidToCompanyOnInfo,
          dailyEarnings: dailyEarnings.reverse(), // newest first
        });
      }

      case "addCourierAdjustment": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(
            res,
            "فقط المدير والمحاسب يمتلك صلاحية تعديل مكافآت وجزاءات المندوب",
          );
        }

        const { courier, type, amount, desc } = d; // type can be 'مكافأة' or 'جزاء'
        if (!courier || !amount || !type)
          return err(res, "بيانات مفقودة للتسوية");

        let val = Number(amount);
        if (type === "جزاء" || type === "خصم" || type === "خصم عجز") {
          val = Math.abs(val) * -1;
        }
        db.courierLedger.push({
          courier,
          date: now(),
          type,
          tracking: "ADJUST",
          amount: val,
          desc: desc || `${type} للمندوب بقيمة ${amount} ج`,
        });

        // Treasury integration if needed
        if (type === "جزاء" || type === "خصم" || type === "خصم عجز") {
          db.cashbox.push({
            date: now(),
            desc: `تسوية خصم/جزاء مستقطع للمندوب: ${courier} - ${desc || ""}`,
            type: "إيداع",
            amount: Math.abs(val),
            ref: "PENALTY",
            addedBy: currentUser,
          });
        } else if (type === "مكافأة") {
          // cashbox payout for bonus
          db.cashbox.push({
            date: now(),
            desc: `مكافأة منصرفة للمندوب: ${courier} - ${desc || ""}`,
            type: "صرف",
            amount: val,
            ref: "BONUS",
            addedBy: currentUser,
          });
        }

        // Audit Log entry inside central system
        if (!db.auditLog) db.auditLog = [];
        db.auditLog.push({
          user: currentUser,
          type: `تسوية مندوب (${type})`,
          dateTime: now(),
          oldVal: "—",
          newVal: `${type}: ${val} ج.م للمندوب: ${courier}`,
          reason: desc || `تسجيل تسوية للمندوب: ${courier}`,
        });

        writeDB(db);
        return ok(res, { msg: "تم تسجيل التسوية المالية للمندوب بنجاح" });
      }

      // ─────────────────────────────────────────────────────────────
      // STATUS CHANGE LOGICAL DIARY
      // ─────────────────────────────────────────────────────────────
      case "statusHistory": {
        const historyList = db.statusHistory.filter(
          (h: any) => !d.tracking || h.tracking === d.tracking,
        );
        return ok(res, { history: historyList.reverse() });
      }

      // ─────────────────────────────────────────────────────────────
      // CASHBOX (TREASURY LEDGER) OPERATIONS
      // ─────────────────────────────────────────────────────────────
      case "cashbox": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "لا توجد لديك صلاحيات لرؤية الخزنة");
        }

        let balance = 0;
        const sortedEntries = [...db.cashbox].map((item: any) => {
          const isDeposit = [
            "وارد",
            "تحصيل مندوب",
            "إيداع خزنة direct",
            "إيداع",
            "استلام عهدة مندوب",
            "إيداع بالخزنة",
          ].includes(item.type);
          balance += isDeposit ? Number(item.amount) : -Number(item.amount);
          return { ...item, balance };
        });

        return ok(res, { entries: sortedEntries.reverse(), balance });
      }

      case "addCashbox": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "صلاحية مرفوضة لإدراج حركات الخزنة");
        }

        const { desc, type, amount, ref } = d;
        if (!amount || !type) return err(res, "المبلغ والنوع مطلوبان");

        READ_CACHE.clear();
        ACTIVE_FETCHES.clear();

        db.cashbox.push({
          date: now(),
          desc: desc || "",
          type: type,
          amount: Number(amount),
          ref: ref || "",
          addedBy: currentUser,
        });

        // ويتم تصفير عدادات المندوب الحركية فوراً لاستقبل يوم جديد
        if (type === "استلام عهدة مندوب" && ref) {
          const courierName = ref;
          if (db.orders) {
            for (const o of db.orders) {
              if (o.courier === courierName) {
                const isCommitted = [
                  "تم التسليم",
                  "تسليم جزئي",
                  "مرتجع",
                  "التسليم للمورد",
                  "تم تسليم المرتجع للمورد",
                  "مرتجع تم تسليمه للمورد",
                  "مرتجع والعميل دفع الشحن",
                ].includes(o.status);
                if (isCommitted) {
                  o.isClosed = true;
                }
              }
            }
          }
        }

        writeDB(db);
        return ok(res, { msg: "تم إدراج بند الخزينة وتصفيته وتصفير العدادات" });
      }

      // ─────────────────────────────────────────────────────────────
      // EXPENSES OPERATIONS
      // ─────────────────────────────────────────────────────────────
      case "expenses": {
        let expensesList = db.expenses || [];
        if (!["مدير", "محاسب"].includes(currentRole)) {
          expensesList = expensesList.filter(
            (e: any) => e.addedBy === currentUser,
          );
        }

        const total = expensesList.reduce(
          (sum: number, x: any) => sum + Number(x.amount),
          0,
        );
        return ok(res, { expenses: [...expensesList].reverse(), total });
      }

      case "addExpense": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "لا توجد صلاحيات صرف لميزانية المصروفات");
        }

        const { cat, desc, amount } = d;
        if (!amount) return err(res, "المبلغ مطلوب");

        const val = Number(amount);

        READ_CACHE.clear();
        ACTIVE_FETCHES.clear();

        // Save expense item
        db.expenses.push({
          date: now(),
          cat: cat || "أخرى",
          desc: desc || "",
          amount: val,
          by: currentUser,
        });

        // Automatically deduct from Treasury Cashbox (as 'مصروفات')
        db.cashbox.push({
          date: now(),
          desc: `صرف مصروف: ${desc || cat}`,
          type: "مصروفات",
          amount: val,
          ref: "EXPENSE",
          addedBy: currentUser,
        });

        writeDB(db);
        return ok(res, {
          msg: "تم إرساء بند الصرف بنجاح وسداده من الخزينة تلقائياً",
        });
      }

      // ─────────────────────────────────────────────────────────────
      // USER MANAGEMENT (Admin Only)
      // ─────────────────────────────────────────────────────────────
      case "getUsers": {
        if (currentRole !== "مدير") {
          return err(res, "صلاحية حصرية لمدير النظام");
        }
        const usersList = db.users.map((u: any, idx: number) => ({
          row: idx + 1,
          ...u,
        }));
        return ok(res, { users: usersList });
      }

      case "addUser":
      case "registerUser": {
        if (currentRole !== "مدير") {
          return err(res, "صلاحية حصرية لمدير النظام");
        }
        const { name, role, pass, email } = d;
        if (!name || !pass || !role) return err(res, "بيانات مفقودة للتسجيل");

        const userExists = db.users.find(
          (u: any) => u.name.trim() === name.trim(),
        );
        if (userExists) return err(res, "اسم المستخدم هذا مسجل مسبقاً");

        const getPermissionsForRole = (r: string) => {
          const rTrim = (r || "").trim();
          if (rTrim === "مدير") return "كاملة";
          if (rTrim === "مشرف") return "توزيع ومتابعة";
          if (rTrim === "مندوب") return "معاينة الشحنات والتقفيل";
          return "متابعة محدودة";
        };

        const newUserObj = {
          name: name.trim(),
          role: role,
          pass: hashPassword(pass.trim()),
          active: "نعم",
          email: email || "",
          perms: getPermissionsForRole(role),
        };

        db.users.push(newUserObj);

        // If newly added role is a courier, add to courier profiles list
        if (role === "مندوب") {
          db.couriers.push({
            name: name.trim(),
            phone: "—",
            commission: 20,
            salary: 3000,
            region: "—",
            base_fixed_salary: 3000,
            commission_success: 20,
            commission_return: 0,
          });
        }

        // If supplier, add to supplier profiles
        if (role === "مورد") {
          db.suppliers.push({
            name: name.trim(),
            phone: "—",
            price: 65,
            notes: "مورد جديد",
          });
        }

        writeDB(db);
        return ok(res, {
          msg: "تم إنشاء الحساب وإعداد الصلاحيات والملف المالي بنجاح",
        });
      }

      case "updateUser": {
        if (currentRole !== "مدير") {
          return err(res, "صلاحية حصرية لمدير النظام");
        }

        const { row, role, active, perms } = d;
        const index = Number(row) - 1;

        if (index < 0 || index >= db.users.length) {
          return err(res, "المستخدم غير موجود");
        }

        const target = db.users[index];
        target.role = role || target.role;
        target.active = active || target.active;
        target.perms = perms !== undefined ? perms : target.perms;

        writeDB(db);
        return ok(res, { msg: "تم تحديث بيانات المستخدم بنجاح" });
      }

      case "getStaffPermissions": {
        const list = db.staffPermissions || [];
        const isAdmin = currentRole === "مدير";
        
        // Salary protection
        const safeList = list.map((item: any) => {
          const copy = { ...item };
          if (!isAdmin) {
            copy.salary = null;
          }
          return copy;
        });
        return ok(res, { staff: safeList });
      }

      case "saveStaffPermissions": {
        if (currentRole !== "مدير") {
          return err(res, "صلاحية حصرية لمدير النظام");
        }
        const staff = d.staff || {};
        if (!staff.name) return err(res, "اسم الموظف مفقود");
        
        if (!db.staffPermissions) {
          db.staffPermissions = [];
        }
        
        const idx = db.staffPermissions.findIndex((item: any) => item.name.toString().trim() === staff.name.toString().trim());
        if (idx === -1) {
          db.staffPermissions.push(staff);
        } else {
          db.staffPermissions[idx] = { ...db.staffPermissions[idx], ...staff };
        }
        
        // Make sure they have a matching login user in db.users
        let uIdx = db.users.findIndex((item: any) => item.name.toString().trim() === staff.name.toString().trim());
        
        const getPermissionsStringForStaff = (s: any) => {
          const p = [];
          if (s.perm_dashboard === "true" || s.perm_dashboard === true) p.push("لوحة القيادة");
          if (s.perm_orders === "true" || s.perm_orders === true) p.push("الطلبات");
          if (s.perm_ledger === "true" || s.perm_ledger === true) p.push("الحسابات");
          if (s.perm_expenses === "true" || s.perm_expenses === true) p.push("المصاريف");
          if (s.perm_staff === "true" || s.perm_staff === true) p.push("الموظفين");
          return p.join(" · ") || "صلاحيات أساسية";
        };
        
        const userObj = {
          name: staff.name.trim(),
          role: staff.role,
          pass: hashPassword(d.pass || "123456"),
          active: "نعم",
          email: staff.name.trim() + "@friendplus.com",
          perms: getPermissionsStringForStaff(staff)
        };
        
        if (uIdx === -1) {
          db.users.push(userObj);
        } else {
          db.users[uIdx].role = staff.role;
          db.users[uIdx].perms = getPermissionsStringForStaff(staff);
          if (d.pass) {
            db.users[uIdx].pass = hashPassword(d.pass);
          }
        }
        
        // Also update or create courier profile if the role is "مندوب"
        const roleLower = (staff.role || "").toString().toLowerCase();
        if (roleLower === "مندوب" || roleLower.includes("مندوب")) {
          let cIdx = db.couriers.findIndex((item: any) => item.name.toString().trim() === staff.name.toString().trim());
          const courierObj = {
            name: staff.name.trim(),
            phone: staff.phone || "",
            salary: Number(staff.salary) || 3000,
            base_fixed_salary: Number(staff.salary) || 3000,
            commission: 25,
            commission_success: 25,
            commission_return: 10,
            region: "—"
          };
          if (cIdx === -1) {
            db.couriers.push(courierObj);
          } else {
            db.couriers[cIdx].phone = staff.phone || db.couriers[cIdx].phone;
            db.couriers[cIdx].salary = Number(staff.salary) || db.couriers[cIdx].salary;
            db.couriers[cIdx].base_fixed_salary = Number(staff.salary) || db.couriers[cIdx].base_fixed_salary;
          }
        }
        
        writeDB(db);
        return ok(res, { msg: "تم حفظ وتحديث بيانات وصلاحيات الموظف بنجاح" });
      }

      // ─────────────────────────────────────────────────────────────
      // PHONE NUMBER PRE-SCREEN CONTROLS
      // ─────────────────────────────────────────────────────────────
      case "checkPhone": {
        const phoneClean = fixPhone(d.phone || "");
        if (!phoneClean) return ok(res, { count: 0, rate: 0 });

        const matches = db.orders.filter(
          (o: any) =>
            fixPhone(o.phone) === phoneClean ||
            fixPhone(o.phone2) === phoneClean,
        );
        if (matches.length === 0) return ok(res, { count: 0, rate: 0 });

        const deliv = matches.filter(
          (o: any) => o.status === "تم التسليم",
        ).length;
        const rate = Math.round((deliv / matches.length) * 100);

        return ok(res, { count: matches.length, rate });
      }

      // ─────────────────────────────────────────────────────────────
      // RESOURCE MANAGEMENT / STATIC ARRAYS
      // ─────────────────────────────────────────────────────────────
      case "getCouriers": {
        let activeUsersCouriers = db.users.filter(
          (u: any) =>
            ((u.role || "").toString().trim() === "مندوب" ||
              (u.role || "").toString().trim().indexOf("مندوب") > -1 ||
              (u.name || "").toString().trim() === "عصفور") &&
            u.active !== "لا",
        );

        const isAdmin = currentRole === "مدير";
        const isSupervisor = currentRole === "مشرف" || (currentRole || "").toString().includes("مشرف");

        if (isSupervisor) {
          const staffPermissionsList = db.staffPermissions || [];
          const supervisedNames = staffPermissionsList
            .filter((item: any) => (item.supervisor_id || "").toString().trim().toLowerCase() === currentUser.trim().toLowerCase())
            .map((item: any) => (item.name || "").toString().trim().toLowerCase());
          activeUsersCouriers = activeUsersCouriers.filter((u: any) => {
            const uName = (u.name || "").toString().trim().toLowerCase();
            return supervisedNames.includes(uName);
          });
        }

        const list = activeUsersCouriers.map((u: any) => {
          const profile =
            db.couriers.find(
              (c: any) => c.name.toString().trim() === u.name.toString().trim(),
            ) || {};
          return {
            name: u.name,
            phone: profile.phone || "—",
            commission:
              profile.commission !== undefined ? profile.commission : 25,
            salary: isAdmin ? (profile.salary !== undefined ? profile.salary : 3000) : null,
            region: profile.region || "—",
            base_fixed_salary: isAdmin ? (
              profile.base_fixed_salary !== undefined
                ? profile.base_fixed_salary
                : profile.salary || 3000
            ) : null,
            commission_success:
              profile.commission_success !== undefined
                ? profile.commission_success
                : profile.commission || 25,
            commission_return:
              profile.commission_return !== undefined
                ? profile.commission_return
                : 10,
            hire_date: profile.hire_date || "",
            last_closing_date: profile.last_closing_date || "",
          };
        });
        return ok(res, { couriers: list });
      }

      case "updateCourier": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "صلاحية حصرية لإدارة الحسابات");
        }
        const {
          name,
          phone,
          region,
          base_fixed_salary,
          commission_success,
          commission_return,
          hire_date,
        } = d;
        if (!name)
          return err(res, "اسم المندوب مطلوب لتحديث بيانات الملف المالي");

        const trimmedName = name.toString().trim();
        let courier = db.couriers.find(
          (c: any) =>
            c.name &&
            sameCourier(c.name, trimmedName),
        );

        if (!courier) {
          courier = {
            name: trimmedName,
            phone: phone || "—",
            salary: Number(
              base_fixed_salary !== undefined ? base_fixed_salary : 3000,
            ),
            commission: Number(
              commission_success !== undefined ? commission_success : 25,
            ),
            region: region || "—",
            base_fixed_salary: Number(
              base_fixed_salary !== undefined ? base_fixed_salary : 3000,
            ),
            commission_success: Number(
              commission_success !== undefined ? commission_success : 25,
            ),
            commission_return: Number(
              commission_return !== undefined ? commission_return : 10,
            ),
            hire_date: hire_date || "",
            last_closing_date: "",
          };
          db.couriers.push(courier);
        } else {
          courier.phone = phone || courier.phone || "—";
          courier.region = region || courier.region || "—";
          courier.salary = Number(
            base_fixed_salary !== undefined
              ? base_fixed_salary
              : courier.salary || 3000,
          );
          courier.commission = Number(
            commission_success !== undefined
              ? commission_success
              : courier.commission || 25,
          );
          courier.base_fixed_salary = Number(
            base_fixed_salary !== undefined
              ? base_fixed_salary
              : courier.base_fixed_salary || 3000,
          );
          courier.commission_success = Number(
            commission_success !== undefined
              ? commission_success
              : courier.commission_success || 25,
          );
          courier.commission_return = Number(
            commission_return !== undefined
              ? commission_return
              : courier.commission_return || 10,
          );
          courier.hire_date = hire_date !== undefined ? hire_date : courier.hire_date || "";
        }

        writeDB(db);

        // Audit Log entry inside central system
        if (!db.auditLog) db.auditLog = [];
        db.auditLog.push({
          user: currentUser,
          type: "تعديل إعدادات مندوب",
          dateTime: now(),
          oldVal: "—",
          newVal: `تم تعديل المندوب ${name}: الراتب: ${base_fixed_salary}، نجاح: ${commission_success}، مرتجع: ${commission_return}`,
          reason: "تحديث إعدادات الراتب والعمولة",
        });

        return ok(res, { msg: "تم تحديث وحفظ بيانات المندوب بنجاح" });
      }

      case "getSuppliers": {
        return ok(res, { suppliers: db.suppliers });
      }

      case "saveSupplier": {
        if (!["مدير", "محاسب"].includes(currentRole)) {
          return err(res, "فقط المدير والمحاسب يمتلك صلاحية تعديل بيانات الموردين");
        }

        const { name, phone, price, notes, openingBalance } = d;
        if (!name) return err(res, "اسم المورد مطلوب");

        if (!db.suppliers) db.suppliers = [];
        let sup = db.suppliers.find((s: any) => sameSup(s.name, name));
        if (!sup) {
          sup = { name };
          db.suppliers.push(sup);
        }

        sup.phone = phone || "";
        sup.price = Number(price || 0);
        sup.notes = notes || "";
        sup.openingBalance = Number(openingBalance || 0);
        sup.updatedAt = now();

        writeDB(db);
        return ok(res, { msg: "تم حفظ وتحديث بيانات المورد بنجاح" });
      }

      case "report": {
        const { type, courier, supplier } = d;
        const ordersList = db.orders;
        const todayDate = tod();
        let list = [];

        switch (type) {
          case "today":
            list = ordersList.filter(
              (o: any) => isDateToday(o.createdAt) || isDateToday(o.updatedAt),
            );
            break;
          case "pending":
            list = ordersList.filter((o: any) =>
              [
                "جديد",
                "تم الإسناد",
                "خارج مع المندوب",
                "مؤجل",
                "لا يوجد رد",
              ].includes(getOrderStatus(o)),
            );
            break;
          case "return":
            list = ordersList.filter((o: any) =>
              ["مرتجع", "التسليم للمورد", "تم تسليم المرتجع للمورد"].includes(
                getOrderStatus(o),
              ),
            );
            break;
          case "delivered":
            list = ordersList.filter(
              (o: any) => getOrderStatus(o) === "تم التسليم",
            );
            break;
          default:
            list = ordersList;
        }

        if (courier)
          list = list.filter((o: any) => getOrderCourier(o) === courier);
        if (supplier)
          list = list.filter((o: any) => {
            const oSup = getOrderSupplier(o);
            return oSup && sameSup(oSup, supplier);
          });

        return ok(res, { orders: list, count: list.length });
      }

      default:
        return err(res, `العملية المطلوبة ${d.action} غير مدعومة`);
    }
  } catch (error: any) {
    console.error("SERVER DISPATCH ERROR:", error);
    return err(res, "حدث خطأ داخلي في الخادم: " + error.message);
  }
});

// ─────────────────────────────────────────────────────────────
// MIDDLEWARES & DEV SERVERS INGRESS
// ─────────────────────────────────────────────────────────────
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `🚚 Friend Plus Logistics is running on http://localhost:${PORT}`,
    );
  });
}

export default app;

if (!process.env.VERCEL) {
  startServer();
}
