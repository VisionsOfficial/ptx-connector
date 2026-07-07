# Direct Response Visualization

## Description

The **Direct Response Visualization** feature allows a participant to trigger a data exchange and **synchronously receive the exchanged data** in the HTTP response of the `/consumer/exchange` endpoint.

By default, a data exchange is fire-and-forget: the consumer endpoint returns immediately after kicking off the exchange, and the data is imported asynchronously into the consumer's software representation. With Direct Response Visualization enabled, the request is kept open (long-polling) until the provider has exported and the consumer has imported the data, at which point the raw imported payload is returned directly to the caller.

The optional **`data`** field allows the caller to **inject a data payload directly** into the exchange, bypassing the provider export step entirely. When `data` is supplied the connector skips the provider-side fetch and uses the provided array as the source data, which is then passed through the service chain (or directly to the consumer software representation).

This is particularly useful for:
- **Live previews** of a dataset before committing to a full integration.
- **Debugging and testing** data pipelines end-to-end.
- **API-driven workflows** where the caller needs the data synchronously.
- **Injecting custom data** through a service chain without requiring a live provider.
- **Direct integration**  of the PDC data exchange requests

---

## How It Works

### 1. The participant triggers the exchange with `directResponseVisualization: true`

The simplest form — standard bilateral exchange:

```http
POST /consumer/exchange
Content-Type: application/json
Authorization: Bearer <token>

{
  "contract": "https://contract.com/contracts/<id>",
  "resourceId": "https://catalog.api.com/v1/catalog/serviceofferings/<id>",
  "purposeId":  "https://catalog.api.com/v1/catalog/serviceofferings/<id>",
  "directResponseVisualization": true
}
```

When the **`data`** field is provided, `resourceId` is **no longer required** because the payload itself replaces the provider export:

```http
POST /consumer/exchange
Content-Type: application/json
Authorization: Bearer <token>

{
  "contract": "https://contract.com/contracts/<id>",
  "purposeId": "https://catalog.api.com/v1/catalog/serviceofferings/<id>",
  "directResponseVisualization": true,
  "data": [ { "_id": "...", "email": "john@doe.com", "..." : "..." } ]
}
```

### 2. A unique callback ID and promise are created

The controller generates a unique `directResponseVisualizationId` (MongoDB `ObjectId`) and registers a pending `Promise` in an **in-memory map** (`pendingDirectResponseVisualizations`).

```
pendingDirectResponseVisualizations[directResponseVisualizationId] = { resolve, timer }
```

A timeout (default **30 seconds**, configurable via the `EXCHANGE_TIMEOUT` environment variable) is started. If the callback is not received within this window, the promise is rejected and an error message is returned.

### 3. The exchange is initiated with the callback metadata

The `directResponseVisualizationId` is forwarded to either `triggerBilateralFlow` or `triggerEcosystemFlow`. Both flows store two extra fields on the created `DataExchange` document:

| Field                           | Value                                                                                        |
|---------------------------------|----------------------------------------------------------------------------------------------|
| `directResponseVisualizationId` | The unique ID generated in step 2                                                            |
| `callbackUrl`                   | `{consumerEndpoint}/callbacks/direct-response-visualization/{directResponseVisualizationId}` |
| `data`                          | `true` when a data payload was injected by the caller (field stored as a boolean flag)       |

### 4. The provider exports and the consumer imports the data

- **Without `data`**: The standard exchange flow proceeds normally (provider export → consumer import).
- **With `data`**: The provider export step is skipped. The injected payload is used directly as the source data and forwarded through the service chain or straight to the consumer software representation.

### 5. The consumer service posts data back to the callback URL

At the end of `consumerImportService`, after a successful import, the consumer connector calls:

```http
POST {consumerEndpoint}/callbacks/direct-response-visualization/{directResponseVisualizationId}
Content-Type: application/json

<imported data payload>
```

### 6. The callback route resolves the pending promise

`POST /callbacks/direct-response-visualization/:directResponseVisualizationId` looks up the `directResponseVisualizationId` in `pendingDirectResponseVisualizations`, cancels the timeout timer, removes the entry from the map, and resolves the promise with the received body.

### 7. The original request returns the data

The `/consumer/exchange` response now includes the `directResponseVisualization` field populated with the imported data:

```json
{
  "success": true,
  "dataExchange": { "..." : "..." },
  "directResponseVisualization": { "..." : "..." }
}
```

---

## Flow Diagram

### Standard flow (no `data` field)

```
Caller
  │
  │  POST /consumer/exchange  { directResponseVisualization: true }
  ▼
Consumer Connector
  ├─ generates directResponseVisualizationId
  ├─ registers pending Promise in pendingDirectResponseVisualizations map
  ├─ creates DataExchange (stores directResponseVisualizationId + callbackUrl)
  ├─ triggers provider export
  │
  │  (awaits callbackPromise — request is held open)
  │
  ▼
Provider Connector
  └─ exports data → POST /consumer/import

Consumer Connector
  └─ consumerImportService
       └─ imports data into software representation
       └─ POST {callbackUrl}  ← sends imported data back

Consumer Connector  /callbacks/direct-response-visualization/:directResponseVisualizationId
  └─ resolves pending Promise with imported payload
  │
  ▼
Caller  ← receives { success, dataExchange, directResponseVisualization: <data> }
```

### Injected data flow (`data` field provided)

```
Caller
  │
  │  POST /consumer/exchange  { directResponseVisualization: true, data: [...] }
  ▼
Consumer Connector
  ├─ generates directResponseVisualizationId
  ├─ registers pending Promise in pendingDirectResponseVisualizations map
  ├─ creates DataExchange (stores directResponseVisualizationId + callbackUrl + data: true)
  ├─ skips provider export — uses injected data payload directly
  │
  │  (awaits callbackPromise — request is held open)
  │
  ▼
Consumer Connector
  └─ consumerImportService (processes injected data through service chain if applicable)
       └─ imports result into software representation
       └─ POST {callbackUrl}  ← sends imported data back

Consumer Connector  /callbacks/direct-response-visualization/:directResponseVisualizationId
  └─ resolves pending Promise with imported payload
  │
  ▼
Caller  ← receives { success, dataExchange, directResponseVisualization: <data> }
```

---

## Usage Examples

### 1. Basic bilateral exchange

```json
{
    "contract": "http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5",
    "purposeId": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d18b79ee71f9f096baecb0",
    "resourceId": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d187f4ee71f9f096bae8ca",
    "directResponseVisualization": true
}
```

### 2. Basic exchange with injected data (no `resourceId` required)

When `data` is provided, the provider export is bypassed and `resourceId` can be omitted:

```json
{
    "contract": "http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5",
    "purposeId": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d18b79ee71f9f096baecb0",
    "directResponseVisualization": true,
    "data": [
        {
            "_id": "660ffe57aecb6ea62e307901",
            "__v": 0,
            "createdAt": "2024-04-11T14:24:00.529Z",
            "email": "john+1@doe.com",
            "oauth": {
                "google": {
                    "id": "",
                    "email": "",
                    "verified_email": false,
                    "name": "",
                    "given_name": "",
                    "family_name": "",
                    "picture": "",
                    "locale": ""
                }
            },
            "schema_version": "1",
            "updatedAt": "2024-05-30T09:34:11.196Z",
            "verified_email": true
        }
    ]
}
```

### 3. Service chain exchange

```json
{
    "contract": "http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5",
    "serviceChainId": "6a2805a3b1f55f757e783e9e",
    "directResponseVisualization": true
}
```

> ℹ️ A service chain can work **with or without a data offering as the first node**.

### 4. Service chain exchange with injected data

When `data` is provided alongside a `serviceChainId`, the injected payload is used as the source even if the first node of the chain is a data offering. The chain is executed with the provided data as input:

```json
{
    "contract": "http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5",
    "serviceChainId": "6a2805a3b1f55f757e783e9e",
    "directResponseVisualization": true,
    "data": [
        {
            "_id": "660ffe57aecb6ea62e307901",
            "__v": 0,
            "createdAt": "2024-04-11T14:24:00.529Z",
            "email": "john+1@doe.com",
            "oauth": {
                "google": {
                    "id": "",
                    "email": "",
                    "verified_email": false,
                    "name": "",
                    "given_name": "",
                    "family_name": "",
                    "picture": "",
                    "locale": ""
                }
            },
            "schema_version": "1",
            "updatedAt": "2024-05-30T09:34:11.196Z",
            "verified_email": true
        }
    ]
}
```

---

## Configuration

| Environment Variable | Default | Description |
|---|---|---|
| `EXCHANGE_TIMEOUT` | `30` | Maximum number of **seconds** to wait for the data callback before returning a timeout error. |

---

## API Reference

### `POST /consumer/exchange`

Existing endpoint — extended with the optional `directResponseVisualization` and `data` fields.

| Field | Type | Required | Description |
|---|---|---|---|
| `contract` | `string` | ✅ | Contract self-description URL |
| `resourceId` | `string` | ❌ | Provider service offering URI. **Not required when `data` is provided.** |
| `purposeId` | `string` | ❌ | Consumer service offering URI (ecosystem) |
| `resources` | `array` | ❌ | Array of data resource URIs |
| `purposes` | `array` | ❌ | Array of software resource URIs |
| `providerParams` | `object` | ❌ | Query params forwarded to the provider |
| `consumerParams` | `object` | ❌ | Query params forwarded to the consumer |
| `serviceChainId` | `string` | ❌ | ID of the service chain in the contract |
| `serviceChainParams` | `array` | ❌ | Params for service chain resources |
| **`directResponseVisualization`** | `boolean` | ❌ | When `true`, the response waits and returns the exchanged data |
| **`data`** | `array` | ❌ | Array of data objects to inject directly into the exchange, bypassing the provider export step. Compatible with both bilateral and service chain flows. |

**Response (200) — with service chain**
```json
{
    "timestamp": 1783342073905,
    "code": 200,
    "content": {
        "success": true,
        "dataExchange": {
            "providerParams": { "query": [] },
            "consumerParams": { "query": [] },
            "serviceChain": {
                "catalogId": "6a2805a3b1f55f757e783e9e",
                "services": [
                    {
                        "participant": "http://host.docker.internal:4040/v1/catalog/participants/66d18724ee71f9f096bae810",
                        "service": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d187f4ee71f9f096bae8ca",
                        "params": "",
                        "pre": [],
                        "completed": true,
                        "_id": "6a4ba3f920ded79942357dda"
                    },
                    {
                        "participant": "http://host.docker.internal:4040/v1/catalog/participants/66d18a1dee71f9f096baec07",
                        "service": "http://host.docker.internal:4040/v1/catalog/infrastructureservices/67f669b57b3045a9bb30e240",
                        "params": "",
                        "pre": [],
                        "completed": true,
                        "_id": "6a4ba3f920ded79942357ddb"
                    },
                    {
                        "participant": "http://host.docker.internal:4040/v1/catalog/participants/66d18a1dee71f9f096baec08",
                        "service": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d18b79ee71f9f096baecb0",
                        "params": "",
                        "pre": [],
                        "completed": true,
                        "_id": "6a4ba3f920ded79942357ddc"
                    }
                ]
            },
            "_id": "6a4ba3f920ded79942357dd9",
            "resources": [],
            "purposes": [
                {
                    "serviceOffering": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d18b79ee71f9f096baecb0",
                    "resource": "http://host.docker.internal:4040/v1/catalog/softwareresources/66d18bf6ee71f9f096baed58"
                }
            ],
            "purposeId": "http://host.docker.internal:4040/v1/catalog/serviceofferings/66d18b79ee71f9f096baecb0",
            "contract": "http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5",
            "consumerEndpoint": "http://host.docker.internal:3334/",
            "status": "IMPORT_SUCCESS",
            "createdAt": "2026-07-06T12:47:53.637Z",
            "serviceChainParams": [],
            "directResponseVisualizationId": "6a4ba3f920ded79942357dd3",
            "callbackUrl": "http://host.docker.internal:3333/callbacks/direct-response-visualization/6a4ba3f920ded79942357dd3",
            "data": true,
            "__v": 1,
            "consumerDataExchange": "6a4ba3f9eb5c8c65fa985d0a"
        },
        "directResponseVisualization": {
            "message": "Data received and stored.",
            "dataReceived": {
                "data": [
                    {
                        "_id": "660ffe57aecb6ea62e307901",
                        "__v": 0,
                        "createdAt": "2024-04-11T14:24:00.529Z",
                        "email": "john+1@doe.com",
                        "oauth": {
                            "google": {
                                "id": "",
                                "email": "",
                                "verified_email": false,
                                "name": "",
                                "given_name": "",
                                "family_name": "",
                                "picture": "",
                                "locale": ""
                            }
                        },
                        "schema_version": "1",
                        "updatedAt": "2024-05-30T09:34:11.196Z",
                        "verified_email": true,
                        "score": 94
                    }
                ],
                "contract": "http://host.docker.internal:8888/contracts/6a0efda83d981b2bab2dadd5",
                "params": ""
            },
            "storedId": "6a4ba3f9cbe3a8ec81bb6eb7"
        }
    }
}
```

> ℹ️ When `data` was injected in the request, the `dataExchange.data` field is set to `true` (boolean flag) in the stored document.

**Response — timeout (200)**
```json
{
  "success": false,
  "dataExchange": { "...": "..." },
  "message": "30 sec Timeout reached.",
  "directResponseVisualization": null
}
```

---

### `POST /callbacks/direct-response-visualization/:directResponseVisualizationId`

Internal callback endpoint used by the consumer import service to resolve a pending direct response visualization.

> ⚠️ This endpoint is **not meant to be called by external clients**. It is called automatically by `consumerImportService` at the end of the import phase.

| Parameter | In | Type | Required | Description |
|---|---|---|---|---|
| `directResponseVisualizationId` | path | `string` | ✅ | The unique ID of the pending direct response visualization |
| *(body)* | body | `object` | ✅ | The imported data payload to return to the caller |

**Responses**

| Status | Description |
|---|---|
| `200` | Data preview successfully resolved |
| `404` | No pending direct response visualization found for the given ID (already resolved, timed out, or unknown) |

---

## Files Changed

| File                                                      | Change                                                                                                                                                                                                                                                                                                             |
|-----------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `src/routes/public/v1/consumer.public.router.ts`          | Added `body('directResponseVisualization').isBoolean().optional()` and `body('data').isArray().optional()` validators to `/consumer/exchange`                                                                                                                                                                      |
| `src/controllers/public/v1/consumer.public.controller.ts` | Added `directResponseVisualization` / `directResponseVisualizationId` / `callbackPromise` / `data` logic; returns `directResponseVisualization` payload in response                                                                                                                                                |
| `src/services/public/v1/consumer.public.service.ts`       | `triggerBilateralFlow` and `triggerEcosystemFlow` now accept and store `directResponseVisualizationId`, `callbackUrl`, and `data` (boolean flag) on the `DataExchange` document; when `data` is provided the provider export is skipped; `consumerImportService` posts the imported data to `callbackUrl` when set |
| `src/libs/loaders/pendingDirectResponseVisualization.ts`  | New file — exports the `pendingDirectResponseVisualizations` in-memory `Map` shared between the controller and the callback route                                                                                                                                                                                  |
| `src/routes/public/v1/callback.public.router.ts`          | New route `POST /callbacks/direct-response-visualization/:directResponseVisualizationId` to resolve pending previews                                                                                                                                                                                               |

---

## Changelog

### 2026-07-06

- **feat**: Added `data` array field to `POST /consumer/exchange` request body, allowing the caller to inject a data payload directly into the exchange.
- **feat**: When `data` is provided, the provider export step is bypassed — `resourceId` is no longer required.
- **feat**: `data` field is compatible with service chain exchanges: the injected payload is used as the chain's input even when the first node is a data offering.
- **feat**: `dataExchange.data` is stored as `true` (boolean flag) on the `DataExchange` document when a payload was injected.

### 2026-07-03

- **feat**: Renamed `dataPreview` to `directResponseVisualization` boolean field to `POST /consumer/exchange` request body.
- **feat**: Created `pendingDirectResponseVisualizations` in-memory map to hold unresolved preview promises.
- **feat**: `triggerBilateralFlow` and `triggerEcosystemFlow` now persist `directResponseVisualizationId` and `callbackUrl` on the `DataExchange` document.
- **feat**: `consumerImportService` automatically POSTs the imported payload to `callbackUrl` at the end of a successful import when `directResponseVisualizationId` is set.
- **feat**: Added `POST /callbacks/direct-response-visualization/:directResponseVisualizationId` callback endpoint.
- **feat**: `POST /consumer/exchange` now returns the imported data under the `directResponseVisualization` key in the response when `directResponseVisualization: true`.
- **feat**: Timeout behaviour controlled by the `EXCHANGE_TIMEOUT` environment variable (default 30 s).
