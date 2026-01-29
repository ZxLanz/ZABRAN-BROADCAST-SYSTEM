import { useState, useEffect } from 'react';
import { X, Tag, Plus, Check } from 'lucide-react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';

export default function TagManagementModal({ isOpen, onClose, customerId, currentTags, onUpdate }) {
    const [tags, setTags] = useState([]);
    const [inputValue, setInputValue] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTags(currentTags || []);
            setInputValue('');
        }
    }, [isOpen, currentTags]);

    const handleAddTag = () => {
        const trimmed = inputValue.trim();
        if (trimmed && !tags.includes(trimmed)) {
            setTags([...tags, trimmed]);
            setInputValue('');
        }
    };

    const handleRemoveTag = (tagToRemove) => {
        setTags(tags.filter(t => t !== tagToRemove));
    };

    const handleQuickAdd = (tag) => {
        if (!tags.includes(tag)) {
            setTags([...tags, tag]);
        }
    };

    const handleSave = async () => {
        if (!customerId) {
            toast.error('Customer data not found. Please ensure this contact is saved.');
            return;
        }
        setLoading(true);
        try {
            await axios.patch(`/customers/${customerId}/tags`, { tags });
            toast.success('Tags updated successfully');
            onUpdate(tags);
            onClose();
        } catch (error) {
            console.error('Failed to update tags:', error);
            toast.error('Failed to update tags');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const quickTags = [
        { label: 'Royal', color: 'bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200' },
        { label: 'Gold', color: 'bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200' },
        { label: 'Platinum', color: 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' },
        { label: 'VIP', color: 'bg-rose-100 text-rose-700 border-rose-200 hover:bg-rose-200' }
    ];

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="bg-navy-900 px-6 py-4 flex items-center justify-between">
                    <h3 className="text-white font-bold flex items-center gap-2">
                        <Tag className="w-4 h-4" /> Manage Tags
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Tag Input */}
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                            placeholder="Add new tag..."
                            className="flex-1 px-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 text-sm"
                            autoFocus
                        />
                        <button
                            onClick={handleAddTag}
                            disabled={!inputValue.trim()}
                            className="px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Quick Tags */}
                    <div className="flex flex-wrap gap-2">
                        {quickTags.map((qt) => (
                            <button
                                key={qt.label}
                                onClick={() => handleQuickAdd(qt.label)}
                                disabled={tags.includes(qt.label)}
                                className={`text-[10px] uppercase font-bold px-2 py-1 rounded-lg border transition-all ${qt.color} ${tags.includes(qt.label) ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {qt.label}
                            </button>
                        ))}
                    </div>

                    {/* Active Tags */}
                    <div className="min-h-[100px] bg-gray-50 rounded-xl p-3 border border-gray-100">
                        {tags.length === 0 ? (
                            <p className="text-xs text-gray-400 text-center italic mt-2">No active tags</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {tags.map((tag, i) => (
                                    <span key={i} className="flex items-center gap-1 pl-2 pr-1 py-1 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-700 shadow-sm">
                                        {tag}
                                        <button
                                            onClick={() => handleRemoveTag(tag)}
                                            className="p-0.5 hover:bg-red-50 hover:text-red-500 rounded-md transition-colors"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="w-full py-2.5 bg-primary-500 hover:bg-primary-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-primary-500/20 transition-all flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                            <>
                                <Check className="w-4 h-4" /> Save Changes
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
