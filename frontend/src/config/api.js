// frontend/src/config/api.js

// API Base URL
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// API Endpoints
export const API_ENDPOINTS = {
  // Health & Info
  health: '/api/health',
  root: '/',
  
  // Customer Endpoints
  customers: {
    list: '/api/customers',
    create: '/api/customers',
    getOne: (id) => `/api/customers/${id}`,
    update: (id) => `/api/customers/${id}`,
    delete: (id) => `/api/customers/${id}`,
  },
  
  // AI Endpoints
  ai: {
    generate: '/api/ai/generate',
    test: '/api/ai/test',
    status: '/api/ai/status',
  },
  
  // Test Endpoints
  test: {
    greet: '/api/test/greet',
    customer: '/api/test/customer',
    customerClearAll: '/api/test/customer-clear-all',
    aiHealth: '/api/test/ai/health',
    aiGenerate: '/api/test/ai/generate',
    aiVariations: '/api/test/ai/variations',
    ping: '/api/test/ping',
    env: '/api/test/env',
  }
};

// API Helper Functions
export const getFullUrl = (endpoint) => {
  return `${API_BASE_URL}${endpoint}`;
};

export const apiRequest = async (endpoint, options = {}) => {
  const url = getFullUrl(endpoint);
  
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };
  
  try {
    const response = await fetch(url, finalOptions);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || data.message || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

export default {
  API_BASE_URL,
  API_ENDPOINTS,
  getFullUrl,
  apiRequest,
};