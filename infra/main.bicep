// NoteScribe infrastructure: one Azure Static Web App on the Free tier (no cost).
// Deploy:  az deployment group create -g <resource-group> -f infra/main.bicep
targetScope = 'resourceGroup'

@description('Name of the Static Web App (becomes part of the default *.azurestaticapps.net URL).')
param appName string = 'notescribe-${uniqueString(resourceGroup().id)}'

@description('Static Web Apps is only offered in a few regions; this hosts the metadata, content is served globally.')
@allowed(['westus2', 'centralus', 'eastus2', 'westeurope', 'eastasia'])
param location string = 'eastus2'

resource staticSite 'Microsoft.Web/staticSites@2023-01-01' = {
  name: appName
  location: location
  sku: {
    name: 'Free'
    tier: 'Free'
  }
  properties: {
    // The Azure DevOps pipeline deploys the build output with a deployment token,
    // so no repository link is configured here.
    provider: 'DevOps'
    stagingEnvironmentPolicy: 'Enabled'
    allowConfigFileUpdates: true
  }
  tags: {
    app: 'notescribe'
    costTier: 'free'
  }
}

output staticWebAppName string = staticSite.name
output defaultHostname string = 'https://${staticSite.properties.defaultHostname}'
