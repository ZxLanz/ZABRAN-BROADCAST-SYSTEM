// src/components/DeleteConfirm.jsx
import { X, AlertTriangle } from "lucide-react";

/**
 * Komponen modal konfirmasi penghapusan yang dapat digunakan kembali.
 * @param {object} props
 * @param {boolean} props.open - Status modal (buka/tutup)
 * @param {function} props.onClose - Fungsi yang dipanggil saat modal ditutup
 * @param {function} props.onConfirm - Fungsi yang dipanggil saat tombol konfirmasi ditekan
 * @param {string} [props.title="Confirm Deletion"] - Judul modal
 * @param {string} [props.message="Are you sure you want to delete this item? This action cannot be undone."] - Pesan konfirmasi
 * @param {boolean} [props.isLoading=false] - Status loading untuk tombol konfirmasi
 */
export default function DeleteConfirm({ 
  open, 
  onClose, 
  onConfirm, 
  title = "Confirm Deletion", 
  message = "Are you sure you want to delete this item? This action cannot be undone.",
  isLoading = false
}) {
  if (!open) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 transition-opacity duration-300"
      onClick={onClose}
    >
      <div 
        className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in"
        onClick={(e) => e.stopPropagation()} // Prevent closing on modal body click
      >
        
        {/* Modal Header */}
        <div className="bg-red-50 p-6 flex items-start justify-between border-b border-red-200">
            <div className="flex items-center gap-3">
                <AlertTriangle className="w-6 h-6 text-red-600" />
                <h3 className="text-xl font-bold text-red-700">{title}</h3>
            </div>
            <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-red-100 hover:text-red-600 transition-colors">
              <X className="w-5 h-5" />
            </button>
        </div>

        {/* Modal Body */}
        <div className="p-6">
          <p className="text-gray-700">{message}</p>
        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 p-4 flex justify-end gap-3 border-t border-gray-200">
          <button 
            onClick={onClose} 
            className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button 
            onClick={onConfirm} 
            className="px-5 py-2 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={isLoading}
          >
            {isLoading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}