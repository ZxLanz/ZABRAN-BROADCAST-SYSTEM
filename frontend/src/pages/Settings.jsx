// frontend/src/pages/Settings.jsx - ✅ CONSISTENT DESIGN WITH BROADCASTS
import ConfirmModal from '../components/ConfirmModal'; // Import Modal

export default function Settings() {
  const { theme, setTheme } = useTheme();

  // Loading States
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [refreshingWA, setRefreshingWA] = useState(false);

  // Modal State
  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    type: 'danger',
    onConfirm: () => { }
  });

  // Settings State
  const [settings, setSettings] = useState({
    readReceipts: true,
    notifications: true,
    theme: 'light'
  });

  // ... (Existing WhatsApp State) ...
  const [whatsappStatus, setWhatsappStatus] = useState({
    connected: false,
    device: '',
    qrCode: ''
  });
  const [connectingWA, setConnectingWA] = useState(false);

  // ... (Existing useEffects) ...
  useEffect(() => {
    loadSettings();
    checkWhatsAppStatus();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      checkWhatsAppStatus();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadSettings = async () => {
    // ... (same implementation)
    try {
      setLoading(true);
      const response = await axios.get('/api/settings');

      if (response.data.success) {
        const loadedSettings = response.data.data;
        setSettings(loadedSettings);
        setTheme(loadedSettings.theme);
      }
    } catch (error) {
      console.error('Load settings error:', error);
      toast.error('Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const checkWhatsAppStatus = async () => {
    // ... (same implementation)
    try {
      const response = await axios.get('/api/whatsapp/status');
      if (response.data.success) {
        const isConnected = response.data.status === 'connected';

        let deviceString = '';
        if (response.data.deviceInfo) {
          const { name, number } = response.data.deviceInfo;
          deviceString = `${name} (${number})`;
        }

        setWhatsappStatus(prev => ({
          ...prev,
          connected: isConnected,
          device: deviceString
        }));
      }
    } catch (error) {
      console.error('WhatsApp status error:', error);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshingWA(true);
    await checkWhatsAppStatus();
    setTimeout(() => setRefreshingWA(false), 500);
  };

  const handleSave = async () => {
    // ... (same implementation)
    try {
      setSaving(true);

      const response = await axios.put('/api/settings', settings);

      if (response.data.success) {
        toast.success('Settings saved successfully');
        setTheme(settings.theme);
      }
    } catch (error) {
      console.error('Save settings error:', error);
      toast.error(error.response?.data?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // ✅ NEW HANDLER FOR RESET
  const confirmReset = () => {
    setConfirmModal({
      open: true,
      title: 'Reset Settings?',
      message: 'This will restore all settings to their default values. This action cannot be undone.',
      confirmText: 'Yes, Reset Defaults',
      type: 'warning',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        await executeReset();
      }
    });
  };

  const executeReset = async () => {
    try {
      setResetting(true);
      const response = await axios.post('/api/settings/reset');

      if (response.data.success) {
        setSettings(response.data.data);
        setTheme(response.data.data.theme);
        toast.success('Settings reset to default');
      }
    } catch (error) {
      console.error('Reset settings error:', error);
      toast.error('Failed to reset settings');
    } finally {
      setResetting(false);
    }
  };

  const handleConnectWhatsApp = async () => {
    // ... (same implementation)
    try {
      setConnectingWA(true);
      const response = await axios.post('/api/whatsapp/connect');

      if (response.data.success) {
        toast.success('WhatsApp connection initiated');

        if (response.data.status !== 'connected') {
          setTimeout(async () => {
            try {
              const qrResponse = await axios.get('/api/whatsapp/qr');
              if (qrResponse.data.success && qrResponse.data.qrCode) {
                setWhatsappStatus(prev => ({
                  ...prev,
                  qrCode: qrResponse.data.qrCode
                }));
                toast.success('QR code ready for scanning');
              }
            } catch (err) {
              console.error('QR fetch error:', err);
            }
          }, 2000);
        }

        await checkWhatsAppStatus();
      }
    } catch (error) {
      console.error('Connect WhatsApp error:', error);
      toast.error('Failed to connect WhatsApp');
    } finally {
      setConnectingWA(false);
    }
  };

  // ✅ NEW HANDLER FOR DISCONNECT
  const confirmDisconnect = () => {
    setConfirmModal({
      open: true,
      title: 'Disconnect WhatsApp?',
      message: 'You will need to scan the QR code again to reconnect. Are you sure?',
      confirmText: 'Yes, Disconnect',
      type: 'danger',
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, open: false }));
        await executeDisconnect();
      }
    });
  };

  const executeDisconnect = async () => {
    try {
      const response = await axios.post('/api/whatsapp/logout');

      if (response.data.success) {
        toast.success('WhatsApp disconnected successfully');
        setWhatsappStatus({
          connected: false,
          device: '',
          qrCode: ''
        });
        await checkWhatsAppStatus();
      }
    } catch (error) {
      console.error('Disconnect WhatsApp error:', error);
      toast.error('Failed to disconnect WhatsApp');
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));

    if (key === 'theme') {
      setTheme(value);
    }
  };

  return (
    <div className="animate-slide-in">
      <ConfirmModal
        open={confirmModal.open}
        onClose={() => setConfirmModal(prev => ({ ...prev, open: false }))}
        onConfirm={confirmModal.onConfirm}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        type={confirmModal.type}
      />

      {/* Page Header - CONSISTENT STYLE */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1">
              Settings
            </h1>
            <p className="text-base text-gray-600 font-medium">
              Manage your application preferences and configurations
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={confirmReset} // ✅ UPDATED
              disabled={resetting}
              className="bg-gray-100 text-gray-700 px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-gray-200 transition-colors"
            >
              {resetting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <RotateCcw className="w-5 h-5" />
              )}
              <span>Reset</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-primary-600 transition-colors shadow-md"
            >
              {saving ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Save className="w-5 h-5" />
              )}
              <span>Save Changes</span>
            </button>
          </div>
        </div>
      </div>

      {/* WhatsApp Connection Card - CONSISTENT STYLE */}
      <div className="card p-7 mb-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 bg-green-500/10 border border-green-500/20 rounded-2xl flex items-center justify-center shadow-sm">
              <Smartphone className="w-7 h-7 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-navy-800 tracking-tight">WhatsApp Connection</h2>
              <p className="text-sm text-gray-600 font-medium mt-0.5">Manage your WhatsApp integration</p>
            </div>
          </div>

          <button
            onClick={handleRefreshStatus}
            disabled={refreshingWA}
            className="p-2.5 rounded-xl hover:bg-gray-100 transition-colors"
            title="Refresh Status"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${refreshingWA ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status Badge */}
          <div className="flex items-center justify-between p-5 bg-gray-50 rounded-xl border border-gray-200">
            <div className="flex items-center gap-3">
              {whatsappStatus.connected ? (
                <>
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Wifi className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-bold text-navy-800">Connected</p>
                    {whatsappStatus.device && (
                      <p className="text-sm text-gray-600 font-medium">{whatsappStatus.device}</p>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="p-2 bg-gray-100 rounded-lg">
                    <WifiOff className="w-5 h-5 text-gray-500" />
                  </div>
                  <div>
                    <p className="font-bold text-navy-800">Disconnected</p>
                    <p className="text-sm text-gray-600 font-medium">Not connected to WhatsApp</p>
                  </div>
                </>
              )}
            </div>

            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${whatsappStatus.connected
              ? 'bg-green-100 text-green-700'
              : 'bg-gray-100 text-gray-600'
              }`}>
              {whatsappStatus.connected ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  Active
                </>
              ) : (
                <>
                  <X className="w-3.5 h-3.5" />
                  Inactive
                </>
              )}
            </span>
          </div>

          {/* QR Code Display */}
          {whatsappStatus.qrCode && !whatsappStatus.connected && (
            <div className="p-6 bg-yellow-50 border-2 border-yellow-200 rounded-xl">
              <p className="text-sm font-bold text-yellow-800 mb-4">
                📱 Scan this QR code with WhatsApp on your phone
              </p>
              <div className="flex justify-center">
                <img
                  src={whatsappStatus.qrCode}
                  alt="QR Code"
                  className="w-64 h-64 border-4 border-yellow-300 rounded-xl shadow-lg"
                />
              </div>
              <p className="text-xs text-yellow-700 mt-4 text-center font-semibold">
                Open WhatsApp → Settings → Linked Devices → Link a Device
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            {whatsappStatus.connected ? (
              <button
                onClick={confirmDisconnect} // ✅ UPDATED
                className="bg-red-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-red-600 transition-colors shadow-md"
              >
                <WifiOff className="w-5 h-5" />
                <span>Disconnect</span>
              </button>
            ) : (
              <button
                onClick={handleConnectWhatsApp}
                disabled={connectingWA}
                className="bg-green-500 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-green-600 transition-colors shadow-md"
              >
                {connectingWA ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Wifi className="w-5 h-5" />
                )}
                <span>Connect WhatsApp</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* General Settings Card - CONSISTENT STYLE */}
      <div className="card p-7 mb-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-14 h-14 bg-primary-500/10 border border-primary-500/20 rounded-2xl flex items-center justify-center shadow-sm">
            <SettingsIcon className="w-7 h-7 text-primary-500" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-navy-800 tracking-tight">General Settings</h2>
            <p className="text-sm text-gray-600 font-medium mt-0.5">Configure your application preferences</p>
          </div>
        </div>

        <div className="space-y-5">
          {/* Read Receipts */}
          <div className="flex items-center justify-between py-4 border-b-2 border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-50 rounded-lg">
                <Eye className="w-5 h-5 text-purple-500" />
              </div>
              <div>
                <p className="font-bold text-navy-800">Read Receipts</p>
                <p className="text-sm text-gray-600 font-medium">Send read status for messages</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.readReceipts}
                onChange={(e) => updateSetting('readReceipts', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-300 peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500 shadow-inner"></div>
            </label>
          </div>

          {/* Notifications */}
          <div className="flex items-center justify-between py-4 border-b-2 border-gray-100">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-50 rounded-lg">
                <Bell className="w-5 h-5 text-yellow-500" />
              </div>
              <div>
                <p className="font-bold text-navy-800">Notifications</p>
                <p className="text-sm text-gray-600 font-medium">Enable application notifications</p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.notifications}
                onChange={(e) => updateSetting('notifications', e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-14 h-7 bg-gray-300 peer-focus:ring-4 peer-focus:ring-primary-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-primary-500 shadow-inner"></div>
            </label>
          </div>

          {/* Theme Selector */}
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-50 rounded-lg">
                <Palette className="w-5 h-5 text-pink-500" />
              </div>
              <div>
                <p className="font-bold text-navy-800">Theme</p>
                <p className="text-sm text-gray-600 font-medium">Choose display theme</p>
              </div>
            </div>
            <select
              value={settings.theme}
              onChange={(e) => updateSetting('theme', e.target.value)}
              className="px-4 py-2.5 border-2 border-gray-300 rounded-xl font-semibold text-gray-700 hover:border-primary-500 transition-colors min-w-[140px]"
            >
              <option value="light">☀️ Light</option>
              <option value="dark">🌙 Dark</option>
              <option value="auto">🔄 Auto</option>
            </select>
          </div>
        </div>
      </div>

    </div>
  );
}