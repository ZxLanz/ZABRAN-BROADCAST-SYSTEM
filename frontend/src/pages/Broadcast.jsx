// frontend/src/pages/Broadcast.jsx - ✅ WITH INSTANT NOTIFICATIONS
import { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Trash2, Filter, Download, 
  CheckCircle, Clock, AlertCircle, Loader2,
  TrendingUp, Users, Send, Target, Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';
import BroadcastForm from '../components/BroadcastForm';
import axios from '../utils/axios';

export default function Broadcasts() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    running: 0,
    completed: 0,
    failed: 0
  });
  
  const isInitialLoad = useRef(true);

  const fetchBroadcasts = async (silent = false) => {
    try {
      if (!silent && isInitialLoad.current) {
        setLoading(true);
      }
      
      const { data } = await axios.get('/broadcasts');
      setBroadcasts(data.data || []);
      
      const total = data.data?.length || 0;
      const running = data.data?.filter(b => b.status === 'on-process').length || 0;
      const completed = data.data?.filter(b => b.status === 'completed').length || 0;
      const failed = data.data?.filter(b => b.status === 'failed').length || 0;
      
      setStats({ total, running, completed, failed });
    } catch (error) {
      console.error('Fetch broadcasts error:', error);
      if (!silent) {
        toast.error('Failed to load broadcasts');
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
      isInitialLoad.current = false;
    }
  };

  useEffect(() => {
    fetchBroadcasts();
    
    const interval = setInterval(() => {
      fetchBroadcasts(true);
    }, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const handlePause = async (id) => {
    try {
      await axios.post(`/broadcasts/${id}/pause`);
      toast.success('Broadcast paused successfully');
      fetchBroadcasts(true);
      
      // 🔔 TRIGGER INSTANT NOTIFICATION REFRESH
      console.log('🔔 Pause: Dispatching refreshNotifications event...');
      window.dispatchEvent(new Event('refreshNotifications'));
    } catch (error) {
      console.error('Pause error:', error);
      toast.error(error.response?.data?.message || 'Failed to pause broadcast');
    }
  };

  const handleResume = async (id) => {
    try {
      await axios.post(`/broadcasts/${id}/resume`);
      toast.success('Broadcast resumed successfully');
      fetchBroadcasts(true);
      
      // 🔔 TRIGGER INSTANT NOTIFICATION REFRESH
      console.log('🔔 Resume: Dispatching refreshNotifications event...');
      window.dispatchEvent(new Event('refreshNotifications'));
    } catch (error) {
      console.error('Resume error:', error);
      toast.error(error.response?.data?.message || 'Failed to resume broadcast');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) return;
    
    try {
      await axios.delete(`/broadcasts/${id}`);
      toast.success('Broadcast deleted successfully');
      fetchBroadcasts(true);
      
      // 🔔 TRIGGER INSTANT NOTIFICATION REFRESH
      console.log('🔔 Delete: Dispatching refreshNotifications event...');
      window.dispatchEvent(new Event('refreshNotifications'));
    } catch (error) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.message || 'Failed to delete broadcast');
    }
  };

  const getTimeRemaining = (sendAt) => {
    const now = new Date();
    const scheduledTime = new Date(sendAt);
    const diffMs = scheduledTime - now;
    
    if (diffMs <= 0) return 'Starting soon';
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffDays > 0) return `in ${diffDays}d ${diffHours % 24}h`;
    if (diffHours > 0) return `in ${diffHours}h ${diffMins % 60}m`;
    return `in ${diffMins}m`;
  };

  const getStatusBadge = (status) => {
    const configs = {
      'draft': { bg: 'bg-gray-100', text: 'text-gray-800', icon: Clock, label: 'Draft' },
      'scheduled': { bg: 'bg-blue-100', text: 'text-blue-800', icon: Clock, label: 'Scheduled' },
      'on-process': { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Loader2, label: 'Sending' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', icon: CheckCircle, label: 'Completed' },
      'paused': { bg: 'bg-orange-100', text: 'text-orange-800', icon: Pause, label: 'Paused' },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', icon: AlertCircle, label: 'Failed' }
    };

    const config = configs[status] || configs['draft'];
    const Icon = config.icon;

    return (
      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        <Icon className={`w-3.5 h-3.5 ${status === 'on-process' ? 'animate-spin' : ''}`} />
        {config.label}
      </span>
    );
  };

  const filteredBroadcasts = filterStatus === 'all' 
    ? broadcasts 
    : broadcasts.filter(b => b.status === filterStatus);

  const statsCards = [
    {
      label: 'Total Campaigns',
      value: stats.total,
      icon: Target,
      trend: null
    },
    {
      label: 'Running Now',
      value: stats.running,
      icon: Send,
      trend: stats.running > 0 ? 'active' : null
    },
    {
      label: 'Completed',
      value: stats.completed,
      icon: CheckCircle,
      trend: stats.completed > 0 ? `${Math.round((stats.completed / stats.total) * 100)}% done` : null
    },
    {
      label: 'Total Recipients',
      value: broadcasts.reduce((acc, b) => acc + (b.totalRecipients || 0), 0),
      icon: Users,
      trend: null
    }
  ];

  return (
    <div className="animate-slide-in">
      
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1">
              Broadcasts
            </h1>
            <p className="text-base text-gray-600 font-medium">
              Create, schedule, and monitor your WhatsApp broadcast campaigns
            </p>
          </div>

          <BroadcastForm onCreated={fetchBroadcasts} />
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        {statsCards.map((stat, index) => {
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
              </div>
            </div>
          );
        })}
      </div>

      {/* Broadcasts Table */}
      <div className="card p-7">
        
        {/* Table Header */}
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl font-black text-navy-800 tracking-tight">
            All Campaigns
          </h2>

          <div className="flex gap-3">
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:border-primary-500 transition-colors"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="on-process">Sending</option>
              <option value="completed">Completed</option>
              <option value="paused">Paused</option>
              <option value="failed">Failed</option>
            </select>
            
            <button className="bg-navy-800 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-navy-700 transition-colors shadow-md">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
          </div>
        )}

        {!loading && filteredBroadcasts.length === 0 && (
          <div className="text-center py-20">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-800 mb-2">
              No broadcasts found
            </h3>
            <p className="text-gray-600 mb-6">
              {filterStatus === 'all' 
                ? 'Create your first broadcast to get started' 
                : `No broadcasts found with status: ${filterStatus}`}
            </p>
            {filterStatus === 'all' && <BroadcastForm onCreated={fetchBroadcasts} />}
          </div>
        )}

        {!loading && filteredBroadcasts.length > 0 && (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Campaign Name</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th>Success Rate</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBroadcasts.map((broadcast) => {
                  const progress = broadcast.totalRecipients > 0 
                    ? Math.round(((broadcast.successCount + broadcast.failedCount) / broadcast.totalRecipients) * 100)
                    : 0;
                  
                  const successRate = broadcast.successCount > 0
                    ? Math.round((broadcast.successCount / (broadcast.successCount + broadcast.failedCount)) * 100)
                    : 0;

                  return (
                    <tr key={broadcast._id}>
                      <td>
                        <div className="font-bold text-navy-800 mb-1">
                          {broadcast.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {broadcast.totalRecipients} recipients
                        </div>
                      </td>
                      
                      <td>
                        <div className="space-y-1">
                          {getStatusBadge(broadcast.status)}
                          
                          {broadcast.status === 'scheduled' && broadcast.sendAt && (
                            <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                              <Calendar className="w-3 h-3" />
                              <span className="font-medium">
                                {getTimeRemaining(broadcast.sendAt)}
                              </span>
                            </div>
                          )}
                          
                          {broadcast.status === 'scheduled' && broadcast.sendAt && (
                            <div className="text-xs text-gray-500">
                              {new Date(broadcast.sendAt).toLocaleString('en-US', {
                                dateStyle: 'short',
                                timeStyle: 'short'
                              })}
                            </div>
                          )}
                        </div>
                      </td>

                      <td>
                        <div className="flex items-center gap-3">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div 
                              className="bg-primary-500 h-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold text-gray-700 min-w-[3rem] text-right">
                            {progress}%
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {broadcast.successCount + broadcast.failedCount} / {broadcast.totalRecipients} sent
                        </div>
                      </td>

                      <td className="font-medium text-gray-700">
                        {broadcast.successCount + broadcast.failedCount > 0 ? (
                          <span className={successRate >= 90 ? 'text-green-600' : successRate >= 70 ? 'text-yellow-600' : 'text-red-600'}>
                            {successRate}%
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>

                      <td className="text-sm text-gray-600">
                        {new Date(broadcast.createdAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </td>

                      <td>
                        <div className="flex gap-2">
                          {broadcast.status === 'on-process' && (
                            <button 
                              onClick={() => handlePause(broadcast._id)}
                              className="btn-icon hover:bg-yellow-100"
                              title="Pause"
                            >
                              <Pause className="w-4 h-4 text-yellow-600" />
                            </button>
                          )}
                          
                          {broadcast.status === 'paused' && (
                            <button 
                              onClick={() => handleResume(broadcast._id)}
                              className="btn-icon hover:bg-green-100"
                              title="Resume"
                            >
                              <Play className="w-4 h-4 text-green-600" />
                            </button>
                          )}

                          <button 
                            onClick={() => handleDelete(broadcast._id)}
                            className="btn-icon hover:bg-red-100"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}