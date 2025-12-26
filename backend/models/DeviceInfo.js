// backend/models/DeviceInfo.js
const mongoose = require('mongoose');

const deviceInfoSchema = new mongoose.Schema({
    phoneNumber: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    deviceBrand: {
        type: String,
        default: 'Unknown'
    },
    deviceModel: {
        type: String,
        default: 'Unknown'
    },
    osVersion: {
        type: String,
        default: 'Unknown'
    },
    userName: {
        type: String,
        default: 'Unknown User'
    },
    lastConnected: {
        type: Date,
        default: Date.now
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Method untuk get display name
deviceInfoSchema.methods.getDisplayName = function() {
    if (this.deviceBrand === 'Unknown' && this.deviceModel === 'Unknown') {
        return 'WhatsApp Multi-Device';
    }
    return `${this.deviceBrand} ${this.deviceModel}`;
};

// Method untuk get full info
deviceInfoSchema.methods.getFullInfo = function() {
    if (this.deviceBrand === 'Unknown') {
        return 'WhatsApp Multi-Device (Baileys)';
    }
    return `${this.deviceBrand} ${this.deviceModel} - ${this.osVersion}`;
};

const DeviceInfo = mongoose.model('DeviceInfo', deviceInfoSchema);

module.exports = DeviceInfo;