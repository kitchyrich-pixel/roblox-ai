const express = require("express");
const cors = require("cors");
const fs = require("fs");
const Fuse = require("fuse.js");

const app = express();
app.use(cors());
app.use(express.json());

const qa = JSON.parse(fs.readFileSync("./qa.json", "utf8"));

const fuse = new Fuse(qa, {
    keys: ["q"],
    threshold: 0.5,
    includeScore: true
});

app.post("/ask", (req, res) => {
    const question = req.body.question.toLowerCase().trim();
    const results = fuse.search(question);

    if (results.length === 0) {
        return res.json({ answer: "I'm not sure about that one, try asking differently!", confidence: 0 });
    }

    const best = results[0];
    const confidence = 1 - best.score;

    if (confidence < 0.3) {
        return res.json({ answer: "I'm not sure about that one, try asking differently!", confidence });
    }

    res.json({ answer: best.item.a, confidence });
});

app.listen(3000, () => console.log("AI server running on port 3000"))