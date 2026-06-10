require("dotenv").config();

const { Pool } = require("pg");

const rawConnectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!rawConnectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to seed the database.");
}

const parsedUrl = new URL(rawConnectionString);
parsedUrl.searchParams.delete("sslmode");

const connectionString = parsedUrl.toString();
const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

const teams = [
  { teamName: "Alpha Squad", game: "PUBG", captain: "Shroud" },
  { teamName: "Cyber Knights", game: "Valorant", captain: "Tenz" },
  { teamName: "Boost Masters", game: "Rocket League", captain: "Ryley" },
  { teamName: "Ancient Warriors", game: "Dota 2", captain: "Sumail" },
];

const players = [
  { name: "Tenz", rank: "Rank #1", image: "JPG/Tenz.jpg", game: "Valorant", score: 9800, teamName: "Cyber Knights" },
  { name: "Ryley", rank: "Rank #2", image: "JPG/Ryley.jpg", game: "Rocket League", score: 9400, teamName: "Boost Masters" },
  { name: "Retals", rank: "Rank #3", image: "JPG/retals.jpg", game: "Rocket League", score: 9100, teamName: "Boost Masters" },
  { name: "Klaus", rank: "Rank #4", image: "JPG/Klaus.jpg", game: "Valorant", score: 8900, teamName: "Cyber Knights" },
  { name: "Ninja", rank: "Rank #5", image: "JPG/Ninja.jpg", game: "Fortnite", score: 8700, teamName: "Alpha Squad" },
  { name: "Feinberg", rank: "Rank #6", image: "JPG/Feinberg.jpg", game: "Dota 2", score: 8500, teamName: "Ancient Warriors" },
  { name: "Faker", rank: "Rank #7", image: "JPG/Faker.jpg", game: "League of Legends", score: 8300, teamName: "Ancient Warriors" },
  { name: "Shroud", rank: "Rank #8", image: "JPG/Shroud.jpg", game: "PUBG", score: 8100, teamName: "Alpha Squad" },
  { name: "Sumail", rank: "Rank #9", image: "JPG/Sumail.jpg", game: "Dota 2", score: 7900, teamName: "Ancient Warriors" },
];

const tournaments = [
  { title: "PUBG Summer Clash", game: "PUBG", scheduledAt: "2026-06-20T16:00:00Z", timeLabel: "4:00 PM" },
  { title: "Valorant Pro League", game: "Valorant", scheduledAt: "2026-07-15T18:00:00Z", timeLabel: "6:00 PM" },
  { title: "Rocket League Arena Cup", game: "Rocket League", scheduledAt: "2026-08-03T17:00:00Z", timeLabel: "5:00 PM" },
  { title: "Dota 2 Grand Finals", game: "Dota 2", scheduledAt: "2026-08-20T19:00:00Z", timeLabel: "7:00 PM" },
];

async function seed() {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    for (const team of teams) {
      await client.query(
        `
          INSERT INTO "Team" (team_name, game, captain)
          VALUES ($1, $2, $3)
          ON CONFLICT (team_name)
          DO UPDATE SET game = EXCLUDED.game, captain = EXCLUDED.captain
        `,
        [team.teamName, team.game, team.captain]
      );
    }

    for (const tournament of tournaments) {
      await client.query(
        `
          INSERT INTO "Tournament" (title, game, scheduled_at, time_label, max_participants)
          VALUES ($1, $2, $3, $4, 10)
          ON CONFLICT (title)
          DO UPDATE SET
            game = EXCLUDED.game,
            scheduled_at = EXCLUDED.scheduled_at,
            time_label = EXCLUDED.time_label,
            max_participants = EXCLUDED.max_participants
        `,
        [tournament.title, tournament.game, tournament.scheduledAt, tournament.timeLabel]
      );
    }

    for (const player of players) {
      const teamResult = await client.query(
        `SELECT id FROM "Team" WHERE team_name = $1`,
        [player.teamName]
      );

      await client.query(
        `
          INSERT INTO "Player" (name, rank, image, game, score, team_id)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (name)
          DO UPDATE SET
            rank = EXCLUDED.rank,
            image = EXCLUDED.image,
            game = EXCLUDED.game,
            score = EXCLUDED.score,
            team_id = EXCLUDED.team_id
        `,
        [
          player.name,
          player.rank,
          player.image,
          player.game,
          player.score,
          teamResult.rows[0]?.id || null,
        ]
      );
    }

    await client.query("COMMIT");
    console.log("Database seeded successfully.");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error("Seeding failed:", error);
  process.exit(1);
});
