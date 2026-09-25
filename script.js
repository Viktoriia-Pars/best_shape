/* ====== ЗАМЕНИТЬ НА СВОИ ЗНАЧЕНИЯ ====== */
const PRICE_CSV_URL   = "https://disk.yandex.ru/ПУТЬ_К_ПРАЙСУ.csv";     // каталог
const NOVELTY_CSV_URL = "https://disk.yandex.ru/ПУТЬ_К_НОВИНКАМ.csv";   // новинки
const NODUL_WEBHOOK_URL = "https://nodul.ru/ВАШ_ВЕБХУК";                // вебхук ИИ
/* ======================================= */

/* ---------- УТИЛИТЫ ---------- */
function getSessionId() {
  let id = localStorage.getItem("bf_session_id");
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now()) + Math.random();
    localStorage.setItem("bf_session_id", id);
  }
  return id;
}

// Простой парсер CSV (без кавычек с запятыми внутри)
function parseCSV(text) {
  return text
    .trim()
    .split("\n")
    .slice(1) // пропускаем заголовок
    .map(line => {
      const [name, desc, price, category, img] = line.split(",").map(s => s.trim());
      return { name, desc, price, category, img };
    })
    .filter(item => item.name);
}

async function loadCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Не удалось загрузить CSV");
  return parseCSV(await res.text());
}

/* ---------- КАТАЛОГ ---------- */
const catalogSection = document.getElementById("catalog");
const catalogList = document.getElementById("catalogList");
const heroSection = document.getElementById("hero");

document.getElementById("btnCatalog").onclick = async () => {
  heroSection.classList.add("hidden");
  catalogSection.classList.remove("hidden");
  catalogList.innerHTML = `<p class="loading">Загружаем каталог…</p>`;
  try {
    const items = await loadCSV(PRICE_CSV_URL);
    catalogList.innerHTML = items.map(renderCard).join("");
  } catch (e) {
    catalogList.innerHTML = `<p class="error">Не удалось загрузить каталог. Попробуйте позже.</p>`;
  }
};

document.getElementById("btnBackFromCatalog").onclick = () => {
  catalogSection.classList.add("hidden");
  heroSection.classList.remove("hidden");
};

function renderCard(item) {
  return `
    <div class="card">
      <img src="${item.img || 'https://placehold.co/300x200/1a1a2e/ffffff?text=Товар'}" alt="${item.name}" />
      <h4>${item.name}</h4>
      <p>${item.desc || ""}</p>
      <p class="price">${item.price || ""} ₽</p>
    </div>`;
}

/* ---------- ЧАТ ---------- */
const chatModal = document.getElementById("chatModal");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const btnSend = document.getElementById("btnSend");

document.getElementById("btnConsult").onclick = () => {
  chatModal.classList.remove("hidden");
  if (!chatMessages.children.length) {
    addMessage("ai", "Здравствуйте! Чем помочь? Спросите про товар, цель или дозировку.");
  }
};
document.getElementById("btnCloseChat").onclick = () => chatModal.classList.add("hidden");

btnSend.onclick = sendMessage;
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendMessage(); });

function addMessage(role, text) {
  const div = document.createElement("div");
  div.className = "msg msg--" + role;
  div.innerHTML = formatAnswer(text);
  chatMessages.appendChild(div);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return div;
}

// Превращает маркеры [кнопка:Название|ссылка] в кнопки
function formatAnswer(text) {
  return text.replace(/\[кнопка:([^|]+)\|([^\]]+)\]/g,
    (_, label, url) => `<a class="answer-btn" href="${url}" target="_blank">${label}</a>`);
}

async function showLoader() {
  const loader = document.createElement("div");
  loader.className = "loader";
  loader.innerHTML = `
    <span class="loader__dots">Обрабатываем Ваш запрос…</span>
    <div class="loader__novelties">
      А пока ознакомьтесь с нашими новинками:
      <ul id="noveltyList"><li>Загружаем…</li></ul>
    </div>`;
  chatMessages.appendChild(loader);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Подгружаем новинки
  try {
    const items = await loadCSV(NOVELTY_CSV_URL);
    const ul = loader.querySelector("#noveltyList");
    ul.innerHTML = items.slice(0, 3)
      .map(i => `<li>${i.name} — ${i.price} ₽</li>`).join("");
  } catch {
    loader.querySelector("#noveltyList").innerHTML = "<li>Новинки временно недоступны</li>";
  }

  return loader;
}

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  addMessage("user", text);
  chatInput.value = "";
  btnSend.disabled = true;

  const loader = await showLoader();

  try {
    const res = await fetch(NODUL_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        session_id: getSessionId(),
      }),
    });
    const data = await res.json();
    loader.remove();
    addMessage("ai", data.reply || "Не удалось получить ответ.");
  } catch (e) {
    loader.remove();
    addMessage("ai", "Ошибка связи с консультантом. Попробуйте ещё раз.");
  } finally {
    btnSend.disabled = false;
  }
}