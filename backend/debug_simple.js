const mongoose = require('mongoose');
require('dotenv').config();
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

mongoose.connect(MONGO_URI).then(async () => {
    const Customer = require('./models/Customer');
    const c = await Customer.findOne({ name: 'Putri Nazwa' });
    console.log('RESULT:', c ? JSON.stringify(c) : 'NOT_FOUND');
    mongoose.disconnect();
}).catch(console.error);
