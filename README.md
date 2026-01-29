# 📡 ZABRAN BROADCAST SYSTEM
> **Enterprise-Grade WhatsApp Broadcast & CRM Solution**

![Zabran System](https://img.shields.io/badge/Status-Stable-green) ![Version](https://img.shields.io/badge/Version-2.0-blue) ![Technology](https://img.shields.io/badge/Tech-MERN%20Stack-61DAFB)

Zabran Broadcast System is a powerful, self-hosted WhatsApp marketing and CRM tool designed for high-volume broadcasting, automated customer engagement, and real-time chat management. Built on the **Baileys** library, it offers a multi-session architecture (1 Account per User) without monthly subscription fees.

---

## 🚀 Key Features

### 📢 Advanced Broadcasting
- **Bulk Messaging:** Send messages to thousands of customers with a single click.
- **Smart Delays:** Intelligent random delays to prevent WhatsApp banning.
- **Media Support:** Send Images, Videos, and Documents.
- **Rate Limiting:** Protects your number by limiting messages per minute/hour.
- **Dynamic Variables:** Personalize messages with `{name}`, `{email}`, etc.

### 🤖 Automation & AI
- **Auto-Reply:** Keyword-based auto-responses.
- **AI Integration:** Integrated with AI models (OpenRouter/Groq) for smart replies.
- **Schedule:** Plan broadcasts for future dates and times.

### 👥 Customer Relationship Management (CRM)
- **Contact Management:** Import/Export contacts via CSV.
- **Tagging System:** Organize customers (Royal, Gold, Platinum).
- **History:** View full chat and broadcast history per customer.

### 🛡️ Security & Performance
- **Multi-Tenant:** Supports multiple admin accounts (each with their own WhatsApp session).
- **Rate Limiting API:** Built-in protection against DDoS and abuse.
- **Auto-Reconnect:** robust logic to handle WhatsApp disconnections automatically.

---

## 🛠️ Technology Stack

The system is built using modern web technologies:

- **Frontend:**
  - [React.js](https://reactjs.org/) (Vite)
  - [Tailwind CSS](https://tailwindcss.com/) (Styling)
  - [Socket.io Client](https://socket.io/) (Real-time updates)

- **Backend:**
  - [Node.js](https://nodejs.org/) (Runtime)
  - [Express.js](https://expressjs.com/) (API Framework)
  - [MongoDB](https://www.mongodb.com/) (Database)
  - [Baileys](https://github.com/WhiskeySockets/Baileys) (WhatsApp Web API)
  - [Socket.io](https://socket.io/) (WebSockets)
  - [PM2](https://pm2.keymetrics.io/) (Process Manager)

---

## ⚙️ Prerequisites

Before installing, ensure you have:
1.  **Node.js** (v18 or higher recommended)
2.  **MongoDB** (Local or Atlas) installed and running.
3.  **Git** installed.

---

## 📥 Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/ZxLanz/ZABRAN-BROADCAST-SYSTEM.git
    cd ZABRAN-BROADCAST-SYSTEM
    ```

2.  **Install Dependencies**
    You need to install dependencies for both Backend and Frontend.
    ```bash
    # Backend
    cd backend
    npm install

    # Frontend
    cd ../frontend
    npm install
    ```

3.  **Environment Setup**
    Create a `.env` file in `backend/` and `frontend/` (based on `.env.example` if available).
    
    **Backend `.env` example:**
    ```env
    PORT=5000
    MONGO_URI=mongodb://localhost:27017/zabran_broadcast
    JWT_SECRET=your_super_secret_key
    FRONTEND_URL=http://localhost:5173
    ```

---

## 🚦 Usage

We have provided specific scripts for Windows users for easy management.

### Starting the System
Run the `mulai.bat` script in the root directory.
```bash
.\mulai.bat
```
This will:
1. Start Nginx (Web Server)
2. Start Backend & Frontend via PM2.

### Restarting / Resetting
If you encounter issues, use the `sare.bat` (Saint Restart) script.
```bash
.\sare.bat
```
This will restart all processes and clear cache.

### Monitoring Logs
To view live logs of the system:
```bash
.\mon.bat
```

---

## 📂 Project Structure

```
ZABRAN-BROADCAST-SYSTEM/
├── backend/               # Node.js API & Logic
│   ├── config/            # DB & App Config
│   ├── controllers/       # Route Logic
│   ├── models/            # Mongoose Schemas
│   ├── routes/            # API Endpoints
│   ├── services/          # Business Logic (WhatsApp, AI)
│   └── utils/             # Helpers
├── frontend/              # React Dashboard
│   ├── src/
│   │   ├── components/    # Reusable UI
│   │   ├── pages/         # Main Views
│   │   └── utils/         # API Helpers
├── nginx-bin/             # Nginx Web Server (Portable)
└── scripts/               # Automation Scripts (.bat)
```

---

## 🤝 Contributing

This is a private enterprise system. Unauthorized distribution requires permission from **ZABRAN INTERNASIONAL GROUP**.

## 📄 License

Proprietary Software.
Copyright © 2026 **Lord Zilan**. All Rights Reserved.
