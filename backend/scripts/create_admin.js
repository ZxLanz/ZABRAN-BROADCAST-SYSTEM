const path = require('path');
const fs = require('fs');

// Try multiple paths for .env
const possiblePaths = [
    path.join(__dirname, '..', '.env'), // backend/.env (if script is in backend/scripts)
    path.join(__dirname, '.env'),       // backend/scripts/.env
    path.join(process.cwd(), '.env'),   // .env in current running directory
    path.join(process.cwd(), 'backend', '.env') // backend/.env from root
];

let envPath = null;
for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
        envPath = p;
        break;
    }
}

if (envPath) {
    const result = require('dotenv').config({ path: envPath });
    if (result.error) {
        console.error('❌ Error parsing .env file:', result.error);
    } else {
        console.log(`✅ Loaded .env from: ${envPath}`);
        console.log('🔍 Loaded Keys:', Object.keys(result.parsed || {}));
    }
} else {
    console.error('❌ Could not find .env file in any of these paths:', possiblePaths);
}

// Fallback check for common Mongo variable names
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.DB_URI || process.env.DATABASE_URL;

if (!mongoUri) {
    console.error('❌ MONGO_URI is undefined! Check your .env file keys above.');
    process.exit(1);
} else {
    process.env.MONGO_URI = mongoUri; // Normalize to MONGO_URI
}
const mongoose = require('mongoose');
const User = require('../models/User');
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ Connected to MongoDB');
    } catch (err) {
        console.error('❌ MongoDB Connection Error:', err.message);
        process.exit(1);
    }
};

const createOrUpdateAdmin = async () => {
    await connectDB();

    const args = process.argv.slice(2);
    let username, email, password;

    if (args.length === 3) {
        [username, email, password] = args;
    } else {
        console.log('\n🔐 --- ADMIN USER MANAGER ---');
        console.log('Leave empty to keep current value (for updates)\n');

        username = await askQuestion('Enter Username (default: admin): ') || 'admin';
        email = await askQuestion('Enter Email (default: admin@gmail.com): ') || 'admin@gmail.com';
        password = await askQuestion('Enter New Password: ');

        if (!password) {
            console.error('❌ Password is required!');
            process.exit(1);
        }
    }

    try {
        let user = await User.findOne({ $or: [{ email }, { username }] });

        if (user) {
            console.log(`\n⚠️ User found: ${user.username} (${user.email})`);
            user.password = password;
            user.role = 'admin'; // Ensure admin
            await user.save();
            console.log('✅ Password updated successfully!');
        } else {
            console.log(`\n🆕 Creating new admin user...`);
            user = new User({
                name: username,
                username,
                email,
                password,
                role: 'admin'
            });
            await user.save();
            console.log('✅ Admin created successfully!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.connection.close();
        rl.close();
        process.exit();
    }
};

createOrUpdateAdmin();
