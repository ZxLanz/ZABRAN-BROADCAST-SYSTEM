const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const Customer = require('../models/Customer');
const { authenticate } = require('../middleware/auth');

// 🔔 IMPORT NOTIFICATION HELPERS
const {
  notifyCustomerAdded,
  notifyCustomerImported,
  notifyCustomerUpdated,
  notifyCustomerDeleted
} = require('../utils/notificationHelper');

// PROTECT SEMUA ROUTE - WAJIB LOGIN
router.use(authenticate);

// GET STATS SUMMARY
router.get('/stats/summary', async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    
    let filter = {};
    if (role !== 'admin') {
      filter = { createdBy: userId };
    }
    
    const total = await Customer.countDocuments(filter);
    const active = await Customer.countDocuments({ 
      ...filter, 
      status: 'active' 
    });
    const inactive = await Customer.countDocuments({ 
      ...filter, 
      status: 'inactive' 
    });
    const blocked = await Customer.countDocuments({ 
      ...filter, 
      status: 'blocked' 
    });
    
    console.log(`[${role.toUpperCase()}] Stats: ${total} total customers`);
    
    res.json({
      success: true,
      data: {
        total,
        active,
        inactive,
        blocked,
        growthRate: '0%'
      }
    });
    
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer stats',
      error: error.message
    });
  }
});

// GET ALL CUSTOMERS - FILTERED BY USER
router.get('/', async (req, res) => {
  try {
    const { role, id: userId } = req.user;

    let filter = {};
    
    if (role === 'admin') {
      filter = {};
    } else {
      filter = { createdBy: userId };
    }

    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 });

    console.log(`[${role.toUpperCase()}] Found ${customers.length} customers`);

    res.json({
      success: true,
      data: customers,
      meta: {
        total: customers.length,
        role: role
      }
    });

  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data customer',
      error: error.message
    });
  }
});

// GET SINGLE CUSTOMER BY ID
router.get('/:id', async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer tidak ditemukan'
      });
    }

    if (role !== 'admin' && customer.createdBy?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses ke customer ini'
      });
    }

    res.json({
      success: true,
      data: customer
    });

  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data customer',
      error: error.message
    });
  }
});

// CREATE NEW CUSTOMER
router.post('/',
  [
    body('name').notEmpty().withMessage('Nama customer wajib diisi'),
    body('phone').notEmpty().withMessage('Nomor telepon wajib diisi')
      .matches(/^(\+62|62|0)[0-9]{9,12}$/)
      .withMessage('Format nomor telepon tidak valid')
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

      const { id: userId } = req.user;
      
      const { 
        name, 
        phone, 
        email, 
        address, 
        tags, 
        status, 
        division,
        company,
        city,
        notes
      } = req.body;

      // Normalize phone number
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '62' + normalizedPhone.substring(1);
      } else if (!normalizedPhone.startsWith('62')) {
        normalizedPhone = '62' + normalizedPhone;
      }

      // Check duplicate phone
      const existingCustomer = await Customer.findOne({ 
        phone: normalizedPhone,
        createdBy: userId
      });

      if (existingCustomer) {
        return res.status(400).json({
          success: false,
          message: 'Nomor telepon sudah terdaftar'
        });
      }

      const customer = new Customer({
        name,
        phone: normalizedPhone,
        email,
        address,
        tags: tags || [],
        status: status || 'active',
        division,
        company,
        city,
        notes,
        createdBy: userId
      });

      await customer.save();

      console.log(`✅ Customer created by user ${userId} with ${tags?.length || 0} tags`);

      // 🔔 NOTIFY: Customer added
      await notifyCustomerAdded(userId, customer);

      res.status(201).json({
        success: true,
        message: 'Customer berhasil ditambahkan',
        data: customer
      });

    } catch (error) {
      console.error('Error creating customer:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal menambahkan customer',
        error: error.message
      });
    }
  }
);

// UPDATE CUSTOMER
router.put('/:id',
  [
    body('name').notEmpty().withMessage('Nama customer wajib diisi'),
    body('phone').notEmpty().withMessage('Nomor telepon wajib diisi')
      .matches(/^(\+62|62|0)[0-9]{9,12}$/)
      .withMessage('Format nomor telepon tidak valid')
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

      const { role, id: userId } = req.user;
      const customer = await Customer.findById(req.params.id);

      if (!customer) {
        return res.status(404).json({
          success: false,
          message: 'Customer tidak ditemukan'
        });
      }

      if (role !== 'admin' && 
          customer.createdBy?.toString() !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Anda tidak memiliki akses untuk mengubah customer ini'
        });
      }

      const { 
        name, 
        phone, 
        email, 
        address, 
        tags, 
        status, 
        division,
        company,
        city,
        notes
      } = req.body;

      // Normalize phone number
      let normalizedPhone = phone.replace(/\D/g, '');
      if (normalizedPhone.startsWith('0')) {
        normalizedPhone = '62' + normalizedPhone.substring(1);
      } else if (!normalizedPhone.startsWith('62')) {
        normalizedPhone = '62' + normalizedPhone;
      }

      // Check duplicate phone (exclude current customer)
      if (normalizedPhone !== customer.phone) {
        const existingCustomer = await Customer.findOne({
          phone: normalizedPhone,
          createdBy: userId,
          _id: { $ne: req.params.id }
        });

        if (existingCustomer) {
          return res.status(400).json({
            success: false,
            message: 'Nomor telepon sudah terdaftar'
          });
        }
      }

      customer.name = name;
      customer.phone = normalizedPhone;
      customer.email = email;
      customer.address = address;
      customer.tags = tags || [];
      customer.status = status || 'active';
      customer.division = division;
      if (company !== undefined) customer.company = company;
      if (city !== undefined) customer.city = city;
      if (notes !== undefined) customer.notes = notes;

      await customer.save();

      console.log(`✅ Customer ${req.params.id} updated by user ${userId} with ${tags?.length || 0} tags`);

      // 🔔 NOTIFY: Customer updated
      await notifyCustomerUpdated(userId, customer);

      res.json({
        success: true,
        message: 'Customer berhasil diupdate',
        data: customer
      });

    } catch (error) {
      console.error('Error updating customer:', error);
      res.status(500).json({
        success: false,
        message: 'Gagal mengupdate customer',
        error: error.message
      });
    }
  }
);

// DELETE CUSTOMER
router.delete('/:id', async (req, res) => {
  try {
    const { role, id: userId } = req.user;
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer tidak ditemukan'
      });
    }

    if (role !== 'admin' && 
        customer.createdBy?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Anda tidak memiliki akses untuk menghapus customer ini'
      });
    }

    const customerName = customer.name;

    await customer.deleteOne();

    console.log(`✅ Customer ${req.params.id} deleted by user ${userId}`);

    // 🔔 NOTIFY: Customer deleted
    await notifyCustomerDeleted(userId, customerName);

    res.json({
      success: true,
      message: 'Customer berhasil dihapus'
    });

  } catch (error) {
    console.error('Error deleting customer:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus customer',
      error: error.message
    });
  }
});

// BULK IMPORT CUSTOMERS
router.post('/import', async (req, res) => {
  try {
    const { id: userId } = req.user;
    const { customers } = req.body;

    if (!Array.isArray(customers) || customers.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Data customers harus berupa array dan tidak boleh kosong'
      });
    }

    const results = {
      success: [],
      failed: []
    };

    for (const customerData of customers) {
      try {
        // Normalize phone
        let phone = customerData.phone.replace(/\D/g, '');
        if (phone.startsWith('0')) {
          phone = '62' + phone.substring(1);
        } else if (!phone.startsWith('62')) {
          phone = '62' + phone;
        }

        // Check duplicate
        const existing = await Customer.findOne({ 
          phone,
          createdBy: userId 
        });

        if (existing) {
          results.failed.push({
            data: customerData,
            reason: 'Nomor telepon sudah terdaftar'
          });
          continue;
        }

        // Create customer
        const customer = new Customer({
          name: customerData.name,
          phone,
          email: customerData.email,
          address: customerData.address,
          tags: customerData.tags || [],
          status: customerData.status || 'active',
          division: customerData.division,
          company: customerData.company,
          city: customerData.city,
          notes: customerData.notes,
          createdBy: userId
        });

        await customer.save();
        results.success.push(customer);

      } catch (error) {
        results.failed.push({
          data: customerData,
          reason: error.message
        });
      }
    }

    console.log(
      `✅ Bulk import: ${results.success.length} success, ${results.failed.length} failed`
    );

    // 🔔 NOTIFY: Customer imported
    await notifyCustomerImported(userId, results);

    res.json({
      success: true,
      message: `Berhasil import ${results.success.length} customer`,
      data: results
    });

  } catch (error) {
    console.error('Error importing customers:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal import customers',
      error: error.message
    });
  }
});

module.exports = router;