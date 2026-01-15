import { useState, useEffect } from 'react';
import { X, AlertCircle, User, Phone, Tag, CheckCircle2, Save, Info } from 'lucide-react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';

function CustomerForm({ isOpen, onClose, onSuccess, editData, API_BASE_URL }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    status: 'active',
    tags: []
  });

  const [tagInput, setTagInput] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || '',
        phone: editData.phone || '',
        status: editData.status || 'active',
        tags: editData.tags || []
      });
    } else {
      setFormData({
        name: '',
        phone: '',
        status: 'active',
        tags: []
      });
      setTagInput('');
    }
  }, [editData, isOpen]);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(08|\+?628|\d{10,15})\d*$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPhoneNumber = (phone) => {
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('08')) {
      return '628' + cleaned.substring(2);
    }
    return cleaned;
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);
    setErrors({});

    try {
      const dataToSubmit = {
        ...formData,
        phone: formatPhoneNumber(formData.phone)
      };

      if (editData) {
        await axios.put(`${API_BASE_URL}/${editData._id}`, dataToSubmit);
        toast.success('Customer updated!');
      } else {
        await axios.post(API_BASE_URL, dataToSubmit);
        toast.success('Customer created!');
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      const errorMsg = error.response?.data?.message || error.message || '';

      if (errorMsg.includes('already exists') || errorMsg.includes('duplicate')) {
        setErrors({ submit: 'This phone number is already registered!' });
      } else {
        setErrors({ submit: errorMsg || 'Failed to save customer' });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">

        {/* Header */}
        <div className="bg-navy-900 px-8 py-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                {editData ? <Save className="w-6 h-6 text-primary-400" /> : <User className="w-6 h-6 text-primary-400" />}
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">
                  {editData ? 'Update Profile' : 'New Customer'}
                </h2>
                <p className="text-xs font-medium text-gray-400 tracking-wide">
                  Fill in the details below
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={loading}
              className="w-9 h-9 bg-white/5 hover:bg-white/10 rounded-lg flex items-center justify-center transition-all disabled:opacity-50 text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-8">
          {errors.submit && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-start gap-3 animate-in shake duration-300">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm font-semibold">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-5">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" /> Full Name
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-5 py-3 bg-gray-50 border rounded-xl font-medium text-navy-900 focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all ${errors.name ? 'border-red-500' : 'border-gray-200 focus:border-primary-500'
                  }`}
                placeholder="e.g. John Doe"
              />
              {errors.name && <p className="text-xs font-semibold text-red-500 ml-2">{errors.name}</p>}
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" /> WhatsApp Number
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 font-bold text-gray-400">+</span>
                <input
                  type="text"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full pl-9 pr-5 py-3 bg-gray-50 border rounded-xl font-medium text-navy-900 focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10 transition-all ${errors.phone ? 'border-red-500' : 'border-gray-200 focus:border-primary-500'
                    }`}
                  placeholder="628..."
                />
              </div>
              {errors.phone && <p className="text-xs font-semibold text-red-500 ml-2">{errors.phone}</p>}
            </div>

            {/* Status & Tags Logic in Grid */}
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-gray-400" /> Status
                </label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-navy-900 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all appearance-none cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-700 ml-1 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-gray-400" /> Add Tag
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={handleTagKeyPress}
                    className="flex-1 px-5 py-3 bg-gray-50 border border-gray-200 rounded-xl font-medium text-navy-900 focus:outline-none focus:bg-white focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all"
                    placeholder="Tag name"
                  />
                </div>
              </div>
            </div>

            {/* Tags Display */}
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                {formData.tags.map((tag, index) => (
                  <span key={index} className="flex items-center gap-1.5 px-3 py-1 bg-primary-100 text-primary-800 rounded-lg font-bold text-xs border border-primary-200">
                    {tag}
                    <button type="button" onClick={() => handleRemoveTag(tag)} className="hover:text-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-3 p-3.5 bg-blue-50/50 rounded-xl border border-blue-100/50">
              <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
              <p className="text-[11px] font-medium text-blue-600 leading-snug">Personalize your broadcast campaigns with these details for better engagement.</p>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3.5 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-all"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-[2] py-3.5 bg-navy-900 text-white rounded-xl font-bold text-base hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  {editData ? 'Update Profile' : 'Create Customer'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerForm;
