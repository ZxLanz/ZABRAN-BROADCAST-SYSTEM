// frontend/src/pages/WhatsApp.jsx - ✅ CLEANED VERSION (NO i18n)
import { useState, useEffect, useCallback, useRef } from 'react'; 
import { Smartphone, QrCode, CheckCircle, XCircle, AlertCircle, MessageSquare, Users, Clock, TrendingUp, RefreshCw, LogOut, Zap, Shield } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react'; 
import axios from '../utils/axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const mapDeviceInfo = (deviceInfo) => {
    if (!deviceInfo) return null;
    
    const phoneNumber = deviceInfo.number || 'N/A';
    const rawName = deviceInfo.name || '';
    
    const isNameSameAsNumber = rawName === phoneNumber || 
                                rawName === phoneNumber.replace('+', '') ||
                                rawName === deviceInfo.number;
    
    const displayName = isNameSameAsNumber || !rawName 
        ? 'WhatsApp User' 
        : rawName;
    
    return {
        number: phoneNumber,
        device: deviceInfo.platform || 'Unknown Device',
        userName: displayName,
        platformInfo: deviceInfo.platform || 'Baileys'
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

    const statsDisplay = [
        { 
            label: 'Total Messages',
            value: stats.messagesToday, 
            icon: MessageSquare, 
            breakdown: `↗ Sent: ${stats.messagesSent} | ↙ Received: ${stats.messagesReceived}`,
            trend: '+0%', 
            trendUp: true 
        },
        { 
            label: 'Active Chats',
            value: stats.activeChats, 
            icon: Users, 
            subtitle: 'Last 24 hours',
            trend: '+0%', 
            trendUp: true 
        },
        { 
            label: 'Response Time',
            value: stats.responseTime, 
            icon: Clock, 
            subtitle: 'Average'
        },
        { 
            label: 'Success Rate',
            value: stats.successRate, 
            icon: TrendingUp, 
            subtitle: 'Delivery rate',
            trend: '+0%', 
            trendUp: true 
        },
    ];

    const fetchStats = useCallback(async (silent = false) => {
        if (!silent) {
            setStats(prev => ({ ...prev, loading: true }));
        }
        
        try {
            const { data } = await axios.get(`${API_URL}/whatsapp/stats`);
            
            if (data.success && isMountedRef.current) {
                const newStats = {
                    messagesToday: data.stats.messagesToday?.toString() || '0',
                    messagesSent: data.stats.sentToday?.toString() || '0', 
                    messagesReceived: data.stats.receivedToday?.toString() || '0',
                    activeChats: data.stats.activeChats?.toString() || '0',
                    responseTime: data.stats.responseTime || '0m',
                    successRate: data.stats.successRate || '0%',
                    loading: false
                };
                
                setStats(prevStats => {
                    if (JSON.stringify(prevStats) !== JSON.stringify(newStats)) {
                        console.log('📊 Stats updated:', newStats);
                    }
                    return newStats;
                });
            }
    
        } catch (error) {
            console.error("Stats fetch error:", error);
            setStats(prev => ({ 
                ...prev, 
                messagesToday: '0', 
                messagesSent: '0',
                messagesReceived: '0',
                activeChats: '0', 
                responseTime: '0m', 
                successRate: '0%', 
                loading: false 
            }));
        }
    }, []);

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
            if (isMountedRef.current) {
                setLoadingSettings(false);
            }
        }
    }, []);

    const updateSettings = async (key, value) => {
        if (key === 'autoReplyEnabled') setAutoReply(value);
        if (key === 'readReceiptsEnabled') setReadReceipts(value);

        setIsSavingSettings(true); 

        try {
            const { data } = await axios.put(`${API_URL}/settings`, {
                [key]: value
            });

            if (!data.success) {
                throw new Error('Failed to save settings');
            }
            
        } catch (error) {
            console.error('Error saving settings:', error);
            fetchSettings(); 
        } finally {
            setIsSavingSettings(false); 
        }
    };

    const toggleHandler = (key, currentState) => {
        if (isSavingSettings) return;

        const newValue = !currentState;
        updateSettings(key, newValue);
    };

    const fetchStatus = useCallback(async (showLoading = false) => {
        if (showLoading) {
            setConnectionState(prev => ({ ...prev, loading: true }));
        }
        
        try {
            const { data: statusData } = await axios.get(`${API_URL}/whatsapp/status`);
            
            let newQrCode = null;

            if (statusData.status === 'qrcode') {
                try {
                    const { data: qrData } = await axios.get(`${API_URL}/whatsapp/qr`);
                    if (qrData.success) {
                        newQrCode = qrData.qrCode;
                    }
                } catch (qrError) {
                    console.log('QR code not ready yet');
                }
            }

            if (statusData.status === 'connected') {
                fetchStats();
            } else {
                setStats(prev => ({ ...prev, messagesToday: '0', messagesSent: '0', messagesReceived: '0', activeChats: '0', responseTime: '0m', successRate: '0%' }));
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
                setConnectionState({
                    status: 'error',
                    message: 'Connection Error: Failed to connect to backend.',
                    qrCode: null,
                    loading: false,
                    deviceInfo: null,
                });
            }
        }
    }, [fetchStats]);

    const handleConnect = async () => {
        setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            const { data } = await axios.post(`${API_URL}/whatsapp/connect`);
            
            if (data.success) {
                console.log('✅ Connection initialized:', data.message);
                setTimeout(() => fetchStatus(false), 2000);
            }
        } catch (error) {
            console.error('Connect error:', error);
            setConnectionState(prev => ({ ...prev, 
                status: 'error', 
                message: 'Failed to initialize connection. Check backend.',
                loading: false 
            }));
        }
    };

    const handleManualRefresh = () => {
        fetchStatus(true);
        fetchSettings();
    };

    const handleDisconnect = async () => {
        setConnectionState(prev => ({ ...prev, loading: true }));
        try {
            await axios.post(`${API_URL}/whatsapp/logout`);
            setTimeout(() => fetchStatus(true), 1000); 
        } catch (error) {
            console.error('Logout error:', error);
            setConnectionState(prev => ({ ...prev, 
                status: 'error', 
                message: 'Logout failed. Check backend console.',
                loading: false 
            }));
        }
    };
    
    useEffect(() => {
        isMountedRef.current = true;
        
        fetchStatus(true);
        fetchSettings();
        
        const setupStatusInterval = () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            
            const statusIntervalTime = connectionState.status === 'connected' ? 30000 : 5000;
            
            intervalRef.current = setInterval(() => {
                fetchStatus(false);
            }, statusIntervalTime);
        };
        
        setupStatusInterval();
        
        const statsIntervalRef = setInterval(() => {
            if (connectionState.status === 'connected') {
                fetchStats(true);
            }
        }, 3000);
        
        return () => {
            isMountedRef.current = false;
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
            clearInterval(statsIntervalRef);
        };
    }, [fetchStatus, fetchSettings, fetchStats, connectionState.status]);

    const getStatusIcon = (status) => {
        switch (status) {
            case 'connected':
                return <CheckCircle className="text-green-500 w-6 h-6" />;
            case 'qrcode':
                return <QrCode className="text-blue-500 w-6 h-6" />;
            case 'disconnected':
                return <XCircle className="text-red-500 w-6 h-6" />;
            case 'error':
                return <AlertCircle className="text-yellow-500 w-6 h-6" />;
            default:
                return <RefreshCw className="text-gray-500 w-6 h-6 animate-spin" />;
        }
    };

    const isConnected = connectionState.status === 'connected';
    const isQrCode = connectionState.status === 'qrcode';
    const displayInfo = connectionState.deviceInfo;
    const isSettingsDisabled = loadingSettings || isSavingSettings;

    return (
        <div className="p-6 animate-slide-in">
            
            <div className="mb-8">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1 flex items-center gap-3">
                            <Smartphone className="w-9 h-9 text-primary-500" />
                            WhatsApp Connection
                        </h1>
                        <p className="text-base text-gray-600 font-medium">
                            Manage your WhatsApp Business connection and monitor real-time activity.
                        </p>
                    </div>

                    <button 
                        onClick={handleManualRefresh}
                        className="btn btn-primary"
                        disabled={connectionState.loading}
                    >
                        <RefreshCw className={`w-5 h-5 ${connectionState.loading ? 'animate-spin' : ''}`} />
                        <span>{connectionState.loading ? 'Refreshing...' : 'Refresh Status'}</span>
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
                {statsDisplay.map((stat, index) => {
                    const Icon = stat.icon;
                    
                    return (
                        <div key={index} className="stat-card relative">
                            {isConnected && (
                                <div className="absolute top-4 right-4 flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                                    <span className="text-xs text-gray-500 font-medium">Live</span>
                                </div>
                            )}
                            
                            <div className="relative z-10 mb-4">
                                <div className="w-14 h-14 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-sm">
                                    <Icon className="w-7 h-7 text-primary-500" />
                                </div>
                            </div>

                            <div className="relative z-10">
                                <div className="text-sm text-gray-600 font-semibold mb-2">
                                    {stat.label}
                                </div>
                                
                                <div className="text-4xl font-black text-navy-800 tracking-tight mb-3">
                                    {isConnected ? stat.value : '0'} 
                                </div>
                                
                                {stat.breakdown && isConnected && (
                                    <div className="text-xs text-gray-600 font-semibold mb-2 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200">
                                        {stat.breakdown}
                                    </div>
                                )}

                                {stat.trend && (
                                    <div className="flex items-center gap-1.5 text-sm font-bold text-green-600">
                                        <TrendingUp className="w-4 h-4" />
                                        <span>{isConnected ? stat.trend : '0%'}</span>
                                    </div>
                                )}
                                
                                {stat.subtitle && (
                                    <div className="text-sm text-gray-600 font-semibold">
                                        {stat.subtitle}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                <div className="lg:col-span-2 card p-7">
                    
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-2xl font-black text-navy-800 tracking-tight">
                            Connection Status
                        </h2>
                        {getStatusIcon(connectionState.status)}
                    </div>

                    <div className={`p-5 rounded-xl flex items-start space-x-4 transition-all duration-300 border-2 mb-6 ${
                        isConnected ? 'bg-green-50 border-green-200' :
                        isQrCode ? 'bg-blue-50 border-blue-200' :
                        connectionState.status === 'error' ? 'bg-red-50 border-red-200' :
                        'bg-gray-100 border-gray-300'
                    }`}>
                        {getStatusIcon(connectionState.status)}
                        <div>
                            <p className={`font-bold text-lg mb-1 ${isConnected ? 'text-green-700' : isQrCode ? 'text-blue-700' : 'text-red-700'}`}>
                                {connectionState.status.toUpperCase()}
                            </p>
                            <p className="text-sm text-gray-700">{connectionState.message}</p>
                        </div>
                    </div>

                    {isQrCode && connectionState.qrCode && (
                        <div className="text-center py-6 animate-fade-in">
                            <div className="inline-block p-6 bg-white border-2 border-gray-200 rounded-2xl shadow-md">
                                <h3 className="font-bold text-lg mb-4 text-navy-800">Scan QR Code to Connect</h3>
                                <QRCodeSVG value={connectionState.qrCode} size={280} level="H" />
                                <p className="text-xs text-gray-500 mt-4">
                                    Open WhatsApp on your phone → Linked Devices → Link a Device
                                </p>
                            </div>
                        </div>
                    )}

                    {isConnected && displayInfo && (
                        <div className="animate-fade-in">
                            <h3 className="text-xl font-bold text-navy-800 mb-4 flex items-center gap-2">
                                <Shield className="w-5 h-5 text-green-500" />
                                Connected Device
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <p className="text-xs text-gray-500 font-semibold mb-1">Phone Number</p>
                                    <p className="text-lg font-bold text-primary-600">{displayInfo.number}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                                    <p className="text-xs text-gray-500 font-semibold mb-1">User Name</p>
                                    <p className="text-lg font-bold text-navy-800">{displayInfo.userName}</p>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 col-span-2">
                                    <p className="text-xs text-gray-500 font-semibold mb-1">Device / Platform</p>
                                    <p className="text-lg font-bold text-navy-800 flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-green-500" />
                                        {displayInfo.device}
                                    </p>
                                    <p className="text-xs text-gray-500 mt-1 italic">
                                        Note: Detailed device info is limited by WhatsApp API
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 flex gap-3">
                        {isConnected && (
                            <button 
                                onClick={handleDisconnect} 
                                className="flex-1 px-6 py-3 bg-red-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 transition-all shadow-md disabled:opacity-50"
                                disabled={connectionState.loading}
                            >
                                <LogOut className="w-5 h-5" />
                                Disconnect Account
                            </button>
                        )}
                        
                        {!isConnected && !isQrCode && !connectionState.loading && (
                            <button 
                                onClick={handleConnect} 
                                className="flex-1 px-6 py-3 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-navy-900 rounded-xl font-bold shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                            >
                                Connect WhatsApp
                            </button>
                        )}
                    </div>
                </div>

                <div className="card p-7">
                    <h2 className="text-2xl font-black text-navy-800 tracking-tight mb-6">
                        Settings
                    </h2>
                    
                    {loadingSettings ? (
                        <p className="text-center text-gray-500 p-4">Loading settings...</p>
                    ) : (
                    <div className="space-y-4">
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="font-bold text-navy-800 mb-1">Auto Reply</p>
                                <p className="text-xs text-gray-500">Automatically respond to messages</p>
                            </div>
                            <button
                                onClick={() => toggleHandler('autoReplyEnabled', autoReply)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoReply ? 'bg-primary-500' : 'bg-gray-300'}`}
                                disabled={isSettingsDisabled} 
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${autoReply ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-200">
                            <div>
                                <p className="font-bold text-navy-800 mb-1">Read Receipts</p>
                                <p className="text-xs text-gray-500">Show when messages are read</p>
                            </div>
                            <button
                                onClick={() => toggleHandler('readReceiptsEnabled', readReceipts)}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${readReceipts ? 'bg-primary-500' : 'bg-gray-300'}`}
                                disabled={isSettingsDisabled} 
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-md ${readReceipts ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>
                    </div>
                    )}

                    <div className="mt-6 pt-6 border-t border-gray-200">
                        <h3 className="text-sm font-bold text-gray-600 mb-3">CONNECTION INFO</h3>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Status</span>
                                <span className={`font-bold ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                                    {connectionState.status.toUpperCase()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Auto Refresh</span>
                                <span className="font-bold text-navy-800">
                                    {isConnected ? '30s' : '5s'}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}