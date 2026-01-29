// frontend/src/pages/Customers.jsx
import { useState, useEffect, useCallback } from 'react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
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
  Tag,
  RefreshCw,
  CheckCircle2,
  X,
  Clock,
  XCircle,
  Phone,
  Save,
  MessageSquare // Added
} from 'lucide-react';

import CustomerForm from '../components/CustomerForm';
import ViewCustomerModal from '../components/ViewCustomerModal';
import ImportCSVModal from '../components/ImportCSVModal';
import DeleteConfirm from '../components/DeleteConfirm';

const API_BASE_URL = '/customers';

export default function Customers() {
  const navigate = useNavigate();
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

  // Sync from Chat States
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [syncContacts, setSyncContacts] = useState([]);
  const [isLoadingSync, setIsLoadingSync] = useState(false);
  const [selectedSyncContacts, setSelectedSyncContacts] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

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

  // FETCH CONTACTS FROM CHAT FOR SYNC
  const fetchSyncContacts = useCallback(async () => {
    setIsLoadingSync(true);
    try {
      const { data } = await axios.get(`${API_BASE_URL}/sync-from-chat`);
      if (data.success) {
        setSyncContacts(data.data);
        // Default select all
        setSelectedSyncContacts(data.data.map(c => c.phone));
      }
    } catch (error) {
      toast.error('Gagal mengambil kontak chat');
    } finally {
      setIsLoadingSync(false);
    }
  }, []);

  useEffect(() => {
    if (isSyncModalOpen) {
      fetchSyncContacts();
    }
  }, [isSyncModalOpen, fetchSyncContacts]);

  const handleSyncSubmit = async () => {
    if (selectedSyncContacts.length === 0) return;
    setIsSyncing(true);
    try {
      const contactsToSync = syncContacts.filter(c => selectedSyncContacts.includes(c.phone));
      const { data } = await axios.post(`${API_BASE_URL}/sync-from-chat`, {
        contacts: contactsToSync.map(c => ({ name: c.name, phone: c.phone }))
      });
      if (data.success) {
        toast.success(data.message);
        fetchData();
        setIsSyncModalOpen(false);
      }
    } catch (error) {
      toast.error('Gagal menyinkronkan kontak');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">

      {/* Page Header */}
      <div className="relative mb-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-navy-900 dark:text-white tracking-tight flex items-center gap-3">
              <Users className="w-10 h-10 text-primary-500" />
              Customers
            </h1>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></span>
              Pulse Management & Segment Insights
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFormOpen(true)}
              className="px-6 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10 active:scale-95 flex items-center gap-2"
            >
              <UserPlus className="w-5 h-5" />
              New Customer
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        {[
          {
            label: 'Total Audience',
            value: stats.total,
            icon: Users,
            trend: stats.growthRate,
            color: 'primary'
          },
          {
            label: 'Active Pulse',
            value: stats.active,
            icon: CheckCircle2,
            subtitle: 'Ready to engage',
            color: 'green'
          },
          {
            label: 'Inactive',
            value: stats.inactive,
            icon: Clock,
            subtitle: 'Awaiting touchpoint',
            color: 'yellow'
          },
          {
            label: 'System Blocked',
            value: stats.blocked,
            icon: XCircle,
            subtitle: 'Safety protocols',
            color: 'red'
          }
        ].map((stat, index) => {
          const Icon = stat.icon;
          const colors = {
            primary: 'bg-primary-50 text-primary-600 border-primary-100',
            green: 'bg-green-50 text-green-600 border-green-100',
            yellow: 'bg-yellow-50 text-yellow-600 border-yellow-100',
            red: 'bg-red-50 text-red-600 border-red-100'
          };

          return (
            <div key={index} className="bg-white dark:bg-[#1f2937] rounded-2xl p-6 border border-gray-100 dark:border-gray-700 hover:shadow-lg transition-all flex items-start justify-between">
              <div className="space-y-3">
                <div className={`w-10 h-10 rounded-xl ${colors[stat.color]} border flex items-center justify-center`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-navy-900 dark:text-white">{stat.value}</h3>
                </div>
                {stat.trend && (
                  <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-50 text-green-700 rounded-md w-fit">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[10px] font-bold">{stat.trend}</span>
                  </div>
                )}
                {stat.subtitle && (
                  <p className="text-[10px] font-medium text-gray-400 italic">"{stat.subtitle}"</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Content Area */}
      <div className="space-y-8">

        {/* Toolbar: Filters & Search */}
        <div className="bg-white dark:bg-[#1f2937] rounded-2xl p-2 border border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row gap-3 shadow-sm">
          <div className="flex-1 relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 group-focus-within:text-primary-500 transition-colors" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, phone..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-800 border-transparent focus:bg-white dark:focus:bg-gray-700 focus:border-primary-200 rounded-xl outline-none font-medium text-sm text-navy-900 dark:text-white transition-all placeholder:text-gray-400"
            />
          </div>

          <div className="flex bg-gray-50 dark:bg-gray-800 p-1 rounded-xl gap-1">
            {[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Paused' },
              { value: 'blocked', label: 'Blocked' }
            ].map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(status.value)}
                className={`px-6 py-2 rounded-lg text-xs font-bold transition-all ${statusFilter === status.value
                  ? 'bg-white dark:bg-gray-700 text-navy-900 dark:text-white shadow-sm ring-1 ring-gray-100 dark:ring-gray-600'
                  : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
                  }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </div>

        {/* Audience Table Container */}
        <div className="bg-white dark:bg-[#1f2937] rounded-3xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm">

          {/* Table Header Overlay */}
          <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/50 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-6 bg-primary-500 rounded-full"></div>
              <h2 className="text-xl font-bold text-navy-900 dark:text-white tracking-tight">
                Audience Records <span className="text-primary-500 opacity-50 ml-1">({filteredCustomers.length})</span>
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSyncModalOpen(true)}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-navy-800 dark:text-white rounded-lg font-bold text-[10px] tracking-widest flex items-center gap-2 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all active:scale-95 shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                SYNC
              </button>

              <button
                onClick={() => setIsImportModalOpen(true)}
                className="px-4 py-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 text-navy-800 dark:text-white rounded-lg font-bold text-[10px] tracking-widest flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-gray-600 transition-all active:scale-95 shadow-sm"
              >
                <Upload className="w-3.5 h-3.5" />
                IMPORT
              </button>

              <button
                onClick={() => { /* Export logic */ }}
                className="p-2 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-all"
                title="Export Records"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Table Content */}
          <div className="p-2">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <div className="w-10 h-10 border-3 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-navy-900 font-bold uppercase tracking-widest text-[9px]">Assembling Audience...</p>
              </div>
            ) : filteredCustomers.length > 0 ? (
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-separate border-spacing-y-1.5">
                  <thead>
                    <tr className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                      <th className="px-6 py-3">Profile</th>
                      <th className="px-6 py-3">Phone</th>
                      <th className="px-6 py-3">Tags</th>
                      <th className="px-6 py-3">Status</th>
                      <th className="px-6 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map((customer) => (
                      <tr key={customer._id} className="group hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                        <td className="px-6 py-4 bg-white dark:bg-[#1f2937] rounded-l-2xl border-y border-l border-transparent group-hover:border-gray-100 dark:group-hover:border-gray-700">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/20 rounded-xl flex items-center justify-center font-bold text-primary-600">
                              {customer.name[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-bold text-navy-900 dark:text-white text-sm">{customer.name}</div>
                              <div className="text-[9px] font-medium text-gray-400 uppercase truncate max-w-[120px]">ID: {customer._id.slice(-8)}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 bg-white dark:bg-[#1f2937] border-y border-transparent group-hover:border-gray-100 dark:group-hover:border-gray-700">
                          <div className="flex items-center gap-2 font-medium text-gray-600 dark:text-gray-300 text-xs">
                            <Phone className="w-3 h-3 text-primary-400" />
                            {customer.phone}
                          </div>
                        </td>
                        <td className="px-6 py-4 bg-white dark:bg-[#1f2937] border-y border-transparent group-hover:border-gray-100 dark:group-hover:border-gray-700">
                          {customer.tags && customer.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {customer.tags.slice(0, 2).map((tag, index) => {
                                const lowerTag = tag.toLowerCase();
                                // Helper for consistent colors
                                const getTagStyle = (t) => {
                                  // ALL TAGS ARE AUTO-COLORED NOW

                                  // Dynamic Auto-Color based on char code
                                  const colors = [
                                    "bg-blue-100 text-blue-700 border-blue-200",
                                    "bg-emerald-100 text-emerald-700 border-emerald-200",
                                    "bg-indigo-100 text-indigo-700 border-indigo-200",
                                    "bg-pink-100 text-pink-700 border-pink-200",
                                    "bg-cyan-100 text-cyan-700 border-cyan-200",
                                    "bg-lime-100 text-lime-700 border-lime-200",
                                    "bg-orange-100 text-orange-700 border-orange-200",
                                    "bg-teal-100 text-teal-700 border-teal-200",
                                    "bg-purple-100 text-purple-700 border-purple-200",
                                    "bg-rose-100 text-rose-700 border-rose-200",
                                    "bg-amber-100 text-amber-700 border-amber-200"
                                  ];
                                  // Use sum of char codes to pick index
                                  const index = t.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
                                  return colors[index];
                                };

                                const tagStyle = getTagStyle(lowerTag);

                                return (
                                  <span
                                    key={index}
                                    className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border ${tagStyle}`}
                                  >
                                    {tag}
                                  </span>
                                );
                              })}
                              {customer.tags.length > 2 && (
                                <span className="px-2 py-0.5 bg-primary-500 text-navy-900 rounded text-[9px] font-bold uppercase">
                                  +{customer.tags.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-200 text-[9px] uppercase tracking-widest">None</span>
                          )}
                        </td>
                        <td className="px-6 py-4 bg-white dark:bg-[#1f2937] border-y border-transparent group-hover:border-gray-100 dark:group-hover:border-gray-700">
                          {getStatusBadge(customer.status)}
                        </td>
                        <td className="px-6 py-4 bg-white dark:bg-[#1f2937] rounded-r-2xl border-y border-r border-transparent group-hover:border-gray-100 dark:group-hover:border-gray-700">
                          <div className="flex gap-1.5">
                            <button
                              onClick={() => navigate('/chats', { state: { startChat: customer } })}
                              className="p-2 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-green-500 hover:text-white rounded-lg transition-all"
                              title="Start Chat"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleViewCustomer(customer)}
                              className="p-2 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-navy-900 hover:text-white rounded-lg transition-all"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleEditCustomer(customer)}
                              className="p-2 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-primary-500 hover:text-navy-900 rounded-lg transition-all"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteCustomer(customer)}
                              className="p-2 bg-gray-50 dark:bg-gray-800 text-gray-400 hover:bg-red-500 hover:text-white rounded-lg transition-all"
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
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mb-4">
                  <Users className="w-10 h-10 text-gray-200" />
                </div>
                <h3 className="text-xl font-bold text-navy-900 mb-1">No Audience Records Found</h3>
                <p className="text-gray-400 font-medium text-xs mb-6 max-w-[240px]">Start building your community by adding your first customer or syncing from live chat.</p>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                  }}
                  className="px-5 py-2.5 bg-navy-900 text-white rounded-lg font-bold text-[10px] tracking-widest hover:bg-navy-800 transition-all shadow-sm"
                >
                  Clear Filters
                </button>
              </div>
            )}
          </div>
        </div>
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
        title={`Purge Record: ${deletingCustomer?.name}`}
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

      {/* Sync from Chat Modal - REDESIGNED */}
      {isSyncModalOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-sm" onClick={() => setIsSyncModalOpen(false)}></div>
          <div className="relative bg-white dark:bg-[#1f2937] rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-300 border border-white/20 dark:border-gray-700">

            {/* Header */}
            <div className="bg-navy-900 px-8 py-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10">
                    <RefreshCw className={`w-6 h-6 text-primary-400 ${isLoadingSync ? 'animate-spin' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white leading-tight">Sync Contacts</h3>
                    <p className="text-xs font-medium text-gray-400">Import new pulses from WhatsApp</p>
                  </div>
                </div>
                <button onClick={() => setIsSyncModalOpen(false)} className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-all text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
              {isLoadingSync ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-navy-900 font-bold text-xs uppercase tracking-widest">Scanning Contacts...</p>
                </div>
              ) : syncContacts.length === 0 ? (
                <div className="text-center py-20 bg-gray-50 dark:bg-gray-800 rounded-2xl border-2 border-dashed border-gray-100 dark:border-gray-700">
                  <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4 opacity-30" />
                  <h4 className="text-lg font-bold text-navy-900 dark:text-white">Database Optimized</h4>
                  <p className="text-sm font-medium text-gray-400 max-w-[240px] mx-auto">All recent chat contacts are already in your audience list.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-6 px-4 py-3 bg-gray-50 rounded-xl border border-gray-100">
                    <span className="text-[10px] font-bold text-navy-900 uppercase tracking-widest">{syncContacts.length} FRESH CONTACTS</span>
                    <button
                      onClick={() => setSelectedSyncContacts(selectedSyncContacts.length === syncContacts.length ? [] : syncContacts.map(c => c.phone))}
                      className="text-[10px] font-bold text-primary-600 hover:text-primary-700 uppercase tracking-widest"
                    >
                      {selectedSyncContacts.length === syncContacts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>

                  {syncContacts.map(contact => (
                    <div
                      key={contact.phone}
                      onClick={() => {
                        setSelectedSyncContacts(prev => prev.includes(contact.phone) ? prev.filter(p => p !== contact.phone) : [...prev, contact.phone]);
                      }}
                      className={`group p-4 rounded-2xl border transition-all flex items-center justify-between cursor-pointer ${selectedSyncContacts.includes(contact.phone)
                        ? 'border-primary-500 bg-primary-50/20 shadow-sm'
                        : 'border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-primary-200'
                        }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg transition-all ${selectedSyncContacts.includes(contact.phone)
                          ? 'bg-primary-500 text-navy-900'
                          : 'bg-gray-100 text-gray-400'
                          }`}>
                          {contact.name[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-navy-900 text-sm">{contact.name}</p>
                          <p className="text-[10px] font-medium text-gray-400">+{contact.phone}</p>
                        </div>
                      </div>
                      <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedSyncContacts.includes(contact.phone)
                        ? 'bg-primary-500 border-primary-500'
                        : 'border-gray-200'
                        }`}>
                        {selectedSyncContacts.includes(contact.phone) && <CheckCircle2 className="w-4 h-4 text-navy-900" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="p-8 pt-0 flex flex-col gap-2">
              <button
                onClick={handleSyncSubmit}
                disabled={selectedSyncContacts.length === 0 || isSyncing}
                className="w-full py-4 bg-navy-900 text-white rounded-xl font-bold text-base hover:bg-navy-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-navy-900/10 disabled:opacity-50"
              >
                {isSyncing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save {selectedSyncContacts.length} Contacts
                  </>
                )}
              </button>
              <button
                onClick={() => setIsSyncModalOpen(false)}
                className="w-full py-2 font-bold text-[10px] text-gray-400 hover:text-navy-900 transition-colors uppercase tracking-widest"
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
