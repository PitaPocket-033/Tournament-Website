document.addEventListener("DOMContentLoaded", loadLeaderboard);

async function loadLeaderboard() {
  const list = document.getElementById("leaderboardList");

  try {
    const players = await TournamentApp.apiFetch("/leaderboard");
    list.innerHTML = "";

    players.forEach((player, index) => {
      const row = document.createElement("div");
      row.className = "panel-card leader-row";
      row.innerHTML = `
        <div class="leader-rank">#${index + 1}</div>
        <div>
          <h3>${player.name}</h3>
          <p class="muted">${player.game} • ${player.rank}</p>
        </div>
        <div>
          <div class="score-track"><span style="width:${Math.min(100, Math.round((player.score / 10000) * 100))}%"></span></div>
        </div>
        <div class="leader-score">${player.score}</div>
      `;
      list.appendChild(row);
    });
  } catch (error) {
    list.innerHTML = `<div class="panel-card">Could not load leaderboard: ${error.message}</div>`;
  }
}
