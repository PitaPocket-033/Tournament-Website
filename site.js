const API_BASE_URL = (() => {
  if (window.__API_BASE_URL__) {
    return window.__API_BASE_URL__.replace(/\/$/, "");
  }

  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") {
    return "http://localhost:3000";
  }

  return "/.netlify/functions/api";
})();
const STORAGE_KEY = "tournamentSession";

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
    throw new Error(data.error || "Request failed");
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
