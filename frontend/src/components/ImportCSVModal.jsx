// File: frontend/src/components/ImportCSVModal.jsx
import { useState } from 'react';
import axios from '../utils/axios';
import { X, Upload, FileText, CheckCircle, AlertCircle, Download, Trash2, Clock, CheckCircle2 } from 'lucide-react';

export default function ImportCSVModal({ isOpen, onClose, onSuccess, API_BASE_URL }) {
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [previewData, setPreviewData] = useState([]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === 'text/csv' || droppedFile.name.endsWith('.csv'))) {
      handleFileSelect(droppedFile);
    } else {
      alert('Please upload a CSV file');
    }
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleFileSelect = (selectedFile) => {
    setFile(selectedFile);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());

      const preview = [];
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
        if (values.length >= 2) {
          preview.push({
            name: values[0] || 'N/A',
            phone: values[1] || 'N/A',
            tags: values[2] || 'Regular',
            status: values[3] || 'active'
          });
        }
      }
      setPreviewData(preview);
    };
    reader.readAsText(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    setIsProcessing(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());

        const customers = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());

          if (values.length >= 2 && values[0] && values[1]) {
            const customer = {
              name: values[0],
              phone: values[1],
              tags: values[2] ? values[2].split(';').map(t => t.trim()) : [],
              status: values[3] || 'active'
            };
            customers.push(customer);
          }
        }

        if (customers.length === 0) {
          throw new Error('No valid customer data found in CSV');
        }

        const response = await axios.post(`${API_BASE_URL}/import`, {
          customers: customers
        });

        const result = response.data.data || response.data;

        setImportResult({
          success: true,
          imported: result.imported || customers.length,
          total: customers.length,
          skipped: result.skipped || 0,
          message: `Successfully imported ${result.imported || customers.length} customers!`
        });

        if (onSuccess) onSuccess();
      };

      reader.readAsText(file);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to import CSV.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadCSVTemplate = () => {
    const csvContent = `name,phone,tags,status
John Doe,628123456789,VIP;Premium,active
Jane Smith,628987654321,Regular,active
Bob Johnson,628555555555,Prospek,inactive`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'customer_template.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    if (isProcessing) return;
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-navy-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300"
      onClick={(e) => e.target === e.currentTarget && handleClose()}
    >
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-300 border border-white/20">

        {/* Header */}
        <div className="bg-navy-900 px-8 py-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
          <div className="flex items-center justify-between relative z-10">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/10 shadow-inner">
                <Upload className="w-6 h-6 text-primary-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">Bulk Import</h2>
                <p className="text-xs font-medium text-gray-400 tracking-wide">Import your contacts from CSV</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="w-10 h-10 bg-white/5 hover:bg-white/10 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 text-gray-400 hover:text-white"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-8">

          {!importResult && (
            <div className="bg-primary-50 border border-primary-100 rounded-2xl p-5 mb-6 flex items-center justify-between">
              <div>
                <h4 className="text-primary-900 font-bold text-sm">CSV Template</h4>
                <p className="text-xs font-medium text-primary-700/70 mt-0.5">Download the required format to avoid errors</p>
              </div>
              <button
                onClick={downloadCSVTemplate}
                className="px-4 py-2.5 bg-primary-500 text-navy-900 rounded-lg font-bold text-xs hover:bg-primary-600 transition-all flex items-center gap-2 shadow-sm"
              >
                <Download className="w-3.5 h-3.5" />
                Template
              </button>
            </div>
          )}

          {!file && !importResult && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-3xl p-12 text-center transition-all flex flex-col items-center group cursor-pointer ${isDragging
                ? 'border-primary-500 bg-primary-50/50 scale-[0.98]'
                : 'border-gray-200 bg-gray-50/50 hover:border-primary-400 hover:bg-primary-50/20 shadow-inner'
                }`}
              onClick={() => document.getElementById('file-upload').click()}
            >
              <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-500 border border-gray-100">
                <FileText className="w-10 h-10 text-primary-500 shadow-sm" />
              </div>
              <h3 className="text-xl font-bold text-navy-900 mb-1">Drop your CSV file</h3>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-8">or click to browse local files</p>

              <input
                id="file-upload"
                type="file"
                accept=".csv"
                onChange={handleFileInput}
                className="hidden"
              />
              <span className="px-8 py-3 bg-navy-900 text-white rounded-xl font-bold text-sm hover:bg-navy-800 transition-all shadow-lg shadow-navy-900/10">
                Browse Files
              </span>
            </div>
          )}

          {file && !importResult && (
            <div className="animate-in slide-in-from-bottom-5 duration-300">
              <div className="bg-gray-50 border border-gray-100 rounded-2xl p-5 mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-primary-500 rounded-xl flex items-center justify-center text-navy-900 shadow-sm">
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-base font-bold text-navy-900 truncate max-w-[200px]">{file.name}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{(file.size / 1024).toFixed(2)} KB • READY</p>
                  </div>
                </div>
                <button
                  onClick={() => { setFile(null); setPreviewData([]); }}
                  disabled={isProcessing}
                  className="w-10 h-10 bg-red-50 text-red-600 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {previewData.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden mb-6 shadow-sm">
                  <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-primary-500" />
                    <span className="text-[10px] font-bold text-navy-900 uppercase tracking-wider">Preview (First 5 Rows)</span>
                  </div>
                  <div className="p-3 overflow-x-auto">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="text-[9px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                          <th className="px-3 py-2">Name</th>
                          <th className="px-3 py-2">Phone</th>
                          <th className="px-3 py-2">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {previewData.map((row, i) => (
                          <tr key={i} className="text-xs">
                            <td className="px-3 py-2.5 font-bold text-navy-800">{row.name}</td>
                            <td className="px-3 py-2.5 font-medium text-gray-500">{row.phone}</td>
                            <td className="px-3 py-2.5">
                              <span className="px-2 py-0.5 bg-primary-100 text-primary-700 rounded-md text-[9px] font-bold uppercase tracking-wider">{row.status}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <button
                onClick={handleImport}
                disabled={isProcessing}
                className="w-full py-4 bg-navy-900 text-white rounded-xl font-bold text-base hover:bg-navy-800 transition-all flex items-center justify-center gap-3 shadow-lg shadow-navy-900/10 disabled:opacity-50"
              >
                {isProcessing ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : <Upload className="w-5 h-5" />}
                {isProcessing ? 'Processing Data...' : 'Confirm & Import Now'}
              </button>
            </div>
          )}

          {importResult && (
            <div className="text-center py-4 animate-in zoom-in-95 duration-500">
              <div className={`w-20 h-20 mx-auto rounded-3xl flex items-center justify-center mb-6 shadow-xl ${importResult.success ? 'bg-green-500 shadow-green-500/10' : 'bg-red-500 shadow-red-500/10'
                }`}>
                {importResult.success ? <CheckCircle2 className="w-10 h-10 text-white" /> : <AlertCircle className="w-10 h-10 text-white" />}
              </div>
              <h3 className="text-2xl font-bold text-navy-900 mb-1">{importResult.success ? 'Import Successful' : 'Import Failed'}</h3>
              <p className="text-gray-500 font-medium text-sm mb-8">{importResult.message}</p>

              {importResult.success && (
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Imported</p>
                    <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  </div>
                  <div className="bg-gray-50 p-5 rounded-2xl border border-gray-100">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Total Rows</p>
                    <p className="text-2xl font-bold text-navy-900">{importResult.total}</p>
                  </div>
                </div>
              )}

              <button
                onClick={handleClose}
                className="w-full py-3.5 bg-primary-500 text-navy-900 rounded-xl font-bold text-sm hover:bg-primary-600 transition-all active:scale-[0.98] shadow-md shadow-primary-500/10"
              >
                Done, Great!
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
