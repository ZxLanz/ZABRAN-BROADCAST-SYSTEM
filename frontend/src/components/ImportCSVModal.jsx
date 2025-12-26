// File: frontend/src/components/ImportCSVModal.jsx
// ✅ FIXED: Now uses REAL API instead of localStorage + Proper axios import
import { useState } from 'react';
import axios from '../utils/axios'; // ✅ FIX: Use configured axios instance
import { X, Upload, FileText, CheckCircle, AlertCircle, Download } from 'lucide-react';

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
    if (droppedFile && droppedFile.type === 'text/csv') {
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
    
    // Read and preview file
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const lines = text.split('\n').filter(line => line.trim());
      
      // Parse CSV preview (first 5 rows)
      const preview = [];
      for (let i = 1; i < Math.min(6, lines.length); i++) {
        const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
        if (values.length >= 2) { // At least name and phone
          preview.push({
            name: values[0] || 'N/A',
            phone: values[1] || 'N/A',
            email: values[2] || '-',
            tags: values[3] || 'Regular',
            status: values[4] || 'active'
          });
        }
      }
      setPreviewData(preview);
    };
    reader.readAsText(selectedFile);
  };

  // ✅ REAL API IMPORT
  const handleImport = async () => {
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const text = e.target.result;
        const lines = text.split('\n').filter(line => line.trim());
        
        // Parse CSV data
        const customers = [];
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.replace(/^"|"$/g, '').trim());
          
          if (values.length >= 2 && values[0] && values[1]) {
            const customer = {
              name: values[0],
              phone: values[1],
              email: values[2] || undefined,
              tags: values[3] ? values[3].split(';').map(t => t.trim()) : [],
              status: values[4] || 'active',
              division: values[5] || undefined
            };
            customers.push(customer);
          }
        }

        if (customers.length === 0) {
          throw new Error('No valid customer data found in CSV');
        }

        // ✅ Send to backend
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

        // Success callback
        if (onSuccess) {
          onSuccess();
        }
      };
      
      reader.readAsText(file);
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: false,
        message: error.response?.data?.message || error.message || 'Failed to import CSV. Please check the file format.'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // ✅ Download CSV Template
  const downloadCSVTemplate = () => {
    const csvContent = `name,phone,email,tags,status,division
John Doe,628123456789,john@example.com,VIP;Premium,active,Sales
Jane Smith,628987654321,jane@example.com,Regular,active,Marketing
Bob Johnson,628555555555,bob@example.com,Prospek,inactive,Support
Alice Brown,628111111111,alice@example.com,New,active,Sales
Charlie Davis,628222222222,,Premium,active,Marketing`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'customer_import_template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClose = () => {
    setFile(null);
    setPreviewData([]);
    setImportResult(null);
    onClose();
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget && !isProcessing) {
      handleClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={handleOverlayClick}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden animate-scale-in">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <Upload className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white mb-1">
                  Import Customers
                </h2>
                <p className="text-sm text-blue-100 font-medium">
                  Upload CSV file to bulk import customers
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              disabled={isProcessing}
              className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50"
            >
              <X className="w-6 h-6 text-white" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-8">
          
          {/* Download Template Button */}
          <div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 mb-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h4 className="text-sm font-bold text-amber-800 mb-1">Need a template?</h4>
                <p className="text-xs text-amber-700 font-medium">
                  Download our CSV template with sample data to get started.
                </p>
              </div>
              <button
                onClick={downloadCSVTemplate}
                className="px-4 py-2 bg-amber-500 text-white rounded-lg font-semibold hover:bg-amber-600 transition-colors flex items-center gap-2 whitespace-nowrap ml-4"
              >
                <Download className="w-4 h-4" />
                <span>Download Template</span>
              </button>
            </div>
          </div>

          {/* Upload Area */}
          {!file && !importResult && (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`border-3 border-dashed rounded-2xl p-12 text-center transition-all ${
                isDragging 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50/50'
              }`}
            >
              <div className="flex flex-col items-center">
                <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center mb-4">
                  <FileText className="w-10 h-10 text-blue-500" />
                </div>
                <h3 className="text-lg font-black text-navy-800 mb-2">
                  Drop your CSV file here
                </h3>
                <p className="text-sm text-gray-600 font-medium mb-4">
                  or click to browse
                </p>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                  <span className="px-6 py-3 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all inline-block">
                    Select CSV File
                  </span>
                </label>
                <p className="text-xs text-gray-500 font-medium mt-4">
                  Supported format: CSV (Comma-separated values)
                </p>
              </div>
            </div>
          )}

          {/* File Preview */}
          {file && !importResult && (
            <div className="space-y-4">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileText className="w-8 h-8 text-blue-600" />
                    <div>
                      <p className="text-sm font-bold text-navy-800">{file.name}</p>
                      <p className="text-xs text-gray-600 font-medium">
                        {(file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      setPreviewData([]);
                    }}
                    disabled={isProcessing}
                    className="text-red-600 hover:text-red-700 font-semibold text-sm disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Preview Table */}
              {previewData.length > 0 && (
                <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
                  <h4 className="text-sm font-bold text-navy-800 mb-3">
                    Preview (First 5 rows)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b-2 border-gray-300">
                          <th className="text-left py-2 px-2 font-bold text-gray-700">Name</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-700">Phone</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-700">Email</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-700">Tags</th>
                          <th className="text-left py-2 px-2 font-bold text-gray-700">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.map((row, index) => (
                          <tr key={index} className="border-b border-gray-200">
                            <td className="py-2 px-2 font-medium text-navy-800">{row.name}</td>
                            <td className="py-2 px-2 text-gray-600">{row.phone}</td>
                            <td className="py-2 px-2 text-gray-600">{row.email}</td>
                            <td className="py-2 px-2 text-gray-600">{row.tags}</td>
                            <td className="py-2 px-2 text-gray-600">{row.status}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Import Button */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  onClick={() => {
                    setFile(null);
                    setPreviewData([]);
                  }}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImport}
                  disabled={isProcessing}
                  className="px-6 py-3 bg-gradient-to-r from-blue-400 via-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Upload className="w-5 h-5" />
                  <span>{isProcessing ? 'Importing...' : 'Import Customers'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Import Result */}
          {importResult && (
            <div className={`border-2 rounded-2xl p-8 text-center ${
              importResult.success 
                ? 'bg-green-50 border-green-200' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
                importResult.success ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {importResult.success ? (
                  <CheckCircle className="w-10 h-10 text-green-600" />
                ) : (
                  <AlertCircle className="w-10 h-10 text-red-600" />
                )}
              </div>
              <h3 className={`text-2xl font-black mb-2 ${
                importResult.success ? 'text-green-800' : 'text-red-800'
              }`}>
                {importResult.success ? 'Import Successful!' : 'Import Failed'}
              </h3>
              <p className={`text-sm font-medium mb-6 ${
                importResult.success ? 'text-green-700' : 'text-red-700'
              }`}>
                {importResult.message}
              </p>
              {importResult.success && (
                <div className="bg-white border border-green-300 rounded-xl p-4 mb-6 inline-block">
                  <div className="flex items-center gap-8">
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">Imported</p>
                      <p className="text-2xl font-black text-green-600">{importResult.imported}</p>
                    </div>
                    <div className="w-px h-10 bg-gray-300"></div>
                    <div>
                      <p className="text-xs font-bold text-gray-500 uppercase mb-1">Total Rows</p>
                      <p className="text-2xl font-black text-navy-800">{importResult.total}</p>
                    </div>
                    {importResult.skipped > 0 && (
                      <>
                        <div className="w-px h-10 bg-gray-300"></div>
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase mb-1">Skipped</p>
                          <p className="text-2xl font-black text-yellow-600">{importResult.skipped}</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
              <button
                onClick={handleClose}
                className="px-8 py-3 bg-gradient-to-r from-primary-400 via-primary-500 to-primary-600 text-navy-900 rounded-xl font-semibold hover:shadow-lg transition-all"
              >
                Done
              </button>
            </div>
          )}

        </div>

      </div>
    </div>
  );
}