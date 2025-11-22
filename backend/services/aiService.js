import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

export const generateMessageAI = async (topic, tone = "professional") => {
  try {
    const prompt = `
Buat pesan WhatsApp singkat.
Topik: ${topic}
Tone: ${tone}

Output hanya isi pesannya.
    `;

    const result = await model.generateContent(prompt);
    return result.response.text();

  } catch (err) {
    return `AI Error: ${err.message}`;
  }
};
