const input = document.getElementById("queryInput");
const button = document.getElementById("showButton");
const status = document.getElementById("statusText");
const results = document.getElementById("results");
const emptyText = document.getElementById("emptyText");
const tabs = document.querySelectorAll(".tab");

let activeMode = "generate"; // varsayılan: üret

// Sekme değiştirme
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    activeMode = tab.dataset.tab;
    input.placeholder = activeMode === "generate"
      ? "Konu yaz... (aşk, yalnızlık, gece...)"
      : "Yazar veya konu yaz... (Kafka, Nazım Hikmet...)";
    clearResults();
    input.focus();
  });
});

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

  const fullText = isQuote && item.source
    ? `${item.text}\n— ${item.source}`
    : item.text;

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-button";
  copyBtn.textContent = "⎘";
  copyBtn.title = "Kopyala";
  copyBtn.addEventListener("click", () => copyText(fullText, copyBtn));

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
  setStatus(activeMode === "generate" ? "Üretiyor..." : "Alıntı aranıyor...");

  try {
    const res = await fetch("/api/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, mode: activeMode })
    });

    const data = await res.json();
    const items = data?.results || [];

    setStatus("");

    if (!items.length) {
      emptyText.textContent = activeMode === "quote"
        ? "Doğrulanmış alıntı bulunamadı."
        : "Sonuç bulunamadı.";
      return;
    }

    items.forEach(item => {
      results.appendChild(renderCard(item, activeMode === "quote"));
    });

  } catch {
    setStatus("");
    emptyText.textContent = "Sonuç bulunamadı.";
  } finally {
    button.disabled = false;
  }
}

button.addEventListener("click", handleQuery);
input.addEventListener("keydown", e => {
  if (e.key === "Enter") handleQuery();
});
