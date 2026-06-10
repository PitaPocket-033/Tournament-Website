require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(cors());
app.use(express.json());

function mapPlayer(row) {
  return {
    id: row.id,
    name: row.name,
    rank: row.rank,
    image: row.image,
    game: row.game,
    score: row.score,
    teamId: row.team_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapTournament(row) {
  return {
    id: row.id,
    title: row.title,
    game: row.game,
    scheduledAt: row.scheduled_at,
    date: new Date(row.scheduled_at).toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
    }),
    time: row.time_label,
    maxParticipants: row.max_participants,
  };
}

function mapTeam(row) {
  return {
    id: row.id,
    teamName: row.team_name,
    game: row.game,
    captain: row.captain,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRegistration(row) {
  return {
    id: row.id,
    playerName: row.player_name,
    gameId: row.game_id,
    teamName: row.team_name,
    status: row.status,
    userId: row.user_id,
    teamId: row.team_id,
    tournamentId: row.tournament_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

app.get("/", async (req, res) => {
  try {
    await db.query("SELECT 1");

    res.json({
      message: "Tournament API and database are running",
      routes: [
        "GET /players",
        "GET /players?game=PUBG",
        "GET /tournaments",
        "GET /teams",
        "GET /registrations",
        "POST /registrations",
        "DELETE /registrations/:id",
        "POST /signup",
        "POST /login",
        "POST /contacts",
      ],
    });
  } catch (error) {
    res.status(500).json({
      error: "Database connection failed",
      details: error.message,
    });
  }
});

app.get("/players", async (req, res) => {
  try {
    const values = [];
    let sql = `
      SELECT id, name, rank, image, game, score, team_id, created_at, updated_at
      FROM "Player"
    `;

    if (req.query.game) {
      values.push(String(req.query.game));
      sql += ` WHERE LOWER(game) = LOWER($1)`;
    }

    sql += " ORDER BY score DESC, name ASC";

    const result = await db.query(sql, values);
    res.json(result.rows.map(mapPlayer));
  } catch (error) {
    res.status(500).json({ error: "Failed to load players", details: error.message });
  }
});

app.get("/tournaments", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, game, scheduled_at, time_label, max_participants
      FROM "Tournament"
      ORDER BY scheduled_at ASC
    `);

    res.json(result.rows.map(mapTournament));
  } catch (error) {
    res.status(500).json({ error: "Failed to load tournaments", details: error.message });
  }
});

app.get("/teams", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, team_name, game, captain, created_at, updated_at
      FROM "Team"
      ORDER BY team_name ASC
    `);

    res.json(result.rows.map(mapTeam));
  } catch (error) {
    res.status(500).json({ error: "Failed to load teams", details: error.message });
  }
});

app.get("/registrations", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, player_name, game_id, team_name, status, user_id, team_id, tournament_id, created_at, updated_at
      FROM "Registration"
      ORDER BY created_at DESC
    `);

    res.json(result.rows.map(mapRegistration));
  } catch (error) {
    res.status(500).json({ error: "Failed to load registrations", details: error.message });
  }
});

app.post("/registrations", async (req, res) => {
  const { playerName, gameId, teamName, tournamentId, userId } = req.body;

  if (!playerName || !gameId || !teamName) {
    return res.status(400).json({ error: "playerName, gameId, and teamName are required" });
  }

  try {
    if (tournamentId) {
      const tournamentResult = await db.query(
        `SELECT id, max_participants FROM "Tournament" WHERE id = $1`,
        [tournamentId]
      );

      if (tournamentResult.rowCount === 0) {
        return res.status(404).json({ error: "Tournament not found" });
      }

      const tournament = tournamentResult.rows[0];
      const countResult = await db.query(
        `SELECT COUNT(*)::int AS count FROM "Registration" WHERE tournament_id = $1`,
        [tournamentId]
      );

      if (countResult.rows[0].count >= tournament.max_participants) {
        return res.status(400).json({ error: "Tournament is full" });
      }
    } else {
      const countResult = await db.query(`SELECT COUNT(*)::int AS count FROM "Registration"`);
      if (countResult.rows[0].count >= 10) {
        return res.status(400).json({ error: "Tournament is full! (Max 10 players)" });
      }
    }

    const teamLookup = await db.query(
      `SELECT id FROM "Team" WHERE LOWER(team_name) = LOWER($1)`,
      [teamName]
    );

    const result = await db.query(
      `
        INSERT INTO "Registration" (player_name, game_id, team_name, tournament_id, user_id, team_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, player_name, game_id, team_name, status, user_id, team_id, tournament_id, created_at, updated_at
      `,
      [
        playerName,
        gameId,
        teamName,
        tournamentId || null,
        userId || null,
        teamLookup.rows[0]?.id || null,
      ]
    );

    res.status(201).json(mapRegistration(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to create registration", details: error.message });
  }
});

app.delete("/registrations/:id", async (req, res) => {
  try {
    const result = await db.query(
      `DELETE FROM "Registration" WHERE id = $1 RETURNING id`,
      [Number(req.params.id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Registration not found" });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete registration", details: error.message });
  }
});

app.post("/signup", async (req, res) => {
  const { firstName, lastName, age, email, password } = req.body;

  if (!firstName || !lastName || !age || !email || !password) {
    return res.status(400).json({ error: "All signup fields are required" });
  }

  try {
    const existing = await db.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await db.query(
      `
        INSERT INTO "User" (first_name, last_name, age, email, password_hash)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, first_name, last_name, age, email, created_at
      `,
      [firstName, lastName, Number(age), email, passwordHash]
    );

    res.status(201).json({
      id: result.rows[0].id,
      firstName: result.rows[0].first_name,
      lastName: result.rows[0].last_name,
      age: result.rows[0].age,
      email: result.rows[0].email,
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create account", details: error.message });
  }
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email and password are required" });
  }

  try {
    const result = await db.query(
      `SELECT id, first_name, last_name, email, password_hash FROM "User" WHERE email = $1`,
      [email]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const user = result.rows[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    res.json({
      message: "Login successful",
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to login", details: error.message });
  }
});

app.post("/contacts", async (req, res) => {
  const { fullName, email, dateOfBirth, message } = req.body;

  if (!fullName || !email || !dateOfBirth || !message) {
    return res.status(400).json({ error: "All contact fields are required" });
  }

  try {
    const result = await db.query(
      `
        INSERT INTO "ContactMessage" (full_name, email, date_of_birth, message)
        VALUES ($1, $2, $3, $4)
        RETURNING id, full_name, email, date_of_birth, message, created_at
      `,
      [fullName, email, dateOfBirth, message]
    );

    res.status(201).json({
      id: result.rows[0].id,
      fullName: result.rows[0].full_name,
      email: result.rows[0].email,
      dateOfBirth: result.rows[0].date_of_birth,
      message: result.rows[0].message,
      createdAt: result.rows[0].created_at,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to save contact message", details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
