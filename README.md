# Zeugma

A phone app for running and maintaining the household HPO Tech hyperbaric chamber. It is an installable web app (PWA) that works offline. Everything stays on the phone in IndexedDB: no account, no server.

- **Session**: a step-by-step checklist (pre-session → entering → during → ending → post-session) with a session timer, a UVC timer and a screen wake lock. Finishing it opens a pre-filled log entry.
- **Log**: session history per person, charts, monthly totals and CSV export.
- **Upkeep**: maintenance due by session count and/or days, with history and a 24 h Lysol lock.
- **Safety**: emergency cards, Call installer, contacts, the never-do list and training videos with timestamps.
- **Protocols**: your own protocols, with validation (ends at 0 kPa, air-break warnings).
- **Settings**: names, contacts, intervals, masks, cloth colours, annual service date, chiller setpoint, and backup/restore.

No build step: plain HTML, CSS and ES modules. Chart.js is bundled in `vendor/`.

## Run it locally

```bash
python3 -m http.server 8765
```

Open http://localhost:8765.

## Deploy to GitHub Pages

1. Create a new repository on github.com, for example `zeugma`. It can be public or private. Private Pages needs a paid plan.
2. Push this folder from the project directory:

   ```bash
   git init && git add . && git commit -m "Zeugma" && git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/zeugma.git
   git push -u origin main
   ```

3. On GitHub, open **Settings → Pages**. Under *Build and deployment*, choose **Deploy from a branch**, then **main** and **/ (root)**, and click **Save**.
4. After a minute or two the site is live at `https://YOUR-USERNAME.github.io/zeugma/`.

To ship changes later, commit and push again. The app loads the newest files whenever the phone is online and falls back to its offline copy when it isn't.

> The URL is public even if nobody knows it. No data is ever uploaded, because everything stays on your phone, but the app's content (checklist, contacts) can be seen by anyone who has the link.

## Install on iPhone

1. Open the GitHub Pages URL in **Safari**. It has to be Safari.
2. Tap the **Share** button, then **Add to Home Screen**, then **Add**.
3. Open Zeugma from the home-screen icon. It runs full screen and works offline.
4. In **Settings**, enter both people's names, your cloth colours and the last annual service date.
5. Do the same on the second person's phone if they want their own copy. Each phone keeps its **own separate data**. To share one history, use one phone, or move data between phones with Backup and Restore.

## Back up your data

iOS can clear a website's stored data if the phone runs very low on space, and deleting the home-screen app deletes its data. Use **Settings → Back up everything** about once a month (Home shows a reminder) and save the file to iCloud Drive or Files. **Restore from a backup** brings it back. Attached video files are not included in backups. Links are.

## Project layout

```
index.html, manifest.webmanifest, sw.js   app shell, install metadata, offline cache
css/app.css                                styles (dark, lavender LED accents)
js/app.js                                  router + timers
js/content.js                              checklist, emergency and reference text  ← edit wording here
js/maint.js                                maintenance due/overdue rules
js/views/*.js                              one file per screen
media/, icons/                             hero loop from the product video, app icons
```

If you add a new file, also add it to `ASSETS` in `sw.js` so it is available offline.
