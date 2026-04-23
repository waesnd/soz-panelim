const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Tavily ile konu hakkında web bağlamı topla — 1 kredi
async function fetchContext(query) {
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
        query: `${query} alıntı söz yazar`,
        search_depth: "basic",
        max_results: 5,
        include_answer: false
      })
    });

    if (!res.ok) return null;
    const data = await res.json();
    return (data?.results || [])
      .map(r => `${r.title}: ${r.content}`)
      .join("\n")
      .slice(0, 2500);
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
      // 1 Tavily kredisi ile bağlam topla
      const context = await fetchContext(query);

      systemPrompt = `Sen kapsamlı bir edebiyat ve felsefe arşivisin. Sana web'den toplanan bağlam verilecek. Bu bağlamı kullanarak gerçek, doğrulanmış alıntılar bul.

ZORUNLU KURALLAR:
- Öncelikle verilen web bağlamındaki alıntıları kullan
- Bağlamda yeterli alıntı yoksa kendi bilginle tamamla — ama yalnızca kesin bildiğin alıntıları
- Uydurma veya tahmin etme — KESİNLİKLE YASAK
- Her alıntıda "author" alanı ZORUNLU — tam ad yaz
- Mümkünse "work" alanına eser adını yaz
- Alıntı Türkçe değilse Türkçe çevirisini "text" alanına yaz
- 10 alıntı ver; bulamazsan bulduğun kadarını ver

YALNIZCA şu JSON formatında yanıt ver, başka hiçbir şey yazma:
{"results": [{"text": "Türkçe alıntı metni", "author": "Tam Yazar Adı", "work": "Eser Adı veya boş string"}]}

Bulunamazsa: {"results": []}`;

      userPrompt = context
        ? `"${query}" için gerçek alıntılar bul.\n\nWeb bağlamı:\n${context}`
        : `"${query}" için gerçek ve kesin bilinen alıntılar bul.`;

    } else {
      systemPrompt = `Sen özgün, güçlü Türkçe sözler yazan bir yazarsın.

ZORUNLU KURALLAR:
- Özgün ve derin sözler yaz, klişelerden kesinlikle kaçın
- Her söz kısa ve güçlü olsun (1-3 cümle)
- Sahte yazar atfı YAPMA
- Motivasyon posteri, ucuz veya yapay görünmesin
- Birbirinden farklı 10 söz üret

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
      temperature: intent === "quote" ? 0.15 : 0.85,
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

    return res.status(200).json({
      results: parsed.results || [],
      intent
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ results: [], intent });
  }
};
