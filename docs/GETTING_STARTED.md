# Getting started

How to get Juris running on your own computer. It takes about five minutes, and you do not need any account, key or database: the app runs entirely on sample data in your browser.

## 1. What you need

| | Version | Check it with |
|---|---|---|
| [Node.js](https://nodejs.org) | 20.9 or newer (22 is what CI uses) | `node -v` |
| npm | Comes with Node.js | `npm -v` |
| [Git](https://git-scm.com) | Any recent version | `git --version` |
| An editor | VS Code, Cursor, WebStorm, or anything else | |

Windows, macOS and Linux all work. You need an internet connection the first time, to download the packages and fonts.

## 2. Get the code

The repository is private, so first accept the invitation GitHub emailed you. Then:

```bash
git clone https://github.com/AayushrajW/juris.git
cd juris
```

If you prefer not to use the command line, GitHub Desktop works too: **File → Clone repository** and pick `AayushrajW/juris`.

## 3. Install and run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. To stop the app, press `Ctrl + C` in the terminal.

## 4. Use the demo

The app opens in Marathi unless your browser prefers Hindi. To read it in English first, use the language button at the top right.

1. Press **Start** (**सुरू करा**).
2. A sample mobile number is already filled in. Press **Send code** (**कोड पाठवा**). No message is sent: the code is shown on the screen and filled in for you. Press **Continue** (**पुढे जा**).
3. You are in, as a sample person with three sample problems.

Things to know:

- **Language:** change it with the button at the top right (मराठी / हिन्दी / English).
- **Any Indian mobile number works.** A different number gives you a separate, empty set of data.
- **Nothing leaves your computer.** Everything is kept in your browser's storage. Signing out, or signing in with another number, wipes it.
- **Nothing is really read.** The explanations and answers are samples. See [PRODUCT_DOCUMENTATION.md](../PRODUCT_DOCUMENTATION.md) for exactly what is real and what is not.

## 5. In VS Code

1. **File → Open Folder** and choose the `juris` folder.
2. VS Code will offer to install the recommended extensions (ESLint, Tailwind CSS, Prettier, Vitest). Say yes.
3. Start the app either way:
   - **Terminal → New Terminal**, then `npm run dev`; or
   - **Run and Debug** (the play icon in the side bar) → choose **Juris: run and open in browser** → press the green arrow. Breakpoints in your code will work.
4. **Terminal → Run Task** lists the common commands (run, check everything, tests, build).

Formatting on save is turned off for this project on purpose. Run `npm run format` on the files you changed if you want Prettier to tidy them.

## 6. In another editor

Nothing here depends on VS Code.

- **Cursor / Windsurf:** the same as VS Code, including the `.vscode` settings.
- **WebStorm / IntelliJ IDEA:** open the folder, let it run `npm install`, then use the **npm** tool window and double-click `dev`. It picks up ESLint, Prettier and `.editorconfig` by itself.
- **Anything else:** open the folder, and run the commands in section 3 from a terminal.

## 7. Commands

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app for development, reloading as you edit |
| `npm run check` | Everything CI checks except the build: types, lint, app tests, database tests |
| `npm test` | App tests (about 2 seconds) |
| `npm run test:db` | Database tests (about 10 seconds; they start a small Postgres inside Node, no install needed) |
| `npm run build` then `npm run start` | Builds and serves the app the way it would run in production |
| `npm run lint` / `npm run typecheck` | The two static checks on their own |

## 8. Making a change

1. Make a branch: `git checkout -b your-name/what-you-are-doing`
2. Make your change. If you add or change any text a person sees, add it to **all three** files in `messages/` (`mr.json`, `hi.json`, `en.json`). The tests fail if one is missing.
3. Run `npm run check`. It must pass.
4. Commit, push the branch, and open a pull request on GitHub. CI runs the same checks plus a build.
5. If your change affects what the product does, update [PRODUCT_DOCUMENTATION.md](../PRODUCT_DOCUMENTATION.md) in the same pull request.

## 9. Settings

You do not need any. To change one, copy `.env.example` to `.env.local` and edit it. There are two, both simple on/off switches, and neither is a secret. They are explained in the [README](../README.md#settings).

## 10. If something goes wrong

| What you see | What to do |
|---|---|
| `Port 3000 is in use` | Something else is using it. Run `npm run dev -- -p 3001` and open <http://localhost:3001>. |
| `Unsupported engine` or odd syntax errors during install | Your Node.js is too old. Install version 22 from nodejs.org, then run `npm install` again. |
| `npm install` fails part-way | Delete the `node_modules` folder and run `npm install` again. On a company or college network, a proxy or firewall may be blocking npm. |
| The page is blank or looks broken after switching branches | Stop the app, delete the `.next` folder, and run `npm run dev` again. |
| The app keeps sending you back to the sign-in page | Clear the site's data in your browser (or use a private window) and sign in again. |
| It opens in Marathi and you want English | Use the language button at the top right. |
| A test fails only on your machine | Make sure you ran `npm install` after pulling, and that `node -v` shows 20.9 or newer. |
| Fonts fail to download when starting | The first run needs internet access to fetch two fonts. Connect and start again. |

## 11. Where things are

- [README.md](../README.md) — overview, languages, settings, how the code is laid out.
- [PRODUCT_DOCUMENTATION.md](../PRODUCT_DOCUMENTATION.md) — what works today, what is a demo, and what is not built. Read this before assuming a feature is real.
- [docs/LAUNCH_PLAN.md](LAUNCH_PLAN.md) — the plan from here to a public launch.
- [docs/AUDIT_FINDINGS.md](AUDIT_FINDINGS.md) — the audit behind the plan.
- [db/README.md](../db/README.md) — the database schema for the backend to come. The app does not use it yet.
