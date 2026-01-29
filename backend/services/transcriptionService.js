const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

/**
 * Transcribe Audio
 * Supports: 
 * 1. OpenRouter (via Multimodal Gemini) - User Preference
 * 2. Groq (Whisper) - Backup/Fastest
 * 3. OpenAI (Whisper)
 */
const transcribeAudio = async (filePath) => {
    try {
        const openRouterKey = process.env.OPENROUTER_API_KEY;
        const groqKey = process.env.GROQ_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;

        if (!openRouterKey && !groqKey && !openaiKey) {
            console.error('❌ [STT] No API Key found (OPENROUTER, GROQ, or OPENAI)');
            return null;
        }

        // ============================================================
        // OPTION 1: OPENROUTER (User Request)
        // Uses Multimodal Model (Xiaomi MiMo-V2-Flash)
        // ============================================================
        if (openRouterKey) {
            console.log('🎤 [STT] Transcribing via OpenRouter (Xiaomi MiMo-V2-Flash)...');

            try {
                // 1. Convert File to Base64
                const fileData = fs.readFileSync(filePath);
                const base64Audio = fileData.toString('base64');

                // 2. Send to OpenRouter Chat Completion (Multimodal)
                const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
                    model: 'xiaomi/mimo-v2-flash', // User Requested Model
                    messages: [
                        {
                            role: 'user',
                            content: [
                                {
                                    type: 'text',
                                    text: 'Transcribe this audio. Output ONLY the spoken text. No intro, no outliers.'
                                },
                                {
                                    type: 'input_audio',
                                    input_audio: {
                                        data: base64Audio,
                                        format: 'ogg' // WhatsApp usually saves as OGG
                                    }
                                }
                            ]
                        }
                    ]
                }, {
                    headers: {
                        'Authorization': `Bearer ${openRouterKey}`,
                        'Content-Type': 'application/json',
                        'HTTP-Referer': 'https://zabran-broadcast.com',
                        'X-Title': 'Zabran Broadcast'
                    }
                });

                if (response.data?.choices?.[0]?.message?.content) {
                    const text = response.data.choices[0].message.content.trim();
                    console.log(`🗣️ [STT] Xiaomi Result: "${text}"`);
                    return text;
                }
            } catch (orError) {
                console.error('⚠️ [STT] OpenRouter failed:', orError.response?.data || orError.message);
                console.log('🔄 Falling back to other providers if available...');
            }
        }

        // ============================================================
        // OPTION 2: GROQ / OPENAI (Whisper)
        // Standard Transcriptions API
        // ============================================================
        if (groqKey || openaiKey) {
            const isGroq = !!groqKey;
            const url = isGroq
                ? 'https://api.groq.com/openai/v1/audio/transcriptions'
                : 'https://api.openai.com/v1/audio/transcriptions';

            const model = isGroq ? 'whisper-large-v3' : 'whisper-1';

            console.log(`🎤 [STT] Transcribing via ${isGroq ? 'Groq' : 'OpenAI'} (${model})...`);

            const form = new FormData();
            form.append('file', fs.createReadStream(filePath));
            form.append('model', model);
            form.append('language', 'id');
            form.append('response_format', 'json');

            const response = await axios.post(url, form, {
                headers: {
                    ...form.getHeaders(),
                    'Authorization': `Bearer ${isGroq ? groqKey : openaiKey}`
                },
                timeout: 30000
            });

            if (response.data && response.data.text) {
                console.log(`🗣️ [STT] Result: "${response.data.text}"`);
                return response.data.text;
            }
        }

        return null;

    } catch (error) {
        console.error('❌ [STT] All Transcription attempts failed:', error.message);
        return null;
    }
};

module.exports = {
    transcribeAudio
};
