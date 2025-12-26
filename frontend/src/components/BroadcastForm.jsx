// frontend/src/components/BroadcastForm.jsx - ✅ CLEANED VERSION (NO i18n)
import { useState, useEffect } from 'react';
import { X, Send, Upload, FileText, AlertCircle, Clock, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from '../utils/axios';

export default function BroadcastForm({ onCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    templateId: '',
    recipients: '',
    scheduleTime: null
  });
  const [sendNow, setSendNow] = useState(true);
  const [csvFile, setCsvFile] = useState(null);
  const [csvPreview, setCsvPreview] = useState(null);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await axios.get('/templates');
        
        if (data.success) {
          setTemplates(data.data || []);
          if (data.data && data.data.length > 0) {
            setFormData(prev => ({ ...prev, templateId: data.data[0]._id }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
        toast.error('Failed to load templates');
      }
    };
    
    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Please upload a valid CSV file');
      return;
    }

    setCsvFile(file);
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        if (lines.length < 2) {
          toast.error('CSV file is empty or has no data');
          return;
        }

        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : ',';

        const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase());
        const phoneIndex = headers.findIndex(h => h.includes('PHONE'));
        const nameIndex = headers.findIndex(h => h.includes('NAME'));
        
        if (phoneIndex === -1) {
          toast.error('CSV must have a PHONE column');
          return;
        }

        const recipients = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim());
          
          const phone = values[phoneIndex];
          if (!phone) continue;
          
          const recipient = {
            phone: phone.replace(/\D/g, ''),
            name: nameIndex !== -1 && values[nameIndex] ? values[nameIndex] : ''
          };
          
          recipients.push(recipient);
        }

        if (recipients.length === 0) {
          toast.error('No valid recipients found in CSV');
          return;
        }

        setCsvPreview({
          total: recipients.length,
          sample: recipients.slice(0, 5)
        });

        setFormData(prev => ({
          ...prev,
          recipients: JSON.stringify(recipients, null, 2)
        }));

        toast.success(`Successfully loaded ${recipients.length} recipients from CSV`);
      } catch (error) {
        console.error('CSV parse error:', error);
        toast.error('Failed to parse CSV file');
      }
    };
    
    reader.readAsText(file);
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    return now.toISOString().slice(0, 16);
  };

  const getMaxDateTime = () => {
    const maxDate = new Date();
    maxDate.setDate(maxDate.getDate() + 30);
    return maxDate.toISOString().slice(0, 16);
  };

  const getSchedulePreview = () => {
    if (!formData.scheduleTime) return null;
    
    const scheduledDate = new Date(formData.scheduleTime);
    const now = new Date();
    const diff = scheduledDate - now;
    
    if (diff < 0) return 'Time is in the past';
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    let timeStr = "";
    if (days > 0) timeStr += `${days}d `;
    if (hours > 0) timeStr += `${hours}h `;
    if (minutes > 0) timeStr += `${minutes}m`;
    
    return `Starts in ${timeStr.trim()}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('='.repeat(70));
    console.log('📊 FORM STATE CHECK:');
    console.log('  name:', formData.name);
    console.log('  templateId:', formData.templateId);
    console.log('  recipients (raw):', formData.recipients);
    console.log('  recipients length:', formData.recipients?.length);
    console.log('  sendNow:', sendNow);
    console.log('  scheduleTime:', formData.scheduleTime);
    console.log('='.repeat(70));
    
    // ✅ VALIDATION
    if (!formData.name.trim()) {
      console.error('❌ Validation failed: name is empty');
      toast.error('Campaign name is required');
      return;
    }

    if (!formData.templateId) {
      console.error('❌ Validation failed: templateId is empty');
      toast.error('Please select a template');
      return;
    }

    if (!formData.recipients.trim()) {
      console.error('❌ Validation failed: recipients is empty');
      toast.error('Please add at least one recipient');
      return;
    }

    if (!sendNow && !formData.scheduleTime) {
      console.error('❌ Validation failed: schedule time missing');
      toast.error('Please select a schedule time');
      return;
    }

    if (!sendNow && new Date(formData.scheduleTime) <= new Date()) {
      console.error('❌ Validation failed: schedule time in past');
      toast.error('Schedule time must be in the future');
      return;
    }

    try {
      setLoading(true);

      // ✅ PARSE RECIPIENTS
      let recipientsList;
      try {
        recipientsList = JSON.parse(formData.recipients);
        console.log('✅ Recipients parsed as JSON:', recipientsList);
      } catch (parseError) {
        console.warn('⚠️ JSON parse failed, trying CSV format...');
        recipientsList = formData.recipients
          .split(',')
          .map(r => r.trim())
          .filter(r => r)
          .map(phone => ({ phone: phone.replace(/\D/g, '') }));
        console.log('✅ Recipients parsed as CSV:', recipientsList);
      }

      // ✅ VALIDATE RECIPIENTS ARRAY
      if (!Array.isArray(recipientsList)) {
        console.error('❌ Recipients is not an array:', typeof recipientsList);
        toast.error('Recipients must be an array');
        return;
      }

      if (recipientsList.length === 0) {
        console.error('❌ Recipients array is empty');
        toast.error('Please add at least one recipient');
        return;
      }

      console.log('✅ Recipients count:', recipientsList.length);

      // ✅ VALIDATE PHONE NUMBERS
      const invalidRecipients = recipientsList.filter(r => !r.phone || r.phone.length < 9);
      if (invalidRecipients.length > 0) {
        console.error('❌ Invalid recipients found:', invalidRecipients);
        toast.error(`${invalidRecipients.length} recipients have invalid phone numbers`);
        return;
      }

      console.log('✅ All phone numbers are valid');

      // ✅ BUILD PAYLOAD
      const payload = {
        name: formData.name.trim(),
        templateId: formData.templateId,
        recipients: recipientsList,
        sendAt: sendNow ? null : formData.scheduleTime
      };

      console.log('='.repeat(70));
      console.log('📤 PAYLOAD TO SEND:');
      console.log(JSON.stringify(payload, null, 2));
      console.log('='.repeat(70));

      // ✅ SEND REQUEST
      const { data } = await axios.post('/broadcasts', payload);

      console.log('✅ SUCCESS RESPONSE:');
      console.log(JSON.stringify(data, null, 2));

      if (!data.success) {
        throw new Error(data.message || 'Failed to create broadcast');
      }

      toast.success(
        sendNow 
          ? 'Broadcast started successfully!' 
          : `Broadcast scheduled for ${new Date(formData.scheduleTime).toLocaleString()}`
      );
      
      // Reset form
      setIsOpen(false);
      setFormData({ name: '', templateId: '', recipients: '', scheduleTime: null });
      setSendNow(true);
      setCsvFile(null);
      setCsvPreview(null);
      
      if (onCreated) {
        onCreated();
      }
      
    } catch (error) {
      console.error('='.repeat(70));
      console.error('❌ ERROR DETAILS:');
      console.error('  Status:', error.response?.status);
      console.error('  Message:', error.response?.data?.message);
      console.error('  Validation Errors:', error.response?.data?.errors);
      console.error('  Full Response:', JSON.stringify(error.response?.data, null, 2));
      console.error('  Full Error:', error);
      console.error('='.repeat(70));
      
      const errorMsg = error.response?.data?.message 
        || error.response?.data?.errors?.[0]?.msg
        || error.message
        || 'Failed to create broadcast';
      
      toast.error(`❌ ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  const selectedTemplate = templates.find(t => t._id === formData.templateId);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-primary-500 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary-600 transition-colors shadow-lg"
      >
        <Send className="w-5 h-5" />
        New Broadcast
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-navy-800">Create New Broadcast</h2>
                <p className="text-sm text-gray-600">Fill in the campaign details</p>
              </div>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-6 h-6 text-gray-600" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Campaign Name */}
              <div>
                <label className="block text-sm font-bold text-navy-800 mb-2">
                  Campaign Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., Ramadan Sale 2025"
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Template */}
                <div>
                  <label className="block text-sm font-bold text-navy-800 mb-2">
                    Template <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.templateId}
                    onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">Select a template</option>
                    {templates.map(template => (
                      <option key={template._id} value={template._id}>{template.name}</option>
                    ))}
                  </select>

                  {templates.length === 0 && (
                    <p className="text-xs text-gray-500 mt-2">Loading templates...</p>
                  )}

                  <div className="mt-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                    <p className="text-xs font-bold text-gray-600 mb-2">Preview</p>
                    <div className="text-sm text-gray-700 whitespace-pre-line">
                      {selectedTemplate ? selectedTemplate.message : 'Select a template to preview'}
                    </div>
                  </div>
                </div>

                {/* Recipients */}
                <div>
                  <label className="block text-sm font-bold text-navy-800 mb-2">
                    Recipients <span className="text-red-500">*</span>
                  </label>
                  
                  <div className="mb-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 rounded-lg cursor-pointer hover:bg-blue-100 border-2 border-blue-200">
                      <Upload className="w-4 h-4" />
                      <span className="text-sm font-semibold">Upload CSV File</span>
                      <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                    </label>
                  </div>

                  <textarea
                    value={formData.recipients}
                    onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
                    placeholder='Enter recipients in JSON format:
[
  {"phone": "628123456789", "name": "John"},
  {"phone": "628987654321", "name": "Jane"}
]'
                    rows={8}
                    className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none font-mono text-sm"
                  />

                  {csvPreview && (
                    <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm font-bold text-green-800">
                        ✓ Loaded {csvPreview.total} recipients from CSV
                      </p>
                      <div className="mt-2 p-2 bg-white rounded border border-green-200">
                        <p className="text-xs font-bold text-gray-600 mb-1">Preview (first 5):</p>
                        {csvPreview.sample.map((r, i) => (
                          <p key={i} className="text-xs text-gray-700">
                            {i + 1}. {r.name || 'No name'} ({r.phone})
                          </p>
                        ))}
                        {csvPreview.total > 5 && (
                          <p className="text-xs text-gray-500 mt-1">... and {csvPreview.total - 5} more</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Variable Helper */}
              <div className="p-4 bg-yellow-50 rounded-xl border border-yellow-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-yellow-800 mb-1">💡 Use Variables in Templates</p>
                    <p className="text-xs text-yellow-700">
                      <code className="bg-yellow-100 px-2 py-0.5 rounded">{'{name}'}</code> will be replaced with the recipient's name
                    </p>
                  </div>
                </div>
              </div>

              {/* Schedule Options */}
              <div className="border-t pt-6">
                <label className="block text-sm font-bold text-navy-800 mb-4">
                  <Clock className="w-4 h-4 inline mr-2" />
                  Send Options
                </label>

                <div className="flex items-center gap-3 mb-4">
                  <input
                    type="checkbox"
                    id="sendNow"
                    checked={sendNow}
                    onChange={(e) => {
                      setSendNow(e.target.checked);
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, scheduleTime: null }));
                      }
                    }}
                    className="w-5 h-5 rounded border-2 border-gray-300"
                  />
                  <label htmlFor="sendNow" className="text-sm font-semibold text-gray-700 cursor-pointer">
                    Send immediately
                  </label>
                </div>

                {!sendNow && (
                  <div className="pl-8 space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        <Calendar className="w-4 h-4 inline mr-2" />
                        Schedule Date & Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.scheduleTime || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                        min={getMinDateTime()}
                        max={getMaxDateTime()}
                        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-primary-500 focus:outline-none"
                      />
                    </div>

                    {formData.scheduleTime && (
                      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-sm font-bold text-blue-800 mb-1">Scheduled for:</p>
                        <p className="text-sm text-blue-700">
                          {new Date(formData.scheduleTime).toLocaleString('en-US', {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                        <p className="text-xs text-blue-600 mt-1">{getSchedulePreview()}</p>
                      </div>
                    )}

                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="text-xs text-gray-600">
                        ⏰ Schedule between 5 minutes from now and up to 30 days in advance
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 justify-end pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl font-bold hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="px-6 py-3 bg-primary-500 text-white rounded-xl font-bold flex items-center gap-2 hover:bg-primary-600 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {sendNow ? 'Sending...' : 'Scheduling...'}
                    </>
                  ) : (
                    <>
                      {sendNow ? <Send className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                      {sendNow ? 'Send Now' : 'Schedule Broadcast'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}