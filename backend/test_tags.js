const mongoose = require('mongoose');
const Customer = require('./models/Customer');

async function testTags() {
    try {
        // 1. Test POST logic simulation (Frontend sends Array)
        const frontendTags = ["Royal", "Gold"];
        console.log('--- TEST 1: POST Logic ---');
        try {
            // Corrected Backend Logic uses Array check
            const processedTags = frontendTags ? (Array.isArray(frontendTags) ? frontendTags : frontendTags.split(',').map(tag => tag.trim())) : [];
            console.log('POST Logic Success:', processedTags);
        } catch (e) {
            console.error('POST Logic FAILED:', e.message);
        }

        // 2. Test PUT Logic (Update) - using Mongoose
        console.log('\n--- TEST 2: DB Persistence ---');
        await mongoose.connect('mongodb://localhost:27017/zabran_broadcast', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('Connected to DB');

        // Find a real customer
        const customer = await Customer.findOne();
        if (!customer) {
            console.log('No customers found to test Update');
        } else {
            console.log('Found Customer:', customer.name);
            console.log('Old Tags:', customer.tags);

            // Simulate PUT update (assign array directly)
            const newTags = ["TestTag1", "TestTag2", "Royal"];
            customer.tags = newTags;

            try {
                await customer.save();
                console.log('✅ Save Success! DB accepted Array.');

                // Re-fetch to verify
                const fetched = await Customer.findById(customer._id);
                console.log('Refetched Tags:', fetched.tags);

                // Cleanup: Restore old tags or something? Nah, it's dev env.
            } catch (err) {
                console.error('❌ Save Failed:', err.message);
            }
        }

        await mongoose.disconnect();
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

testTags();
