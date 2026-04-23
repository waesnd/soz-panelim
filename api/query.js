const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tavily ile tek bir alıntıyı doğrula
async function verifyWithTavily(text, author) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return true; // Tavily yoksa geç, göster

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: `"${author}" "${text.slice(0, 60)}"`,
        search_depth: "basic",
        max_results: 3,
        include_answer: false
      })
    });

    if (!res.ok) return true; // hata varsa geç, göster
    const data = await res.json();
    const results = data?.results || [];

    if (results.length === 0) return false;

    // Sonuçlarda yazar adı geçiyor mu?
    const authorLower = author.toLowerCase();
    const combined = results.map(r => (r.title + " " + r.content).toLowerCase()).join(" ");
    return combined.includes(authorLower.split(" ")[0]); // soyadı yeterli
  } catch {
    return true; // hata varsa geç, göster
  }
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { query, mode } = req.body || {};
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "Sorgu boş olamaz" });
  }

  const intent = mode === "quote" ? "quote" : "generate";

  try {
    let systemPrompt, userPrompt;

    if (intent === "quote") {
      systemPrompt = `Sen kapsamlı bir edebiyat ve felsefe arşivisin. Görevin verilen konu veya yazar için gerçek, bilinen alıntılar bulmaktır.

KURALLAR:
- Gerçekten söylenmiş veya yazılmış alıntılar ver
- Her alıntıda "author" alanı ZORUNLU — tam ad yaz
- Mümkünse "work" alanına eser adını yaz
- Alıntı Türkçe değilse Türkçe çevirisini "text" alanına yaz
- 10 alıntı bul

YALNIZCA şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{"results": [{"text": "Türkçe alıntı metni", "author": "Tam Yazar Adı", "work": "Eser Adı veya boş string"}]}`;

      userPrompt = `"${query}" için gerçek ve bilinen alıntılar bul.`;

    } else {
      systemPrompt = `Sen özgün, güçlü Türkçe sözler yazan bir yazarsın.

KURALLAR:
- Özgün ve derin sözler yaz, klişelerden kaçın
- Her söz kısa ve güçlü olsun (1-3 cümle)
- Sahte yazar atfı YAPMA, tire ile isim EKLEME
- Ucuz, yapay veya motivasyon posteri gibi görünmesin
- 10 farklı söz üret

YALNIZCA şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{"results": [{"text": "söz metni"}]}`;

      userPrompt = `Konu: "${query}"`;
    }

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: intent === "quote" ? 0.2 : 0.82,
      max_tokens: 2500
    });

    const raw = completion.choices[0]?.message?.content || "";

    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({ results: [], intent });
    }

    let results = parsed.results || [];

    // Alıntı modunda Tavily ile doğrula
    if (intent === "quote" && results.length > 0) {
      const verified = await Promise.all(
        results.map(async (item) => {
          if (!item.author) return null;
          const ok = await verifyWithTavily(item.text, item.author);
          return ok ? item : null;
        })
      );
      results = verified.filter(Boolean);
    }

    return res.status(200).json({ results, intent });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ results: [], intent });
  }
};
