import { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Copy, Eye, X, Download, MessageSquare, Filter } from 'lucide-react';
import axios from '../utils/axios'; // ✅ IMPORT AXIOS

const API_BASE = '/templates'; // ✅ Relative URL (base sudah di axios config)

const CategoryBadge = ({ category }) => {
  const configs = {
    promo: { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' },
    reminder: { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200' },
    greeting: { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200' },
    notification: { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200' },
    announcement: { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-200' },
  };
  const config = configs[category] || { bg: 'bg-gray-100', text: 'text-gray-800', border: 'border-gray-200' };
  return <span className={`badge ${config.bg} ${config.text} ${config.border}`}>{category}</span>;
};

export default function Templates() {
  const [templates, setTemplates] = useState([]);
  const [filteredTemplates, setFilteredTemplates] = useState([]);
  const [categories] = useState(['all', 'promo', 'reminder', 'announcement', 'greeting', 'notification']);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    category: 'general'
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [templates, searchQuery, selectedCategory]);

  // ✅ GANTI fetch → axios
  const loadTemplates = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get(API_BASE);
      
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = templates;

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(t => t.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(t => 
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.message.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredTemplates(filtered);
  };

  // ✅ GANTI fetch → axios
  const handleCreate = async () => {
    try {
      setLoading(true);
      const { data } = await axios.post(API_BASE, formData);
      
      if (data.success) {
        setIsFormOpen(false);
        setFormData({ name: '', message: '', category: 'general' });
        loadTemplates();
      }
    } catch (error) {
      console.error('Failed to create template:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ GANTI fetch → axios
  const handleEdit = async () => {
    try {
      setLoading(true);
      const { data } = await axios.put(
        `${API_BASE}/${editingTemplate._id}`,
        formData
      );
      
      if (data.success) {
        setIsFormOpen(false);
        setEditingTemplate(null);
        setFormData({ name: '', message: '', category: 'general' });
        loadTemplates();
      }
    } catch (error) {
      console.error('Failed to update template:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ GANTI fetch → axios
  const handleDuplicate = async (template) => {
    try {
      setLoading(true);
      await axios.post(API_BASE, {
        name: `${template.name} (Copy)`,
        message: template.message,
        category: template.category
      });
      
      loadTemplates();
    } catch (error) {
      console.error('Failed to duplicate template:', error);
    } finally {
      setLoading(false);
    }
  };

  // ✅ GANTI fetch → axios
  const confirmDelete = async () => {
    try {
      setLoading(true);
      await axios.delete(`${API_BASE}/${templateToDelete._id}`);
      
      setIsDeleteModalOpen(false);
      setTemplateToDelete(null);
      loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(templates, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `templates_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      message: template.message,
      category: template.category
    });
    setIsFormOpen(true);
  };

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setFormData({ name: '', message: '', category: 'general' });
    setIsFormOpen(true);
  };

  const handleDeleteTemplate = (template) => {
    setTemplateToDelete(template);
    setIsDeleteModalOpen(true);
  };

  const handleViewTemplate = (template) => {
    setSelectedTemplate(template);
    setIsViewModalOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingTemplate(null);
    setFormData({ name: '', message: '', category: 'general' });
  };

  const handleDeleteClose = () => {
    setIsDeleteModalOpen(false);
    setTemplateToDelete(null);
  };

  const handleViewClose = () => {
    setIsViewModalOpen(false);
    setSelectedTemplate(null);
  };

  return (
    <div className="animate-slide-in">
      
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1">
              Message Templates
            </h1>
            <p className="text-base text-gray-600 font-medium">
              Manage and organize your broadcast message templates
            </p>
          </div>

          <button 
            onClick={handleAddTemplate}
            className="btn btn-primary"
          >
            <Plus className="w-5 h-5" />
            <span>New Template</span>
          </button>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="card p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search templates..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-300 rounded-xl focus:ring-0 focus:border-primary-500 outline-none font-medium text-gray-700 transition-colors"
            />
          </div>

          {/* Category Buttons */}
          <div className="flex gap-2 overflow-x-auto">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-navy-900 shadow-md'
                    : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-primary-500 hover:text-primary-600'
                }`}
              >
                {cat === 'all' ? 'All Templates' : cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Templates Table */}
      <div className="card p-7">
        
        {/* Table Header */}
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl font-black text-navy-800 tracking-tight">
            Templates ({filteredTemplates.length})
          </h2>

          <button 
            onClick={handleExport}
            className="bg-navy-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-navy-700 transition-colors shadow-md"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>

        {/* Templates List */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading templates...</p>
          </div>
        ) : filteredTemplates.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Template Name</th>
                  <th>Category</th>
                  <th>Variables</th>
                  <th>Usage</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTemplates.map((template) => (
                  <tr key={template._id}>
                    <td>
                      <div className="font-bold text-navy-800 mb-1">
                        {template.name}
                      </div>
                      <div className="text-xs text-gray-500 font-medium truncate max-w-xs">
                        {template.message.substring(0, 50)}...
                      </div>
                    </td>
                    <td>
                      <CategoryBadge category={template.category} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {template.variables.slice(0, 3).map((v) => (
                          <span key={v} className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-mono rounded border border-primary-200">
                            {`{${v}}`}
                          </span>
                        ))}
                        {template.variables.length > 3 && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs font-semibold rounded">
                            +{template.variables.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="font-medium text-gray-700">
                        {template.usageCount} uses
                      </div>
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewTemplate(template)}
                          className="btn-icon"
                          title="Preview"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDuplicate(template)}
                          className="btn-icon" 
                          title="Duplicate"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => openEditModal(template)}
                          className="btn-icon" 
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteTemplate(template)}
                          className="btn-icon" 
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <MessageSquare className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">No templates found</h3>
            <p className="text-gray-600 font-medium mb-4">Try adjusting your search or filters</p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('all');
              }}
              className="btn btn-primary"
            >
              Clear Filters
            </button>
          </div>
        )}

      </div>

      {/* Form Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl max-h-[90vh] overflow-hidden">
            
            {/* Modal Header - GOLD STYLE */}
            <div className="bg-gradient-to-r from-amber-100 via-yellow-100 to-amber-50 px-7 py-5 border-b-2 border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-gray-900 tracking-tight">
                  {editingTemplate ? 'Edit Template' : 'Add New Template'}
                </h2>
                <p className="text-sm text-gray-600 font-medium mt-1">
                  {editingTemplate ? 'Update template details below' : 'Fill in the template details below'}
                </p>
              </div>
              <button
                onClick={handleFormClose}
                className="btn-icon"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-7 overflow-y-auto max-h-[calc(90vh-200px)]">
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Template Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Enter template name"
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all font-medium"
                  />
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all font-medium"
                  >
                    <option value="general">General</option>
                    <option value="promo">Promo</option>
                    <option value="reminder">Reminder</option>
                    <option value="greeting">Greeting</option>
                    <option value="notification">Notification</option>
                    <option value="announcement">Announcement</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">
                    Message Content *
                    <span className="text-gray-500 font-normal ml-2">(Use {`{variableName}`} for variables)</span>
                  </label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({...formData, message: e.target.value})}
                    rows={6}
                    className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:ring-2 focus:ring-primary-200 outline-none transition-all font-medium resize-none"
                    placeholder="Example: Hello {nama}, your order {orderId} is ready!"
                  />
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-7 py-5 border-t-2 border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleFormClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button
                onClick={editingTemplate ? handleEdit : handleCreate}
                disabled={loading}
                className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-gray-900 px-6 py-2.5 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Plus className="w-5 h-5" />
                <span>{loading ? 'Saving...' : editingTemplate ? 'Update Template' : 'Add Template'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* View Modal */}
      {isViewModalOpen && selectedTemplate && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden shadow-2xl">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-primary-50 to-white px-7 py-5 border-b-2 border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-navy-800 tracking-tight">{selectedTemplate.name}</h2>
                <p className="text-sm text-gray-600 font-medium mt-1">{selectedTemplate._id}</p>
              </div>
              <button
                onClick={handleViewClose}
                className="btn-icon"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-7 overflow-y-auto max-h-[calc(90vh-180px)]">
              <div className="space-y-6">
                
                <div>
                  <label className="block text-sm font-bold text-gray-600 mb-3">Message Content</label>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
                    <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed font-medium">
                      {selectedTemplate.message}
                    </p>
                  </div>
                </div>

                {selectedTemplate.variables.length > 0 && (
                  <div>
                    <label className="block text-sm font-bold text-gray-600 mb-3">Required Variables</label>
                    <div className="flex flex-wrap gap-2">
                      {selectedTemplate.variables.map((variable) => (
                        <span
                          key={variable}
                          className="px-3 py-2 bg-primary-100 text-primary-700 text-sm font-mono rounded-xl border-2 border-primary-200 font-semibold"
                        >
                          {`{${variable}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-5 border-t-2 border-gray-200 grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Total Usage</p>
                    <p className="text-3xl font-black text-navy-800 tracking-tight">{selectedTemplate.usageCount}</p>
                  </div>
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5">
                    <p className="text-xs text-gray-600 font-semibold mb-2">Category</p>
                    <CategoryBadge category={selectedTemplate.category} />
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-7 py-5 border-t-2 border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleViewClose}
                className="btn btn-secondary"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteModalOpen && templateToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-red-50 to-white px-7 py-5 border-b-2 border-gray-200">
              <h2 className="text-2xl font-black text-navy-800 tracking-tight">Delete Template</h2>
              <p className="text-sm text-gray-600 font-medium mt-1">This action cannot be undone</p>
            </div>

            {/* Modal Body */}
            <div className="p-7">
              <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 mb-6">
                <p className="text-sm font-bold text-gray-600 mb-2">Template Details:</p>
                <p className="font-bold text-navy-800 mb-1">{templateToDelete.name}</p>
                <p className="text-sm text-gray-600 mb-2">{templateToDelete._id}</p>
                <CategoryBadge category={templateToDelete.category} />
              </div>
              <p className="text-gray-600 font-medium">
                Are you sure you want to delete this template? All associated data will be permanently removed.
              </p>
            </div>

            {/* Modal Footer */}
            <div className="bg-gray-50 px-7 py-5 border-t-2 border-gray-200 flex justify-end gap-3">
              <button
                onClick={handleDeleteClose}
                className="btn btn-secondary"
              >
                Cancel
              </button>
              <button 
                onClick={confirmDelete}
                disabled={loading}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-red-700 transition-colors shadow-md disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete Template'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}