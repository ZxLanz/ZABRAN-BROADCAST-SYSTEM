// src/pages/AIGenerator.jsx
import { useState } from 'react';
import { Sparkles, Wand2, Copy, Download, RefreshCw, Loader2 } from 'lucide-react';

const AIGenerator = () => {
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('professional');
  const [length, setLength] = useState('medium');
  const [language, setLanguage] = useState('id');
  const [context, setContext] = useState('');
  const [generatedMessage, setGeneratedMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // n8n Webhook URL from .env
  const N8N_WEBHOOK_URL = import.meta.env.VITE_N8N_AI_WEBHOOK || 'http://localhost:5678/webhook/generate-message';

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setLoading(true);
    setError('');
    setGeneratedMessage('');

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
          tone: tone,
          length: length,
          language: language,
          context: context || ''
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      // Handle different response formats from n8n
      const message = data.message || data.result || data.text || JSON.stringify(data);
      setGeneratedMessage(message);

    } catch (err) {
      console.error('AI Generation Error:', err);
      setError(`Failed to generate message: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMessage);
    alert('Message copied to clipboard!');
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

  const handleReset = () => {
    setPrompt('');
    setContext('');
    setGeneratedMessage('');
    setError('');
  };

  return (
    <div className="animate-slide-in">
      {/* Header - CONSISTENT dengan Broadcast.jsx */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-black text-navy-800 flex items-center gap-3">
            <Sparkles className="w-9 h-9 text-primary-500" />
            AI Message Generator
          </h1>
          <p className="text-base text-gray-600 mt-1">
            Generate professional WhatsApp messages with AI • Powered by Google Gemini 2.5 Flash
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Input Section - CONSISTENT card styling */}
        <div className="card p-7 space-y-6">
          <h2 className="text-2xl font-black text-navy-800 flex items-center gap-2">
            <Wand2 className="w-6 h-6 text-primary-500" />
            Configure Message
          </h2>

          {/* Prompt */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">
              What message do you want to create? *
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a promotional message for Ramadan sale with 50% discount"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-all"
              rows={4}
            />
          </div>

          {/* Tone */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">
              Tone
            </label>
            <select
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-medium"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="casual">Casual</option>
              <option value="formal">Formal</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </div>

          {/* Length */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">
              Length
            </label>
            <select
              value={length}
              onChange={(e) => setLength(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-medium"
            >
              <option value="short">Short (1-2 sentences)</option>
              <option value="medium">Medium (3-5 sentences)</option>
              <option value="long">Long (6+ sentences)</option>
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">
              Language
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all font-medium"
            >
              <option value="id">Indonesian</option>
              <option value="en">English</option>
            </select>
          </div>

          {/* Context */}
          <div>
            <label className="block text-sm font-bold text-navy-700 mb-2">
              Additional Context (Optional)
            </label>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="e.g., Target audience: young professionals, Brand: Modern and innovative"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none transition-all"
              rows={3}
            />
          </div>

          {/* Buttons - CONSISTENT dengan design system */}
          <div className="flex gap-3">
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt.trim()}
              className="flex-1 bg-primary-500 text-white px-6 py-3 rounded-xl font-bold hover:bg-primary-600 transition-all disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-primary-500/30"
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
              className="px-6 py-3 border-2 border-gray-200 text-navy-700 rounded-xl hover:bg-gray-50 transition-all font-bold flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reset
            </button>
          </div>

          {/* Error - CONSISTENT styling */}
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl text-red-700 text-sm font-medium">
              {error}
            </div>
          )}
        </div>

        {/* Output Section - CONSISTENT card styling */}
        <div className="card p-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black text-navy-800">Generated Message</h2>
            {generatedMessage && (
              <div className="flex gap-2">
                <button
                  onClick={handleCopy}
                  className="btn-icon"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={handleDownload}
                  className="btn-icon"
                  title="Download as file"
                >
                  <Download className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Result */}
          <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                <Loader2 className="w-12 h-12 animate-spin mb-4 text-primary-500" />
                <p className="text-sm font-medium">AI is generating your message...</p>
              </div>
            ) : generatedMessage ? (
              <div className="p-6 bg-gradient-to-br from-primary-50 to-blue-50 rounded-xl border-2 border-primary-200">
                <p className="text-navy-800 whitespace-pre-wrap leading-relaxed font-medium">
                  {generatedMessage}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[400px] text-gray-400">
                <Sparkles className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-sm text-center font-medium">
                  Configure your message settings and click<br />
                  "Generate Message" to see AI magic! ✨
                </p>
              </div>
            )}
          </div>

          {/* Connection Status - CONSISTENT design */}
          <div className="pt-4 border-t-2 border-gray-200">
            <p className="text-xs text-gray-500 flex items-center gap-2 font-medium">
              <span className={`w-2 h-2 rounded-full ${loading ? 'bg-primary-500 animate-pulse' : generatedMessage ? 'bg-green-500' : 'bg-gray-300'}`}></span>
              {loading ? 'Connected to AI...' : generatedMessage ? 'Message generated successfully' : 'Ready to generate'}
            </p>
            <p className="text-xs text-gray-400 mt-1 font-mono">
              Webhook: {N8N_WEBHOOK_URL}
            </p>
          </div>
        </div>
      </div>

      {/* Info Box - CONSISTENT styling */}
      <div className="mt-6 bg-blue-50 border-2 border-blue-200 rounded-xl p-6">
        <h3 className="font-black text-blue-900 mb-3 flex items-center gap-2">
          💡 Tips for Better Results
        </h3>
        <ul className="text-sm text-blue-800 space-y-2 list-disc list-inside font-medium">
          <li>Be specific about your message goal (promo, reminder, announcement, etc.)</li>
          <li>Include key details like discount amount, date, or product name</li>
          <li>Specify target audience for more personalized messaging</li>
          <li>Use additional context to add brand voice or specific requirements</li>
        </ul>
      </div>
    </div>
  );
};

export default AIGenerator;