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

## 📊 Machine Learning Model Architecture & Performance

Trained and evaluated on **240,000 automotive procurement transactions** spanning 100 suppliers and 20 distinct automotive component categories (`data/processed/combined_supplier_delivery_data.csv`). Evaluated on a **strict chronological 80/20 train/test split** (48,000 holdout test orders) to prevent data leakage.

### 1. Delivery Delay Regression Model (`XGBRegressor`)
Predicts the exact number of days a shipment will be delayed beyond its promised date:
- **Mean Absolute Error (MAE):** `1.83 Days` *(predictions deviate on average by under 1.9 days)*
- **Root Mean Squared Error (RMSE):** `2.49 Days`
- **R-squared ($R^2$):** `0.1371`

### 2. Delivery Risk Classification Model (`XGBClassifier`)
Predicts whether an order will be delayed (`Actual_Delay_Days > 0`):
- **Accuracy:** `62.98%` (~`63.0%`)
- **ROC-AUC Score:** `0.7087` (`0.71`)
- **Recall (Delayed Class):** `70.39%` *(prioritizes catching >70% of all delayed shipments to trigger timely mitigation)*
- **Precision (Delayed Class):** `42.25%`
- **F1-Score:** `0.5280`
- **On-Time Class Precision:** `83.0%`
- **On-Time Class Recall:** `60.0%`

---

## 🏭 Production Loss & Inventory Simulation Engine

The engine models the physical relationship between factory warehouse stock and component delivery:

$$\text{Stock Coverage Days} = \frac{\text{Available Inventory Buffer}}{\text{Daily Production Burn Rate}}$$

$$\text{Stockout Date} = \text{Order Date} + \text{Stock Coverage Days}$$

$$\text{Expected Delivery Date} = \text{Promised Date} + \text{Predicted Delay Days}$$

$$\text{Production Downtime Days} = \max\left(0, \text{Expected Delivery Date} - \text{Stockout Date}\right)$$

$$\text{Lost Production Units} = \text{Production Downtime Days} \times \text{Daily Production Burn Rate}$$

$$\text{Total Production Loss (₹)} = \text{Lost Production Units} \times \text{Component Unit Price (₹)}$$

---

## 🔄 Alternative Supplier Recommendation Engine

When a stockout is detected (`Expected Delivery Date > Stockout Date`), the system queries the alternative supplier candidate database (`40,000 records`):

1. **Strict Filtering**:
   - Exact `Item_ID` match (verified automotive components).
   - `Quality_Approved == 'Yes'`.
   - Lead time and supplier capacity verification.
2. **Multi-Factor Ranking** (avoids lowest-price bias):
   - Ability to arrive before stockout (`alt_delivery_date <= stockout_date`).
   - Maximum **Net Financial Benefit** (`Loss Avoided - Additional Procurement Cost`).
   - Maximum factory downtime prevented.
   - Historical on-time delivery rate and supplier rating.
3. **3-Scenario Comparison**:
   - **Scenario A:** Original Supplier Only (full delay, full downtime, maximum financial loss).
   - **Scenario B:** Alternative Supplier (runner-up candidate).
   - **Scenario C:** Best Feasible Alternative (optimal recommendation).

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

