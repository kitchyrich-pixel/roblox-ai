const express = require("express");
const cors = require("cors");
const app = express();
app.use(cors());
app.use(express.json());

const GROQ_API_KEY = "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";

const SYSTEM_PROMPT = `You are the GlobaL AI assistant, a helpful in-game guide for a Roblox clicking game called GlobaL.

In GlobaL, players click a shared battery to charge it. Key facts:
- There are 52 ranks from Nobody all the way up to Global, with a secret rank at 800K clicks
- Battery has 10 segments with thresholds: 75M, 120M, 192M, 307M, 491M, 786M, 1.26B, 2.01B, 3.22B, 5.15B
- VIP gamepass gives +0.1x permanent click bonus
- Boosts are temporary multipliers bought in the shop
- Sprint by holding Left or Right CTRL
- Daily leaderboard resets every 24 hours
- No autoclickers or exploits allowed

Rules:
- Keep answers short (2-3 sentences max)
- Only answer questions about GlobaL
- If asked something unrelated, say you only know about GlobaL
- Be friendly and casual like a game guide`;

app.post("/ask", async (req, res) => {
    const question = req.body.question;
    if (!question) return res.json({ answer: "Please ask a question!" });

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${GROQ_API_KEY}`
            },
            body: JSON.stringify({
                model: "llama-3.3-70b-versatile",
                messages: [
                    { role: "system", content: SYSTEM_PROMPT },
                    { role: "user", content: question }
                ],
                max_tokens: 150,
                temperature: 0.7
            })
        });

        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content || "I'm not sure about that one!";
        res.json({ answer });
    } catch (err) {
        res.json({ answer: "I'm having trouble right now, try again in a sec!" });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`AI server running on port ${PORT}`));