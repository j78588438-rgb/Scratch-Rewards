
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

    if (path === "/db-check") {
      try {
        const result = await env.DB.prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('users','rewards','claims') ORDER BY name"
        ).all();

        return respond({
          ok: true,
          message: "Base de datos conectada",
          tables: result.results.map(row => row.name)
        });
      } catch (error) {
        return respond({
          ok: false,
          error: "No se pudo consultar la base de datos"
        }, 500);
      }
    }

    return respond({ error: "Ruta no encontrada" }, 404);
  }
};

