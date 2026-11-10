# 🚚 Supplier Delivery Prediction & Production Loss Prevention System

An end-to-end Machine Learning intelligence platform designed for manufacturing and automotive supply chains. The system predicts shipment delivery delays, calculates inventory buffer exhaustion (stockout dates), estimates production line financial losses in INR (₹), and automatically recommends verified alternative suppliers to prevent factory shutdowns.

---

## 📌 Executive Summary & Key Capabilities

- **Predictive Shipment Delay Regression**: Forecasts exact delivery arrival delays in days using an optimized **XGBoost Regressor** pipeline (`MAE = 1.29 Days`, `R² = 53.77%`).
- **Delivery Risk Classification**: Classifies orders into **Low**, **Medium**, or **High** delivery risk tiers with calibrated delay probabilities via an **XGBoost Classifier** (`ROC-AUC = 0.9301`, `Accuracy = 88.36%`).
- **Factory Buffer & Stockout Simulation**: Compares physical component delivery arrival timelines against factory inventory burn rates to compute the exact calendar **Stockout Date** and expected **Production Downtime**.
- **Financial Loss Quantification**: Converts downtime days and lost production units into direct financial loss estimates in INR (`₹`) with material shortfall vs. fixed line overhead breakdown.
- **Automated Alternative Supplier Engine**: Scans 150,000 candidate records across substitute suppliers to identify quality-approved substitute vendors, ranks them using **Multi-Criteria Decision Analysis (MCDA)** match scoring (0–100%), and calculates net financial savings.
- **Modern Decoupled Architecture**: Clean, minimalist **React 19** frontend with an authentic industrial design (no AI clutter or glowing gradients) powered by a high-performance **FastAPI** backend.

---

## 🚀 How to Run the Application

The platform is built with a decoupled architecture: a **FastAPI backend** and a **React 19 frontend**.

### 1. Prerequisites & Environment Setup

```bash
# Clone the repository
git clone https://github.com/UV-Srs/ML.git
cd "ML Main"

# Create and activate virtual environment
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate

# Install Python backend dependencies
pip install -r requirements.txt
```

---

### 2. Run the Backend (FastAPI)

From the project root:

```bash
uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```
*Or directly via Python:*
```bash
python backend/main.py
```

- **Backend API Base**: `http://127.0.0.1:8000`
- **Interactive Swagger Documentation**: `http://127.0.0.1:8000/docs`
- **API Endpoints**:
  - `GET  /api/health` — Model pipeline readiness and status.
  - `GET  /api/meta` — Cached supplier list, components with part descriptions, and destination plants.
  - `POST /api/predict/single` — Single PO delay prediction, downtime, financial loss, and MCDA alternative rankings.
  - `POST /api/predict/bulk` — CSV batch audit processing.

---

### 3. Run the Frontend (React + Vite)

Open a second terminal window:

```bash
cd frontend
npm install
npm run dev
```

- **React Dashboard**: Open [http://localhost:5173](http://localhost:5173) in your browser.
- All API calls to `/api/*` are automatically proxied to `http://127.0.0.1:8000`.

---

### 4. Single-Port Unified Production Mode

If you prefer to run both the React frontend and the FastAPI backend on a single port without keeping two terminal windows open:

```bash
# Build the React production bundle
cd frontend
npm install
npm run build
cd ..

# Start FastAPI (automatically serves the compiled React app at http://127.0.0.1:8000)
python backend/main.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) to access the complete application.

---

### 5. Legacy Streamlit Dashboard (Optional)

The original Streamlit dashboard is also maintained:

```bash
streamlit run app.py
```

---

## 📁 Project Directory Structure

```text
ML Main/
├── ml/                                          # Core Machine Learning Package
│   ├── models/                                  # Trained Production Model Artifacts
│   │   ├── combined_delivery_delay_pipeline.pkl (XGBoost Regressor Pipeline, Depth 14)
│   │   ├── combined_delivery_risk_pipeline.pkl  (XGBoost Classifier Pipeline, Depth 14)
│   │   └── alternative_supplier_engine.pkl      (MCDA Recommendation Engine & DB)
│   ├── predict.py                               # Inference pipeline & MCDA simulation engine
│   ├── generate_all_ml_graphs.py                # 13-figure ML diagnostic evaluation script
│   ├── generate_feature_graphs.py               # Feature importance extraction script
│   └── __init__.py                              # ML module package exports
├── backend/                                     # FastAPI Backend Service
│   └── main.py                                  # REST API endpoints & static React serving
├── frontend/                                    # React 19 Frontend
│   ├── src/
│   │   ├── App.jsx                              # Clean industrial dashboard UI
│   │   ├── index.css                            # Modern design system & typography
│   │   └── main.jsx                             # React entry point
│   ├── dist/                                    # Compiled production frontend build
│   ├── package.json                             # Frontend dependencies (React, Lucide, Vite)
│   └── vite.config.js                           # Vite build & API proxy configuration
├── data/
│   ├── raw/                                     # Raw procurement & supplier transaction datasets
│   └── processed/
│       ├── combined_supplier_delivery_data.csv  # 240,000 compiled delivery records
│       ├── meta_cache.json                      # Pre-computed metadata for fast startup
│       └── supplier_templates.csv               # Historical supplier profile templates
├── notebooks/                                   # Jupyter Training Notebooks (01 to 10)
│   ├── 08_Combined_Delivery_Model_Training.ipynb# Delay & risk model training & scaling
│   ├── 09_Production_Loss_Analysis.ipynb        # Loss calculation engine validation
│   └── 10_Alternative_Supplier_Model_Training.ipynb # Alternative supplier model training
├── reports/                                     # Evaluation figures & reports
├── app.py                                       # Legacy Streamlit Web Application
├── predict.py                                   # Compatibility shim pointing to ml/predict.py
├── requirements.txt                             # Python dependencies
├── .gitignore                                   # Git exclusion rules
└── README.md                                    # Project documentation
```

---

## 📊 Machine Learning Model Performance

Trained and evaluated on **240,000 automotive procurement transactions** spanning 100 suppliers and 20 distinct automotive component categories (`data/processed/combined_supplier_delivery_data.csv`). Evaluated on a **strict chronological 80/20 train/test split** (48,000 holdout test orders).

### 🏆 Model Performance Benchmark

| Evaluation Metric | Baseline Model | Optimized Production Model (v14) |
|---|---|---|
| **Classifier Overall Accuracy** | 75.77% | **`88.36%`** |
| **Classifier ROC-AUC** | 0.7991 | **`0.9301`** |
| **Delayed Class Recall** | 31.48% | **`73.06%`** |
| **Delayed Class Precision** | 80.30% | **`85.28%`** |
| **Classifier F1-Score** | 0.7100 | **`0.7870`** |
| **Regressor MAE** | 1.70 Days | **`1.29 Days`** |
| **Regressor RMSE** | 2.33 Days | **`1.82 Days`** |
| **$R^2$ Variance Explained** | 24.51% | **`53.77%`** |
| **Tolerance (within $\pm 1$ Day)** | 42.34% | **`54.56%`** |
| **Tolerance (within $\pm 2$ Days)** | 71.22% | **`80.75%`** |
| **Tolerance (within $\pm 3$ Days)** | 84.89% | **`90.20%`** |
| **Range-Normalized Accuracy** | 84.57% | **`88.26%`** |

---

## 🏭 Inventory Buffer & Production Loss Mathematics

$$\text{Stock Coverage Days} = \frac{\text{Available Inventory Buffer}}{\text{Daily Production Burn Rate}}$$

$$\text{Stockout Date} = \text{Order Date} + \text{Stock Coverage Days}$$

$$\text{Expected Delivery Date} = \text{Promised Date} + \text{Predicted Delay Days}$$

$$\text{Production Downtime Days} = \max\left(0, \text{Expected Delivery Date} - \text{Stockout Date}\right)$$

$$\text{Production Downtime Hours} = \text{Production Downtime Days} \times 24.0 \quad (\text{Industrial Shifts} = \frac{\text{Downtime Hours}}{8.0})$$

$$\text{Lost Production Units} = \text{Production Downtime Days} \times \text{Daily Production Burn Rate}$$

### Dual-Component Financial Loss Breakdown:
1. **Direct Material / Scrap Loss:**
   $$\text{Direct Loss} = \text{Lost Production Units} \times \text{Component Unit Price (₹)}$$
2. **Fixed Idle Assembly Line Overhead:**
   $$\text{Fixed Overhead Loss} = \text{Production Downtime Days} \times \text{Daily Facility Idling Overhead (₹)}$$
3. **Total Production Loss:**
   $$\text{Total Financial Loss (₹)} = \text{Direct Product Loss} + \text{Fixed Overhead Loss}$$

---

## 🔄 Multi-Criteria Decision Analysis (MCDA) Alternative Supplier Engine

When a delivery delay poses a stockout threat (`Expected Delivery Date > Stockout Date`), the alternative supplier engine evaluates substitute vendors using a 5-factor composite score:

$$\text{MCDA Score} = 0.35 \times S_{\text{LeadTime}} + 0.25 \times S_{\text{Financial}} + 0.20 \times S_{\text{Reliability}} + 0.10 \times S_{\text{Rating}} + 0.10 \times S_{\text{Quantity}}$$

- **Lead Time Feasibility ($S_{\text{LeadTime}}$, 35%):** Full score if arriving before warehouse stockout; proportional score based on downtime prevented.
- **Net Financial Benefit Ratio ($S_{\text{Financial}}$, 25%):** Net savings ($\text{Loss Avoided} - \text{Additional Procurement Cost}$) relative to baseline downtime loss.
- **Historical On-Time Reliability ($S_{\text{Reliability}}$, 20%):** Vendor's historical compliance percentage.
- **Supplier Rating & Quality ($S_{\text{Rating}}$, 10%):** Standardized 1–5 star rating mapped to $20 - 100\%$.
- **Quantity Fulfillment Ratio ($S_{\text{Quantity}}$, 10%):** Coverage percentage of required component quantity.

---

## 🛠️ Tech Stack

- **Backend:** Python 3.11+, FastAPI, Uvicorn, Pydantic
- **Frontend:** React 19, Vite, Lucide Icons, Modern Industrial CSS
- **Machine Learning:** `scikit-learn`, `xgboost`, `joblib`
- **Data Engineering:** `pandas`, `numpy`
- **Visualization:** `plotly`, `matplotlib`, `seaborn`

---

## 📄 License

This project is licensed under the MIT License.
