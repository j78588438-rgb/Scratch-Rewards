
const FIREBASE_API_KEY = "AIzaSyAUKJ8V3q8VtDJI6STl7r69HNmt-xyLZUg";

async function verifyUser(request) {
  const authorization = request.headers.get("Authorization") || "";
  const idToken = authorization.startsWith("Bearer ")
    ? authorization.slice(7)
    : "";

  if (!idToken) {
    throw new Error("Falta iniciar sesión");
  }

  const verification = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken })
    }
  );

  if (!verification.ok) {
    throw new Error("Sesión no válida. Inicia sesión otra vez.");
  }

  const data = await verification.json();
  const user = data.users && data.users[0];

  if (!user || !user.localId || !user.email) {
    throw new Error("No se pudo identificar la cuenta");
  }

  return {
    id: user.localId,
    email: user.email
  };
}

export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };

    const respond = (data, status = 200) =>
      new Response(JSON.stringify(data), {
        status,
        headers: { ...cors, "Content-Type": "application/json" }
      });

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const path = new URL(request.url).pathname;

    if (path === "/") {
      return respond({ message: "Scratch Rewards API funcionando" });
    }

    if (path === "/db-check") {
      try {
        const result = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table'"
        ).all();

        return respond({
          ok: true,
          message: "Base de datos conectada",
          tables: result.results.map(table => table.name)
        });
      } catch {
        return respond({ error: "Error de base de datos" }, 500);
      }
    }

    if (path === "/db-schema") {
      try {
        const schema = {};

        for (const table of ["users", "rewards", "claims"]) {
          const result = await env.DB.prepare(
            `PRAGMA table_info(${table})`
          ).all();

          schema[table] = result.results;
        }

        return respond({ ok: true, schema });
      } catch {
        return respond({ error: "Error al revisar la base de datos" }, 500);
      }
    }

    if (path === "/me") {
      if (request.method !== "POST") {
        return respond({ error: "Método no permitido" }, 405);
      }

      try {
        const user = await verifyUser(request);

        await env.DB.prepare(
          `INSERT INTO users (id, email, points)
           VALUES (?, ?, 0)
           ON CONFLICT(id) DO UPDATE SET email = excluded.email`
        ).bind(user.id, user.email).run();

        const account = await env.DB.prepare(
          "SELECT id, email, points FROM users WHERE id = ?"
        ).bind(user.id).first();

        return respond({
          ok: true,
          message: "Cuenta conectada correctamente",
          user: account
        });
      } catch (error) {
        return respond({ error: error.message || "Error de conexión" }, 401);
      }
    }

    if (path === "/scratch") {
      if (request.method !== "POST") {
        return respond({ error: "Método no permitido" }, 405);
      }

      try {
        const user = await verifyUser(request);

        const account = await env.DB.prepare(
          "SELECT id FROM users WHERE id = ?"
        ).bind(user.id).first();

        if (!account) {
          return respond({ error: "Primero inicia sesión" }, 401);
        }

        const now = Math.floor(Date.now() / 1000);
        const cutoff = now - 600;
        const points = Math.floor(Math.random() * 11) + 10;

        const results = await env.DB.batch([
          env.DB.prepare(
            `INSERT INTO claims (user_id, type, claimed_at)
             SELECT ?, 'normal', ?
             WHERE NOT EXISTS (
               SELECT 1 FROM claims
               WHERE user_id = ?
               AND type = 'normal'
               AND claimed_at > ?
             )`
          ).bind(user.id, now, user.id, cutoff),

          env.DB.prepare(
            `UPDATE users
             SET points = points + ?
             WHERE id = ? AND changes() = 1`
          ).bind(points, user.id)
        ]);

        const inserted = results[0].meta.changes;

        if (inserted !== 1) {
          const lastClaim = await env.DB.prepare(
            `SELECT MAX(claimed_at) AS last_claim
             FROM claims
             WHERE user_id = ? AND type = 'normal'`
          ).bind(user.id).first();

          const remaining = Math.max(
            1,
            600 - (now - (lastClaim.last_claim || now))
          );

          return respond({
            ok: false,
            error: "Debes esperar antes de volver a raspar",
            remainingSeconds: remaining
          }, 429);
        }

        const updatedAccount = await env.DB.prepare(
          "SELECT points FROM users WHERE id = ?"
        ).bind(user.id).first();

        await env.DB.prepare(
          `INSERT INTO rewards (user_id, type, points)
           VALUES (?, 'normal', ?)`
        ).bind(user.id, points).run();

        return respond({
          ok: true,
          message: "¡Ganaste puntos!",
          pointsWon: points,
          totalPoints: updatedAccount.points
        });

      } catch (error) {
        return respond({
          error: error.message || "No se pudo realizar el raspado"
        }, 400);
      }
    }

    return respond({ error: "Ruta no encontrada" }, 404);
  }
};




