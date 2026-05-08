const express = require("express");
const cors = require("cors");
const Fuse = require("fuse.js");
const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = process.env.GROQ_API_KEY;

const SYSTEM_PROMPT = `You are the GlobaL AI assistant, a helpful in-game guide for a Roblox clicking game called GlobaL.
In GlobaL, players click a BUTTON connected to wires that lead to a shared battery. You click the button, not the battery itself.
Key facts:
- There are 52 ranks from Nobody all the way up to Global, with a secret rank rumored at 800K clicks
- Battery has 10 segments with thresholds: 75M, 120M, 192M, 307M, 491M, 786M, 1.26B, 2.01B, 3.22B, 5.15B
- When all 10 segments fill, a global reset happens and everyone gets rewards
- Battery slowly drains when nobody is clicking
- VIP gamepass gives +0.1x permanent click bonus
- Boosts are temporary multipliers bought in the shop
- Rank bonus multiplies your click power - higher rank = stronger clicks
- All bonuses stack: rank x VIP x boost
- Sprint by holding Left or Right CTRL
- Daily leaderboard resets every 24 hours, all-time never resets
- Auras are cosmetic effects, some unlocked by rank, others bought in shop
- Last Clicker Aura goes to whoever makes the final click that fills the battery
Rules:
- Keep answers short (2-3 sentences max)
- Only answer questions about GlobaL
- If asked something unrelated, say you only know about GlobaL
- Be friendly and casual like a game guide`;

// ── CACHE ─────────────────────────────────────────────────────────────────────
const cache = [];
const CACHE_MAX = 500;
const CACHE_THRESHOLD = 0.25; // lower = stricter match (Fuse score)

function normalizeQuestion(q) {
    return q.toLowerCase()
        .replace(/[^\w\s]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

function searchCache(question) {
    if (cache.length === 0) return null;
    const fuse = new Fuse(cache, {
        keys: ["q"],
        threshold: CACHE_THRESHOLD,
        includeScore: true,
    });
    const results = fuse.search(question);
    if (results.length > 0 && results[0].score <= CACHE_THRESHOLD) {
        return results[0].item.a;
    }
    return null;
}

function addToCache(q, a) {
    if (cache.length >= CACHE_MAX) {
        cache.shift(); // evict oldest
    }
    cache.push({ q, a });
}

// ── QUEUE ─────────────────────────────────────────────────────────────────────
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const requestQueue = [];

function processQueue() {
    if (requestQueue.length === 0) return;
    if (activeRequests >= MAX_CONCURRENT) return;
    const next = requestQueue.shift();
    next();
}

function enqueueRequest(fn) {
    return new Promise((resolve, reject) => {
        requestQueue.push(async () => {
            activeRequests++;
            try {
                const result = await fn();
                resolve(result);
            } catch (err) {
                reject(err);
            } finally {
                activeRequests--;
                processQueue();
            }
        });
        processQueue();
    });
}

// ── DEDUPLICATION ─────────────────────────────────────────────────────────────
const pendingRequests = {};

async function callGroq(question) {
    if (pendingRequests[question]) {
        // same question already in flight - wait for that one
        return pendingRequests[question];
    }
    const promise = enqueueRequest(async () => {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: question }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });
        const data = await response.json();
        return data.choices?.[0]?.message?.content || "I'm not sure about that one!";
    });
    pendingRequests[question] = promise;
    promise.finally(() => { delete pendingRequests[question]; });
    return promise;
}

// ── ROUTE ─────────────────────────────────────────────────────────────────────
app.post("/ask", async (req, res) => {
    const raw = req.body.question;
    if (!raw) return res.json({ answer: "Please ask a question!" });

    const question = normalizeQuestion(raw);

    // 1. Check cache first
    const cached = searchCache(question);
    if (cached) {
        console.log(`[CACHE HIT] "${question}"`);
        return res.json({ answer: cached, source: "cache" });
    }

    // 2. Call Groq (with queue + dedup)
    try {
        console.log(`[GROQ CALL] "${question}"`);
        const answer = await callGroq(question);
        addToCache(question, answer);
        res.json({ answer, source: "groq" });
    } catch (err) {
        console.error("Groq error:", err.message);
        res.json({ answer: "I'm not sure about that one!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI server running on port ${PORT}`));