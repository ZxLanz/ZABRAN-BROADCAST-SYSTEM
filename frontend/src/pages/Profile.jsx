// frontend/src/pages/Profile.jsx - ✅ MATCH DASHBOARD DESIGN
import { useState, useEffect } from 'react';
import { User, Mail, Lock, Save, Loader2, Eye, EyeOff, Shield } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import axios from '../utils/axios';
import toast from 'react-hot-toast';

export default function Profile() {
  const { user, login } = useAuth();
  
  // Profile form state
  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
  });
  
  // Password form state
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Initialize form with user data
  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name || '',
        email: user.email || '',
      });
    }
  }, [user]);

  // Update profile
  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    
    if (!profileData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    
    if (!profileData.email.trim()) {
      toast.error('Email is required');
      return;
    }

    try {
      setProfileLoading(true);
      
      const { data } = await axios.put('/auth/profile', {
        name: profileData.name,
        email: profileData.email,
      });
      
      // Update user in context
      login(data.user, localStorage.getItem('token'));
      
      toast.success('Profile updated successfully!');
    } catch (err) {
      console.error('Error updating profile:', err);
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setProfileLoading(false);
    }
  };

  // Change password
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    
    if (!passwordData.currentPassword) {
      toast.error('Current password is required');
      return;
    }
    
    if (!passwordData.newPassword) {
      toast.error('New password is required');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters');
      return;
    }
    
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    try {
      setPasswordLoading(true);
      
      await axios.put('/auth/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      
      // Clear form
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      
      toast.success('Password changed successfully!');
    } catch (err) {
      console.error('Error changing password:', err);
      toast.error(err.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="animate-slide-in">
      
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1 flex items-center gap-3">
          <User className="w-9 h-9 text-primary-500" />
          My Profile
        </h1>
        <p className="text-base text-gray-600 font-medium">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Profile Info Card */}
        <div className="lg:col-span-1">
          <div className="card p-7">
            
            {/* Avatar */}
            <div className="flex flex-col items-center text-center">
              <div className="w-28 h-28 rounded-full bg-gradient-to-br from-primary-500 to-orange-500 flex items-center justify-center text-white text-4xl font-black mb-5 shadow-lg">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              
              <h3 className="text-2xl font-black text-navy-800 tracking-tight">{user?.name}</h3>
              <p className="text-sm text-gray-600 font-medium mt-1">{user?.email}</p>
              
              <span className={`inline-block mt-4 px-4 py-2 text-sm font-bold rounded-xl shadow-sm ${
                user?.role === 'admin'
                  ? 'bg-primary-100 text-primary-700 border-2 border-primary-200'
                  : 'bg-gray-100 text-gray-700 border-2 border-gray-200'
              }`}>
                {user?.role === 'admin' ? '👑 Administrator' : '👤 User'}
              </span>
            </div>

            {/* Stats */}
            <div className="mt-7 pt-7 border-t-2 border-gray-200 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 font-semibold">Account Status</span>
                <span className="font-bold text-green-600 flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse"></div>
                  Active
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600 font-semibold">Member Since</span>
                <span className="font-bold text-gray-900">
                  {new Date(user?.createdAt || Date.now()).toLocaleDateString('en-US', { 
                    month: 'short', 
                    year: 'numeric' 
                  })}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column - Forms */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Profile Information Form */}
          <div className="card p-7">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center">
                <User className="w-5 h-5 text-primary-500" />
              </div>
              <h2 className="text-2xl font-black text-navy-800 tracking-tight">Profile Information</h2>
            </div>

            <form onSubmit={handleProfileSubmit} className="space-y-5">
              
              {/* Name */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium transition-all"
                    placeholder="Enter your name"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium transition-all"
                    placeholder="Enter your email"
                  />
                </div>
              </div>

              {/* Role (Read-only) */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Account Role
                </label>
                <div className="relative">
                  <Shield className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={user?.role === 'admin' ? 'Administrator' : 'User'}
                    disabled
                    className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-xl bg-gray-50 text-gray-600 font-bold cursor-not-allowed"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={profileLoading}
                className="btn btn-primary w-full"
              >
                {profileLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    Save Changes
                  </>
                )}
              </button>

            </form>
          </div>

          {/* Change Password Form */}
          <div className="card p-7">
            <div className="flex items-center gap-3 mb-7">
              <div className="w-10 h-10 bg-primary-500/10 border border-primary-500/20 rounded-xl flex items-center justify-center">
                <Lock className="w-5 h-5 text-primary-500" />
              </div>
              <h2 className="text-2xl font-black text-navy-800 tracking-tight">Change Password</h2>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-5">
              
              {/* Current Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Current Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="w-full pl-12 pr-14 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium transition-all"
                    placeholder="Enter current password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="w-full pl-12 pr-14 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium transition-all"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 font-semibold mt-2">Must be at least 6 characters</p>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="w-full pl-12 pr-14 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent font-medium transition-all"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={passwordLoading}
                className="btn btn-primary w-full"
              >
                {passwordLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Changing...
                  </>
                ) : (
                  <>
                    <Lock className="w-5 h-5" />
                    Change Password
                  </>
                )}
              </button>

            </form>
          </div>

        </div>

      </div>

    </div>
  );
}