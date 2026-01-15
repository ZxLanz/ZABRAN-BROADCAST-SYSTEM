// frontend/src/pages/WhatsApp.jsx
import { useState, useEffect, useCallback, useRef } from 'react';
import {
    Smartphone, QrCode, CheckCircle, XCircle, AlertCircle,
    MessageSquare, Users, Clock, TrendingUp, RefreshCw,
    LogOut, Zap, Shield, Globe, Cpu, Wifi, Battery
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import axios from '../utils/axios';
import { toast } from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

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
            const { data } = await axios.get(`${API_URL}/whatsapp/stats`);
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
            const { data } = await axios.get(`${API_URL}/settings`);
            if (data.success && isMountedRef.current) {
                setAutoReply(data.data.autoReplyEnabled || false);
                setReadReceipts(data.data.readReceiptsEnabled !== false);
            }
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            if (isMountedRef.current) setLoadingSettings(false);
        }
    }, []);

    // Update Settings
    const updateSettings = async (key, value) => {
        if (key === 'autoReplyEnabled') setAutoReply(value);
        if (key === 'readReceiptsEnabled') setReadReceipts(value);
        setIsSavingSettings(true);
        try {
            const { data } = await axios.put(`${API_URL}/settings`, { [key]: value });
            if (!data.success) throw new Error('Failed to save settings');
            toast.success('Settings updated');
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
            const { data: statusData } = await axios.get(`${API_URL}/whatsapp/status`);

            let newQrCode = null;
            if (statusData.status === 'qrcode') {
                try {
                    const { data: qrData } = await axios.get(`${API_URL}/whatsapp/qr`);
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
        setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            const { data } = await axios.post(`${API_URL}/whatsapp/connect`);
            if (data.success) {
                toast.success('Initializing connection...');
                setTimeout(() => fetchStatus(false), 2000);
            }
        } catch (error) {
            toast.error('Failed to start connection');
            setConnectionState(prev => ({ ...prev, loading: false }));
        }
    };

    const handleDisconnect = async () => {
        if (!window.confirm('Are you sure you want to disconnect?')) return;
        setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            await axios.post(`${API_URL}/whatsapp/logout`);
            toast.success('Disconnected successfully');
            setTimeout(() => fetchStatus(true), 1000);
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

        const statusIntervalTime = connectionState.status === 'connected' ? 30000 : 5000;
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
                    {isConnected && (
                        <button
                            onClick={handleDisconnect}
                            className="px-4 py-2 bg-red-50 text-red-600 border border-red-100 rounded-lg hover:bg-red-100 font-medium flex items-center gap-2 transition-all shadow-sm"
                        >
                            <LogOut className="w-4 h-4" />
                            Disconnect
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

                            {/* Connection Visual */}
                            <div className="mb-8 relative">
                                {isConnected ? (
                                    <div className="relative">
                                        <div className="w-32 h-32 bg-gradient-to-br from-green-400 to-emerald-600 rounded-3xl flex items-center justify-center relative z-10 shadow-2xl shadow-green-500/30 rotate-6 hover:rotate-0 transition-transform duration-300">
                                            <Smartphone className="w-16 h-16 text-white" strokeWidth={2.5} />
                                        </div>
                                        <div className="absolute inset-0 bg-green-300 rounded-3xl animate-ping opacity-20"></div>
                                        {/* Larger, more visible checkmark */}
                                        <div className="absolute -bottom-2 -right-2 bg-white p-2.5 rounded-full shadow-2xl border-4 border-green-50">
                                            <CheckCircle className="w-10 h-10 text-green-500 fill-green-500" strokeWidth={0} />
                                        </div>
                                    </div>
                                ) : isQrCode && connectionState.qrCode ? (
                                    <div className="bg-white p-3 rounded-2xl border-4 border-primary-200 shadow-2xl">
                                        <QRCodeSVG value={connectionState.qrCode} size={220} level="H" />
                                    </div>
                                ) : (
                                    <div className="w-32 h-32 bg-gray-100 rounded-3xl flex items-center justify-center shadow-inner">
                                        <Smartphone className="w-16 h-16 text-gray-400" />
                                    </div>
                                )}
                            </div>

                            {/* Status Text */}
                            <h2 className="text-2xl font-black text-navy-900 mb-2">
                                {isConnected ? '🟢 Device Connected' : isQrCode ? '📱 Scan QR Code' : '⚪ Device Disconnected'}
                            </h2>
                            <p className="text-sm text-gray-600 mb-8 max-w-[280px] leading-relaxed">
                                {isConnected ? `Successfully connected to ${deviceInfo?.name || 'WhatsApp'}` :
                                    isQrCode ? 'Open WhatsApp on your phone and scan this code to link device.' :
                                        'Start a new session to connect your WhatsApp account.'}
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

                        {/* Connected Device Info (Only if connected) */}
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
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h3 className="text-lg font-bold text-navy-900 mb-6 flex items-center gap-2">
                            <Zap className="w-5 h-5 text-primary-500" />
                            Quick Settings
                        </h3>

                        <div className="space-y-4">
                            {/* Auto Reply */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-primary-100 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${autoReply ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <MessageSquare className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-navy-800">Auto Reply</p>
                                        <p className="text-xs text-gray-500">Automatically reply to new incoming messages</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={autoReply}
                                        onChange={() => updateSettings('autoReplyEnabled', !autoReply)}
                                        disabled={loadingSettings || isSavingSettings}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                </label>
                            </div>

                            {/* Read Receipts */}
                            <div className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-primary-100 transition-colors">
                                <div className="flex items-center gap-4">
                                    <div className={`p-2 rounded-lg ${readReceipts ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                        <CheckCircle className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-navy-800">Read Receipts</p>
                                        <p className="text-xs text-gray-500">Show blue ticks when messages are read</p>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={readReceipts}
                                        onChange={() => updateSettings('readReceiptsEnabled', !readReceipts)}
                                        disabled={loadingSettings || isSavingSettings}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-500"></div>
                                </label>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}