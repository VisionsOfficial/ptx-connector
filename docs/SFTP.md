# FTP & SFTP

The workflows for enabling (S)FTP servers to exchange information after control-plane verification from the connector is a work in progress. The feature is currently **not implemented**. This document exists as an open reference to obtain community feedback.

```mermaid
sequenceDiagram
    participant Provider SFTP / FTP
    participant Publisher
    participant Provider PDC
    participant Consumer PDC
    participant Consumer SFTP / FTP
    Note over Provider PDC: Exchange triggered POST /exchange
    Note over Provider PDC: Verify contract + resource are FTP type
    Provider PDC->>Consumer PDC: transfer exchange data
    Note over Consumer PDC: verify contract + resource are FTP type
    Consumer PDC-->>Provider PDC: Change data exchange status to TRANSFER_STARTED
    Provider PDC-->>Publisher: publish message on websocket or message broker
    Note over Provider PDC: return response with status
    Provider SFTP / FTP-->>Consumer SFTP / FTP: Push data to SFTP / FTP server
```

```mermaid
sequenceDiagram
    participant Provider SFTP / FTP
    participant Provider PDC
    participant Consumer PDC
    participant Publisher
    participant Consumer SFTP / FTP
    Note over Consumer PDC: Exchange triggered POST /exchange
    Consumer PDC->>Provider PDC: Start exchange order
    Note over Provider PDC: Verify contract + resource are FTP type
    Provider PDC->>Consumer PDC: transfer exchange data
    Note over Consumer PDC: verify contract + resource are FTP type
    Consumer PDC-->>Provider PDC: Change data exchange status to TRANSFER_STARTED
    Consumer PDC-->>Publisher: publish message on websocket or message broker
    Note over Consumer PDC: return response with status + can publish message on websocket or message broker
    Consumer SFTP / FTP-->>Provider SFTP / FTP: Pull data to SFTP / FTP server
    Provider SFTP / FTP-->>Consumer SFTP / FTP: 
```

> Who trigger the exchange define who pushes or pull the data

```mermaid
sequenceDiagram
    participant Provider SFTP / FTP
    participant Provider PDC
    participant Consumer PDC
    participant Consumer SFTP / FTP
    Provider SFTP / FTP-->>Provider PDC: POST /transfer/completed or /transfer/failed
    Provider PDC->>Consumer PDC: Sync data exchange status
```

```mermaid
sequenceDiagram
    participant Provider SFTP / FTP
    participant Provider PDC
    participant Consumer PDC
    participant Consumer SFTP / FTP
    Consumer SFTP / FTP-->>Consumer PDC: POST /transfer/completed or /transfer/failed
    Consumer PDC->>Provider PDC: Sync data exchange status
```

## Publisher

The publisher configuration is directly integrated with the PDC connector configuration in `config.json` file.

This publisher is optional and can be configured to use either AMQP (e.g., RabbitMQ) or Kafka as the message broker, or WebSocket for real-time communication in the same time.

```json
{
  "consentUri": "http://host.docker.internal:8887/v1/",
  ...
  "ampq": {
    "host": "amqp://admin:password@host.docker.internal:5672",
    "queue": "pdc"
  },
  "kafka": {
    "brokers": ["host.docker.internal:9092"],
    "topic": "pdc"
  },
  "websocket": {
    "uri": "ws://localhost:8666"
  }
}
```

The publication is currently only used to notify the content response of the routes:
- `POST /exchange`
- `POST /consumer/exchange`
- `POST /exchange/external/trigger`

The published message contains all the information about the data exchange, including status and error details if any:
- _id
- providerEndpoint
- resources
- purposes
- purposeId
- contract
- consumerEndpoint
- consumerDataExchange
- providerDataExchange
- status
- consentId
- createdAt
- updatedAt
- error
  - message
  - code
  - location
- payload
- providerData
  - checksum
  - size
  - mimetype
- providerParams
- consumerParams
- serviceChain
- serviceChainParams


| Clé       | Description                                                                                                  |
|-----------|--------------------------------------------------------------------------------------------------------------|
| _id       | Identifiant unique de l'enregistrement au format MongoDB                                                     |
| createdAt | Date et heure de création de l'enregistrement (format ISO 8601).                                             |
| updatedAt | Date et heure de modification de l'enregistrement (format ISO 8601).                                         |
| what      | Object décrivant l'action                                                                                    |
|           | - api: endpoint cible                                                                                        |
|           | - action: action faite par le participant                                                                    |
|           | - contractId: identifiant du contract                                                                        |
|           | - ecosystemId: identifiant de l'ecosystem                                                                    |
| who       | Identifiant du participant à l'origine de l'action                                                           |