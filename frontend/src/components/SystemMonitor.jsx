import { useState, useEffect } from 'react';
import axios from '../utils/axios';
import { Activity, Cpu, Server } from 'lucide-react';

export default function SystemMonitor() {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        try {
            const { data } = await axios.get('/settings/system-health');
            if (data.success) {
                setStats(data.data);
            }
        } catch (err) {
            console.error('Stats error:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStats();
        const interval = setInterval(fetchStats, 5000); // Poll every 5s
        return () => clearInterval(interval);
    }, []);

    if (loading || !stats) return null;

    // Format RAM
    const formatBytes = (bytes) => {
        const gb = bytes / (1024 * 1024 * 1024);
        return `${gb.toFixed(1)} GB`;
    };

    // Determine Color
    const getRamColor = (percent) => {
        if (percent < 70) return 'bg-green-100 text-green-700 border-green-200';
        if (percent < 90) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        return 'bg-red-100 text-red-700 border-red-200 animate-pulse';
    };

    return (
        <div className="hidden lg:flex items-center gap-3 mr-4">
            {/* RAM Widget */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all ${getRamColor(stats.memory.percent)}`}>
                <Activity size={14} className="mt-0.5" />
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase font-bold opacity-70">RAM Usage</span>
                    <span className="text-xs font-bold">{stats.memory.percent}% ({formatBytes(stats.memory.used)})</span>
                </div>
            </div>

            {/* Uptime Widget (Simple) */}
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border bg-gray-50 border-gray-200 text-gray-600">
                <Server size={14} className="mt-0.5" />
                <div className="flex flex-col leading-none">
                    <span className="text-[10px] uppercase font-bold opacity-70">System</span>
                    <span className="text-xs font-bold">Online</span>
                </div>
            </div>
        </div>
    );
}
