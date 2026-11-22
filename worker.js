
const FIREBASE_API_KEY = "AIzaSyAUKJ8V3q8VtDJI6STl7r69HNmt-xyLZUg";

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

      const authorization = request.headers.get("Authorization") || "";
      const idToken = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

      if (!idToken) {
        return respond({ error: "Falta iniciar sesión" }, 401);
      }

      try {
        const verification = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ idToken })
          }
        );

        if (!verification.ok) {
          return respond({ error: "Sesión no válida. Inicia sesión otra vez." }, 401);
        }

        const data = await verification.json();
        const user = data.users && data.users[0];

        if (!user || !user.localId || !user.email) {
          return respond({ error: "No se pudo identificar la cuenta" }, 401);
        }

        await env.DB.prepare(
          `INSERT INTO users (id, email, points)
           VALUES (?, ?, 0)
           ON CONFLICT(id) DO UPDATE SET email = excluded.email`
        ).bind(user.localId, user.email).run();

        const account = await env.DB.prepare(
          "SELECT id, email, points FROM users WHERE id = ?"
        ).bind(user.localId).first();

        return respond({
          ok: true,
          message: "Cuenta conectada correctamente",
          user: account
        });
      } catch (error) {
        return respond({ error: "No se pudo conectar la cuenta" }, 500);
      }
    }

    return respond({ error: "Ruta no encontrada" }, 404);
  }
};



