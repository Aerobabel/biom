import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStore } from "../server/db.mjs";
import { createApp } from "../server/app.mjs";

test("Biom accounts, social flows, privacy, moderation and durable storage", async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "biom-test-"));
  process.env.DATA_DIR = dir;
  process.env.ADMIN_EMAIL = "admin@example.test";
  const store = await createStore();
  const app = await createApp(store);
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const request = async (route, body, cookie, extra = {}) => {
    const r = await fetch(origin + "/api" + route, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
        ...(cookie ? { Cookie: cookie } : {}),
        ...extra,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  };
  const profile = {
    name: "Тестовый сосед",
    bio: "Люблю свой район",
    city: "Москва",
    district: "Басманный",
    interests: ["Прогулки"],
  };
  let admin, user, outsider, adminId, userId, postId;
  try {
    await t.test(
      "anonymous browsing does not disclose account credentials",
      async () => {
        const r = await request("/data");
        assert.equal(r.status, 200);
        assert.equal(r.data.me, null);
        assert.equal(r.data.people.length, 6);
        assert.ok(r.data.posts.length);
        assert.ok(!JSON.stringify(r.data).includes("password"));
        assert.ok(!JSON.stringify(r.data).includes("email"));
      },
    );
    await t.test("anonymous write is refused", async () => {
      assert.equal(
        (await request("/posts", { text: "spam", interest: "Прогулки" }))
          .status,
        401,
      );
    });
    await t.test(
      "create three accounts with secure session cookies",
      async () => {
        const a = await request("/auth/register", {
          email: "admin@example.test",
          password: "test-password-123",
          profile,
        });
        assert.equal(a.status, 201);
        admin = a.cookie;
        const b = await request("/auth/register", {
          email: "user@example.test",
          password: "test-password-123",
          profile: { ...profile, name: "Второй сосед" },
        });
        assert.equal(b.status, 201);
        user = b.cookie;
        const c = await request("/auth/register", {
          email: "outsider@example.test",
          password: "test-password-123",
          profile,
        });
        outsider = c.cookie;
        const aData = (await request("/data", undefined, admin)).data;
        adminId = aData.me.id;
        userId = (await request("/data", undefined, user)).data.me.id;
        assert.equal(aData.isModerator, true);
        assert.ok(!aData.me.email);
        assert.ok(!aData.me.password);
      },
    );
    await t.test("duplicate email and wrong password are refused", async () => {
      assert.equal(
        (
          await request("/auth/register", {
            email: "ADMIN@example.test",
            password: "test-password-123",
            profile,
          })
        ).status,
        409,
      );
      assert.equal(
        (
          await request("/auth/login", {
            email: "admin@example.test",
            password: "wrong",
          })
        ).status,
        401,
      );
      assert.equal(
        (
          await request("/auth/login", {
            email: "missing@example.test",
            password: "wrong",
          })
        ).status,
        401,
      );
    });
    await t.test("location validation and profile update", async () => {
      assert.equal(
        (await request("/profile", { ...profile, city: "Bad city" }, admin))
          .status,
        400,
      );
      assert.equal(
        (
          await request(
            "/profile",
            { ...profile, name: "Сосед из Biom" },
            admin,
          )
        ).status,
        200,
      );
      assert.equal(
        (await request("/data", undefined, admin)).data.me.name,
        "Сосед из Biom",
      );
    });
    await t.test("create post and idempotent reactions", async () => {
      const r = await request(
        "/posts",
        { text: "Кто пойдёт гулять?", interest: "Прогулки" },
        admin,
      );
      assert.equal(r.status, 201);
      postId = r.data.id;
      await request(`/posts/${postId}/like`, { active: true }, user);
      await request(`/posts/${postId}/like`, { active: true }, user);
      const p = (await request("/data", undefined, user)).data.posts.find(
        (p) => p.id === postId,
      );
      assert.equal(p.likes, 1);
      assert.equal(p.liked, true);
      assert.equal(
        (await request(`/posts/${postId}/delete`, {}, user)).status,
        403,
      );
    });
    await t.test("comments and saved posts persist", async () => {
      await request(`/posts/${postId}/comment`, { text: "Я с вами!" }, user);
      await request(`/posts/${postId}/save`, { active: true }, user);
      const p = (await request("/data", undefined, user)).data.posts.find(
        (p) => p.id === postId,
      );
      assert.equal(p.comments[0].text, "Я с вами!");
      assert.equal(p.saved, true);
      assert.equal(
        (await request(`/posts/${postId}/comment`, { text: "" }, user)).status,
        400,
      );
    });
    await t.test("messages are visible only to participants", async () => {
      const r = await request(
        "/messages",
        { to: adminId, text: "Привет, сосед!" },
        user,
      );
      assert.equal(r.status, 201);
      assert.equal(
        (await request("/messages", undefined, admin)).data.length,
        1,
      );
      assert.equal(
        (await request("/messages", undefined, user)).data.length,
        1,
      );
      assert.equal(
        (await request("/messages", undefined, outsider)).data.length,
        0,
      );
      await request("/messages/read", { from: userId }, admin);
      assert.equal(
        (await request("/messages", undefined, user)).data[0].read,
        true,
      );
    });
    await t.test("demo profiles cannot receive real messages", async () => {
      assert.equal(
        (
          await request(
            "/messages",
            { to: "demo-polina", text: "Привет" },
            user,
          )
        ).status,
        400,
      );
    });
    await t.test(
      "blocks hide content and prevent direct messages in both directions",
      async () => {
        await request("/block", { targetId: adminId, active: true }, user);
        assert.ok(
          !(await request("/data", undefined, user)).data.posts.some(
            (p) => p.id === postId,
          ),
        );
        assert.equal(
          (await request("/messages", { to: adminId, text: "Привет" }, user))
            .status,
          403,
        );
        assert.equal(
          (await request("/messages", { to: userId, text: "Привет" }, admin))
            .status,
          403,
        );
        await request("/block", { targetId: adminId, active: false }, user);
      },
    );
    await t.test(
      "reports require moderator authority and hidden posts can be restored",
      async () => {
        await request(`/posts/${postId}/report`, { reason: "Спам" }, user);
        assert.equal(
          (await request("/moderation", undefined, user)).status,
          403,
        );
        const reports = (await request("/moderation", undefined, admin)).data;
        assert.equal(reports.length, 1);
        const id = encodeURIComponent(reports[0].id);
        await request("/moderation/" + id, { action: "hide" }, admin);
        assert.ok(
          !(await request("/data")).data.posts.some((p) => p.id === postId),
        );
        await request("/moderation/" + id, { action: "restore" }, admin);
        assert.ok(
          (await request("/data")).data.posts.some((p) => p.id === postId),
        );
      },
    );
    await t.test("joining a meeting is idempotent", async () => {
      await request("/events/event-walk/join", { active: true }, user);
      await request("/events/event-walk/join", { active: true }, user);
      const event = (await request("/data", undefined, user)).data.events.find(
        (e) => e.id === "event-walk",
      );
      assert.equal(event.attendees, 13);
      assert.equal(event.joined, true);
    });
    await t.test(
      "spoofed uploads and cross-origin mutations are rejected",
      async () => {
        assert.equal(
          (
            await request(
              "/upload",
              { data: "data:image/png;base64,aGVsbG8=" },
              user,
            )
          ).status,
          400,
        );
        assert.equal(
          (
            await request(
              "/posts",
              { text: "spam", interest: "Прогулки" },
              user,
              { Origin: "https://evil.example" },
            )
          ).status,
          403,
        );
      },
    );
    await t.test("logout invalidates session server-side", async () => {
      await request("/auth/logout", {}, user);
      assert.equal(
        (await request("/posts", { text: "spam", interest: "Прогулки" }, user))
          .status,
        401,
      );
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await store.close();
  }
  await t.test("SQLite survives a process restart", async () => {
    const reopened = await createStore();
    try {
      assert.equal(
        (await reopened.get("posts", postId)).text,
        "Кто пойдёт гулять?",
      );
      assert.equal(
        (await reopened.get("profiles", adminId)).name,
        "Сосед из Biom",
      );
    } finally {
      await reopened.close();
    }
  });
});
