# 01 — Windows Local Setup: Every Step

Follow every step in order. Do not skip a step even if it looks obvious.

## Part A — Create a safe project folder

1. Open **File Explorer**.
2. Open the drive where you want to keep the project, for example `D:`.
3. Create a new folder named `ScholarOS`.
4. Extract `rankmint-tests-v1-source.zip` inside it.
5. After extraction, confirm you can see a folder containing `package.json`, `src`, `public`, `docs`, and `supabase`.
6. Do not work directly inside the ZIP file.

A good path looks like:

```text
D:\ScholarOS\rankmint-tests-v1
```

## Part B — Install Node.js

1. Open Chrome.
2. Go to the official Node.js website: `https://nodejs.org/`.
3. Download the **LTS** version for Windows.
4. Open the downloaded installer.
5. Click **Next**.
6. Accept the licence agreement.
7. Keep the default installation location.
8. Keep all default components selected, including npm.
9. Click **Install**.
10. Click **Finish**.
11. Close all open PowerShell or Command Prompt windows so the new PATH is detected.

## Part C — Install Visual Studio Code

1. Go to `https://code.visualstudio.com/`.
2. Download the Windows installer.
3. Run it.
4. Accept the agreement.
5. During installation, enable:
   - Add “Open with Code” action to Windows Explorer file context menu.
   - Add “Open with Code” action to Windows Explorer directory context menu.
   - Add to PATH.
6. Complete the installation.
7. Open Visual Studio Code.

## Part D — Open the correct project folder

1. In Visual Studio Code, click **File**.
2. Click **Open Folder**.
3. Select the folder that directly contains `package.json`.
4. Click **Select Folder**.
5. If VS Code asks whether you trust the authors, click **Yes, I trust the authors**.
6. In the left Explorer panel, confirm you see:
   - `src`
   - `public`
   - `package.json`
   - `next.config.ts`
   - `.env.example`

If you only see one folder named `rankmint-tests-v1`, you opened the parent folder. Open the inner folder instead.

## Part E — Open the terminal

1. In VS Code, click **Terminal**.
2. Click **New Terminal**.
3. A PowerShell terminal appears at the bottom.
4. Look at the path before the cursor. It must end in the project folder.

Example:

```powershell
PS D:\ScholarOS\rankmint-tests-v1>
```

If the path is wrong, run:

```powershell
cd "D:\ScholarOS\rankmint-tests-v1"
```

Use your actual path.

## Part F — Confirm Node.js and npm

Run these commands one at a time:

```powershell
node -v
```

```powershell
npm -v
```

Both commands must show version numbers. If Windows says the command is not recognised, restart Windows once and retry. If it still fails, reinstall Node.js LTS and ensure PATH support is selected.

## Part G — Install project packages

Run:

```powershell
npm install
```

Wait until the command finishes and the terminal gives you a new prompt. A `node_modules` folder will be created automatically. Do not manually edit that folder.

Warnings about package funding are harmless. Do not run `npm audit fix --force` because forced upgrades can break the project.

## Part H — Start the app in Demo Mode

Run:

```powershell
npm run dev
```

Wait until the terminal shows a local address such as:

```text
http://localhost:3000
```

Hold the Ctrl key and click the address, or open Chrome and type:

```text
http://localhost:3000
```

You should see the ScholarOS homepage.

## Part I — Test the Demo Mode pages

Open these exact addresses one by one:

```text
http://localhost:3000/
http://localhost:3000/login/
http://localhost:3000/student/
http://localhost:3000/school/
http://localhost:3000/school/register/
http://localhost:3000/admin/
http://localhost:3000/trial/
http://localhost:3000/setup-check/
```

Expected behaviour before Supabase setup:

- A yellow Demo Mode banner appears.
- Login accepts any valid-looking email and a password of at least six characters.
- The trial examination works.
- School registration saves only in that browser’s local storage.
- Dashboards show sample data.

## Part J — Stop the local server

1. Click inside the VS Code terminal.
2. Press `Ctrl + C`.
3. If PowerShell asks whether to terminate the batch job, type `Y` and press Enter.

## Part K — Restart later

Every time you want to run the project locally:

1. Open the project folder in VS Code.
2. Open Terminal.
3. Run:

```powershell
npm run dev
```

You do not need to run `npm install` every time. Run it again only after package dependencies change or when using a fresh extracted copy.
