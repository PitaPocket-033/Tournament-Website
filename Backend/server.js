const express = require("express");
const cors = require("cors");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ================= PLAYERS DATA =================
// Same fields used by Players.js: name, rank, image, game, score
const players = [
  { name: "Tenz", rank: "Rank #1", image: "JPG/Tenz.jpg", game: "Valorant", score: 9800 },
  { name: "Ryley", rank: "Rank #2", image: "JPG/Ryley.jpg", game: "Rocket League", score: 9400 },
  { name: "Retals", rank: "Rank #3", image: "JPG/retals.jpg", game: "Rocket League", score: 9100 },
  { name: "Klaus", rank: "Rank #4", image: "JPG/Klaus.jpg", game: "Valorant", score: 8900 },
  { name: "Ninja", rank: "Rank #5", image: "JPG/Ninja.jpg", game: "Fortnite", score: 8700 },
  { name: "Feinberg", rank: "Rank #6", image: "JPG/Feinberg.jpg", game: "Dota 2", score: 8500 },
  { name: "Faker", rank: "Rank #7", image: "JPG/Faker.jpg", game: "League of Legends", score: 8300 },
  { name: "Shroud", rank: "Rank #8", image: "JPG/Shroud.jpg", game: "PUBG", score: 8100 },
  { name: "Sumail", rank: "Rank #9", image: "JPG/Sumail.jpg", game: "Dota 2", score: 7900 }
];

// ================= TOURNAMENTS DATA =================
const tournaments = [
  { id: 1, title: "PUBG Summer Clash", game: "PUBG", date: "June 20, 2026", time: "4:00 PM" },
  { id: 2, title: "Valorant Pro League", game: "Valorant", date: "July 15, 2026", time: "6:00 PM" },
  { id: 3, title: "Rocket League Arena Cup", game: "Rocket League", date: "August 03, 2026", time: "5:00 PM" },
  { id: 4, title: "Dota 2 Grand Finals", game: "Dota 2", date: "August 20, 2026", time: "7:00 PM" }
];

// ================= TEAMS DATA =================
const teams = [
  { id: 1, teamName: "Alpha Squad", game: "PUBG", captain: "Shroud" },
  { id: 2, teamName: "Cyber Knights", game: "Valorant", captain: "Tenz" },
  { id: 3, teamName: "Boost Masters", game: "Rocket League", captain: "Ryley" },
  { id: 4, teamName: "Ancient Warriors", game: "Dota 2", captain: "Sumail" }
];

// Simple home route so opening localhost:3000 shows available APIs
app.get("/", (req, res) => {
  res.json({
    message: "Tournament API is running",
    routes: [
      "/players",
      "/players?game=PUBG",
      "/tournaments",
      "/teams"
    ]
  });
});

// Extension 1 + filter requirement: GET /players and GET /players?game=PUBG
app.get("/players", (req, res) => {
  const gameFilter = req.query.game;

  if (gameFilter) {
    const filteredPlayers = players.filter(player =>
      player.game.toLowerCase() === gameFilter.toLowerCase()
    );
    return res.json(filteredPlayers);
  }

  res.json(players);
});

// Extension 2: GET /tournaments
app.get("/tournaments", (req, res) => {
  res.json(tournaments);
});

// Extension 3: GET /teams
app.get("/teams", (req, res) => {
  res.json(teams);
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
