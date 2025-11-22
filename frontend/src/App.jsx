// frontend/src/App.jsx - Fixed Styling
import { useState, useEffect } from 'react';

function App() {
  const [apiStatus, setApiStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [tone, setTone] = useState('casual');
  const [length, setLength] = useState('short');
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');

  const API_URL = 'http://localhost:5000';

  useEffect(() => {
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      const response = await fetch(`${API_URL}/api/health`);
      const data = await response.json();
      setApiStatus(data);
      setLoading(false);
    } catch (err) {
      console.error('Health check failed:', err);
      setApiStatus({ success: false, error: err.message });
      setLoading(false);
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    
    if (!prompt.trim()) {
      setError('Please enter a prompt');
      return;
    }

    setGenerating(true);
    setError('');
    setResult('');

    try {
      const response = await fetch(`${API_URL}/api/ai/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, tone, length })
      });

      const data = await response.json();

      if (data.success) {
        setResult(data.message);
      } else {
        setError(data.error || 'Failed to generate message');
      }
    } catch (err) {
      console.error('Generate failed:', err);
      setError(err.message || 'Failed to connect to backend');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    alert('Copied to clipboard!');
  };

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ 
            animation: 'spin 1s linear infinite',
            width: '48px',
            height: '48px',
            border: '4px solid #e5e7eb',
            borderTopColor: '#2563eb',
            borderRadius: '50%',
            margin: '0 auto'
          }}></div>
          <p style={{ marginTop: '16px', color: '#6b7280' }}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f3f4f6' }}>
      {/* Header */}
      <div style={{ backgroundColor: 'white', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', borderBottom: '1px solid #e5e7eb' }}>
        <div style={{ maxWidth: '896px', margin: '0 auto', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#111827', marginBottom: '4px' }}>
                🚀 ZABRAN Broadcast System
              </h1>
              <p style={{ fontSize: '14px', color: '#6b7280' }}>AI Message Generator Test</p>
            </div>
            
            <div style={{ 
              padding: '8px 12px',
              borderRadius: '9999px',
              fontSize: '14px',
              fontWeight: '500',
              backgroundColor: apiStatus?.success && apiStatus?.services?.database === 'connected' ? '#d1fae5' : '#fee2e2',
              color: apiStatus?.success && apiStatus?.services?.database === 'connected' ? '#065f46' : '#991b1b'
            }}>
              {apiStatus?.success && apiStatus?.services?.database === 'connected' ? '✅ Connected' : '❌ Disconnected'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: '896px', margin: '0 auto', padding: '32px 16px' }}>
        
        {/* Backend Status Card */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '24px', marginBottom: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px', color: '#111827' }}>Backend Status</h2>
          
          {apiStatus?.success ? (
            <div style={{ fontSize: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>API:</span>
                <span style={{ fontWeight: '500', color: '#059669' }}>{apiStatus.services?.api || 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#6b7280' }}>Database:</span>
                <span style={{ fontWeight: '500', color: '#059669' }}>{apiStatus.services?.database || 'Unknown'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#6b7280' }}>AI Service:</span>
                <span style={{ fontWeight: '500', color: '#059669' }}>{apiStatus.services?.ai || 'Unknown'}</span>
              </div>
            </div>
          ) : (
            <div style={{ color: '#dc2626' }}>❌ Backend not connected! Make sure backend is running on port 5000.</div>
          )}
        </div>

        {/* Generator Form */}
        <div style={{ backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)', padding: '24px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '24px', color: '#111827' }}>🤖 AI Message Generator</h2>
          
          <form onSubmit={handleGenerate}>
            {/* Prompt */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Message Prompt
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="e.g., Promo diskon 50% untuk produk elektronik bulan ini"
                rows={4}
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  resize: 'vertical',
                  fontFamily: 'inherit'
                }}
                disabled={generating}
              />
            </div>

            {/* Tone */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Tone
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {['casual', 'formal', 'urgent'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTone(t)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: generating ? 'not-allowed' : 'pointer',
                      backgroundColor: tone === t ? '#2563eb' : '#f3f4f6',
                      color: tone === t ? 'white' : '#374151',
                      transition: 'all 0.2s'
                    }}
                    disabled={generating}
                    onMouseEnter={(e) => {
                      if (tone !== t && !generating) e.target.style.backgroundColor = '#e5e7eb';
                    }}
                    onMouseLeave={(e) => {
                      if (tone !== t) e.target.style.backgroundColor = '#f3f4f6';
                    }}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Length */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Length
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
                {['short', 'medium', 'long'].map((l) => (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLength(l)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: '500',
                      border: 'none',
                      cursor: generating ? 'not-allowed' : 'pointer',
                      backgroundColor: length === l ? '#2563eb' : '#f3f4f6',
                      color: length === l ? 'white' : '#374151',
                      transition: 'all 0.2s'
                    }}
                    disabled={generating}
                    onMouseEnter={(e) => {
                      if (length !== l && !generating) e.target.style.backgroundColor = '#e5e7eb';
                    }}
                    onMouseLeave={(e) => {
                      if (length !== l) e.target.style.backgroundColor = '#f3f4f6';
                    }}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={generating || !apiStatus?.success}
              style={{
                width: '100%',
                backgroundColor: (generating || !apiStatus?.success) ? '#9ca3af' : '#2563eb',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '8px',
                fontWeight: '500',
                border: 'none',
                cursor: (generating || !apiStatus?.success) ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                transition: 'background-color 0.2s'
              }}
              onMouseEnter={(e) => {
                if (!generating && apiStatus?.success) e.target.style.backgroundColor = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                if (!generating && apiStatus?.success) e.target.style.backgroundColor = '#2563eb';
              }}
            >
              {generating ? '⏳ Generating...' : '✨ Generate Message'}
            </button>
          </form>

          {/* Error Message */}
          {error && (
            <div style={{ 
              marginTop: '24px', 
              padding: '16px', 
              backgroundColor: '#fef2f2', 
              border: '1px solid #fecaca', 
              borderRadius: '8px',
              color: '#991b1b'
            }}>
              ❌ {error}
            </div>
          )}

          {/* Result */}
          {result && (
            <div style={{ 
              marginTop: '24px', 
              padding: '24px', 
              backgroundColor: '#f0fdf4', 
              border: '2px solid #86efac', 
              borderRadius: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>✅ Generated Message</h3>
                <button
                  onClick={handleCopy}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#2563eb',
                    color: 'white',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '500',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.target.style.backgroundColor = '#1d4ed8'}
                  onMouseLeave={(e) => e.target.style.backgroundColor = '#2563eb'}
                >
                  📋 Copy
                </button>
              </div>
              <div style={{ 
                backgroundColor: 'white', 
                padding: '16px', 
                borderRadius: '8px',
                whiteSpace: 'pre-wrap',
                lineHeight: '1.6'
              }}>
                <p style={{ color: '#1f2937', margin: 0 }}>{result}</p>
              </div>
            </div>
          )}
        </div>

        {/* Example Prompts */}
        <div style={{ 
          marginTop: '24px', 
          padding: '24px', 
          backgroundColor: 'white', 
          borderRadius: '8px', 
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)' 
        }}>
          <h3 style={{ fontSize: '14px', fontWeight: '600', color: '#374151', marginBottom: '12px' }}>
            💡 Example Prompts
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[
              'Promo diskon 50% untuk produk elektronik',
              'Undangan webinar digital marketing gratis',
              'Reminder pembayaran invoice jatuh tempo',
              'Ucapan selamat Idul Fitri untuk customer'
            ].map((example, i) => (
              <button
                key={i}
                onClick={() => setPrompt(example)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px 16px',
                  backgroundColor: '#f9fafb',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: '#374151',
                  cursor: 'pointer',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
                onMouseLeave={(e) => e.target.style.backgroundColor = '#f9fafb'}
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;