# StockSense Pro

> **Modular Real-Time Inventory Management System**  
> Designed for high-velocity warehouse operations, double-entry inventory auditing, and seamless transition away from manual spreadsheets. Built for the Odoo Hackathon.

---

## 🚀 Key Highlights

- **Double-Entry Ledger:** All stock movements are recorded as immutable transactions in `stock_moves` (Single Source of Truth).
- **Document Finite State Machine:** Strict lifecycle (`DRAFT` → `WAITING` → `READY` → `DONE`, with Manager-only `CANCELED`). Validations only permitted from `READY`.
- **Role-Based Access Control:** Distinct roles for `MANAGER` (master data, cancellation) and `STAFF` (operational receipt, picking/packing, validation).
- **Real-Time Collaboration:** Socket.io room segregation per warehouse for instant stock level updates and live notifications.
- **Hardware & Mobile Camera Scanning:** Barcode/QR code scanning using `html5-qrcode` for instant bin and product identification.
- **Secure Authentication:** JWT in `httpOnly` cookies with cryptographic 6-digit OTP password recovery (10-minute expiry, single-use, hashed).

---

## 📁 Repository Structure

```
stocksense-pro/
├── .agent/
│   └── rules.md             # Antigravity/agent instructions and guidelines
├── client/                  # Frontend SPA (React 18 + Vite + Tailwind + shadcn/ui + Zustand)
│   ├── src/                 # UI components, stores, hooks, and pages
│   ├── .env.example         # Client environment template
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts
├── server/                  # Backend API (Node + Express + Prisma + Socket.io + Zod)
│   ├── prisma/
│   │   └── schema.prisma    # PostgreSQL relational schema
│   ├── src/                 # Express app, routers, controllers, services, socket handlers
│   ├── .env.example         # Server environment template
│   ├── package.json
│   └── tsconfig.json
├── docs/
│   └── PROJECT_SPEC.md      # Complete architectural & product specification
└── README.md
```

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Client** | React 18, Vite, TypeScript, Tailwind CSS, shadcn/ui, Zustand, Socket.io Client, html5-qrcode |
| **Server** | Node.js, Express, TypeScript, Zod, Prisma ORM, PostgreSQL, Socket.io |
| **Auth** | JWT (httpOnly cookie), SHA-256 OTP tokens, bcryptjs |
| **API** | RESTful `/api/v1` routes with strict Zod validation on every endpoint |

---

## 🏁 Getting Started

### 1. Environment Configuration

Copy the sample environment files:

```bash
# Client configuration
cp client/.env.example client/.env

# Server configuration
cp server/.env.example server/.env
```

### 2. Install Dependencies

```bash
# Install client dependencies
cd client
npm install

# Install server dependencies
cd ../server
npm install
```

### 3. Database Setup (Prisma)

Ensure PostgreSQL is running, then run:

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
```

### 4. Running Locally

Start both servers in development mode:

```bash
# In terminal 1 (Server - port 5000):
cd server
npm run dev

# In terminal 2 (Client - port 5173):
cd client
npm run dev
```

---

## 📖 Specifications & Design Rules

Consult [PROJECT_SPEC.md](docs/PROJECT_SPEC.md) for full architectural guidelines, database schema diagrams, state machine rules, and API specifications.
