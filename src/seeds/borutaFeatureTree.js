export const BORUTA_FEATURE_TREE_PROJECT_KEY = 'boruta-server-feature-tree'
export const BORUTA_FEATURE_TREE_VERSION = 'technical-business-logic-v8'

const BORUTA_FEATURE_TREE = {
  text: 'Boruta vision: operate a unified authorization server, identity provider, credential issuer, and gateway policy layer',
  children: [
    {
      text: 'Authorization server accepts standard OAuth/OpenID authorization requests',
      children: [
        {
          text: 'Request acceptance normalizes and validates authorization parameters',
          children: [
            { text: 'Authorization input is represented as validated protocol state before any user interaction' },
            { text: 'A shared authorization flow executes client, redirect, scope, response type, and session decisions consistently' },
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
          text: 'Authorization continuity resolves resource-owner session context',
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
          text: 'Delegated authorization evaluates consent and scope grantability',
          children: [
            { text: 'The decision context carries client, resource owner, scopes, redirect URI, nonce, and requested response mode together' },
            { text: 'Accepted authorization is represented before it is serialized into redirects, codes, tokens, or errors' },
            { text: 'Compute effective scopes from requested scopes, client policy, user roles, organizations, and existing consent' },
            { text: 'Detect whether consent can be skipped or must be explicitly collected from the user' },
            { text: 'Render consent with human-readable scope labels and client context' },
            { text: 'Persist accepted user consent for the client and scope set when policy allows reuse' },
            { text: 'Reject or downgrade unauthorized scopes before any code, token, or ID token is minted' },
            { text: 'Return access_denied when the user refuses required consent' }
          ]
        },
        {
          text: 'Successful authorization materializes response artifacts',
          children: [
            { text: 'Authorization responses serialize code, token, ID token, state, or error outputs according to the requested flow' },
            { text: 'Authorization code state is persisted behind a storage boundary so the token endpoint can consume it later' },
            { text: 'Create authorization code records bound to client, resource owner, redirect URI, scopes, nonce, PKCE challenge, and expiration' },
            { text: 'Issue implicit or hybrid access token artifacts only after the same policy checks succeed' },
            { text: 'Issue ID token artifacts with OpenID claims and nonce when response_type requires OpenID output' },
            { text: 'Redirect to the validated redirect_uri with code, token, id_token, state, or OAuth error parameters' },
            { text: 'Keep authorization request records available for the later token endpoint exchange' }
          ]
        },
        {
          text: 'Safer front-channel authorization stores pushed authorization requests',
          children: [
            { text: 'Pushed authorization payloads are stored server-side behind a request URI' },
            { text: 'The pushed authorization response returns request URI and expiration metadata to the client' },
            { text: 'Structured request state is persisted behind a storage boundary shared by authorization and token flows' },
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
      text: 'Token service exchanges validated OAuth grants into signed authorization artifacts',
      children: [
        {
          text: 'Token endpoint trust authenticates the client',
          children: [
            { text: 'Token endpoint input is normalized before grant-specific validation runs' },
            { text: 'HTTP Basic client credentials are extracted when present before falling back to other client authentication methods' },
            { text: 'Parse client authentication from Basic auth, request body credentials, or assertion-based inputs' },
            { text: 'Load the client and verify the configured secret, key material, or assertion trust requirements' },
            { text: 'Reject grant execution when the client is unknown, disabled, unauthenticated, or not allowed for the grant type' },
            { text: 'Apply DPoP proof validation when the request is proof-of-possession bound' }
          ]
        },
        {
          text: 'User-delegated token issuance uses authorization_code grant exchange',
          children: [
            { text: 'Authorization code exchange variants are represented separately from other token grants' },
            { text: 'Grant validation and token response creation run through a shared token exchange flow' },
            { text: 'Load the authorization code record and verify it has not expired or already been consumed' },
            { text: 'Ensure the exchanging client matches the client bound to the code' },
            { text: 'Ensure redirect_uri matches the redirect URI recorded during authorization' },
            { text: 'Verify PKCE code_verifier against stored code_challenge for public-client flows' },
            { text: 'Consume or invalidate the code to prevent replay' },
            { text: 'Mint access token, optional refresh token, and OpenID ID token from the recorded authorization context' }
          ]
        },
        {
          text: 'Service authorization uses client_credentials grant exchange',
          children: [
            { text: 'Machine-to-machine token requests are represented separately from user-delegated grants' },
            { text: 'Use the authenticated client as the authorization subject when no human resource owner exists' },
            { text: 'Intersect requested scopes with the client allowed-scope set' },
            { text: 'Reject scopes outside the service or partner contract' },
            { text: 'Mint access token for machine-to-machine API consumption' },
            { text: 'Avoid user claims because the grant represents the client rather than a person' }
          ]
        },
        {
          text: 'Legacy and session-continuity authorization use password and refresh_token grants',
          children: [
            { text: 'Resource-owner password credential exchange is modeled separately from browser authorization' },
            { text: 'Refresh token exchange is modeled as session-continuity state rather than fresh user authentication' },
            { text: 'Password grant verifies resource-owner credentials through the configured account backend' },
            { text: 'Password grant applies client and scope policy before minting tokens' },
            { text: 'Refresh token grant loads existing refresh token state and verifies client binding' },
            { text: 'Refresh token rotation invalidates old refresh material when rotation is enabled' },
            { text: 'Refresh token revocation prevents extending compromised or terminated sessions' }
          ]
        },
        {
          text: 'Signed and issuer-prepared authorization uses assertion and preauthorized code grants',
          children: [
            { text: 'Preauthorized code requests support issuer-prepared credential pickup state' },
            { text: 'Agent-oriented code and credential requests support advanced delegated access flows' },
            { text: 'JWT bearer assertions validate issuer, subject, audience, signature, expiration, and client trust' },
            { text: 'Client assertion authentication validates signed client identity before grant execution' },
            { text: 'Preauthorized code grant resolves issuer-prepared credential issuance state' },
            { text: 'Credential-related grants create access context for wallet credential endpoints' },
            { text: 'Invalid assertion, expired code, or mismatched client state fails before token minting' }
          ]
        },
        {
          text: 'Token service generates, signs, and persists token artifacts',
          children: [
            { text: 'Token responses carry access token, refresh token, ID token, expiration, scope, and token type metadata' },
            { text: 'Issued access and refresh token state is persisted behind a storage boundary for later lookup and revocation' },
            { text: 'Token material generation and JWT signing are centralized so algorithms, keys, and identifiers stay consistent' },
            { text: 'Access tokens carry subject, client, scopes, timestamps, and authorization context' },
            { text: 'ID tokens carry OpenID claims and nonce-sensitive authentication context' },
            { text: 'Refresh tokens keep longer-lived session continuity separate from access token lifetime' },
            { text: 'Token records preserve active, revoked, and expiration state for introspection and revocation' },
            { text: 'Signing modules centralize algorithm choice, key id, and key material usage' },
            { text: 'JWKS endpoint publishes active public signing keys to clients, gateways, and resource servers' }
          ]
        },
        {
          text: 'Token lifecycle control uses introspection, revocation, and validation',
          children: [
            { text: 'Token active-state lookup runs through a dedicated introspection flow' },
            { text: 'Introspection request and response contracts are represented explicitly for protected resources' },
            { text: 'Token invalidation runs through a dedicated revocation flow' },
            { text: 'Bearer-token consumption is normalized for protected resources and gateway checks' },
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
      text: 'Identity provider establishes resource-owner assurance before authorization decisions',
      children: [
        {
          text: 'Local assurance uses username/password authentication',
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
          text: 'External assurance uses LDAP and federated authentication',
          children: [
            { text: 'LDAP backend binds against enterprise directory credentials and maps directory attributes to user context' },
            { text: 'LDAP metadata and role mapping connect external accounts to Boruta claims and scope eligibility' },
            { text: 'Federated backend builds outbound authorize request to the external identity provider' },
            { text: 'Federated callback validates returned authorization result before linking or creating a local session' },
            { text: 'Federated account metadata preserves external issuer and subject information for later claims' }
          ]
        },
        {
          text: 'Higher assurance uses step-up authentication and authenticator enrollment',
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
          text: 'Durable assurance manages account lifecycle around authentication',
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
          text: 'Authorization inputs project authenticated account data into claims',
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
      text: 'Policy domain represents access as clients, scopes, roles, organizations, providers, and upstreams',
      children: [
        {
          text: 'Integration trust is expressed through client policy',
          children: [
            { text: 'Client lookup, validation, and persistence are abstracted behind a storage boundary' },
            { text: 'The default server storage shape records client metadata used by protocol flows and administration' },
            { text: 'Client records model applications, partners, services, wallets, and the admin console' },
            { text: 'Grant-type settings restrict which OAuth flows a client may use' },
            { text: 'Redirect URI settings constrain where browser authorization responses can be delivered' },
            { text: 'Client scopes bound the maximum business permissions the client can request' },
            { text: 'Client secret, key pair, DID, and regenerated key material implement client trust lifecycle' }
          ]
        },
        {
          text: 'Permission semantics are expressed through scope policy',
          children: [
            { text: 'Scope lookup and persistence are abstracted behind a storage boundary' },
            { text: 'The default server storage shape records scope metadata consumed by tokens and admin screens' },
            { text: 'Scopes are the atomic authorization units requested by clients and granted to tokens' },
            { text: 'Scope labels expose protocol permissions in administrator and user-facing language' },
            { text: 'Role-scope links bundle scopes into reusable business permission sets' },
            { text: 'Gateway required-scope rules reuse the same scope vocabulary for API enforcement' }
          ]
        },
        {
          text: 'Business context is expressed through role and organization policy',
          children: [
            { text: 'The resource-owner contract decouples OAuth flows from the concrete identity user store' },
            { text: 'Identity users are linked to protocol authorization state as resource owners' },
            { text: 'Roles map users to scope bundles without duplicating permission assignments' },
            { text: 'Organizations group users into tenant, customer, department, or issuer boundaries' },
            { text: 'Organization restrictions can limit access to the administration surface' },
            { text: 'Backend defaults can create organization and role links as part of account provisioning' }
          ]
        },
        {
          text: 'Authentication behavior is expressed through identity provider and backend policy',
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
      text: 'Gateway policy enforcement point applies authorization decisions before protected traffic reaches services',
      children: [
        {
          text: 'Traffic policy models upstream services as protected resources',
          children: [
            { text: 'Upstream records identify protected traffic by node name, virtual host, scheme, host, port, and URI list' },
            { text: 'Authorize flag distinguishes public forwarding from protected resource enforcement' },
            { text: 'Required scopes map HTTP methods to the business permissions needed for each operation' },
            { text: 'Strip URI rewrites gateway-facing paths into upstream-facing paths' },
            { text: 'Custom unauthorized, forbidden, and error response settings define the API consumer contract' }
          ]
        },
        {
          text: 'Gateway protection enforces access before forwarding traffic',
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
          text: 'Service handoff passes trusted authorization context downstream',
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
          text: 'Scalable enforcement operates the gateway as a distributed authorization layer',
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
      text: 'OpenID and wallet layer extends authorization into claims, credentials, presentations, and DIDs',
      children: [
        {
          text: 'Relying-party integration exposes provider metadata and identity claims',
          children: [
            { text: 'OpenID provider metadata is generated from configured issuer, endpoints, algorithms, and supported capabilities' },
            { text: 'Signing keys are exposed through a reusable key publication flow' },
            { text: 'Userinfo claims are resolved from authorized token context and account claims' },
            { text: 'OpenID configuration describes issuer, endpoints, response types, signing algorithms, and supported capabilities' },
            { text: 'JWKS exposes keys used to validate signed tokens' },
            { text: 'Userinfo returns claims for valid tokens according to authorized scope and subject context' },
            { text: 'ID token generation packages authentication context for relying parties' }
          ]
        },
        {
          text: 'Credential issuer uses verifiable credential issuance',
          children: [
            { text: 'Credential issuance requests run through a dedicated credential issuance flow' },
            { text: 'Immediate and deferred credential issuance outputs are represented as distinct response shapes' },
            { text: 'Credential persistence is abstracted behind a storage boundary' },
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
          text: 'Wallet-mediated authorization uses verifiable presentation flows',
          children: [
            { text: 'Wallet presentation responses are accepted through a dedicated direct-post flow' },
            { text: 'Presentation results are represented as explicit accepted, rejected, pending, or completed outcomes' },
            { text: 'Verifier-initiated presentation state is modeled separately from token issuance state' },
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
          text: 'Decentralized trust anchors use DID infrastructure',
          children: [
            { text: 'DID material is resolved and created through configured resolver and registrar services' },
            { text: 'OpenID and credential artifacts are signed with configured key material' },
            { text: 'DID resolver base URL resolves decentralized identifiers used in signatures and credentials' },
            { text: 'DID registrar base URL creates decentralized identifiers when configured' },
            { text: 'DID services API key authorizes resolver and registrar calls' },
            { text: 'Client DID regeneration supports decentralized client identity lifecycle' }
          ]
        }
      ]
    },
    {
      text: 'Admin control plane exposes Boruta policy and runtime objects to operators',
      children: [
        {
          text: 'Policy mutation uses authenticated management APIs',
          children: [
            { text: 'Core-managed clients, scopes, tokens, and users are exposed to admin workflows through management contexts' },
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
          text: 'Repeatable policy deployment uses declarative configuration import',
          children: [
            { text: 'Configuration loader accepts YAML configuration for repeatable environments' },
            { text: 'Schemas validate client, scope, role, backend, identity provider, organization, template, and error-template sections' },
            { text: 'Example configuration endpoint documents the expected policy shape' },
            { text: 'Upload endpoint applies validated configuration through the administration surface' }
          ]
        },
        {
          text: 'Operator usability uses domain-oriented UI workflows',
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
      text: 'Runtime platform operates Boruta securely across release and deployment shapes',
      children: [
        {
          text: 'Initial trust bootstraps runtime secrets and first administration access',
          children: [
            { text: 'Environment variables seed the first admin user and password' },
            { text: 'Environment variables seed the admin OAuth client id and secret' },
            { text: 'Admin OAuth base URL and admin base URL wire the admin console into Boruta authentication' },
            { text: 'Shared session cookie key and signing salt allow web, identity, and admin surfaces to share browser state' }
          ]
        },
        {
          text: 'Runtime hardening protects sensitive endpoints and flows',
          children: [
            { text: 'Local and distributed caches accelerate repeated authorization lookups' },
            { text: 'Rate limit plug protects OAuth, identity, and account routes from repeated abusive calls' },
            { text: 'CSRF protection guards browser session and form flows' },
            { text: 'Secure browser headers are applied to browser pipelines' },
            { text: 'Admin API requires authenticated administrator context before policy mutation' },
            { text: 'Optional subject and organization restrictions narrow admin access' }
          ]
        },
        {
          text: 'Operational accountability uses audit, retention, and incident response',
          children: [
            { text: 'Logs store request and business events for administrator review' },
            { text: 'Retention settings bound the lifetime of stored logs' },
            { text: 'Revocation stops compromised or no-longer-valid token state' },
            { text: 'Key rotation and client regeneration reduce blast radius after secret compromise' },
            { text: 'Gateway rate limits and scope rules can be tightened during abuse response' }
          ]
        },
        {
          text: 'Deployment flexibility packages the same business logic for different shapes',
          children: [
            { text: 'Full release runs authorization server, admin control plane, and gateway together' },
            { text: 'Authorization-focused release exposes protocol business logic without standalone gateway focus' },
            { text: 'Admin-focused release isolates policy management from runtime traffic' },
            { text: 'Gateway-focused release deploys enforcement close to protected services' },
            { text: 'Docker, Docker Compose, release, Ansible, and cluster settings support production rollout choices' }
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
