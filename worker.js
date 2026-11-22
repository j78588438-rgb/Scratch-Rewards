
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
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

    if (path === "/db-check" || path === "/db-schema") {
      try {
        const tables = ["users", "rewards", "claims"];
        const schema = {};

        for (const table of tables) {
          const result = await env.DB.prepare(
            `PRAGMA table_info(${table})`
          ).all();

          schema[table] = result.results;
        }

        return respond({
          ok: true,
          message: "Estructura de base de datos revisada",
          schema
        });
      } catch (error) {
        return respond({
          ok: false,
          error: "No se pudo revisar la base de datos"
        }, 500);
      }
    }

    return respond({ error: "Ruta no encontrada" }, 404);
  }
};


