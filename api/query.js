const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function searchWithTavily(query) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        query: `${query} alıntı söz`,
        search_depth: "basic",
        max_results: 5,
        include_answer: false
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    const results = data?.results || [];
    return results.map(r => `${r.title}: ${r.content}`).join("\n").slice(0, 2500);
  } catch {
    return null;
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
      const searchContext = await searchWithTavily(query);

      systemPrompt = `Sen bir alıntı doğrulama uzmanısın. Görevin yalnızca gerçek ve doğrulanmış alıntılar sunmaktır.

KURALLAR:
- Yalnızca gerçekten söylenmiş, doğrulanabilir alıntılar ver
- Emin olmadığın hiçbir alıntıyı uydurma
- Her alıntıda yazar adı zorunlu; eser adı varsa ekle
- Şüpheli veya belirsiz alıntıyı gösterme
- Türkçe yaz; orijinal dilde söylenmişse Türkçe çevirisini ver
- Güvenilir alıntı bulamazsan boş array döndür

YALNIZCA şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{"results": [{"text": "alıntı metni", "source": "Yazar — Eser"}]}

Bulunamazsa: {"results": []}`;

      userPrompt = searchContext
        ? `"${query}" için gerçek alıntılar bul.\n\nWeb'den toplanan bağlam:\n${searchContext}`
        : `"${query}" için gerçek alıntılar bul. Emin olmadığın hiçbir şey uydurma.`;

    } else {
      systemPrompt = `Sen özgün, güçlü Türkçe sözler yazan bir yazarsın.

KURALLAR:
- Özgün ve derin sözler yaz, klişelerden kaçın
- Her söz kısa ve güçlü olsun (1-3 cümle)
- Sahte yazar atfı yapma, tire ile isim ekleme
- Ucuz, yapay veya motivasyon posteri gibi görünmesin
- 5 farklı söz üret

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
      temperature: intent === "quote" ? 0.1 : 0.82,
      max_tokens: 1024
    });

    const raw = completion.choices[0]?.message?.content || "";

    let parsed;
    try {
      const clean = raw.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({ results: [], intent });
    }

    return res.status(200).json({
      results: parsed.results || [],
      intent
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ results: [], intent });
  }
};
