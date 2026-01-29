// src/pages/AIGenerator.jsx
import { useState } from 'react';
import { Sparkles, Wand2, Copy, Download, RefreshCw, Loader2, Save, BrainCircuit } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from '../utils/axios';
import { useNavigate } from 'react-router-dom';

const AIGenerator = () => {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [language, setLanguage] = useState('id');
  const [model, setModel] = useState('xiaomi/mimo-v2-flash:free');
  const [context, setContext] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Save Template State
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Mohon masukkan deskripsi pesan');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedMessage('');

    try {
      const response = await axios.post('/ai/generate', {
        prompt: prompt,
        tone: tone,
        length: length,
        // language: language, // Backend logic usually handles this via prompt engineering, or we append to prompt
        model: model,
        // context: context // Can append to prompt
      });

      if (response.data.success) {
        setGeneratedMessage(response.data.message);
      } else {
        throw new Error(response.data.error || 'Gagal generate pesan');
      }

    } catch (err) {
      console.error('AI Generation Error:', err);
      setError(`Gagal membuat pesan: ${err.message}`);
      toast.error('Terjadi kesalahan saat generate AI');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMessage);
    toast.success('Pesan disalin ke clipboard!');
  };

  const handleDownload = () => {
    const blob = new Blob([generatedMessage], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ai-message-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) {
      toast.error('Nama template wajib diisi');
      return;
    }

    try {
      setIsSaving(true);
      const { data } = await axios.post('/templates', {
        name: newTemplateName,
        message: generatedMessage,
        category: 'general'
      });

      if (data.success) {
        toast.success('Template berhasil disimpan!');
        setIsSaveModalOpen(false);
        setNewTemplateName('');
        // Optional: Redirect to templates page
        // navigate('/templates');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal menyimpan template');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setPrompt('');
    setContext('');
    setGeneratedMessage('');
    setError('');
  };

  return (
    <div className="animate-slide-in relative">
      {/* Header - CONSISTENT dengan Broadcast.jsx */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-navy-800 dark:text-white flex items-center gap-3">
            <Sparkles className="w-9 h-9 text-primary-500" />
            AI Message Generator
          </h1>
          <p className="text-base text-gray-600 dark:text-gray-300 mt-1">
            Buat pesan WhatsApp profesional dengan AI • Powered by AI
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section - CONSISTENT card styling */}
        <div className="card p-7 space-y-6 bg-white dark:bg-[#1f2937] border dark:border-gray-700">
          <h2 className="text-2xl font-black text-navy-800 dark:text-white flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-primary-500" />
            Konfigurasi Pesan
          </h2>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-bold text-navy-700 dark:text-gray-200 mb-2">
              Pesan apa yang ingin Anda buat? *
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Contoh: Buat pesan promosi Ramadhan sale dengan diskon 50% untuk member setia..."
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 resize-none transition-all"
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Tone */}
            <div>
              <label className="block text-sm font-bold text-navy-700 dark:text-gray-200 mb-2">
                Nada Bicara (Tone)
              </label>
              <select
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all font-medium"
              >
                <option value="professional">Profesional</option>
                <option value="friendly">Ramah (Friendly)</option>
                <option value="casual">Santai (Casual)</option>
                <option value="formal">Formal</option>
                <option value="enthusiastic">Antusias</option>
                <option value="urgent">Mendesak (Urgent)</option>
              </select>
            </div>

            {/* Length */}
            <div>
              <label className="block text-sm font-bold text-navy-700 dark:text-gray-200 mb-2">
                Panjang Pesan
              </label>
              <select
                value={length}
                onChange={(e) => setLength(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 transition-all font-medium"
              >
                <option value="short">Pendek (1-2 kalimat)</option>
                <option value="medium">Sedang (3-5 kalimat)</option>
                <option value="long">Panjang (6+ kalimat)</option>
              </select>
            </div>
          </div>

          {/* Model Selection */}
          <div>
            <label className="block text-sm font-bold text-navy-700 dark:text-gray-200 mb-2 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4 text-primary-500" />
              Model AI
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-medium bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            >
              <option value="xiaomi/mimo-v2-flash:free">Xiaomi Mimo V2 Flash (Free)</option>
            </select>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 ml-1">*Beberapa model mungkin memerlukan akses khusus</p>
          </div>

          {/* Buttons - CONSISTENT dengan design system */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex-1 bg-primary-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-600 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30 active:scale-95"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  Generate Message
                </>
              )}
            </button>
            <button
              onClick={handleReset}
              className="px-6 py-3 border-2 border-gray-200 dark:border-gray-600 text-navy-700 dark:text-gray-200 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all font-bold flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>

          {/* Error - CONSISTENT styling */}
          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Output Section - CONSISTENT card styling */}
        <div className="card p-7 space-y-4 flex flex-col h-full bg-white dark:bg-[#1f2937] border dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-navy-800 dark:text-white">Hasil Generate</h2>
            {generatedMessage && (
              <div className="flex gap-2">
                <button
                  onClick={() => setIsSaveModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-sm font-bold text-xs"
                  title="Simpan sebagai Template"
                >
                  <Save className="w-4 h-4" />
                  Simpan Template
                </button>
                <div className="w-[1px] h-8 bg-gray-200 mx-1"></div>
                <button
                  onClick={handleCopy}
                  className="btn-icon"
                  title="Salin ke clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="btn-icon"
                  title="Download file"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="flex-1 min-h-[400px] overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-400">
                <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary-500" />
                <p className="text-sm font-medium">AI sedang berpikir...</p>
              </div>
            ) : generatedMessage ? (
              <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 rounded-xl border-2 border-primary-200 dark:border-primary-700 h-full">
                <p className="text-navy-800 dark:text-gray-100 whitespace-pre-wrap leading-relaxed font-medium">
                  {generatedMessage}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-400 dark:text-gray-500 border-2 border-dashed border-gray-100 dark:border-gray-700 rounded-xl">
                <Sparkles className="w-16 h-16 mb-4 text-gray-200 dark:text-gray-600" />
                <p className="text-sm text-center font-medium text-gray-400 dark:text-gray-500">
                  Konfigurasikan pesan Anda dan klik<br />
                  "Generate Message" untuk melihat sihir AI! ✨
                </p>
              </div>
            )}
          </div>

          {/* Connection Status - CONSISTENT design */}
          <div className="pt-4 border-t-2 border-gray-200 dark:border-gray-700 mt-auto">
            <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2 font-medium">
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-primary-500 animate-pulse' : generatedMessage ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}></span>
              {loading ? 'Menghubungkan ke AI...' : generatedMessage ? 'Pesan berhasil dibuat' : 'Siap digunakan'}
            </p>
          </div>
        </div>
      </div>

      {/* Info Box - CONSISTENT styling */}
      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h3 className="font-black text-blue-900 dark:text-blue-300 mb-3 flex items-center gap-2">
          💡 Tips untuk Hasil Terbaik
        </h3>
        <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-2 list-disc list-inside font-medium">
          <li>Jadilah lebih spesifik mengenai tujuan pesan (promo, pengingat, pengumuman, dll)</li>
          <li>Sertakan detail kunci seperti jumlah diskon, tanggal, atau nama produk</li>
          <li>Tentukan target audiens untuk pesan yang lebih personal</li>
          <li>Gunakan konteks tambahan untuk menambahkan gaya bahasa brand</li>
        </ul>
      </div>

      {/* Save Template Modal */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-navy-900/50 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-black text-navy-900 dark:text-white mb-4">Simpan Template</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-200 mb-2">Nama Template</label>
                <input
                  type="text"
                  value={newTemplateName}
                  onChange={(e) => setNewTemplateName(e.target.value)}
                  placeholder="Contoh: Promo Ramadhan 2026"
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl focus:border-primary-500 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 font-medium"
                  autoFocus
                />
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg text-xs text-gray-500 dark:text-gray-400 max-h-32 overflow-y-auto">
                {generatedMessage}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setIsSaveModalOpen(false)}
                  className="px-4 py-2 text-gray-500 dark:text-gray-400 font-bold hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={isSaving || !newTemplateName.trim()}
                  className="px-4 py-2 bg-primary-500 text-white font-bold rounded-lg hover:bg-primary-600 transition-colors shadow-lg shadow-primary-500/20 disabled:bg-gray-300"
                >
                  {isSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AIGenerator;