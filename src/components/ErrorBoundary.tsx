import React, { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<Props, State> {
  props!: Props;
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React Error caught in ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    localStorage.removeItem("fp_token");
    localStorage.removeItem("fp_user");
    localStorage.removeItem("fp_role");
    localStorage.removeItem("fp_perms");
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#050b14] text-[#e2e8f0] flex flex-col items-center justify-center p-6 text-right" dir="rtl">
          <div className="w-full max-w-md bg-slate-900 border border-red-500/20 rounded-2xl p-6 space-y-5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-2 left-2 text-red-500/10">
              <AlertTriangle size={80} />
            </div>
            
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h2 className="text-base font-black text-red-400">حدث خطأ غير متوقع في النظام</h2>
                <p className="text-[10px] text-slate-400 mt-0.5">حصلت مشكلة أثناء عرض واجهة التطبيق</p>
              </div>
            </div>

            <div className="bg-slate-950/80 border border-white/5 rounded-xl p-4 space-y-1.5 font-mono text-left" dir="ltr">
              <div className="text-[11px] text-red-300 font-bold overflow-x-auto whitespace-pre-wrap">
                {this.state.error?.name}: {this.state.error?.message}
              </div>
              <p className="text-[9px] text-slate-500 font-medium">Please verify your GOOGLE_SCRIPT_URL or sheet credentials.</p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 py-3 bg-amber-500 active:scale-95 text-slate-950 font-black text-xs rounded-xl flex items-center justify-center gap-1.5 cursor-pointer shadow-md transition-all"
              >
                <RefreshCw size={13} />
                <span>إعادة تحميل التطبيق</span>
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-3 bg-slate-950 text-slate-400 hover:text-slate-200 text-xs font-bold border border-white/5 rounded-xl cursor-pointer transition-all"
              >
                تسجيل الخروج والبدء من جديد
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
