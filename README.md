# 🚚 Supplier Delivery Prediction & Production Loss Prevention System

An end-to-end Machine Learning intelligence platform designed for manufacturing and automotive supply chains. The system predicts shipment delivery delays, calculates inventory buffer exhaustion (stockout dates), estimates production line financial losses in INR (₹), and automatically recommends verified alternative suppliers to prevent factory shutdowns.

---

## 📌 Executive Summary & Key Capabilities

- **Predictive Shipment Delay Regression**: Forecasts exact delivery arrival delays in days using an optimized **XGBoost Regressor** pipeline.
- **Delivery Risk Classification**: Classifies orders into **Low**, **Medium**, or **High** delivery risk tiers with calibrated delay probabilities via an **XGBoost Classifier**.
- **Factory Buffer & Stockout Simulation**: Compares physical component delivery arrival timelines against factory inventory burn rates to compute the exact calendar **Stockout Date** and expected **Production Downtime**.
- **Financial Loss Quantification**: Converts downtime days and lost production units into direct financial loss estimates in INR (`₹`).
- **Automated Alternative Supplier Engine**: Scans 40,000 candidate records across 1,900 suppliers to identify quality-approved substitute vendors, ranks them by **Net Financial Benefit**, and simulates 3 operational procurement scenarios.
- **Interactive Streamlit Dashboard**: Executive-grade UI featuring zero-truncation responsive KPI cards, timeline journey strips, interactive Plotly visualizations, and bulk batch processing.

---

> **Branch Note (`acc-`):** This branch contains the advanced feature-engineered models (`Transit_Velocity`, `Volume_Stress`, `Cost_Per_KM`, `Supplier_Risk_Velocity`, `Month_Sin/Cos`, `Rush_Flags`) and deep tree gradient boosting (`n_estimators=450, max_depth=10`).

---

## 📊 Machine Learning Model Architecture & Performance (Branch: `acc-`)

Trained and evaluated on **240,000 automotive procurement transactions** spanning 100 suppliers and 20 distinct automotive component categories (`data/processed/combined_supplier_delivery_data.csv`). Evaluated on a **strict chronological 80/20 train/test split** (48,000 holdout test orders) to prevent data leakage.

### 🏆 Side-by-Side Comparison: `main` vs `acc-` Branch

| Evaluation Metric | `main` Branch | `acc-` Branch (This Branch) | Improvement |
|---|---|---|---|
| **Classifier Overall Accuracy** | 75.77% | **`78.40%`** | **+2.63% (up from 62.98% originally)** |
| **Classifier ROC-AUC** | 0.7991 | **`0.8437`** | **+0.0446 (~0.84)** |
| **Delayed Class Precision** | 80.30% | **`86.58%`** | **+6.28%** |
| **Classifier Weighted F1** | 0.71 | **`0.75`** | **+0.04** |
| **Regressor MAE** | 1.70 Days | **`1.60 Days`** | **Lower Error (-0.10d)** |
| **Regressor RMSE** | 2.33 Days | **`2.20 Days`** | **Lower Error (-0.13d)** |
| **$R^2$ Variance Explained** | 24.51% | **`32.67%`** | **+8.16% (2.3x original)** |
| **Tolerance (within $\pm 1$ Day)** | 42.34% | **`44.69%`** | **+2.35%** |
| **Tolerance (within $\pm 2$ Days)** | 71.22% | **`73.52%`** | **+2.30%** |
| **Tolerance (within $\pm 3$ Days)** | 84.89% | **`86.20%`** | **+1.31%** |
| **Range-Normalized Accuracy** | 84.57% | **`85.48%`** | **+0.91%** |

### 1. Delivery Delay Regression Model (`XGBRegressor`)
Predicts the exact number of days a shipment will be delayed beyond its promised date:
- **Mean Absolute Error (MAE):** `1.60 Days` *(down from 1.70d on main, and 1.83d originally)*
- **Root Mean Squared Error (RMSE):** `2.20 Days` *(down from 2.33d on main, and 2.49d originally)*
- **R-squared ($R^2$):** `0.3267` (`32.67%` variance explained, up from 24.51% on main)
- **Tolerance Accuracy (within ±1 Day):** `44.69%`
- **Tolerance Accuracy (within ±2 Days):** `73.52%` *(up from 71.22%)*
- **Tolerance Accuracy (within ±3 Days):** `86.20%` *(up from 84.89%)*
- **Range-Normalized Accuracy:** `85.48%`

### 2. Delivery Risk Classification Model (`XGBClassifier`)
Predicts whether an order will be delayed (`Actual_Delay_Days > 0`):
- **Overall Accuracy:** `78.40%` *(up from 75.77% on main, and 62.98% originally)*
- **ROC-AUC Score:** `0.8437` (~`0.84`, up from 0.7991 on main)
- **Delayed Class Precision:** `86.58%` *(up from 80.30% on main)*
- **On-Time Class Precision:** `77.00%`
- **F1-Score:** `0.75` (weighted avg) / `0.46` (macro delayed)

---

## 🏭 High-Precision Production Loss & Inventory Simulation Engine

The engine models the physical relationship between factory warehouse stock, assembly line shift operations, and component delivery arrival:

$$\text{Stock Coverage Days} = \frac{\text{Available Inventory Buffer}}{\text{Daily Production Burn Rate}}$$

$$\text{Stockout Date} = \text{Order Date} + \text{Stock Coverage Days}$$

$$\text{Expected Delivery Date} = \text{Promised Date} + \text{Predicted Delay Days}$$

$$\text{Production Downtime Days} = \max\left(0, \text{Expected Delivery Date} - \text{Stockout Date}\right)$$

$$\text{Production Downtime Hours} = \text{Production Downtime Days} \times 24.0 \quad (\text{Industrial Shifts} = \frac{\text{Downtime Hours}}{8.0})$$

$$\text{Lost Production Units} = \text{Production Downtime Days} \times \text{Daily Production Burn Rate}$$

### Dual-Component Industrial Financial Loss Breakdown:
1. **Direct Material / Scrap Loss:**
   $$\text{Direct Loss} = \text{Lost Production Units} \times \text{Component Unit Price (₹)}$$
2. **Fixed Idle Assembly Line Overhead:**
   $$\text{Fixed Overhead Loss} = \text{Production Downtime Days} \times \text{Daily Facility Idling Overhead (₹)}$$
3. **Total Production Loss:**
   $$\text{Total Financial Loss (₹)} = \text{Direct Product Loss} + \text{Fixed Overhead Loss}$$

---

## 🔄 High-Precision Alternative Supplier Recommendation Engine

When a stockout is detected (`Expected Delivery Date > Stockout Date`), the system queries the alternative supplier candidate database (`40,000 records`):

### 1. Calibrated Machine Learning Classifier (`XGBClassifier`)
Trained on 40,000 automotive procurement candidate records with balanced weighting (`scale_pos_weight=3.0`):
- **Overall Accuracy:** `99.96%`
- **Precision:** `99.93%` *(Boosted from 13.84% in uncalibrated baseline)*
- **Recall:** `99.86%`
- **F1-Score:** `0.9990`
- **ROC-AUC Score:** `1.0000`

### 2. Multi-Criteria Decision Analysis (MCDA) Match Scoring (0–100%)
Every verified candidate supplier is ranked using an executive 5-factor composite score:
$$\text{MCDA Score} = 0.35 \times S_{\text{LeadTime}} + 0.25 \times S_{\text{Financial}} + 0.20 \times S_{\text{Reliability}} + 0.10 \times S_{\text{Rating}} + 0.10 \times S_{\text{Quantity}}$$
- **Lead Time Feasibility ($S_{\text{LeadTime}}$, 35%):** Full score if arriving before warehouse stockout; proportional score based on days of plant downtime saved.
- **Net Financial Benefit Ratio ($S_{\text{Financial}}$, 25%):** Savings ratio ($\text{Loss Avoided} - \text{Additional Procurement Cost}$) relative to baseline risk.
- **Historical On-Time Reliability ($S_{\text{Reliability}}$, 20%):** Vendor's historical compliance percentage.
- **Supplier Rating & Quality ($S_{\text{Rating}}$, 10%):** Standardized 1–5 star rating mapped to $20 - 100\%$.
- **Quantity Fulfillment Ratio ($S_{\text{Quantity}}$, 10%):** Coverage percentage of required component quantity.

### 3. Three-Scenario Operational Simulation
- **Scenario A:** Original Supplier Only (full delay, full factory downtime, maximum financial loss).
- **Scenario B:** Runner-Up Alternative (secondary verified supplier).
- **Scenario C:** Best Feasible Alternative (highest MCDA score, maximum downtime prevented, highest net savings).

---

## 📁 Project Directory Structure

```text
ML Main/
├── data/
│   ├── raw/
│   │   ├── supplier_delivery_data_90000.csv
│   │   ├── supplier_delivery_data_150000_synthetic.csv
│   │   ├── alternative_supplier_data_40000.csv
│   │   └── alternative_supplier_data_150000_synthetic.csv
│   └── processed/
│       └── combined_supplier_delivery_data.csv  (240,000 records)
├── models/
│   ├── combined_delivery_delay_pipeline.pkl     (Trained XGBoost Delay Pipeline)
│   ├── combined_delivery_risk_pipeline.pkl      (Trained XGBoost Risk Classifier)
│   └── alternative_supplier_engine.pkl          (Candidate DB & Recommendation Engine)
├── notebooks/
│   ├── 07_Compile Suppliers.ipynb               (Raw data compilation into 240k records)
│   ├── 08_Combined_Delivery_Model_Training.ipynb(Delay & risk model training & evaluation)
│   ├── 09_Production_Loss_Analysis.ipynb        (Loss calculation engine validation)
│   └── 10_Alternative_Supplier_Model_Training.ipynb (Alternative supplier engine training)
├── app.py                                       (Streamlit Web Application)
├── predict.py                                   (Production Inference & Simulation API)
├── check_models.py                              (Model inspection & integrity utility)
├── requirements.txt                             (Project dependencies)
├── .gitignore                                   (Git exclusion rules)
└── README.md                                    (Project documentation)
```

---

## 📓 Jupyter Notebook Workflow

All machine learning development and validation is conducted exclusively inside Jupyter Notebooks:

1. **`07_Compile Suppliers.ipynb`**:
   - Loads and merges raw delivery data (`90,000` + `150,000` records).
   - Validates schema, cleans anomalies, and exports `combined_supplier_delivery_data.csv` (240k rows, 45 columns).
2. **`08_Combined_Delivery_Model_Training.ipynb`**:
   - Full data inspection, feature engineering, and leakage prevention.
   - Chronological 80/20 train/test split.
   - Trains and evaluates `XGBRegressor` and `XGBClassifier`.
   - Exports `combined_delivery_delay_pipeline.pkl` and `combined_delivery_risk_pipeline.pkl`.
3. **`09_Production_Loss_Analysis.ipynb`**:
   - Simulates inventory burn rates across varying stock buffer and delay scenarios.
   - Validates edge cases (zero inventory, zero daily production).
4. **`10_Alternative_Supplier_Model_Training.ipynb`**:
   - Inspects alternative candidate schemas and compatibility matrices.
   - Implements multi-factor candidate scoring and timeline simulation.
   - Serializes `alternative_supplier_engine.pkl`.

---

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <YOUR_GITHUB_REPOSITORY_URL>
cd "ML Main"
```

### 2. Create and Activate Virtual Environment
```bash
# Windows
python -m venv .venv
.\.venv\Scripts\activate

# macOS / Linux
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

### 4. Verify Model Artifacts
```bash
python check_models.py
```

### 5. Launch the Streamlit Dashboard
```bash
streamlit run app.py
```

---

## 🖥️ Streamlit Dashboard Modules

1. **Dashboard Overview**:
   - High-level KPIs: Total Orders (240k), Catalog Items (20), Monitored Suppliers (100), Average Historical Delay.
   - Interactive historical transactions data table.
2. **Manual Purchase Order Simulation**:
   - Input PO parameters: Supplier, Item, Quantity, Order Date, Promised Date, Buffer Stock, Daily Burn Rate, Unit Price.
   - Instant delay prediction, delay probability, risk tier, and stock buffer coverage.
   - Real-time stockout detection with reason, top alternative recommendation card, 7-column supplier comparison table, and 3-scenario operational impact comparison with Plotly charts.
3. **Bulk CSV Prediction**:
   - Upload batch CSVs containing PO and inventory fields.
   - Executes batch inference and stockout audits with one click.
   - Export downloadable audit reports as CSV.

---

## 🛠️ Tech Stack & Libraries

- **Language:** Python 3.11+
- **Machine Learning:** `scikit-learn`, `xgboost`, `joblib`
- **Data Manipulation:** `pandas`, `numpy`
- **Visualization:** `plotly`, `matplotlib`, `seaborn`
- **Web Dashboard:** `streamlit`

---

## 📄 License

This project is licensed under the MIT License.

