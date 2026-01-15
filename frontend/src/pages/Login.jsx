import { useState, useEffect } from 'react';
import { Eye, EyeOff, LogIn, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from '../utils/axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const ZabranLogin = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [animate, setAnimate] = useState(false);

  const auth = useAuth();
  const login = auth?.login;
  const navigate = useNavigate();

  useEffect(() => {
    setAnimate(true);
  }, []);

  const handleSubmit = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    setError('');

    if (!identifier || !password) {
      setError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const { data } = await axios.post(
        `${API_URL}/auth/login`,
        { username: identifier, password: password }
      );

      if (data.success) {
        if (login && typeof login === 'function') {
          login(data.user, data.token);
        }

        // Success animation delay
        setTimeout(() => {
          navigate('/');
        }, 800);
      }
    } catch (err) {
      console.error('Login error:', err);
      const message = err.response?.data?.message || 'Login failed. Please verify your credentials.';
      setError(message);
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !loading) {
      e.preventDefault();
      e.stopPropagation();
      handleSubmit(e);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-navy-900 relative overflow-hidden font-sans">

      {/* Background Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gold Glow Top Left */}
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary-500/10 rounded-full blur-[120px]" />
        {/* Navy Glow Bottom Right */}
        <div className="absolute -bottom-[20%] -right-[10%] w-[50%] h-[50%] bg-blue-600/10 rounded-full blur-[120px]" />

        {/* Grid Pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(#d4af6a 1px, transparent 1px), linear-gradient(90deg, #d4af6a 1px, transparent 1px)',
            backgroundSize: '40px 40px'
          }}
        />
      </div>

      {/* Main Card Container */}
      <div
        className={`
          w-full max-w-5xl bg-navy-800/50 backdrop-blur-xl rounded-2xl shadow-2xl overflow-hidden border border-white/10 flex flex-col md:flex-row transition-all duration-700 ease-out transform
          ${animate ? 'scale-100 opacity-100 translate-y-0' : 'scale-95 opacity-0 translate-y-10'}
        `}
        style={{ minHeight: '600px' }}
      >

        {/* Left Side: Brand & Visuals (Hidden on mobile) */}
        <div className="hidden md:flex flex-col justify-between w-1/2 relative bg-navy-950 p-12 overflow-hidden group">
          {/* Animated Gradient Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-navy-900 via-navy-950 to-black opacity-90 z-0"></div>

          {/* Hover Effect Light */}
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-500/0 via-primary-500/0 to-primary-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>

          {/* Content */}
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
                <span className="text-navy-900 font-black text-2xl font-sans">Z</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-wide">ZABRAN</span>
            </div>
            <div className="h-1 w-12 bg-primary-500 rounded-full mt-4"></div>
          </div>

          <div className="relative z-10 flex flex-col gap-8 my-auto">
            <h1 className="text-4xl lg:text-5xl font-bold text-white leading-tight">
              Broadcast <br />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-300 to-primary-500">
                Without Limits
              </span>
            </h1>
            <p className="text-gray-400 text-lg leading-relaxed max-w-sm">
              Connect with thousands of customers instantly. Secure, reliable, and premium messaging solution.
            </p>

            {/* Stats Pills */}
            <div className="flex flex-wrap gap-3 mt-4">
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full flex items-center gap-2 text-sm text-gray-300">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                99.9% Uptime
              </div>
              <div className="px-4 py-2 bg-white/5 border border-white/10 rounded-full flex items-center gap-2 text-sm text-gray-300">
                <ShieldCheck size={14} className="text-primary-400" />
                Enterprise Security
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-gray-600 font-medium tracking-widest uppercase">
            © 2024 Zabran International Group
          </div>

          {/* Abstract Shapes */}
          <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-primary-500/5 rounded-full blur-3xl"></div>
          <div className="absolute top-1/2 -left-24 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl"></div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full md:w-1/2 p-8 md:p-12 lg:p-16 flex flex-col justify-center bg-white relative">
          <div className="w-full max-w-md mx-auto">

            {/* Mobile Header (Visible only on mobile) */}
            <div className="md:hidden flex items-center gap-2 mb-8 justify-center">
              <div className="w-8 h-8 rounded bg-primary-500 flex items-center justify-center">
                <span className="text-white font-black text-lg font-sans">Z</span>
              </div>
              <span className="text-xl font-bold text-navy-900">ZABRAN</span>
            </div>

            <div className="mb-10 text-center md:text-left">
              <h2 className="text-3xl font-bold text-navy-900 mb-2">Welcome Back</h2>
              <p className="text-gray-500">Please enter your details to sign in.</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border-l-4 border-red-500 text-red-700 text-sm rounded-r-lg shadow-sm animate-slide-in-left">
                <p className="font-semibold flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                  Login Failed
                </p>
                <p className="mt-1 opacity-90">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 ml-1">Username / Email</label>
                <div className="relative group">
                  <input
                    type="text"
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 outline-none text-navy-900 placeholder-gray-400 group-hover:border-gray-300"
                    placeholder="Enter your username"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center ml-1">
                  <label className="text-sm font-semibold text-gray-700">Password</label>
                  <a href="#" className="text-xs font-semibold text-primary-600 hover:text-primary-700 transition-colors">Forgot password?</a>
                </div>
                <div className="relative group">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="w-full px-5 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all duration-200 outline-none text-navy-900 placeholder-gray-400 pr-12 group-hover:border-gray-300"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyPress={handleKeyPress}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="flex items-center ml-1">
                <input
                  id="remember-me"
                  type="checkbox"
                  className="w-4 h-4 text-primary-500 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-gray-600 cursor-pointer select-none">
                  Keep me logged in
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-primary-400 to-primary-600 hover:from-primary-500 hover:to-primary-700 text-navy-900 font-bold text-lg shadow-lg shadow-primary-500/30 transform transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-navy-900/30 border-t-navy-900 rounded-full animate-spin"></div>
                    <span>Signing in...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <LogIn size={20} className="stroke-[2.5]" />
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-500 mt-6">
                Don't have an account? <a href="#" className="font-bold text-navy-700 hover:text-primary-600 transition-colors">Contact Admin</a>
              </p>
            </form>
          </div>
        </div>
      </div>

      {/* Simple Footer */}
      <div className="absolute bottom-4 text-center w-full text-navy-300 text-xs md:hidden">
        © 2024 Zabran International Group
      </div>

    </div>
  );
};

export default ZabranLogin;