import React, { useState, useEffect } from 'react';
import api from '../utils/axios'; // Corrected filename

// Simple memory cache to prevent refetching the same avatar repeatedly
const avatarCache = new Map();

const ChatAvatar = ({ chat, className = "w-12 h-12" }) => {
    // If we have it in cache, use it immediately
    const [url, setUrl] = useState(avatarCache.get(chat._id));

    // Fallback UI data
    const displayName = chat.displayName || 'Unknown';
    const initial = displayName.substring(0, 1).toUpperCase() || '?';

    useEffect(() => {
        // Check cache first whenever chat._id changes
        const cached = avatarCache.get(chat._id);
        if (cached) {
            setUrl(cached);
            return;
        }

        // If not in cache, clear previous URL (so we don't show wrong person)
        setUrl(null);

        // Validation: Don't fetch for system messages or weird IDs if possible
        if (!chat._id) return;

        const fetchAvatar = async () => {
            try {
                // Backend expects JID. If chat._id is phone number, backend wraps it.
                // We URL encode it just in case.
                const res = await api.get(`/whatsapp/avatar/${encodeURIComponent(chat._id)}`);
                if (res.data.success && res.data.url) {
                    setUrl(res.data.url);
                    avatarCache.set(chat._id, res.data.url);
                }
            } catch (e) {
                // Silently fail - just show default avatar
                // console.warn('Avatar fetch failed', e);
            }
        };

        fetchAvatar();
    }, [chat._id]); // Only dependency is chat._id

    if (url) {
        return (
            <img
                src={url}
                alt={displayName}
                className={`${className} rounded-full object-cover border border-gray-200 bg-gray-100 flex-shrink-0`}
                onError={() => setUrl(null)} // Fallback if image load fails
            />
        );
    }

    // Default Gradient Avatar
    return (
        <div className={`${className} rounded-full bg-gradient-to-tr from-navy-600 to-navy-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-lg shadow-sm border border-navy-400/20`}>
            {initial}
        </div>
    );
};

export default ChatAvatar;
