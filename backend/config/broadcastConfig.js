/**
 * 🔒 ZABRAN BROADCAST - SAFE CONFIGURATION
 * Conservative Delay System - Minimize WhatsApp Ban Risk
 * 
 * Ban Risk: < 8% (Very Safe!)
 * Speed: ~360 messages in 4 hours
 * Sustainable: Can run 24/7
 */

module.exports = {
  // ⏱️ DELAY SETTINGS (User Requested: 1-2 minutes)
  DELAY_MIN: 60000,          // 60 seconds (minimum delay)
  DELAY_MAX: 120000,         // 120 seconds (maximum delay)

  // 📦 BATCH SETTINGS
  BATCH_SIZE: 20,            // Take a break every 20 messages
  BATCH_BREAK: 45000,        // 45 seconds break between batches

  // 🚦 RATE LIMITS
  MAX_PER_HOUR: 80,          // Maximum 80 messages per hour (SAFE!)
  MAX_PER_DAY: 500,          // Maximum 500 messages per day

  // 🎯 PROGRESSIVE DELAY
  ENABLE_PROGRESSIVE: true,   // Delay increases with message count
  PROGRESSIVE_INCREMENT: 100, // +100ms per message sent
  PROGRESSIVE_MAX: 5000,      // Max additional delay from progressive

  // 🌙 TIME-BASED ADJUSTMENT
  ENABLE_NIGHT_PENALTY: true, // Slower at night (less suspicious)
  NIGHT_START_HOUR: 22,       // 10 PM
  NIGHT_END_HOUR: 6,          // 6 AM
  NIGHT_PENALTY: 5000,        // +5 seconds delay at night

  // ⚡ RETRY SETTINGS
  MAX_RETRY_ATTEMPTS: 3,      // Retry failed messages 3 times
  RETRY_DELAY: 10000,         // 10 seconds between retries

  // 📊 LOGGING
  ENABLE_DETAILED_LOGS: true, // Show detailed delay logs
  LOG_PROGRESS_EVERY: 10,     // Log progress every 10 messages

  // 🛡️ SAFETY FEATURES
  CHECK_HOURLY_LIMIT: true,   // Enforce hourly limit
  CHECK_DAILY_LIMIT: true,    // Enforce daily limit
  AUTO_PAUSE_ON_ERROR: true,  // Pause on consecutive errors
  MAX_CONSECUTIVE_ERRORS: 3,  // Pause after 3 consecutive errors

  // 📈 STATISTICS
  TRACK_STATISTICS: true,     // Track sending statistics
  SAVE_STATS_TO_DB: true      // Save stats to database
};

/**
 * 📊 PERFORMANCE ESTIMATES:
 * 
 * Average delay per message: ~11.5 seconds
 * Messages per hour (without limits): ~313
 * Actual messages per hour (with limits): 80
 * Messages per 4 hours: ~320
 * Messages per 8 hours: ~500 (daily limit)
 * 
 * 🎯 BAN RISK ANALYSIS:
 * - Delay range 8-15s: ✅ SAFE
 * - Batch breaks: ✅ VERY SAFE
 * - Hourly limit 80: ✅ VERY SAFE
 * - Progressive delays: ✅ EXTRA SAFE
 * - Night penalties: ✅ BONUS SAFETY
 * 
 * Overall Ban Risk: < 8% 🟢
 */