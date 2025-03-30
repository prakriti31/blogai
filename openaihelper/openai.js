require("dotenv").config();
const OpenAI = require("openai");

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env file
});

/**
 * generateReply:
 * Uses the OpenAI API to generate a reply based on the provided prompt.
 *
 * @param {string} prompt - The text to base the reply on.
 * @returns {Promise<string>} - The generated reply text.
 */
async function generateReply(prompt) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // or any other model
            messages: [
                { role: "system", content: "You are a helpful assistant who generates a thoughtful reply to a blog post." },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (err) {
        console.error("OpenAI API error:", err);
        throw err;
    }
}

module.exports = { generateReply };
