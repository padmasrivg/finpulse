# FinPulse — AI-Powered Expense Intelligence Platform

> Hackathon-ready full-stack expense monitoring with ML anomaly detection, AI insights, and a conversational assistant.

![Tech Stack](https://img.shields.io/badge/Python-Flask-blue?style=flat-square)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-green?style=flat-square)
![ML](https://img.shields.io/badge/ML-IsolationForest-orange?style=flat-square)

---

## 📁 Project Structure

```
finpulse/
├── backend/
│   ├── app.py              # Flask API — all routes
│   ├── model.py            # ML engine (Isolation Forest, insights, chat)
│   ├── db.py               # MongoDB connection & indexing
│   └── requirements.txt    # Python dependencies
│
├── frontend/
│   ├── index.html          # Expense entry form + recent transactions
│   ├── dashboard.html      # Full analytics dashboard
│   ├── css/
│   │   └── style.css       # Dark fintech UI (Space Mono + Syne)
│   └── js/
│       └── script.js       # API integration, Chart.js, chat
│
├── data/
│   └── sample_expenses.csv # 46 demo transactions (EdTech + Professional)
│
└── README.md
```

---

## 🚀 Quick Start

### Prerequisites
- Python 3.9+
- MongoDB (local or Atlas URI)
- Modern browser (Chrome, Firefox, Edge)

---

### 1. Start MongoDB

**Local:**
```bash
mongod --dbpath /data/db
```

**Or use MongoDB Atlas** — grab your connection string.

---

### 2. Backend Setup

```bash
cd finpulse/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate       # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables (optional — defaults shown)
export MONGODB_URI="mongodb://localhost:27017"
export MONGODB_DB="finpulse"

# Start Flask API
python app.py
```

The API will start at `http://localhost:5000`.

---

### 3. Frontend

Open `frontend/index.html` directly in your browser — **no build step needed**.

```bash
# Option 1: Just open the file
open frontend/index.html

# Option 2: Serve with Python
cd frontend
python -m http.server 8080
# Then visit http://localhost:8080
```

---

### 4. Load Sample Data

1. Open `http://localhost:8080` (or open `index.html`)
2. Click **"Load Sample Data"** button
3. Confirm import — 46 transactions (24 EdTech + 22 Professional) will be loaded
4. Navigate to **Dashboard** to see full analytics

---

## 🧠 Features

### Expense Entry (index.html)
- Category pill selector (changes per company type)
- Real-time hero stats update after each entry
- Mini category distribution bar chart
- Recent transaction feed
- One-click sample data import

### Dashboard (dashboard.html)
- **KPI Cards**: Total expenses, transaction count, average, anomaly count
- **Monthly Trend Line Chart** (Chart.js)
- **Category Donut Chart** with custom legend
- **Category Bar Chart**
- **Anomaly Detection**: Isolation Forest via `/api/dashboard/anomalies`
- **AI Insights**: Overspending flags, MoM spikes, category-specific recommendations
- **Chat Assistant**: Natural language Q&A about your finances
- **Transaction Table**: Full ledger with delete support

---

## 🏢 Company Types

### EdTech
| Category | Tracked | Insight |
|---|---|---|
| Marketing | Ad spend across channels | CAC vs enrollment ratio |
| Cloud | Infrastructure costs | Spike detection, reserved instance tips |
| Instructor | Instructor/faculty fees | Volume contract optimization |
| Content | Video/podcast/design | Cost-per-student-enrolled |

### Professional Services
| Category | Tracked | Insight |
|---|---|---|
| Travel | Client/internal trips | Billable vs non-billable ratio |
| Salary | Payroll & benefits | Utilisation rate analysis |
| Software | SaaS licences | Unused licence audit |
| Office | Rent, supplies, utilities | Hot-desking opportunity |

---

## 🔌 API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/expenses` | Add single expense |
| `GET` | `/api/expenses` | List expenses (`?company_type=edtech`) |
| `DELETE` | `/api/expenses/:id` | Delete expense |
| `POST` | `/api/expenses/bulk` | Bulk import |
| `GET` | `/api/dashboard/summary` | KPIs + category stats + monthly trends |
| `GET` | `/api/dashboard/anomalies` | Run Isolation Forest scan |
| `GET` | `/api/insights` | Generate AI insights |
| `POST` | `/api/chat` | Chat assistant |
| `GET` | `/api/config/categories` | Category config per company type |

---

## 🤖 ML / AI Engine (`model.py`)

### Anomaly Detection
- **Algorithm**: `sklearn.ensemble.IsolationForest`
- **Features**: `amount`, `category_encoded`, `day_of_month`
- **Contamination**: 10% (top anomalous flagged)
- **Output**: Anomaly score, severity %, human-readable reason

### AI Insights
- Category overspending threshold (40% of budget)
- Month-over-month spike detection (>25% growth)
- EdTech-specific: Marketing vs Cloud spend ratio
- Professional-specific: Travel efficiency, SaaS audit flags
- Cost reduction opportunity sizing (15% potential saving)

### Chat Assistant
- Intent routing via keyword matching
- Statistical responses backed by live expense data
- Markdown-formatted responses rendered in frontend

---

## 🎨 Design System

- **Theme**: Dark fintech terminal
- **Display Font**: Syne (headings, UI labels)
- **Data Font**: Space Mono (numbers, code, tags)
- **Primary Accent**: `#00e5ff` (electric cyan)
- **Secondary**: `#00ff9d` (neon green), `#ffb700` (amber), `#ff4757` (red alert)
- **Background**: `#080c10` (void black) with grid overlay

---

## 🔧 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB` | `finpulse` | Database name |

---

## 📦 Dependencies

**Backend:**
- `flask` — Web framework
- `flask-cors` — CORS support
- `pymongo` — MongoDB driver
- `pandas` — Data analysis
- `numpy` — Numerical operations
- `scikit-learn` — Isolation Forest ML
- `python-dotenv` — Env variable management

**Frontend (CDN):**
- Bootstrap 5.3
- Bootstrap Icons 1.11
- Chart.js 4.4
- Google Fonts (Syne + Space Mono)

---

## 🏆 Hackathon Highlights

1. **Zero ML boilerplate** — Isolation Forest wired end-to-end in < 50 lines
2. **Real AI chat** — Statistical NLP assistant with financial context
3. **Dual company support** — Switch between EdTech / Professional modes live
4. **Production-grade code** — Proper error handling, indexes, connection pooling
5. **No build step** — Pure HTML/CSS/JS frontend, opens directly in browser

---
<img width="1922" height="848" alt="image" src="https://github.com/user-attachments/assets/c7b5023b-7506-4868-ad40-b7796c35fa51" />


<img width="1922" height="848" alt="image" src="https://github.com/user-attachments/assets/34902985-bfb5-46df-9a88-2aa66bc7544a" />


<img width="1922" height="848" alt="image" src="https://github.com/user-attachments/assets/d7e4ff9e-cd53-4b32-8c26-608562a87665" />


<img width="1922" height="848" alt="image" src="https://github.com/user-attachments/assets/fbf6bcbd-9509-407f-90d3-e9d0b7d2918a" />


<img width="1922" height="848" alt="image" src="https://github.com/user-attachments/assets/45fd5cfd-9669-4916-be40-33f9eef4308e" />




