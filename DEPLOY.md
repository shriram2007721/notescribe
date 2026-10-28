# Running the NoteScribe CI/CD pipeline (free, no credit card)

Everything runs inside **Azure DevOps** (dev.azure.com), which is free for up to 5 users.
**No Azure subscription and no payment details are needed.**

| Stage | What it does |
|---|---|
| **CI** | Install → ESLint → TypeScript check → build → verify output → save artifact |
| **CD** | Waits for **Approve** → packages a versioned release `.zip` + checksum → publishes it |

## 1. Create the project
1. Go to **https://dev.azure.com** and sign in with a **personal** Microsoft account (a college account may be blocked).
2. Create an organization if asked, then **+ New project** → `NoteScribe` → **Private** → **Create**.

## 2. Push the code (Azure Repos)
1. In the project, go to **Repos → Files**. Copy the HTTPS clone URL.
2. Click **Generate Git Credentials** and copy the password it shows.
3. In a terminal, from the `notescribe` folder:
   ```bash
   git remote add origin <the clone URL>
   git push -u origin main
   ```
   When asked, paste the password from step 2.

## 3. Give the pipeline a machine to run on
New organizations have no free cloud build time until Microsoft approves it. Pick **one** option:

- **Option A: request free cloud build time.** Fill in https://aka.ms/azpipelines-parallelism-request (no card needed). It takes 2–3 business days.
- **Option B: use your own PC now (free, no waiting).**
  1. **Project settings → Agent pools → Default → New agent → Windows** → follow the download and `config.cmd` steps.
     Create the Personal Access Token it asks for via **User settings → Personal access tokens** (scope: *Agent Pools: Read & manage*).
  2. Start the agent with `run.cmd`.
  3. In `azure-pipelines.yml`, replace
     ```yaml
     pool:
       vmImage: ubuntu-latest
     ```
     with
     ```yaml
     pool:
       name: Default
     ```
     Your PC needs Node.js 20+ and Git installed.

## 4. Create the pipeline
1. **Pipelines → New pipeline → Azure Repos Git → NoteScribe → Existing Azure Pipelines YAML file → `/azure-pipelines.yml`** → **Run**.
2. CI runs. The CD stage then waits on the `notescribe-production` environment.
3. Set up the approval gate and the branch policy using **GOVERNANCE.md**.

## 5. Get the release
Open a finished run → **1 published** / **Artifacts** → download `release` → `notescribe-<build>.zip`.
Unzip it and serve the folder with any static server (e.g. `npx serve`) to run the app.
