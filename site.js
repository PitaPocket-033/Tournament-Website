const API_BASE_URL = (() => {
  if (window.__API_BASE_URL__) {
    return window.__API_BASE_URL__.replace(/\/$/, "");
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000";
  }

  return "/api";
})();
const STORAGE_KEY = "tournamentSession";
const CHAT_STORAGE_KEY = "tournamentChatHistory";

function getStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null;
  } catch (error) {
    return null;
  }
}

function saveSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

function getChatHistory() {
  try {
    return JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY)) || [];
  } catch (error) {
    return [];
  }
}

function saveChatHistory(history) {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(history.slice(-12)));
}

function getToken() {
  return getStoredSession()?.token || null;
}

function getCurrentUser() {
  return getStoredSession()?.user || null;
}

function applyTheme(themeName) {
  document.documentElement.setAttribute("data-theme", themeName || "cyan");
}

async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = Object.assign({}, options.headers || {});

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (options.body && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    if (typeof data === "string" && data.trim()) {
      throw new Error(data.trim());
    }
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

async function hydrateSessionFromServer() {
  const session = getStoredSession();
  if (!session?.token) {
    return null;
  }

  try {
    const data = await apiFetch("/me");
    const nextSession = { token: session.token, user: data.user };
    saveSession(nextSession);
    applyTheme(data.user.preferredTheme);
    return nextSession;
  } catch (error) {
    clearSession();
    return null;
  }
}

function enhanceNavigation() {
  const nav = document.querySelector("nav");
  if (!nav) return;

  const user = getCurrentUser();
  const hasProfile = Array.from(nav.querySelectorAll("a")).some(
    link => link.getAttribute("href") === "Profile.html"
  );

  if (!Array.from(nav.querySelectorAll("a")).some(link => link.getAttribute("href") === "Leaderboard.html")) {
    const leaderboardLink = document.createElement("a");
    leaderboardLink.href = "Leaderboard.html";
    leaderboardLink.textContent = "Leaderboard";
    nav.appendChild(leaderboardLink);
  }

  if (!hasProfile) {
    const profileLink = document.createElement("a");
    profileLink.href = "Profile.html";
    profileLink.textContent = "Profile";
    nav.appendChild(profileLink);
  }

  if (!Array.from(nav.querySelectorAll("a")).some(link => link.getAttribute("href") === "Payment.html")) {
    const paymentLink = document.createElement("a");
    paymentLink.href = "Payment.html";
    paymentLink.textContent = "Payments";
    nav.appendChild(paymentLink);
  }

  if (user?.role === "ADMIN" && !Array.from(nav.querySelectorAll("a")).some(link => link.getAttribute("href") === "Admin.html")) {
    const adminLink = document.createElement("a");
    adminLink.href = "Admin.html";
    adminLink.textContent = "Admin";
    nav.appendChild(adminLink);
  }

  let status = document.getElementById("navUserStatus");
  if (!status) {
    status = document.createElement("div");
    status.id = "navUserStatus";
    status.className = "nav-user-status";
    nav.parentElement.appendChild(status);
  }

  if (user) {
    status.innerHTML = `
      <span>Signed in as <strong>${user.firstName}</strong></span>
      <button type="button" id="logoutBtn" class="nav-logout-btn">Logout</button>
    `;

    const logoutBtn = document.getElementById("logoutBtn");
    logoutBtn?.addEventListener("click", async () => {
      try {
        await apiFetch("/logout", { method: "POST" });
      } catch (error) {
        console.error(error);
      }
      clearSession();
      location.href = "Login.html";
    });
  } else {
    status.innerHTML = `<span>Guest mode</span>`;
  }
}

function injectFooter() {
  if (document.querySelector("footer.site-footer")) {
    return;
  }

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.innerHTML = `
    <div class="footer-grid">
      <div>
        <h3>Tournament 2026</h3>
        <p>Database-backed tournament platform with players, teams, schedules, registration, payments, and admin tools.</p>
      </div>
      <div>
        <h4>Explore</h4>
        <a href="Leaderboard.html">Leaderboard</a>
        <a href="Schedule.html">Schedule</a>
        <a href="Registration.html">Registration</a>
        <a href="Profile.html">Profile</a>
      </div>
      <div>
        <h4>Project Status</h4>
        <p>Database: Connected</p>
        <p>Authentication: Active</p>
        <p>Live URL: Ready for deployment</p>
      </div>
    </div>
  `;

  document.body.appendChild(footer);
}

function renderChatMessages(container, history) {
  container.innerHTML = "";

  if (!history.length) {
    const empty = document.createElement("div");
    empty.className = "chat-empty-state";
    empty.textContent = "Ask about players, schedule, registration, payments, or the website.";
    container.appendChild(empty);
    return;
  }

  history.forEach(item => {
    const bubble = document.createElement("div");
    bubble.className = `chat-message chat-${item.role}`;
    bubble.textContent = item.content;
    container.appendChild(bubble);
  });

  container.scrollTop = container.scrollHeight;
}

function injectChatbot() {
  if (document.getElementById("chatWidget")) {
    return;
  }

  const wrapper = document.createElement("div");
  wrapper.className = "chat-widget-shell";
  wrapper.innerHTML = `
    <button type="button" id="chatToggleBtn" class="chat-toggle-btn">Chat</button>
    <section id="chatWidget" class="chat-widget chat-hidden" aria-label="Tournament assistant">
      <div class="chat-header">
        <div>
          <strong>Tournament Assistant</strong>
          <p>Ask anything about the website</p>
        </div>
        <button type="button" id="chatCloseBtn" class="chat-close-btn">×</button>
      </div>
      <div id="chatMessages" class="chat-messages"></div>
      <form id="chatForm" class="chat-form">
        <textarea id="chatInput" rows="2" placeholder="Ask about schedule, players, payments, or registration..." required></textarea>
        <div class="chat-actions">
          <button type="button" id="chatClearBtn" class="chat-clear-btn">Clear</button>
          <button type="submit" id="chatSendBtn">Send</button>
        </div>
      </form>
      <div id="chatStatus" class="chat-status"></div>
    </section>
  `;

  document.body.appendChild(wrapper);

  const widget = document.getElementById("chatWidget");
  const messages = document.getElementById("chatMessages");
  const status = document.getElementById("chatStatus");
  const input = document.getElementById("chatInput");
  const history = getChatHistory();

  renderChatMessages(messages, history);

  document.getElementById("chatToggleBtn")?.addEventListener("click", () => {
    widget.classList.remove("chat-hidden");
    input.focus();
  });

  document.getElementById("chatCloseBtn")?.addEventListener("click", () => {
    widget.classList.add("chat-hidden");
  });

  document.getElementById("chatClearBtn")?.addEventListener("click", () => {
    saveChatHistory([]);
    renderChatMessages(messages, []);
    status.textContent = "";
  });

  document.getElementById("chatForm")?.addEventListener("submit", async event => {
    event.preventDefault();

    const message = input.value.trim();
    if (!message) return;

    const nextHistory = getChatHistory().concat([{ role: "user", content: message }]);
    saveChatHistory(nextHistory);
    renderChatMessages(messages, nextHistory);
    input.value = "";
    status.textContent = "Assistant is thinking...";

    try {
      const data = await apiFetch("/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          history: nextHistory,
        }),
      });

      const updatedHistory = getChatHistory().concat([
        { role: "assistant", content: data.reply },
      ]);
      saveChatHistory(updatedHistory);
      renderChatMessages(messages, updatedHistory);
      status.textContent = `Powered by ${data.model}`;
    } catch (error) {
      status.textContent = error.message;
    }
  });
}

async function initializeSite() {
  const session = getStoredSession();
  if (session?.user?.preferredTheme) {
    applyTheme(session.user.preferredTheme);
  } else {
    applyTheme("cyan");
  }

  await hydrateSessionFromServer();
  enhanceNavigation();
  injectFooter();
  injectChatbot();
}

window.TournamentApp = {
  API_BASE_URL,
  apiFetch,
  applyTheme,
  clearSession,
  getCurrentUser,
  getStoredSession,
  initializeSite,
  saveSession,
};

document.addEventListener("DOMContentLoaded", () => {
  initializeSite().catch(error => console.error("Site initialization failed:", error));
});
