# Square integration – setup checklist (things only you can do)

Do these **in order**. Run every command in a terminal opened in the `BUS-Idea` folder
(in the Claude app: Terminal panel → new tab). In PowerShell always type `npx.cmd`, not `npx`.

> **Sandbox only.** Use a Square *Developer* account made with your own email. Never sign in
> with, or copy anything from, your workplace's Square account. Never use the **Production** tab.

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
2. Create an application (any name, e.g. "Counter dev") or open your existing one.
3. Switch the toggle at the top to **Sandbox**.
4. **Credentials** page → copy the *Sandbox Application ID* into `SQUARE_APPLICATION_ID` and the
   *Sandbox Application secret* into `SQUARE_APPLICATION_SECRET` in `.dev.vars`. Save.

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
`https://<your-project>.pages.dev/api/square/callback` (see step 7 for the real name).

## 5. Sandbox test seller account

1. In the Developer Console left menu: **Sandbox test accounts**. A *Default Test Account* already
   exists; you can use it, or click **New sandbox test account** (name it, pick United States,
   **Create**). Up to 10 are allowed, all free.
2. Click **Square Dashboard** next to that account. This opens the fake seller's dashboard.
   **Keep that tab open** whenever you test "Connect Square" — Square's Sandbox needs it open in
   the same browser to approve the connection.
3. Optional: make a few test sales in that dashboard so a sync has something to read.

## 6. Check it runs locally

```powershell
npm run db:migrate:local
npm run dev
```

Open <http://localhost:8788>. The app should load; <http://localhost:8788/api/square/status>
answers `not_implemented` until the build step. Press `Ctrl+C` to stop.

## 7. Before any real deploy

1. **Create the Pages project** (none exists yet for this app): Cloudflare dashboard →
   Workers & Pages → Create → Pages → Connect to Git → `BUS-Idea`. Build command: *blank*.
   **Build output directory: `public`**. Name it `bus-idea` to match `wrangler.jsonc`
   (if the name's taken, use the name Cloudflare gives you and update `"name"` in `wrangler.jsonc`).
   Your URL will be `https://<that-name>.pages.dev`.
2. **Create the tables in the cloud database** (asks to confirm):
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

---

### What lives where

| File | In git? | Contains |
|---|---|---|
| `.dev.vars.example` | yes | variable **names** only |
| `.dev.vars` | **no** (ignored) | your local secret values |
| `wrangler.jsonc` | yes | project name, D1 binding/ID — no secrets |
| `.wrangler/` | **no** (ignored) | local copy of the database |
| Cloudflare secrets | n/a | set with `wrangler pages secret put`, never stored in files |
