# NoteScribe: DevOps governance ("process over product")

These controls ensure that **no code reaches `main`, and no build reaches production, without a human decision.**

```
 feature branch ──PR──► [Branch policy: 1 reviewer + CI must pass] ──merge──► main
                                                                            │ trigger
                                         CI stage (lint, type-check, build, artifact)
                                                                            │
                                  [Environment approval: "Approve" button]  ◄── quality gate
                                                                            │
                                         CD stage (deploy to Azure Static Web Apps)
```

Prerequisites: the repo is pushed to Azure Repos, and the pipeline has been created from `azure-pipelines.yml` and run once (see `DEPLOY.md`).

---

## Part 1: Lock `main` with a branch policy

1. Go to **Repos → Branches**.
2. Find `main`, click **⋯ (More options) → Branch policies**.
3. Under **Branch Policies**, turn on:
   - **Require a minimum number of reviewers** → **On**
     - Minimum number of reviewers: **1**
     - **Allow requestors to approve their own changes**: leave **unchecked**. This forces a second person to review. If you work alone, check it so you can approve your own PR, and state this in your report.
     - **When new changes are pushed**: select **Reset all approval votes**.
   - **Check for linked work items** → **On**, set to **Required**. This gives traceability to Azure Boards.
   - **Check for comment resolution** → **On**, set to **Required**.
   - **Limit merge types** → allow **Squash merge** only. This keeps `main` history linear.
4. Under **Build Validation**, click **+**:
   - **Build pipeline**: select the NoteScribe pipeline.
   - **Trigger**: Automatic. **Policy requirement**: **Required**. **Build expiration**: Immediately when `main` is updated.
   - Display name: `CI must pass`. Click **Save**.
5. *(Optional)* **Automatically included reviewers** → **+** → add yourself or your team, set to **Required**.

**Result:** direct pushes to `main` are rejected. Changes must go through a Pull Request that has 1 approval, a linked work item, resolved comments and a green CI run.

**Demo for your assessment:**
- Run `git push origin main` from a local change. It's rejected with *"TF402455: Pushes to this branch are not permitted"*.
- Create a branch, push, open a PR, and show the policy checklist on the PR page.

> Optional extra lock: **Repos → Branches → `main` → ⋯ → Security** → for *Contributors*, set **Force push** and **Bypass policies…** to **Deny**.

---

## Part 2: Quality gate with an environment approval

The pipeline's CD stage targets the environment `notescribe-production`. An approval check on that environment pauses the run before deploying.

1. Go to **Pipelines → Environments**.
   - If `notescribe-production` already exists (it's created automatically on the first run), open it.
   - Otherwise click **New environment** → Name `notescribe-production` → Resource **None** → **Create**.
2. In the environment, click **⋯ (top right) → Approvals and checks**.
3. Click **+ (Add check) → Approvals → Next**.
   - **Approvers**: add yourself (and/or a lecturer or teammate).
   - **Instructions to approvers**: `Verify CI passed and release notes are reviewed before approving.`
   - **Advanced**:
     - **Minimum number of approvals required**: `1`.
     - **Allow approvers to approve their own runs**: checked if you are the only approver.
   - **Timeout**: e.g. `1 day`. The run is rejected automatically if nobody approves in time.
   - Click **Create**.
4. *(Optional, stronger governance)* **+ → Business hours**, so deploys happen only within set hours. You can also add **+ → Branch control** → Allowed branches `refs/heads/main`, so only `main` can ever deploy to production.

**Result:** after CI succeeds, the run shows **"Waiting: 1 check needs approval"** on the CD stage.

**Demo for your assessment:**
- Merge a PR. CI runs, then CD pauses and an email/notification is sent.
- Open the run → **Review** → **Approve** (add a comment) → the deploy proceeds.
- Show **Pipelines → Environments → notescribe-production → Deployments** for the audit trail: who approved, when, and which commit.

---

## Part 3: End-to-end walkthrough (for screenshots)

| Step | Where | What to capture |
|---|---|---|
| 1 | Boards → Work items | Create a User Story, e.g. *"Update README"* |
| 2 | Local terminal | `git checkout -b feature/readme`, commit, `git push -u origin feature/readme` |
| 3 | Repos → Pull requests | Open PR to `main`, link the work item. Policies show *pending* |
| 4 | PR page | CI validation build turns green. Reviewer approves |
| 5 | PR page | **Complete** (squash merge) |
| 6 | Pipelines → Runs | CI stage succeeds. CD shows *Waiting for approval* |
| 7 | Run → Review | **Approve** with a comment |
| 8 | Run summary | CD succeeds. Open the `*.azurestaticapps.net` URL |
| 9 | Environments → Deployments | Audit history showing approver and commit |
