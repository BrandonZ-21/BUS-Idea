# Square integration – setup checklist (things only you can do)

Do these **in order**. Run every command in a terminal opened in the `BUS-Idea` folder
(in the Claude app: Terminal panel → new tab). In PowerShell always type `npx.cmd`, not `npx`.

> **Local testing is Sandbox only.** Use a Square *Developer* account made with your own email.
> Never sign in with, or copy anything from, your workplace's Square account. Production keys are
> only for the deployed site, set as Cloudflare secrets during the separately approved go-live
> (see `ACCOUNTS_SETUP.md`). Never put Production keys in `.dev.vars`: the code refuses to run
> when the app ID doesn't match `SQUARE_ENVIRONMENT`.

---

## 1. Create your local secrets file

Copy the example (names only) to the real file, which git ignores:

```powershell
Copy-Item .dev.vars.example .dev.vars
```

Open `.dev.vars` in Notepad (`notepad .dev.vars`). You'll fill it in during steps 2–3.
Never paste these values into chat, commits, screenshots or any other file.

## 2. Generate the two random keys

Run this **twice** — once for `TOKEN_ENCRYPTION_KEY`, once for `STATE_SIGNING_KEY`
(they must be different):

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Paste each output after the `=` on its line in `.dev.vars`, save, then clear the terminal (`cls`).

## 3. Square Developer Console: app + credentials

1. Go to <https://developer.squareup.com/apps> and sign in / sign up (free) with **your own** email.
2. Create an application (any name, e.g. "Tally dev") or open your existing one.
3. Switch the toggle at the top to **Sandbox**.
4. **Credentials** page → copy the *Sandbox Application ID* (starts `sandbox-sq0idb-`) into
   `SQUARE_APPLICATION_ID`. Skip the "Sandbox Access token" — Tally doesn't use it.
5. **OAuth** page (still Sandbox) → *Sandbox Application secret* → **Replace** if it says "None",
   then copy it into `SQUARE_APPLICATION_SECRET`. Save `.dev.vars`.

## 4. Add the redirect URL (OAuth page, Sandbox tab)

Still in Sandbox: left menu → **OAuth** → **Redirect URL** → enter exactly:

```
http://localhost:8788/api/square/callback
```

Square's Sandbox allows `http://localhost` for testing
([walkthrough](https://developer.squareup.com/docs/oauth-api/walkthrough)). It must match exactly
— no trailing slash. If the console rejects it, tell Claude; the fallback is testing on the
deployed `https://…pages.dev` URL from step 7.

Later, to test the *deployed* site in Sandbox, change it to
`https://bus-idea.pages.dev/api/square/callback`.

## 5. Sandbox test seller account

1. In the Developer Console left menu: **Sandbox test accounts**. A *Default Test Account* already
   exists; you can use it, or click **New sandbox test account** (name it, pick United States,
   **Create**). Up to 10 are allowed, all free.
2. Click **Square Dashboard** next to that account. This opens the fake seller's dashboard.
   **Keep that tab open** whenever you test "Connect Square" — Square's Sandbox needs it open in
   the same browser to approve the connection.
3. Optional: make a few test sales in that dashboard so a sync has something to read.

## 6. Try Connect Square locally

```powershell
npm run db:migrate:local
npm run dev
```

1. Make sure the Sandbox test account's **Square Dashboard** tab (step 5) is open in the same browser.
2. Open <http://localhost:8788> → scroll to **Connect Square** (Home page, or My Data once you
   have data) → **Connect Square**.
3. Square's Sandbox page asks you to allow read-only access → **Allow**.
4. You land back in Tally ("Connected to Square…") and the first sync (last 90 days) starts by
   itself. Afterwards use **Sync now** for new sales, or **Disconnect** to end access.

Press `Ctrl+C` in the terminal to stop the server. If something fails, the server window shows
a one-line reason (never any token or secret).

## 7. Before any real deploy

1. ✅ **Pages project created:** `bus-idea` → <https://bus-idea.pages.dev> (Git-connected,
   output directory `public`). Must stay a **Pages** project — not a Worker.
2. **Create the tables in the cloud database** (asks to confirm; applies every file in
   `migrations/` that hasn't run there yet):
   ```powershell
   npm run db:migrate:remote
   ```
3. **Set each secret** — each command asks you to type/paste the value at a hidden prompt:
   ```powershell
   npx.cmd wrangler pages secret put SQUARE_APPLICATION_ID --project-name bus-idea
   npx.cmd wrangler pages secret put SQUARE_APPLICATION_SECRET --project-name bus-idea
   npx.cmd wrangler pages secret put TOKEN_ENCRYPTION_KEY --project-name bus-idea
   npx.cmd wrangler pages secret put STATE_SIGNING_KEY --project-name bus-idea
   ```
   Use **new** random keys for the deployed site (run step 2's command again) rather than reusing
   your local ones.
4. Update the Sandbox redirect URL (step 4) to the deployed URL when you test there.
5. Never set `SQUARE_API_BASE_OVERRIDE` on Cloudflare — it exists only for the local fake-Square
   test, and the code ignores anything that isn't `http://localhost`/`127.0.0.1` anyway.

---

### What lives where

| File | In git? | Contains |
|---|---|---|
| `.dev.vars.example` | yes | variable **names** only |
| `.dev.vars` | **no** (ignored) | your local secret values |
| `wrangler.jsonc` | yes | project name, D1 binding/ID — no secrets |
| `.wrangler/` | **no** (ignored) | local copy of the database |
| Cloudflare secrets | n/a | set with `wrangler pages secret put`, never stored in files |
