const axios = require('axios');

const apiKey = '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';

const models = [
    'arcee-ai/trinity-large-preview:free',
    'tngtech/deepseek-r1t2-chimera:free',
    'z-ai/glm-4.5-air:free',
    'tngtech/deepseek-r1t-chimera:free',
    'stepfun/step-3.5-flash:free',
    'nvidia/nemotron-3-nano-30b-a3b:free',
    'deepseek/deepseek-r1-0528:free',
    'tngtech/tng-r1t-chimera:free',
    'openai/gpt-oss-120b:free',
    'meta-llama/llama-3.3-70b-instruct:free',
    'qwen/qwen3-coder:free',
    'arcee-ai/trinity-mini:free',
    'google/gemma-3-27b-it:free',
    'qwen/qwen3-next-80b-a3b-instruct:free',
    'openai/gpt-oss-20b:free',
    'nvidia/nemotron-nano-12b-v2-vl:free',
    'nvidia/nemotron-nano-9b-v2:free',
    'allenai/molmo-2-8b:free',
    'cognitivecomputations/dolphin-mistral-24b-venice-edition:free',
    'liquid/lfm-2.5-1.2b-instruct:free',
    'liquid/lfm-2.5-1.2b-thinking:free',
    'mistralai/mistral-small-3.1-24b-instruct:free',
    'nousresearch/hermes-3-llama-3.1-405b:free',
    'qwen/qwen3-4b:free',
    'google/gemma-3n-e2b-it:free',
    'google/gemma-3-4b-it:free',
    'meta-llama/llama-3.2-3b-instruct:free',
    'google/gemma-3-12b-it:free',
    'google/gemma-3n-e4b-it:free'
];

const prompt = "AI adalah...";

async function testModel(modelName) {
    const start = Date.now();
    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: modelName,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:5000',
                    'X-Title': 'Zabran Broadcast Benchmark'
                },
                timeout: 15000
            }
        );
        const duration = Date.now() - start;
        const msg = response.data.choices[0].message.content || "";
        const chars = msg.length;
        const speed = chars > 0 ? (chars / (duration / 1000)).toFixed(1) : 0;

        let limitInfo = "Unknown";
        if (response.status === 200) limitInfo = "OK";

        // Display Result Immediately
        process.stdout.write(" ".repeat(100) + "\r"); // Clear loading line

        console.log("=".repeat(100));
        console.log(`🤖 MODEL: ${modelName}`);
        console.log(`⏱️ TIME: ${duration}ms | ⚡ SPEED: ${speed} chars/s | 📊 STATUS: ${limitInfo}`);
        console.log("-".repeat(30));
        console.log(`📝 RESPONSE:\n${msg.trim().substring(0, 300)}${msg.length > 300 ? '...' : ''}`);
        console.log("=".repeat(100) + "\n");

        return {
            model: modelName,
            success: true,
            time: duration,
            speed: `${speed} chars/s`,
            status: limitInfo,
            output: msg
        };

    } catch (error) {
        process.stdout.write(" ".repeat(100) + "\r");

        let errMsg = error.message;
        if (error.response) {
            errMsg = `${error.response.status} ${error.response.statusText}`;
        }

        console.log("=".repeat(100));
        console.log(`🤖 MODEL: ${modelName}`);
        console.log(`❌ FAILED | Time: ${Date.now() - start}ms | Error: ${errMsg}`);
        console.log("=".repeat(100) + "\n");

        return {
            model: modelName,
            success: false,
            time: Date.now() - start,
            speed: "0",
            status: `FAIL: ${errMsg}`
        };
    }
}

async function runBenchmark() {
    console.log(`\n🚀 Starting Benchmark for ${models.length} Models...\n`);

    const results = [];

    for (const model of models) {
        process.stdout.write(`Testing ${model.substring(0, 40)}... \r`);
        const res = await testModel(model);
        results.push(res);
    }

    console.log("\n✅ BENCHMARK COMPLETED.\n");

    // RECOMMENDATION ENGINE
    const passed = results.filter(r => r.success && r.output && r.output.length > 5).sort((a, b) => a.time - b.time);
    const valid = passed.filter(r => !r.output.includes("Too Many Requests"));

    if (valid.length > 0) {
        console.log("🏆 REKOMENDASI TERBAIK (Berdasarkan Kecepatan & Kestabilan):");
        console.log("1. " + valid[0].model + ` (${valid[0].time}ms) - JUARA 1 🥇`);

        if (valid[1]) console.log("2. " + valid[1].model + ` (${valid[1].time}ms) - RUNNER UP 🥈`);
        if (valid[2]) console.log("3. " + valid[2].model + ` (${valid[2].time}ms) - ALTERNATIF 🥉`);

        console.log("\n💡 SARAN: Gunakan model Juara 1 untuk respon tercepat di Live Chat.");
    } else {
        console.log("\n⚠️ Tidak ada model yang memberikan respon valid.");
    }
}

runBenchmark();
