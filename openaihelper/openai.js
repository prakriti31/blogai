require("dotenv").config();
const OpenAI = require("openai");

// Initialize OpenAI API
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your .env
});

/**
 * generateReply:
 * Uses the OpenAI API to generate a reply based on the provided prompt.
 */
async function generateReply(prompt) {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo", // or any other model
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant who generates a thoughtful reply to a blog post.",
                },
                { role: "user", content: prompt },
            ],
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (err) {
        console.error("OpenAI API error:", err);
        throw err;
    }
}

/**
 * generateRecommendations:
 * Given a user location and weather object, asks OpenAI for
 * 3 restaurants, 3 musical events, and 3 sports events nearby.
 * Returns a parsed JSON object if possible, or the raw string.
 *
 * @param {string} location
 * @param {{temperature:number, weathercode:number}} weather
 */
async function generateRecommendations(location, weather) {
    try {
        const userPrompt = `
You are a helpful assistant that, given a user's location and the current weather conditions, recommends:
1. Three restaurants (with name, address/location, opening time, closing time, and cuisine type).
2. Three musical events or concerts (with event name, venue, date, and start time).
3. Three sports events (with event name, venue, date, and start time).

User location: ${location}
Current weather: ${weather.temperature}°C (code ${weather.weathercode})

Please format your response as valid JSON with three keys:
  - "restaurants": [ { … }, { … }, { … } ]
  - "musicalEvents": [ { … }, { … }, { … } ]
  - "sportsEvents": [ { … }, { … }, { … } ]
`;

        const response = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a helpful assistant that recommends restaurants, concerts, and sports events in JSON format.",
                },
                { role: "user", content: userPrompt },
            ],
            temperature: 0.7,
        });

        const text = response.choices[0].message.content.trim();
        // Try to parse JSON; if that fails, return raw text
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    } catch (err) {
        console.error("OpenAI Recommendations error:", err);
        throw err;
    }
}

module.exports = {
    generateReply,
    generateRecommendations,
};
