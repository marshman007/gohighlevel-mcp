# OAuth2 Configuration

This API uses OAuth2 for authentication. The MCP server can handle OAuth2 authentication in the following ways:

1. **Using a pre-acquired token**: You provide a token you've already obtained
2. **Using client credentials flow**: The server automatically acquires a token using your client ID and secret

## Environment Variables

### Agency-Access-Only

**Configuration Variables:**

- `OAUTH_CLIENT_ID_AGENCY_ACCESS_ONLY`: Your OAuth client ID
- `OAUTH_CLIENT_SECRET_AGENCY_ACCESS_ONLY`: Your OAuth client secret
### Location-Access

**Configuration Variables:**

- `OAUTH_CLIENT_ID_LOCATION_ACCESS`: Your OAuth client ID
- `OAUTH_CLIENT_SECRET_LOCATION_ACCESS`: Your OAuth client secret
### Location-Access-Only

**Configuration Variables:**

- `OAUTH_CLIENT_ID_LOCATION_ACCESS_ONLY`: Your OAuth client ID
- `OAUTH_CLIENT_SECRET_LOCATION_ACCESS_ONLY`: Your OAuth client secret
### Agency-Access

**Configuration Variables:**

- `OAUTH_CLIENT_ID_AGENCY_ACCESS`: Your OAuth client ID
- `OAUTH_CLIENT_SECRET_AGENCY_ACCESS`: Your OAuth client secret
## Token Caching

The MCP server automatically caches OAuth tokens obtained via client credentials flow. Tokens are cached for their lifetime (as specified by the `expires_in` parameter in the token response) minus 60 seconds as a safety margin.

When making API requests, the server will:
1. Check for a cached token that's still valid
2. Use the cached token if available
3. Request a new token if no valid cached token exists
