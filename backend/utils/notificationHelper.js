// backend/utils/notificationHelper.js
// 🔔 AUTO-NOTIFICATION SYSTEM
// Automatically create notifications for every system event

const Notification = require('../models/Notification');

// ============================================
// 📋 NOTIFICATION TYPES & CONFIG
// ============================================

const NOTIFICATION_TYPES = {
  // 📢 Broadcast Events
  BROADCAST_CREATED: {
    type: 'success',
    icon: 'Megaphone',
    title: 'Broadcast Created',
    getMessage: (data) => `Broadcast "${data.name}" has been created with ${data.totalRecipients} recipients.`
  },
  BROADCAST_STARTED: {
    type: 'alert',
    icon: 'Play',
    title: 'Broadcast Started',
    getMessage: (data) => `Broadcast "${data.name}" is now sending messages to ${data.totalRecipients} recipients.`
  },
  BROADCAST_COMPLETED: {
    type: 'success',
    icon: 'CheckCircle',
    title: 'Broadcast Completed',
    getMessage: (data) => `Broadcast "${data.name}" completed! Success: ${data.successCount}, Failed: ${data.failedCount}.`
  },
  BROADCAST_FAILED: {
    type: 'warning',
    icon: 'AlertTriangle',
    title: 'Broadcast Failed',
    getMessage: (data) => `Broadcast "${data.name}" failed. Error: ${data.error || 'Unknown error'}.`
  },
  BROADCAST_PAUSED: {
    type: 'warning',
    icon: 'Pause',
    title: 'Broadcast Paused',
    getMessage: (data) => `Broadcast "${data.name}" has been paused. Progress: ${data.sentCount}/${data.totalRecipients}.`
  },
  BROADCAST_RESUMED: {
    type: 'alert',
    icon: 'Play',
    title: 'Broadcast Resumed',
    getMessage: (data) => `Broadcast "${data.name}" has been resumed. Remaining: ${data.remainingCount} messages.`
  },
  BROADCAST_DELETED: {
    type: 'system',
    icon: 'Trash2',
    title: 'Broadcast Deleted',
    getMessage: (data) => `Broadcast "${data.name}" has been deleted.`
  },
  
  // 📱 WhatsApp Events
  WHATSAPP_CONNECTED: {
    type: 'success',
    icon: 'Smartphone',
    title: 'WhatsApp Connected',
    getMessage: (data) => `WhatsApp connected successfully${data.deviceName ? ` as ${data.deviceName}` : ''}.`
  },
  WHATSAPP_DISCONNECTED: {
    type: 'warning',
    icon: 'WifiOff',
    title: 'WhatsApp Disconnected',
    getMessage: (data) => `WhatsApp has been disconnected. ${data.reason || 'Please reconnect to continue sending messages.'}`
  },
  WHATSAPP_QR_READY: {
    type: 'alert',
    icon: 'QrCode',
    title: 'QR Code Ready',
    getMessage: () => 'QR Code is ready. Please scan with your WhatsApp to connect.'
  },
  WHATSAPP_RECONNECTING: {
    type: 'system',
    icon: 'RefreshCw',
    title: 'WhatsApp Reconnecting',
    getMessage: () => 'WhatsApp is reconnecting. Please wait...'
  },
  WHATSAPP_ERROR: {
    type: 'warning',
    icon: 'AlertCircle',
    title: 'WhatsApp Error',
    getMessage: (data) => `WhatsApp connection error: ${data.error || 'Unknown error'}.`
  },
  
  // 👥 Customer Events
  CUSTOMER_ADDED: {
    type: 'success',
    icon: 'UserPlus',
    title: 'Customer Added',
    getMessage: (data) => `Customer "${data.name}" (${data.phone}) has been added successfully.`
  },
  CUSTOMER_IMPORTED: {
    type: 'success',
    icon: 'Upload',
    title: 'Customers Imported',
    getMessage: (data) => `Successfully imported ${data.successCount} customer(s). Failed: ${data.failedCount || 0}.`
  },
  CUSTOMER_UPDATED: {
    type: 'system',
    icon: 'UserCheck',
    title: 'Customer Updated',
    getMessage: (data) => `Customer "${data.name}" has been updated.`
  },
  CUSTOMER_DELETED: {
    type: 'system',
    icon: 'UserMinus',
    title: 'Customer Deleted',
    getMessage: (data) => `Customer "${data.name}" has been deleted.`
  },
  
  // 📝 Template Events
  TEMPLATE_CREATED: {
    type: 'success',
    icon: 'FileText',
    title: 'Template Created',
    getMessage: (data) => `Template "${data.name}" (${data.category}) has been created.`
  },
  TEMPLATE_UPDATED: {
    type: 'system',
    icon: 'Edit',
    title: 'Template Updated',
    getMessage: (data) => `Template "${data.name}" has been updated.`
  },
  TEMPLATE_DELETED: {
    type: 'system',
    icon: 'Trash2',
    title: 'Template Deleted',
    getMessage: (data) => `Template "${data.name}" has been deleted.`
  },
  TEMPLATE_DUPLICATED: {
    type: 'success',
    icon: 'Copy',
    title: 'Template Duplicated',
    getMessage: (data) => `Template "${data.originalName}" has been duplicated as "${data.newName}".`
  },
  
  // ⚙️ System Events
  LOGIN_SUCCESS: {
    type: 'success',
    icon: 'LogIn',
    title: 'Login Successful',
    getMessage: (data) => `Welcome back${data.name ? `, ${data.name}` : ''}! You have successfully logged in.`
  },
  LOGIN_FAILED: {
    type: 'warning',
    icon: 'AlertTriangle',
    title: 'Login Failed',
    getMessage: (data) => `Failed login attempt detected${data.ip ? ` from ${data.ip}` : ''}.`
  },
  PASSWORD_CHANGED: {
    type: 'success',
    icon: 'Lock',
    title: 'Password Changed',
    getMessage: () => 'Your password has been changed successfully.'
  },
  PROFILE_UPDATED: {
    type: 'success',
    icon: 'User',
    title: 'Profile Updated',
    getMessage: () => 'Your profile has been updated successfully.'
  },
  SETTINGS_UPDATED: {
    type: 'success',
    icon: 'Settings',
    title: 'Settings Updated',
    getMessage: () => 'Your settings have been saved successfully.'
  }
};

// ============================================
// 🔧 CORE NOTIFICATION FUNCTION
// ============================================

/**
 * Create a notification for a user
 * @param {String} userId - User ID (MongoDB ObjectId)
 * @param {String} eventType - Event type from NOTIFICATION_TYPES
 * @param {Object} data - Additional data for the notification
 * @param {Object} options - Optional settings (actionUrl, metadata)
 * @returns {Promise<Object>} Created notification or null
 */
async function createNotification(userId, eventType, data = {}, options = {}) {
  try {
    // Validate event type
    const notifConfig = NOTIFICATION_TYPES[eventType];
    if (!notifConfig) {
      console.error(`❌ [NOTIFICATION] Unknown event type: ${eventType}`);
      return null;
    }

    // Generate message
    const message = notifConfig.getMessage(data);

    // Create notification object
    const notification = await Notification.create({
      user: userId,
      type: notifConfig.type,
      title: notifConfig.title,
      message: message,
      icon: notifConfig.icon,
      unread: true,
      actionUrl: options.actionUrl || null,
      metadata: {
        eventType,
        timestamp: new Date(),
        ...data,
        ...(options.metadata || {})
      }
    });

    console.log(`✅ [NOTIFICATION] Created: ${eventType} for user ${userId}`);
    return notification;

  } catch (error) {
    console.error(`❌ [NOTIFICATION] Error creating notification:`, error.message);
    // Don't throw error - notification failures shouldn't break main operations
    return null;
  }
}

// ============================================
// 📢 BROADCAST NOTIFICATION FUNCTIONS
// ============================================

async function notifyBroadcastCreated(userId, broadcast) {
  return createNotification(userId, 'BROADCAST_CREATED', {
    name: broadcast.name,
    totalRecipients: broadcast.totalRecipients || broadcast.recipients?.length || 0,
    broadcastId: broadcast._id
  }, {
    actionUrl: `/broadcasts/${broadcast._id}`
  });
}

async function notifyBroadcastStarted(userId, broadcast) {
  return createNotification(userId, 'BROADCAST_STARTED', {
    name: broadcast.name,
    totalRecipients: broadcast.totalRecipients,
    broadcastId: broadcast._id
  }, {
    actionUrl: `/broadcasts/${broadcast._id}`
  });
}

async function notifyBroadcastCompleted(userId, broadcast) {
  return createNotification(userId, 'BROADCAST_COMPLETED', {
    name: broadcast.name,
    successCount: broadcast.successCount || 0,
    failedCount: broadcast.failedCount || 0,
    totalRecipients: broadcast.totalRecipients,
    broadcastId: broadcast._id
  }, {
    actionUrl: `/broadcasts/${broadcast._id}`
  });
}

async function notifyBroadcastFailed(userId, broadcast, error) {
  return createNotification(userId, 'BROADCAST_FAILED', {
    name: broadcast.name,
    error: error,
    broadcastId: broadcast._id
  }, {
    actionUrl: `/broadcasts/${broadcast._id}`
  });
}

async function notifyBroadcastPaused(userId, broadcast) {
  return createNotification(userId, 'BROADCAST_PAUSED', {
    name: broadcast.name,
    sentCount: (broadcast.successCount || 0) + (broadcast.failedCount || 0),
    totalRecipients: broadcast.totalRecipients,
    broadcastId: broadcast._id
  }, {
    actionUrl: `/broadcasts/${broadcast._id}`
  });
}

async function notifyBroadcastResumed(userId, broadcast) {
  const sentCount = (broadcast.successCount || 0) + (broadcast.failedCount || 0);
  return createNotification(userId, 'BROADCAST_RESUMED', {
    name: broadcast.name,
    remainingCount: broadcast.totalRecipients - sentCount,
    broadcastId: broadcast._id
  }, {
    actionUrl: `/broadcasts/${broadcast._id}`
  });
}

async function notifyBroadcastDeleted(userId, broadcastName) {
  return createNotification(userId, 'BROADCAST_DELETED', {
    name: broadcastName
  });
}

// ============================================
// 📱 WHATSAPP NOTIFICATION FUNCTIONS
// ============================================

async function notifyWhatsAppConnected(userId, deviceInfo = {}) {
  return createNotification(userId, 'WHATSAPP_CONNECTED', {
    deviceName: deviceInfo.name || deviceInfo.userName,
    deviceNumber: deviceInfo.number || deviceInfo.phoneNumber,
    devicePlatform: deviceInfo.platform || deviceInfo.deviceBrand
  }, {
    actionUrl: '/whatsapp'
  });
}

async function notifyWhatsAppDisconnected(userId, reason = '') {
  return createNotification(userId, 'WHATSAPP_DISCONNECTED', {
    reason: reason
  }, {
    actionUrl: '/whatsapp'
  });
}

async function notifyWhatsAppQRReady(userId) {
  return createNotification(userId, 'WHATSAPP_QR_READY', {}, {
    actionUrl: '/whatsapp'
  });
}

async function notifyWhatsAppReconnecting(userId) {
  return createNotification(userId, 'WHATSAPP_RECONNECTING', {}, {
    actionUrl: '/whatsapp'
  });
}

async function notifyWhatsAppError(userId, error) {
  return createNotification(userId, 'WHATSAPP_ERROR', {
    error: error
  }, {
    actionUrl: '/whatsapp'
  });
}

// ============================================
// 👥 CUSTOMER NOTIFICATION FUNCTIONS
// ============================================

async function notifyCustomerAdded(userId, customer) {
  return createNotification(userId, 'CUSTOMER_ADDED', {
    name: customer.name,
    phone: customer.phone,
    customerId: customer._id
  }, {
    actionUrl: `/customers`
  });
}

async function notifyCustomerImported(userId, results) {
  return createNotification(userId, 'CUSTOMER_IMPORTED', {
    successCount: results.success?.length || 0,
    failedCount: results.failed?.length || 0,
    totalCount: (results.success?.length || 0) + (results.failed?.length || 0)
  }, {
    actionUrl: '/customers'
  });
}

async function notifyCustomerUpdated(userId, customer) {
  return createNotification(userId, 'CUSTOMER_UPDATED', {
    name: customer.name,
    customerId: customer._id
  }, {
    actionUrl: `/customers`
  });
}

async function notifyCustomerDeleted(userId, customerName) {
  return createNotification(userId, 'CUSTOMER_DELETED', {
    name: customerName
  }, {
    actionUrl: '/customers'
  });
}

// ============================================
// 📝 TEMPLATE NOTIFICATION FUNCTIONS
// ============================================

async function notifyTemplateCreated(userId, template) {
  return createNotification(userId, 'TEMPLATE_CREATED', {
    name: template.name,
    category: template.category,
    templateId: template._id
  }, {
    actionUrl: `/templates`
  });
}

async function notifyTemplateUpdated(userId, template) {
  return createNotification(userId, 'TEMPLATE_UPDATED', {
    name: template.name,
    templateId: template._id
  }, {
    actionUrl: `/templates`
  });
}

async function notifyTemplateDeleted(userId, templateName) {
  return createNotification(userId, 'TEMPLATE_DELETED', {
    name: templateName
  }, {
    actionUrl: '/templates'
  });
}

async function notifyTemplateDuplicated(userId, originalName, newTemplate) {
  return createNotification(userId, 'TEMPLATE_DUPLICATED', {
    originalName: originalName,
    newName: newTemplate.name,
    templateId: newTemplate._id
  }, {
    actionUrl: `/templates`
  });
}

// ============================================
// ⚙️ SYSTEM NOTIFICATION FUNCTIONS
// ============================================

async function notifyLoginSuccess(userId, userName) {
  return createNotification(userId, 'LOGIN_SUCCESS', {
    name: userName
  });
}

async function notifyLoginFailed(userId, ipAddress) {
  return createNotification(userId, 'LOGIN_FAILED', {
    ip: ipAddress
  });
}

async function notifyPasswordChanged(userId) {
  return createNotification(userId, 'PASSWORD_CHANGED', {});
}

async function notifyProfileUpdated(userId) {
  return createNotification(userId, 'PROFILE_UPDATED', {});
}

async function notifySettingsUpdated(userId) {
  return createNotification(userId, 'SETTINGS_UPDATED', {});
}

// ============================================
// 🔄 BATCH NOTIFICATION FUNCTION
// ============================================

/**
 * Create multiple notifications at once
 * Useful for importing customers, bulk operations, etc.
 * @param {Array} notificationConfigs - Array of {userId, eventType, data, options}
 * @returns {Promise<Array>} Array of created notifications
 */
async function createBatchNotifications(notificationConfigs) {
  try {
    const promises = notificationConfigs.map(config => 
      createNotification(config.userId, config.eventType, config.data, config.options)
    );
    
    const results = await Promise.allSettled(promises);
    
    const successful = results.filter(r => r.status === 'fulfilled' && r.value !== null);
    const failed = results.filter(r => r.status === 'rejected' || r.value === null);
    
    console.log(`✅ [NOTIFICATION] Batch: ${successful.length} created, ${failed.length} failed`);
    
    return successful.map(r => r.value);
  } catch (error) {
    console.error(`❌ [NOTIFICATION] Batch error:`, error.message);
    return [];
  }
}

// ============================================
// 📤 EXPORTS
// ============================================

module.exports = {
  // Core function
  createNotification,
  
  // Broadcast notifications
  notifyBroadcastCreated,
  notifyBroadcastStarted,
  notifyBroadcastCompleted,
  notifyBroadcastFailed,
  notifyBroadcastPaused,
  notifyBroadcastResumed,
  notifyBroadcastDeleted,
  
  // WhatsApp notifications
  notifyWhatsAppConnected,
  notifyWhatsAppDisconnected,
  notifyWhatsAppQRReady,
  notifyWhatsAppReconnecting,
  notifyWhatsAppError,
  
  // Customer notifications
  notifyCustomerAdded,
  notifyCustomerImported,
  notifyCustomerUpdated,
  notifyCustomerDeleted,
  
  // Template notifications
  notifyTemplateCreated,
  notifyTemplateUpdated,
  notifyTemplateDeleted,
  notifyTemplateDuplicated,
  
  // System notifications
  notifyLoginSuccess,
  notifyLoginFailed,
  notifyPasswordChanged,
  notifyProfileUpdated,
  notifySettingsUpdated,
  
  // Batch operations
  createBatchNotifications,
  
  // Config export (for reference)
  NOTIFICATION_TYPES
};