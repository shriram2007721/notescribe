# Deploying NoteScribe (free tier only)

Everything here costs $0:

| Piece | Service | Free allowance |
|---|---|---|
| Source control | Azure Repos | Free for up to 5 users |
| CI/CD | Azure Pipelines (`azure-pipelines.yml`) | 1 Microsoft-hosted parallel job, 1,800 min/month |
| Hosting | Azure Static Web Apps, **Free** plan (`infra/main.bicep`) | 100 GB bandwidth/month, custom domains, free SSL |

The app is fully client-side (IndexedDB, in-browser Whisper), so it needs no backend, database or paid AI service.

## 1. Create the Azure DevOps project
1. Go to https://dev.azure.com and create an organization and project (e.g. `NoteScribe`).
2. **Repos**: push this folder to the project's repository:
   ```bash
   git remote add origin https://dev.azure.com/<org>/NoteScribe/_git/NoteScribe
   git push -u origin main
   ```

> **New organizations start with no free hosted pipeline minutes.** Request them (free) at
> https://aka.ms/azpipelines-parallelism-request. Approval usually takes 2–3 business days.
> Until then you can register your own PC as a free self-hosted agent
> (Project settings → Agent pools → Default → New agent) and set `pool: name: Default` in the YAML.

## 2. Create the Static Web App (free)
With the Azure CLI (`az login` first):
```bash
az group create -n rg-notescribe -l eastus2
az deployment group create -g rg-notescribe -f infra/main.bicep
```
Or, in the Azure Portal: Create resource → Static Web App → Plan type **Free** → Deployment source **Other**.

Then copy the deployment token:
```bash
az staticwebapp secrets list -n <staticWebAppName from the output> --query properties.apiKey -o tsv
```
(Portal: Static Web App → Overview → *Manage deployment token*.)

## 3. Wire up the pipeline
1. **Pipelines → Library → + Variable group** named `notescribe-secrets`.
   Add variable `SWA_DEPLOYMENT_TOKEN` = the token, and click the lock icon to make it secret.
2. **Pipelines → New pipeline → Azure Repos Git → NoteScribe → Existing YAML file → `/azure-pipelines.yml`** → Run.
3. On the first run, approve access to the variable group and the `notescribe-production` environment when prompted.

From then on:
- **Pull requests to `main`**: lint, type-check and build.
- **Pushes to `main`**: the same checks, then deploy to `https://<name>.azurestaticapps.net`.

Optional: add an approval check to the `notescribe-production` environment (Pipelines → Environments) so each deploy waits for a click.
