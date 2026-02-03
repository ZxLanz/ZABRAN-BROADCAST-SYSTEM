const fs = require('fs');
const path = require('path');

// Configuration
const MEDIA_DIR = path.join(__dirname, '../public/media');
const MAX_AGE_DAYS = 7; // Delete files older than 7 days

/**
 * Run Cleanup Job
 * Deletes files in public/media older than MAX_AGE_DAYS
 */
const runCleanup = async () => {
    console.log(`\n🧹 [CLEANUP] Starting daily media cleanup...`);
    console.log(`   Target: ${MEDIA_DIR}`);
    console.log(`   Max Age: ${MAX_AGE_DAYS} days`);

    try {
        if (!fs.existsSync(MEDIA_DIR)) {
            console.log(`   ⚠️ Media directory does not exist. Skipping.`);
            return;
        }

        const files = fs.readdirSync(MEDIA_DIR);
        const now = Date.now();
        const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

        let deletedCount = 0;
        let keptCount = 0;
        let errorCount = 0;

        for (const file of files) {
            // Skip subdirectories (like 'uploads')
            const filePath = path.join(MEDIA_DIR, file);

            try {
                const stats = fs.statSync(filePath);

                if (stats.isDirectory()) {
                    continue; // Skip directories
                }

                const fileAgeMs = now - stats.mtimeMs;

                if (fileAgeMs > maxAgeMs) {
                    fs.unlinkSync(filePath);
                    // console.log(`   🗑️ Deleted old file: ${file}`);
                    deletedCount++;
                } else {
                    keptCount++;
                }
            } catch (err) {
                console.error(`   ❌ Error processing file ${file}:`, err.message);
                errorCount++;
            }
        }

        console.log(`✅ [CLEANUP] Completed.`);
        console.log(`   - Deleted: ${deletedCount}`);
        console.log(`   - Kept: ${keptCount}`);
        console.log(`   - Errors: ${errorCount}`);

    } catch (error) {
        console.error(`❌ [CLEANUP] Fatal error:`, error.message);
    }
};

module.exports = { runCleanup };
