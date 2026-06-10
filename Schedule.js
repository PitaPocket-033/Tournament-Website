document.addEventListener("DOMContentLoaded", () => {
  loadTournaments();
  loadTeams();
});

function loadTournaments() {
  TournamentApp.apiFetch("/tournaments")
    .then(tournaments => {
      const tableBody = document.getElementById("tournamentBody");
      tableBody.innerHTML = "";

      tournaments.forEach(tournament => {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${tournament.date}</td>
          <td>${tournament.title}</td>
          <td>${tournament.game}</td>
          <td>${tournament.time}</td>
        `;
        tableBody.appendChild(row);
      });
    })
    .catch(error => {
      console.error("Error fetching tournaments:", error);
      document.getElementById("tournamentBody").innerHTML =
        "<tr><td colspan='4'>Could not load tournaments. Start backend using node Backend/server.js.</td></tr>";
    });
}

function loadTeams() {
  TournamentApp.apiFetch("/teams")
    .then(teams => {
      const teamContainer = document.getElementById("teamsContainer");
      teamContainer.innerHTML = "";

      teams.forEach(team => {
        const card = document.createElement("div");
        card.className = "team-card";
        card.innerHTML = `
          <h3>${team.teamName}</h3>
          <p>Game: ${team.game}</p>
          <p>Captain: ${team.captain}</p>
        `;
        teamContainer.appendChild(card);
      });
    })
    .catch(error => {
      console.error("Error fetching teams:", error);
      document.getElementById("teamsContainer").innerHTML =
        "<p>Could not load teams. Start backend using node Backend/server.js.</p>";
    });
}
