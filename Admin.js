document.addEventListener("DOMContentLoaded", setupAdminPage);

async function setupAdminPage() {
  const user = TournamentApp.getCurrentUser();
  const message = document.getElementById("adminMessage");

  if (!user || user.role !== "ADMIN") {
    message.textContent = "Admin access required. Log in with the seeded admin account.";
    document.getElementById("adminStats").innerHTML = "";
    return;
  }

  await Promise.all([loadSummary(), loadPlayers(), loadTeams(), loadTournaments()]);
  bindPlayerForm();
  bindTeamForm();
  bindTournamentForm();
}

async function loadSummary() {
  const stats = await TournamentApp.apiFetch("/admin/summary");
  const container = document.getElementById("adminStats");
  container.innerHTML = `
    <div class="dashboard-card"><strong>${stats.users}</strong><span>Users</span></div>
    <div class="dashboard-card"><strong>${stats.players}</strong><span>Players</span></div>
    <div class="dashboard-card"><strong>${stats.teams || 0}</strong><span>Teams</span></div>
    <div class="dashboard-card"><strong>${stats.tournaments}</strong><span>Tournaments</span></div>
    <div class="dashboard-card"><strong>${stats.registrations}</strong><span>Registrations</span></div>
    <div class="dashboard-card"><strong>${stats.payments}</strong><span>Payments</span></div>
  `;
}

async function loadPlayers() {
  const players = await TournamentApp.apiFetch("/players");
  const list = document.getElementById("playerList");
  list.innerHTML = players.map(player => `
    <div class="panel-card">
      <strong>${player.name}</strong>
      <p>${player.game} • ${player.score}</p>
      <div class="action-row">
        <button type="button" onclick='editPlayer(${JSON.stringify(player).replace(/'/g, "&apos;")})'>Edit</button>
        <button type="button" onclick="deletePlayer(${player.id})">Delete</button>
      </div>
    </div>
  `).join("");
}

function editPlayer(player) {
  document.getElementById("playerId").value = player.id;
  document.getElementById("playerName").value = player.name;
  document.getElementById("playerRank").value = player.rank;
  document.getElementById("playerImage").value = player.image;
  document.getElementById("playerGame").value = player.game;
  document.getElementById("playerScore").value = player.score;
}

async function deletePlayer(id) {
  await TournamentApp.apiFetch(`/players/${id}`, { method: "DELETE" });
  await loadPlayers();
  await loadSummary();
}

function bindPlayerForm() {
  document.getElementById("playerForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.getElementById("playerId").value;
    const payload = {
      name: document.getElementById("playerName").value.trim(),
      rank: document.getElementById("playerRank").value.trim(),
      image: document.getElementById("playerImage").value.trim(),
      game: document.getElementById("playerGame").value.trim(),
      score: Number(document.getElementById("playerScore").value),
    };

    await TournamentApp.apiFetch(id ? `/players/${id}` : "/players", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    event.target.reset();
    document.getElementById("playerId").value = "";
    await loadPlayers();
    await loadSummary();
  });
}

async function loadTeams() {
  const teams = await TournamentApp.apiFetch("/teams");
  const list = document.getElementById("teamList");
  list.innerHTML = teams.map(team => `
    <div class="panel-card">
      <strong>${team.teamName}</strong>
      <p>${team.game} • ${team.captain}</p>
      <div class="action-row">
        <button type="button" onclick='editTeam(${JSON.stringify(team).replace(/'/g, "&apos;")})'>Edit</button>
        <button type="button" onclick="deleteTeam(${team.id})">Delete</button>
      </div>
    </div>
  `).join("");
}

function editTeam(team) {
  document.getElementById("teamId").value = team.id;
  document.getElementById("teamName").value = team.teamName;
  document.getElementById("teamGame").value = team.game;
  document.getElementById("teamCaptain").value = team.captain;
}

async function deleteTeam(id) {
  await TournamentApp.apiFetch(`/teams/${id}`, { method: "DELETE" });
  await loadTeams();
}

function bindTeamForm() {
  document.getElementById("teamForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.getElementById("teamId").value;
    const payload = {
      teamName: document.getElementById("teamName").value.trim(),
      game: document.getElementById("teamGame").value.trim(),
      captain: document.getElementById("teamCaptain").value.trim(),
    };

    await TournamentApp.apiFetch(id ? `/teams/${id}` : "/teams", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    event.target.reset();
    document.getElementById("teamId").value = "";
    await loadTeams();
  });
}

async function loadTournaments() {
  const tournaments = await TournamentApp.apiFetch("/tournaments");
  const list = document.getElementById("tournamentList");
  list.innerHTML = tournaments.map(tournament => `
    <div class="panel-card">
      <strong>${tournament.title}</strong>
      <p>${tournament.game} • ${tournament.date} • ${tournament.time}</p>
      <div class="action-row">
        <button type="button" onclick='editTournament(${JSON.stringify(tournament).replace(/'/g, "&apos;")})'>Edit</button>
        <button type="button" onclick="deleteTournament(${tournament.id})">Delete</button>
      </div>
    </div>
  `).join("");
}

function editTournament(tournament) {
  document.getElementById("tournamentId").value = tournament.id;
  document.getElementById("tournamentTitle").value = tournament.title;
  document.getElementById("tournamentGame").value = tournament.game;
  document.getElementById("tournamentDate").value = new Date(tournament.scheduledAt).toISOString().slice(0, 16);
  document.getElementById("tournamentTime").value = tournament.time;
  document.getElementById("tournamentMax").value = tournament.maxParticipants;
}

async function deleteTournament(id) {
  await TournamentApp.apiFetch(`/tournaments/${id}`, { method: "DELETE" });
  await loadTournaments();
  await loadSummary();
}

function bindTournamentForm() {
  document.getElementById("tournamentForm").addEventListener("submit", async event => {
    event.preventDefault();
    const id = document.getElementById("tournamentId").value;
    const payload = {
      title: document.getElementById("tournamentTitle").value.trim(),
      game: document.getElementById("tournamentGame").value.trim(),
      scheduledAt: new Date(document.getElementById("tournamentDate").value).toISOString(),
      time: document.getElementById("tournamentTime").value.trim(),
      maxParticipants: Number(document.getElementById("tournamentMax").value),
    };

    await TournamentApp.apiFetch(id ? `/tournaments/${id}` : "/tournaments", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(payload),
    });

    event.target.reset();
    document.getElementById("tournamentId").value = "";
    await loadTournaments();
    await loadSummary();
  });
}
