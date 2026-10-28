import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./db.mjs";
import { createApp } from "./app.mjs";
const production = process.env.NODE_ENV === "production";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const store = await createStore();
const app = await createApp(store, { production });
if (production) {
  app.use(express.static(path.join(root, "dist"), { maxAge: "1h" }));
  app.get("*", (req, res) =>
    res.sendFile(path.join(root, "dist", "index.html")),
  );
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
}
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, production ? "0.0.0.0" : "127.0.0.1", () =>
  console.log(`Biom is ready at http://localhost:${port}`),
);
process.on("SIGTERM", () =>
  server.close(async () => {
    await store.close();
    process.exit(0);
  }),
);
