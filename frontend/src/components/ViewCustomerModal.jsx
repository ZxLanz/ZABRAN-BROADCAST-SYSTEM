import { X, User, Phone, Mail, Tag, Calendar, MessageCircle, Edit, Trash2, Clock } from 'lucide-react';

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

  const getGroupColor = (group) => {
    const colors = {
      'VIP': 'bg-purple-100 text-purple-800 border-purple-200',
      'Premium': 'bg-blue-100 text-blue-800 border-blue-200',
      'Regular': 'bg-gray-100 text-gray-800 border-gray-200'
    };
    return colors[group] || colors['Regular'];
  };

  const getStatusColor = (status) => {
    const colors = {
      'active': 'bg-green-100 text-green-800 border-green-200',
      'inactive': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || colors['active'];
  };

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-in">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                <User className="w-8 h-8 text-navy-900" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-navy-900 mb-1">
                  Customer Details
                </h2>
                <p className="text-sm text-navy-700 font-medium">
                  ID: {customer.id}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors"
            >
              <X className="w-6 h-6 text-navy-900" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8 overflow-y-auto max-h-[calc(90vh-120px)]">
          
          {/* Customer Info Card */}
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 border-2 border-gray-200 rounded-2xl p-6 mb-6">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h3 className="text-2xl font-black text-navy-800 mb-2">
                  {customer.name}
                </h3>
                <div className="flex gap-2">
                  <span className={`badge ${getGroupColor(customer.group)}`}>
                    {customer.group}
                  </span>
                  <span className={`badge ${getStatusColor(customer.status)}`}>
                    {customer.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
              
              {/* Quick Actions */}
              <div className="flex gap-2">
                <button
                  onClick={handleEdit}
                  className="px-4 py-2 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-600 transition-colors flex items-center gap-2"
                >
                  <Edit className="w-4 h-4" />
                  <span>Edit</span>
                </button>
                <button
                  onClick={handleDelete}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            {/* Contact Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Phone Number</p>
                    <p className="text-sm font-bold text-navy-800">{customer.phone}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <Mail className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Email Address</p>
                    <p className="text-sm font-bold text-navy-800 break-all">{customer.email}</p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Added Date</p>
                    <p className="text-sm font-bold text-navy-800">
                      {new Date(customer.addedDate).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white border-2 border-gray-200 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Clock className="w-5 h-5 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-gray-500 uppercase">Last Contact</p>
                    <p className="text-sm font-bold text-navy-800">
                      {new Date(customer.lastContact).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          {customer.notes && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-6 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <MessageCircle className="w-5 h-5 text-amber-600" />
                <h4 className="text-lg font-black text-navy-800">Notes</h4>
              </div>
              <p className="text-sm font-medium text-gray-700 leading-relaxed">
                {customer.notes}
              </p>
            </div>
          )}

          {/* Activity History (Mock Data) */}
          <div className="bg-white border-2 border-gray-200 rounded-2xl p-6">
            <h4 className="text-lg font-black text-navy-800 mb-4">Recent Activity</h4>
            <div className="space-y-3">
              <div className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-navy-800">Customer added to system</p>
                  <p className="text-xs text-gray-500 font-medium">
                    {new Date(customer.addedDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 pb-3 border-b border-gray-200 last:border-0 last:pb-0">
                <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-navy-800">Last contact made</p>
                  <p className="text-xs text-gray-500 font-medium">
                    {new Date(customer.lastContact).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full mt-2"></div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-navy-800">
                    Assigned to {customer.group} group
                  </p>
                  <p className="text-xs text-gray-500 font-medium">
                    {new Date(customer.addedDate).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="bg-gray-50 border-t-2 border-gray-200 px-8 py-4">
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}