import React, { useState } from "react";
import { LogIn, Key, Loader2, UserCheck } from "lucide-react";
import { apiCall } from "../utils";

interface LoginProps {
  onLoginSuccess: (name: string, role: string, token: string, perms: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setErrorStatus("✕ يرجى إدخال اسم المستخدم وكلمة المرور");
      return;
    }

    setLoading(true);
    setErrorStatus("");
    
    try {
      const res = await apiCall("login", "", { name: username.trim(), pass: password.trim() });
      if (res.ok) {
        onLoginSuccess(res.user, res.role, res.token, res.perms || "");
      } else {
        setErrorStatus(`✕ ${res.error || "اسم المستخدم أو كلمة المرور غير صحيحة"}`);
      }
    } catch (err) {
      setErrorStatus("✕ حدث خطأ في الشبكة، يرجى إعادة المحاولة");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[#040914] relative overflow-hidden font-sans select-none">
      {/* Background Decorative Radial Glows */}
      <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[160%] max-w-[800px] h-[400px] rounded-full bg-radial from-[rgba(245,158,11,0.08)] to-transparent pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[300px] h-[300px] rounded-full bg-radial from-[rgba(59,130,246,0.03)] to-transparent pointer-events-none" />

      {/* Brand Identity */}
      <div className="text-center mb-8 relative z-10 transition-transform hover:scale-102 duration-300">
        <span className="text-6xl filter drop-shadow-[0_0_15px_rgba(245,158,11,0.4)] animate-pulse block mb-3">
          🚚
        </span>
        <h1 className="text-4xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-100">
          فريند بلس
        </h1>
        <div className="text-[10px] text-slate-500 font-bold tracking-widest uppercase mt-2">
          LOGISTICS MANAGEMENT SYSTEM · v5.1
        </div>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-[380px] bg-slate-900/80 backdrop-blur-md rounded-2xl border border-white/8 p-8 shadow-2xl relative z-10">
        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-[11px] font-black text-slate-400 tracking-wider uppercase text-right">
              اسم المستخدم
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                <UserCheck size={18} />
              </span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="أدخل اسمك هنا..."
                className="w-full bg-slate-950 border border-white/8 rounded-xl pr-11 pl-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/40 transition-colors text-right"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[11px] font-black text-slate-400 tracking-wider uppercase text-right">
              كلمة المرور
            </label>
            <div className="relative">
              <span className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none text-slate-500">
                <Key size={18} />
              </span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-white/8 rounded-xl pr-11 pl-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/40 transition-colors text-right"
              />
            </div>
          </div>

          {errorStatus && (
            <div className="text-xs text-red-400 font-bold text-center bg-red-950/20 border border-red-900/30 py-2.5 px-3 rounded-lg">
              {errorStatus}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full relative overflow-hidden bg-gradient-to-r from-amber-500 via-amber-600 to-yellow-600 hover:brightness-110 active:scale-[0.98] text-slate-950 font-black text-sm py-4 rounded-xl shadow-lg shadow-amber-900/20 flex items-center justify-center gap-2 cursor-pointer transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>جاري التحقق...</span>
              </>
            ) : (
              <>
                <span>تسجيل الدخول</span>
                <LogIn size={18} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Quick Access Helper */}
      <div className="mt-8 text-center text-xs text-slate-500 max-w-[320px] leading-relaxed">
        سجل دخول بأي اسم تجاري (مثل <span className="text-slate-400 font-bold">ahmed</span> أو <span className="text-slate-400 font-bold">عصفور</span>) للتمتع بكافة صلاحيات المدير بالمعاينة.
      </div>
    </div>
  );
}
