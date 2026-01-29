import { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { MessageCircle, Loader2, Save } from 'lucide-react';

export default function AutoReply() {
    const [settings, setSettings] = useState({
        autoReplyEnabled: false
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadSettings();
    }, []);

    const loadSettings = async () => {
        try {
            setLoading(true);
            const response = await axios.get('/api/settings');
            if (response.data.success) {
                setSettings({
                    autoReplyEnabled: response.data.data.autoReply || response.data.data.autoReplyEnabled || false
                });
            }
        } catch (error) {
            toast.error('Gagal memuat pengaturan');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await axios.put('/api/settings', {
                autoReply: settings.autoReplyEnabled
            });
            toast.success('Pengaturan Auto Reply disimpan');
        } catch (error) {
            toast.error('Gagal menyimpan');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="animate-slide-in p-6 max-w-4xl mx-auto">
            <div className="mb-8">
                <h1 className="text-4xl font-black text-navy-800 dark:text-white tracking-tight mb-2">Auto Reply AI</h1>
                <p className="text-gray-600 dark:text-gray-300">
                    Aktifkan fitur balasan otomatis menggunakan kecerdasan buatan (AI) untuk merespons pelanggan Anda secara instan dan cerdas.
                </p>
            </div>

            <div className="card p-8 shadow-xl rounded-3xl bg-white dark:bg-[#1f2937] border border-gray-100 dark:border-gray-700">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className={`w-20 h-20 rounded-2xl flex items-center justify-center shadow-lg transition-all ${settings.autoReplyEnabled
                            ? 'bg-gradient-to-br from-green-400 to-green-600 text-white shadow-green-500/30'
                            : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
                            }`}>
                            <MessageCircle className="w-10 h-10" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-navy-900 dark:text-white">Status Auto Reply</h2>
                            <p className="text-gray-500 dark:text-gray-400 mt-1">
                                {settings.autoReplyEnabled
                                    ? 'AI sedang aktif membalas pesan pelanggan.'
                                    : 'Fitur non-aktif. Pesan tidak akan dibalas otomatis.'}
                            </p>
                        </div>
                    </div>

                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={settings.autoReplyEnabled}
                            onChange={(e) => setSettings({ autoReplyEnabled: e.target.checked })}
                            className="sr-only peer"
                        />
                        <div className="w-20 h-10 bg-gray-200 dark:bg-gray-700 peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-8 after:w-8 after:transition-all peer-checked:bg-green-500 shadow-inner"></div>
                    </label>
                </div>

                <div className="mt-10 border-t border-gray-100 pt-6 flex justify-end">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="bg-navy-900 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/20"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        Simpan Perubahan
                    </button>
                </div>
            </div>

            <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800 p-6 rounded-2xl">
                <h3 className="font-bold text-blue-900 dark:text-blue-300 mb-2">Info Konteks Percakapan</h3>
                <p className="text-blue-800/80 dark:text-blue-300/80 text-sm leading-relaxed">
                    AI telah dikonfigurasi untuk <strong>membaca riwayat percakapan</strong>. Artinya, balasan yang diberikan akan menyesuaikan dengan konteks chat sebelumnya, bukan hanya membalas pesan terakhir saja.
                </p>
            </div>
        </div>
    );
}
