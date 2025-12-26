const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Template = require('../models/Template');
const { authenticate } = require('../middleware/auth');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
  notifyTemplateCreated,
  notifyTemplateUpdated,
  notifyTemplateDeleted,
  notifyTemplateDuplicated
} = require('../utils/notificationHelper');

// Apply authenticate middleware to all routes
router.use(authenticate);

// GET ALL TEMPLATES (with user isolation)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    const query = role === 'admin' ? {} : { createdBy: userId };
    
    console.log(`📋 [TEMPLATES] GET by ${req.user.email} (${role})`);
    console.log(`📋 [TEMPLATES] Query:`, query);
    
    const templates = await Template.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    console.log(`✅ [TEMPLATES] Found ${templates.length} templates`);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('❌ [TEMPLATES] Error fetching templates:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data template',
      error: error.message
    });
  }
});

// GET SINGLE TEMPLATE (with permission check)
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    const template = await Template.findById(req.params.id)
      .populate('createdBy', 'name email');

    if (!template) {
      console.log(`⚠️ [TEMPLATES] Template ${req.params.id} not found`);
      return res.status(404).json({
        success: false,
        message: 'Template tidak ditemukan'
      });
    }

    if (role !== 'admin' && template.createdBy._id.toString() !== userId) {
      console.log(`❌ [TEMPLATES] Access denied: ${req.user.email} tried to access template owned by ${template.createdBy.email}`);
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke template ini'
      });
    }

    console.log(`✅ [TEMPLATES] Get template ${req.params.id} by ${req.user.email}`);

    res.json({
      success: true,
      data: template
    });
  } catch (error) {
    console.error('❌ [TEMPLATES] Error fetching template:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil detail template',
      error: error.message
    });
  }
});

// GET TEMPLATES BY CATEGORY (with user isolation)
router.get('/category/:category', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    const { category } = req.params;
    
    const query = role === 'admin' 
      ? { category } 
      : { category, createdBy: userId };
    
    console.log(`📋 [TEMPLATES] GET category "${category}" by ${req.user.email}`);
    
    const templates = await Template.find(query)
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    console.log(`✅ [TEMPLATES] Found ${templates.length} templates in category "${category}"`);

    res.json({
      success: true,
      data: templates
    });
  } catch (error) {
    console.error('❌ [TEMPLATES] Error fetching templates by category:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil template berdasarkan kategori',
      error: error.message
    });
  }
});

// POST CREATE NEW TEMPLATE
router.post('/',
  [
    body('name').notEmpty().withMessage('Nama template wajib diisi'),
    body('message').notEmpty().withMessage('Pesan template wajib diisi'),
    body('category').optional().isIn([
      'promo', 'reminder', 'announcement', 'confirmation', 
      'general', 'greeting', 'notification', 'follow-up'
    ]).withMessage('Kategori tidak valid')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validasi gagal',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const { name, message, category } = req.body;

      const template = new Template({
        name,
        message,
        category: category || 'general',
        createdBy: userId
      });

      await template.save();

      console.log(`✅ [TEMPLATES] Created "${name}" by ${req.user.email} (ID: ${template._id})`);

      // 🔔 NOTIFY: Template created
      await notifyTemplateCreated(userId, template);

      res.status(201).json({
        success: true,
        message: 'Template berhasil dibuat',
        data: template
      });

    } catch (error) {
      console.error('❌ [TEMPLATES] Error creating template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal membuat template',
        error: error.message
      });
    }
  }
);

// PUT UPDATE TEMPLATE (with ownership check)
router.put('/:id',
  [
    body('name').notEmpty().withMessage('Nama template wajib diisi'),
    body('message').notEmpty().withMessage('Pesan template wajib diisi'),
    body('category').optional().isIn([
      'promo', 'reminder', 'announcement', 'confirmation', 
      'general', 'greeting', 'notification', 'follow-up'
    ]).withMessage('Kategori tidak valid')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validasi gagal',
          errors: errors.array()
        });
      }

      const userId = req.user.id;
      const role = req.user.role;
      
      const template = await Template.findById(req.params.id);

      if (!template) {
        console.log(`⚠️ [TEMPLATES] Template ${req.params.id} not found for update`);
        return res.status(404).json({
          success: false,
          message: 'Template tidak ditemukan'
        });
      }

      if (role !== 'admin' && template.createdBy.toString() !== userId) {
        console.log(`❌ [TEMPLATES] Update denied: ${req.user.email} tried to update template owned by ${template.createdBy}`);
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses untuk mengubah template ini'
        });
      }

      const { name, message, category } = req.body;
      template.name = name;
      template.message = message;
      if (category) template.category = category;

      await template.save();

      console.log(`✅ [TEMPLATES] Updated "${name}" (${template._id}) by ${req.user.email}`);

      // 🔔 NOTIFY: Template updated
      await notifyTemplateUpdated(userId, template);

      res.json({
        success: true,
        message: 'Template berhasil diperbarui',
        data: template
      });

    } catch (error) {
      console.error('❌ [TEMPLATES] Error updating template:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal memperbarui template',
        error: error.message
      });
    }
  }
);

// DELETE TEMPLATE (with ownership check)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    const template = await Template.findById(req.params.id);

    if (!template) {
      console.log(`⚠️ [TEMPLATES] Template ${req.params.id} not found for deletion`);
      return res.status(404).json({
        success: false,
        message: 'Template tidak ditemukan'
      });
    }

    if (role !== 'admin' && template.createdBy.toString() !== userId) {
      console.log(`❌ [TEMPLATES] Delete denied: ${req.user.email} (${role}) tried to delete template owned by ${template.createdBy}`);
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menghapus template ini. Hanya pemilik template atau admin yang dapat menghapus.'
      });
    }

    const templateName = template.name;

    await Template.findByIdAndDelete(req.params.id);

    console.log(`✅ [TEMPLATES] Deleted "${template.name}" (${req.params.id}) by ${req.user.email} (${role})`);

    // 🔔 NOTIFY: Template deleted
    await notifyTemplateDeleted(userId, templateName);

    res.json({
      success: true,
      message: 'Template berhasil dihapus'
    });

  } catch (error) {
    console.error('❌ [TEMPLATES] Error deleting template:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus template',
      error: error.message
    });
  }
});

// POST DUPLICATE TEMPLATE
router.post('/:id/duplicate', async (req, res) => {
  try {
    const userId = req.user.id;
    const role = req.user.role;
    
    const originalTemplate = await Template.findById(req.params.id);

    if (!originalTemplate) {
      return res.status(404).json({
        success: false,
        message: 'Template tidak ditemukan'
      });
    }

    if (role !== 'admin' && originalTemplate.createdBy.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke template ini'
      });
    }

    const duplicateTemplate = new Template({
      name: `${originalTemplate.name} (Copy)`,
      message: originalTemplate.message,
      category: originalTemplate.category,
      createdBy: userId
    });

    await duplicateTemplate.save();

    console.log(`✅ [TEMPLATES] Duplicated "${originalTemplate.name}" by ${req.user.email}`);

    // 🔔 NOTIFY: Template duplicated
    await notifyTemplateDuplicated(userId, originalTemplate.name, duplicateTemplate);

    res.status(201).json({
      success: true,
      message: 'Template berhasil diduplikasi',
      data: duplicateTemplate
    });

  } catch (error) {
    console.error('❌ [TEMPLATES] Error duplicating template:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menduplikasi template',
      error: error.message
    });
  }
});

module.exports = router;