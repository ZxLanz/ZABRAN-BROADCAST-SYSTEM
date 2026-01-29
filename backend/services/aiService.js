// backend/services/aiService.js
const axios = require('axios');

// N8N Webhook URL from environment variables
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook/generate-message';

/**
 * Generate AI message via N8N workflow (Gemini 2.5 Flash)
 * @param {Object} params - Parameters for message generation
 * @param {string} params.prompt - Description of the message to generate
 * @param {string} params.tone - Message tone: 'formal', 'casual', 'urgent'
 * @param {string} params.length - Message length: 'short', 'medium', 'long'
 * @returns {Promise<Object>} Generated message with metadata
 */
const generateMessage = async ({ prompt, tone = 'casual', length = 'medium' }) => {
  try {
    console.log('🤖 [AI Service] Generating message...');
    console.log('📝 Prompt:', prompt);
    console.log('🎭 Tone:', tone);
    console.log('📏 Length:', length);

    // Validate input
    if (!prompt || prompt.trim().length === 0) {
      throw new Error('Prompt is required and cannot be empty');
    }

    // Validate tone
    const validTones = ['formal', 'casual', 'urgent'];
    if (!validTones.includes(tone)) {
      throw new Error(`Invalid tone "${tone}". Must be one of: ${validTones.join(', ')}`);
    }

    // Validate length
    const validLengths = ['short', 'medium', 'long'];
    if (!validLengths.includes(length)) {
      throw new Error(`Invalid length "${length}". Must be one of: ${validLengths.join(', ')}`);
    }

    console.log('📡 Calling N8N webhook:', N8N_WEBHOOK_URL);

    // Call N8N webhook
    const startTime = Date.now();
    const response = await axios.post(
      N8N_WEBHOOK_URL,
      {
        prompt: prompt.trim(),
        tone,
        length
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ZABRAN-Backend/1.0'
        },
        timeout: 30000, // 30 seconds timeout
        validateStatus: (status) => status === 200 // Only accept 200 OK
      }
    );

    const responseTime = Date.now() - startTime;
    console.log(`✅ [AI Service] Response received in ${responseTime}ms`);
    console.log('📊 Response status:', response.status);

    // Parse N8N response
    const data = response.data;

    // Handle different response formats
    let generatedMessage;
    let metadata = {};

    if (data.success && data.message) {
      // Format Response node output (expected format)
      console.log('✅ Using formatted response');
      generatedMessage = data.message;
      metadata = data.metadata || {};
    } else if (data.candidates && data.candidates[0]) {
      // Raw Gemini API response (fallback)
      console.log('⚠️ Using raw Gemini response');
      generatedMessage = data.candidates[0].content.parts[0].text;
      metadata = {
        model: data.modelVersion || 'gemini-2.5-flash',
        tokensUsed: data.usageMetadata?.totalTokenCount || 0,
        promptTokens: data.usageMetadata?.promptTokenCount || 0,
        outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
        finishReason: data.candidates[0].finishReason || 'STOP'
      };
    } else {
      console.error('❌ Invalid response format:', data);
      throw new Error('Invalid response format from N8N workflow');
    }

    // Check if message was truncated
    if (metadata.finishReason === 'MAX_TOKENS') {
      console.warn('⚠️ Message was truncated due to max tokens limit');
    }

    console.log('✅ [AI Service] Message generated successfully!');
    console.log('📝 Message length:', generatedMessage.length, 'characters');

    // Return formatted response
    return {
      success: true,
      message: generatedMessage,
      provider: 'gemini',
      metadata: {
        prompt,
        tone,
        length,
        model: metadata.model || 'gemini-2.5-flash',
        tokensUsed: metadata.tokensUsed || 0,
        promptTokens: metadata.promptTokens || 0,
        outputTokens: metadata.outputTokens || 0,
        finishReason: metadata.finishReason || 'STOP',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      }
    };

  } catch (error) {
    console.error('❌ [AI Service] Error:', error.message);

    // Handle different error types
    if (error.response) {
      // N8N returned an error response
      console.error('📡 N8N Error Response:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });

      throw new Error(
        `N8N Webhook Error (${error.response.status}): ${error.response.data?.message ||
        error.response.data?.error ||
        error.response.statusText
        }`
      );
    } else if (error.request) {
      // Request was made but no response received
      console.error('📡 No response from N8N');
      console.error('Request details:', {
        url: N8N_WEBHOOK_URL,
        method: 'POST',
        timeout: '30s'
      });

      throw new Error(
        'Cannot connect to AI service. Please check:\n' +
        '1. N8N is running (http://localhost:5678)\n' +
        '2. Workflow is Active (green toggle)\n' +
        '3. Webhook URL is correct'
      );
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('N8N service is not running. Please start N8N first.');
    } else if (error.code === 'ETIMEDOUT') {
      throw new Error('AI service timeout. The request took too long to complete.');
    } else {
      // Something else happened
      throw error;
    }
  }
};

/**
 * Test AI service connection
 * @returns {Promise<Object>} Connection status
 */
const testConnection = async () => {
  try {
    console.log('🔍 [AI Service] Testing connection...');
    console.log('📡 Webhook URL:', N8N_WEBHOOK_URL);

    // Try to generate a simple test message
    const result = await generateMessage({
      prompt: 'Test koneksi AI service',
      tone: 'casual',
      length: 'short'
    });

    console.log('✅ [AI Service] Connection test successful!');

    return {
      success: true,
      status: 'connected',
      message: 'AI service is working perfectly! 🎉',
      webhookUrl: N8N_WEBHOOK_URL,
      provider: 'gemini',
      model: result.metadata.model,
      testResult: {
        message: result.message,
        responseTime: result.metadata.responseTime,
        tokensUsed: result.metadata.tokensUsed
      }
    };
  } catch (error) {
    console.error('❌ [AI Service] Connection test failed:', error.message);

    return {
      success: false,
      status: 'disconnected',
      message: error.message,
      webhookUrl: N8N_WEBHOOK_URL,
      troubleshooting: {
        step1: 'Check if N8N is running: http://localhost:5678',
        step2: 'Check if workflow is Active (green toggle)',
        step3: 'Check if Gemini API key is valid',
        step4: 'Check webhook URL in .env file'
      }
    };
  }
};

/**
 * Get AI service info
 * @returns {Object} Service information
 */
const getServiceInfo = () => {
  return {
    provider: 'Google Gemini',
    model: 'gemini-2.5-flash',
    webhookUrl: N8N_WEBHOOK_URL,
    status: N8N_WEBHOOK_URL ? 'configured' : 'not configured',
    features: {
      tones: ['formal', 'casual', 'urgent'],
      lengths: ['short', 'medium', 'long'],
      maxPromptLength: 1000,
      estimatedResponseTime: '2-5 seconds'
    },
    pricing: {
      model: 'Free Tier',
      rateLimit: '15 requests/minute',
      monthlyQuota: '1.5M tokens/month'
    }
  };
};

/**
 * Get Auto Reply from AI (N8N)
 * @param {string} message - User message
 * @returns {Promise<string>} AI Response
 */
/**
 * Get Auto Reply from AI
 * @param {string} message - User message
 * @param {Array<string>} [images] - Array of Base64 image strings (optional)
 * @returns {Promise<string>} AI Response
 */
const getAutoReply = async (message, images = []) => {
  try {
    // 📸 VISION HANDLING (Direct OpenRouter)
    if (images && images.length > 0) {
      const openRouterKey = process.env.OPENROUTER_API_KEY;
      if (openRouterKey) {
        console.log(`📸 [AI Vision] Processing ${images.length} image(s) via OpenRouter...`);

        try {
          const payload = {
            model: 'xiaomi/mimo-v2-flash', // Multimodal Model
            messages: [
              {
                role: 'user',
                content: [
                  { type: 'text', text: message },
                  ...images.map(img => ({
                    type: 'image_url',
                    image_url: { url: `data:image/jpeg;base64,${img}` }
                  }))
                ]
              }
            ]
          };

          const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', payload, {
            headers: {
              'Authorization': `Bearer ${openRouterKey}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': 'https://zabran-broadcast.com',
              'X-Title': 'Zabran Broadcast'
            },
            timeout: 60000
          });

          if (response.data?.choices?.[0]?.message?.content) {
            console.log('👁️ [AI Vision] Response received');
            return response.data.choices[0].message.content;
          }
        } catch (visionErr) {
          console.error('⚠️ [Vision] Failed, falling back to text-only:', visionErr.message);
        }
      } else {
        console.warn('⚠️ [Vision] No OPENROUTER_API_KEY found, ignoring image.');
      }
    }

    // 📝 TEXT ONLY (Existing N8N Flow)
    const N8N_AUTOREPLY_URL = 'http://localhost:5678/webhook/autoreply';
    // console.log(`[AI-Service] Sending to ${N8N_AUTOREPLY_URL}:`, message.substring(0, 50));

    const response = await axios.post(N8N_AUTOREPLY_URL, {
      message: `[SYSTEM: Anda adalah asisten virtual Zabran System. JANGAN PERNAH menyapa user dengan nama "Lan", "Gan", atau nama tebakan lainnya. Jika nama user tidak diketahui pasti, panggil dengan "Kak". Jawablah pertanyaan user berikut ini:]\n\n${message}`
    }, { timeout: 60000 }); // 60s timeout

    // Robust Response Handling
    if (response.data.reply) return response.data.reply;
    if (response.data.message) return response.data.message;
    if (typeof response.data === 'string') return response.data;

    // Check choices format (OpenAI/Gemini style passthrough)
    if (response.data.choices && response.data.choices[0]?.message?.content) {
      return response.data.choices[0].message.content;
    }

    return null;
  } catch (error) {
    console.error('❌ [AI] AutoReply Error:', error.message);
    return null;
  }
};

module.exports = {
  generateMessage,
  testConnection,
  getServiceInfo,
  getAutoReply
};