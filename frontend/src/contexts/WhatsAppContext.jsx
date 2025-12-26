// frontend/src/contexts/WhatsAppContext.jsx - ✅ OPTIMIZED POLLING
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from '../utils/axios';

const WhatsAppContext = createContext();

export function useWhatsApp() {
  const context = useContext(WhatsAppContext);
  if (!context) {
    throw new Error('useWhatsApp must be used within WhatsAppProvider');
  }
  return context;
}

export function WhatsAppProvider({ children }) {
  // ✅ FIX: Change default to null (not 'disconnected')
  const [status, setStatus] = useState(null);
  const [qrCode, setQrCode] = useState(null);
  const [deviceInfo, setDeviceInfo] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // ✅ ULTIMATE PROTECTION - Prevent ALL double execution
  const mountedRef = useRef(false);
  const normalPollRef = useRef(null);
  const fastPollRef = useRef(null);
  const isFetchingRef = useRef(false);

  // Fetch WhatsApp status
  const fetchStatus = async () => {
    // ✅ Prevent concurrent fetches
    if (isFetchingRef.current) {
      return;
    }

    // ✅ Check if user is logged in
    const token = localStorage.getItem('token');
    if (!token) {
      return;
    }

    isFetchingRef.current = true;

    try {
      const { data } = await axios.get('/whatsapp/status');
      
      setStatus(data.status);
      setDeviceInfo(data.deviceInfo);
      setStats(data.stats);
      setError(null);
      
      if (data.status === 'qrcode') {
        fetchQRCode();
      } else {
        setQrCode(null);
      }
      
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('❌ Error fetching WhatsApp status:', err);
        setError(err.response?.data?.message || 'Failed to fetch status');
        setStatus('error');
      }
    } finally {
      setLoading(false);
      isFetchingRef.current = false;
    }
  };

  // Fetch QR Code
  const fetchQRCode = async () => {
    try {
      const { data } = await axios.get('/whatsapp/qr');
      setQrCode(data.qrCode);
    } catch (err) {
      if (err.response?.status !== 401) {
        console.error('Error fetching QR code:', err);
      }
      setQrCode(null);
    }
  };

  // Connect WhatsApp
  const connect = async () => {
    try {
      setLoading(true);
      const { data } = await axios.post('/whatsapp/connect');
      
      console.log('✅ WhatsApp connection initiated');
      
      // Immediate refresh after connect
      setTimeout(fetchStatus, 2000);
      
      return { success: true, message: data.message };
    } catch (err) {
      console.error('Error connecting WhatsApp:', err);
      setError(err.response?.data?.message || 'Failed to connect');
      return { success: false, error: err.response?.data?.message };
    } finally {
      setLoading(false);
    }
  };

  // Disconnect WhatsApp
  const disconnect = async () => {
    try {
      setLoading(true);
      await axios.post('/whatsapp/logout');
      
      setStatus('disconnected');
      setQrCode(null);
      setDeviceInfo(null);
      setStats(null);
      
      console.log('✅ WhatsApp disconnected');
      
      return { success: true };
    } catch (err) {
      console.error('Error disconnecting WhatsApp:', err);
      return { success: false, error: err.response?.data?.message };
    } finally {
      setLoading(false);
    }
  };

  // ✅ ULTIMATE GUARD - Initial fetch - RUN EXACTLY ONCE
  useEffect(() => {
    if (mountedRef.current) {
      return;
    }

    mountedRef.current = true;
    
    console.log('🚀 WhatsApp Context initialized');
    
    // Initial fetch
    fetchStatus();
    
    // ✅ OPTIMIZED: Normal polling 60 seconds (was 30s)
    normalPollRef.current = setInterval(() => {
      fetchStatus();
    }, 60000);
    
    return () => {
      console.log('🛑 WhatsApp Context unmounting');
      
      if (normalPollRef.current) {
        clearInterval(normalPollRef.current);
        normalPollRef.current = null;
      }
      
      if (fastPollRef.current) {
        clearInterval(fastPollRef.current);
        fastPollRef.current = null;
      }
      
      mountedRef.current = false;
    };
  }, []);

  // ✅ OPTIMIZED: Fast polling 10 seconds (was 3s)
  useEffect(() => {
    if (fastPollRef.current) {
      clearInterval(fastPollRef.current);
      fastPollRef.current = null;
    }
    
    if (status === 'connecting' || status === 'qrcode' || status === 'reconnecting') {
      console.log('⚡ Starting fast polling for status:', status);
      
      fastPollRef.current = setInterval(() => {
        fetchStatus();
      }, 10000); // ✅ 10 seconds (was 3s)
    }
    
    return () => {
      if (fastPollRef.current) {
        clearInterval(fastPollRef.current);
        fastPollRef.current = null;
      }
    };
  }, [status]);

  const value = {
    status,
    qrCode,
    deviceInfo,
    stats,
    loading,
    error,
    connect,
    disconnect,
    refresh: fetchStatus
  };

  return (
    <WhatsAppContext.Provider value={value}>
      {children}
    </WhatsAppContext.Provider>
  );
}