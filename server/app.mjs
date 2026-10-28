import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import {
  randomBytes,
  randomUUID,
  scrypt as scryptCallback,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { promisify } from "node:util";
import { z } from "zod";
import {
  people,
  seedPosts,
  seedEvents,
  interests,
  cities,
} from "../shared/seed.mjs";
const scrypt = promisify(scryptCallback);
const hash = (t) => createHash("sha256").update(t).digest("hex");
const publicUser = (u) => {
  if (!u) return null;
  const { password, email, ...safe } = u;
  return safe;
};
const nonempty = (max) => z.string().trim().min(1).max(max);
const profileFields = z
  .object({
    name: nonempty(60),
    bio: z.string().trim().max(280).default(""),
    city: z.string(),
    district: z.string(),
    interests: z.array(z.enum(interests)).min(1).max(6),
    avatar: z.string().max(250).nullable().optional(),
  })
  .refine((v) => cities[v.city]?.includes(v.district), {
    message: "Выберите город и район из списка",
  });
const cookie = (req) => {
  try {
    return decodeURIComponent(
      (req.headers.cookie || "")
        .split(";")
        .map((x) => x.trim())
        .find((x) => x.startsWith("biom_session="))
        ?.slice(13) || "",
    );
  } catch {
    return "";
  }
};
function error(status, message) {
  return Object.assign(new Error(message), { status });
}
export async function createApp(store, { production = false } = {}) {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", ...(!production ? ["'unsafe-inline'"] : [])],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "blob:"],
          connectSrc: ["'self'", ...(!production ? ["ws:"] : [])],
        },
      },
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(express.json({ limit: "8mb" }));
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 150,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      message: { error: "Слишком много запросов. Подождите минуту." },
    }),
  );
  app.use("/api", async (req, res, next) => {
    try {
      if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
        const origin = req.headers.origin;
        if (origin && origin !== `${req.protocol}://${req.get("host")}`)
          throw error(403, "Недопустимый источник запроса");
        if (!req.is("application/json")) throw error(415, "Ожидается JSON");
      }
      const token = cookie(req);
      req.user = null;
      if (token) {
        const session = await store.get("sessions", hash(token));
        if (session && session.expires > Date.now())
          req.user = await store.get("users", session.userId);
      }
      next();
    } catch (e) {
      next(e);
    }
  });
  const wrap = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res)).catch(next);
  const auth = (req) => {
    if (!req.user) throw error(401, "Войдите, чтобы продолжить");
    return req.user;
  };
  const moderator = (req) => {
    const u = auth(req);
    if (
      !process.env.ADMIN_EMAIL ||
      u.email !== process.env.ADMIN_EMAIL.toLowerCase()
    )
      throw error(403, "Нужны права модератора");
    return u;
  };
  const setSession = async (req, res, user) => {
    const token = randomBytes(32).toString("hex");
    await store.set("sessions", hash(token), {
      userId: user.id,
      expires: Date.now() + 30 * 86400000,
    });
    res.cookie("biom_session", token, {
      httpOnly: true,
      sameSite: "lax",
      secure: production,
      maxAge: 30 * 86400000,
      path: "/",
    });
  };
  const authLimit = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "Слишком много попыток. Попробуйте через 15 минут." },
  });
  await Promise.all(people.map((p) => store.insert("profiles", p.id, p)));
  for (const p of seedPosts()) await store.insert("posts", p.id, p);
  for (const e of seedEvents()) await store.insert("events", e.id, e);
  await store.insert("comments", "demo-comment", {
    id: "demo-comment",
    postId: "demo-post-coffee",
    authorId: "demo-anna",
    text: "Я за! Как раз искала компанию на кофе ☕",
    createdAt: Date.now() - 20 * 60000,
  });
  app.get(
    "/api/health",
    wrap(async (req, res) => {
      await store.get("settings", "health");
      res.json({ ok: true, storage: store.type });
    }),
  );
  app.post(
    "/api/auth/register",
    authLimit,
    wrap(async (req, res) => {
      const data = z
        .object({
          email: z
            .string()
            .trim()
            .email()
            .max(254)
            .transform((x) => x.toLowerCase()),
          password: z.string().min(8).max(128),
          profile: profileFields,
        })
        .parse(req.body);
      const salt = randomBytes(16).toString("hex");
      const derived = await scrypt(data.password, salt, 64);
      const id = randomUUID();
      const user = {
        id,
        email: data.email,
        password: `${salt}:${derived.toString("hex")}`,
        createdAt: Date.now(),
      };
      const reserved = await store.insert("emails", data.email, { id });
      if (!reserved) throw error(409, "Этот email уже зарегистрирован");
      try {
        await store.set("users", id, user);
        await store.set("profiles", id, {
          ...data.profile,
          id,
          demo: false,
          avatar: null,
          color: "#e5e8ff",
        });
      } catch (e) {
        await store.remove("emails", data.email);
        throw e;
      }
      await setSession(req, res, user);
      res.status(201).json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/login",
    authLimit,
    wrap(async (req, res) => {
      const data = z
        .object({
          email: z
            .string()
            .trim()
            .email()
            .max(254)
            .transform((x) => x.toLowerCase()),
          password: z.string().min(1).max(128),
        })
        .parse(req.body);
      const email = await store.get("emails", data.email);
      const user = email ? await store.get("users", email.id) : null;
      const [salt, key] = (
        user?.password ||
        "00000000000000000000000000000000:" + Buffer.alloc(64).toString("hex")
      ).split(":");
      const check = await scrypt(data.password, salt, 64);
      if (!user || !timingSafeEqual(check, Buffer.from(key, "hex")))
        throw error(401, "Неверный email или пароль");
      await setSession(req, res, user);
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/auth/logout",
    wrap(async (req, res) => {
      await store.remove("sessions", hash(cookie(req)));
      res.clearCookie("biom_session", { path: "/" });
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/data",
    wrap(async (req, res) => {
      const uid = req.user?.id;
      const [
        profiles,
        posts,
        comments,
        likes,
        saved,
        blocks,
        events,
        joins,
        messages,
      ] = await Promise.all(
        [
          "profiles",
          "posts",
          "comments",
          "likes",
          "saved",
          "blocks",
          "events",
          "joins",
          "messages",
        ].map((k) => store.all(k)),
      );
      const blocked = new Set(
        blocks.filter((b) => b.userId === uid).map((b) => b.targetId),
      );
      const isModerator =
        !!uid &&
        !!process.env.ADMIN_EMAIL &&
        req.user.email === process.env.ADMIN_EMAIL.toLowerCase();
      const allowedPosts = posts.filter(
        (p) => !p.hidden && !blocked.has(p.authorId),
      );
      res.set("Cache-Control", "no-store");
      res.json({
        me: profiles.find((p) => p.id === uid) || null,
        isModerator,
        people: profiles.filter((p) => p.id !== uid && !blocked.has(p.id)),
        posts: allowedPosts
          .map((p) => ({
            ...p,
            likes: p.baseLikes + likes.filter((l) => l.postId === p.id).length,
            liked: likes.some((l) => l.postId === p.id && l.userId === uid),
            saved: saved.some((s) => s.postId === p.id && s.userId === uid),
            comments: comments
              .filter(
                (c) =>
                  c.postId === p.id && !c.hidden && !blocked.has(c.authorId),
              )
              .sort((a, b) => a.createdAt - b.createdAt),
          }))
          .sort((a, b) => b.createdAt - a.createdAt),
        events: events
          .sort((a, b) => a.date - b.date)
          .map((e) => ({
            ...e,
            attendees:
              e.baseAttendees + joins.filter((j) => j.eventId === e.id).length,
            joined: joins.some((j) => j.eventId === e.id && j.userId === uid),
          })),
        unread: messages.filter((m) => m.to === uid && !m.read).length,
        interests,
        cities,
      });
    }),
  );
  app.post(
    "/api/profile",
    wrap(async (req, res) => {
      const u = auth(req);
      const data = profileFields.parse(req.body);
      if (data.avatar && !/^\/api\/media\/[a-f0-9-]+$/.test(data.avatar))
        throw error(400, "Недопустимое фото");
      const old = await store.get("profiles", u.id);
      await store.set("profiles", u.id, {
        ...old,
        ...data,
        id: u.id,
        demo: false,
      });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/posts",
    wrap(async (req, res) => {
      const u = auth(req);
      const data = z
        .object({
          text: nonempty(2000),
          interest: z.enum(interests),
          image: z.string().nullable().optional(),
        })
        .parse(req.body);
      if (data.image && !/^\/api\/media\/[a-f0-9-]+$/.test(data.image))
        throw error(400, "Недопустимое фото");
      const p = await store.get("profiles", u.id);
      const post = {
        ...data,
        id: randomUUID(),
        authorId: u.id,
        city: p.city,
        district: p.district,
        createdAt: Date.now(),
        baseLikes: 0,
        hidden: false,
      };
      await store.set("posts", post.id, post);
      res.status(201).json({ id: post.id });
    }),
  );
  app.post(
    "/api/posts/:id/:action",
    wrap(async (req, res) => {
      const u = auth(req);
      const p = await store.get("posts", req.params.id);
      if (!p || p.hidden) throw error(404, "Публикация не найдена");
      const action = req.params.action;
      if (action === "like" || action === "save") {
        const table = action === "like" ? "likes" : "saved";
        const id = `${u.id}:${p.id}`;
        const data = z.object({ active: z.boolean() }).parse(req.body);
        if (data.active)
          await store.set(table, id, { userId: u.id, postId: p.id });
        else await store.remove(table, id);
      } else if (action === "comment") {
        const { text } = z.object({ text: nonempty(600) }).parse(req.body);
        const comment = {
          id: randomUUID(),
          postId: p.id,
          authorId: u.id,
          text,
          createdAt: Date.now(),
        };
        await store.set("comments", comment.id, comment);
      } else if (action === "delete") {
        if (p.authorId !== u.id)
          throw error(403, "Можно удалить только свою запись");
        await store.set("posts", p.id, { ...p, hidden: true });
      } else if (action === "report") {
        const { reason } = z
          .object({
            reason: z.enum([
              "Спам",
              "Оскорбления",
              "Опасный контент",
              "Другое",
            ]),
          })
          .parse(req.body);
        await store.set("reports", `${u.id}:${p.id}`, {
          id: `${u.id}:${p.id}`,
          postId: p.id,
          userId: u.id,
          reason,
          status: "pending",
          createdAt: Date.now(),
        });
      } else throw error(404, "Действие не найдено");
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/block",
    wrap(async (req, res) => {
      const u = auth(req);
      const { targetId, active } = z
        .object({ targetId: nonempty(100), active: z.boolean() })
        .parse(req.body);
      if (targetId === u.id) throw error(400, "Нельзя заблокировать себя");
      if (!(await store.get("profiles", targetId)))
        throw error(404, "Профиль не найден");
      if (active)
        await store.set("blocks", `${u.id}:${targetId}`, {
          userId: u.id,
          targetId,
        });
      else await store.remove("blocks", `${u.id}:${targetId}`);
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/blocks",
    wrap(async (req, res) => {
      const u = auth(req);
      const blocks = (await store.all("blocks")).filter(
        (b) => b.userId === u.id,
      );
      res.json(
        await Promise.all(blocks.map((b) => store.get("profiles", b.targetId))),
      );
    }),
  );
  app.post(
    "/api/events/:id/join",
    wrap(async (req, res) => {
      const u = auth(req);
      if (!(await store.get("events", req.params.id)))
        throw error(404, "Встреча не найдена");
      const { active } = z.object({ active: z.boolean() }).parse(req.body);
      const id = `${u.id}:${req.params.id}`;
      if (active)
        await store.set("joins", id, { userId: u.id, eventId: req.params.id });
      else await store.remove("joins", id);
      res.json({ ok: true });
    }),
  );
  app.get(
    "/api/messages",
    wrap(async (req, res) => {
      const u = auth(req);
      const blocks = await store.all("blocks");
      const blocked = new Set(
        blocks
          .filter((b) => b.userId === u.id || b.targetId === u.id)
          .map((b) => (b.userId === u.id ? b.targetId : b.userId)),
      );
      const all = (await store.all("messages"))
        .filter(
          (m) =>
            (m.from === u.id || m.to === u.id) &&
            !blocked.has(m.from === u.id ? m.to : m.from),
        )
        .sort((a, b) => a.createdAt - b.createdAt);
      res.set("Cache-Control", "no-store");
      res.json(all);
    }),
  );
  app.post(
    "/api/messages",
    wrap(async (req, res) => {
      const u = auth(req);
      const { to, text } = z
        .object({ to: nonempty(100), text: nonempty(2000) })
        .parse(req.body);
      const person = await store.get("profiles", to);
      if (!person || to === u.id) throw error(400, "Получатель не найден");
      if (person.demo)
        throw error(
          400,
          "Это демопрофиль. Для переписки пригласите друга в Biom.",
        );
      if (
        (await store.get("blocks", `${to}:${u.id}`)) ||
        (await store.get("blocks", `${u.id}:${to}`))
      )
        throw error(403, "Переписка недоступна");
      const message = {
        id: randomUUID(),
        from: u.id,
        to,
        text,
        createdAt: Date.now(),
        read: false,
      };
      await store.set("messages", message.id, message);
      res.status(201).json(message);
    }),
  );
  app.post(
    "/api/messages/read",
    wrap(async (req, res) => {
      const u = auth(req);
      const { from } = z.object({ from: nonempty(100) }).parse(req.body);
      for (const m of await store.all("messages"))
        if (m.from === from && m.to === u.id && !m.read)
          await store.set("messages", m.id, { ...m, read: true });
      res.json({ ok: true });
    }),
  );
  app.post(
    "/api/upload",
    wrap(async (req, res) => {
      const u = auth(req);
      const { data } = z
        .object({ data: z.string().max(7 * 1024 * 1024) })
        .parse(req.body);
      const match = data.match(
        /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/,
      );
      if (!match) throw error(400, "Выберите JPG, PNG или WebP");
      const bytes = Buffer.from(match[2], "base64");
      if (bytes.length > 5 * 1024 * 1024)
        throw error(400, "Фото должно быть меньше 5 МБ");
      const valid =
        match[1] === "jpeg"
          ? bytes[0] === 255 && bytes[1] === 216
          : match[1] === "png"
            ? bytes
                .subarray(0, 8)
                .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
            : bytes.toString("ascii", 0, 4) === "RIFF" &&
              bytes.toString("ascii", 8, 12) === "WEBP";
      if (!valid) throw error(400, "Формат фото не распознан");
      const id = randomUUID();
      await store.set("media", id, {
        data: match[2],
        mime: `image/${match[1]}`,
        ownerId: u.id,
      });
      res.json({ url: `/api/media/${id}` });
    }),
  );
  app.get(
    "/api/media/:id",
    wrap(async (req, res) => {
      const media = await store.get("media", req.params.id);
      if (!media) throw error(404, "Фото не найдено");
      res.set({
        "Content-Type": media.mime,
        "Cache-Control": "public,max-age=86400",
        "X-Content-Type-Options": "nosniff",
      });
      res.send(Buffer.from(media.data, "base64"));
    }),
  );
  app.get(
    "/api/moderation",
    wrap(async (req, res) => {
      moderator(req);
      const reports = await store.all("reports");
      const result = [];
      for (const r of reports)
        result.push({ ...r, post: await store.get("posts", r.postId) });
      res.json(result.sort((a, b) => b.createdAt - a.createdAt));
    }),
  );
  app.post(
    "/api/moderation/:id",
    wrap(async (req, res) => {
      moderator(req);
      const { action } = z
        .object({ action: z.enum(["hide", "dismiss", "restore"]) })
        .parse(req.body);
      const r = await store.get("reports", req.params.id);
      if (!r) throw error(404, "Жалоба не найдена");
      const p = await store.get("posts", r.postId);
      if (p && action !== "dismiss")
        await store.set("posts", p.id, { ...p, hidden: action === "hide" });
      await store.set("reports", r.id, {
        ...r,
        status: action,
        reviewedAt: Date.now(),
      });
      res.json({ ok: true });
    }),
  );
  app.use("/api", (req, res) => res.status(404).json({ error: "Не найдено" }));
  app.use((e, req, res, next) => {
    if (e instanceof z.ZodError)
      return res.status(400).json({
        error:
          e.issues[0]?.message === "Выберите город и район из списка"
            ? "Выберите город и район из списка"
            : "Проверьте заполненные поля: имя, email, пароль от 8 символов и хотя бы один интерес.",
      });
    if (e.type === "entity.too.large")
      return res.status(413).json({ error: "Файл слишком большой" });
    if (!e.status) console.error("Request failed:", e.message);
    res.status(e.status || 500).json({
      error: e.status
        ? e.message
        : "Не удалось выполнить запрос. Попробуйте ещё раз.",
    });
  });
  return app;
}
