# 🪐 Modular Optimistic Rollup

> A production-grade, highly-available Optimistic Rollup architecture built with Node.js, Solidity, and Kubernetes. Features a decentralized sequencer network, a dedicated Data Availability (DA) layer, and robust crypto-economic slashing mechanisms.

![Architecture Overview Placeholder](docs/assets/architecture.png)
*Architecture Overview: How the API, Sequencers, DA Layer, and L1 Smart Contracts interact.*

---

## 📖 Table of Contents
1. [Project Overview](#project-overview)
2. [Tech Stack](#tech-stack)
3. [Features](#features)
4. [Architecture Explanation](#architecture-explanation)
5. [Folder Structure](#folder-structure)
6. [Local Setup Instructions](#local-setup-instructions)
7. [Kubernetes Deployment](#kubernetes-deployment)
8. [API Endpoints](#api-endpoints)
9. [Monitoring & Observability](#monitoring--observability)
10. [Fraud Proof & Slashing Flow](#fraud-proof--slashing-flow)
11. [Sequencer Failover Explanation](#sequencer-failover-explanation)
12. [Demo Instructions](#demo-instructions)
13. [Future Improvements](#future-improvements)

---

## 🎯 Project Overview
This repository contains a fully functional, modular Optimistic Rollup built from scratch. It decouples execution, data availability, and settlement into independent, horizontally scalable microservices. Designed for high availability, it utilizes Redis for distributed leader election among a network of decentralized sequencers, anchoring state roots to Ethereum Sepolia.

---

## 💻 Tech Stack
*   **Backend Services**: Node.js, Express, Ethers.js v6
*   **Smart Contracts**: Solidity, Foundry, OpenZeppelin
*   **Databases**: PostgreSQL (State & Tx Storage), Redis (Queue & Leader Locks)
*   **Infrastructure**: Kubernetes, Docker, Docker Compose
*   **Observability**: Prometheus, Grafana, Prom-Client
*   **CI/CD**: GitHub Actions

---

## ✨ Features
*   **Decentralized Sequencer Network**: Active/Passive sequencer replicas utilizing Redis distributed locking for automated leader election and split-brain prevention.
*   **Data Availability Layer**: A dedicated microservice that aggressively compresses transaction payloads via `gzip` and generates cryptographic keccak256 commitments.
*   **Crypto-Economic Security**: Proof-of-Stake mechanics requiring sequencers to lock 1 ETH. Malicious blocks result in instant slashing and challenger bounties.
*   **On-Chain Merkle Verification**: Gas-efficient state anchors using OpenZeppelin's `MerkleProof` library.
*   **Comprehensive Observability**: Deep Prometheus instrumentation tracking election latency, heartbeat failures, DA compression ratios, and L1 anchoring success.

---

## 🏗️ Architecture Explanation

The system is broken into four distinct layers:
1.  **L2 API (Execution/RPC)**: Receives L2 transactions, executes state transitions in a mocked EVM environment, and pushes validated transactions to a Redis FIFO queue.
2.  **Sequencer Network**: A stateful set of worker nodes. The active leader pops transactions from the queue, builds Merkle trees, and mints L2 blocks.
3.  **Data Availability Layer (DA)**: The sequencer streams the raw block data to the DA service, which compresses it and returns a tamper-proof cryptographic commitment.
4.  **L1 Settlement (Ethereum)**: The sequencer submits a tiny calldata payload containing the `txRoot` and `daCommitment` to the `Rollup.sol` contract.

---

## 📁 Folder Structure

```text
rollup-project/
├── backend/            # L2 API Server (User-facing endpoints)
├── contracts/          # Solidity Smart Contracts (Foundry)
├── da-service/         # Data Availability Layer
├── sequencer/          # Decentralized Sequencer Node & Validator
├── shared/             # Shared Models, DB configs, Utils (NPM Workspace)
├── k8s/                # Kubernetes Deployment Manifests
├── monitoring/         # Prometheus Configs & Grafana Dashboards
├── tests/              # End-to-end integration tests
└── docs/               # Architecture guides and runbooks
```

---

## 🚀 Local Setup Instructions

**Prerequisites:** Docker, Node.js (v18+), Foundry.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/rollup-project.git
    cd rollup-project
    ```
2.  **Install Monorepo Dependencies:**
    ```bash
    npm install
    ```
3.  **Setup Environment Variables:**
    Duplicate the `.env.example` file in the root and fill in your Alchemy/Infura `ETH_RPC_URL` and `ETH_PRIVATE_KEY`.
4.  **Start Infrastructure:**
    ```bash
    docker-compose up -d db redis prometheus grafana
    ```
5.  **Run Services:**
    Open multiple terminals to run the microservices:
    ```bash
    npm run start --workspace=backend
    npm run start --workspace=da-service
    npm run start --workspace=sequencer
    ```

---

## ☸️ Kubernetes Deployment

This project is built for cloud-native orchestration.

1.  **Apply Configs & Secrets:**
    ```bash
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secret.yaml
    ```
2.  **Deploy Stateful Infrastructure:**
    ```bash
    kubectl apply -f k8s/postgres.yaml
    kubectl apply -f k8s/redis.yaml
    ```
3.  **Deploy Microservices:**
    ```bash
    kubectl apply -f k8s/backend.yaml
    kubectl apply -f k8s/da-service.yaml
    kubectl apply -f k8s/sequencer.yaml
    ```
4.  **Expose Ingress:**
    ```bash
    kubectl apply -f k8s/ingress.yaml
    ```

---

## 🌐 API Endpoints

### Execution API (`/api`)
*   `POST /api/tx`: Submit a new L2 transaction.
    *   *Body*: `{"from": "0xA", "to": "0xB", "amount": 100}`
*   `GET /api/tx/:id`: Retrieve transaction status.
*   `GET /api/block/:id`: Retrieve finalized block data.

### DA Layer (`/da`)
*   `POST /da/publish`: Compress and store batch data (Internal).
*   `GET /da/:commitment`: Fetch and mathematically verify uncompressed batch data.

---

## 📊 Monitoring & Observability

![Grafana Dashboard](docs/assets/grafana-dashboard.png)
*Grafana Dashboard tracking sequencer elections, DA compression ratios, and heartbeat health.*

*   **Prometheus**: Scrapes `/metrics` from all Node.js services every 5 seconds.
*   **Grafana**: Available at `http://localhost:3001`. Includes a pre-configured `Rollup Sequencer Network` dashboard tracking leader failovers, active stake, and L1 gas usage.
*   **Alerting**: Configured with critical rules like `NoActiveLeader` and `RapidLeaderSwitching`.

---

## 🛡️ Fraud Proof & Slashing Flow

Our rollup operates on an Optimistic assumption with a 1-hour challenge window.
1.  **Staking**: Sequencers must lock `1 ETH` via `registerSequencer()`.
2.  **Submission**: Leader submits `txRoot` to L1.
3.  **Challenge**: A watchtower detects an invalid state transition and calls `challengeBatch()` with a cryptographic fraud proof.
4.  **Slashing**: The smart contract verifies the proof. The malicious sequencer's `1 ETH` stake is slashed to `0`.
5.  **Bounty**: `0.5 ETH` is rewarded to the challenger, and `0.5 ETH` is permanently burned.

---

## 🔄 Sequencer Failover Explanation

High availability is achieved via Redis Distributed Locks (`SET NX EX`).
*   **Heartbeats**: The active leader pings Redis every 2 seconds to renew a 5-second TTL lock.
*   **Failover**: If the leader pod crashes, the TTL expires. The remaining passive replicas instantly detect the dropped lock.
*   **Promotion**: The fastest replica acquires the lock, promoting itself to Leader, and resumes processing the global transaction queue without skipping a beat.

---

## 🎮 Demo Instructions

1.  Send 10 simultaneous transactions to `POST /api/tx`.
2.  Watch the `sequencer` logs as it groups them into blocks of 5.
3.  Observe the `da-service` logs confirming `gzip` compression ratios.
4.  Verify the transaction anchors on Sepolia testnet Etherscan.
5.  **Simulate Failover**: Kill the active sequencer process (`Ctrl+C` or `kubectl delete pod sequencer-0`). Watch the backup sequencer instantly promote itself to leader!

---

## 🚀 Future Improvements

*   **MIPS / WASM Fault Verifier**: Upgrade the mocked `INVALID_STATE` string verification in Solidity to a true interactive bisection game using Cannon or RISC-V.
*   **EIP-4844 Blob Integration**: Migrate the DA layer settlement from standard L1 calldata to Ethereum Blobspace for drastically reduced gas fees.
*   **P2P Mempool**: Transition the centralized Postgres/Redis queue into a true LibP2P gossip network.

---

*Built with ❤️ for the future of decentralized scaling.*
