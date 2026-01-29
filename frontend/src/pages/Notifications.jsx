// frontend/src/pages/Notifications.jsx - ✅ FULLY FIXED
import { useState, useEffect } from 'react';
import { Bell, Check, CheckCheck, Trash2, Filter, Loader2 } from 'lucide-react';
import axios from '../utils/axios';
import toast from 'react-hot-toast';
import DeleteConfirm from '../components/DeleteConfirm';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all'); // 'all', 'unread', 'read'
  const [selectedIds, setSelectedIds] = useState([]);

  // ✅ Delete confirmation states
  const [deleteModal, setDeleteModal] = useState({ open: false, id: null, type: 'single' });
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await axios.get('/notifications');
      setNotifications(data.data || []); // ✅ FIXED: data.data

    } catch (err) {
      console.error('Error fetching notifications:', err);
      if (err.response?.status !== 401) {
        toast.error('Failed to load notifications');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Filter notifications - ✅ FIXED: use "unread" field
  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return n.unread;
    if (filter === 'read') return !n.unread;
    return true;
  });

  // Mark as read - ✅ FIXED: use "unread: false"
  const markAsRead = async (id) => {
    try {
      await axios.patch(`/notifications/${id}/read`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, unread: false } : n)
      );
      toast.success('Marked as read');
    } catch (err) {
      console.error('Error marking as read:', err);
      toast.error('Failed to mark as read');
    }
  };

  // Mark as unread - ✅ FIXED: use "unread: true"
  const markAsUnread = async (id) => {
    try {
      await axios.patch(`/notifications/${id}/unread`);
      setNotifications(prev =>
        prev.map(n => n._id === id ? { ...n, unread: true } : n)
      );
      toast.success('Marked as unread');
    } catch (err) {
      console.error('Error marking as unread:', err);
      toast.error('Failed to mark as unread');
    }
  };

  // Mark all as read - ✅ FIXED: use "unread: false"
  const markAllAsRead = async () => {
    try {
      await axios.patch('/notifications/read-all');
      setNotifications(prev =>
        prev.map(n => ({ ...n, unread: false }))
      );
      toast.success('All marked as read');
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to mark all as read');
    }
  };

  // Delete notification - ✅ WITH MODAL
  const deleteNotification = async (id) => {
    setDeleteModal({ open: true, id, type: 'single' });
  };

  // Confirm delete single
  const confirmDeleteSingle = async () => {
    const id = deleteModal.id;
    try {
      setIsDeleting(true);
      await axios.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n._id !== id));
      toast.success('Notification deleted');
      setDeleteModal({ open: false, id: null, type: 'single' });
    } catch (err) {
      console.error('Error deleting:', err);
      toast.error('Failed to delete');
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete selected - ✅ WITH MODAL
  const deleteSelected = async () => {
    setDeleteModal({ open: true, id: null, type: 'selected' });
  };

  // Confirm delete selected
  const confirmDeleteSelected = async () => {
    try {
      setIsDeleting(true);
      await Promise.all(
        selectedIds.map(id => axios.delete(`/notifications/${id}`))
      );
      setNotifications(prev => prev.filter(n => !selectedIds.includes(n._id)));
      setSelectedIds([]);
      toast.success(`${selectedIds.length} notifications deleted`);
      setDeleteModal({ open: false, id: null, type: 'selected' });
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to delete selected');
    } finally {
      setIsDeleting(false);
    }
  };

  // Clear all - ✅ WITH MODAL
  const clearAll = async () => {
    setDeleteModal({ open: true, id: null, type: 'all' });
  };

  // Confirm clear all
  const confirmClearAll = async () => {
    try {
      setIsDeleting(true);
      await axios.delete('/notifications/clear');
      setNotifications([]);
      toast.success('All notifications cleared');
      setDeleteModal({ open: false, id: null, type: 'all' });
    } catch (err) {
      console.error('Error:', err);
      toast.error('Failed to clear all');
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle selection
  const toggleSelect = (id) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  // Select all visible
  const selectAll = () => {
    const allIds = filteredNotifications.map(n => n._id);
    setSelectedIds(allIds);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedIds([]);
  };

  // Time ago formatter
  const timeAgo = (date) => {
    const seconds = Math.floor((new Date() - new Date(date)) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hour${Math.floor(seconds / 3600) > 1 ? 's' : ''} ago`;
    return `${Math.floor(seconds / 86400)} day${Math.floor(seconds / 86400) > 1 ? 's' : ''} ago`;
  };

  const unreadCount = notifications.filter(n => n.unread).length; // ✅ FIXED: n.unread

  // ✅ Get delete modal props
  const getDeleteModalProps = () => {
    switch (deleteModal.type) {
      case 'single':
        return {
          title: 'Delete Notification',
          message: 'Are you sure you want to delete this notification? This action cannot be undone.',
          onConfirm: confirmDeleteSingle
        };
      case 'selected':
        return {
          title: `Delete ${selectedIds.length} Notifications`,
          message: `Are you sure you want to delete ${selectedIds.length} selected notifications? This action cannot be undone.`,
          onConfirm: confirmDeleteSelected
        };
      case 'all':
        return {
          title: 'Clear All Notifications',
          message: 'Are you sure you want to clear all notifications? This action cannot be undone.',
          onConfirm: confirmClearAll
        };
      default:
        return {
          title: 'Delete Notification',
          message: 'Are you sure?',
          onConfirm: () => { }
        };
    }
  };

  return (
    <div className="animate-slide-in">

      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-4xl font-black text-navy-800 tracking-tight mb-1 flex items-center gap-3">
              <Bell className="w-9 h-9 text-primary-500" />
              Notifications
            </h1>
            <p className="text-base text-gray-600 font-medium">
              {unreadCount > 0
                ? `You have ${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up! No new notifications.'}
            </p>
          </div>

          {/* Header Actions */}
          <div className="flex items-center gap-3">
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="btn btn-primary"
              >
                <CheckCheck className="w-5 h-5" />
                <span>Mark All Read</span>
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={clearAll}
                className="bg-red-600 text-white px-5 py-2.5 rounded-xl font-semibold flex items-center gap-2 hover:bg-red-700 transition-colors shadow-md"
              >
                <Trash2 className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="card p-5 mb-6">
        <div className="flex items-center justify-between">

          {/* Filter Buttons */}
          <div className="flex items-center gap-3">
            <Filter className="w-5 h-5 text-gray-500" />
            <button
              onClick={() => setFilter('all')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filter === 'all'
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              All ({notifications.length})
            </button>
            <button
              onClick={() => setFilter('unread')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filter === 'unread'
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Unread ({unreadCount})
            </button>
            <button
              onClick={() => setFilter('read')}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${filter === 'read'
                  ? 'bg-primary-500 text-white shadow-md'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              Read ({notifications.length - unreadCount})
            </button>
          </div>

          {/* Bulk Actions */}
          {selectedIds.length > 0 ? (
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-gray-600">{selectedIds.length} selected</span>
              <button
                onClick={deleteSelected}
                className="btn btn-secondary"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Selected</span>
              </button>
              <button
                onClick={deselectAll}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200"
              >
                Deselect All
              </button>
            </div>
          ) : (
            filteredNotifications.length > 0 && (
              <button
                onClick={selectAll}
                className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200"
              >
                Select All
              </button>
            )
          )}
        </div>
      </div>

      {/* Notifications List Card */}
      <div className="card p-7">

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">Loading notifications...</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredNotifications.length === 0 && (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              {filter === 'unread' ? 'No unread notifications' :
                filter === 'read' ? 'No read notifications' :
                  'No notifications yet'}
            </h3>
            <p className="text-gray-600 font-medium">
              {filter === 'all'
                ? 'When you receive notifications, they will appear here'
                : `Switch to "${filter === 'unread' ? 'all or read' : 'all or unread'}" to see more`
              }
            </p>
          </div>
        )}

        {/* Notifications List */}
        {!loading && filteredNotifications.length > 0 && (
          <div className="space-y-3">
            {filteredNotifications.map((notif) => (
              <div
                key={notif._id}
                className={`p-5 rounded-xl border-2 transition-all hover:shadow-md ${notif.unread // ✅ FIXED: notif.unread
                    ? 'bg-primary-50/30 border-primary-200'
                    : 'bg-white border-gray-200'
                  } ${selectedIds.includes(notif._id) ? 'ring-2 ring-primary-500' : ''}`}
              >
                <div className="flex items-start gap-4">

                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={selectedIds.includes(notif._id)}
                    onChange={() => toggleSelect(notif._id)}
                    className="mt-1.5 w-5 h-5 text-primary-500 rounded border-gray-300 focus:ring-primary-500 cursor-pointer"
                  />

                  {/* Unread Indicator - ✅ FIXED: notif.unread */}
                  {notif.unread && (
                    <div className="w-2.5 h-2.5 bg-primary-500 rounded-full mt-2 flex-shrink-0"></div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-navy-800 mb-1">{notif.title}</h4>
                    <p className="text-sm text-gray-600 font-medium mb-2">{notif.message}</p>
                    <p className="text-xs text-gray-400 font-semibold">{timeAgo(notif.createdAt)}</p>
                  </div>

                  {/* Actions - ✅ FIXED: notif.unread */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {notif.unread ? (
                      <button
                        onClick={() => markAsRead(notif._id)}
                        className="btn-icon"
                        title="Mark as read"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => markAsUnread(notif._id)}
                        className="btn-icon"
                        title="Mark as unread"
                      >
                        <Bell className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => deleteNotification(notif._id)}
                      className="btn-icon"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}

      </div>

      {/* ✅ Delete Confirmation Modal */}
      <DeleteConfirm
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, id: null, type: 'single' })}
        {...getDeleteModalProps()}
        isLoading={isDeleting}
      />

    </div>
  );
}