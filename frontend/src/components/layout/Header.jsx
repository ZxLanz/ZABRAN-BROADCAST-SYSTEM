// frontend/src/components/layout/Header.jsx
import { Bell, User, Settings, LogOut, ChevronDown, Loader2, Menu } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useWhatsApp } from '../../contexts/WhatsAppContext';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from '../../utils/axios';
import toast from 'react-hot-toast';

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
    pollIntervalRef.current = setInterval(fetchNotifications, 30000);
    return () => clearInterval(pollIntervalRef.current);
  }, []);

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
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full font-medium">{unreadCount} New</span>
                </div>
                <div className="max-h-[300px] overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 text-sm">No new notifications</div>
                  ) : (
                    notifications.map(n => (
                      <div key={n._id} className="p-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <p className="text-sm font-medium text-gray-800">{n.title}</p>
                        <p className="text-xs text-gray-500 mt-1">{n.message}</p>
                      </div>
                    ))
                  )}
                </div>
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
                <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wide">{user?.role}</p>
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
                    <Settings size={16} /> Settings
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