// frontend/src/pages/Broadcast.jsx - ✅ CLEAN SLEEK UI + REAL-TIME PROGRESS
import { useState, useEffect, useRef } from 'react';
import axios from '../utils/axios';
import { io } from 'socket.io-client';
import {
  Plus, Search, Filter, Download, MoreVertical,
  Play, Pause, Trash2, CheckCircle, AlertCircle,
  Clock, Send, X, FileText, ChevronRight, Activity,
  TrendingUp, Loader2, Target, Calendar, Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import BroadcastForm from '../components/BroadcastForm';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export default function Broadcast() {
  const [broadcasts, setBroadcasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBroadcast, setSelectedBroadcast] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
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
      if (data.success) {
        const broadcastsData = data.data || [];
        setBroadcasts(broadcastsData);

        const total = broadcastsData.length;
        const running = broadcastsData.filter(b => b.status === 'on-process').length;
        const completed = broadcastsData.filter(b => b.status === 'completed').length;
        const failed = broadcastsData.filter(b => b.status === 'failed').length;

        setStats({ total, running, completed, failed });
      }
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
    }, 30000);

    // 🔌 SOCKET LISTENER
    const socket = io(API_URL.replace('/api', ''), {
      withCredentials: true
    });

    socket.on('broadcast_progress', (data) => {
      setBroadcasts(prev => prev.map(b =>
        b._id === data.broadcastId
          ? {
            ...b,
            successCount: data.successCount,
            failedCount: data.failedCount,
            lastRecipientNumber: data.lastRecipient,
            status: data.status || b.status
          }
          : b
      ));
    });

    return () => {
      clearInterval(interval);
      socket.disconnect();
    };
  }, []);

  const handlePause = async (id) => {
    try {
      await axios.post(`/broadcasts/${id}/pause`);
      toast.success('Broadcast paused');
      fetchBroadcasts(true);
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleResume = async (id) => {
    try {
      await axios.post(`/broadcasts/${id}/resume`);
      toast.success('Broadcast resumed');
      fetchBroadcasts(true);
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure?')) return;
    try {
      await axios.delete(`/broadcasts/${id}`);
      toast.success('Broadcast deleted');
      fetchBroadcasts(true);
    } catch (error) {
      toast.error('Failed');
    }
  };

  const handleExport = () => {
    const headers = ['Name', 'Status', 'Recipients', 'Success', 'Failed', 'Date'];
    const rows = filteredBroadcasts.map(b => [
      b.name, b.status, b.totalRecipients, b.successCount, b.failedCount, new Date(b.createdAt).toLocaleDateString()
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `broadcasts.csv`;
    a.click();
  };

  const filteredBroadcasts = broadcasts.filter(b => {
    const matchesStatus = filterStatus === 'all' || b.status === filterStatus;
    const matchesSearch = b.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    const configs = {
      'draft': { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Draft' },
      'scheduled': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Scheduled' },
      'on-process': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Sending' },
      'completed': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      'paused': { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Paused' },
      'failed': { bg: 'bg-red-100', text: 'text-red-800', label: 'Failed' }
    };
    const config = configs[status] || configs.draft;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${config.bg} ${config.text}`}>
        {status === 'on-process' && <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />}
        {config.label}
      </span>
    );
  };

  return (
    <div className="animate-slide-in">
      {/* Page Header */}
      <div className="mb-8 p-4">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1">
              Broadcast Center
            </h1>
            <p className="text-base text-gray-600 font-medium">
              Manage your broadcast operations efficiently
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 px-3 py-1 bg-green-50 text-green-600 rounded-full font-bold text-xs border border-green-200">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Active
            </span>
            <BroadcastForm onCreated={fetchBroadcasts} />
          </div>
        </div>
      </div>

      {/* Stats Cards Grid - CLEAN VERSION */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10 px-4">
        {[
          { label: 'Total Campaigns', value: stats.total, icon: Target },
          { label: 'Running', value: stats.running, icon: Activity, active: true },
          { label: 'Completed', value: stats.completed, icon: CheckCircle },
          { label: 'Total Recipients', value: broadcasts.reduce((acc, b) => acc + (b.totalRecipients || 0), 0), icon: Users }
        ].map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="stat-card">
              <div className="relative z-10 mb-4">
                <div className="w-14 h-14 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-sm">
                  <Icon className={`w-7 h-7 ${stat.active ? 'text-green-600' : 'text-primary-500'}`} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-sm text-gray-600 font-semibold mb-2">{stat.label}</div>
                <div className="text-4xl font-black text-navy-800 tracking-tight mb-1">{stat.value}</div>
                {stat.active && (
                  <div className="flex items-center gap-1.5 text-xs font-bold text-green-600">
                    <TrendingUp className="w-3 h-3" />
                    <span>active</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Broadcasts Table - CLEAN VERSION */}
      <div className="card m-4 p-7">
        <div className="flex items-center justify-between mb-7">
          <h2 className="text-2xl font-black text-navy-800 tracking-tight">All Campaigns</h2>
          <div className="flex flex-wrap gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search campaigns..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2.5 border-2 border-gray-100 rounded-xl font-semibold text-gray-700 focus:border-primary-500 focus:outline-none transition-all w-64 bg-gray-50/50"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-100 rounded-xl font-semibold text-gray-700 bg-white"
            >
              <option value="all">All Status</option>
              {['draft', 'scheduled', 'on-process', 'completed', 'paused', 'failed'].map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
            <button onClick={handleExport} className="bg-navy-900 border border-navy-800 text-white px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 hover:bg-navy-800 transition-all shadow-lg active:scale-95">
              <Download className="w-4 h-4" />
              <span>Export</span>
            </button>
          </div>
        </div>

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
              {loading ? (
                <tr><td colSpan="6" className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-500" /></td></tr>
              ) : filteredBroadcasts.length === 0 ? (
                <tr><td colSpan="6" className="text-center py-20 text-gray-500 font-bold">No campaigns found</td></tr>
              ) : filteredBroadcasts.map((b) => {
                const totalSent = b.successCount + b.failedCount;
                const progress = b.totalRecipients > 0 ? Math.round((totalSent / b.totalRecipients) * 100) : 0;
                const successRate = totalSent > 0 ? Math.round((b.successCount / totalSent) * 100) : 0;

                return (
                  <tr key={b._id}>
                    <td>
                      <div className="font-bold text-navy-800 mb-1">{b.name}</div>
                      <div className="text-xs text-gray-400 font-medium uppercase tracking-tighter">{b.totalRecipients} recipients</div>
                    </td>
                    <td>{getStatusBadge(b.status)}</td>
                    <td>
                      <div className="flex flex-col gap-1.5 min-w-[150px]">
                        <div className="flex justify-between text-[11px] font-bold">
                          <span className="text-gray-400">{totalSent} / {b.totalRecipients} sent</span>
                          <span className="text-navy-900">{progress}%</span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 rounded-full ${b.status === 'on-process' ? 'bg-primary-500 shadow-[0_0_8px_rgba(59,130,246,0.3)]' : 'bg-green-500'}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        {/* 🎯 "SENDING TO" STATUS AREA */}
                        {b.status === 'on-process' && b.lastRecipientNumber && (
                          <div className="flex items-center gap-1.5 animate-pulse">
                            <Activity className="w-3.5 h-3.5 text-primary-500" />
                            <span className="text-[10px] font-bold text-primary-600">Sending to: {b.lastRecipientNumber}</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="font-bold text-navy-800">{totalSent > 0 ? `${successRate}%` : '-'}</td>
                    <td className="text-sm text-gray-600 font-medium">{new Date(b.createdAt).toLocaleDateString()}</td>
                    <td>
                      <div className="flex gap-2">
                        <button onClick={() => { setSelectedBroadcast(b); setShowDetailModal(true); }} className="btn-icon hover:bg-blue-50" title="Details">
                          <FileText className="w-4 h-4 text-blue-600" />
                        </button>
                        {b.status === 'on-process' && (
                          <button onClick={() => handlePause(b._id)} className="btn-icon hover:bg-yellow-50" title="Pause">
                            <Pause className="w-4 h-4 text-yellow-600" />
                          </button>
                        )}
                        {b.status === 'paused' && (
                          <button onClick={() => handleResume(b._id)} className="btn-icon hover:bg-green-50" title="Resume">
                            <Play className="w-4 h-4 text-green-600" />
                          </button>
                        )}
                        <button onClick={() => handleDelete(b._id)} className="btn-icon hover:bg-red-50" title="Delete">
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
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedBroadcast && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[85vh] overflow-hidden shadow-2xl flex flex-col">
            <div className="bg-gradient-to-r from-navy-900 to-navy-800 px-8 py-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{selectedBroadcast.name}</h3>
                  <p className="text-sm text-gray-300 font-medium">Campaign Analytics</p>
                </div>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-8 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                {[
                  { label: 'Total', value: selectedBroadcast.totalRecipients },
                  { label: 'Success', value: selectedBroadcast.successCount, color: 'text-green-600' },
                  { label: 'Failed', value: selectedBroadcast.failedCount, color: 'text-red-500' },
                  { label: 'Pending', value: selectedBroadcast.totalRecipients - (selectedBroadcast.successCount + selectedBroadcast.failedCount) }
                ].map((s, i) => (
                  <div key={i} className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase mb-1">{s.label}</p>
                    <p className={`text-2xl font-black ${s.color || 'text-navy-900'}`}>{s.value}</p>
                  </div>
                ))}
              </div>
              <div className="bg-gray-50 rounded-2xl p-6 mb-4">
                <h4 className="text-sm font-black text-navy-800 mb-4 uppercase tracking-widest">Message Preview</h4>
                <p className="text-gray-700 whitespace-pre-wrap font-medium">{selectedBroadcast.message}</p>
              </div>
            </div>

            <div className="px-8 py-5 border-t border-gray-100 flex justify-end">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-8 py-3 bg-navy-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg active:scale-95"
              >
                Close Dashboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}