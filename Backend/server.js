require("dotenv").config();

const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");

const db = require("./db");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const SESSION_DAYS = 7;
const REGISTRATION_FEE_CENTS = 2500;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";

app.use(
  cors({
    origin: true,
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

function getTokenFromRequest(req) {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return req.headers["x-session-token"] || null;
}

async function getSessionUser(req) {
  const token = getTokenFromRequest(req);
  if (!token) {
    return null;
  }

  const result = await db.query(
    `
      SELECT
        s.id AS session_id,
        s.token,
        s.expires_at,
        u.id,
        u.first_name,
        u.last_name,
        u.age,
        u.email,
        u.role,
        u.preferred_theme,
        u.bio,
        u.created_at
      FROM "Session" s
      JOIN "User" u ON u.id = s.user_id
      WHERE s.token = $1 AND s.expires_at > NOW()
    `,
    [token]
  );

  if (result.rowCount === 0) {
    return null;
  }

  return result.rows[0];
}

async function requireAuth(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Authentication failed", details: error.message });
  }
}

async function requireAdmin(req, res, next) {
  try {
    const user = await getSessionUser(req);
    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }
    if (user.role !== "ADMIN") {
      return res.status(403).json({ error: "Admin access required" });
    }
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ error: "Admin authentication failed", details: error.message });
  }
}

async function createSession(userId) {
  const token = crypto.randomUUID();
  const result = await db.query(
    `
      INSERT INTO "Session" (token, user_id, expires_at)
      VALUES ($1, $2, NOW() + ($3 || ' days')::interval)
      RETURNING token, expires_at
    `,
    [token, userId, SESSION_DAYS]
  );

  return result.rows[0];
}

function toUserResponse(row) {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    age: row.age,
    email: row.email,
    role: row.role,
    preferredTheme: row.preferred_theme,
    bio: row.bio,
    createdAt: row.created_at,
  };
}

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

function mapContact(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    dateOfBirth: row.date_of_birth,
    message: row.message,
    createdAt: row.created_at,
  };
}

function mapPayment(row) {
  return {
    id: row.id,
    userId: row.user_id,
    registrationId: row.registration_id,
    amountCents: row.amount_cents,
    currency: row.currency,
    status: row.status,
    provider: row.provider,
    reference: row.reference,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function buildAssistantContext() {
  const [players, tournaments, teams] = await Promise.all([
    db.query(`
      SELECT name, rank, game, score
      FROM "Player"
      ORDER BY score DESC, name ASC
      LIMIT 8
    `),
    db.query(`
      SELECT title, game, scheduled_at, time_label
      FROM "Tournament"
      ORDER BY scheduled_at ASC
      LIMIT 6
    `),
    db.query(`
      SELECT team_name, game, captain
      FROM "Team"
      ORDER BY team_name ASC
      LIMIT 6
    `),
  ]);

  return {
    players: players.rows,
    tournaments: tournaments.rows.map(row => ({
      title: row.title,
      game: row.game,
      date: new Date(row.scheduled_at).toLocaleDateString("en-US", {
        month: "long",
        day: "2-digit",
        year: "numeric",
      }),
      time: row.time_label,
    })),
    teams: teams.rows,
    registrationFeeUsd: (REGISTRATION_FEE_CENTS / 100).toFixed(2),
    supportedPages: [
      "Home",
      "Players",
      "Schedule",
      "Registration",
      "Leaderboard",
      "Profile",
      "Payments",
      "Admin",
      "Contact",
      "Sign Up",
      "Login",
    ],
  };
}

app.get("/", async (req, res) => {
  try {
    await db.query("SELECT 1");
    res.json({
      message: "Tournament API and database are running",
      routes: [
        "GET /players",
        "GET /leaderboard",
        "GET /tournaments",
        "GET /teams",
        "GET /registrations",
        "POST /registrations",
        "PUT /registrations/:id",
        "DELETE /registrations/:id",
        "POST /signup",
        "POST /login",
        "POST /logout",
        "GET /me",
        "PUT /me",
        "POST /contacts",
        "POST /payments",
        "GET /admin/summary",
      ],
    });
  } catch (error) {
    res.status(500).json({ error: "Database connection failed", details: error.message });
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

app.get("/leaderboard", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, name, rank, image, game, score, team_id, created_at, updated_at
      FROM "Player"
      ORDER BY score DESC, name ASC
      LIMIT 20
    `);
    res.json(result.rows.map(mapPlayer));
  } catch (error) {
    res.status(500).json({ error: "Failed to load leaderboard", details: error.message });
  }
});

app.post("/players", requireAdmin, async (req, res) => {
  const { name, rank, image, game, score, teamId } = req.body;

  try {
    const result = await db.query(
      `
        INSERT INTO "Player" (name, rank, image, game, score, team_id)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, name, rank, image, game, score, team_id, created_at, updated_at
      `,
      [name, rank, image, game, Number(score), teamId || null]
    );
    res.status(201).json(mapPlayer(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to create player", details: error.message });
  }
});

app.put("/players/:id", requireAdmin, async (req, res) => {
  const { name, rank, image, game, score, teamId } = req.body;

  try {
    const result = await db.query(
      `
        UPDATE "Player"
        SET name = $1, rank = $2, image = $3, game = $4, score = $5, team_id = $6, updated_at = NOW()
        WHERE id = $7
        RETURNING id, name, rank, image, game, score, team_id, created_at, updated_at
      `,
      [name, rank, image, game, Number(score), teamId || null, Number(req.params.id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json(mapPlayer(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to update player", details: error.message });
  }
});

app.delete("/players/:id", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM "Player" WHERE id = $1 RETURNING id`, [
      Number(req.params.id),
    ]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete player", details: error.message });
  }
});

app.get("/tournaments", async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, title, game, scheduled_at, time_label, max_participants, created_at, updated_at
      FROM "Tournament"
      ORDER BY scheduled_at ASC
    `);
    res.json(result.rows.map(mapTournament));
  } catch (error) {
    res.status(500).json({ error: "Failed to load tournaments", details: error.message });
  }
});

app.post("/tournaments", requireAdmin, async (req, res) => {
  const { title, game, scheduledAt, time, maxParticipants } = req.body;

  try {
    const result = await db.query(
      `
        INSERT INTO "Tournament" (title, game, scheduled_at, time_label, max_participants)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, game, scheduled_at, time_label, max_participants, created_at, updated_at
      `,
      [title, game, scheduledAt, time, Number(maxParticipants || 10)]
    );
    res.status(201).json(mapTournament(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to create tournament", details: error.message });
  }
});

app.put("/tournaments/:id", requireAdmin, async (req, res) => {
  const { title, game, scheduledAt, time, maxParticipants } = req.body;

  try {
    const result = await db.query(
      `
        UPDATE "Tournament"
        SET title = $1, game = $2, scheduled_at = $3, time_label = $4, max_participants = $5, updated_at = NOW()
        WHERE id = $6
        RETURNING id, title, game, scheduled_at, time_label, max_participants, created_at, updated_at
      `,
      [title, game, scheduledAt, time, Number(maxParticipants || 10), Number(req.params.id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }

    res.json(mapTournament(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to update tournament", details: error.message });
  }
});

app.delete("/tournaments/:id", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM "Tournament" WHERE id = $1 RETURNING id`, [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Tournament not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete tournament", details: error.message });
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

app.post("/teams", requireAdmin, async (req, res) => {
  const { teamName, game, captain } = req.body;

  try {
    const result = await db.query(
      `
        INSERT INTO "Team" (team_name, game, captain)
        VALUES ($1, $2, $3)
        RETURNING id, team_name, game, captain, created_at, updated_at
      `,
      [teamName, game, captain]
    );
    res.status(201).json(mapTeam(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to create team", details: error.message });
  }
});

app.put("/teams/:id", requireAdmin, async (req, res) => {
  const { teamName, game, captain } = req.body;

  try {
    const result = await db.query(
      `
        UPDATE "Team"
        SET team_name = $1, game = $2, captain = $3, updated_at = NOW()
        WHERE id = $4
        RETURNING id, team_name, game, captain, created_at, updated_at
      `,
      [teamName, game, captain, Number(req.params.id)]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.json(mapTeam(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to update team", details: error.message });
  }
});

app.delete("/teams/:id", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM "Team" WHERE id = $1 RETURNING id`, [
      Number(req.params.id),
    ]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Team not found" });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete team", details: error.message });
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
  const authUser = await getSessionUser(req);
  const { playerName, gameId, teamName, tournamentId } = req.body;

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

      const countResult = await db.query(
        `SELECT COUNT(*)::int AS count FROM "Registration" WHERE tournament_id = $1`,
        [tournamentId]
      );

      if (countResult.rows[0].count >= tournamentResult.rows[0].max_participants) {
        return res.status(400).json({ error: "Tournament is full" });
      }
    }

    const teamLookup = await db.query(`SELECT id FROM "Team" WHERE LOWER(team_name) = LOWER($1)`, [
      teamName,
    ]);

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
        authUser ? authUser.id : null,
        teamLookup.rows[0]?.id || null,
      ]
    );

    res.status(201).json({
      ...mapRegistration(result.rows[0]),
      registrationFeeCents: REGISTRATION_FEE_CENTS,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create registration", details: error.message });
  }
});

app.put("/registrations/:id", requireAdmin, async (req, res) => {
  const { playerName, gameId, teamName, status, tournamentId } = req.body;

  try {
    const teamLookup = await db.query(`SELECT id FROM "Team" WHERE LOWER(team_name) = LOWER($1)`, [
      teamName,
    ]);

    const result = await db.query(
      `
        UPDATE "Registration"
        SET player_name = $1,
            game_id = $2,
            team_name = $3,
            status = $4,
            tournament_id = $5,
            team_id = $6,
            updated_at = NOW()
        WHERE id = $7
        RETURNING id, player_name, game_id, team_name, status, user_id, team_id, tournament_id, created_at, updated_at
      `,
      [
        playerName,
        gameId,
        teamName,
        status || "PENDING",
        tournamentId || null,
        teamLookup.rows[0]?.id || null,
        Number(req.params.id),
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Registration not found" });
    }

    res.json(mapRegistration(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to update registration", details: error.message });
  }
});

app.delete("/registrations/:id", async (req, res) => {
  try {
    const result = await db.query(`DELETE FROM "Registration" WHERE id = $1 RETURNING id`, [
      Number(req.params.id),
    ]);
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
    const role = email.toLowerCase() === "admin@tournament2026.com" ? "ADMIN" : "USER";
    const result = await db.query(
      `
        INSERT INTO "User" (first_name, last_name, age, email, password_hash, role)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, first_name, last_name, age, email, role, preferred_theme, bio, created_at
      `,
      [firstName, lastName, Number(age), email, passwordHash, role]
    );

    const session = await createSession(result.rows[0].id);
    res.status(201).json({
      token: session.token,
      expiresAt: session.expires_at,
      user: toUserResponse(result.rows[0]),
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
      `
        SELECT id, first_name, last_name, age, email, role, preferred_theme, bio, password_hash, created_at
        FROM "User"
        WHERE email = $1
      `,
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

    const session = await createSession(user.id);
    res.json({
      message: "Login successful",
      token: session.token,
      expiresAt: session.expires_at,
      user: toUserResponse(user),
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to login", details: error.message });
  }
});

app.post("/logout", requireAuth, async (req, res) => {
  try {
    await db.query(`DELETE FROM "Session" WHERE token = $1`, [getTokenFromRequest(req)]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to logout", details: error.message });
  }
});

app.get("/me", requireAuth, async (req, res) => {
  res.json({ user: toUserResponse(req.user) });
});

app.put("/me", requireAuth, async (req, res) => {
  const { firstName, lastName, age, bio, preferredTheme } = req.body;

  try {
    const result = await db.query(
      `
        UPDATE "User"
        SET first_name = $1,
            last_name = $2,
            age = $3,
            bio = $4,
            preferred_theme = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, first_name, last_name, age, email, role, preferred_theme, bio, created_at
      `,
      [
        firstName || req.user.first_name,
        lastName || req.user.last_name,
        Number(age || req.user.age),
        bio ?? req.user.bio,
        preferredTheme || req.user.preferred_theme,
        req.user.id,
      ]
    );

    res.json({ user: toUserResponse(result.rows[0]) });
  } catch (error) {
    res.status(500).json({ error: "Failed to update profile", details: error.message });
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

    res.status(201).json(mapContact(result.rows[0]));
  } catch (error) {
    res.status(500).json({ error: "Failed to save contact message", details: error.message });
  }
});

app.get("/contacts", requireAdmin, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, full_name, email, date_of_birth, message, created_at
      FROM "ContactMessage"
      ORDER BY created_at DESC
    `);
    res.json(result.rows.map(mapContact));
  } catch (error) {
    res.status(500).json({ error: "Failed to load contact messages", details: error.message });
  }
});

app.post("/payments", async (req, res) => {
  const authUser = await getSessionUser(req);
  const { registrationId, amountCents, currency, provider } = req.body;

  try {
    const reference = `PAY-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const result = await db.query(
      `
        INSERT INTO "Payment" (user_id, registration_id, amount_cents, currency, provider, reference, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'PAID')
        RETURNING id, user_id, registration_id, amount_cents, currency, status, provider, reference, created_at, updated_at
      `,
      [
        authUser ? authUser.id : null,
        registrationId || null,
        Number(amountCents || REGISTRATION_FEE_CENTS),
        currency || "USD",
        provider || "Demo Gateway",
        reference,
      ]
    );

    if (registrationId) {
      await db.query(
        `UPDATE "Registration" SET status = 'CONFIRMED', updated_at = NOW() WHERE id = $1`,
        [registrationId]
      );
    }

    res.status(201).json({
      payment: mapPayment(result.rows[0]),
      gatewayMessage: "Demo payment processed successfully.",
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to process payment", details: error.message });
  }
});

app.post("/chat", async (req, res) => {
  const { message, history } = req.body || {};

  if (!message || !String(message).trim()) {
    return res.status(400).json({ error: "A message is required" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({
      error: "Chatbot is not configured yet. Add OPENAI_API_KEY to your environment variables.",
    });
  }

  try {
    const authUser = await getSessionUser(req);
    const context = await buildAssistantContext();
    const safeHistory = Array.isArray(history)
      ? history
          .filter(item => item && (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
          .slice(-8)
      : [];

    const instructions = [
      "You are the Tournament 2026 website assistant.",
      "Answer questions about the website, players, teams, tournaments, registration, payment flow, profile, leaderboard, admin page, and contact/help.",
      "Use the provided tournament data as the source of truth.",
      "If asked about something unrelated to this tournament website, politely steer back to site support.",
      "Keep answers concise, clear, and friendly.",
      authUser
        ? `The current signed-in user is ${authUser.first_name} ${authUser.last_name} (${authUser.email}).`
        : "The visitor may be signed out.",
      `Tournament website context: ${JSON.stringify(context)}`,
    ].join(" ");

    const input = safeHistory.concat([
      { role: "user", content: String(message).trim() },
    ]);

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions,
        input,
        text: {
          verbosity: "low",
        },
        store: false,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({
        error: data?.error?.message || "OpenAI request failed",
      });
    }

    res.json({
      reply: data.output_text || "I couldn't generate a reply just now.",
      model: OPENAI_MODEL,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate chat response", details: error.message });
  }
});

app.get("/payments", requireAuth, async (req, res) => {
  try {
    const result = await db.query(
      `
        SELECT id, user_id, registration_id, amount_cents, currency, status, provider, reference, created_at, updated_at
        FROM "Payment"
        WHERE user_id = $1 OR $2 = 'ADMIN'
        ORDER BY created_at DESC
      `,
      [req.user.id, req.user.role]
    );
    res.json(result.rows.map(mapPayment));
  } catch (error) {
    res.status(500).json({ error: "Failed to load payments", details: error.message });
  }
});

app.get("/admin/summary", requireAdmin, async (req, res) => {
  try {
    const [users, players, teams, tournaments, registrations, contacts, payments] = await Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM "User"`),
      db.query(`SELECT COUNT(*)::int AS count FROM "Player"`),
      db.query(`SELECT COUNT(*)::int AS count FROM "Team"`),
      db.query(`SELECT COUNT(*)::int AS count FROM "Tournament"`),
      db.query(`SELECT COUNT(*)::int AS count FROM "Registration"`),
      db.query(`SELECT COUNT(*)::int AS count FROM "ContactMessage"`),
      db.query(`SELECT COUNT(*)::int AS count FROM "Payment"`),
    ]);

    res.json({
      users: users.rows[0].count,
      players: players.rows[0].count,
      teams: teams.rows[0].count,
      tournaments: tournaments.rows[0].count,
      registrations: registrations.rows[0].count,
      contacts: contacts.rows[0].count,
      payments: payments.rows[0].count,
      registrationFeeCents: REGISTRATION_FEE_CENTS,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to load admin summary", details: error.message });
  }
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
  });
}
