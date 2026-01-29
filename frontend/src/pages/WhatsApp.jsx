// frontend/src/pages/WhatsApp.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Smartphone, QrCode, CheckCircle, XCircle, AlertCircle,
    MessageSquare, Users, Clock, TrendingUp, RefreshCw,
    LogOut, Zap, Shield, Globe, Cpu, Wifi, Battery, Eye
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from '../utils/axios';
import { toast } from 'react-hot-toast';

// const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; // REMOVED

// Helper to format device info nicely
const mapDeviceInfo = (deviceInfo) => {
    if (!deviceInfo) return null;

    // Clean up platform name
    let platform = deviceInfo.platform || 'WhatsApp Web';
    if (platform.includes('Baileys')) platform = 'WhatsApp Web API';
    if (platform.toLowerCase().includes('android')) platform = 'Android OS';
    if (platform.toLowerCase().includes('ios') || platform.toLowerCase().includes('iphone')) platform = 'iOS (iPhone)';

    // Format number
    const phoneNumber = deviceInfo.number ? `+${deviceInfo.number}` : 'Unknown';

    return {
        number: phoneNumber,
        name: deviceInfo.name || 'WhatsApp User',
        platform: platform,
        browser: deviceInfo.browser || 'Chrome/Baileys',
        version: deviceInfo.waVersion || 'Latest'
    };
};

export default function WhatsApp() {
    const [connectionState, setConnectionState] = useState({
        status: 'disconnected',
        message: 'Awaiting connection...',
        qrCode: null,
        loading: true,
        deviceInfo: null,
    });

    const [autoReply, setAutoReply] = useState(false);
    const [autoRead, setAutoRead] = useState(false);
    const [readReceipts, setReadReceipts] = useState(true);
    const [loadingSettings, setLoadingSettings] = useState(true);
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    const [stats, setStats] = useState({
        messagesToday: '0',
        messagesSent: '0',
        messagesReceived: '0',
        activeChats: '0',
        responseTime: '0m',
        successRate: '0%',
        loading: true
    });

    const intervalRef = useRef(null);
    const isMountedRef = useRef(true);

    // Stats Configuration
    const statsDisplay = [
        {
            label: 'Total Messages',
            value: stats.messagesToday,
            icon: MessageSquare,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            border: 'border-blue-500/20'
        },
        {
            label: 'Active Chats',
            value: stats.activeChats,
            icon: Users,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20'
        },
        {
            label: 'Response Time',
            value: stats.responseTime,
            icon: Clock,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            border: 'border-orange-500/20'
        },
        {
            label: 'Success Rate',
            value: stats.successRate,
            icon: TrendingUp,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20'
        },
    ];

    // Fetch Stats
    const fetchStats = useCallback(async (silent = false) => {
        if (!silent) setStats(prev => ({ ...prev, loading: true }));
        try {
            const { data } = await axios.get(`/whatsapp/stats`);
            if (data.success && isMountedRef.current) {
                setStats(prev => ({
                    ...prev,
                    messagesToday: data.stats.messagesToday?.toString() || '0',
                    messagesSent: data.stats.sentToday?.toString() || '0',
                    messagesReceived: data.stats.receivedToday?.toString() || '0',
                    activeChats: data.stats.activeChats?.toString() || '0',
                    responseTime: data.stats.responseTime || '0m',
                    successRate: data.stats.successRate || '0%',
                    loading: false
                }));
            }
        } catch (error) {
            console.error("Stats fetch error:", error);
            if (!silent) setStats(prev => ({ ...prev, loading: false }));
        }
    }, []);

    // Fetch Settings
    const fetchSettings = useCallback(async () => {
        setLoadingSettings(true);
        try {
            const { data } = await axios.get(`/settings`);
            if (data.success && isMountedRef.current) {
                // Fix: Use correct schema keys (autoReply, readReceipts)
                setAutoReply(data.data.autoReply || false);
                setAutoRead(data.data.autoRead || false);
                setReadReceipts(data.data.readReceipts !== false);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            if (isMountedRef.current) setLoadingSettings(false);
        }
    }, []);

    // Update Settings
    const updateSettings = async (key, value) => {
        if (key === 'autoReply') setAutoReply(value);
        if (key === 'autoRead') setAutoRead(value);
        if (key === 'readReceipts') setReadReceipts(value);
        setIsSavingSettings(true);
        try {
            const { data } = await axios.put(`/settings`, { [key]: value });
            if (!data.success) throw new Error('Failed to save settings');
            toast.success('Settings updated');
            // ✅ FORCE SYNC: Refresh settings to confirm DB state matches UI
            fetchSettings();
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to update settings');
            fetchSettings();
        } finally {
            setIsSavingSettings(false);
        }
    };

    // Fetch Status
    const fetchStatus = useCallback(async (showLoading = false) => {
        if (showLoading) setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            const { data: statusData } = await axios.get(`/whatsapp/status`);

            let newQrCode = null;
            if (statusData.status === 'qrcode') {
                try {
                    const { data: qrData } = await axios.get(`/whatsapp/qr`);
                    if (qrData.success) newQrCode = qrData.qrCode;
                } catch (qrError) {
                    // QR might not be ready
                }
            }

            if (statusData.status === 'connected') {
                fetchStats(true);
            }

            if (isMountedRef.current) {
                setConnectionState({
                    status: statusData.status,
                    message: statusData.message,
                    qrCode: newQrCode,
                    loading: false,
                    deviceInfo: mapDeviceInfo(statusData.deviceInfo),
                });
            }
        } catch (error) {
            console.error("Fetch error:", error);
            if (isMountedRef.current) {
                setConnectionState(prev => ({
                    ...prev,
                    status: 'error',
                    message: 'Connection Failed',
                    loading: false
                }));
            }
        }
    }, [fetchStats]);

    const handleConnect = async () => {
        console.log('[DEBUG] handleConnect called');
        setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            console.log('[DEBUG] Sending POST to /whatsapp/connect');
            const { data } = await axios.post(`/whatsapp/connect`);
            console.log('[DEBUG] Response received:', data);
            if (data.success) {
                toast.success('Initializing connection...');
                console.log('[DEBUG] Fetching status in 2 seconds');
                setTimeout(() => fetchStatus(false), 2000);
            } else {
                console.error('[DEBUG] Response success=false:', data);
                toast.error(data.message || 'Connection failed');
                setConnectionState(prev => ({ ...prev, loading: false }));
            }
        } catch (error) {
            console.error('[DEBUG] handleConnect error:', error);
            console.error('[DEBUG] Error response:', error.response?.data);
            console.error('[DEBUG] Error status:', error.response?.status);
            toast.error(error.response?.data?.message || 'Failed to start connection');
            setConnectionState(prev => ({ ...prev, loading: false }));
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Are you sure you want to disconnect?')) return;
        setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            await axios.post(`/whatsapp/logout`);
            toast.success('Disconnected successfully. Reconnecting...');
            // Wait for disconnect to complete, then trigger new connection
            setTimeout(() => {
                fetchStatus(true);
                // Auto-reconnect to generate new QR
                setTimeout(() => handleConnect(), 1500);
            }, 1000);
        } catch (error) {
            toast.error('Disconnect failed');
            setConnectionState(prev => ({ ...prev, loading: false }));
        }
    };

    // Intervals
    useEffect(() => {
        isMountedRef.current = true;
        fetchStatus(true);
        fetchSettings();

        const statusIntervalTime = connectionState.status === 'connected' ? 30000 : 2000; // Poll faster (2s) when connecting
        intervalRef.current = setInterval(() => fetchStatus(false), statusIntervalTime);

        return () => {
            isMountedRef.current = false;
            clearInterval(intervalRef.current);
        };
    }, [fetchStatus, fetchSettings, connectionState.status]);

    const isConnected = connectionState.status === 'connected';
    const isQrCode = connectionState.status === 'qrcode';
    const deviceInfo = connectionState.deviceInfo;

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-8 animate-fade-in">

            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-navy-900 tracking-tight flex items-center gap-3">
                        <Smartphone className="w-8 h-8 text-primary-500" />
                        WhatsApp Gateway
                    </h1>
                    <p className="text-gray-500 mt-1 font-medium">Manage your device connection and monitor performance</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => fetchStatus(true)}
                        className="px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium flex items-center gap-2 transition-all shadow-sm"
                        disabled={connectionState.loading}
                    >
                        <RefreshCw className={`w-4 h-4 ${connectionState.loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                    {connectionState.status !== 'disconnected' && (
                        <button
                            onClick={handleDisconnect}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 font-medium flex items-center gap-2 transition-all shadow-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            Disconnect / Reset
                        </button>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* LEFT COLUMN: Connection Card */}
                <div className="lg:col-span-1">
                    <div className={`rounded-2xl shadow-2xl overflow-hidden border flex flex-col h-full relative ${isConnected
                        ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-200'
                        : 'bg-white border-gray-100'
                        }`}>

                        {/* Status Strip */}
                        <div className={`h-2 w-full ${isConnected ? 'bg-gradient-to-r from-green-400 via-emerald-500 to-teal-600' :
                            isQrCode ? 'bg-gradient-to-r from-blue-400 to-indigo-600 animate-pulse' :
                                'bg-gradient-to-r from-gray-300 to-gray-400'
                            }`} />

                        <div className="p-8 flex-1 flex flex-col items-center justify-center text-center relative z-10">

                            {/* Connection Visual (Enlarged & Optimized) */}
                            <div className="mb-6 relative transition-all duration-500 ease-out">
                                {isConnected ? (
                                    <div className="relative">
                                        <div className="w-48 h-48 bg-gradient-to-br from-green-400 to-emerald-600 rounded-[2.5rem] flex items-center justify-center relative z-10 shadow-3xl shadow-green-500/40 rotate-3 hover:rotate-0 transition-all duration-500 border-4 border-white">
                                            <Smartphone className="w-24 h-24 text-white drop-shadow-md" strokeWidth={2} />
                                        </div>
                                        {/* Premium Badge (Fixed Z-Index) */}
                                        <div className="absolute -bottom-4 -right-4 bg-white p-3 rounded-full shadow-2xl border-[6px] border-green-50 transform scale-110 hover:scale-125 transition-transform z-20">
                                            <CheckCircle className="w-12 h-12 text-green-500 fill-green-500" strokeWidth={0} />
                                        </div>
                                    </div>
                                ) : isQrCode && connectionState.qrCode ? (
                                    <div className="bg-white p-4 rounded-3xl shadow-xl border border-gray-100 flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300 group">
                                        <div className="relative">
                                            <QRCodeSVG
                                                value={connectionState.qrCode}
                                                size={220}
                                                level="H"
                                                includeMargin={true}
                                                className="group-hover:opacity-90 transition-opacity"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                <div className="bg-white p-1.5 rounded-full shadow-lg border border-gray-50">
                                                    <Smartphone className="w-8 h-8 text-green-500 fill-green-50" />
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest bg-gray-50 py-1.5 px-3 rounded-full">
                                            <QrCode className="w-3 h-3" />
                                            Scan with WhatsApp
                                        </div>
                                    </div>
                                ) : (
                                    <div className="w-40 h-40 bg-gray-100 rounded-[2.5rem] flex items-center justify-center shadow-inner border-4 border-white">
                                        <Smartphone className="w-20 h-20 text-gray-400" />
                                    </div>
                                )}
                            </div>

                            {/* Status Text (Tighter Spacing) */}
                            <h2 className="text-2xl font-black text-navy-900 mb-1">
                                {isConnected ? '🟢 Device Connected' : isQrCode ? '📱 Scan QR Code' : '⚪ Device Disconnected'}
                            </h2>
                            <p className="text-sm text-gray-600 mb-4 max-w-[280px] leading-relaxed">
                                {isConnected ? `Successfully connected to ${deviceInfo?.name || 'WhatsApp'}` :
                                    isQrCode ? 'Open WhatsApp on your phone and scan this code to link your device.' :
                                        'Click the button below to generate a QR code and connect your WhatsApp.'}
                            </p>

                            {/* Action Button */}
                            {!isConnected && !isQrCode && (
                                <button
                                    onClick={handleConnect}
                                    disabled={connectionState.loading}
                                    className="w-full py-4 px-6 bg-gradient-to-r from-navy-900 to-navy-700 text-white rounded-xl font-bold hover:shadow-2xl hover:scale-105 transition-all shadow-lg shadow-navy-900/30 flex items-center justify-center gap-2"
                                >
                                    <QrCode className="w-5 h-5" />
                                    {connectionState.loading ? 'Initializing...' : 'Start Connection'}
                                </button>
                            )}

                        </div>

                        {/* Connected Device Info (Original Design) */}
                        {isConnected && deviceInfo && (
                            <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 m-3 rounded-2xl p-6 text-white relative overflow-hidden shadow-2xl">
                                <div className="absolute top-0 right-0 p-4 opacity-5">
                                    <Cpu className="w-32 h-32" />
                                </div>

                                <div className="relative z-10 space-y-5">
                                    <div>
                                        <p className="text-xs text-primary-400 font-black tracking-widest uppercase mb-2 flex items-center gap-2">
                                            <Wifi className="w-3 h-3" />
                                            CONNECTED ACCOUNT
                                        </p>
                                        <p className="text-xl font-black text-white">{deviceInfo.name}</p>
                                        <p className="text-sm text-gray-300 font-mono tracking-wide mt-1">{deviceInfo.number}</p>
                                    </div>

                                    <div className="h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="bg-white/5 rounded-xl p-3 backdrop-blur-sm">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                                                <Cpu className="w-3 h-3" /> Platform
                                            </p>
                                            <p className="text-sm font-bold text-primary-300">{deviceInfo.platform}</p>
                                        </div>
                                        <div className="bg-white/5 rounded-xl p-3 backdrop-blur-sm">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase mb-1 flex items-center gap-1">
                                                <Battery className="w-3 h-3" /> Status
                                            </p>
                                            <p className="text-sm font-bold text-green-400">● Online</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Stats & Tools */}
                <div className="lg:col-span-2 space-y-6">

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {statsDisplay.map((stat, idx) => {
                            const Icon = stat.icon;
                            return (
                                <div key={idx} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className={`p-3 rounded-xl ${stat.bg}`}>
                                            <Icon className={`w-6 h-6 ${stat.color}`} />
                                        </div>
                                        {stat.trendUp && <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">+2.5%</span>}
                                    </div>
                                    <div>
                                        <p className="text-gray-500 text-sm font-medium">{stat.label}</p>
                                        <h3 className="text-2xl font-black text-navy-900 mt-1">{stat.value}</h3>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Quick Settings */}
                    <div className="card p-6 bg-white dark:bg-[#1f2937] border-gray-100 dark:border-gray-700">
                        <h2 className="text-lg font-bold text-navy-900 dark:text-white mb-6 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-amber-500" />
                            Quick Settings
                        </h2>

                        <div className="space-y-6">
                            {/* Auto Reply Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${autoReply ? 'bg-green-100 text-green-600' : 'bg-gray-200 text-gray-500'}`}>
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-navy-900 dark:text-white">Auto Reply</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Automatically reply to new incoming messages</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={autoReply} onChange={(e) => updateSettings('autoReply', e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                                </label>
                            </div>

                            {/* Auto Read Toggle (NEW) */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${autoRead ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
                                        <Eye className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-navy-900 dark:text-white">Auto Read</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Automatically mark new messages as read (Blue Tick)</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={autoRead} onChange={(e) => updateSettings('autoRead', e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
                                </label>
                            </div>

                            {/* Read Receipts Toggle */}
                            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${readReceipts ? 'bg-orange-100 text-orange-600' : 'bg-gray-200 text-gray-500'}`}>
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-navy-900 dark:text-white">Read Receipts</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Show blue ticks when messages are read</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" checked={readReceipts} onChange={(e) => updateSettings('readReceipts', e.target.checked)} className="sr-only peer" />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div >
    );
}