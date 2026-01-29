// frontend/src/components/layout/Header.jsx
import { Bell, User, Settings, LogOut, ChevronDown, Loader2, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWhatsApp } from '../../contexts/WhatsAppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';
import { initSocket, disconnectSocket } from '../../utils/socket';

export default function Header() {
  const { user, logout } = useAuth();
  const { status, deviceInfo } = useWhatsApp();
  const navigate = useNavigate();
  const location = useLocation();

  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const userMenuRef = useRef(null);
  const notifMenuRef = useRef(null);
  const pollIntervalRef = useRef(null);
  const socketRef = useRef(null);

  // Dynamic Title Logic
  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Dashboard';
    if (path === '/customers') return 'Contact Management';
    if (path === '/broadcast') return 'Broadcast Center';
    if (path === '/templates') return 'Message Templates';
    if (path === '/whatsapp') return 'WhatsApp Connection';
    if (path === '/settings') return 'System Settings';
    if (path.startsWith('/ai-generator')) return 'AI Assistant';
    return 'Zabran System';
  };

  useEffect(() => {
    if (status && status !== 'connecting') setIsInitialLoading(false);
  }, [status]);

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const { data } = await axios.get('/notifications');
      setNotifications(data.data || []);
    } catch (err) {
      // Silent error
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
    // pollIntervalRef.current = setInterval(fetchNotifications, 30000); // Removed polling in favor of socket
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    }
  }, []);

  // 🔌 Socket.IO Integration
  useEffect(() => {
    if (user && user.id) { // Ensure user ID is available (id or _id depending on backend)
      const token = localStorage.getItem('token');
      const socket = initSocket(token);
      socketRef.current = socket;

      // Join User Room
      const userId = user.id || user._id;
      socket.emit('join_room', `user_${userId}`);
      console.log(`🔌 Joining room: user_${userId}`);

      // Listen for new notifications
      socket.on('new_notification', (newNotification) => {
        console.log('🔔 New Notification Received:', newNotification);

        // Add to state immediately
        setNotifications(prev => [newNotification, ...prev]);

        // Show Toast
        toast(
          (t) => (
            <div className="flex items-start gap-3" onClick={() => {
              toast.dismiss(t.id);
              if (newNotification.actionUrl) navigate(newNotification.actionUrl);
            }}>
              <div className="text-primary-600 bg-primary-50 p-2 rounded-lg">
                <Bell size={18} />
              </div>
              <div>
                <p className="font-semibold text-sm text-gray-900">{newNotification.title}</p>
                <p className="text-xs text-gray-500 line-clamp-2">{newNotification.message}</p>
              </div>
            </div>
          ),
          { duration: 4000, position: 'top-right' }
        );
      });

      // Listen for batch updates
      socket.on('notifications_read_all', () => {
        setNotifications(prev => prev.map(n => ({ ...n, unread: false })));
      });

      socket.on('notifications_cleared', () => {
        setNotifications([]);
      });

      // Listen for single updates
      socket.on('notification_updated', (updated) => {
        setNotifications(prev => prev.map(n => n._id === updated._id ? updated : n));
      });

      socket.on('notification_deleted', (deleted) => {
        setNotifications(prev => prev.filter(n => n._id !== deleted.id));
      });

      return () => {
        socket.off('new_notification');
        socket.off('notifications_read_all');
        socket.off('notifications_cleared');
        socket.off('notification_updated');
        socket.off('notification_deleted');
        // disconnectSocket(); // Optional: Don't disconnect if shared, but good for cleanup
      };
    }
  }, [user, navigate]);


  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setShowUserMenu(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getStatusDisplay = () => {
    if (isInitialLoading) {
      return { dot: 'bg-gray-400', text: 'Checking...', color: 'text-gray-500' };
    }
    switch (status) {
      case 'connected': return { dot: 'bg-green-500', text: 'Active', color: 'text-green-600' };
      case 'connecting': return { dot: 'bg-blue-500 animate-pulse', text: 'Connecting...', color: 'text-blue-600' };
      case 'qrcode': return { dot: 'bg-yellow-500 animate-pulse', text: 'Scan QR', color: 'text-yellow-600' };
      default: return { dot: 'bg-red-500', text: 'Disconnected', color: 'text-red-600' };
    }
  };

  const statusDisplay = getStatusDisplay();
  const unreadCount = notifications.filter(n => n.unread).length;

  return (
    <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="px-8 py-4 flex justify-between items-center">

        {/* Left: Page Title */}
        <div>
          <h1 className="text-xl font-bold text-navy-900 tracking-tight">{getPageTitle()}</h1>
          <p className="text-xs text-gray-500 mt-0.5">Manage your broadcast operations efficiently</p>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-4">

          {/* Status Indicator */}
          <div
            onClick={() => navigate('/whatsapp')}
            className={`
              hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full 
              bg-gray-50 border border-gray-200 cursor-pointer
              hover:bg-gray-100 transition-colors
            `}
          >
            <div className={`w-2 h-2 rounded-full ${statusDisplay.dot}`}></div>
            <span className={`text-xs font-semibold ${statusDisplay.color}`}>{statusDisplay.text}</span>
          </div>

          <div className="h-8 w-px bg-gray-200 mx-2 hidden md:block"></div>

          {/* Notifications */}
          <div className="relative" ref={notifMenuRef}>
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-navy-800 transition-colors relative"
            >
              <Bell size={20} strokeWidth={2} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white"></span>
              )}
            </button>

            {/* Dropdown */}
            {showNotifications && (
              <div className="absolute right-0 mt-3 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-in origin-top-right">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                  <h3 className="font-semibold text-gray-800">Notifications</h3>
                  <div className="flex items-center gap-3">
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">{unreadCount} New</span>
                    <button
                      onClick={() => navigate('/notifications')}
                      className="text-xs text-primary-600 hover:text-primary-700 font-medium hover:underline"
                    >
                      View All
                    </button>
                  </div>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No new notifications</div>
                  ) : (
                    notifications.slice(0, 5).map(n => ( // Limit to 5 in dropdown
                      <div key={n._id} className={`p-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors cursor-pointer ${n.unread ? 'bg-blue-50/30' : ''}`}
                        onClick={() => {
                          setShowNotifications(false);
                          if (n.actionUrl) navigate(n.actionUrl);
                        }}
                      >
                        <div className="flex gap-3">
                          <div className={`mt-1 p-1.5 rounded-lg h-fit ${n.unread ? 'bg-white shadow-sm text-primary-600' : 'bg-gray-100 text-gray-500'}`}>
                            {/* Use Lucide Icon based on n.icon name if dynamic, or default Bell */}
                            <Bell size={14} />
                          </div>
                          <div>
                            <p className={`text-sm ${n.unread ? 'font-semibold text-navy-900' : 'font-medium text-gray-700'}`}>{n.title}</p>
                            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{n.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1.5">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 5 && (
                  <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
                    <button onClick={() => navigate('/notifications')} className="text-xs text-gray-500 hover:text-navy-900 font-medium">
                      See {notifications.length - 5} more...
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* User Profile */}
          <div className="relative" ref={userMenuRef}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-gray-100 transition-all border border-transparent hover:border-gray-200"
            >
              <div className="text-right hidden md:block">
                <p className="text-sm font-bold text-navy-900 leading-none">{user?.name?.split(' ')[0]}</p>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{user?.role}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary-400 to-primary-600 flex items-center justify-center text-white font-bold shadow-md shadow-primary-500/20">
                {user?.name?.charAt(0) || 'U'}
              </div>
            </button>

            {/* User Dropdown */}
            {showUserMenu && (
              <div className="absolute right-0 mt-3 w-56 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden animate-scale-in origin-top-right">
                <div className="p-2 space-y-1">
                  <button onClick={() => navigate('/settings')} className="w-full px-4 py-2.5 text-sm text-gray-600 hover:text-navy-900 hover:bg-gray-50 rounded-lg flex items-center gap-3 transition-colors text-left">
                    <Settings size={16} /> settings
                  </button>
                  <div className="h-px bg-gray-100 my-1"></div>
                  <button onClick={logout} className="w-full px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-3 transition-colors text-left font-medium">
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}