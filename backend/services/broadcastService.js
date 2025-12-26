// backend/services/broadcastService.js
const Broadcast = require("../models/Broadcast");
// Customer tidak lagi diperlukan, karena data sudah ada di broadcast.recipients
const { kirimPesanWA } = require("./whatsappService");

// ===========================================
// HELPER: Variable Replacement (Personalisasi Pesan)
// ===========================================

/**
 * Mengganti placeholder {{variable}} dalam pesan dengan data recipient
 * @param {string} message - Pesan template dengan placeholder
 * @param {Object} recipient - Objek recipient yang berisi data (phone, name, customFields)
 * @returns {string} Pesan yang sudah dipersonalisasi
 */
function replaceVariables(message, recipient) {
    let result = message;
    
    // Gabungkan customFields ke objek utama untuk memudahkan replacement
    const recipientObj = recipient.toObject ? recipient.toObject() : recipient;
    const allFields = {
        ...recipientObj,
        ...(recipientObj.customFields || {})
    };

    // Ganti semua placeholder
    Object.keys(allFields).forEach(key => {
        // Pastikan nilai valid (bukan null/undefined, bukan object)
        if (allFields[key] !== null && allFields[key] !== undefined && typeof allFields[key] !== 'object') {
            // Escape special chars untuk RegExp, lalu ganti secara global
            const placeholder = new RegExp(`\\{\\{${key}\\}\\}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
            result = result.replace(placeholder, allFields[key]);
        }
    });

    // Hapus placeholder yang tersisa (tidak terpecahkan)
    result = result.replace(/\{\{.*?\}\}/g, '');

    return result;
}


// ===========================================
// FUNGSI UTAMA: SEND BROADCAST NOW
// ===========================================

const sendBroadcastNow = async (broadcast) => {
  try {
    // ✅ PERBAIKAN: Gunakan recipients dari objek broadcast
    const { _id, message, recipients } = broadcast;

    if (!recipients || recipients.length === 0) {
        // Update status ke completed jika tidak ada penerima
        await Broadcast.findByIdAndUpdate(_id, { status: "completed", startedAt: new Date(), completedAt: new Date(), totalRecipients: 0 });
        console.log("BROADCAST SELESAI: Tidak ada penerima.");
        return;
    }

    console.log(`MEMULAI BROADCAST: ${recipients.length} nomor`);

    // Tambahkan status 'on-process' dan update waktu mulai
    await Broadcast.findByIdAndUpdate(_id, { 
        status: "on-process", 
        startedAt: new Date(),
        totalRecipients: recipients.length
    });
    
    // Ambil hitungan sukses/gagal saat ini (untuk melanjutkan broadcast yang dipause)
    let successCount = broadcast.successCount || 0;
    let failedCount = broadcast.failedCount || 0;

    // ✅ PERBAIKAN: Loop melalui recipients yang ada di dokumen Broadcast
    for (let i = 0; i < recipients.length; i++) {
        let recipient = recipients[i];

        // Skip recipient yang sudah 'sent', 'delivered', atau 'read'
        if (recipient.status === 'sent' || recipient.status === 'delivered' || recipient.status === 'read') {
            continue; 
        }

        const recipientPhone = recipient.phone;

        // 1. Personalisasi Pesan
        const personalizedMessage = replaceVariables(message, recipient);
        
        console.log(`Mengirim ke ${recipientPhone} (${i + 1}/${recipients.length}) - Status saat ini: ${recipient.status}`);

        // 2. Panggil kirimPesanWA
        const result = await kirimPesanWA(recipientPhone, personalizedMessage, _id);

        let newStatus = 'failed';
        let errorMsg = null;
        
        if (result.success) {
            newStatus = 'sent';
            successCount++;
            console.log(`Pesan sukses dikirim ke ${recipientPhone}`);
        } else {
            newStatus = 'failed';
            // Pastikan failedCount hanya bertambah jika sebelumnya bukan 'failed'
            if (recipient.status !== 'failed') {
                failedCount++;
            }
            errorMsg = result.error;
            console.error(`Pesan GAGAL dikirim ke ${recipientPhone}: ${errorMsg}`);
        }
        
        // 3. Update status spesifik recipient di dokumen Broadcast (menggunakan Array Filters)
        await Broadcast.updateOne(
            { "_id": _id, "recipients.phone": recipientPhone },
            { 
                "$set": { 
                    "recipients.$.status": newStatus,
                    "recipients.$.sentAt": new Date(),
                    "recipients.$.error": errorMsg,
                    "successCount": successCount,
                    "failedCount": failedCount,
                } 
            }
        );
        
        // 4. Delay anti-ban (20–30 detik)
        const delayMs = 20000 + Math.floor(Math.random() * 10000);
        console.log(`Delay ${delayMs / 1000} detik...`);
        
        // Cek apakah broadcast masih 'on-process' sebelum delay
        const currentBroadcast = await Broadcast.findById(_id).select('status');
        if (currentBroadcast.status !== 'on-process') {
            console.log("Broadcast dihentikan secara manual atau dijadwal ulang.");
            break; // Keluar dari loop jika status berubah
        }

        await new Promise((res) => setTimeout(res, delayMs));
    }

    // Update status ke 'completed' jika loop selesai tanpa dihentikan/dipause
    const finalBroadcast = await Broadcast.findById(_id);
    if (finalBroadcast.status === 'on-process') {
        await Broadcast.findByIdAndUpdate(_id, { 
            status: "completed",
            completedAt: new Date()
        });
        console.log(`BROADCAST SELESAI: ${successCount} sukses, ${failedCount} gagal.`);
    } else {
        console.log(`BROADCAST STATUS: ${finalBroadcast.status}. Tidak diupdate menjadi 'completed'.`);
    }

  } catch (err) {
    console.error(`❌ KESALAHAN KRITIS DI BROADCAST ${broadcast._id}:`, err);
    // Update status ke 'failed' jika ada error kritikal
    await Broadcast.findByIdAndUpdate(broadcast._id, { 
        status: "failed",
        completedAt: new Date(),
    });
  }
};

module.exports = { 
    sendBroadcastNow, 
};