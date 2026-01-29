// frontend/src/App.jsx - ✅ WITH NOTIFICATIONS & PROFILE ROUTES
// 📍 LOCATION: frontend/src/App.jsx
// 🎯 PURPOSE: Main app component with all routes
// ⚠️ ACTION: REPLACE EXISTING FILE
// 📦 CHANGES: Added Notifications and Profile routes
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useEffect } from "react";
import axios from "axios";

// Contexts
import { AuthProvider } from "./context/AuthContext";
import { WhatsAppProvider } from "./contexts/WhatsAppContext";
import { ThemeProvider } from "./contexts/ThemeContext";

// Auth Components
import ProtectedRoute from "./components/ProtectedRoute";
import AdminOnly from "./components/AdminOnly";

// Layout
import MainLayout from "./components/layout/MainLayout";

// Pages
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import Templates from "./pages/Templates";
import WhatsApp from "./pages/WhatsApp";
import Reports from "./pages/Reports";
import AIGenerator from "./pages/AIGenerator";
import LiveChat from "./pages/LiveChat";
import Customers from "./pages/Customers";
import Broadcast from "./pages/Broadcast";
import Unauthorized from "./pages/Unauthorized";
import Notifications from "./pages/Notifications";
import Profile from "./pages/Profile";
import AutoReply from "./pages/AutoReply";

function App() {

  useEffect(() => {
    // Request interceptor - Add token to all requests
    const requestInterceptor = axios.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('token');

        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor - Handle 401 errors
    const responseInterceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // ✅ Only logout if we're not already on login page
          const currentPath = window.location.pathname;

          if (currentPath !== '/login') {
            console.log('❌ 401 Unauthorized - Token expired, logging out...');

            // Token invalid/expired - logout
            localStorage.removeItem('token');
            localStorage.removeItem('user');

            // Redirect to login
            window.location.href = '/login';
          }
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptors on unmount
    return () => {
      axios.interceptors.request.eject(requestInterceptor);
      axios.interceptors.response.eject(responseInterceptor);
    };
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <WhatsAppProvider>
          <BrowserRouter>
            {/* Toast Notifications */}
            <Toaster
              position="top-right"
              toastOptions={{
                duration: 3000,
                style: {
                  background: "#fff",
                  color: "#1a2332",
                  borderRadius: "12px",
                  padding: "16px",
                  boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
                },
                success: {
                  iconTheme: {
                    primary: "#059669",
                    secondary: "#fff",
                  },
                },
                error: {
                  iconTheme: {
                    primary: "#ef4444",
                    secondary: "#fff",
                  },
                },
              }}
            />

            <Routes>
              {/* PUBLIC ROUTE */}
              <Route path="/login" element={<Login />} />
              <Route path="/unauthorized" element={<Unauthorized />} />

              {/* PROTECTED ROUTES */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                {/* Dashboard (ALL USERS) */}
                <Route index element={<Dashboard />} />

                {/* ✅ NEW: User Pages (ALL USERS) */}
                <Route path="notifications" element={<Notifications />} />
                <Route path="profile" element={<Profile />} />

                {/* ADMIN ONLY */}
                <Route
                  path="chats"
                  element={
                    <AdminOnly>
                      <LiveChat />
                    </AdminOnly>
                  }
                />

                {/* MAIN PAGES (ALL USERS) */}
                <Route path="auto-reply" element={<AutoReply />} />
                <Route path="broadcast" element={<Broadcast />} />
                <Route path="customers" element={<Customers />} />
                <Route path="templates" element={<Templates />} />
                <Route path="ai-generator" element={<AIGenerator />} />

                {/* Tools Pages (ALL USERS) */}
                <Route path="whatsapp" element={<WhatsApp />} />
                <Route path="reports" element={<Reports />} />
                <Route path="settings" element={<Settings />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </WhatsAppProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;