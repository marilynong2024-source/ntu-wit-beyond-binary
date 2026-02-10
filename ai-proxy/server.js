import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/parse", async (req, res) => {
    try {
        const { text, systemPrompt } = req.body;

        if (!text) return res.status(400).json({ error: "Missing text" });

        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
            process.env.GEMINI_API_KEY;

        const prompt = systemPrompt
            ? `${systemPrompt}\nUser: ${text}`
            : `Return ONLY valid JSON for a browser command.\nUser: ${text}`;

        const geminiResp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ role: "user", parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2
                }
            })
        });

        const data = await geminiResp.json();
        const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        const cleaned = raw.replace(/```json/g, "").replace(/```/g, "").trim();

        let command;
        try {
            command = JSON.parse(cleaned);
        } catch {
            command = { action: "UNKNOWN" };
        }

        return res.json({ command, raw: cleaned });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
});

app.post("/vision", async (req, res) => {
    try {
        const { imageData } = req.body;
        if (!imageData) return res.status(400).json({ error: "Missing imageData" });

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) return res.status(500).json({ error: "GEMINI_API_KEY not set in .env" });

        let base64Data = imageData;
        let mimeType = "image/png";
        if (typeof imageData === "string" && imageData.startsWith("data:")) {
            const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
                mimeType = match[1];
                base64Data = match[2];
            } else {
                base64Data = imageData.replace(/^data:image\/\w+;base64,/, "");
            }
        }

        const url =
            "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
            apiKey;

        const visionPrompt = `Analyze this image in detail. Provide:
1. A clear description of what you see
2. Any text visible in the image (OCR)
3. Key objects or elements
4. Context or meaning if relevant
5. Any accessibility-relevant information

Be concise but thorough.`;

        const geminiResp = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: visionPrompt },
                            {
                                inlineData: {
                                    mimeType: mimeType || "image/png",
                                    data: base64Data
                                }
                            }
                        ]
                    }
                ],
                generationConfig: { temperature: 0.3, maxOutputTokens: 1024 }
            })
        });

        const data = await geminiResp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
        if (!text && data?.error) {
            return res.status(400).json({ error: data.error.message || "Gemini API error" });
        }
        return res.json({ analysis: text || "No description generated." });
    } catch (err) {
        return res.status(500).json({ error: "Server error" });
    }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log("AI proxy on http://localhost:" + port);
});
