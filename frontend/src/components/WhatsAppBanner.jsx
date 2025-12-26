// frontend/src/components/WhatsAppBanner.jsx - ✅ NO FLASH ON RELOAD
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWhatsApp } from '../contexts/WhatsAppContext';
import toast from 'react-hot-toast';

export default function WhatsAppBanner() {
  const { status, error, connect, refresh } = useWhatsApp();
  const [dismissed, setDismissed] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true); // ✅ NEW
  const navigate = useNavigate();
  
  const refreshIntervalRef = useRef(null);
  const dismissTimeoutRef = useRef(null);
  const autoStopTimeoutRef = useRef(null);

  // ✅ FIX: Wait for initial status check before showing banner
  useEffect(() => {
    // Only set loading to false when we have a definitive status
    if (status && status !== 'connecting') {
      console.log('✅ Initial status loaded:', status);
      setIsInitialLoading(false);
    }
  }, [status]);

  // ✅ INSTANT HIDE when status becomes 'connected'
  useEffect(() => {
    console.log('🎯 Banner - Current status:', status);
    
    if (status === 'connected') {
      console.log('✅ Status is connected - hiding banner');
      
      // Clear interval when connected
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
        console.log('🛑 Cleared refresh interval (status changed to connected)');
      }
      
      if (!isExiting) {
        setIsExiting(true);
        
        setTimeout(() => {
          setDismissed(true);
          setIsExiting(false);
        }, 500);
      }
    }
    
    // Reset dismissed when status changes back to disconnected
    if (status === 'disconnected' || status === 'qrcode' || status === 'error') {
      setDismissed(false);
      setIsExiting(false);
    }
  }, [status, isExiting]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log('🧹 Cleaning up WhatsAppBanner...');
      
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
      
      if (dismissTimeoutRef.current) {
        clearTimeout(dismissTimeoutRef.current);
        dismissTimeoutRef.current = null;
      }
      
      if (autoStopTimeoutRef.current) {
        clearTimeout(autoStopTimeoutRef.current);
        autoStopTimeoutRef.current = null;
      }
    };
  }, []);

  // ✅ FIX #1: Don't show banner during initial loading (CLEAN - no flash!)
  if (isInitialLoading) {
    return null;
  }

  // Don't show if dismissed
  if (dismissed) {
    return null;
  }

  // Don't show if connected (after animation)
  if (status === 'connected' && !isExiting) {
    return null;
  }

  // Don't show if connecting (give it time)
  if (status === 'connecting') {
    return null;
  }

  const handleReconnect = async () => {
    setIsReconnecting(true);
    
    try {
      const result = await connect();
      
      if (result.success) {
        toast.success('WhatsApp reconnection initiated!');
        
        // Clear previous intervals before creating new ones
        if (refreshIntervalRef.current) {
          clearInterval(refreshIntervalRef.current);
          refreshIntervalRef.current = null;
          console.log('🧹 Cleared previous refresh interval');
        }
        
        if (autoStopTimeoutRef.current) {
          clearTimeout(autoStopTimeoutRef.current);
          autoStopTimeoutRef.current = null;
          console.log('🧹 Cleared previous auto-stop timeout');
        }
        
        // AGGRESSIVE REFRESH with proper cleanup
        let refreshCount = 0;
        const maxRefresh = 10;
        
        refreshIntervalRef.current = setInterval(() => {
          console.log('🔄 Aggressive refresh #', refreshCount + 1);
          refresh();
          refreshCount++;
          
          // Stop after max refreshes
          if (refreshCount >= maxRefresh) {
            if (refreshIntervalRef.current) {
              clearInterval(refreshIntervalRef.current);
              refreshIntervalRef.current = null;
              console.log('🛑 Stopped aggressive refresh - max count reached');
            }
          }
        }, 2000);
        
        // Auto-stop after 20 seconds (safety net)
        autoStopTimeoutRef.current = setTimeout(() => {
          if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
            refreshIntervalRef.current = null;
            console.log('🛑 Stopped aggressive refresh - 20 second timeout');
          }
        }, 20000);
        
        // Redirect to WhatsApp page after 1 second
        setTimeout(() => {
          navigate('/whatsapp');
        }, 1000);
      } else {
        toast.error(result.error || 'Failed to reconnect');
      }
    } catch (err) {
      toast.error('Connection error. Please try again.');
      console.error('Reconnect error:', err);
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDismiss = () => {
    setIsExiting(true);
    
    // Clear previous dismiss timeout
    if (dismissTimeoutRef.current) {
      clearTimeout(dismissTimeoutRef.current);
      dismissTimeoutRef.current = null;
    }
    
    setTimeout(() => {
      setDismissed(true);
      setIsExiting(false);
      
      // Auto-show again after 5 minutes if still disconnected
      dismissTimeoutRef.current = setTimeout(() => {
        if (status !== 'connected') {
          console.log('⏰ 5 minutes passed - re-showing banner');
          setDismissed(false);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }, 300);
  };

  return (
    <div 
      className={`
        bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-red-500/10 
        border-b border-amber-500/20
        backdrop-blur-sm
        transition-all duration-500 ease-out
        ${isExiting ? 'opacity-0 -translate-y-4 max-h-0' : 'opacity-100 translate-y-0 max-h-24'}
      `}
    >
      <div className="max-w-7xl mx-auto px-6 py-3.5">
        <div className="flex items-center justify-between gap-4">
          
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </div>
            
            <div>
              <p className="font-semibold text-sm text-gray-900">
                WhatsApp Disconnected
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                {error || 'Your WhatsApp connection is not active. Reconnect to send messages.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleReconnect}
              disabled={isReconnecting}
              className="
                px-4 py-2 
                bg-gradient-to-r from-amber-500 to-orange-500 
                text-white rounded-lg 
                font-medium text-sm 
                hover:from-amber-600 hover:to-orange-600 
                active:scale-95
                transition-all duration-200
                shadow-md hover:shadow-lg
                disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center gap-2
              "
            >
              {isReconnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Reconnect Now'
              )}
            </button>
            
            <button
              onClick={handleDismiss}
              className="
                p-2 
                hover:bg-gray-900/10 
                rounded-lg 
                transition-colors duration-200
                text-gray-600 hover:text-gray-900
              "
              title="Dismiss"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}