import { X, User, Phone, Mail, Tag, Calendar, MessageCircle, Edit, Trash2, Clock, CheckCircle2, AlertCircle, ShieldAlert } from 'lucide-react';

export default function ViewCustomerModal({ isOpen, onClose, customer, onEdit, onDelete }) {
  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleEdit = () => {
    onClose();
    onEdit(customer);
  };

  const handleDelete = () => {
    onClose();
    onDelete(customer);
  };

  if (!isOpen || !customer) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Never';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusConfig = (status) => {
    const configs = {
      active: {
        bg: 'bg-green-500/10',
        text: 'text-green-600',
        border: 'border-green-500/20',
        icon: CheckCircle2,
        label: 'Active'
      },
      inactive: {
        bg: 'bg-yellow-500/10',
        text: 'text-yellow-600',
        border: 'border-yellow-500/20',
        icon: AlertCircle,
        label: 'Inactive'
      },
      blocked: {
        bg: 'bg-red-500/10',
        text: 'text-red-600',
        border: 'border-red-500/20',
        icon: ShieldAlert,
        label: 'Blocked'
      }
    };
    return configs[status] || configs.active;
  };

  const statusConfig = getStatusConfig(customer.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div
      className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20 max-h-[90vh] flex flex-col">

        {/* Modal Header */}
        <div className="bg-navy-900 px-8 py-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>

          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shadow-inner border border-white/10 text-primary-400 font-bold text-xl">
                {customer.name ? customer.name[0].toUpperCase() : <User />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white leading-tight">
                  Customer Profile
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded">ID</span>
                  <span className="text-xs text-gray-400 font-medium font-mono">
                    {customer._id ? customer._id.slice(-12) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-all text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Modal Content */}
        <div className="p-8 overflow-y-auto custom-scrollbar flex-1">

          {/* Profile Basic Info */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 pb-8 border-b border-gray-100">
            <div className="space-y-3">
              <h3 className="text-3xl font-bold text-navy-900 tracking-tight">
                {customer.name}
              </h3>
              <div className="flex flex-wrap gap-2">
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-[11px] uppercase tracking-wider ${statusConfig.bg} ${statusConfig.text} ${statusConfig.border}`}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {statusConfig.label}
                </div>

                {customer.tags && customer.tags.map((tag, i) => {
                  const lowerTag = tag.toLowerCase();
                  let tagStyle = "bg-primary-50 text-primary-700 border-primary-200"; // Default

                  if (lowerTag === 'royal') tagStyle = "bg-purple-100 text-purple-700 border-purple-200";
                  if (lowerTag === 'gold') tagStyle = "bg-amber-100 text-amber-700 border-amber-200";
                  if (lowerTag === 'platinum') tagStyle = "bg-slate-100 text-slate-700 border-slate-200";
                  if (lowerTag === 'vip') tagStyle = "bg-rose-100 text-rose-700 border-rose-200";

                  return (
                    <div key={i} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-[11px] uppercase tracking-wider ${tagStyle}`}>
                      <Tag className="w-3 h-3" />
                      {tag}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={handleEdit}
                className="btn-icon bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white w-12 h-12"
                title="Edit"
              >
                <Edit className="w-5 h-5" />
              </button>
              <button
                onClick={handleDelete}
                className="btn-icon bg-red-50 text-red-600 hover:bg-red-600 hover:text-white w-12 h-12"
                title="Delete"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Details Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
              <div className="w-10 h-10 bg-blue-100/50 rounded-xl flex items-center justify-center text-blue-600">
                <Phone className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">WhatsApp</p>
                <p className="text-sm font-bold text-navy-900">+{customer.phone}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
              <div className="w-10 h-10 bg-purple-100/50 rounded-xl flex items-center justify-center text-purple-600">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Registered</p>
                <p className="text-sm font-bold text-navy-900">{formatDate(customer.createdAt || customer.addedDate)}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
              <div className="w-10 h-10 bg-orange-100/50 rounded-xl flex items-center justify-center text-orange-600">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Last Contact</p>
                <p className="text-sm font-bold text-navy-900">{formatDate(customer.lastContactDate || customer.lastContact)}</p>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {customer.notes && (
            <div className="bg-amber-50 rounded-2xl p-6 border border-amber-100">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-4 h-4 text-amber-600" />
                <h4 className="text-sm font-bold text-amber-800 uppercase tracking-wide">Internal Notes</h4>
              </div>
              <p className="text-sm font-medium text-amber-900/80 leading-relaxed italic">
                "{customer.notes}"
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-8 py-5 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Managed by {customer.createdBy?.name || 'System'}</p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-all active:scale-95 shadow-lg shadow-navy-900/10"
          >
            Close Profile
          </button>
        </div>

      </div>
    </div>
  );
}
