import { X, AlertTriangle, CheckCircle, HelpCircle } from "lucide-react";

export default function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title = "Confirm Action",
    message = "Are you sure you want to proceed?",
    confirmText = "Confirm",
    cancelText = "Cancel",
    isLoading = false,
    type = "danger" // danger, info, warning
}) {
    if (!open) return null;

    // Configuration based on type
    const config = {
        danger: {
            bg: "bg-red-600",
            icon: <AlertTriangle className="w-7 h-7 text-white" />,
            lightText: "text-red-100/70",
            buttonBg: "bg-red-600 hover:bg-red-700 shadow-red-600/10",
            buttonIcon: null
        },
        warning: {
            bg: "bg-orange-500",
            icon: <AlertTriangle className="w-7 h-7 text-white" />,
            lightText: "text-orange-100/70",
            buttonBg: "bg-orange-500 hover:bg-orange-600 shadow-orange-500/10",
            buttonIcon: null
        },
        info: {
            bg: "bg-blue-600",
            icon: <HelpCircle className="w-7 h-7 text-white" />,
            lightText: "text-blue-100/70",
            buttonBg: "bg-blue-600 hover:bg-blue-700 shadow-blue-600/10",
            buttonIcon: null
        },
        success: {
            bg: "bg-green-600",
            icon: <CheckCircle className="w-7 h-7 text-white" />,
            lightText: "text-green-100/70",
            buttonBg: "bg-green-600 hover:bg-green-700 shadow-green-600/10",
            buttonIcon: null
        }
    };

    const activeConfig = config[type] || config.danger;

    return (
        <div
            className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20"
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className={`${activeConfig.bg} px-6 py-6 relative overflow-hidden transition-colors`}>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -rotate-45 translate-x-10 -translate-y-10 rounded-full blur-2xl"></div>
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/20 shadow-sm">
                            {activeConfig.icon}
                        </div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
                        <p className={`${activeConfig.lightText} text-[10px] font-bold mt-0.5 uppercase tracking-widest`}>Confirmation</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-all"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 text-center">
                    <p className="text-navy-900 font-medium text-sm leading-relaxed">{message}</p>
                </div>

                {/* Footer */}
                <div className="p-6 pt-0 flex flex-col gap-2">
                    <button
                        onClick={onConfirm}
                        disabled={isLoading}
                        className={`w-full py-3 rounded-xl ${activeConfig.buttonBg} text-white font-bold text-sm transition-all shadow-md active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2`}
                    >
                        {isLoading ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            <>
                                {confirmText}
                            </>
                        )}
                    </button>
                    <button
                        onClick={onClose}
                        disabled={isLoading}
                        className="w-full py-3 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm hover:bg-gray-100 transition-all active:scale-[0.98]"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
}
