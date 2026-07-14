import React, { useState, useEffect, useMemo, useCallback } from "react";
import { apiCall } from "../utils";

interface StaffMember {
  name: string;
  phone: string;
  role: string;
  salary: number | null;
  perm_dashboard: boolean | string;
  perm_orders: boolean | string;
  perm_ledger: boolean | string;
  perm_expenses: boolean | string;
  perm_staff: boolean | string;
  supervisor_id: string;
}

interface StaffPermissionsProps {
  token: string;
  role: string;
  username: string;
  onRefreshAll: () => void;
}

export const StaffPermissions: React.FC<StaffPermissionsProps> = React.memo(({
  token,
  role,
  username,
  onRefreshAll
}) => {
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Edit / Add Form State
  const [isEditing, setIsEditing] = useState(false);
  const [formName, setFormName] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("مندوب");
  const [formSalary, setFormSalary] = useState<number | "">("");
  const [formPass, setFormPass] = useState("");
  const [formSupervisorId, setFormSupervisorId] = useState("");
  const [permDashboard, setPermDashboard] = useState(false);
  const [permOrders, setPermOrders] = useState(false);
  const [permLedger, setPermLedger] = useState(false);
  const [permExpenses, setPermExpenses] = useState(false);
  const [permStaff, setPermStaff] = useState(false);

  const isAdmin = useMemo(() => role === "مدير", [role]);

  // Load from LocalStorage Cache first for instant load
  useEffect(() => {
    const cached = localStorage.getItem("fp_staff_permissions_cache");
    if (cached) {
      try {
        setStaffList(JSON.parse(cached));
      } catch (e) {
        console.error("Error reading staff permissions cache", e);
      }
    }
    fetchStaff();
  }, [token]);

  const fetchStaff = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiCall("getStaffPermissions", token, {
        currentRole: role,
        currentUser: username
      });
      if (res && res.ok && Array.isArray(res.staff)) {
        const normalized: StaffMember[] = res.staff.map((item: any) => ({
          name: item.name || "",
          phone: item.phone || "",
          role: item.role || "مندوب",
          salary: item.salary !== undefined ? (item.salary === "" || item.salary === null ? null : Number(item.salary)) : null,
          perm_dashboard: item.perm_dashboard === "true" || item.perm_dashboard === true,
          perm_orders: item.perm_orders === "true" || item.perm_orders === true,
          perm_ledger: item.perm_ledger === "true" || item.perm_ledger === true,
          perm_expenses: item.perm_expenses === "true" || item.perm_expenses === true,
          perm_staff: item.perm_staff === "true" || item.perm_staff === true,
          supervisor_id: item.supervisor_id || ""
        }));
        setStaffList(normalized);
        localStorage.setItem("fp_staff_permissions_cache", JSON.stringify(normalized));
      } else {
        setError(res?.error || "فشل تحميل قائمة الصلاحيات");
      }
    } catch (err: any) {
      setError("خطأ في الاتصال بالسيرفر: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Memoize potential supervisors list (users whose role is "مشرف" or "مدير")
  const potentialSupervisors = useMemo(() => {
    return staffList.filter(s => s.role === "مشرف" || s.role === "مدير");
  }, [staffList]);

  // Open edit modal for existing employee
  const handleEdit = useCallback((member: StaffMember) => {
    if (!isAdmin) return;
    setFormName(member.name);
    setFormPhone(member.phone);
    setFormRole(member.role);
    setFormSalary(member.salary || "");
    setFormPass(""); // blank for existing unless editing
    setFormSupervisorId(member.supervisor_id);
    setPermDashboard(!!member.perm_dashboard);
    setPermOrders(!!member.perm_orders);
    setPermLedger(!!member.perm_ledger);
    setPermExpenses(!!member.perm_expenses);
    setPermStaff(!!member.perm_staff);
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [isAdmin]);

  const handleAddNew = useCallback(() => {
    setFormName("");
    setFormPhone("");
    setFormRole("مندوب");
    setFormSalary("");
    setFormPass("123456");
    setFormSupervisorId("");
    setPermDashboard(false);
    setPermOrders(true);
    setPermLedger(false);
    setPermExpenses(false);
    setPermStaff(false);
    setIsEditing(true);
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!formName.trim()) {
      setError("الاسم مطلوب");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");

    const staffPayload = {
      name: formName.trim(),
      phone: formPhone.trim(),
      role: formRole,
      salary: formSalary === "" ? null : Number(formSalary),
      perm_dashboard: permDashboard ? "true" : "false",
      perm_orders: permOrders ? "true" : "false",
      perm_ledger: permLedger ? "true" : "false",
      perm_expenses: permExpenses ? "true" : "false",
      perm_staff: permStaff ? "true" : "false",
      supervisor_id: formSupervisorId
    };

    try {
      const res = await apiCall("saveStaffPermissions", token, {
        staff: staffPayload,
        pass: formPass.trim() || undefined
      });
      if (res && res.ok) {
        setSuccess(res.msg || "تم حفظ التعديلات بنجاح");
        setIsEditing(false);
        fetchStaff();
        onRefreshAll();
      } else {
        setError(res?.error || "فشل حفظ التعديلات");
      }
    } catch (err: any) {
      setError("خطأ أثناء الحفظ: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Group staff tree-like
  // Roots are Supervisors or Admins, children are employees assigned to them
  const staffTree = useMemo(() => {
    const supervisorsMap: Record<string, StaffMember[]> = {};
    const standalone: StaffMember[] = [];

    // Initialize map
    staffList.forEach(s => {
      if (s.role === "مشرف" || s.role === "مدير") {
        supervisorsMap[s.name] = [];
      }
    });

    staffList.forEach(s => {
      const sup = s.supervisor_id ? s.supervisor_id.trim() : "";
      if (sup && supervisorsMap[sup] !== undefined) {
        supervisorsMap[sup].push(s);
      } else {
        standalone.push(s);
      }
    });

    return { supervisorsMap, standalone };
  }, [staffList]);

  return (
    <div className="p-4 space-y-6 text-right font-sans" dir="rtl">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-slate-900 border border-white/6 p-5 rounded-2xl gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-100 flex items-center gap-2">
            <span>🛡️</span> Odoo-Style RBAC & الهيكل الوظيفي الشجري
          </h2>
          <p className="text-[11px] text-slate-400 mt-1.5 leading-relaxed">
            توزيع صلاحيات الموظفين، تحديد المشرف المباشر وتعيين هيكل إدارة المناديب التابعين للشركة بصورة شجرية محصنة ماليًا.
          </p>
        </div>
        {isAdmin && !isEditing && (
          <button
            onClick={handleAddNew}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl cursor-pointer transition-all self-start md:self-auto shadow-lg shadow-amber-500/10"
          >
            + إضافة موظف جديد
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-950/20 border border-red-900/30 p-3.5 rounded-xl text-xs font-bold text-red-400">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="bg-emerald-950/20 border border-emerald-900/30 p-3.5 rounded-xl text-xs font-bold text-emerald-400">
          ✨ {success}
        </div>
      )}

      {/* Editor Panel (Admin only) */}
      {isEditing && isAdmin && (
        <form onSubmit={handleSave} className="bg-slate-900 border border-white/6 rounded-2xl p-6 space-y-5 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-white/6 pb-3">
            <h3 className="text-xs font-black text-amber-500">
              ⚙️ تعديل بيانات وصلاحيات: {formName || "موظف جديد"}
            </h3>
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="text-slate-400 hover:text-slate-200 text-xs font-bold cursor-pointer"
            >
              إلغاء
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1.5">اسم الموظف الكامل (مطابق لاسم تسجيل الدخول)</label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                className="w-full bg-slate-950 border border-white/6 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500"
                placeholder="مثال: محمد حمدى"
                required
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1.5">رقم الهاتف</label>
              <input
                type="text"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                className="w-full bg-slate-950 border border-white/6 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono text-left"
                placeholder="01xxxxxxxxx"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1.5">الدور الوظيفي (Role)</label>
              <select
                value={formRole}
                onChange={(e) => setFormRole(e.target.value)}
                className="w-full bg-slate-950 border border-white/6 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="مدير">مدير (Admin)</option>
                <option value="مشرف">مشرف (Supervisor)</option>
                <option value="محاسب">محاسب (Accountant)</option>
                <option value="مسؤول مرتجعات">مسؤول مرتجعات (Returns Officer)</option>
                <option value="موظف عمليات">موظف عمليات (Ops Officer)</option>
                <option value="مورد">مورد (Vendor)</option>
                <option value="مندوب">مندوب (Courier / Driver)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1.5">الراتب الأساسي الشهري (محمي ومخفي ماليًا)</label>
              <input
                type="number"
                value={formSalary}
                onChange={(e) => setFormSalary(e.target.value === "" ? "" : Number(e.target.value))}
                className="w-full bg-slate-950 border border-white/6 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                placeholder="3000"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1.5">كلمة المرور للحساب (Pass)</label>
              <input
                type="password"
                value={formPass}
                onChange={(e) => setFormPass(e.target.value)}
                className="w-full bg-slate-950 border border-white/6 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 font-mono"
                placeholder="اتركها فارغة للموظفين الحاليين لمنع التغيير"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-400 mb-1.5">المشرف المباشر (Direct Supervisor)</label>
              <select
                value={formSupervisorId}
                onChange={(e) => setFormSupervisorId(e.target.value)}
                className="w-full bg-slate-950 border border-white/6 rounded-xl p-2.5 text-xs text-slate-100 focus:outline-none focus:border-amber-500 cursor-pointer"
              >
                <option value="">بدون مشرف مباشر (إدارة عليا)</option>
                {potentialSupervisors.map(s => (
                  <option key={s.name} value={s.name}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-950 border border-white/4 rounded-xl p-4">
            <h4 className="text-[10px] font-black text-slate-400 mb-3">🛡️ الصلاحيات الوظيفية الدقيقة (RBAC Settings)</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permDashboard}
                  onChange={(e) => setPermDashboard(e.target.checked)}
                  className="rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                لوحة القيادة
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permOrders}
                  onChange={(e) => setPermOrders(e.target.checked)}
                  className="rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                إدارة الطلبات
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permLedger}
                  onChange={(e) => setPermLedger(e.target.checked)}
                  className="rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                كشوف الحسابات
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permExpenses}
                  onChange={(e) => setPermExpenses(e.target.checked)}
                  className="rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                الخزنة والمصاريف
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={permStaff}
                  onChange={(e) => setPermStaff(e.target.checked)}
                  className="rounded border-white/10 bg-slate-900 text-amber-500 focus:ring-0 focus:ring-offset-0 w-4 h-4 cursor-pointer"
                />
                إدارة الموظفين
              </label>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl cursor-pointer"
            >
              إلغاء التعديل
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs rounded-xl cursor-pointer"
            >
              {loading ? "جاري الحفظ..." : "حفظ بيانات الموظف"}
            </button>
          </div>
        </form>
      )}

      {/* Tree & Staff Layout */}
      <div className="space-y-4">
        <h3 className="text-xs font-black text-slate-400">🌲 الهيكل الإداري للمؤسسة والتبعية المباشرة</h3>

        {loading && staffList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 animate-pulse">جاري سحب الهيكل الوظيفي المباشر...</div>
        ) : staffList.length === 0 ? (
          <div className="text-center py-8 text-xs text-slate-500 bg-slate-900/40 border border-white/4 rounded-2xl">
            لا يوجد موظفون مسجلون حالياً أو جاري تهيئة الهيكل الأساسي.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Tree column (2/3 width) */}
            <div className="lg:col-span-2 bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="text-xs font-black text-slate-300 border-b border-white/4 pb-2">الهيكل الشجري للمشرفين والمناديب المباشرين:</div>
              
              {/* Supervisors Trees */}
              {Object.keys(staffTree.supervisorsMap).map(supName => {
                const supervisor = staffList.find(s => s.name === supName);
                const children = staffTree.supervisorsMap[supName] || [];
                return (
                  <div key={supName} className="border border-white/4 rounded-xl p-3.5 bg-slate-950/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">👑</span>
                        <div>
                          <div className="text-xs font-bold text-slate-100">{supName}</div>
                          <div className="text-[9px] text-amber-500 font-bold mt-0.5">مشرف مباشر ({children.length} مناديب تحت مظلته)</div>
                        </div>
                      </div>
                      {isAdmin && supervisor && (
                        <button
                          onClick={() => handleEdit(supervisor)}
                          className="p-1 px-2 text-[9px] font-black bg-slate-900 text-slate-300 rounded hover:text-white border border-white/6 cursor-pointer"
                        >
                          تعديل الصلاحيات ⚙️
                        </button>
                      )}
                    </div>

                    {/* Subordinated staff nested list */}
                    {children.length > 0 ? (
                      <div className="mr-5 pr-3 border-r-2 border-amber-500/30 space-y-2 mt-2">
                        {children.map(child => (
                          <div key={child.name} className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-white/4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">🛵</span>
                              <div>
                                <div className="text-xs font-semibold text-slate-200">{child.name}</div>
                                <div className="text-[9px] text-slate-400 mt-0.5">مندوب توصيل نشط · هاتف: {child.phone || "—"}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              {isAdmin && child.salary !== null && (
                                <span className="text-[10px] text-emerald-400 font-mono font-bold">الراتب: {child.salary} ج.م</span>
                              )}
                              {isAdmin && (
                                <button
                                  onClick={() => handleEdit(child)}
                                  className="p-1 px-2 text-[9px] font-bold bg-slate-950 text-slate-400 rounded hover:text-white border border-white/8 cursor-pointer"
                                >
                                  تعديل
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mr-5 text-[10px] text-slate-500 italic py-1">لا يوجد مناديب مرتبطين بهذا المشرف حالياً.</div>
                    )}
                  </div>
                );
              })}

              {/* Standalone Employees (Admins or others without explicit supervisors) */}
              {staffTree.standalone.filter(s => s.role !== "مشرف").length > 0 && (
                <div className="border border-white/4 rounded-xl p-3.5 bg-slate-950/40 space-y-2">
                  <div className="text-xs font-black text-slate-300 border-b border-white/4 pb-2">موظفون مباشرون (الإدارة العليا والعمليات):</div>
                  <div className="space-y-2 pt-1">
                    {staffTree.standalone.filter(s => s.role !== "مشرف").map(child => (
                      <div key={child.name} className="flex items-center justify-between bg-slate-900/50 p-2.5 rounded-lg border border-white/4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">👤</span>
                          <div>
                            <div className="text-xs font-semibold text-slate-200">{child.name}</div>
                            <div className="text-[9px] text-slate-400 mt-0.5">الدور: {child.role} · هاتف: {child.phone || "—"}</div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {isAdmin && child.salary !== null && (
                            <span className="text-[10px] text-emerald-400 font-mono font-bold">الراتب: {child.salary} ج.م</span>
                          )}
                          {isAdmin && (
                            <button
                              onClick={() => handleEdit(child)}
                              className="p-1 px-2 text-[9px] font-bold bg-slate-950 text-slate-400 rounded hover:text-white border border-white/8 cursor-pointer"
                            >
                              تعديل
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Quick visual role summary cards */}
            <div className="bg-slate-900 border border-white/6 rounded-2xl p-5 space-y-4">
              <div className="text-xs font-black text-slate-300 border-b border-white/4 pb-2">📊 إحصائيات وبطاقات الصلاحيات</div>
              
              <div className="space-y-3">
                <div className="bg-slate-950 p-3 rounded-xl border border-white/4 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">إجمالي طاقم العمل</span>
                  <span className="text-xs text-amber-500 font-black font-mono">{staffList.length}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-white/4 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">المشرفون النشطون</span>
                  <span className="text-xs text-amber-500 font-black font-mono">{staffList.filter(s => s.role === "مشرف").length}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-xl border border-white/4 flex items-center justify-between">
                  <span className="text-xs text-slate-400 font-bold">مناديب التوصيل</span>
                  <span className="text-xs text-amber-500 font-black font-mono">{staffList.filter(s => s.role === "مندوب").length}</span>
                </div>
              </div>

              <div className="bg-amber-950/10 border border-amber-900/30 p-3.5 rounded-xl text-[10px] text-amber-400/90 leading-relaxed font-semibold">
                🔔 <span className="font-bold">ملاحظة أمان:</span> نظام حماية الرواتب مفعل دائمًا تلقائيًا. لا تظهر معلومات الرواتب الأساسية أو العلاوات الاستثنائية إلا للمدير العام فقط، مع حجب كامل لبيانات الرواتب عند تسجيل دخول المشرفين أو المناديب حمايةً للمعلومات المالية للشركة.
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
});

StaffPermissions.displayName = "StaffPermissions";
