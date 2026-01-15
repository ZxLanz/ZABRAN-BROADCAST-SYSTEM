import { X, AlertTriangle, Trash2 } from "lucide-react";

export default function DeleteConfirm({
  open,
  onClose,
  onConfirm,
  title = "Permanent Deletion",
  message = "Are you sure you want to delete this record? This action cannot be reversed.",
  isLoading = false
}) {
  if (!open) return null;

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
        <div className="bg-red-600 px-6 py-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 -rotate-45 translate-x-10 -translate-y-10 rounded-full blur-2xl"></div>
          <div className="relative z-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-3 border border-white/20 shadow-sm">
              <Trash2 className="w-7 h-7 text-white" />
            </div>
            <h3 className="text-lg font-bold text-white tracking-tight">{title}</h3>
            <p className="text-red-100/70 text-[10px] font-bold mt-0.5 uppercase tracking-widest">Action Required</p>
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
            className="w-full py-3 rounded-xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition-all shadow-md shadow-red-600/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <>
                <Trash2 className="w-4 h-4" />
                Confirm Delete
              </>
            )}
          </button>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full py-3 rounded-xl bg-gray-50 text-gray-500 font-bold text-sm hover:bg-gray-100 transition-all active:scale-[0.98]"
          >
            Keep Record
          </button>
        </div>
      </div>
    </div>
  );
}
