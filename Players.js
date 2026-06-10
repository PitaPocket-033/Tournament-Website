const API_BASE_URL = "http://localhost:3000";

let playersData = [];

document.addEventListener("DOMContentLoaded", () => {
  loadPlayers();

  document.getElementById("searchInput").addEventListener("input", applyFilters);
  document.getElementById("gameFilter").addEventListener("change", applyFilters);
  document.getElementById("rankFilter").addEventListener("change", applyFilters);
});

function loadPlayers() {
  fetch(`${API_BASE_URL}/players`)
    .then(response => {
      if (!response.ok) {
        throw new Error("Unable to fetch players from API");
      }
      return response.json();
    })
    .then(players => {
      playersData = players;
      displayPlayers(playersData);
    })
    .catch(error => {
      console.error("Error fetching players:", error);
      document.getElementById("playersContainer").innerHTML =
        "<p class='error'>Could not load players. Please start the backend server using <strong>node Backend/server.js</strong>.</p>";
    });
}

function applyFilters() {
  const searchValue = document.getElementById("searchInput").value.toLowerCase();
  const gameValue = document.getElementById("gameFilter").value;
  const rankValue = document.getElementById("rankFilter").value;

  const filteredPlayers = playersData.filter(player => {
    const matchesName = player.name.toLowerCase().includes(searchValue);
    const matchesGame = gameValue === "" || player.game === gameValue;

    const rankNum = parseInt(player.rank.replace("Rank #", ""));
    const category = rankNum <= 3 ? "Top" : rankNum <= 6 ? "Mid" : "Low";
    const matchesRank = rankValue === "" || category === rankValue;

    return matchesName && matchesGame && matchesRank;
  });

  displayPlayers(filteredPlayers);
}

function displayPlayers(players) {
  const container = document.getElementById("playersContainer");
  container.innerHTML = "";

  if (players.length === 0) {
    container.innerHTML = "<p class='error'>No players found.</p>";
    return;
  }

  players.forEach(player => {
    const card = document.createElement("div");
    card.className = "card flip-animation";

    const rankNum = parseInt(player.rank.replace("Rank #", ""));
    const badgeHTML = rankNum <= 3 ? "<div class='diamond-badge'>TOP</div>" : "";

    const scorePercent = Math.min(100, Math.round((player.score / 10000) * 100));

    card.innerHTML = `
      ${badgeHTML}
      <img src="${player.image}" alt="${player.name}">
      <h3>${player.name}</h3>
      <p><strong>${player.rank}</strong></p>
      <p class="game-pill">${player.game}</p>
      <p>Score: ${player.score}</p>
      <div class="score-track"><span style="width:${scorePercent}%"></span></div>
    `;

    container.appendChild(card);
  });
}
