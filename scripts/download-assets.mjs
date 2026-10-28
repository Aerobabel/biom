import fs from "node:fs/promises";
const assets = {
  "polina.jpg": "photo-1534528741775-53994a69daeb",
  "misha.jpg": "photo-1500648767791-00dcc994a43e",
  "anna.jpg": "photo-1524504388940-b1c1722653e1",
  "danil.jpg": "photo-1506794778202-cad84cf45f1d",
  "katya.jpg": "photo-1524250502761-1ac6f2e30d43",
  "ilya.jpg": "photo-1535713875002-d1d0cf377fde",
  "cafe.jpg": "photo-1554118811-1e0d58224f24",
  "park.jpg": "photo-1519331379826-f10be5486c6f",
  "games.jpg": "photo-1610890716171-6b1bb98ffd09",
};
await fs.mkdir("public/assets", { recursive: true });
for (const [file, id] of Object.entries(assets)) {
  const url = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${["cafe.jpg", "park.jpg", "games.jpg"].includes(file) ? 1200 : 200}&q=85`;
  const r = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(file + ": " + r.status);
  await fs.writeFile(
    "public/assets/" + file,
    Buffer.from(await r.arrayBuffer()),
  );
  console.log("Saved " + file);
}
