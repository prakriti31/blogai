require("dotenv").config();
const OpenAI = require("openai");
const axios  = require("axios");

/* --------------------------- OpenAI initialisation --------------------------- */
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------- helper ⇒ pull live hours from SerpAPI ------------------ */
async function fetchOpeningHours(name, location) {
    try {
        const { data } = await axios.get("https://serpapi.com/search.json", {
            params: {
                engine: "google_local",
                q:      `${name} ${location}`,
                api_key: process.env.SERPAPI_API_KEY,
            },
        });

        /* Preferred places → local_results ▸ hours                      */
        if (data.local_results?.length) {
            const place = data.local_results[0];

            // Case A: simple string (“Open ⋅ Closes 10 PM”)
            if (typeof place.hours === "string") return place.hours;

            // Case B: array of { day, hours } objects
            if (Array.isArray(place.hours) && place.hours.length) {
                return place.hours.map(h => `${h.day}: ${h.hours}`).join(" | ");
            }
        }

        /* Fallback → knowledge_graph ▸ hours                           */
        if (data.knowledge_graph?.hours) return data.knowledge_graph.hours;
    } catch (err) {
        console.warn("SerpAPI hours fetch failed for", name, "-", err.message);
    }
    return null;          // graceful degrade
}

/* ------------------------------ blog-reply AI ------------------------------- */
async function generateReply(prompt) {
    const { choices } = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: "You are a helpful assistant who generates a thoughtful reply to a blog post." },
            { role: "user",   content: prompt },
        ],
        temperature: 0.7,
    });
    return choices[0].message.content.trim();
}

/* -------- main recommender – now enriches restaurants with live hours -------- */
async function generateRecommendations(location, weather) {
    /* -- 1️⃣  ask OpenAI for the basic 3×3×3 lists (keep prompt lean & fast) -- */
    const userPrompt = `
You are a helpful assistant. Given the user's location and current weather suggest the following,
return JSON containing ONLY events dated on 25 April 2025 or AFTER 25 APRIL 2025:
- "restaurants":    3 places (name, cuisineType, closing and opening time, address, best dishes/best sellers)
- "musicalEvents":  3 upcoming events (eventName, venue, date (YYYY-MM-DD), startTime of event, temperature on the event's day, weatherForecast on the event's day in on line). The events should only be from today or the next 2 weeks.
- "sportsEvents":   3 events (eventName, venue, date, startTime of event, temperature on the event's day, weatherForecast on the event's day in one line).  The events should only be from today or the next 2 weeks.

User location: ${location}
Weather: ${weather.temperature}°C (code ${weather.weathercode})
`;

    const { choices } = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            { role: "system", content: "Output strictly valid JSON – no markdown fences." },
            { role: "user",   content: userPrompt },
        ],
        temperature: 0.7,
    });

    /* -- 2️⃣  parse the JSON we asked for                                 -- */
    const rec = JSON.parse(choices[0].message.content.trim());

    /* -- 3️⃣  enrich each restaurant with real-time opening hours         -- */
    if (Array.isArray(rec.restaurants)) {
        await Promise.all(
            rec.restaurants.map(async r => {
                const hours = await fetchOpeningHours(r.name, location);
                if (hours) r.hoursText = hours;               // new field used client-side
            })
        );
    }

    return rec;
}

module.exports = { generateReply, generateRecommendations };
