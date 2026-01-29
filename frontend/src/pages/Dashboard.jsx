// frontend/src/pages/Dashboard.jsx
import { useState, useEffect } from 'react';
import { Plus, Users, Send, Megaphone, CheckCircle, TrendingUp, Eye, Download, Trash2, Filter, ClipboardList, Target } from 'lucide-react';
import axios from '../utils/axios';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get user role from localStorage
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'admin';

  // Load data on mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch stats and broadcasts in parallel
      const [statsRes, broadcastsRes, customersRes] = await Promise.all([
        axios.get('/broadcasts/stats'),
        axios.get('/broadcasts?limit=5'),
        axios.get('/customers/stats/summary')
      ]);

      // Set stats
      const broadcastStats = statsRes.data.data;
      const customerStats = customersRes.data.data;

      setStats({
        broadcasts: broadcastStats,
        customers: customerStats
      });

      // Set broadcasts
      setBroadcasts(broadcastsRes.data.data || []);

    } catch (err) {
      console.error('Failed to load dashboard data:', err);
      setError(err.response?.data?.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // Build stat cards based on loaded data
  const getStatCards = () => {
    if (!stats) return [];

    if (isAdmin) {
      return [
        {
          label: 'Total Customers',
          value: stats.customers.total.toLocaleString(),
          icon: Users,
          trend: stats.customers.growthRate
            ? `${stats.customers.growthRate > 0 ? '+' : ''}${stats.customers.growthRate}% from last month`
            : null,
          trendUp: stats.customers.growthRate > 0,
        },
        {
          label: 'Today Messages',
          value: stats.broadcasts.todayMessages.toLocaleString(),
          icon: Send,
          subtitle: `${stats.customers.active} active customers`,
        },
        {
          label: 'Active Campaigns',
          value: stats.broadcasts.active.toString(),
          icon: Megaphone,
          subtitle: `${stats.broadcasts.completed} completed`,
        },
        {
          label: 'Success Rate',
          value: `${stats.broadcasts.successRate}%`,
          icon: CheckCircle,
          trend: stats.broadcasts.successRate >= 95 ? 'Excellent' : 'Good',
          trendUp: true,
        },
      ];
    } else {
      return [
        {
          label: 'My Active Campaigns',
          value: stats.broadcasts.active.toString(),
          icon: Target,
          subtitle: `${stats.broadcasts.completed} completed`,
        },
        {
          label: 'Messages Sent Today',
          value: stats.broadcasts.todayMessages.toLocaleString(),
          icon: Send,
          subtitle: `${stats.broadcasts.total} total campaigns`,
        },
        {
          label: 'My Customers',
          value: stats.customers.total.toLocaleString(),
          icon: Users,
          subtitle: `${stats.customers.active} active`,
        },
        {
          label: 'My Success Rate',
          value: `${stats.broadcasts.successRate}%`,
          icon: CheckCircle,
          trend: stats.broadcasts.successRate >= 95 ? 'Excellent' : 'Good',
          trendUp: true,
        },
      ];
    }
  };

  const getStatusBadge = (status) => {
    const configs = {
      'on-process': {
        bg: 'bg-yellow-100',
        text: 'text-yellow-800',
        border: 'border-yellow-200',
        label: 'On Process',
      },
      'completed': {
        bg: 'bg-green-100',
        text: 'text-green-800',
        border: 'border-green-200',
        label: 'Completed',
      },
      'scheduled': {
        bg: 'bg-blue-100',
        text: 'text-blue-800',
        border: 'border-blue-200',
        label: 'Scheduled',
      },
      'draft': {
        bg: 'bg-gray-100',
        text: 'text-gray-800',
        border: 'border-gray-200',
        label: 'Draft',
      },
      'paused': {
        bg: 'bg-orange-100',
        text: 'text-orange-800',
        border: 'border-orange-200',
        label: 'Paused',
      },
      'failed': {
        bg: 'bg-red-100',
        text: 'text-red-800',
        border: 'border-red-200',
        label: 'Failed',
      },
    };

    const config = configs[status] || configs['draft'];

    return (
      <span className={`badge ${config.bg} ${config.text} ${config.border}`}>
        <CheckCircle className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const handleDeleteBroadcast = async (id) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;

    try {
      await axios.delete(`/broadcasts/${id}`);
      setBroadcasts(broadcasts.filter(b => b._id !== id));
    } catch (err) {
      console.error('Failed to delete broadcast:', err);
      alert('Failed to delete broadcast');
    }
  };

  return (
    <div className="animate-slide-in">

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 dark:text-white tracking-tight mb-1">
              {isAdmin ? 'Dashboard' : 'My Dashboard'}
            </h1>
            <p className="text-base text-gray-600 dark:text-gray-300 font-medium">
              {isAdmin
                ? "Welcome back! Here's what's happening with your broadcasts today."
                : "Welcome back! Here's your personal broadcast activity today."
              }
            </p>
          </div>

          {/* New Broadcast Button */}
          <button className="btn btn-primary">
            <Plus className="w-5 h-5" />
            <span>New Broadcast</span>
          </button>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading dashboard...</p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border-2 border-red-200 rounded-xl p-6 mb-8">
          <h3 className="text-red-800 font-bold mb-2">Error Loading Dashboard</h3>
          <p className="text-red-600">{error}</p>
          <button
            onClick={loadDashboardData}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Cards Grid */}
      {!loading && !error && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            {getStatCards().map((stat, index) => {
              const Icon = stat.icon;

              return (
                <div key={index} className="stat-card bg-white dark:bg-[#1f2937] border dark:border-gray-700">
                  {/* Icon Container */}
                  <div className="relative z-10 mb-4">
                    <div className="w-14 h-14 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-sm">
                      <Icon className="w-7 h-7 text-primary-500" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="relative z-10">
                    <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold mb-2">
                      {stat.label}
                    </div>

                    <div className="text-4xl font-black text-navy-800 dark:text-white tracking-tight mb-3">
                      {stat.value}
                    </div>

                    {/* Trend or Subtitle */}
                    {stat.trend && (
                      <div className="flex items-center gap-1.5 text-sm font-bold text-green-600">
                        <TrendingUp className="w-4 h-4" />
                        <span>{stat.trend}</span>
                      </div>
                    )}

                    {stat.subtitle && (
                      <div className="text-sm text-gray-600 dark:text-gray-400 font-semibold">
                        {stat.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Broadcast Schedule Table */}
          <div className="card p-7 bg-white dark:bg-[#1f2937] border dark:border-gray-700">

            {/* Table Header */}
            <div className="flex items-center justify-between mb-7">
              <h2 className="text-2xl font-black text-navy-800 dark:text-white tracking-tight">
                {isAdmin ? 'Recent Broadcasts' : 'My Recent Broadcasts'}
              </h2>

              <div className="flex gap-3">
                <button className="btn btn-secondary">
                  <Filter className="w-4 h-4" />
                  <span>Filter</span>
                </button>

                <button className="bg-navy-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-navy-700 transition-colors shadow-md">
                  <Download className="w-4 h-4" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {/* Table */}
            {broadcasts.length > 0 ? (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Campaign Name</th>
                      <th>Status</th>
                      <th>Sent</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((broadcast) => (
                      <tr key={broadcast._id}>
                        <td>
                          <div className="font-bold text-navy-800 dark:text-white mb-1">
                            {broadcast.name}
                          </div>
                          <div className="text-xs text-gray-400">
                            ID: {broadcast._id.substring(0, 8)}...
                          </div>
                        </td>
                        <td>
                          {getStatusBadge(broadcast.status)}
                        </td>
                        <td className="font-medium text-gray-700 dark:text-gray-300">
                          {broadcast.successCount + broadcast.failedCount} / {broadcast.totalRecipients}
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <button className="btn-icon" title="View">
                              <Eye className="w-4 h-4" />
                            </button>
                            {broadcast.status === 'completed' && (
                              <button className="btn-icon" title="Download Report">
                                <Download className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDeleteBroadcast(broadcast._id)}
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
                <Megaphone className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                <h3 className="text-lg font-bold text-gray-900 mb-2">No broadcasts yet</h3>
                <p className="text-gray-600 font-medium mb-4">Create your first broadcast campaign to get started</p>
                <button className="btn btn-primary">
                  <Plus className="w-5 h-5" />
                  <span>New Broadcast</span>
                </button>
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}