// src/components/layout/Sidebar.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  MessageSquare, // ✅ ADDED
  LayoutDashboard,
  Users,
  Megaphone,
  FileText,
  Smartphone,
  BarChart3,
  Settings as SettingsIcon,
  Sparkles,
  LogOut,
  User,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);

  // Main menu items
  const mainMenuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    { name: 'Live Chat', path: '/chats', icon: MessageSquare },
    { name: 'Broadcast', path: '/broadcast', icon: Megaphone },
    { name: 'Customers', path: '/customers', icon: Users },
    { name: 'Templates', path: '/templates', icon: FileText },
    { name: 'AI Generator', path: '/ai-generator', icon: Sparkles },
    { name: 'Auto Reply AI', path: '/auto-reply', icon: MessageSquare }, // Changed Icon to avoid duplicate, or reuse MessageSquare
  ];

  // Tools menu items
  const toolsMenuItems = [
    { name: 'WhatsApp', path: '/whatsapp', icon: Smartphone },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  };

  const MenuItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    return (
      <Link
        to={item.path}
        className={`
          group flex items-center gap-3 px-3 py-3 mx-3 rounded-xl
          transition-all duration-300 ease-out relative overflow-hidden
          ${active
            ? 'bg-gradient-to-r from-primary-500/20 to-transparent text-primary-400'
            : 'text-gray-400 hover:text-white hover:bg-white/5'
          }
          ${!isHovered ? 'justify-center' : ''}
        `}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-primary-500 rounded-r-full shadow-lg shadow-primary-500/50" />
        )}

        <Icon
          className={`
            w-5 h-5 flex-shrink-0 transition-all duration-300
            ${active ? 'text-primary-400 drop-shadow-md' : 'group-hover:text-white'}
          `}
          strokeWidth={active ? 2 : 1.5}
        />

        <span
          className={`
            text-[14px] font-medium whitespace-nowrap transition-all duration-300
            ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute'}
          `}
        >
          {item.name}
        </span>

        {isHovered && active && (
          <ChevronRight className="w-4 h-4 ml-auto text-primary-500/50" />
        )}
      </Link>
    );
  };

  return (
    <aside
      className={`
        fixed left-0 top-0 z-50 h-screen 
        bg-navy-900 border-r border-white/5
        flex flex-col shadow-2xl shadow-black/50
        transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)]
        backdrop-blur-xl
        ${isHovered ? 'w-72' : 'w-[88px]'}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >

      {/* Brand Header */}
      <div className="h-20 flex items-center justify-center relative border-b border-white/5 mx-4">
        <div className={`
          flex items-center gap-3 transition-all duration-500
          ${isHovered ? 'w-full px-2' : 'justify-center'}
        `}>
          {/* Logo Icon */}
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20 flex-shrink-0">
            <span className="text-navy-900 font-black text-xl font-sans">Z</span>
          </div>

          {/* Logo Text (Revealed on Hover) */}
          <div className={`
            overflow-hidden transition-all duration-500 flex flex-col justify-center
            ${isHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0'}
          `}>
            <h1 className="text-lg font-black text-white leading-none tracking-tight">ZABRAN</h1>
            <span className="text-[10px] text-primary-400 font-bold tracking-widest uppercase mt-1">Broadcast</span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-6 space-y-8 scrollbar-hide">

        {/* Main Section */}
        <div>
          {isHovered && (
            <div className="px-6 mb-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-fade-in">
              Menu
            </div>
          )}
          <nav className="space-y-1">
            {mainMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </nav>
        </div>

        {/* Tools Section */}
        <div>
          {isHovered && (
            <div className="px-6 mb-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest animate-fade-in">
              Tools
            </div>
          )}
          <nav className="space-y-1">
            {toolsMenuItems.map((item) => (
              <MenuItem key={item.path} item={item} />
            ))}
          </nav>
        </div>
      </div>

      {/* User Profile Footer */}
      <div className="p-4 border-t border-white/5 bg-black/20">
        <div className={`
          flex items-center gap-3 rounded-xl p-2
          ${isHovered ? 'bg-white/5' : 'justify-center hover:bg-white/5'}
          transition-colors duration-300 cursor-pointer group
        `}>
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-navy-700 to-navy-600 border border-white/10 flex items-center justify-center flex-shrink-0 group-hover:border-primary-500/50 transition-colors">
            <User className="w-5 h-5 text-gray-400 group-hover:text-primary-400" />
          </div>

          <div className={`
            overflow-hidden transition-all duration-300
            ${isHovered ? 'opacity-100 w-auto' : 'opacity-0 w-0 hidden'}
          `}>
            <div className="text-sm font-semibold text-white truncate max-w-[120px]">
              {user?.name || 'User'}
            </div>
            <div className="text-xs text-primary-400 font-medium">
              {user?.role === 'admin' ? 'Administrator' : 'User'}
            </div>
          </div>

          {isHovered && (
            <button
              onClick={logout}
              className="ml-auto p-2 rounded-lg hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>

    </aside>
  );
}