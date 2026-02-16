import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error("Uncaught error:", error, errorInfo);
    }

    private handleReset = () => {
        localStorage.clear();
        sessionStorage.clear();
        window.location.reload();
    };

    public render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-[#0a192f] p-4 text-center font-sans" dir="rtl">
                    <div className="bg-white rounded-[2.5rem] p-10 max-w-lg w-full shadow-2xl animate-in zoom-in duration-300">
                        <div className="text-6xl mb-6">🤕</div>
                        <h1 className="text-3xl font-black text-[#0a192f] mb-4">عذراً، حدث خطأ غير متوقع</h1>
                        <p className="text-gray-500 font-bold mb-8 text-lg">
                            يبدو أن هناك مشكلة في تحميل البيانات المحفوظة.
                        </p>

                        <div className="bg-red-50 p-4 rounded-xl border border-red-100 mb-8 text-right">
                            <p className="text-red-500 font-bold text-sm mb-2">تفاصيل الخطأ (للمطورين):</p>
                            <code className="block bg-white p-3 rounded-lg text-xs font-mono text-red-600 overflow-auto max-h-32 border border-red-200">
                                {this.state.error?.toString()}
                            </code>
                        </div>

                        <button
                            onClick={this.handleReset}
                            className="w-full bg-[#10b981] text-white py-5 rounded-2xl font-black text-xl hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                        >
                            إعادة ضبط التطبيق (Reset App) 🔄
                        </button>
                        <p className="mt-4 text-xs text-gray-400 font-bold">
                            * سيقوم هذا الزر بمسح البيانات المؤقتة وإعادة تحميل الموقع
                        </p>
                    </div>
                </div>
            );
        }

        // @ts-ignore
        return this.props.children;
    }
}
