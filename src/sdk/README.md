# Arcane TypeScript SDK

A port of the Swift SDK [`libarcane-swift`](https://github.com/getarcaneapp) (`Sources/Arcane`,
`Sources/ArcaneOIDC`, `Sources/ArcanePasskeys`) for the React Native app. The public surface
mirrors Swift so call sites in the SwiftUI app translate mechanically.

```ts
import { ArcaneClient, type TokenStore } from '@/sdk';

const tokenStore: TokenStore = mySecureStoreTokenStore; // app-provided
const client = new ArcaneClient({ baseURL: 'https://arcane.example.com', tokenStore });

await client.auth.login({ username: 'admin', password: '…' });
const caps = client.serverCapabilities();
if (ServerCapabilities.supportsActivities(caps)) {
	/* v2-only UI */
}

const page = await client.containers.list({ envID: '0', query: { search: 'web', limit: 20 } });
await client.containers.restart({ id: page.data[0]!.id });
```

## Layout

| Swift                                  | TypeScript                                                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `Client/`                              | `client/` (`ArcaneClient`, `ArcaneTransport`, URL + proxy support, `ServerCapabilities`)                                        |
| `HTTP/`                                | `http/` (`RESTService`, `ArcaneRequestOptions`, multipart, envelopes, fetch plumbing)                                           |
| `Auth/`                                | `auth/` (`AuthManager`, `AuthService`, `TokenStore`)                                                                            |
| `Errors/`                              | `errors/`                                                                                                                       |
| `Pagination/`                          | `pagination/`                                                                                                                   |
| `Streaming/`                           | `streaming/`                                                                                                                    |
| `Services/<Name>.swift` (+ extensions) | `services/<Name>.ts` (extensions merged into the one class)                                                                     |
| `Models/<Folder>/<File>.swift`         | `models/<folder in lowerCamelCase>/<File>.ts` (`User+Permissions.swift` helpers live on the `User` companion in `user/User.ts`) |
| `Types/…`                              | `types/…` (same lowerCamel rule for folders)                                                                                    |
| `ArcaneOIDC`, `ArcanePasskeys`         | `oidc/`, `passkeys/`                                                                                                            |

Everything public is re-exported from `src/sdk/index.ts`.

## Swift → TypeScript naming rules

1. **Types keep their Swift names and property names.** `ContainerSummary.imageId` stays
   `imageId`. Where a Swift `CodingKeys` renames a JSON key, the TS property uses the **Swift
   property name** and the model's `decode`/`encode` maps the key (e.g. `MessageResponse.activityID`
   ↔ JSON `activityId`, `User.serverIsGlobalAdmin` ↔ `isGlobalAdmin`).
2. **Structs → `interface`.** `T?` → optional property `field?: T`. The transport strips `null`
   object properties while parsing (`parseArcaneJSON`), so optional fields are `undefined`, never
   `null`. Non-optional Swift properties are required.
3. **Companion objects.** Every Swift static member, computed property, method, custom
   `init(from:)` and custom `encode(to:)` lives on a `const` with the same name as the type:
   - `user.isGlobalAdmin` → `User.isGlobalAdmin(user)`
   - `user.hasPermission(p, environmentID: env)` → `User.hasPermission(user, p, env)`
   - `ServerCapabilities.detect(from: user)` → `ServerCapabilities.detect(user)`
   - `try decoder.decode(User.self, from: data)` → `User.decode(raw)`
   - Swift initialisers with meaningful defaults → `X.make({...})` where provided.
4. **String-raw enums** → a string-literal union plus a companion mapping Swift case names to raw
   values: `SortOrder.descending === "desc"`. Enums with an `unknown(String)` fallback are _open_
   unions (`"queued" | "running" | (string & {})`): unknown server values pass through unchanged;
   use the companion's `isKnown(value)` / `knownCases` where Swift matches `.unknown`.
5. **Enums with associated values** → discriminated unions on `kind` (the Swift case name), with
   the associated values under their Swift labels, or `value` when unlabeled:
   `AuthenticationResult` is `{ kind: "authenticated", value: LoginResponse } | { kind: "mfaRequired", value: MFAChallenge }`.
6. **Service methods take one options object keyed by the Swift argument labels** (the internal
   parameter name when the label is `_`). Defaults match Swift. Methods with no parameters take no
   argument; if every parameter is optional the object is optional.
   - `containers.delete(envID: env, id: id, force: true)` → `containers.delete({ envID: env, id, force: true })`
   - `auth.login(username:password:)` → `auth.login({ username, password })`
     Low-level APIs (`client.rest`, `client.transport`) take `(path, init?)` instead.
7. **`envID`** is a plain `string` (`EnvironmentID` is `type EnvironmentID = string`;
   `EnvironmentID.localDocker === "0"`; `envID.rawValue` → `envID`).
8. **Numbers.** `Int`, `Int64`, `UInt64`, `Double` → `number`. Swift `Duration` config values
   are milliseconds with an `Ms` suffix (`RetryPolicy.baseBackoffMs`); model `TimeInterval`
   fields keep Swift units (seconds).
9. **Bytes.** Swift `Data` returned by methods → `Uint8Array`. `Data` _model fields_ (base64 in
   JSON) stay base64 `string`s. Request bodies of raw bytes accept `Uint8Array | ArrayBuffer | Blob | string`.
10. **`[URLQueryItem]`** → `QueryItem[]` (`{ name, value? }`), order and duplicates preserved; `q(name, value)` helper.
11. **`@discardableResult`** methods still return their value; ignore it if unused.
12. **Errors**: see below. `async throws` → `Promise` that rejects.

## Dates

Swift `Date` fields are kept as the **original ISO-8601 string** (`type ISODateString = string`)
everywhere — models, `TokenPair.expiresAt`, request bodies. This keeps plain models usable
straight from `JSON.parse` without a decoding pass. Helpers in `models/base/date.ts`:

- `parseArcaneDate(s): Date | undefined` — RFC 3339 with or without fractional seconds (any
  precision; Go's nanoseconds are truncated to ms), like `ArcaneJSON`'s two ISO8601 formatters.
- `formatArcaneDate(date)` — Swift `.iso8601` encoding (`2024-01-02T03:04:05Z`).
- `timeIntervalSinceNow(s)` — seconds, like `date.timeIntervalSinceNow`.

## Decoding

- Models with a custom Swift `init(from:)` (v1/v2 tolerance, string-or-number, missing-key
  defaults, enum fallbacks) have an explicit `X.decode(raw: unknown): X` built from the helpers
  in `models/base/decoding.ts` (`D.string`, `D.optString`, `D.optStringOrNumber`, `D.attempt` for
  Swift `try?`, …). Any model that _contains_ a custom-decoded model also has a `decode`.
- Plain synthesized-`Codable` models are typed casts (no runtime validation).
- Services pass the right decoder; decoding failures reject with `ArcaneError.decoding`.

## Errors

`ArcaneError` (abstract) with one subclass per Swift case and a `kind` discriminant:

| Swift                                                                                | TS                                                             |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| `ArcaneError.unauthorized`                                                           | `ArcaneUnauthorizedError` (`isArcaneError(e, "unauthorized")`) |
| `.conflict(message:)`                                                                | `ArcaneConflictError.conflictMessage`                          |
| `.validation(fields:)`                                                               | `ArcaneValidationError.fields`                                 |
| `.rateLimited(retryAfter:)`                                                          | `ArcaneRateLimitedError.retryAfter` (seconds)                  |
| `.server(code:message:)`                                                             | `ArcaneServerError.code` / `.serverMessage`                    |
| `.transport(_)` / `.decoding(_)`                                                     | `ArcaneTransportError` / `ArcaneDecodingError` (`.message`)    |
| `.unknown(statusCode:body:)`                                                         | `ArcaneUnknownError.statusCode` / `.body`                      |
| `.proxyAuthenticationRequired`, `.authenticationRejected`, `.forbidden`, `.notFound` | matching classes                                               |
| `CancellationError`                                                                  | `CancellationError` (`isCancellationError(e)`)                 |
| `MFARequiredError`                                                                   | `MFARequiredError.challenge`                                   |

`ArcaneError.server(code, message)` etc. construct errors; `a.equals(b)` mirrors `Equatable`.

## Transport

- `fetch` (global) for buffered requests; `expo/fetch` for streaming (`response.body.getReader()`).
  Both are injectable (`fetch`, `streamingFetch` in the configuration).
- Base URL handling and the `/api` prefix (`appendingAPIPath`), environment-scoped paths
  (`client.rest.environmentPath(envID, "containers")`), extra headers, `ArcaneProxySession`
  (app-owned proxy cookies), proxy/SSO-gate detection (`ArcaneError.proxyAuthenticationRequired`),
  `ArcaneRequestOptions` (`X-Arcane-Batch-Id`), retry with exponential backoff for idempotent
  methods on 429/502/503/504 and network errors, one refresh-and-retry on 401.
- **Timeouts**: `timeoutMs` (default 60 s) per request via `AbortController`; streams time out
  only until the response headers arrive.
- **Cancellation** (Swift task cancellation): `client.withSignal(signal)` returns a client whose
  requests, streams and sockets abort with the signal (rejecting with `CancellationError`).
  Low-level transport methods also accept `signal`.
- **Downloads** return `Uint8Array`. Swift's file-destination overloads (`downloadX(..., to: URL)`)
  are replaced by `…DownloadRequest(args)` methods (or `client.transport.downloadRequest(path)`)
  that return `{ url, headers }` for `expo-file-system` to stream to disk.
- **Multipart**: `MultipartFile` takes a file `uri` (RN `FormData` streams it from disk) or
  in-memory `data` (`Blob` — including expo-file-system `File` — `Uint8Array`, `ArrayBuffer`).
  `expo/fetch` cannot send `uri` parts, so multipart _streams_ with `uri` parts fall back to the
  global fetch (progress lines then arrive when the response completes).

## Auth

`AuthManager` is a faithful port of the Swift actor: single-use refresh-token rotation, one
in-flight refresh shared by all concurrent callers, reload-from-store before every refresh,
proactive refresh 45 s before expiry (30 s backoff after failures), credential generations that
discard stale completions, serialized store writes, and a credential wipe only when the server
rejects the exact refresh token still in the store.

`TokenStore` is injected:

```ts
interface TokenStore {
	loadTokens(): Promise<TokenPair | undefined>;
	saveTokens(tokens: TokenPair): Promise<void>;
	clearTokens(): Promise<void>;
}
```

`InMemoryTokenStore` is provided for tests. The Swift `KeychainTokenStore` is not ported — the
app implements `TokenStore` over expo-secure-store / a shared keychain group.

Method renames (Swift overloads can't share a name in TS):
`save(loginResponse:)` → `saveLoginResponse`, `save(tokens:)` → `saveTokens`,
`clear(ifCredentialGenerationMatches:)` → `clearIfCredentialGenerationMatches`.
`client.serverCapabilities()` is synchronous (it was `async` only because of actor isolation).

## Streaming

All streams are `AsyncIterable`s. Breaking out of `for await` cancels the request / closes the
socket; `client.withSignal(signal)` cancels from outside.

```ts
for await (const event of client.images.pull({ envID, imageName: 'nginx:latest' })) {
	if (event.error) break;
}

for await (const line of client.containers.logs({ id, follow: true })) {
	console.log(line.text);
}

const terminal = await client.containers.exec({ id, shell: '/bin/sh' });
(async () => {
	for await (const bytes of terminal.output) render(bytes);
})();
await terminal.send('ls\n');
await terminal.close();
```

- `NDJSONStream<T>` — NDJSON / `x-json-stream` / SSE `data:` lines; skips non-JSON heartbeats,
  rejects on malformed JSON; supports the 404 fallback route and operation terminal frames
  (`OperationStreamEvent` `done`/`error`). Each iteration opens a new request.
- `LogStream`, `StatsStream<T>` (keeps only the newest frame), `TerminalSession`,
  `WebSocketChannel` — on the RN global `WebSocket` (`new WebSocket(url, protocols, { headers })`).
- `ArcanePaginator<T>` walks paginated endpoints.

## OIDC and passkeys

Both follow the Swift implementation, which differs from a "client does everything" OIDC flow:

- `oidc/` (`OIDCAuthenticator`): the Arcane backend creates state + PKCE in `oidc/url` and
  verifies them in `oidc/callback`, so the client only presents the auth URL, validates the
  callback scheme / http(s) URL, parses the callback and completes sign-in (incl. MFA). The
  browser is injected as an `AuthSessionPresenter = (url, callbackScheme, signal) => Promise<string | undefined>`
  — implement it with `expo-web-browser` `openAuthSessionAsync(url, \`${scheme}://\`, { preferEphemeralSession: true })`and throw`CancellationError`unless`result.type === "success"`.
- `passkeys/` (`ArcanePasskeyAuthenticator`): Swift opens the server's web bridge
  (`<origin>/mobile/passkey#request=<base64url>`) in an auth session and reads the
  `arcane-mobile://passkey-callback` redirect, so there is no native authenticator call. Inject
  `{ presentAuthSession, randomBytes(n), sha256(bytes) }` (pass `expo-crypto`) — they back the
  S256 PKCE verifier/challenge and state (`passkeys/pkce.ts`). Ceremony JSON types and
  base64url helpers are in `passkeys/CeremonyTypes.ts` / `passkeys/base64url.ts`.
- Renames: `signIn(callbackURLScheme:authorizationURL:)` → `signInWithAuthorizationURL`; the
  other `signIn` overloads → `signIn({ callbackURLScheme, redirectURI, browser?, signal? })`;
  `completeMFA` overloads → `completeMFA({ challenge } | { transactionId })`; presentation
  anchors are dropped (cancel with an `AbortSignal` / `authenticator.cancel()`).

## Not ported (and why)

- `KeychainTokenStore` / `KeychainError` — iOS Keychain API; the app provides a `TokenStore`.
- File-destination downloads (`downloadRaw(_:to:)`, `…(to: URL)` overloads) — no file system in
  the SDK; use the `…DownloadRequest` variants with expo-file-system.
- WebSocket protocol pings — not exposed to JS. An opt-in idle watchdog
  (`webSocket: { idleTimeoutMs }`) detects dead sockets instead.
- Per-hop redirect vetting and WebSocket handshake status — `fetch`/`WebSocket` don't expose
  them; the final response URL is scope-checked and any surfacing 3xx is a proxy gate.
- `Hashable`/`Sendable`/`Identifiable` conformances — no TS equivalent needed.

## Tests

```sh
npm run test:sdk
```

`tools/test/register.mts` adds extensionless `.ts` resolution (and the `@/` alias) so the SDK keeps Metro-style imports.
