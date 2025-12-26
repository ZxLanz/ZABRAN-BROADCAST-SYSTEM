import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check localStorage for existing session
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    
    if (savedUser && token) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Failed to parse user data:', error);
        localStorage.removeItem('user');
        localStorage.removeItem('token');
      }
    }
    
    setLoading(false);
  }, []);

  // ✅ FIXED: Accept BOTH userData AND token
  const login = (userData, token) => {
    console.log('🔐 Login called with:', userData);
    
    // ✅ Save token (CRITICAL!)
    if (token) {
      localStorage.setItem('token', token);
    }
    
    // Save user data
    localStorage.setItem('user', JSON.stringify(userData));
    
    // Update state
    setUser(userData);
    
    console.log('✅ User logged in successfully:', userData);
    console.log('✅ Token saved:', token ? 'Yes' : 'No');
  };

  const logout = () => {
    console.log('👋 Logout called');
    
    // Clear ALL localStorage items
    localStorage.removeItem('user');
    localStorage.removeItem('token');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('isLoggedIn');
    
    // Clear state
    setUser(null);
    
    console.log('✅ User logged out');
    
    // Redirect to login
    window.location.href = '/login';
  };

  // Loading screen
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  const value = {
    user,
    login,
    logout,
    loading,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};