// backend/routes/customers.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');

/**
 * GET /api/customers
 * Get all customers with optional filters
 * Query params: status, tag, search, page, limit
 */
router.get('/', async (req, res) => {
  try {
    const { status, tag, search, page = 1, limit = 50 } = req.query;

    // Build query
    let query = {};
    
    if (status) {
      query.status = status;
    }
    
    if (tag) {
      query.tags = tag;
    }
    
    if (search) {
      query.$or = [
        { name: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { company: new RegExp(search, 'i') }
      ];
    }

    // Execute query with pagination
    const skip = (page - 1) * limit;
    const customers = await Customer.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Get total count
    const total = await Customer.countDocuments(query);

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customers'
    });
  }
});

/**
 * GET /api/customers/:id
 * Get single customer by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch customer'
    });
  }
});

/**
 * POST /api/customers
 * Create new customer
 */
router.post('/',
  [
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('phone').trim().notEmpty().withMessage('Phone is required'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('status').optional().isIn(['active', 'inactive', 'blocked'])
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

      // Check if phone already exists
      const existingCustomer = await Customer.findOne({ phone: req.body.phone });
      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          error: 'Phone number already exists'
        });
      }

      // Create customer
      const customer = new Customer(req.body);
      await customer.save();

      res.status(201).json({
        success: true,
        message: 'Customer created successfully',
        data: customer
      });

    } catch (error) {
      console.error('Create customer error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to create customer'
      });
    }
  }
);

/**
 * PUT /api/customers/:id
 * Update customer
 */
router.put('/:id',
  [
    body('name').optional().trim().notEmpty(),
    body('phone').optional().trim().notEmpty(),
    body('email').optional().isEmail(),
    body('status').optional().isIn(['active', 'inactive', 'blocked'])
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

      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        { ...req.body, updatedBy: req.body.updatedBy || 'system' },
        { new: true, runValidators: true }
      );

      if (!customer) {
        return res.status(404).json({
          success: false,
          error: 'Customer not found'
        });
      }

      res.json({
        success: true,
        message: 'Customer updated successfully',
        data: customer
      });

    } catch (error) {
      console.error('Update customer error:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to update customer'
      });
    }
  }
);

/**
 * DELETE /api/customers/:id
 * Delete customer
 */
router.delete('/:id', async (req, res) => {
  try {
    const customer = await Customer.findByIdAndDelete(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        error: 'Customer not found'
      });
    }

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });

  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete customer'
    });
  }
});

/**
 * GET /api/customers/stats/summary
 * Get customer statistics
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Customer.countDocuments();
    const active = await Customer.countDocuments({ status: 'active' });
    const inactive = await Customer.countDocuments({ status: 'inactive' });
    const blocked = await Customer.countDocuments({ status: 'blocked' });

    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        blocked
      }
    });

  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch statistics'
    });
  }
});

module.exports = router;