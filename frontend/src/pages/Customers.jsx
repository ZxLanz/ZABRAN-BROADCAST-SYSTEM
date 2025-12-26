// frontend/src/pages/Customers.jsx - ✅ CLEANED VERSION (NO i18n)
import { useState, useEffect, useCallback } from 'react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import { 
  Users, 
  UserPlus, 
  TrendingUp, 
  Search, 
  Download, 
  Upload,
  Eye,
  Edit,
  Trash2,
  Filter,
  Loader2,
  Tag
} from 'lucide-react';

import CustomerForm from '../components/CustomerForm';
import ViewCustomerModal from '../components/ViewCustomerModal';
import ImportCSVModal from '../components/ImportCSVModal';
import DeleteConfirm from '../components/DeleteConfirm'; 

const API_BASE_URL = '/customers';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    blocked: 0,
    growthRate: '0%'
  });
  
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // State untuk Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingCustomer, setViewingCustomer] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const customerResponse = await axios.get(API_BASE_URL);
      const statsResponse = await axios.get(`${API_BASE_URL}/stats/summary`);
      
      setCustomers(customerResponse.data.data);
      setStats(statsResponse.data.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter and Search
  const filterAndSearchCustomers = useCallback(() => {
    let tempCustomers = customers;

    if (statusFilter !== 'all') {
      tempCustomers = tempCustomers.filter(
        cust => cust.status === statusFilter
      );
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      tempCustomers = tempCustomers.filter(cust =>
        cust.name.toLowerCase().includes(query) ||
        cust.phone.includes(query) ||
        (cust.email && cust.email.toLowerCase().includes(query))
      );
    }

    setFilteredCustomers(tempCustomers);
  }, [customers, statusFilter, searchQuery]);

  useEffect(() => {
    filterAndSearchCustomers();
  }, [customers, statusFilter, searchQuery, filterAndSearchCustomers]);

  // Handlers
  const handleFormSuccess = () => {
    fetchData();
    handleFormClose();
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setIsFormOpen(true);
  };

  const handleFormClose = () => {
    setIsFormOpen(false);
    setEditingCustomer(null);
  };
  
  const handleViewCustomer = (customer) => {
    setViewingCustomer(customer);
    setIsViewModalOpen(true);
  };

  const handleViewClose = () => {
    setIsViewModalOpen(false);
    setViewingCustomer(null);
  };

  const handleEditFromView = (customer) => {
    handleViewClose();
    handleEditCustomer(customer);
  };

  const handleImportClose = () => setIsImportModalOpen(false);
  
  const handleImportSuccess = () => {
    toast.success('Customers imported successfully');
    fetchData();
    handleImportClose();
  };

  const handleDeleteCustomer = useCallback((customer) => {
    setDeletingCustomer(customer);
    setIsDeleteConfirmOpen(true);
  }, []);

  const handleDeleteClose = useCallback(() => {
    setIsDeleteConfirmOpen(false);
    setDeletingCustomer(null);
  }, []);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deletingCustomer) return;

    const customerName = deletingCustomer.name;
    const customerId = deletingCustomer._id;

    setIsDeleteConfirmOpen(false); 
    setIsDeleting(true);

    const toastId = toast.loading(
      `Deleting ${customerName}...`
    );

    try {
      await axios.delete(`${API_BASE_URL}/${customerId}`);
      
      toast.success(
        `${customerName} successfully deleted`,
        { id: toastId }
      );
      fetchData();
    } catch (error) {
      toast.dismiss(toastId);
      console.error('Error deleting customer:', error);
      const errorMessage = error.response?.data?.error || 
        'Failed to delete customer';
      toast.error(`Failed to delete. ${errorMessage}`);
    } finally {
      setDeletingCustomer(null);
      setIsDeleting(false);
    }
  }, [deletingCustomer, fetchData]); 
  
  const handleDeleteFromView = useCallback((customer) => {
    handleViewClose(); 
    handleDeleteCustomer(customer); 
  }, [handleViewClose, handleDeleteCustomer]);

  const getStatusBadge = (status) => {
    const configs = {
      active: { 
        bg: 'bg-green-100', 
        text: 'text-green-800', 
        border: 'border-green-200' 
      },
      inactive: { 
        bg: 'bg-yellow-100', 
        text: 'text-yellow-800', 
        border: 'border-yellow-200' 
      },
      blocked: { 
        bg: 'bg-red-100', 
        text: 'text-red-800', 
        border: 'border-red-200' 
      }
    };
    
    const config = configs[status] || configs.inactive;
    
    return (
      <span className={`badge ${config.bg} ${config.text} ${config.border}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="animate-slide-in">
      
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1">
              Customers
            </h1>
            <p className="text-base text-gray-600 font-medium">
              Manage your customer database and segments
            </p>
          </div>

          <button 
            onClick={() => setIsFormOpen(true)}
            className="btn btn-primary"
          >
            <UserPlus className="w-5 h-5" />
            <span>Add Customer</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {[
          { 
            label: 'Total Customers',
            value: stats.total, 
            icon: Users,
            trend: stats.growthRate,
            trendUp: true
          },
          { 
            label: 'Active',
            value: stats.active, 
            icon: Users,
            subtitle: 'Ready for broadcast'
          },
          { 
            label: 'Inactive',
            value: stats.inactive, 
            icon: Users,
            subtitle: 'Temporarily paused'
          },
          { 
            label: 'Blocked',
            value: stats.blocked, 
            icon: Users,
            subtitle: 'Unsubscribed'
          }
        ].map((stat, index) => {
          const Icon = stat.icon;
          
          return (
            <div key={index} className="stat-card">
              <div className="relative z-10 mb-4">
                <div className="w-14 h-14 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-sm">
                  <Icon className="w-7 h-7 text-primary-500" />
                </div>
              </div>

              <div className="relative z-10">
                <div className="text-sm text-gray-600 font-semibold mb-2">
                  {stat.label}
                </div>
                
                <div className="text-4xl font-black text-navy-800 tracking-tight mb-3">
                  {stat.value}
                </div>

                {stat.trend && (
                  <div className="flex items-center gap-1.5 text-sm font-bold text-green-600">
                    <TrendingUp className="w-4 h-4" />
                    <span>{stat.trend}</span>
                  </div>
                )}
                
                {stat.subtitle && (
                  <div className="text-sm text-gray-600 font-semibold">
                    {stat.subtitle}
                  </div>
                )}
              </div>
            </div>
          );
        })}
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
              placeholder="Search by name, phone, or email..."
              className="w-full pl-10 pr-4 py-2.5 bg-white border-2 border-gray-300 rounded-xl focus:ring-0 focus:border-primary-500 outline-none font-medium text-gray-700 transition-colors"
            />
          </div>

          {/* Status Filter Buttons */}
          <div className="flex gap-2 overflow-x-auto">
            {[
              { value: 'all', label: 'All Customers' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'blocked', label: 'Blocked' }
            ].map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all ${
                  statusFilter === status.value
                    ? 'bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-navy-900 shadow-md'
                    : 'bg-white border-2 border-gray-300 text-gray-700 hover:border-primary-500 hover:text-primary-600'
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>

        </div>
      </div>

      {/* Customers Table */}
      <div className="card p-7">
        
        {/* Table Header */}
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl font-black text-navy-800 tracking-tight">
            Customers ({filteredCustomers.length})
          </h2>

          <div className="flex gap-3">
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="btn btn-secondary"
            >
              <Upload className="w-4 h-4" />
              <span>Import</span>
            </button>
            
            <button 
              onClick={() => { /* Export logic */ }}
              className="bg-navy-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-navy-700 transition-colors shadow-md"
            >
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">
              Loading customers...
            </p>
          </div>
        ) : filteredCustomers.length > 0 ? (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Tags</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr key={customer._id}>
                    <td>
                      <div className="font-bold text-navy-800 mb-1">
                        {customer.name}
                      </div>
                      <div className="text-xs text-gray-400">
                        ID: {customer._id.substring(0, 8)}...
                      </div>
                    </td>
                    <td className="font-medium text-gray-700">
                      {customer.phone}
                    </td>
                    <td className="text-gray-600">
                      {customer.email || '-'}
                    </td>
                    <td>
                      {customer.tags && customer.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {customer.tags.slice(0, 2).map((tag, index) => (
                            <span
                              key={index}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary-100 text-primary-800 rounded-full text-xs font-semibold"
                            >
                              <Tag className="w-3 h-3" />
                              {tag}
                            </span>
                          ))}
                          {customer.tags.length > 2 && (
                            <span className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                              +{customer.tags.length - 2}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">No tags</span>
                      )}
                    </td>
                    <td>
                      {getStatusBadge(customer.status)}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleViewCustomer(customer)}
                          className="btn-icon"
                          title="View"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEditCustomer(customer)}
                          className="btn-icon"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDeleteCustomer(customer)}
                          className="btn-icon"
                          title="Delete"
                          disabled={isDeleting}
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
            <Users className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              No customers found
            </h3>
            <p className="text-gray-600 font-medium mb-4">
              Try adjusting your filters or add new customers
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('all');
              }}
              className="btn btn-primary"
            >
              Clear Filters
            </button>
          </div>
        )}

      </div>

      {/* Modals */}
      <CustomerForm 
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSuccess={handleFormSuccess}
        editData={editingCustomer}
        API_BASE_URL={API_BASE_URL}
      />

      <DeleteConfirm 
        open={isDeleteConfirmOpen}
        onClose={handleDeleteClose}
        onConfirm={handleDeleteConfirm}
        title={`Delete Customer: ${deletingCustomer?.name || 'Customer'}`}
        message={`Are you sure you want to delete ${deletingCustomer?.name}? This action cannot be undone.`}
        isLoading={isDeleting}
      />

      <ViewCustomerModal 
        isOpen={isViewModalOpen}
        onClose={handleViewClose}
        customer={viewingCustomer}
        onEdit={handleEditFromView}
        onDelete={handleDeleteFromView}
      />

      <ImportCSVModal 
        isOpen={isImportModalOpen}
        onClose={handleImportClose}
        onSuccess={handleImportSuccess}
        API_BASE_URL={API_BASE_URL}
      />

    </div>
  );
}