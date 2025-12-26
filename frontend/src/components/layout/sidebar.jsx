// src/components/layout/Sidebar.jsx
import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  Megaphone, 
  FileText,
  Smartphone,
  BarChart3,
  Settings as SettingsIcon,
  Sparkles,
  LogOut,
  User
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function Sidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [isHovered, setIsHovered] = useState(false);
  const hoverTimeoutRef = useRef(null);
  const clickLockRef = useRef(false);
  
  // Main menu items
  const mainMenuItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard },
    ...(user?.role === 'admin' 
      ? [{ name: 'Customers', path: '/customers', icon: Users }]
      : []),
    { name: 'Broadcast', path: '/broadcast', icon: Megaphone },
    { name: 'Templates', path: '/templates', icon: FileText },
    { name: 'AI Generator', path: '/ai-generator', icon: Sparkles },
  ];

  // Tools menu items
  const toolsMenuItems = [
    { name: 'WhatsApp', path: '/whatsapp', icon: Smartphone },
    { name: 'Reports', path: '/reports', icon: BarChart3 },
    { name: 'Settings', path: '/settings', icon: SettingsIcon },
  ];

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const handleMouseEnter = () => {
    if (clickLockRef.current) return;
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    setIsHovered(true);
  };

  const handleMouseLeave = () => {
    if (clickLockRef.current) return;
    hoverTimeoutRef.current = setTimeout(() => {
      setIsHovered(false);
    }, 300);
  };

  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  const MenuItem = ({ item }) => {
    const Icon = item.icon;
    const active = isActive(item.path);

    const handleClick = () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setIsHovered(false);
      clickLockRef.current = true;
      setTimeout(() => {
        clickLockRef.current = false;
      }, 500);
    };

    return (
      <Link
        to={item.path}
        onClick={handleClick}
        className={`
          flex items-center gap-2.5 px-4 py-2.5 mx-3 rounded-lg
          transition-all duration-200 ease-out relative
          ${active 
            ? 'bg-primary-500/10 text-primary-500 font-medium' 
            : 'text-gray-400 hover:bg-white/5 hover:text-white'
          }
          ${!isHovered ? 'justify-center px-3' : ''}
        `}
        title={!isHovered ? item.name : ''}
      >
        {active && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-7 bg-primary-500 rounded-r-full" />
        )}
        <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
        <span 
          className={`
            text-[13px] whitespace-nowrap transition-opacity duration-200
            ${isHovered ? 'opacity-100 delay-75' : 'opacity-0'}
            overflow-hidden
          `}
        >
          {item.name}
        </span>
      </Link>
    );
  };

  return (
    <aside 
      className={`
        fixed left-0 top-0 z-50
        bg-navy-800 h-screen 
        flex flex-col shadow-2xl
        transition-all duration-300 ease-out will-change-[width]
        ${isHovered ? 'w-64' : 'w-20'}
      `}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      
      {/* Header */}
      <div className="p-4 flex items-center gap-2.5 min-h-[72px] border-b border-navy-700/50">
        <div className="w-10 h-10 bg-gradient-to-br from-primary-400 via-primary-500 to-primary-600 rounded-lg flex items-center justify-center flex-shrink-0 shadow-lg">
          <span className="text-navy-800 font-bold text-base">Z</span>
        </div>
        <div
          className={`
            transition-opacity duration-200 overflow-hidden whitespace-nowrap
            ${isHovered ? 'opacity-100 delay-75' : 'opacity-0'}
          `}
        >
          <div className="font-bold text-base text-white leading-tight">ZABRAN</div>
          <div className="text-xs text-gray-400 leading-tight">Broadcast</div>
        </div>
      </div>

      {/* Scrollable Menu Area - SEMUA MENU TERMASUK USER & LOGOUT */}
      <div className="flex-1 overflow-y-auto sidebar-scroll">
        {/* Main Menu */}
        <div className="py-6">
          <div className="mb-8">
            <div 
              className={`
                px-6 mb-1.5 transition-opacity duration-200
                ${isHovered ? 'opacity-100 delay-75' : 'opacity-0'}
              `}
            >
              <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-500/70 whitespace-nowrap">
                Main Menu
              </span>
            </div>
            <nav className="space-y-1">
              {mainMenuItems.map((item) => (
                <MenuItem key={item.path} item={item} />
              ))}
            </nav>
          </div>

          {/* Tools Menu */}
          <div>
            {isHovered ? (
              <div 
                className={`
                  px-6 mb-1.5 transition-opacity duration-200
                  ${isHovered ? 'opacity-100 delay-75' : 'opacity-0'}
                `}
              >
                <span className="text-[9px] font-semibold uppercase tracking-widest text-gray-500/70 whitespace-nowrap">
                  Tools & Settings
                </span>
              </div>
            ) : (
              <div className="mx-3 mb-3 border-t border-navy-700/50"></div>
            )}
            <nav className="space-y-1">
              {toolsMenuItems.map((item) => (
                <MenuItem key={item.path} item={item} />
              ))}
            </nav>
          </div>

          {/* Divider */}
          <div className="mx-3 my-4 border-t border-navy-700/50"></div>

          {/* User Info - CONSISTENT SIZE */}
          <div 
            className={`
              flex items-center gap-2.5 px-4 py-2.5 mx-3 rounded-lg
              transition-all duration-200 ease-out relative
              ${!isHovered ? 'justify-center px-3' : ''}
            `}
          >
            <div className="w-[18px] h-[18px] flex items-center justify-center flex-shrink-0">
              <User className="w-[18px] h-[18px] text-gray-400" strokeWidth={1.5} />
            </div>
            <div
              className={`
                transition-opacity duration-200 overflow-hidden
                ${isHovered ? 'opacity-100 delay-75' : 'opacity-0'}
              `}
            >
              <div className="text-[13px] font-medium text-white leading-tight truncate max-w-[160px]">
                {user?.name || 'User'}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`
                  px-1.5 py-0.5 rounded text-[9px] font-bold uppercase leading-none
                  ${user?.role === 'admin' 
                    ? 'bg-primary-500/20 text-primary-400' 
                    : 'bg-navy-700 text-gray-400'
                  }
                `}>
                  {user?.role || 'User'}
                </span>
              </div>
            </div>
          </div>

          {/* Logout - CONSISTENT SIZE */}
          <div className="px-0 pb-6">
            <button
              onClick={logout}
              className={`
                flex items-center gap-2.5 px-4 py-2.5 mx-3 rounded-lg
                transition-all duration-200 ease-out relative
                text-red-400 hover:bg-white/5 hover:text-red-300
                ${!isHovered ? 'justify-center px-3' : ''}
              `}
              title={!isHovered ? 'Logout' : ''}
            >
              <LogOut className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={1.5} />
              <span 
                className={`
                  text-[13px] whitespace-nowrap transition-opacity duration-200
                  ${isHovered ? 'opacity-100 delay-75' : 'opacity-0'}
                  overflow-hidden
                `}
              >
                Logout
              </span>
            </button>
          </div>

        </div>
      </div>

    </aside>
  );
}