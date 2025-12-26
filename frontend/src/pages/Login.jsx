import { useState } from 'react';
import { Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';

const API_URL = import.meta.env.VITE_API_URL || 
  'http://localhost:5000/api';

const ZabranLanding = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const auth = useAuth();
  const login = auth?.login;
  const navigate = useNavigate();

  // ✅ REAL API LOGIN
  const handleSubmit = async () => {
    setError('');
    
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);
    
    try {
      const { data } = await axios.post(
        `${API_URL}/auth/login`,
        {
          username: email, // Backend expect 'username'
          password: password
        }
      );

      if (data.success) {
        // ✅ Call AuthContext login with token
        if (login && typeof login === 'function') {
          login(data.user, data.token);
        }
        
        // Navigate to dashboard
        navigate('/');
      }

    } catch (err) {
      console.error('Login error:', err);
      const message = err.response?.data?.message || 
        'Login failed. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - 58% */}
      <div className="hidden lg:flex lg:w-[58%] bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 relative overflow-hidden">
        <div className="relative z-10 w-full flex flex-col justify-between p-10">
          {/* Logo */}
          <div>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center shadow-2xl">
                <span className="text-xl font-bold text-navy-900">Z</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-none mb-0.5">
                  <span className="text-primary-400">ZA</span>BRAN
                </h1>
                <p className="text-xs text-gray-400 font-semibold tracking-widest uppercase">
                  Broadcast System
                </p>
              </div>
            </div>
          </div>

          {/* Illustration */}
          <div className="flex items-center justify-center">
            <div className="relative" style={{ width: '420px', height: '300px' }}>
              <svg viewBox="0 0 420 300" className="w-full h-full">
                {/* Dashed Lines */}
                <line x1="115" y1="45" x2="180" y2="45" 
                  stroke="#475569" strokeWidth="1.5" 
                  strokeDasharray="3,3" opacity="0.3"/>
                <line x1="240" y1="45" x2="305" y2="45" 
                  stroke="#475569" strokeWidth="1.5" 
                  strokeDasharray="3,3" opacity="0.3"/>
                <line x1="90" y1="265" x2="150" y2="265" 
                  stroke="#475569" strokeWidth="1.5" 
                  strokeDasharray="3,3" opacity="0.3"/>
                <line x1="270" y1="265" x2="330" y2="265" 
                  stroke="#475569" strokeWidth="1.5" 
                  strokeDasharray="3,3" opacity="0.3"/>

                {/* Top Left - Pill */}
                <g className="animate-pulse" 
                  style={{ animationDuration: '3s' }}>
                  <rect x="105" y="35" width="70" height="22" 
                    rx="11" fill="#818cf8" opacity="0.8"/>
                  <circle cx="118" cy="46" r="3" fill="#6366f1"/>
                  <circle cx="133" cy="46" r="3" fill="#f97316"/>
                </g>

                {/* Top Center - Check */}
                <g>
                  <circle cx="210" cy="42" r="24" fill="#10b981" 
                    opacity="0.15" className="animate-pulse" 
                    style={{ animationDuration: '2s' }}/>
                  <circle cx="210" cy="42" r="18" fill="#10b981"/>
                  <path d="M202 42 L208 48 L220 36" 
                    stroke="white" strokeWidth="2.5" fill="none" 
                    strokeLinecap="round" strokeLinejoin="round"/>
                </g>

                {/* Top Right - Rocket */}
                <g style={{ animation: 'float 4s ease-in-out infinite' }}>
                  <defs>
                    <linearGradient id="rocketGrad" 
                      x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="#ff6b6b"/>
                      <stop offset="50%" stopColor="#f97316"/>
                      <stop offset="100%" stopColor="#fbbf24"/>
                    </linearGradient>
                  </defs>
                  <g transform="translate(330, 38)">
                    <ellipse cx="0" cy="0" rx="10" ry="17" 
                      fill="url(#rocketGrad)"/>
                    <path d="M 0 -17 L -6 -12 L 0 -20 L 6 -12 Z" 
                      fill="#ef4444"/>
                    <circle cx="0" cy="-2" r="4" fill="#1e293b"/>
                    <circle cx="0" cy="-2" r="2.5" 
                      fill="#3b82f6" opacity="0.6"/>
                    <path d="M -10 10 L -17 22 L -8 14 Z" 
                      fill="#dc2626"/>
                    <path d="M 10 10 L 17 22 L 8 14 Z" 
                      fill="#dc2626"/>
                    <g className="animate-pulse" 
                      style={{ animationDuration: '0.5s' }}>
                      <path d="M 0 17 L -5 26 L 0 30 L 5 26 Z" 
                        fill="#fbbf24" opacity="0.95"/>
                      <path d="M 0 19 L -3 26 L 0 28 L 3 26 Z" 
                        fill="#fb923c" opacity="0.8"/>
                    </g>
                  </g>
                </g>

                {/* Center - Monitor */}
                <g transform="translate(130, 90)">
                  {/* Stand */}
                  <rect x="65" y="147" width="22" height="14" 
                    fill="#64748b" opacity="0.7"/>
                  <rect x="53" y="161" width="46" height="4" 
                    rx="2" fill="#64748b" opacity="0.8"/>
                  
                  {/* Monitor */}
                  <rect x="0" y="0" width="152" height="147" 
                    rx="8" fill="#64748b"/>
                  <rect x="5" y="5" width="142" height="137" 
                    rx="6" fill="#1e293b"/>
                  
                  {/* Code Lines */}
                  <rect x="12" y="14" width="76" height="5" 
                    rx="2.5" fill="#FDB022"/>
                  <rect x="92" y="14" width="38" height="5" 
                    rx="2.5" fill="#fbbf24"/>
                  <rect x="12" y="25" width="53" height="5" 
                    rx="2.5" fill="#ec4899"/>
                  <rect x="69" y="25" width="61" height="5" 
                    rx="2.5" fill="#a855f7"/>
                  <rect x="12" y="36" width="65" height="5" 
                    rx="2.5" fill="#3b82f6"/>
                  <rect x="81" y="36" width="49" height="5" 
                    rx="2.5" fill="#06b6d4"/>
                  <rect x="12" y="47" width="46" height="5" 
                    rx="2.5" fill="#10b981"/>
                  <rect x="62" y="47" width="68" height="5" 
                    rx="2.5" fill="#84cc16"/>
                  <rect x="12" y="58" width="80" height="5" 
                    rx="2.5" fill="#8b5cf6"/>
                  <rect x="96" y="58" width="34" height="5" 
                    rx="2.5" fill="#c084fc"/>
                  <rect x="12" y="69" width="38" height="5" 
                    rx="2.5" fill="#f59e0b"/>
                  <rect x="54" y="69" width="76" height="5" 
                    rx="2.5" fill="#fbbf24"/>
                  <rect x="12" y="80" width="61" height="5" 
                    rx="2.5" fill="#06b6d4"/>
                  <rect x="77" y="80" width="53" height="5" 
                    rx="2.5" fill="#0ea5e9"/>
                  <rect x="12" y="91" width="49" height="5" 
                    rx="2.5" fill="#ec4899"/>
                  <rect x="65" y="91" width="65" height="5" 
                    rx="2.5" fill="#f472b6"/>
                  <rect x="12" y="102" width="72" height="5" 
                    rx="2.5" fill="#10b981"/>
                  <rect x="88" y="102" width="42" height="5" 
                    rx="2.5" fill="#34d399"/>
                  <rect x="12" y="113" width="42" height="5" 
                    rx="2.5" fill="#FDB022"/>
                  <rect x="58" y="113" width="72" height="5" 
                    rx="2.5" fill="#fb923c"/>
                  <rect x="12" y="124" width="57" height="5" 
                    rx="2.5" fill="#3b82f6"/>
                </g>

                {/* Small Terminal */}
                <g transform="translate(240, 155)">
                  <rect x="0" y="0" width="92" height="65" 
                    rx="5" fill="#0f172a" stroke="#334155" 
                    strokeWidth="1"/>
                  <rect x="0" y="0" width="92" height="12" 
                    rx="5" fill="#1e293b"/>
                  <circle cx="6" cy="6" r="2" fill="#ef4444"/>
                  <circle cx="14" cy="6" r="2" fill="#fbbf24"/>
                  <circle cx="22" cy="6" r="2" fill="#10b981"/>
                  <rect x="6" y="21" width="42" height="2.5" 
                    rx="1.25" fill="#10b981"/>
                  <rect x="6" y="29" width="50" height="2.5" 
                    rx="1.25" fill="#3b82f6"/>
                  <rect x="6" y="37" width="46" height="2.5" 
                    rx="1.25" fill="#FDB022"/>
                  <rect x="6" y="45" width="54" height="2.5" 
                    rx="1.25" fill="#8b5cf6"/>
                  <rect x="6" y="53" width="38" height="2.5" 
                    rx="1.25" fill="#ec4899"/>
                </g>

                {/* Bottom Left - Coffee */}
                <g transform="translate(82, 245)">
                  <rect x="0" y="6" width="21" height="18" 
                    rx="2" fill="#8b5cf6"/>
                  <ellipse cx="10.5" cy="6" rx="10.5" ry="3" 
                    fill="#a78bfa"/>
                  <path d="M 21 11 Q 29 11 29 15 Q 29 20 21 20" 
                    stroke="#8b5cf6" strokeWidth="2.5" fill="none"/>
                  <g className="animate-pulse" 
                    style={{ animationDuration: '1.8s' }}>
                    <path d="M 6 3 Q 6 -1 8 -1" stroke="#94a3b8" 
                      strokeWidth="1.5" fill="none" 
                      strokeLinecap="round" opacity="0.8"/>
                    <path d="M 11 1 Q 11 -3 13 -3" 
                      stroke="#94a3b8" strokeWidth="1.5" 
                      fill="none" strokeLinecap="round" 
                      opacity="0.8"/>
                    <path d="M 15 3 Q 15 -1 17 -1" 
                      stroke="#94a3b8" strokeWidth="1.5" 
                      fill="none" strokeLinecap="round" 
                      opacity="0.8"/>
                  </g>
                </g>

                {/* Bottom Right - User */}
                <g transform="translate(315, 257)">
                  <circle cx="0" cy="0" r="18" fill="#10b981"/>
                  <circle cx="0" cy="-5" r="7.5" fill="#0f172a"/>
                  <path d="M -11 12 Q 0 5 11 12" fill="#0f172a"/>
                </g>
              </svg>

              {/* API Badge */}
              <div className="absolute left-1/2 transform -translate-x-1/2" 
                style={{ bottom: '-32px' }}>
                <div className="bg-navy-800/95 backdrop-blur-sm border border-emerald-500/60 rounded-full px-5 py-1.5 flex items-center gap-2 shadow-2xl">
                  <span className="text-xs font-bold text-emerald-400">
                    API: Connected
                  </span>
                  <svg className="w-3.5 h-3.5 text-emerald-400" 
                    fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" 
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" 
                      clipRule="evenodd"/>
                  </svg>
                </div>
              </div>
            </div>
          </div>

          {/* Welcome Text */}
          <div>
            <h2 className="text-4xl font-bold text-white mb-3 leading-tight">
              Welcome to<br/>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-400 to-primary-500">
                ZABRAN BROADCAST
              </span>
            </h2>
            <p className="text-gray-400 text-sm leading-relaxed">
              Enterprise WhatsApp broadcast automation with 
              AI-powered message generation
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - 42% */}
      <div className="w-full lg:w-[42%] flex items-center justify-center bg-gray-50 p-8">
        <div className="w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 flex items-center justify-center">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-500 rounded-full flex items-center justify-center shadow-xl">
                <span className="text-xl font-bold text-navy-900">Z</span>
              </div>
              <div>
                <h1 className="text-xl font-bold text-navy-900 leading-none mb-0.5">
                  <span className="text-primary-500">ZA</span>BRAN
                </h1>
                <p className="text-xs text-gray-500 font-semibold tracking-widest uppercase">
                  Broadcast System
                </p>
              </div>
            </div>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
            {/* Form Header */}
            <div className="mb-7">
              <h2 className="text-3xl font-bold text-navy-900 mb-2">
                Sign In
              </h2>
              <p className="text-gray-600 text-sm">
                Access your broadcast dashboard
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3 animate-shake">
                <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm font-semibold text-red-900">
                  {error}
                </p>
              </div>
            )}

            {/* Form */}
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label htmlFor="email" 
                  className="block text-sm font-bold text-navy-900 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" 
                      fill="none" stroke="currentColor" 
                      viewBox="0 0 24 24">
                      <path strokeLinecap="round" 
                        strokeLinejoin="round" strokeWidth={2} 
                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError('');
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="you@company.com"
                    disabled={loading}
                    className="w-full pl-11 pr-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 focus:bg-white outline-none transition-all text-navy-900 placeholder-gray-400 text-sm font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" 
                  className="block text-sm font-bold text-navy-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="w-5 h-5 text-gray-400" 
                      fill="none" stroke="currentColor" 
                      viewBox="0 0 24 24">
                      <path strokeLinecap="round" 
                        strokeLinejoin="round" strokeWidth={2} 
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError('');
                    }}
                    onKeyPress={handleKeyPress}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="w-full pl-11 pr-11 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 focus:bg-white outline-none transition-all text-navy-900 placeholder-gray-400 text-sm font-semibold disabled:bg-gray-100 disabled:cursor-not-allowed"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? 
                      <EyeOff className="w-5 h-5" /> : 
                      <Eye className="w-5 h-5" />
                    }
                  </button>
                </div>
              </div>

              {/* Remember & Forgot */}
              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded border-2 border-gray-300 text-primary-500 focus:ring-2 focus:ring-primary-500/20 cursor-pointer"
                  />
                  <span className="ml-2 text-sm text-gray-700 group-hover:text-gray-900 transition-colors font-semibold">
                    Remember me
                  </span>
                </label>
                <button 
                  className="text-sm font-bold text-primary-600 hover:text-primary-700 transition-colors"
                >
                  Forgot password?
                </button>
              </div>

              {/* Button */}
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="w-full bg-gradient-to-r from-primary-500 to-primary-600 text-white font-bold py-3.5 rounded-xl hover:from-primary-600 hover:to-primary-700 focus:ring-4 focus:ring-primary-500/20 transition-all shadow-xl shadow-primary-500/30 flex items-center justify-center gap-2 group mt-5 disabled:from-gray-300 disabled:to-gray-300 disabled:cursor-not-allowed disabled:shadow-none"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                    <span className="text-sm">Signing in...</span>
                  </>
                ) : (
                  <>
                    <span className="text-sm">Sign In</span>
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>

            {/* Footer */}
            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Don't have an account?{' '}
                <button className="font-bold text-primary-600 hover:text-primary-700 transition-colors">
                  Contact Admin
                </button>
              </p>
            </div>
          </div>

          {/* Company Footer */}
          <div className="text-center mt-8 space-y-2">
            <p className="text-xs text-gray-500 font-medium">
              © 2025 PT ZABRAN INTERNATIONAL GROUP
            </p>
            <p className="text-xs text-gray-600 font-semibold">
              All rights reserved • Powered by{' '}
              <span className="text-primary-600">
                Lanz Technology
              </span>
            </p>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0); }
          50% { transform: translate(0, -8px); }
        }
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { 
            transform: translateX(-4px); 
          }
          20%, 40%, 60%, 80% { 
            transform: translateX(4px); 
          }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default ZabranLanding;