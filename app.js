const input = document.getElementById("queryInput");
const button = document.getElementById("showButton");
const status = document.getElementById("statusText");
const results = document.getElementById("results");
const emptyText = document.getElementById("emptyText");
const tabs = document.querySelectorAll(".tab");

let activeMode = "generate";

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

function showToast(msg) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = msg;
  document.body.appendChild(toast);

  setTimeout(() => toast.classList.add("toast-visible"), 10);
  setTimeout(() => {
    toast.classList.remove("toast-visible");
    setTimeout(() => toast.remove(), 300);
  }, 1800);
}

function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    btn.textContent = "✓";
    showToast("Kopyalandı");
    setTimeout(() => { btn.textContent = "⎘"; }, 1500);
  });
}

function renderCard(item, isQuote) {
  const card = document.createElement("div");
  card.className = "result-card";

  let copyContent = item.text;
  if (isQuote) {
    if (item.author) copyContent += `\n— ${item.author}`;
    if (item.work) copyContent += `, ${item.work}`;
  }

  const copyBtn = document.createElement("button");
  copyBtn.className = "copy-button";
  copyBtn.textContent = "⎘";
  copyBtn.title = "Kopyala";
  copyBtn.addEventListener("click", () => copyText(copyContent, copyBtn));

  const text = document.createElement("p");
  text.className = "result-text";
  text.textContent = item.text;

  card.appendChild(copyBtn);
  card.appendChild(text);

  if (isQuote && item.author) {
    const source = document.createElement("p");
    source.className = "result-source";
    source.textContent = item.work
      ? `— ${item.author} · ${item.work}`
      : `— ${item.author}`;
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
