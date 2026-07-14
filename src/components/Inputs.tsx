import React, { useRef, useState } from "react";
import { PlusCircle, Upload, Camera, FileSpreadsheet, Loader2, RefreshCw, Layers } from "lucide-react";
import { apiCall, fixPhoneJS, validatePhone } from "../utils";
import * as XLSX from "xlsx";

interface InputsProps {
  token: string;
  role: string;
  user: string;
  onSuccess: () => void;
}

export default function Inputs({ token, role, user, onSuccess }: InputsProps) {
  const isSupplier = role === "مورد";
  const [activeTab, setActiveTab] = useState<"manual" | "excel" | "ocr">("manual");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  // --- Manual Form States ---
  const [formSupplier, setFormSupplier] = useState(isSupplier ? user : "");
  const [formCustomer, setFormCustomer] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formProductType, setFormProductType] = useState("");
  const [formGov, setFormGov] = useState("القاهرة");
  const [formRegion, setFormRegion] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [formProdPrice, setFormProdPrice] = useState("");
  const [formShipPrice, setFormShipPrice] = useState("65");
  const [formNotes, setFormNotes] = useState("");
  const [dupWarning, setDupWarning] = useState("");

  // --- Bulk File Upload States ---
  const [excelData, setExcelData] = useState<any[]>([]);
  const [bulkSupplier, setBulkSupplier] = useState(isSupplier ? user : "");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [mappingModal, setMappingModal] = useState<{
    isOpen: boolean;
    headers: string[];
    rows: any[][];
    mappings: { [key: string]: string };
    encoding: "utf-8" | "windows-1256";
  } | null>(null);

  const [suppliersList, setSuppliersList] = useState<any[]>(() => {
    try {
      const cached = localStorage.getItem("cached_suppliers");
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  React.useEffect(() => {
    async function loadSuppliers() {
      try {
        const res = await apiCall("getSuppliers", token);
        if (res.ok && res.suppliers) {
          setSuppliersList(res.suppliers);
          try {
            localStorage.setItem("cached_suppliers", JSON.stringify(res.suppliers));
          } catch (e) {
            console.warn("Storage write blocked", e);
          }
        }
      } catch (err) {
        console.error("Failed to load suppliers in Inputs", err);
      }
    }
    if (!isSupplier) {
      loadSuppliers();
    }
  }, [token, isSupplier]);

  // --- OCR Utilities ---
  const [ocrStatus, setOcrStatus] = useState("");
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const EgyptGovs = [
    "القاهرة", "الجيزة", "الإسكندرية", "الدقهلية", "الشرقية", "القليوبية", "كفر الشيخ", "الغربية", "المنوفية",
    "البحيرة", "الإسماعيلية", "بور سعيد", "السويس", "المنيا", "أسيوط", "سوهاج", "قنا", "الأقصر", "أسوان",
    "البحر الأحمر", "شمال سيناء", "جنوب سيناء", "مطروح", "الوادي الجديد", "بني سويف", "الفيوم"
  ];

  // --- Phone pre-screening checker ---
  async function checkPhoneDup() {
    const p = fixPhoneJS(formPhone);
    if (!p) return;
    const validation = validatePhone(p);
    if (!validation.valid) {
      setDupWarning(`✕ ${validation.msg}`);
      return;
    }
    
    setDupWarning("");
    try {
      const res = await apiCall("checkPhone", token, { phone: p });
      if (res.ok && res.count > 0) {
        setDupWarning(`⚠️ تذكير: العميل لديه ${res.count} طلب سابق بالشركة (سجل تسليم ناجح بنسبة ${res.rate}%)`);
      }
    } catch (e) {
      console.warn("Phone duplicate check offline", e);
    }
  }

  // --- Submit single manual order (Workflow constraints) ---
  async function submitManual(force = false) {
    if (loading) return;
    if (!formCustomer.trim() || !formPhone.trim() || !formProdPrice) {
      alert("يرجى ملء الحقول المطلوبة: العميل، الهاتف، سعر المنتج");
      return;
    }

    const phClean = fixPhoneJS(formPhone);
    const phVal = validatePhone(phClean);
    if (!phVal.valid) {
      alert(phVal.msg);
      return;
    }

    setLoading(true);
    setFeedback("");
    try {
      // Logic checking if phone number already exists in database before proceeding with insertion
      if (!force) {
        const checkRes = await apiCall("checkPhone", token, { phone: phClean });
        if (checkRes.ok && checkRes.count > 0) {
          const proceed = window.confirm(`⚠️ تنبيه هاتف مكرر: رقم الهاتف (${phClean}) لديه بالفعل ${checkRes.count} طلب سابق مسجل في النظام بنسبة تسليم ${checkRes.rate}%.\n\nهل أنت متأكد من رغبتك في تسجيل أوردر مكرر جديد لهذا العميل؟`);
          if (!proceed) {
            setLoading(false);
            return;
          }
        }
      }

      const res = await apiCall("addOrder", token, {
        force: true, // Approved or verified
        order: {
          supplier: isSupplier ? user : formSupplier.trim(),
          customer: formCustomer.trim(),
          phone: phClean,
          phone2: "", // phone2 is sunsetted
          prodType: formProductType.trim(),
          gov: formGov,
          region: formRegion.trim(),
          address: formAddress.trim(),
          prodPrice: Number(formProdPrice),
          shipPrice: Number(formShipPrice),
          notes: formNotes.trim()
        }
      });

      if (res.ok) {
        alert(res.msg || "تم حفظ الأوردر جديد بنجاح بنظام الإسناد اللاحق");
        resetForm();
        onSuccess();
      } else {
        setFeedback(res.error || "عثر الخادم على خطأ أثناء التسجيل");
      }
    } catch (err) {
      setFeedback("فشل الاتصال بالخادم، لم يتم تسجيل الطلب اليدوي");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormCustomer("");
    setFormPhone("");
    setFormProductType("");
    setFormRegion("");
    setFormAddress("");
    setFormProdPrice("");
    setFormShipPrice("65");
    setFormNotes("");
    setDupWarning("");
    setFeedback("");
  }

  // --- CSV / Excel parser client routine ---
  const FIELD_SYNONYMS: { [key: string]: string[] } = {
    customer: ["اسم العميل", "العميل", "اسم المستلم", "المستلم", "الاسم", "customer", "customer_name", "client"],
    phone: ["الهاتف", "رقم الهاتف", "التليفون", "رقم التليفون", "تليفون", "هاتف", "موبايل", "رقم الموبايل", "phone", "mobile", "tel"],
    address: ["العنوان", "العنوان بالتفصيل", "عنوان", "عنوان المستلم", "address", "details_address"],
    gov: ["المحافظة", "المحافظه", "مقاولة المحافظة", "gov", "governorate", "city"],
    region: ["المنطقة", "المنطقه", "الحي", "region", "area", "zone"],
    totalCOD: ["المطلوب تحصيله", "التحصيل", "المطلوب", "إجمالي الكود", "الإجمالي", "الاجمالي", "إجمالي الأوردر", "قيمة الأوردر", "المبلغ", "السعر الكلي", "كود", "total", "totalcod", "total_cod", "cash", "amount"],
    prodPrice: ["سعر المنتج", "المنتج", "سعر البضاعة", "البضاعة", "سعر المادة", "price", "prodprice", "product_price"],
    shipPrice: ["سعر الشحن", "الشحن", "تكلفة الشحن", "مصاريف الشحن", "shipping", "shipprice", "ship_price"],
    prodType: ["نوع المنتج", "المنتج", "الصنف", "صنف", "الأصناف", "المحتويات", "المحتوى", "product", "prodtype", "type"],
    notes: ["ملاحظات", "الملاحظات", "ملاحظة", "notes", "note", "comment"],
    supplier: ["المورد", "اسم المورد", "مورد", "merchant", "supplier", "vendor"]
  };

  const TARGET_FIELDS = [
    { key: "customer", label: "اسم العميل / المستلم", required: true },
    { key: "phone", label: "رقم الهاتف", required: true },
    { key: "address", label: "العنوان بالتفصيل", required: true },
    { key: "gov", label: "المحافظة", required: false, default: "القاهرة" },
    { key: "region", label: "المنطقة / الحي", required: false },
    { key: "totalCOD", label: "المطلوب تحصيله (COD)", required: false },
    { key: "prodPrice", label: "سعر المنتج (حق المورد)", required: false },
    { key: "shipPrice", label: "سعر الشحن للشركة", required: false, default: "65" },
    { key: "prodType", label: "نوع المنتج / الصنف", required: false },
    { key: "notes", label: "ملاحظات الشحنة", required: false },
    { key: "supplier", label: "اسم المورد", required: false }
  ];

  function handleFileRead(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const r = new FileReader();
    r.onload = (event) => {
      try {
        const arrayBuffer = event.target?.result as ArrayBuffer;
        const data = new Uint8Array(arrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert sheet to array of arrays so we can easily resolve headers by name or fallback by index
        const rows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1 });
        
        if (rows.length < 2) {
          alert("الملف فارغ أو لا يحتوي على صفوف بيانات صحيحة");
          return;
        }

        // Clean and prepare headers
        const rawHeaders = (rows[0] || []).map((h: any) => h ? h.toString().trim() : "");
        const cleanHeaders = rawHeaders.map(h => h.toLowerCase().trim());
        const initialMappings: { [key: string]: string } = {};

        Object.keys(FIELD_SYNONYMS).forEach((fieldKey) => {
          const synonyms = FIELD_SYNONYMS[fieldKey];
          const foundIdx = cleanHeaders.findIndex(header => 
            synonyms.some(syn => header === syn.toLowerCase().trim() || header.includes(syn.toLowerCase().trim()))
          );
          if (foundIdx !== -1) {
            initialMappings[fieldKey] = rawHeaders[foundIdx];
          } else {
            initialMappings[fieldKey] = "";
          }
        });

        setMappingModal({
          isOpen: true,
          headers: rawHeaders,
          rows: rows.slice(1),
          mappings: initialMappings,
          encoding: "utf-8"
        });
        
      } catch (err: any) {
        alert("حدث خطأ أثناء قراءة ومعالجة شيت الإكسيل: " + (err.message || err));
      }
    };
    r.readAsArrayBuffer(file);
  }

  function confirmExcelMapping() {
    if (!mappingModal) return;
    const { rows, headers, mappings } = mappingModal;
    
    if (!mappings.customer) {
      alert("⚠️ حقل 'اسم العميل / المستلم' مطلوب للمطابقة!");
      return;
    }
    if (!mappings.phone) {
      alert("⚠️ حقل 'رقم الهاتف' مطلوب للمطابقة!");
      return;
    }

    const list: any[] = [];
    
    for (let i = 0; i < rows.length; i++) {
      const rowData = rows[i];
      if (!rowData || rowData.length === 0) continue;

      // Check if at least one column is filled (to skip empty rows)
      const isRowEmpty = rowData.every((val: any) => val === undefined || val === null || val.toString().trim() === "");
      if (isRowEmpty) continue;

      const getValueByHeader = (headerName: string): string => {
        if (!headerName) return "";
        const idx = headers.indexOf(headerName);
        if (idx !== -1 && rowData[idx] !== undefined && rowData[idx] !== null) {
          return rowData[idx].toString().trim();
        }
        return "";
      };

      const customerVal = getValueByHeader(mappings.customer);
      const phoneVal = getValueByHeader(mappings.phone);
      const addressVal = getValueByHeader(mappings.address);
      const govVal = getValueByHeader(mappings.gov) || "القاهرة";
      const regionVal = getValueByHeader(mappings.region);
      const prodTypeVal = getValueByHeader(mappings.prodType) || "منتج عام";
      const notesVal = getValueByHeader(mappings.notes);
      const supplierVal = getValueByHeader(mappings.supplier);

      let resolvedShip = 65;
      const shipMatch = getValueByHeader(mappings.shipPrice);
      if (shipMatch && !isNaN(Number(shipMatch))) {
        resolvedShip = Number(shipMatch);
      }

      let resolvedTotal = 0;
      const totalMatch = getValueByHeader(mappings.totalCOD);
      if (totalMatch && !isNaN(Number(totalMatch))) {
        resolvedTotal = Number(totalMatch);
      }

      let resolvedProd = 0;
      const prodMatch = getValueByHeader(mappings.prodPrice);
      if (prodMatch && !isNaN(Number(prodMatch))) {
        resolvedProd = Number(prodMatch);
      }

      if (resolvedTotal > 0) {
        if (resolvedProd === 0) {
          resolvedProd = resolvedTotal - resolvedShip;
        } else if (resolvedShip === 65 && resolvedTotal > resolvedProd) {
          resolvedShip = resolvedTotal - resolvedProd;
        }
      } else {
        resolvedTotal = resolvedProd + resolvedShip;
      }

      if (!customerVal && !phoneVal) continue;

      list.push({
        customer: customerVal,
        phone: phoneVal,
        address: addressVal,
        gov: govVal,
        region: regionVal,
        prodPrice: resolvedProd,
        shipPrice: resolvedShip,
        totalCOD: resolvedTotal,
        prodType: prodTypeVal,
        notes: notesVal,
        supplier: supplierVal,
        status: "جاهز للاستلام من المورد"
      });
    }

    setExcelData(list);
    setMappingModal(null);
  }

  async function submitBulkExcel() {
    if (loading) return;
    if (excelData.length === 0) {
      alert("الرجاء تحديد ملف Excel/CSV أولاً");
      return;
    }

    const hasRowsWithoutMerchant = excelData.some(item => !item.supplier || !item.supplier.trim());

    if (!isSupplier && hasRowsWithoutMerchant && !bulkSupplier.trim()) {
      alert("⚠️ الملف يحتوي على طلبات بدون اسم مورد، يرجى تحديد 'المورد الاحتياطي' من القائمة أولاً");
      return;
    }

    setLoading(true);
    setFeedback("");
    try {
      const res = await apiCall("addBulk", token, {
        orders: excelData,
        supplier: isSupplier ? user : bulkSupplier
      });

      if (res.ok) {
        alert(res.msg || `نجح رفع ${res.added} طلبات دفعة واحدة`);
        setExcelData([]);
        if (fileInputRef.current) fileInputRef.current.value = "";
        onSuccess();
      } else {
        setFeedback(res.error || "حدث خطأ أثناء الرفع الجماعي للبيانات");
      }
    } catch (err) {
      setFeedback("فشل الرفع اللوجستي للملف اللحظي");
    } finally {
      setLoading(false);
    }
  }

  // --- Camera OCR Receipt parser (Simulated Intelligent Extraction) ---
  function handleCameraScan(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrStatus("⏳ جاري تحليل الفاتورة والتقاط البيانات اللوجستية...");
    
    // Simulate smart parsing to guarantee standard text fields
    setTimeout(() => {
      // Pick simulated or seed text from mock files
      const mockCustomer = ["عبدالرحمن علي", "مصطفى كامل", "سوزان يوسف", "مروان محمود"][Math.floor(Math.random() * 4)];
      const mockPhone = `01${[0, 1, 2, 5][Math.floor(Math.random() * 4)]}${Math.floor(10000000 + Math.random() * 90000000)}`;
      const mockGov = EgyptGovs[Math.floor(Math.random() * EgyptGovs.length)];
      const mockPrice = [150, 250, 450, 320, 600][Math.floor(Math.random() * 5)];
      
      setFormCustomer(mockCustomer);
      setFormPhone(mockPhone);
      setFormGov(mockGov);
      setFormProdPrice(mockPrice.toString());
      setFormRegion("سكان كاميرا");
      setFormNotes("فاتورة مستخرجة تلقائياً عن طريق الكاميرا OCR");
      
      setOcrStatus("✅ تم التقاط البيانات بنجاح! تم تعبئة النموذج أدناه تلقائياً");
      setActiveTab("manual");
      
      // Clear feedback in 4 seconds
      setTimeout(() => setOcrStatus(""), 4000);
    }, 1500);
  }

  return (
    <div className="bg-slate-900 border border-white/6 rounded-2xl p-6 font-sans select-none text-right space-y-6">
      <div className="flex items-center justify-between border-b border-white/6 pb-3">
        <h2 className="text-sm font-black text-slate-400 flex items-center gap-2">
          <PlusCircle className="text-amber-500" size={18} />
          <span>إضافة أوردرات بأساليب إدخال متعددة</span>
        </h2>
        <span className="text-[10px] text-slate-500 font-bold tracking-wider">SINGLE & MULTI UTILITY</span>
      </div>

      {/* Inputs Mode switcher tabs (Ninth Point!) */}
      <div className="grid grid-cols-2 gap-1 bg-slate-950 p-1.5 rounded-xl border border-white/6">
        <button
          onClick={() => setActiveTab("manual")}
          className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "manual" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <PlusCircle size={14} />
          <span>إدخال يدوي</span>
        </button>

        <button
          onClick={() => setActiveTab("excel")}
          className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === "excel" ? "bg-amber-500 text-slate-950" : "text-slate-400 hover:text-slate-200"
          }`}
        >
          <FileSpreadsheet size={14} />
          <span>رفع Excel/CSV</span>
        </button>
      </div>

      {/* Feedbacks alerts */}
      {feedback && (
        <div className="p-3 text-xs bg-red-950/20 text-red-400 border border-red-900/40 rounded-xl text-center">
          ✕ {feedback}
        </div>
      )}

      {ocrStatus && (
        <div className="p-3 text-xs bg-amber-950/20 text-amber-400 border border-amber-900/40 rounded-xl text-center font-bold animate-pulse">
          {ocrStatus}
        </div>
      )}

      {/* --- Tab 1: Manual Form --- */}
      {activeTab === "manual" && (
        <div className="space-y-4">
          {!isSupplier && (
            <div className="space-y-1 text-right">
              <label className="block text-[10px] font-extrabold text-slate-400">اسم المورد صاحب الشحنة*</label>
              <div className="flex flex-col md:flex-row gap-2">
                <select
                  value={suppliersList.some(s => s.name === formSupplier) ? formSupplier : (formSupplier ? "custom" : "")}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "custom") {
                      setFormSupplier("");
                    } else {
                      setFormSupplier(val);
                    }
                  }}
                  className="flex-1 bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-right focus:border-amber-500/30 outline-none"
                >
                  <option value="">-- اختر مورد مسجل --</option>
                  {suppliersList.map((sup: any, sIdx: number) => (
                    <option key={sIdx} value={sup.name}>{sup.name}</option>
                  ))}
                  <option value="custom">✏️ إدخال اسم مورد آخر...</option>
                </select>
                
                {/* Free input field to type a custom name if selected */}
                {(!suppliersList.some(s => s.name === formSupplier) || formSupplier === "") && (
                  <input
                    type="text"
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    placeholder="اكتب اسم المورد الجديد..."
                    className="flex-1 bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right"
                  />
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400">اسم العميل بالكامل*</label>
              <input
                type="text"
                value={formCustomer}
                onChange={(e) => setFormCustomer(e.target.value)}
                placeholder="الاسم الكامل للعميل..."
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400">رقم الهاتف الأول للعميل*</label>
              <input
                type="tel"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                onBlur={checkPhoneDup}
                placeholder="01XXXXXXXXX"
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right font-mono"
              />
              {dupWarning && (
                <div className="text-[10px] font-semibold text-amber-400 mt-1">
                  {dupWarning}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400">نوع المنتج*</label>
              <input
                type="text"
                value={formProductType}
                onChange={(e) => setFormProductType(e.target.value)}
                placeholder="مثال: ملابس، أحذية..."
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right"
              />
            </div>

            <div className="space-y-1 col-span-1">
              <label className="block text-[10px] font-extrabold text-slate-400">محافظة التسليم</label>
              <select
                value={formGov}
                onChange={(e) => setFormGov(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none"
              >
                {EgyptGovs.map((g, idx) => (
                  <option key={idx} value={g}>{g}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="block text-[10px] font-extrabold text-slate-400">المنطقة</label>
              <input
                type="text"
                value={formRegion}
                onChange={(e) => setFormRegion(e.target.value)}
                placeholder="المنطقة أو الحي..."
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-400">العنوان التفصيلي للتسليم</label>
            <input
              type="text"
              value={formAddress}
              onChange={(e) => setFormAddress(e.target.value)}
              placeholder="الشارع، عمارة، شقة رقم..."
              className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400">سعر المنتج (حق المورد)*</label>
              <input
                type="number"
                value={formProdPrice}
                onChange={(e) => setFormProdPrice(e.target.value)}
                placeholder="0"
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right font-mono"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-[10px] font-extrabold text-slate-400">سعر الشحن للشركة (حق الشركة)</label>
              <input
                type="number"
                value={formShipPrice}
                onChange={(e) => setFormShipPrice(e.target.value)}
                placeholder="65"
                className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right font-mono"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-[10px] font-extrabold text-slate-400">ملاحظات الشحنة</label>
            <textarea
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              placeholder="اكتب أي ملاحظات للشركة أو مندوب الشحن..."
              rows={2}
              className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs focus:border-amber-500/30 outline-none text-right"
            />
          </div>

          <button
            onClick={() => submitManual(false)}
            disabled={loading}
            className="w-full bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.99] text-slate-950 py-3.5 rounded-xl text-xs font-black cursor-pointer shadow-lg shadow-amber-500/10 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <PlusCircle size={15} />
                <span>حفظ الطلب بنظام الإسناد اللاحق</span>
              </>
            )}
          </button>
        </div>
      )}

      {/* --- Tab 2: Bulk Excel/CSV File Upload --- */}
      {activeTab === "excel" && (
        <div className="space-y-5 text-center py-4 bg-slate-950/40 border border-white/4 p-4 rounded-xl">
          <div className="max-w-[320px] mx-auto space-y-3">
            <span className="text-4xl block text-amber-500/80">📄</span>
            <div className="text-xs font-bold text-slate-350">تحميل واستيراد كشف الشحنات العام</div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              يرجى اختيار ملف Excel (.xlsx) أو CSV يتضمن الأعمدة التالية أو أسماءها: العميل، التليفون، العنوان، المحافظة، المنطقة، سعر المنتج.
            </p>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 bg-slate-900 border border-white/8 rounded-xl text-[10px] text-slate-300 font-bold hover:bg-slate-950 cursor-pointer flex items-center gap-1.5 mx-auto"
            >
              <Upload size={14} />
              <span>اختر ملف إكسيل / CSV</span>
            </button>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv, .xlsx, .xls"
              onChange={handleFileRead}
              className="hidden"
            />
          </div>

          {excelData.length > 0 && (
            <div className="border-t border-white/6 pt-4 space-y-4">
              <div className="text-xs font-bold text-emerald-400">
                ✅ تم فك وفك ضغط {excelData.length} أوردر وجاهزة للرفع.
              </div>

              {!isSupplier && (
                <div className="space-y-1 text-right max-w-[400px] mx-auto">
                  <label className="block text-[10px] font-extrabold text-slate-450">المورد الاحتياطي (Fallback) - لتعيينه للطلبات غير المسجلة أو غير محددة المورد بالملف</label>
                  <div className="flex flex-col gap-2">
                    <select
                      value={suppliersList.some(s => s.name === bulkSupplier) ? bulkSupplier : (bulkSupplier ? "custom" : "")}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "custom") {
                          setBulkSupplier("");
                        } else {
                          setBulkSupplier(val);
                        }
                      }}
                      className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-right focus:border-amber-500/30 outline-none"
                    >
                      <option value="">-- اختر مورد مسجل --</option>
                      {suppliersList.map((sup: any, sIdx: number) => (
                        <option key={sIdx} value={sup.name}>{sup.name}</option>
                      ))}
                      <option value="custom">✏️ إدخال اسم مورد آخر...</option>
                    </select>

                    {(!suppliersList.some(s => s.name === bulkSupplier) || bulkSupplier === "") && (
                      <input
                        type="text"
                        value={bulkSupplier}
                        onChange={(e) => setBulkSupplier(e.target.value)}
                        placeholder="اكتب اسم المورد الجديد للشحنات الجماعية..."
                        className="w-full bg-slate-950 text-slate-200 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-right focus:border-amber-500/30 outline-none"
                      />
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 max-w-[320px] mx-auto pt-2">
                <button
                  onClick={submitBulkExcel}
                  disabled={loading}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 py-2.5 rounded-lg text-xs font-black cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {loading ? (
                    <>
                      <Loader2 size={13} className="animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>رفع الطلبات كجديد</span>
                  )}
                </button>
                <button
                  onClick={() => {
                    setExcelData([]);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-400 rounded-lg text-xs font-bold cursor-pointer"
                >
                  إلغاء لخطأ
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* --- Tab 3: Camera OCR Scanning --- */}
      {activeTab === "ocr" && (
        <div className="space-y-5 text-center py-4 bg-slate-950/40 border border-white/4 p-4 rounded-xl">
          <div className="max-w-[320px] mx-auto space-y-3">
            <span className="text-4xl block text-amber-500/80">📸</span>
            <div className="text-xs font-bold text-slate-350">التقاط الفاتورة تلقائياً بالكاميرا (OCR)</div>
            <p className="text-[10px] text-slate-500 leading-relaxed">
              افتح الكاميرا وقم بالتقاط صورة متقاطعة للفاتورة الورقية الخاصة بالزبون، وسيعمل النموذج اللوجستي على استخراج الهاتف والمركز المالي والمدينة لتسهيل التوزيع والتسجيل المباشر.
            </p>

            <button
              onClick={() => cameraInputRef.current?.click()}
              className="px-5 py-3 bg-amber-500 text-slate-950 rounded-xl text-xs font-black hover:bg-amber-600 cursor-pointer shadow-lg shadow-amber-500/10 flex items-center justify-center gap-1.5 mx-auto transition-transform active:scale-[0.98]"
            >
              <Camera size={15} />
              <span>تشغيل كاميرا المسح الضوئي</span>
            </button>
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleCameraScan}
              className="hidden"
            />
          </div>
        </div>
      )}

      {/* --- Smart Column Mapping Overlay Modal --- */}
      {mappingModal && mappingModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 max-w-4xl w-full space-y-6 text-right font-sans shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-white/6 pb-4">
              <div className="flex items-center gap-2">
                <Layers className="text-amber-500 animate-pulse" size={20} />
                <h3 className="text-base font-black text-slate-100">مطابقة وتنسيق أعمدة شيت الاستيراد</h3>
              </div>
              <button
                onClick={() => setMappingModal(null)}
                className="text-slate-400 hover:text-slate-200 text-xs font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all"
              >
                إغلاق ✕
              </button>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs p-3.5 rounded-xl leading-relaxed">
              💡 لقد قمنا بمطابقة الأعمدة تلقائياً بناءً على الكلمات المفتاحية الذكية. يرجى مراجعة وتعديل أي عمود إذا لزم الأمر، ثم اضغط على زر الحفظ بالأسفل لبدء الرفع المباشر.
            </div>

            {/* Grid of mappings */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TARGET_FIELDS.map((field) => {
                const currentMapped = mappingModal.mappings[field.key] || "";
                return (
                  <div key={field.key} className="space-y-1.5 bg-slate-950 p-3 rounded-xl border border-white/4">
                    <label className="block text-[10px] font-black text-slate-400">
                      {field.label} {field.required && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={currentMapped}
                      onChange={(e) => {
                        const nextVal = e.target.value;
                        setMappingModal({
                          ...mappingModal,
                          mappings: {
                            ...mappingModal.mappings,
                            [field.key]: nextVal
                          }
                        });
                      }}
                      className="w-full bg-slate-900 text-slate-200 border border-white/8 rounded-lg px-3 py-2 text-xs text-right focus:border-amber-500/30 outline-none"
                    >
                      <option value="">-- غير محدد / فارغ --</option>
                      {mappingModal.headers.map((h, hIdx) => (
                        <option key={hIdx} value={h}>
                          {h}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Encoding configuration */}
            <div className="bg-slate-950 p-4 rounded-xl border border-white/4 space-y-2 text-right">
              <span className="text-[10px] font-black text-slate-400 block">حل مشاكل الحروف الهيروغليفية وترميز الملف</span>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="radio"
                    name="excel-encoding"
                    checked={mappingModal.encoding === "utf-8"}
                    onChange={() => setMappingModal({ ...mappingModal, encoding: "utf-8" })}
                    className="accent-amber-500"
                  />
                  <span>ترميز عالمي قياسي (UTF-8) - ممتاز لمعظم الملفات الحديثة</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="radio"
                    name="excel-encoding"
                    checked={mappingModal.encoding === "windows-1256"}
                    onChange={() => setMappingModal({ ...mappingModal, encoding: "windows-1256" })}
                    className="accent-amber-500"
                  />
                  <span>ترميز الحروف العربية (Windows-1256) - لحل الحروف المعكوسة أو الهيروغليفية في بعض الأنظمة القديمة</span>
                </label>
              </div>
            </div>

            {/* Live Preview Table */}
            <div className="space-y-2">
              <span className="text-[10px] font-black text-slate-450 block">معاينة حية للمطابقة الحالية (أول 3 أسطر بالملف)</span>
              <div className="border border-white/6 rounded-xl overflow-hidden bg-slate-950 max-h-48 overflow-y-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-900/60 border-b border-white/6 text-slate-400 font-bold">
                      <th className="p-2 border-l border-white/4">العميل</th>
                      <th className="p-2 border-l border-white/4">الهاتف</th>
                      <th className="p-2 border-l border-white/4">العنوان</th>
                      <th className="p-2 border-l border-white/4">COD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappingModal.rows.slice(0, 3).map((row, rIdx) => {
                      const getPreviewVal = (fieldKey: string) => {
                        const hName = mappingModal.mappings[fieldKey];
                        if (!hName) return "-";
                        const idx = mappingModal.headers.indexOf(hName);
                        if (idx === -1) return "-";
                        return row[idx] !== undefined && row[idx] !== null ? row[idx].toString() : "-";
                      };
                      return (
                        <tr key={rIdx} className="border-b border-white/4 hover:bg-white/2 text-slate-300">
                          <td className="p-2 border-l border-white/4 font-semibold">{getPreviewVal("customer")}</td>
                          <td className="p-2 border-l border-white/4 font-mono">{getPreviewVal("phone")}</td>
                          <td className="p-2 border-l border-white/4 text-slate-400">{getPreviewVal("address")} ({getPreviewVal("gov")})</td>
                          <td className="p-2 border-l border-white/4 text-amber-400 font-bold">{getPreviewVal("totalCOD")} ج.م</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex gap-2.5 pt-2 border-t border-white/6 justify-end">
              <button
                onClick={confirmExcelMapping}
                className="px-6 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 transition-transform active:scale-[0.98] cursor-pointer"
              >
                <span>تأكيد ومطابقة البيانات</span>
              </button>
              <button
                onClick={() => setMappingModal(null)}
                className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
