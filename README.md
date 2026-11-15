# 🏏 IPL Auction Arena

A production-oriented, real-time multiplayer IPL Cricket Player Auction web application.

---

## 🌟 Tech Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Frontend** | React 18 + Vite | Fast, responsive Single Page Application |
| **Styling** | Tailwind CSS + Lucide Icons | Premium Dark Navy sports broadcast dashboard UI |
| **Backend** | Node.js + Express.js | Modular RESTful API and WebSocket orchestration |
| **Database** | MongoDB Atlas via Mongoose | Scalable cloud document database for squads, rooms & bids |
| **Real-time** | Socket.IO | Sub-50ms live auction bids, timers & room events |
| **Authentication** | JWT (JSON Web Tokens) | Secure room hosting and franchise manager sessions |

---

## 🎨 Design System

- **Primary Interface Colors:** Dark Navy Blue (`#070C18`, `#0B132B`, `#111B38`) and Cricket Blue (`#1E40AF`, `#2563EB`).
- **Accent Highlights:** Warm Orange (`#FF6B00`), Trophy Gold (`#F59E0B`, `#FDB913`), and Light Status Green (`#10B981`).
- **Franchise Branding:** All 10 IPL franchises (CSK, MI, RCB, KKR, DC, RR, SRH, GT, LSG, PBKS) feature authentic team-specific branding colors, emblems, and visual assets. **No generic uniform color scheme is applied across teams.**

---

## 📁 Project Structure

```text
ipl/
├── backend/
│   ├── config/
│   │   └── db.js                 # MongoDB Atlas connection handler
│   ├── controllers/
│   │   └── healthController.js   # Health check and telemetry controller
│   ├── middleware/
│   │   └── errorHandler.js       # 404 and global error handler
│   ├── models/                   # Mongoose schemas (Rooms, Players, Franchises)
│   ├── routes/
│   │   └── healthRoutes.js       # /api/health endpoint
│   ├── socket/
│   │   └── index.js              # Socket.IO server initialization & events
│   ├── .env                      # Local environment configuration
│   ├── .env.example              # Environment variables template
│   ├── package.json              # Backend dependencies and scripts
│   └── server.js                 # Express + HTTP + Socket.IO entry point
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── AuctionPreview.jsx# Real-time bidding podium preview & room demo
│   │   │   ├── Footer.jsx        # Dashboard footer & tech stack pills
│   │   │   ├── Navbar.jsx        # Sticky navigation with live telemetry badges
│   │   │   ├── StatusCard.jsx    # Express, Socket.IO & MongoDB status card
│   │   │   ├── TeamCard.jsx      # Franchise card with unique team styling & purse
│   │   │   └── TeamsGrid.jsx     # All 10 IPL teams with champions filter & modal
│   │   ├── data/
│   │   │   └── teamsData.js      # Official data for all 10 IPL franchises
│   │   ├── App.jsx               # Main React dashboard application
│   │   ├── index.css             # Tailwind directives & cricket UI scrollbars
│   │   └── main.jsx              # React DOM entry point
│   ├── index.html                # HTML5 entry with Teko + Inter typography
│   ├── package.json              # Frontend dependencies and scripts
│   ├── postcss.config.js         # PostCSS configuration
│   ├── tailwind.config.js        # Custom dark navy theme configuration
│   ├── vite.config.js            # Vite configuration
│   ├── .env                      # Frontend local environment
│   └── .env.example              # Frontend environment template
│
├── .gitignore                    # Git ignore file
└── README.md                     # Project documentation
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18.0.0 or higher (Tested on Node v24.x)
- **npm**: v9.0.0 or higher
- **MongoDB Atlas Account**: Free Tier (M0) or dedicated cluster

---

### Step 1: Environment Configuration

#### 1. Backend Configuration
Navigate to `backend/` and configure your `.env` file (copied from `.env.example`):

```bash
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:5173

# MongoDB Atlas Connection String
# Replace <username>, <password>, and <cluster-url> with your Atlas credentials
MONGODB_URI=mongodb+srv://<username>:<password>@<cluster-url>/ipl_auction_arena?retryWrites=true&w=majority

# JWT Authentication Secret
JWT_SECRET=your_jwt_super_secret_key_change_in_production
```

#### 2. Frontend Configuration
Navigate to `frontend/` and configure your `.env` file (copied from `.env.example`):

```bash
VITE_BACKEND_URL=http://localhost:5000
```

---

### Step 2: Running the Application

You can run the backend and frontend in separate terminals:

#### Terminal 1 — Start the Backend Server:
```bash
cd backend
npm run dev
# or: npm start
```
*Backend runs on:* `http://localhost:5000`  
*API Health Endpoint:* `http://localhost:5000/api/health`

#### Terminal 2 — Start the Frontend Dev Server:
```bash
cd frontend
npm run dev
```
*Frontend runs on:* `http://localhost:5173`

---

## 🍃 MongoDB Atlas Configuration Instructions

To connect your MongoDB Atlas cloud database:

1. **Sign in / Create Account**: Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. **Create a Free Cluster**: Deploy a free shared cluster (`M0 Sandbox`).
3. **Configure Database Access (User)**:
   - Go to **Security** → **Database Access**.
   - Click **Add New Database User**.
   - Choose **Password** authentication.
   - Assign the user `Read and write to any database` privilege.
4. **Configure Network Access (IP Whitelist)**:
   - Go to **Security** → **Network Access**.
   - Click **Add IP Address**.
   - For development, select **Allow Access from Anywhere** (`0.0.0.0/0`) or add your current public IP.
5. **Get Connection String**:
   - Go to **Deployments** → **Database** → Click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection string format:
     `mongodb+srv://<username>:<password>@<cluster>.mongodb.net/ipl_auction_arena?retryWrites=true&w=majority`
6. **Paste in `backend/.env`**:
   - Replace `<username>` and `<password>` with the database user credentials created in Step 3.
   - Set `MONGODB_URI` in `backend/.env`.
7. **Restart the backend server**; the health check will automatically report `database: { connected: true, status: "connected" }`.

---

## 🩺 Verifying Health & Real-Time Connectivity

1. Open `http://localhost:5000/api/health` in your browser or curl to inspect the JSON telemetry:
   ```json
   {
     "success": true,
     "message": "IPL Auction Arena API is operating smoothly",
     "timestamp": "2026-11-14T15:42:03.365Z",
     "uptime": "5 seconds",
     "environment": "development",
     "version": "1.0.0",
     "services": {
       "api": { "status": "healthy", "port": 5000 },
       "websocket": { "status": "initialized", "path": "/socket.io" },
       "database": {
         "provider": "MongoDB Atlas",
         "status": "connected",
         "connected": true
       }
     }
   }
   ```
2. Open `http://localhost:5173` in your browser. The dashboard displays:
   - Live Express API connection indicator
   - Socket.IO connection status with live ping-pong latency measurement
   - All 10 IPL Franchises with individual team color branding, purse bars, trophies, and stadiums
   - Interactive auction room preview with countdown timer and interactive bid testing

---

## 📊 Data Attribution & Licensing

This project incorporates ball-by-ball cricket match statistics from [Cricsheet](https://cricsheet.org/).

- **Data Provider:** [Cricsheet](https://cricsheet.org/)
- **License:** [Open Data Commons Attribution License (ODC-By) v1.0](https://opendatacommons.org/licenses/by/1.0/)
- **Historical IPL Dataset Scope:** 2008 through 2026 (19 seasons, 1,243 matches, 295,732 deliveries)
- **Dataset Usage Description:**
  - Cricsheet ball-by-ball deliveries (`all_matches.csv`) and canonical identity dictionaries (`names.csv`, `people.csv`) are parsed to generate authentic career milestones (runs, balls faced, wickets, legal overs, strike rates, economy rates, best bowling figures, centuries, and fifties).
  - Player records feature structured season-by-season performance metrics and chronological franchise histories across all 19 IPL editions.
  - Historical dataset enhancements and 2025–2026 match schedules incorporate data from the [Indian Premier League historical repository](https://github.com/aadi-jn/indian-premier-league).
  - All original Cricsheet licensing texts are preserved in [backend/data/cricsheet/LICENSE.txt](file:///backend/data/cricsheet/LICENSE.txt) and [backend/data/cricsheet/README.txt](file:///backend/data/cricsheet/README.txt).
