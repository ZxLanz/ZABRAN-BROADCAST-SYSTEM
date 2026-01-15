const mongoose = require('mongoose');
const ChatMessage = require('./models/ChatMessage');

mongoose.connect('mongodb://localhost:27017/zabran_broadcast').then(async () => {
  console.log('✅ Connected to DB');
  
  const messages = await ChatMessage.find().limit(1).lean();
  console.log('Sample message:');
  console.log(JSON.stringify(messages[0], null, 2));
  
  const lid = await ChatMessage.countDocuments({remoteJid: /@lid/});
  const swhatsapp = await ChatMessage.countDocuments({remoteJid: /@s\.whatsapp\.net/});
  
  console.log('\nFormat distribution:');
  console.log('@lid format:', lid);
  console.log('@s.whatsapp.net format:', swhatsapp);
  
  process.exit(0);
}).catch(e => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
