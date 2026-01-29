// backend/routes/ai.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const aiService = require('../services/aiService');

/**
 * POST /api/ai/generate
 * Generate AI message
 * 
 * Request Body:
 * {
 *   "prompt": "Promo diskon 50% produk elektronik",
 *   "tone": "casual",      // optional: formal, casual, urgent
 *   "length": "medium"     // optional: short, medium, long
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Generated message text...",
 *   "provider": "gemini",
 *   "metadata": { ... }
 * }
 */
router.post('/generate',
  [
    body('prompt')
      .trim()
      .notEmpty().withMessage('Prompt is required')
      .isLength({ min: 5, max: 1000 }).withMessage('Prompt must be between 5-1000 characters'),
    body('tone')
      .optional()
      .isIn(['formal', 'casual', 'urgent', 'professional', 'friendly', 'enthusiastic']).withMessage('Tone must be: formal, casual, urgent, professional, friendly, or enthusiastic'),
    body('length')
      .optional()
      .isIn(['short', 'medium', 'long']).withMessage('Length must be: short, medium, or long'),
    body('model')
      .optional()
      .isIn(['xiaomi/mimo-v2-flash:free']).withMessage('Model not supported')
  ],
  async (req, res) => {
    try {
      // Validate request
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { prompt, tone, length, model } = req.body;

      console.log('📥 [API] Generate request received:', { prompt, tone, length, model });

      // Generate message
      const result = await aiService.generateMessage({
        prompt,
        tone: tone || 'casual',
        length: length || 'medium',
        model: model || 'gemini-2.5-flash'
      });

      console.log('✅ [API] Message generated successfully');

      // Return result
      res.json(result);

    } catch (error) {
      console.error('❌ [API] Generate error:', error.message);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate message',
        provider: 'gemini'
      });
    }
  }
);

/**
 * GET /api/ai/test
 * Test AI service connection
 * 
 * Response:
 * {
 *   "success": true,
 *   "status": "connected",
 *   "message": "AI service is working!",
 *   "testResult": { ... }
 * }
 */
router.get('/test', async (req, res) => {
  try {
    console.log('🧪 [API] Testing AI service connection...');

    const result = await aiService.testConnection();

    const statusCode = result.success ? 200 : 503;

    console.log(result.success ?
      '✅ [API] AI service test passed' :
      '❌ [API] AI service test failed'
    );

    res.status(statusCode).json(result);

  } catch (error) {
    console.error('❌ [API] Test error:', error.message);

    res.status(503).json({
      success: false,
      status: 'error',
      message: error.message || 'Failed to test AI service',
      troubleshooting: {
        step1: 'Check if N8N is running',
        step2: 'Check if workflow is Active',
        step3: 'Check webhook URL configuration'
      }
    });
  }
});

/**
 * GET /api/ai/status
 * Get AI service status and configuration
 * 
 * Response:
 * {
 *   "success": true,
 *   "provider": "gemini",
 *   "model": "gemini-2.5-flash",
 *   "webhookUrl": "...",
 *   "features": { ... }
 * }
 */
router.get('/status', (req, res) => {
  try {
    console.log('📊 [API] Getting AI service status...');

    const info = aiService.getServiceInfo();

    res.json({
      success: true,
      ...info,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ [API] Status error:', error.message);

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get AI service status'
    });
  }
});

/**
 * POST /api/ai/batch
 * Generate multiple messages at once
 * 
 * Request Body:
 * {
 *   "prompts": [
 *     { "prompt": "...", "tone": "casual", "length": "short" },
 *     { "prompt": "...", "tone": "formal", "length": "medium" }
 *   ]
 * }
 */
router.post('/batch',
  [
    body('prompts')
      .isArray({ min: 1, max: 10 }).withMessage('Prompts must be an array of 1-10 items')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { prompts } = req.body;

      console.log(`📥 [API] Batch generate request: ${prompts.length} prompts`);

      // Generate all messages
      const results = await Promise.allSettled(
        prompts.map(item => aiService.generateMessage(item))
      );

      // Format results
      const responses = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return {
            success: true,
            index,
            ...result.value
          };
        } else {
          return {
            success: false,
            index,
            error: result.reason.message
          };
        }
      });

      const successCount = responses.filter(r => r.success).length;
      console.log(`✅ [API] Batch complete: ${successCount}/${prompts.length} successful`);

      res.json({
        success: true,
        total: prompts.length,
        successful: successCount,
        failed: prompts.length - successCount,
        results: responses
      });

    } catch (error) {
      console.error('❌ [API] Batch error:', error.message);

      res.status(500).json({
        success: false,
        error: error.message || 'Failed to generate batch messages'
      });
    }
  }
);

module.exports = router;