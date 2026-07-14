// normalization of digits and formatting
export function fixPhoneJS(p: string | number): string {
  if (!p) return "";
  let pStr = p.toString().replace(/[^0-9]/g, "");
  if (!pStr) return "";
  if (pStr.startsWith("002")) pStr = pStr.substring(3);
  if (pStr.startsWith("20") && pStr.length === 12) pStr = "0" + pStr.substring(2);
  if (!pStr.startsWith("0") && pStr.length === 10) pStr = "0" + pStr;
  return pStr;
}

export function formatPhoneForWA(phone: string | number): string {
  if (!phone) return "";
  let digits = phone.toString().replace(/\D/g, "");
  
  // If starts with 0020 and has 14 digits, clean off the 00
  if (digits.startsWith("0020") && digits.length === 14) {
    return digits.substring(2);
  }
  else if (digits.startsWith("00") && digits.length > 10) {
    digits = digits.substring(2);
  }

  // If starts with 20 and has 12 digits, perfect Egyptian WhatsApp number
  if (digits.startsWith("20") && digits.length === 12) {
    return digits;
  }

  // If starts with 0 and has 11 digits (like 01012345678), remove the 0 and prepend 20
  if (digits.startsWith("0") && digits.length === 11) {
    return "20" + digits.substring(1);
  }

  // If 10 digits and starts with 1 (like 1012345678)
  if (!digits.startsWith("0") && digits.length === 10 && /^(10|11|12|15)/.test(digits)) {
    return "20" + digits;
  }

  // General fallback
  if (digits.startsWith("0")) {
    digits = "20" + digits.substring(1);
  } else if (!digits.startsWith("20")) {
    digits = "20" + digits;
  }
  return digits;
}

export function getOrderWAMessage(o: any): string {
  if (!o) return "";
  const name = o.customer || "العميل الكريم";
  const tracking = o.tracking || "—";
  const productName = (o.prodType && o.prodType.toString().trim()) || (o.product && o.product.toString().trim()) || "بضاعة متنوعة";
  const pPrice = Number(o.prodPrice || 0);
  const sPrice = Number(o.shipPrice || 0);
  const totalAmount = o.totalCOD || (pPrice + sPrice);

  return `🚨 *تفاصيل شحنتك من Asfoor Store* 🚨

أهلاً بك يا فندم، ${name} 🌹
معك مندوب شركة شحن *Asfoor Store*. يسعدنا إبلاغك بأن شحنتك جاهزة وبانتظار تحديد موعد التسليم اليوم.

📦 تفاصيل الشحنة:
- **رقم التتبع (الباركود):** ${tracking}
- **اسم المنتج:** ${productName}
- **سعر المنتج:** ${pPrice} ج.م
- **تكلفة التوصيل:** ${sPrice} ج.م
- **الإجمالي المطلوب تحصيله:** *${totalAmount} ج.م*

يرجى الرد على هذه الرسالة الآن بـ *( تأكيد )* وتأكيد موافقتك لتكليف المندوب بالتوجه إليك فوراً لتوصيل الطلب. شكراً لثقتك بنا!`;
}

export function toWA(phone: string): string {
  return formatPhoneForWA(phone);
}

export function toWAUrl(phone: string | number, message: string = ""): string {
  const cleanPhone = formatPhoneForWA(phone);
  if (!cleanPhone) return "#";
  const encodedText = encodeURIComponent(message);
  return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedText}`;
}

export function validatePhone(ph: string): { valid: boolean; msg: string } {
  const p = fixPhoneJS(ph);
  if (!p) return { valid: false, msg: "رقم الهاتف فارغ" };
  if (p.length !== 11) return { valid: false, msg: "رقم الهاتف يجب أن يتكون من 11 رقماً" };
  if (!/^01[0125][0-9]{8}$/.test(p)) return { valid: false, msg: "رقم الهاتف غير صحيح (يجب أن يبدأ بـ 010 أو 011 أو 012 أو 015)" };
  return { valid: true, msg: "" };
}

// Unified API caller for the react fullstack container environment
export async function apiCall(action: string, token: string, extraParams: any = {}, retries = 3): Promise<any> {
  const payload = { action, token, ...extraParams };
  
  for (let i = 0; i <= retries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 120s timeout
      
      let response;
      try {
        response = await fetch("/api", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } catch (fetchErr: any) {
        // Propagate fetch errors to outer catch so it triggers the retry block safely
        throw fetchErr;
      } finally {
        clearTimeout(timeoutId);
      }
      
      let responseText = "";
      try {
        responseText = await response.text();
      } catch (textErr: any) {
        throw new Error(`Failed to parse response stream: ${textErr?.message}`);
      }
      
      let resData;
      try {
        resData = JSON.parse(responseText);
      } catch (parseErr) {
        console.warn(`Non-JSON response for ${action}:`, responseText);
        // If they received HTML (like Vercel serverless error pages)
        if (response.status === 504) {
          return {
            ok: false,
            error: "انتهت مهلة خادم فيرسيل (504 Gateway Timeout). يرجى التحقق من سرعة استجابة سكريبت جوجل شيت."
          };
        }
        if (response.status === 502 || response.status === 500) {
          return {
            ok: false,
            error: `فشل خادم فيرسيل (كود ${response.status}). يرجى التأكد من كتابة متغير GOOGLE_SCRIPT_URL بشكل صحيح وإجراء Redeploy للموقع.`
          };
        }
        return {
          ok: false,
          error: `خطأ اتصال من فيرسيل (${response.status}): يرجى تفعيل وإدخال متغير GOOGLE_SCRIPT_URL في إعدادات فيرسيل`
        };
      }
      return resData;
    } catch (error: any) {
      if (i === retries) {
        console.error(`API Call failed after ${retries} retries for action ${action}:`, error);
        const isTimeout = error?.name === "AbortError";
        return {
          ok: false,
          error: isTimeout 
            ? "انتهت مهلة الاتصال بالخادم (20 ثانية) دون رد من جوجل شيت. يرجى إعادة المحاولة."
            : `تعذر الاتصال بالخادم الرئيسي: ${error?.message || "يرجى التحقق من اتصال الإنترنت"}`
        };
      }
      // Silent Auto-Retry: Wait for 3 seconds silently before next attempt as requested
      await new Promise((res) => setTimeout(res, 3000));
    }
  }
}

// Helper to get today's date in YYYY-MM-DD format (Egypt/Cairo Timezone)
export function getTodayDateStr(): string {
  try {
    const s = new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" });
    const d = new Date(s);
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch (e) {
    const d = new Date();
    d.setHours(d.getHours() + 3); // Cairo offset fallback
    return d.toISOString().substring(0, 10);
  }
}

// Normalize any date formats to a standard YYYY-MM-DD string
export function normalizeDateToYMD(dateInput: any): string {
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

// 1. Generate realistic hardcoded logistics Mock Orders matching Silver Team and Malik Brand specific requirements
export function getMockOrders(): any[] {
  const today = getTodayDateStr();
  const list: any[] = [];

  // Silver Team (18 orders: 5 delivered, 2 returned, 11 warehouse/pending)
  // 5 Delivered
  list.push({
    tracking: "FP-SLV-101",
    createdAt: `${today} 09:30`,
    updatedAt: `${today} 12:00`,
    orderDate: today,
    delivDate: `${today} 12:00`,
    supplier: "Silver Team",
    customer: "أحمد كمال",
    phone: "01012345678",
    gov: "القاهرة",
    region: "المعادي",
    address: "شارع 9 أ",
    prodPrice: 350,
    shipPrice: 65,
    totalCOD: 415,
    courier: "عصفور",
    status: "تم التسليم",
    notes: "تم الاتصال بالعميل والتسليم والتحصيل"
  });

  list.push({
    tracking: "FP-SLV-102",
    createdAt: `${today} 10:00`,
    updatedAt: `${today} 13:00`,
    orderDate: today,
    delivDate: `${today} 13:00`,
    supplier: "Silver Team",
    customer: "صلاح محمود",
    phone: "01144556677",
    gov: "الجيزة",
    region: "المهندسين",
    address: "شارع جامعة الدول",
    prodPrice: 400,
    shipPrice: 65,
    totalCOD: 465,
    courier: "ابو ياسين",
    status: "تم التسليم",
    notes: "توصيل سريع وممتاز"
  });

  list.push({
    tracking: "FP-SLV-103",
    createdAt: `${today} 10:15`,
    updatedAt: `${today} 14:00`,
    orderDate: today,
    delivDate: `${today} 14:00`,
    supplier: "Silver Team",
    customer: "وليد الجبالي",
    phone: "01211223344",
    gov: "القاهرة",
    region: "التجمع الخامس",
    address: "المنطقة الثانية",
    prodPrice: 500,
    shipPrice: 65,
    totalCOD: 565,
    courier: "زياد",
    status: "تم التسليم",
    notes: "تم تحصيل المبلغ كاملاً"
  });

  list.push({
    tracking: "FP-SLV-104",
    createdAt: `${today} 11:00`,
    updatedAt: `${today} 14:30`,
    orderDate: today,
    delivDate: `${today} 14:30`,
    supplier: "Silver Team",
    customer: "كريم شريف",
    phone: "01511229988",
    gov: "الجيزة",
    region: "الهرم",
    address: "بجوار نفق الهرم",
    prodPrice: 200,
    shipPrice: 65,
    totalCOD: 265,
    courier: "محمد حمدى",
    status: "تم التسليم",
    notes: "تم التسليم بدون عوائق"
  });

  list.push({
    tracking: "FP-SLV-105",
    createdAt: `${today} 11:30`,
    updatedAt: `${today} 15:00`,
    orderDate: today,
    delivDate: `${today} 15:00`,
    supplier: "Silver Team",
    customer: "هاني يسري",
    phone: "01033445566",
    gov: "القاهرة",
    region: "مدينة نصر",
    address: "شارع عباس العقاد",
    prodPrice: 450,
    shipPrice: 65,
    totalCOD: 515,
    courier: "عصفور",
    status: "تم التسليم",
    notes: "الدفع كاش"
  });

  // 2 Returned
  list.push({
    tracking: "FP-SLV-106",
    createdAt: `${today} 09:00`,
    updatedAt: `${today} 11:00`,
    orderDate: today,
    retDate: `${today} 11:00`,
    supplier: "Silver Team",
    customer: "سعيد عبد الرحمن",
    phone: "01288775533",
    gov: "القاهرة",
    region: "مصر الجديدة",
    address: "شارع الحجاز",
    prodPrice: 300,
    shipPrice: 65,
    totalCOD: 365,
    courier: "زياد",
    status: "مرتجع",
    notes: "رفض الاستلام بسبب مقاس خاطئ"
  });

  list.push({
    tracking: "FP-SLV-107",
    createdAt: `${today} 09:15`,
    updatedAt: `${today} 11:30`,
    orderDate: today,
    retDate: `${today} 11:30`,
    supplier: "Silver Team",
    customer: "إبراهيم فرج",
    phone: "01199887766",
    gov: "الجيزة",
    region: "فيصل",
    address: "شارع العشرين",
    prodPrice: 150,
    shipPrice: 65,
    totalCOD: 215,
    courier: "محمد حمدى",
    status: "مرتجع",
    notes: "الزبون ألغى الطلب"
  });

  // 11 Warehouse / Pending
  for (let i = 1; i <= 11; i++) {
    list.push({
      tracking: `FP-SLV-W${i}`,
      createdAt: `${today} 08:30`,
      updatedAt: `${today} 08:30`,
      orderDate: today,
      supplier: "Silver Team",
      customer: `عميل سيلفر مخزن ${i}`,
      phone: `010${Math.floor(10000000 + Math.random() * 90000000)}`,
      gov: "القاهرة",
      region: "شبرا الخيمة",
      address: "شارع السلام",
      prodPrice: 280,
      shipPrice: 65,
      totalCOD: 345,
      courier: i % 2 === 0 ? "عصفور" : "",
      status: i % 2 === 0 ? "تم الإسناد" : "جديد"
    });
  }

  // Malik Brand (10 delivered, 17 returned, 34 warehouse/pending)
  // 10 Delivered
  for (let i = 1; i <= 10; i++) {
    list.push({
      tracking: `FP-MLK-D${i}`,
      createdAt: `${today} 08:00`,
      updatedAt: `${today} 10:30`,
      orderDate: today,
      delivDate: `${today} 10:30`,
      supplier: "Malik Brand",
      customer: `عميل مالك سداد ${i}`,
      phone: `012${Math.floor(10000000 + Math.random() * 90000000)}`,
      gov: "القاهرة",
      region: "الزيتون",
      address: "بجوار المحطة",
      prodPrice: 600,
      shipPrice: 70,
      totalCOD: 670,
      courier: i % 2 === 0 ? "ابو ياسين" : "عصفور",
      status: "تم التسليم",
      notes: "تم تحصيل القيمة المادية بالكامل"
    });
  }

  // 17 Returned (so combined 2 + 17 = 19 returned)
  for (let i = 1; i <= 17; i++) {
    list.push({
      tracking: `FP-MLK-R${i}`,
      createdAt: `${today} 08:15`,
      updatedAt: `${today} 10:45`,
      orderDate: today,
      retDate: `${today} 10:45`,
      supplier: "Malik Brand",
      customer: `عميل مالك مرتجع ${i}`,
      phone: `011${Math.floor(10000000 + Math.random() * 90000000)}`,
      gov: "الجيزة",
      region: "الدقي",
      address: "شارع لبنان",
      prodPrice: 320,
      shipPrice: 70,
      totalCOD: 390,
      courier: "زياد",
      status: "مرتجع",
      notes: "مرتجع كلي"
    });
  }

  // 34 Warehouse / Pending (so combined 11 + 34 = 45 warehouse orders)
  for (let i = 1; i <= 34; i++) {
    list.push({
      tracking: `FP-MLK-W${i}`,
      createdAt: `${today} 08:45`,
      updatedAt: `${today} 08:45`,
      orderDate: today,
      supplier: "Malik Brand",
      customer: `عميل مالك مخزن ${i}`,
      phone: `015${Math.floor(10000000 + Math.random() * 90000000)}`,
      gov: "الإسكندرية",
      region: "سموحة",
      address: "المنطقة التجارية",
      prodPrice: 420,
      shipPrice: 80,
      totalCOD: 500,
      courier: i % 3 === 0 ? "محمد حمدى" : "",
      status: i % 3 === 0 ? "تم الإسناد" : "جديد"
    });
  }

  return list;
}

// 2. Mock Expenses array (with the 650 EGP oil expense + others)
export function getMockExpenses(): any[] {
  const today = getTodayDateStr();
  return [
    { date: `${today} 09:00`, cat: "صيانة", desc: "650 جنيه زيت ومصروفات صيانة السيارات ومحروقات", amount: 650, by: "المحاسب أحمد" },
    { date: `${today} 11:30`, cat: "بوفيه", desc: "مصروفات ضيافة وبوفيه وإيجار بوفيه يومي للشركة", amount: 150, by: "المحاسب أحمد" }
  ];
}

// 3. Mock Cashbox ledger entries
export function getMockCashboxEntries(): any[] {
  const today = getTodayDateStr();
  return [
    { date: `${today} 08:00`, desc: "رأس مال ابتدائي لتسوية الخزنة", type: "وارد", amount: 50000, ref: "CAP-INIT", addedBy: "المحاسب أحمد", balance: 50000 },
    { date: `${today} 09:00`, desc: "سحب مصروفات زيت وصيانة السيارات ومحروقات", type: "صادر", amount: 650, ref: "EXP-01", addedBy: "المحاسب أحمد", balance: 49350 },
    { date: `${today} 11:30`, desc: "سحب مصروفات بوفيه وضيافة والوجبات اليومية", type: "صادر", amount: 150, ref: "EXP-02", addedBy: "المحاسب أحمد", balance: 49200 }
  ];
}
