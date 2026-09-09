# NextGen CMS

An intelligent, comprehensive **Election Campaign & Booth Management System (CMS)** engineered for real-time field operations, voter sentiment analytics, booth management, and volunteer coordination.

---

## 🌟 Key Features

- **🔐 Robust Authentication & Role-Based Access Control**:
  - Google Sign-In with interactive account selection
  - Email/Password authentication with password reset and profile management
  - Hierarchical roles: Super Admin, Admin, Constituency Incharge, Booth Level Officer (BLO), Volunteer

- **🗳️ Booth & Cadre Management**:
  - Manage States, Districts, Parliamentary Constituencies (PC), Assembly Constituencies (AC), and Polling Booths
  - Assign cadre/volunteers directly to specific booths with live dispatch status

- **👥 Voter Analytics & Live Polling**:
  - Voter registry with demographic filtering (Age, Gender, Religion, Caste, Occupation)
  - Real-time voter mood and party leaning tagging (Favored, Neutral, Opposed)
  - Live survey campaigns and ground feedback collection

- **📊 Advanced Real-Time Dashboard**:
  - Interactive turnout tracker, swing prediction, cadre strength heatmaps, and sentiment trends
  - Export capabilities for reports in Excel/CSV formats

- **💾 Enterprise Local Database Storage**:
  - Powered by **Microsoft SQL Server (MSSQL)** with parameterized, transaction-safe queries
  - Fully offline/on-premise local database support (SSMS compatible)

---

## 🏗️ Architecture & Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Motion, Vite
- **Backend API**: Node.js, Express, TypeScript (`tsx`), `mssql` (Node MSSQL driver)
- **Database**: Microsoft SQL Server (MSSQL)
- **Authentication**: Firebase Google Auth

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js** (v18 or higher recommended)
- **Microsoft SQL Server** & **SQL Server Management Studio (SSMS)**

---

### 2. Database Setup (MSSQL)
1. Open **SQL Server Management Studio (SSMS)** and connect to your SQL Server instance.
2. Open and execute the script [`setup_nextgencms_mssql.sql`](setup_nextgencms_mssql.sql).
3. The script will automatically:
   - Create the `nextgencms` database.
   - Create the user `election_user` with password `your_password` (or customize credentials as needed).
   - Create all 16 relational tables with indexes and default data.

---

### 3. Environment Configuration
Create a `.env` file in the root directory (or copy `.env.example`):

```env
PORT=3000

# MSSQL Database Credentials
DB_USER=election_user
DB_PASSWORD=your_password
DB_SERVER=localhost
DB_DATABASE=nextgencms
DB_PORT=1433

# Optional AI / App Configuration
APP_URL=http://localhost:3000
```

---

### 4. Installation & Running

```bash
# Install dependencies
npm install

# Start development server (both Express REST API & Vite Frontend)
npm run dev
```

Open your browser at **`http://localhost:3000`**.

---

## 📁 Project Structure

```
nextgencms/
├── setup_nextgencms_mssql.sql   # Complete MSSQL database setup & schema
├── server.ts                    # Express backend REST API & Vite SSR integration
├── src/
│   ├── components/              # React UI components (Dashboard, Booths, Voters, etc.)
│   ├── lib/                     # Firebase Auth & API client helpers
│   ├── server/                  # MSSQL database pool connection & query helpers
│   ├── types.ts                 # TypeScript data contracts & schemas
│   ├── App.tsx                  # Root application router & layout
│   └── main.tsx                 # Frontend entry point
├── package.json
└── vite.config.ts
```

---

## 📄 License
ISC / Private

