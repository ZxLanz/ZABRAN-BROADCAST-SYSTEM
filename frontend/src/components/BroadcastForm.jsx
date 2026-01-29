// frontend/src/components/BroadcastForm.jsx - ✅ RE-DESIGNED MULTI-STEP VERSION
import { useState, useEffect } from 'react';
import {
  X, Send, Upload, FileText, AlertCircle,
  Clock, Calendar, Check, ChevronRight, ChevronLeft,
  Users, MessageSquare, Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from '../utils/axios';

export default function BroadcastForm({ onCreated }) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
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

  // New State for Customer Selection
  const [recipientMethod, setRecipientMethod] = useState('upload'); // 'upload' or 'existing'
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState([]);
  const [customerSearch, setCustomerSearch] = useState('');
  const [isLoadingCustomers, setIsLoadingCustomers] = useState(false);

  // Fetch Templates
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const { data } = await axios.get('/templates');
        if (data.success) {
          setTemplates(data.data || []);
          if (data.data && data.data.length > 0 && !formData.templateId) {
            setFormData(prev => ({ ...prev, templateId: data.data[0]._id }));
          }
        }
      } catch (error) {
        console.error('Failed to fetch templates:', error);
      }
    };

    if (isOpen) {
      fetchTemplates();
    }
  }, [isOpen]);

  // Fetch Customers when required
  useEffect(() => {
    if (isOpen && recipientMethod === 'existing' && customers.length === 0) {
      const fetchCustomers = async () => {
        setIsLoadingCustomers(true);
        try {
          const { data } = await axios.get('/customers?limit=1000');
          if (data.success) {
            setCustomers(data.data || []);
          }
        } catch (error) {
          console.error('Failed to fetch customers:', error);
          toast.error('Gagal memuat daftar kontak');
        } finally {
          setIsLoadingCustomers(false);
        }
      };
      fetchCustomers();
    }
  }, [isOpen, recipientMethod]);

  const toggleSelectCustomer = (id) => {
    setSelectedCustomerIds(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  };

  const filteredCustomers = customers.filter(c =>
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
    c.phone.includes(customerSearch)
  );

  const handleSelectAllCustomers = () => {
    const visibleIds = filteredCustomers.map(c => c._id);
    const allSelected = visibleIds.every(id => selectedCustomerIds.includes(id));

    if (allSelected) {
      // Deselect all visible
      setSelectedCustomerIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      // Select all visible
      const newSelected = [...selectedCustomerIds];
      visibleIds.forEach(id => {
        if (!newSelected.includes(id)) newSelected.push(id);
      });
      setSelectedCustomerIds(newSelected);
    }
  };

  const handleCsvUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      toast.error('Gunakan file CSV yang valid');
      return;
    }

    setCsvFile(file);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
          toast.error('File CSV kosong');
          return;
        }

        const firstLine = lines[0];
        const delimiter = firstLine.includes('\t') ? '\t' : (firstLine.includes(';') ? ';' : ',');

        const headers = lines[0].split(delimiter).map(h => h.trim().toUpperCase());
        const phoneIndex = headers.findIndex(h => h.includes('PHONE') || h.includes('TELEPON') || h.includes('WA'));
        const nameIndex = headers.findIndex(h => h.includes('NAME') || h.includes('NAMA'));

        if (phoneIndex === -1) {
          toast.error('CSV harus memiliki kolom PHONE/TELEPON');
          return;
        }

        const recipients = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(delimiter).map(v => v.trim());
          const phone = values[phoneIndex];
          if (!phone) continue;

          recipients.push({
            phone: phone.replace(/\D/g, ''),
            name: nameIndex !== -1 && values[nameIndex] ? values[nameIndex] : ''
          });
        }

        if (recipients.length === 0) {
          toast.error('Tidak ada penerima ditemukan');
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

        toast.success(`${recipients.length} penerima berhasil dimuat`);
      } catch (error) {
        toast.error('Gagal membaca file CSV');
      }
    };
    reader.readAsText(file);
  };

  const getRecipientsCount = () => {
    if (recipientMethod === 'existing') {
      return selectedCustomerIds.length;
    }
    try {
      const list = JSON.parse(formData.recipients);
      return Array.isArray(list) ? list.length : 0;
    } catch {
      return formData.recipients.split(',').filter(r => r.trim()).length;
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && !formData.name.trim()) {
      toast.error('Nama campaign wajib diisi');
      return;
    }
    if (currentStep === 2) {
      if (!formData.templateId) {
        toast.error('Pilih template terlebih dahulu');
        return;
      }
      if (getRecipientsCount() === 0) {
        toast.error('Tambahkan minimal satu penerima');
        return;
      }
    }
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const handleSubmit = async () => {
    if (!sendNow && !formData.scheduleTime) {
      toast.error('Pilih waktu penjadwalan');
      return;
    }

    try {
      setLoading(true);
      let recipientsList;

      if (recipientMethod === 'existing') {
        if (selectedCustomerIds.length === 0) {
          toast.error('Pilih minimal satu penerima');
          setLoading(false);
          return;
        }
        // Map IDs back to objects
        recipientsList = customers
          .filter(c => selectedCustomerIds.includes(c._id))
          .map(c => ({ name: c.name, phone: c.phone }));
      } else {
        try {
          recipientsList = JSON.parse(formData.recipients);
        } catch {
          recipientsList = formData.recipients.split(',').map(r => ({ phone: r.trim().replace(/\D/g, '') })).filter(r => r.phone);
        }
      }

      const payload = {
        name: formData.name.trim(),
        templateId: formData.templateId,
        recipients: recipientsList,
        sendAt: sendNow ? null : formData.scheduleTime
      };

      const { data } = await axios.post('/broadcasts', payload);
      if (data.success) {
        toast.success('Broadcast berhasil dibuat!');
        setIsOpen(false);
        resetForm();
        if (onCreated) onCreated();
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Gagal membuat broadcast');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', templateId: '', recipients: '', scheduleTime: null });
    setCurrentStep(1);
    setSendNow(true);
    setCsvFile(null);
    setCsvPreview(null);
    setRecipientMethod('upload');
    setSelectedCustomerIds([]);
  };

  const selectedTemplate = templates.find(t => t._id === formData.templateId);

  const steps = [
    { id: 1, title: 'Informasi Dasar', icon: Info },
    { id: 2, title: 'Konten & Penerima', icon: MessageSquare },
    { id: 3, title: 'Jadwal & Review', icon: Clock },
  ];

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="bg-primary-500 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 hover:bg-primary-600 transition-all shadow-lg hover:shadow-primary-500/25 active:scale-95"
      >
        <Send className="w-5 h-5" />
        New Broadcast
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2rem] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl animate-in zoom-in-95 duration-300">

            {/* Modal Header */}
            <div className="px-8 py-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black text-navy-900 leading-tight">Create New Broadcast</h2>
                <p className="text-gray-500 text-sm font-medium">Step {currentStep} of 3: {steps[currentStep - 1].title}</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-gray-50 hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicator */}
            <div className="px-8 py-4 bg-gray-50/50 flex items-center justify-center gap-4">
              {steps.map((s, idx) => {
                const Icon = s.icon;
                const active = currentStep >= s.id;
                const current = currentStep === s.id;
                return (
                  <div key={s.id} className="flex items-center">
                    <div className={`
                      flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300
                      ${current ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 font-bold scale-105' :
                        active ? 'bg-primary-100 text-primary-700 font-semibold' : 'bg-white text-gray-400 border border-gray-100'}
                    `}>
                      <Icon className="w-4 h-4" />
                      <span className="text-xs whitespace-nowrap hidden md:block">{s.title}</span>
                    </div>
                    {idx < steps.length - 1 && (
                      <div className={`w-8 h-[2px] mx-2 ${currentStep > s.id ? 'bg-primary-500' : 'bg-gray-200'}`} />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">

              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                  <div className="max-w-xl mx-auto space-y-6">
                    <div className="p-6 bg-primary-50 rounded-3xl border border-primary-100">
                      <div className="flex gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-white flex items-center justify-center shadow-sm">
                          <Info className="w-6 h-6 text-primary-500" />
                        </div>
                        <div>
                          <h4 className="font-bold text-navy-900">Nama Campaign</h4>
                          <p className="text-sm text-gray-500 mb-4">Mulai dengan memberikan nama yang deskriptif untuk campaign Anda.</p>
                          <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Promo Gajian Akhir Bulan"
                            className="w-full px-5 py-4 bg-white border-2 border-primary-100 rounded-2xl focus:border-primary-500 focus:outline-none focus:ring-4 focus:ring-primary-500/10 transition-all font-semibold"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Content & Recipients */}
              {currentStep === 2 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 animate-in slide-in-from-right-4 duration-300">
                  {/* Left: Template Selection */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[15px] font-bold text-navy-900 mb-3">Pilih Template</label>
                      <select
                        value={formData.templateId}
                        onChange={(e) => setFormData(prev => ({ ...prev, templateId: e.target.value }))}
                        className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary-500 focus:outline-none transition-all font-medium appearance-none"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1.25rem center', backgroundSize: '1.2rem' }}
                      >
                        <option value="">-- Pilih Template Pesan --</option>
                        {templates.map(t => (
                          <option key={t._id} value={t._id}>{t.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* WhatsApp Style Preview */}
                    <div className="space-y-3">
                      <label className="block text-[15px] font-bold text-navy-900 mb-1">Preview Pesan</label>
                      <div className="bg-[#efeae2] rounded-3xl p-6 relative overflow-hidden shadow-inner min-h-[220px]">
                        <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '15px 15px' }} />
                        <div className="relative bg-white rounded-2xl rounded-tl-none p-4 shadow-sm max-w-[90%] animate-in zoom-in-95 duration-200">
                          <p className="text-[14px] text-gray-800 whitespace-pre-line leading-relaxed">
                            {selectedTemplate ? selectedTemplate.message : 'Belum ada template yang dipilih...'}
                          </p>
                          <div className="flex justify-end mt-1">
                            <span className="text-[10px] text-gray-400">12:00</span>
                          </div>
                          <div className="absolute top-0 -left-2 w-3 h-3 bg-white [clip-path:polygon(100%_0,100%_100%,0_0)]" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right: Recipients */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[15px] font-bold text-navy-900">Daftar Penerima</label>
                      <p className="text-xs font-bold text-primary-600 bg-primary-50 px-3 py-1 rounded-full">
                        {getRecipientsCount()} Penerima Dipilih
                      </p>
                    </div>

                    {/* TABS FOR METHOD SELECTION */}
                    <div className="flex bg-gray-100 p-1 rounded-xl mb-4">
                      <button
                        onClick={() => setRecipientMethod('upload')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${recipientMethod === 'upload' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-700'}`}
                      >
                        Upload CSV / Manual
                      </button>
                      <button
                        onClick={() => setRecipientMethod('existing')}
                        className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${recipientMethod === 'existing' ? 'bg-white text-navy-900 shadow-sm' : 'text-gray-500 hover:text-navy-700'}`}
                      >
                        Pilih Kontak Tersimpan
                      </button>
                    </div>

                    {recipientMethod === 'upload' ? (
                      <div className="grid grid-cols-1 gap-4 animate-in fade-in duration-300">
                        <label className="group flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-gray-200 rounded-3xl hover:border-primary-400 hover:bg-primary-50/30 transition-all cursor-pointer">
                          <div className="w-12 h-12 rounded-2xl bg-gray-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                            <Upload className="w-6 h-6 text-gray-400 group-hover:text-primary-500" />
                          </div>
                          <div className="text-center">
                            <p className="text-sm font-bold text-navy-900">Upload CSV</p>
                            <p className="text-xs text-gray-400">Pilih file atau drop disini</p>
                          </div>
                          <input type="file" accept=".csv" onChange={handleCsvUpload} className="hidden" />
                        </label>

                        <textarea
                          value={formData.recipients}
                          onChange={(e) => setFormData(prev => ({ ...prev, recipients: e.target.value }))}
                          placeholder='Atau paste manual: 6281xxx, 6282xxx...'
                          className="w-full px-5 py-4 bg-gray-50 border-2 border-gray-100 rounded-2xl focus:border-primary-500 focus:outline-none transition-all font-mono text-xs h-32 custom-scrollbar"
                        />

                        {csvPreview && (
                          <div className="p-4 bg-green-50 rounded-2xl border border-green-100 animate-in slide-in-from-top-2">
                            <div className="flex items-center gap-2 mb-2">
                              <Check className="w-4 h-4 text-green-600" />
                              <p className="text-xs font-bold text-green-700">{csvPreview.total} kontak berhasil dimuat</p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {csvPreview.sample.map((s, i) => (
                                <span key={i} className="px-2 py-1 bg-white text-[10px] text-green-600 rounded-lg border border-green-200 font-medium">
                                  {s.name || 'User'} ({s.phone.slice(-4)})
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col h-[320px] bg-white border-2 border-gray-100 rounded-2xl overflow-hidden animate-in fade-in duration-300">
                        {/* Search Bar */}
                        <div className="p-3 border-b border-gray-100 flex gap-2">
                          <input
                            type="text"
                            placeholder="Cari nama atau nomor..."
                            className="flex-1 px-3 py-2 bg-gray-50 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-100"
                            value={customerSearch}
                            onChange={(e) => setCustomerSearch(e.target.value)}
                          />
                          <button onClick={handleSelectAllCustomers} className="px-3 py-2 bg-gray-100 rounded-xl text-xs font-bold text-gray-600 hover:bg-gray-200">
                            {selectedCustomerIds.length === filteredCustomers.length && filteredCustomers.length > 0 ? 'Deselect All' : 'Select All'}
                          </button>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                          {isLoadingCustomers ? (
                            <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                              Memuat data...
                            </div>
                          ) : filteredCustomers.length === 0 ? (
                            <div className="flex justify-center items-center h-full text-gray-400 text-sm">
                              Tidak ada kontak ditemukan
                            </div>
                          ) : (
                            filteredCustomers.map(customer => (
                              <div
                                key={customer._id}
                                onClick={() => toggleSelectCustomer(customer._id)}
                                className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${selectedCustomerIds.includes(customer._id) ? 'bg-primary-50 border border-primary-200' : 'hover:bg-gray-50 border border-transparent'}`}
                              >
                                <div className={`w-5 h-5 rounded-md border flex items-center justify-center ${selectedCustomerIds.includes(customer._id) ? 'bg-primary-500 border-primary-500' : 'border-gray-300 bg-white'}`}>
                                  {selectedCustomerIds.includes(customer._id) && <Check className="w-3.5 h-3.5 text-white" />}
                                </div>
                                <div>
                                  <p className="text-sm font-bold text-navy-900">{customer.name}</p>
                                  <p className="text-xs text-gray-500">{customer.phone}</p>
                                </div>
                                {customer.tags && customer.tags.length > 0 && (
                                  <div className="ml-auto flex gap-1">
                                    {customer.tags.slice(0, 2).map((tag, i) => (
                                      <span key={i} className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{tag}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))
                          )}
                        </div>

                        <div className="p-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-500 text-center font-medium">
                          {selectedCustomerIds.length} kontak dipilih dari {customers.length} total
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3: Scheduling & Final Review */}
              {currentStep === 3 && (
                <div className="max-w-xl mx-auto space-y-8 animate-in slide-in-from-right-4 duration-300">
                  <div className="space-y-4">
                    <label className="block text-[15px] font-bold text-navy-900">Metode Pengiriman</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <button
                        onClick={() => setSendNow(true)}
                        className={`p-6 rounded-3xl border-2 text-left transition-all ${sendNow ? 'border-primary-500 bg-primary-50/50 shadow-md ring-4 ring-primary-500/10' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${sendNow ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          <Send className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-navy-900 mb-1">Kirim Sekarang</p>
                        <p className="text-xs text-gray-500">Eksekusi campaign segera mungkin.</p>
                      </button>

                      <button
                        onClick={() => setSendNow(false)}
                        className={`p-6 rounded-3xl border-2 text-left transition-all ${!sendNow ? 'border-primary-500 bg-primary-50/50 shadow-md ring-4 ring-primary-500/10' : 'border-gray-100 bg-white hover:border-gray-200'}`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${!sendNow ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          <Calendar className="w-5 h-5" />
                        </div>
                        <p className="font-bold text-navy-900 mb-1">Jadwalkan</p>
                        <p className="text-xs text-gray-500">Pilih waktu terbaik untuk mengirim.</p>
                      </button>
                    </div>
                  </div>

                  {!sendNow && (
                    <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 animate-in slide-in-from-top-2">
                      <label className="block text-sm font-bold text-navy-900 mb-3">Pilih Waktu & Tanggal</label>
                      <div className="relative">
                        <input
                          type="datetime-local"
                          value={formData.scheduleTime || ''}
                          onChange={(e) => setFormData(prev => ({ ...prev, scheduleTime: e.target.value }))}
                          className="w-full px-5 py-4 bg-white border-2 border-gray-200 rounded-2xl focus:border-primary-500 focus:outline-none transition-all font-semibold"
                        />
                      </div>
                    </div>
                  )}

                  {/* Summary Card */}
                  <div className="bg-navy-900 text-white p-8 rounded-[2.5rem] shadow-xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-primary-500/20 rounded-full -mr-16 -mt-16 blur-3xl group-hover:bg-primary-500/30 transition-colors" />
                    <h4 className="text-xl font-black mb-6 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-primary-400" />
                      Campaign Summary
                    </h4>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-2 border-b border-navy-700">
                        <span className="text-gray-400 text-sm font-medium">Name</span>
                        <span className="font-bold truncate max-w-[200px]">{formData.name}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-navy-700">
                        <span className="text-gray-400 text-sm font-medium">Template</span>
                        <span className="font-bold text-primary-400">{selectedTemplate?.name || '-'}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-navy-700">
                        <span className="text-gray-400 text-sm font-medium">Recipients</span>
                        <span className="bg-navy-800 px-3 py-1 rounded-lg font-black">{getRecipientsCount()} Contacts</span>
                      </div>
                      <div className="flex justify-between items-center pt-2">
                        <span className="text-gray-400 text-sm font-medium">Timing</span>
                        <span className="font-bold text-green-400">
                          {sendNow ? 'Immediate Delivery' : (formData.scheduleTime ? new Date(formData.scheduleTime).toLocaleString() : 'Not set')}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-8 py-6 border-t border-gray-100 flex items-center justify-between bg-white">
              <button
                type="button"
                onClick={currentStep === 1 ? () => setIsOpen(false) : prevStep}
                className="flex items-center gap-2 px-6 py-3 text-gray-500 font-bold hover:text-navy-900 transition-colors rounded-2xl hover:bg-gray-50"
              >
                {currentStep === 1 ? 'Cancel' : (
                  <>
                    <ChevronLeft className="w-5 h-5" />
                    Back
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={currentStep === 3 ? handleSubmit : nextStep}
                disabled={loading}
                className={`
                  flex items-center gap-2 px-8 py-3 rounded-2xl font-black transition-all shadow-lg active:scale-95
                  ${currentStep === 3 ? 'bg-navy-900 text-white hover:bg-navy-800 shadow-navy-900/20' : 'bg-primary-500 text-white hover:bg-primary-600 shadow-primary-500/20'}
                `}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Processing...
                  </div>
                ) : (
                  <>
                    {currentStep === 3 ? (sendNow ? 'Launch Campaign' : 'Schedule Campaign') : 'Continue'}
                    {currentStep < 3 && <ChevronRight className="w-5 h-5" />}
                    {currentStep === 3 && <Send className="w-5 h-5 ml-1" />}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}