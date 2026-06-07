export const BORUTA_FEATURE_TREE_PROJECT_KEY = 'boruta-server-feature-tree'
export const BORUTA_FEATURE_TREE_VERSION = 'technical-business-logic-v3'

const BORUTA_FEATURE_TREE = {
  text: 'Boruta vision: one authority for identity, authorization, credentials, and protected traffic',
  children: [
    {
      text: 'Authorize every actor through standard protocol entry points',
      children: [
        {
          text: 'Normalize and validate the incoming authorization request',
          children: [
            { text: 'Parse client_id, redirect_uri, response_type, scope, state, nonce, code_challenge, prompt, and resource parameters' },
            { text: 'Resolve request_uri when the client uses pushed authorization request state' },
            { text: 'Load the client and reject unknown or disabled client identifiers' },
            { text: 'Match redirect_uri against registered client redirect values before any redirect response is trusted' },
            { text: 'Validate response_type against the client grant and OpenID capabilities' },
            { text: 'Validate requested scopes against client policy and registered scope records' },
            { text: 'Validate PKCE code_challenge and method for public-client authorization code flows' },
            { text: 'Preserve state and nonce as replay and client-correlation inputs for the final response' },
            { text: 'Return protocol-shaped OAuth errors for invalid_request, unauthorized_client, invalid_scope, or unsupported_response_type cases' }
          ]
        },
        {
          text: 'Resolve the resource-owner authentication context',
          children: [
            { text: 'Fetch the current Phoenix session and map it to a Boruta identity user/resource owner' },
            { text: 'Evaluate prompt and session policy to decide whether existing authentication is reusable' },
            { text: 'Redirect unauthenticated users to identity-provider login while preserving the original authorization request' },
            { text: 'Route users through choose-session when multiple authenticated identity contexts are available' },
            { text: 'Apply identity-provider assurance policy before accepting the session for authorization' },
            { text: 'Resume the authorization request after login, federation callback, TOTP, WebAuthn, or session selection' }
          ]
        },
        {
          text: 'Evaluate consent and scope grantability',
          children: [
            { text: 'Compute effective scopes from requested scopes, client policy, user roles, organizations, and existing consent' },
            { text: 'Detect whether consent can be skipped or must be explicitly collected from the user' },
            { text: 'Render consent with human-readable scope labels and client context' },
            { text: 'Persist accepted user consent for the client and scope set when policy allows reuse' },
            { text: 'Reject or downgrade unauthorized scopes before any code, token, or ID token is minted' },
            { text: 'Return access_denied when the user refuses required consent' }
          ]
        },
        {
          text: 'Materialize authorization response artifacts',
          children: [
            { text: 'Create authorization code records bound to client, resource owner, redirect URI, scopes, nonce, PKCE challenge, and expiration' },
            { text: 'Issue implicit or hybrid access token artifacts only after the same policy checks succeed' },
            { text: 'Issue ID token artifacts with OpenID claims and nonce when response_type requires OpenID output' },
            { text: 'Redirect to the validated redirect_uri with code, token, id_token, state, or OAuth error parameters' },
            { text: 'Keep authorization request records available for the later token endpoint exchange' }
          ]
        },
        {
          text: 'Handle pushed authorization request as a pre-authorization object',
          children: [
            { text: 'Authenticate or identify the client submitting the PAR payload' },
            { text: 'Validate the submitted authorization parameters before storing them' },
            { text: 'Persist request object state and return a request_uri plus expiration' },
            { text: 'Require the front-channel authorize call to reference the stored request_uri' },
            { text: 'Reduce URL leakage by keeping sensitive authorization details out of browser query strings' }
          ]
        }
      ]
    },
    {
      text: 'Exchange validated grants into signed authorization artifacts',
      children: [
        {
          text: 'Authenticate the client at the token endpoint',
          children: [
            { text: 'Parse client authentication from Basic auth, request body credentials, or assertion-based inputs' },
            { text: 'Load the client and verify the configured secret, key material, or assertion trust requirements' },
            { text: 'Reject grant execution when the client is unknown, disabled, unauthenticated, or not allowed for the grant type' },
            { text: 'Apply DPoP proof validation when the request is proof-of-possession bound' }
          ]
        },
        {
          text: 'Execute authorization_code grant',
          children: [
            { text: 'Load the authorization code record and verify it has not expired or already been consumed' },
            { text: 'Ensure the exchanging client matches the client bound to the code' },
            { text: 'Ensure redirect_uri matches the redirect URI recorded during authorization' },
            { text: 'Verify PKCE code_verifier against stored code_challenge for public-client flows' },
            { text: 'Consume or invalidate the code to prevent replay' },
            { text: 'Mint access token, optional refresh token, and OpenID ID token from the recorded authorization context' }
          ]
        },
        {
          text: 'Execute client_credentials grant',
          children: [
            { text: 'Use the authenticated client as the authorization subject when no human resource owner exists' },
            { text: 'Intersect requested scopes with the client allowed-scope set' },
            { text: 'Reject scopes outside the service or partner contract' },
            { text: 'Mint access token for machine-to-machine API consumption' },
            { text: 'Avoid user claims because the grant represents the client rather than a person' }
          ]
        },
        {
          text: 'Execute password and refresh_token grants',
          children: [
            { text: 'Password grant verifies resource-owner credentials through the configured account backend' },
            { text: 'Password grant applies client and scope policy before minting tokens' },
            { text: 'Refresh token grant loads existing refresh token state and verifies client binding' },
            { text: 'Refresh token rotation invalidates old refresh material when rotation is enabled' },
            { text: 'Refresh token revocation prevents extending compromised or terminated sessions' }
          ]
        },
        {
          text: 'Execute assertion and preauthorized code grants',
          children: [
            { text: 'JWT bearer assertions validate issuer, subject, audience, signature, expiration, and client trust' },
            { text: 'Client assertion authentication validates signed client identity before grant execution' },
            { text: 'Preauthorized code grant resolves issuer-prepared credential issuance state' },
            { text: 'Credential-related grants create access context for wallet credential endpoints' },
            { text: 'Invalid assertion, expired code, or mismatched client state fails before token minting' }
          ]
        },
        {
          text: 'Generate, sign, and persist token artifacts',
          children: [
            { text: 'Access tokens carry subject, client, scopes, timestamps, and authorization context' },
            { text: 'ID tokens carry OpenID claims and nonce-sensitive authentication context' },
            { text: 'Refresh tokens keep longer-lived session continuity separate from access token lifetime' },
            { text: 'Token records preserve active, revoked, and expiration state for introspection and revocation' },
            { text: 'Signing modules centralize algorithm choice, key id, and key material usage' },
            { text: 'JWKS endpoint publishes active public signing keys to clients, gateways, and resource servers' }
          ]
        },
        {
          text: 'Introspect, revoke, and validate active authorization state',
          children: [
            { text: 'Bearer token parsing extracts access token material from protected requests' },
            { text: 'Introspection authenticates the caller before exposing token metadata' },
            { text: 'Introspection reports active, client_id, sub, scope, token_type, exp, iat, and authorization context when available' },
            { text: 'Inactive, expired, revoked, or unknown tokens return inactive state without leaking unnecessary detail' },
            { text: 'Revocation authenticates the client and invalidates access or refresh token state before natural expiration' },
            { text: 'DPoP validation binds proof-of-possession material to token use' },
            { text: 'Caches accelerate repeated authorization reads while preserving invalidation behavior' }
          ]
        }
      ]
    },
    {
      text: 'Establish resource-owner assurance before authorization decisions',
      children: [
        {
          text: 'Run local username/password authentication',
          children: [
            { text: 'Render the login template selected by identity provider configuration' },
            { text: 'Locate the internal user through backend-specific user lookup rules' },
            { text: 'Verify password against configured hashing options and stored password hash' },
            { text: 'Reject unconfirmed, disabled, or policy-ineligible users before session creation' },
            { text: 'Create browser session state consumed by subsequent OAuth authorize requests' },
            { text: 'Optionally create remember-me cookie according to configured identity cookie name' }
          ]
        },
        {
          text: 'Run LDAP and federated authentication',
          children: [
            { text: 'LDAP backend binds against enterprise directory credentials and maps directory attributes to user context' },
            { text: 'LDAP metadata and role mapping connect external accounts to Boruta claims and scope eligibility' },
            { text: 'Federated backend builds outbound authorize request to the external identity provider' },
            { text: 'Federated callback validates returned authorization result before linking or creating a local session' },
            { text: 'Federated account metadata preserves external issuer and subject information for later claims' }
          ]
        },
        {
          text: 'Apply step-up authentication and authenticator enrollment',
          children: [
            { text: 'TOTP registration stores second-factor enrollment for a user' },
            { text: 'TOTP authentication validates one-time codes before continuing the session flow' },
            { text: 'WebAuthn registration stores browser authenticator public key material' },
            { text: 'WebAuthn authentication validates passkey ceremony responses' },
            { text: 'Authentication flow branches to TOTP or WebAuthn when provider policy enforces a factor' },
            { text: 'Successful factor verification upgrades the session assurance used by authorization' },
            { text: 'Failed factor verification blocks authorization continuation without losing the original request context' }
          ]
        },
        {
          text: 'Manage account lifecycle around authentication',
          children: [
            { text: 'Registration validates user input, backend policy, organization defaults, and optional role defaults' },
            { text: 'Confirmation token issuance and consumption verifies email ownership before higher-trust flows' },
            { text: 'Password reset issues tokenized recovery, validates reset token freshness, and updates local credentials' },
            { text: 'User settings update account data used by claims and credential issuance' },
            { text: 'Logout clears session state so future authorize requests must reauthenticate or choose another session' },
            { text: 'User deletion or disabling removes future authentication eligibility and therefore future authorization' }
          ]
        },
        {
          text: 'Project authenticated account data into authorization claims',
          children: [
            { text: 'User records provide subject, profile, email, and custom metadata claims for ID token and userinfo output' },
            { text: 'Role assignments determine which scopes a user can receive through business policy' },
            { text: 'Organization membership models tenant or business-unit context' },
            { text: 'Stored consents remember user-approved scope decisions for client interactions' },
            { text: 'Backend metadata and user metadata enrich downstream identity claims' }
          ]
        }
      ]
    },
    {
      text: 'Represent access policy as composable domain objects',
      children: [
        {
          text: 'Client policy defines what an integration is allowed to do',
          children: [
            { text: 'Client records model applications, partners, services, wallets, and the admin console' },
            { text: 'Grant-type settings restrict which OAuth flows a client may use' },
            { text: 'Redirect URI settings constrain where browser authorization responses can be delivered' },
            { text: 'Client scopes bound the maximum business permissions the client can request' },
            { text: 'Client secret, key pair, DID, and regenerated key material implement client trust lifecycle' }
          ]
        },
        {
          text: 'Scope policy defines the permission vocabulary',
          children: [
            { text: 'Scopes are the atomic authorization units requested by clients and granted to tokens' },
            { text: 'Scope labels expose protocol permissions in administrator and user-facing language' },
            { text: 'Role-scope links bundle scopes into reusable business permission sets' },
            { text: 'Gateway required-scope rules reuse the same scope vocabulary for API enforcement' }
          ]
        },
        {
          text: 'Role and organization policy define business context',
          children: [
            { text: 'Roles map users to scope bundles without duplicating permission assignments' },
            { text: 'Organizations group users into tenant, customer, department, or issuer boundaries' },
            { text: 'Organization restrictions can limit access to the administration surface' },
            { text: 'Backend defaults can create organization and role links as part of account provisioning' }
          ]
        },
        {
          text: 'Identity provider and backend policy define authentication behavior',
          children: [
            { text: 'Identity provider settings control registration, confirmation, consent, session choice, TOTP, WebAuthn, and check-password behavior' },
            { text: 'Backend settings control local, LDAP, federated, mail, SMTP, password hashing, metadata, and role defaults' },
            { text: 'Template settings customize login, consent, recovery, credential offer, and error pages' },
            { text: 'Email templates customize confirmation, reset, transaction-code, and credential-offer communications' }
          ]
        }
      ]
    },
    {
      text: 'Enforce authorization decisions at the protected traffic boundary',
      children: [
        {
          text: 'Model upstream services as protected resources',
          children: [
            { text: 'Upstream records identify protected traffic by node name, virtual host, scheme, host, port, and URI list' },
            { text: 'Authorize flag distinguishes public forwarding from protected resource enforcement' },
            { text: 'Required scopes map HTTP methods to the business permissions needed for each operation' },
            { text: 'Strip URI rewrites gateway-facing paths into upstream-facing paths' },
            { text: 'Custom unauthorized, forbidden, and error response settings define the API consumer contract' }
          ]
        },
        {
          text: 'Enforce access before forwarding traffic',
          children: [
            { text: 'Gateway selects the matching upstream policy from virtual host, scheme, host, port, URI, and node context' },
            { text: 'Gateway determines whether the matched upstream is public or authorization-protected' },
            { text: 'Authorization modules extract bearer token from the incoming request' },
            { text: 'Gateway validates token state locally or through Boruta authorization logic before proxying' },
            { text: 'Gateway compares token scopes with method-specific upstream scope requirements' },
            { text: 'Gateway returns unauthorized when authentication is missing or invalid' },
            { text: 'Gateway returns forbidden when authentication succeeds but scopes are insufficient' },
            { text: 'Rate limiting blocks excess traffic using upstream-specific count, time unit, penalty, timeout, and memory settings' },
            { text: 'mTLS settings require HTTPS configuration before certificate verification is enabled' }
          ]
        },
        {
          text: 'Pass trusted authorization context downstream',
          children: [
            { text: 'Forwarded token settings create signed context for the protected service' },
            { text: 'Forwarded token payload represents the gateway-verified subject, client, scopes, and authorization context' },
            { text: 'HS algorithms use generated or configured shared secrets' },
            { text: 'RS algorithms use generated or configured RSA key pairs' },
            { text: 'Forwarded-token key generation occurs when an upstream selects an algorithm without existing material' },
            { text: 'Protected services can trust the gateway handoff rather than reimplementing full OAuth flow logic' }
          ]
        },
        {
          text: 'Operate gateway as a distributed authorization layer',
          children: [
            { text: 'Service registry records node name, Erlang node name, IP address, aliases, certificate, and configuration' },
            { text: 'Root cluster CA and generated certificates support node-to-node trust' },
            { text: 'Periodic touch marks gateway nodes online or offline' },
            { text: 'Postgres notifications keep gateway registry state synchronized across nodes' }
          ]
        }
      ]
    },
    {
      text: 'Extend authorization into OpenID claims and decentralized credentials',
      children: [
        {
          text: 'Expose provider metadata and identity claims',
          children: [
            { text: 'OpenID configuration describes issuer, endpoints, response types, signing algorithms, and supported capabilities' },
            { text: 'JWKS exposes keys used to validate signed tokens' },
            { text: 'Userinfo returns claims for valid tokens according to authorized scope and subject context' },
            { text: 'ID token generation packages authentication context for relying parties' }
          ]
        },
        {
          text: 'Implement verifiable credential issuance',
          children: [
            { text: 'Credential issuer metadata describes supported credential issuance capabilities' },
            { text: 'Credential endpoint validates access token, credential format, credential type, holder binding, and issuer policy' },
            { text: 'Credential endpoint issues wallet-consumable credentials when token and request policy are valid' },
            { text: 'Deferred credential endpoint validates deferred issuance handle before returning final credential material' },
            { text: 'Deferred credential state keeps asynchronous issuer processing separate from token issuance' },
            { text: 'Preauthorized code flow lets an issuer prepare credential pickup before wallet interaction' },
            { text: 'Credential status resolution lets relying parties check validity after issuance' }
          ]
        },
        {
          text: 'Implement verifiable presentation and wallet flows',
          children: [
            { text: 'Presentation request creates pending verifier state for wallet-mediated authentication or proof submission' },
            { text: 'Direct post endpoint accepts wallet presentation responses for a pending presentation request' },
            { text: 'Direct post validation checks response code, presentation payload, holder binding, and request correlation' },
            { text: 'Presentation SSE endpoint streams pending, accepted, rejected, or completed state to browser flows' },
            { text: 'SIOPv2 support allows wallet-mediated identity interactions' },
            { text: 'Wallet authentication can feed the same resource-owner session and authorization continuation model' },
            { text: 'Integrated demo wallet exercises issuance and presentation flows for testing and certification' }
          ]
        },
        {
          text: 'Use DID infrastructure when decentralized identity is enabled',
          children: [
            { text: 'DID resolver base URL resolves decentralized identifiers used in signatures and credentials' },
            { text: 'DID registrar base URL creates decentralized identifiers when configured' },
            { text: 'DID services API key authorizes resolver and registrar calls' },
            { text: 'Client DID regeneration supports decentralized client identity lifecycle' }
          ]
        }
      ]
    },
    {
      text: 'Expose the authorization system as an operator-controlled policy plane',
      children: [
        {
          text: 'Manage implemented authorization objects through authenticated APIs',
          children: [
            { text: 'Clients API creates, updates, deletes, regenerates DID, and regenerates key pairs' },
            { text: 'Scopes API manages permission records consumed by tokens and gateway rules' },
            { text: 'Roles API manages bundles of scopes assigned to users or defaults' },
            { text: 'Key pairs API manages signing keys and explicit rotation' },
            { text: 'Users API manages identity records used by login and claims' },
            { text: 'Organizations API manages tenant or business-unit records' },
            { text: 'Upstreams API manages gateway authorization policy' },
            { text: 'Service registry API exposes gateway node state to operators' },
            { text: 'Logs API exposes authorization and business event history' }
          ]
        },
        {
          text: 'Import and validate declarative business configuration',
          children: [
            { text: 'Configuration loader accepts YAML configuration for repeatable environments' },
            { text: 'Schemas validate client, scope, role, backend, identity provider, organization, template, and error-template sections' },
            { text: 'Example configuration endpoint documents the expected policy shape' },
            { text: 'Upload endpoint applies validated configuration through the administration surface' }
          ]
        },
        {
          text: 'Expose operator UI for domain workflows',
          children: [
            { text: 'Dashboard summarizes requests and business events' },
            { text: 'Client screens manage application trust and key material' },
            { text: 'Scope and role screens manage permission vocabulary and bundles' },
            { text: 'Identity provider screens manage login policy, templates, backends, users, and organizations' },
            { text: 'Upstream screens manage gateway-protected resources and service registry visibility' },
            { text: 'Configuration screen supports import and export of policy-as-configuration' }
          ]
        }
      ]
    },
    {
      text: 'Operate the authority securely across deployment shapes',
      children: [
        {
          text: 'Bootstrap runtime trust and first administration access',
          children: [
            { text: 'Environment variables seed the first admin user and password' },
            { text: 'Environment variables seed the admin OAuth client id and secret' },
            { text: 'Admin OAuth base URL and admin base URL wire the admin console into Boruta authentication' },
            { text: 'Shared session cookie key and signing salt allow web, identity, and admin surfaces to share browser state' }
          ]
        },
        {
          text: 'Protect sensitive endpoints and flows',
          children: [
            { text: 'Rate limit plug protects OAuth, identity, and account routes from repeated abusive calls' },
            { text: 'CSRF protection guards browser session and form flows' },
            { text: 'Secure browser headers are applied to browser pipelines' },
            { text: 'Admin API requires authenticated administrator context before policy mutation' },
            { text: 'Optional subject and organization restrictions narrow admin access' }
          ]
        },
        {
          text: 'Support audit, retention, and incident response',
          children: [
            { text: 'Logs store request and business events for administrator review' },
            { text: 'Retention settings bound the lifetime of stored logs' },
            { text: 'Revocation stops compromised or no-longer-valid token state' },
            { text: 'Key rotation and client regeneration reduce blast radius after secret compromise' },
            { text: 'Gateway rate limits and scope rules can be tightened during abuse response' }
          ]
        },
        {
          text: 'Package the same business logic for different deployment shapes',
          children: [
            { text: 'Full release runs authorization server, admin control plane, and gateway together' },
            { text: 'Authorization-focused release exposes protocol business logic without standalone gateway focus' },
            { text: 'Admin-focused release isolates policy management from runtime traffic' },
            { text: 'Gateway-focused release deploys enforcement close to protected services' },
            { text: 'Docker, Docker Compose, release, Ansible, and cluster settings support production rollout choices' }
          ]
        }
      ]
    },
    {
      text: 'Factor reusable protocol business logic into the Boruta core dependency',
      children: [
        {
          text: 'Core package implements reusable OAuth and OpenID business rules',
          children: [
            { text: 'Authorization, token, introspection, revocation, PAR, JWKS, userinfo, credential, and direct-post applications live in the dependency' },
            { text: 'Request modules model each protocol request as validated business input' },
            { text: 'Response modules model each protocol output as explicit domain response data' },
            { text: 'Error modules keep protocol failures structured and reusable across server surfaces' }
          ]
        },
        {
          text: 'Core package provides persistence contracts',
          children: [
            { text: 'Adapters abstract clients, scopes, access tokens, codes, agent tokens, requests, credentials, and preauthorized codes' },
            { text: 'Ecto schemas provide default storage for OAuth clients, scopes, tokens, authorization requests, and credentials' },
            { text: 'Admin contexts expose core clients, scopes, users, and tokens to higher-level control planes' },
            { text: 'Cache modules support fast and distributed lookup of authorization state' }
          ]
        },
        {
          text: 'boruta-server composes the core package into a full product',
          children: [
            { text: 'boruta_auth app wraps the external boruta package inside the umbrella' },
            { text: 'boruta_web exposes protocol endpoints backed by core applications' },
            { text: 'boruta_identity supplies human account and authentication policy around core resource owners' },
            { text: 'boruta_admin exposes management workflows around the core objects' },
            { text: 'boruta_gateway consumes issued token decisions to enforce access on protected traffic' }
          ]
        }
      ]
    }
  ]
}

export const BORUTA_FEATURE_TREE_NODES = flattenFeatureTree(BORUTA_FEATURE_TREE)

function flattenFeatureTree (node, parent = null, nodes = []) {
  nodes.push({
    parent: parent ? { text: parent.text } : null,
    text: node.text
  })

  const children = node.children || []
  children.forEach(child => flattenFeatureTree(child, node, nodes))

  return nodes
}
