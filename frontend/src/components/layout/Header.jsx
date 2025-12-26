// frontend/src/components/layout/Header.jsx - ✅ OPTIMIZED + NO SCROLLBAR
import { Bell, User, Settings, LogOut, ChevronDown, Loader2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWhatsApp } from '../../contexts/WhatsAppContext';
import { useNavigate } from 'react-router-dom';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';

export default function Header() {
  const { user, logout } = useAuth();
  const { status, deviceInfo } = useWhatsApp();
  const navigate = useNavigate();
  
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  
  // ✅ Notifications state
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  
  const userMenuRef = useRef(null);
  const settingsMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const pollIntervalRef = useRef(null);

  // ✅ Wait for initial WhatsApp status check
  useEffect(() => {
    if (status && status !== 'connecting') {
      setIsInitialLoading(false);
    }
  }, [status]);

  // ✅ Fetch notifications from API
  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const { data } = await axios.get('/notifications');
      setNotifications(data.data || []);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Failed to load notifications');
      }
    } finally {
      setNotificationsLoading(false);
    }
  };

  // ✅ OPTIMIZED: Polling 30 seconds (was 10s)
  useEffect(() => {
    fetchNotifications();

    pollIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, 30000); // ✅ 30 seconds (was 10s)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  // 🔔 INSTANT REFRESH - Listen for custom event
  useEffect(() => {
    const handleRefreshNotifications = () => {
      console.log('🔔 Instant notification refresh triggered!');
      fetchNotifications();
    };

    window.addEventListener('refreshNotifications', handleRefreshNotifications);
    
    return () => {
      window.removeEventListener('refreshNotifications', handleRefreshNotifications);
    };
  }, []);

  // ✅ Mark notification as read
  const markAsRead = async (notifId) => {
    try {
      await axios.patch(`/notifications/${notifId}/read`);
      
      setNotifications(prev => 
        prev.map(n => n._id === notifId ? { ...n, unread: false } : n)
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Failed to mark as read');
    }
  };

  // ✅ Mark all as read
  const markAllAsRead = async () => {
    try {
      await axios.patch('/notifications/read-all');
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, unread: false }))
      );
      
      toast.success('All notifications marked as read');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Failed to mark all as read');
    }
  };

  // ✅ Clear all notifications
  const clearAllNotifications = async () => {
    try {
      await axios.delete('/notifications/clear');
      
      setNotifications([]);
      setShowNotifications(false);
      
      toast.success('All notifications cleared');
    } catch (err) {
      console.error('Error clearing notifications:', err);
      toast.error('Failed to clear notifications');
    }
  };

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setShowSettingsMenu(false);
      }
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get status color and text
  const getStatusDisplay = () => {
    if (isInitialLoading) {
      return {
        color: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
        dot: 'bg-gray-400',
        text: 'Checking...',
        isLoading: true
      };
    }

    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500/10 border-green-500/30 text-green-400',
          dot: 'bg-green-400',
          text: deviceInfo?.name || 'Connected',
          isLoading: false
        };
      case 'connecting':
        return {
          color: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
          dot: 'bg-blue-400 animate-pulse',
          text: 'Connecting...',
          isLoading: false
        };
      case 'qrcode':
        return {
          color: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400',
          dot: 'bg-yellow-400',
          text: 'Scan QR',
          isLoading: false
        };
      default:
        return {
          color: 'bg-red-500/10 border-red-500/30 text-red-400',
          dot: 'bg-red-400',
          text: 'Disconnected',
          isLoading: false
        };
    }
  };

  const statusDisplay = getStatusDisplay();
  const unreadCount = notifications.filter(n => n.unread).length;

  // ✅ Format time ago
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  };

  return (
    <header className="bg-navy-800 text-white shadow-md sticky top-0 z-30">
      <div className="w-full px-8 py-4">
        <div className="flex justify-between items-center">
          
          {/* Left Side - Logo/Brand */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight">
                <span className="text-white">Z</span>
                <span className="text-primary-500">A</span>
                <span className="text-white">BR</span>
                <span className="text-primary-500">A</span>
                <span className="text-white">N</span>
              </span>
            </div>
            <div className="text-xs text-gray-400 uppercase tracking-wider font-medium">
              Broadcast System
            </div>
          </div>

          {/* Right Side - Actions */}
          <div className="flex items-center gap-4">
            
            {/* WhatsApp Connection Status */}
            <button
              onClick={() => navigate('/whatsapp')}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium
                transition-all hover:scale-105
                ${statusDisplay.color}
              `}
            >
              {statusDisplay.isLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <div className={`w-2 h-2 rounded-full ${statusDisplay.dot}`}></div>
              )}
              <span>{statusDisplay.text}</span>
            </button>

            {/* Notification Bell */}
            <div className="relative" ref={notifMenuRef}>
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-gray-700 transition-all duration-200 hover:border-primary-500/50"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center border-2 border-navy-800">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-80 bg-navy-700 rounded-lg shadow-xl border border-gray-600 overflow-hidden">
                  
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-600 flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllAsRead}
                        className="text-xs text-primary-400 hover:text-primary-300"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* ✅ Notifications List - NO SCROLLBAR */}
                  <div className="max-h-96 overflow-y-auto scrollbar-hide">
                    {notificationsLoading ? (
                      <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading...
                      </div>
                    ) : notifications.length === 0 ? (
                      <div className="px-4 py-8 text-center text-gray-400 text-sm">
                        No notifications yet
                      </div>
                    ) : (
                      notifications.map((notif) => (
                        <div
                          key={notif._id}
                          onClick={() => markAsRead(notif._id)}
                          className={`px-4 py-3 hover:bg-white/5 cursor-pointer border-b border-gray-700/50 transition-colors ${
                            notif.unread ? 'bg-primary-500/5' : ''
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {notif.unread && (
                              <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{notif.title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">{notif.message}</p>
                              <p className="text-xs text-gray-500 mt-1">{timeAgo(notif.createdAt)}</p>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Footer */}
                  <div className="px-4 py-2 border-t border-gray-600 flex items-center justify-between gap-2">
                    <button 
                      onClick={() => {
                        navigate('/notifications');
                        setShowNotifications(false);
                      }}
                      className="text-xs text-primary-400 hover:text-primary-300 flex-1 text-center py-1"
                    >
                      View all notifications
                    </button>
                    {notifications.length > 0 && (
                      <>
                        <div className="w-px h-4 bg-gray-600"></div>
                        <button 
                          onClick={clearAllNotifications}
                          className="text-xs text-red-400 hover:text-red-300 flex-1 text-center py-1"
                        >
                          Clear all
                        </button>
                      </>
                    )}
                  </div>

                </div>
              )}
            </div>

            {/* User Profile */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="flex items-center gap-2 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-gray-700 transition-all duration-200 hover:border-primary-500/50"
              >
                <User className="w-5 h-5" />
                <ChevronDown className="w-4 h-4" />
              </button>

              {/* User Dropdown */}
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-64 bg-navy-700 rounded-lg shadow-xl border border-gray-600 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-600">
                    <p className="font-semibold text-sm">{user?.name || 'User'}</p>
                    <p className="text-xs text-gray-400">{user?.email || 'user@example.com'}</p>
                    <span className={`inline-block mt-2 px-2 py-1 text-xs rounded ${
                      user?.role === 'admin' 
                        ? 'bg-primary-500/20 text-primary-300' 
                        : 'bg-gray-600/50 text-gray-300'
                    }`}>
                      {user?.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>
                  <div className="py-2">
                    <button
                      onClick={() => {
                        navigate('/profile');
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-white/5 flex items-center gap-3"
                    >
                      <User className="w-4 h-4" />
                      My Profile
                    </button>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-white/5 flex items-center gap-3 text-red-400"
                    >
                      <LogOut className="w-4 h-4" />
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Settings */}
            <div className="relative" ref={settingsMenuRef}>
              <button 
                onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                className="p-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-gray-700 transition-all duration-200 hover:border-primary-500/50"
              >
                <Settings className="w-5 h-5" />
              </button>

              {/* Settings Dropdown */}
              {showSettingsMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-navy-700 rounded-lg shadow-xl border border-gray-600 overflow-hidden">
                  <div className="py-2">
                    <button
                      onClick={() => {
                        navigate('/settings');
                        setShowSettingsMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-white/5"
                    >
                      General Settings
                    </button>
                    <button
                      onClick={() => {
                        navigate('/whatsapp');
                        setShowSettingsMenu(false);
                      }}
                      className="w-full px-4 py-2 text-sm text-left hover:bg-white/5"
                    >
                      WhatsApp Settings
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

        </div>
      </div>
    </header>
  );
}