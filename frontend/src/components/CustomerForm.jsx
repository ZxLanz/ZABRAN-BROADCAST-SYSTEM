import { useState, useEffect } from 'react';
import { X, AlertCircle } from 'lucide-react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';

// ✅ FIXED: Props sesuai dengan Customers.jsx
function CustomerForm({ isOpen, onClose, onSuccess, editData, API_BASE_URL }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    status: 'active',
    division: '',
    tags: [] // ✅ ADDED
  });

  const [tagInput, setTagInput] = useState(''); // ✅ ADDED
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // ✅ FIXED: Gunakan editData, bukan customer
  useEffect(() => {
    if (editData) {
      setFormData({
        name: editData.name || '',
        phone: editData.phone || '',
        email: editData.email || '',
        status: editData.status || 'active',
        division: editData.division || '',
        tags: editData.tags || [] // ✅ ADDED
      });
    } else {
      // Reset form jika tidak ada editData
      setFormData({
        name: '',
        phone: '',
        email: '',
        status: 'active',
        division: '',
        tags: []
      });
      setTagInput('');
    }
  }, [editData, isOpen]); // ✅ ADDED: isOpen dependency untuk reset saat modal dibuka

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^(08|\+?628)\d{8,11}$/.test(formData.phone)) {
      newErrors.phone = 'Invalid phone number format';
    }

    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const formatPhoneNumber = (phone) => {
    if (phone.startsWith('08')) {
      return '628' + phone.substring(2);
    }
    if (phone.startsWith('+62')) {
      return phone.substring(1);
    }
    if (phone.startsWith('62')) {
      return phone;
    }
    return phone;
  };

  // ✅ ADDED: Handle tag input
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

  // ✅ ADDED: Handle tag removal
  const handleRemoveTag = (tagToRemove) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  // ✅ ADDED: Handle Enter key for tags
  const handleTagKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    setErrors({}); // ✅ Clear previous errors

    try {
      const dataToSubmit = {
        ...formData,
        phone: formatPhoneNumber(formData.phone)
      };

      // 🔍 DEBUG: Log data yang akan dikirim
      console.log('📤 Data yang dikirim ke backend:', dataToSubmit);
      console.log('🏷️ Tags yang dikirim:', dataToSubmit.tags);
      console.log('📊 Total tags:', dataToSubmit.tags?.length || 0);

      // ✅ FIXED: Gunakan editData dan API_BASE_URL dari props
      let response;
      if (editData) {
        response = await axios.put(`${API_BASE_URL}/${editData._id}`, dataToSubmit);
        console.log('✅ Response dari UPDATE:', response.data);
        toast.success('Customer updated successfully!');
      } else {
        response = await axios.post(API_BASE_URL, dataToSubmit);
        console.log('✅ Response dari CREATE:', response.data);
        toast.success('Customer created successfully!');
      }
      
      // 🔍 DEBUG: Cek apakah response punya tags
      console.log('🏷️ Tags di response:', response.data?.data?.tags || response.data?.tags);

      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error saving customer:', error);
      
      // ✅ ADDED: Duplicate detection
      const errorMsg = error.response?.data?.message || error.message || '';
      
      if (error.response?.status === 400 || error.response?.status === 409) {
        if (errorMsg.includes('already exists') || 
            errorMsg.includes('duplicate') || 
            errorMsg.includes('phone')) {
          setErrors({
            submit: '⚠️ Customer dengan nomor telepon ini sudah terdaftar!'
          });
          return;
        }
      }
      
      setErrors({
        submit: error.response?.data?.message || 'Failed to save customer'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // ✅ FIXED: Cek isOpen untuk render modal
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-800">
            {editData ? 'Edit Customer' : 'Add New Customer'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          {/* ✅ ADDED: Duplicate Alert */}
          {errors.submit && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-red-800 text-sm">{errors.submit}</p>
            </div>
          )}

          <div className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter customer name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="08xxxxxxxxxx"
              />
              {errors.phone && (
                <p className="mt-1 text-sm text-red-500">{errors.phone}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="customer@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-500">{errors.email}</p>
              )}
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="blocked">Blocked</option>
              </select>
            </div>

            {/* ✅ ADDED: Tags Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tags / Groups
              </label>
              
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={handleTagKeyPress}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Type tag and press Enter"
                />
                <button
                  type="button"
                  onClick={handleAddTag}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Add
                </button>
              </div>

              {/* Display Tags */}
              {formData.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
                    >
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-primary-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              <p className="mt-2 text-xs text-gray-500">
                Add tags to categorize customers (e.g., VIP, Premium, Regular)
              </p>
            </div>

            {/* Division */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Division
              </label>
              <input
                type="text"
                name="division"
                value={formData.division}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter division"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="flex justify-end gap-3 mt-6 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Saving...' : editData ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CustomerForm;