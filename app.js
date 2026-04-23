const input = document.getElementById("queryInput");
const button = document.getElementById("showButton");
const status = document.getElementById("statusText");
const results = document.getElementById("results");
const emptyText = document.getElementById("emptyText");

const API_URL = "/api/query";

function setStatus(msg) {
  status.textContent = msg;
}

function clearResults() {
  results.innerHTML = "";
  emptyText.textContent = "";
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "✓";
    setTimeout(() => { btn.textContent = "⎘"; }, 1500);
  });
}

function renderCard(item, isQuote) {
  const card = document.createElement("div");
  card.className = "result-card";

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-button";
  copyBtn.textContent = "⎘";
  copyBtn.title = "Kopyala";
  copyBtn.addEventListener("click", () => copyText(item.text, copyBtn));

  const text = document.createElement("p");
  text.className = "result-text";
  text.textContent = item.text;

  card.appendChild(copyBtn);
  card.appendChild(text);

  if (isQuote && item.source) {
    const source = document.createElement("p");
    source.className = "result-source";
    source.textContent = "— " + item.source;
    card.appendChild(source);
  }

  return card;
}

async function handleQuery() {
  const query = input.value.trim();
  if (!query) return;

  clearResults();
  button.disabled = true;
  setStatus("Düşünüyor...");

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query })
    });

    const data = await res.json();
    const { results: items = [], intent } = data;

    setStatus("");

    if (!items || items.length === 0) {
      emptyText.textContent = "Sonuç bulunamadı.";
      return;
    }

    const isQuote = intent === "quote";

    items.forEach(item => {
      const card = renderCard(item, isQuote);
      results.appendChild(card);
    });

  } catch {
    setStatus("");
    emptyText.textContent = "Sonuç bulunamadı.";
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", handleQuery);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") handleQuery();
});
