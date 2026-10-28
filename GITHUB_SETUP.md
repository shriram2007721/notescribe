# NoteScribe CI/CD on GitHub (free, no credit card)

Pipeline file: `.github/workflows/ci-cd.yml`

```
change code → Pull Request → review + CI must pass → merge to main
           → CI (lint, type-check, build) → you click "Approve" → CD (website goes live)
```

The repository must be **Public**. Approvals and branch protection are free only on public repos.

## 1. Create the repository
1. Sign up / sign in at **https://github.com** (free, works with Gmail).
2. Click **+** (top right) → **New repository**.
   - Name: `notescribe`
   - **Public**
   - Do **not** add a README, .gitignore or license.
   - **Create repository**.

## 2. Upload the code
From the `notescribe` folder:
```bash
git remote add origin https://github.com/<your-username>/notescribe.git
git push -u origin main
```
A browser window asks you to sign in to GitHub the first time.

## 3. Turn on GitHub Pages
Repo → **Settings → Pages** → under **Build and deployment → Source**, choose **GitHub Actions**.

## 4. Quality gate: approval before deploy
1. Repo → **Settings → Environments** → click **github-pages** (or **New environment** named `github-pages`).
2. Tick **Required reviewers** → add **yourself** → **Save protection rules**.
3. Leave **Prevent self-review** unticked if you're the only reviewer.

Now every deploy pauses with **"Waiting for review"** until you click **Review deployments → Approve and deploy**.

## 5. Branch protection: lock `main`
Repo → **Settings → Branches → Add classic branch protection rule**:
- Branch name pattern: `main`
- ✅ **Require a pull request before merging** → **Require approvals: 1**
  - ✅ Dismiss stale pull request approvals when new commits are pushed
- ✅ **Require status checks to pass before merging** → search for and add **`CI: Build & Test`**
  (it appears after the pipeline has run once)
- ✅ **Do not allow bypassing the above settings**
- **Create**.

> **Working alone?** GitHub doesn't let you approve your own PR. Either add a classmate as a collaborator
> (Settings → Collaborators) to review, or leave "Require approvals" off and keep the CI check required.
> Mention this in your report.

## 6. Run it
- Go to the **Actions** tab. The push in step 2 already started a run. If it failed because Pages wasn't on yet, click **Re-run all jobs**.
- CI goes green → CD shows **Waiting** → **Review deployments → Approve and deploy**.
- The site is live at **`https://<your-username>.github.io/notescribe/`**.

## 7. Screenshots for your report
| # | Where | What to capture |
|---|---|---|
| 1 | Code tab | `.github/workflows/ci-cd.yml` |
| 2 | Actions → run | CI job green, with steps expanded (lint, type-check, build) |
| 3 | Actions → run | CD job **Waiting for review** |
| 4 | Review dialog | **Approve and deploy** |
| 5 | Run summary | Deployment succeeded, with the site URL |
| 6 | Browser | The live website |
| 7 | Settings → Branches | Protection rule on `main` |
| 8 | Terminal | `git push origin main` rejected (protected branch) |
| 9 | Pull request | PR showing required review + CI check before merge |
