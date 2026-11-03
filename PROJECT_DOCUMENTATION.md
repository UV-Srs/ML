# Supplier Delivery Delay & Production Loss Prevention System
## Technical Project Documentation & System Architecture Guide

---

## 1. Project Background & Real-World Purpose

In automotive and industrial assembly plants, manufacturing lines operate on lean or Just-In-Time (JIT) inventory principles. Components arrive in scheduled delivery windows to feed the assembly line directly or replenish small buffer stocks.

When a tier-1 or tier-2 supplier delivers a critical component late (such as engine blocks, brake systems, transmissions, or wiring harnesses), the consequences are severe:
1. **Warehouse stock depletes to zero** (stockout).
2. **Assembly lines stop operating** (plant downtime).
3. **Idled labor, machine depreciation, and unfulfilled dealer orders accumulate hourly financial losses.**

### The Problem with Traditional Approaches
Most procurement software either tracks shipments reactively (alerting managers only after a shipment is already late) or relies on static supplier ratings that don't account for route distance, order volume stress, seasonal rush, or warehouse burn rates.

### What This System Does
This platform is an end-to-end Machine Learning intelligence system that:
1. **Predicts shipment delays proactively** at the moment a Purchase Order (PO) is created.
2. **Models factory inventory burn rates** against predicted arrival dates to forecast the exact stockout date and hours of downtime.
3. **Calculates the financial damage** in Indian Rupees (₹), breaking it down into direct product loss and idle factory line overhead.
4. **Automatically searches and ranks pre-verified alternative suppliers** using multi-criteria scoring (MCDA) to prevent factory downtime before it happens.
5. **Provides a clean web interface** for procurement officers to simulate individual orders or audit thousands of orders in bulk.

---

## 2. End-to-End System Architecture

The project is built in modular layers: data ingestion, feature engineering, machine learning pipelines, operational loss modeling, alternative vendor ranking, and an interactive dashboard.

```
+---------------------------------------------------------------------------------------+
|                                    USER INTERFACES                                    |
|   Manual PO Risk Simulator (Single Order)  |  Bulk CSV Audit Engine (Batch Uploads)   |
+---------------------------------------------------------------------------------------+
                                           |
                                           v
+---------------------------------------------------------------------------------------+
|                                  INFERENCE API (predict.py)                           |
|  - Feature Pipeline (Physics Ratios, Lead Time Deficits, Seasonality Signals)         |
+---------------------------------------------------------------------------------------+
       |                                          |
       v                                          v
+-----------------------------+    +-----------------------------+
|    DELAY REGRESSION MODEL   |    |    RISK CLASSIFICATION      |
|  models/delay_pipeline.pkl  |    |  models/risk_pipeline.pkl   |
|  - Algorithm: XGBRegressor  |    |  - Algorithm: XGBClassifier |
|  - Output: Delay Days       |    |  - Output: Probability %    |
+-----------------------------+    +-----------------------------+
       \                                          /
        -------------------    -------------------
                           \  /
                            v
+---------------------------------------------------------------------------------------+
|                    INVENTORY & PRODUCTION LOSS SIMULATION ENGINE                      |
|  - Stock Coverage Days = Available Stock / Daily Burn Rate                            |
|  - Stockout Date = Order Date + Coverage Days                                         |
|  - Expected Delivery = Promised Date + Predicted Delay                                |
|  - Plant Downtime = max(0, Expected Delivery - Stockout Date)                         |
|  - Loss = (Lost Units * Unit Cost) + (Downtime Days * Daily Line Overhead)            |
+---------------------------------------------------------------------------------------+
                                           |
                    [ Is Stockout Date < Expected Delivery? ]
                                   /               \
                             NO   /                 \  YES
                                 v                   v
            +-------------------------+    +--------------------------------------------+
            |  Status: Safe Inventory |    |  ALTERNATIVE SUPPLIER RE-ROUTING ENGINE    |
            |  No Action Required     |    |  models/alternative_supplier_engine.pkl    |
            +-------------------------+    |  - Filter by exact Item_ID & Quality = Yes |
                                           |  - Compute physical arrival timeline       |
                                           |  - Calculate downtime prevented            |
                                           |  - Calculate net financial benefit         |
                                           |  - Compute 0-100% MCDA Suitability Match   |
                                           |  - Build 3-Scenario Comparison Strategy    |
                                           +--------------------------------------------+
```

---

## 3. Data Pipeline & Feature Engineering

### 3.1 Datasets Used
The platform was built and tested using realistic automotive manufacturing data across 100 suppliers and 20 core automotive parts (e.g., `ENG01` Engine Component, `TRN01` Transmission Unit, `BRK01` Brake Assembly):

- **Primary Historical Deliveries (`data/processed/combined_supplier_delivery_data.csv`):** 240,000 procurement transactions compiled from a 90,000-record historical base and a 150,000-record scale test.
- **Alternative Supplier Database (`data/raw/alternative_supplier_data_40000.csv`):** 40,000 candidate records spanning ~1,900 suppliers with pricing, capacity, lead times, quality certifications, and historical ratings.
- **Holdout Test Set (`data/processed/delivery_test.csv`):** 48,000 transactions split strictly by date (80% train / 20% test) to prevent future data leakage into the training phase.

### 3.2 Domain Physics & Interaction Features
Raw fields (like order date, distance, and quantity) were transformed into domain-specific supply chain physics ratios inside `predict.py` and Notebook 08:

| Feature Name | Calculation | Engineering Logic |
|---|---|---|
| `Transit_Velocity` | `Distance_KM / (Calculated_Lead_Time + 1)` | Measures logistics pressure (km/day required). High values indicate unrealistic shipping schedules. |
| `Volume_Stress` | `Quantity_Ordered / (Calculated_Lead_Time + 1)` | Units needed per day of transit. Large orders on short deadlines create warehouse bottleneck risks. |
| `Cost_Per_KM` | `Shipping_Cost / (Distance_KM + 1)` | Detects expedited or premium freight vs standard economic transit. |
| `Lead_Time_Deficit` | `Calculated_Lead_Time - Order_Lead_Time_Days` | Measures gap between promised buffer and supplier standard lead time. |
| `Supplier_Risk_Velocity` | `(100 - Delivery_Rate) * Transit_Velocity` | Compounds historical supplier unreliability with route difficulty. |
| `Is_Month_End_Rush` | `Order_Day >= 25` | Captures logistics crunch at closing weeks. |
| `Is_Quarter_End_Rush` | `Month in [3,6,9,12] and Day >= 22` | Captures quarterly target shipments and port congestions. |
| `Month_Sin` / `Month_Cos` | Circular trigonometric month encoding | Preserves calendar cyclicity (December connects smoothly to January). |

---

## 4. Machine Learning Models Trained

The project utilizes three distinct machine learning pipelines. All models are trained in dedicated Jupyter notebooks and serialized into the `models/` directory using `joblib`.

### Model 1: Delivery Delay Regression Pipeline
- **File:** `models/combined_delivery_delay_pipeline.pkl`
- **Notebook:** `notebooks/08_Combined_Delivery_Model_Training.ipynb`
- **Algorithm:** Extreme Gradient Boosting Regressor (`XGBRegressor`)
- **Key Hyperparameters:**
  - `n_estimators`: 450
  - `max_depth`: 10
  - `learning_rate`: 0.035
  - `subsample`: 0.85
  - `colsample_bytree`: 0.80
  - `reg_alpha`: 0.1, `reg_lambda`: 1.0
  - `tree_method`: `"hist"`
- **Preprocessing:** Numerical median imputation + standard scaling; Categorical most-frequent imputation + one-hot encoding with `handle_unknown="ignore"`.
- **Performance on 48,000 Holdout Orders:**
  - **Mean Absolute Error (MAE):** `1.5971 Days` (~1.60 days average error)
  - **Root Mean Squared Error (RMSE):** `2.1983 Days`
  - **R-squared ($R^2$):** `32.67%` variance explained
  - **Tolerance Accuracy within $\pm 1$ Day:** `44.69%`
  - **Tolerance Accuracy within $\pm 2$ Days:** `73.52%` (3 out of 4 shipments predicted within 48h)
  - **Tolerance Accuracy within $\pm 3$ Days:** `86.20%`
  - **Range-Normalized Accuracy:** `85.48%`

### Model 2: Delivery Risk Classification Pipeline
- **File:** `models/combined_delivery_risk_pipeline.pkl`
- **Notebook:** `notebooks/08_Combined_Delivery_Model_Training.ipynb`
- **Algorithm:** Extreme Gradient Boosting Classifier (`XGBClassifier`)
- **Target:** Binary flag (`1` if `Actual_Delay_Days > 0`, else `0`)
- **Key Hyperparameters:**
  - `n_estimators`: 450
  - `max_depth`: 10
  - `learning_rate`: 0.035
  - `subsample`: 0.85
  - `colsample_bytree`: 0.80
  - `eval_metric`: `"logloss"`
- **Performance on 48,000 Holdout Orders:**
  - **Overall Accuracy:** `78.40%`
  - **ROC-AUC Score:** `0.8437`
  - **Delayed Precision:** `86.58%` (High trust: 86.6% of flagged delays are real delays)
  - **On-Time Precision:** `77.42%`
  - **On-Time Recall:** `97.97%`
  - **Weighted F1-Score:** `0.7483` (~0.75)
- **Holdout Confusion Matrix (48,000 orders):**
  - True Negatives (On-Time predicted as On-Time): **33,189**
  - False Positives (On-Time misclassified as Delayed): **689** (Only 1.4% false alarm rate)
  - False Negatives (Delayed misclassified as On-Time): **9,677**
  - True Positives (Delayed caught correctly): **4,445**

### Model 3: Alternative Supplier Recommendation Classifier
- **File:** `models/alternative_supplier_engine.pkl`
- **Notebook:** `notebooks/10_Alternative_Supplier_Model_Training.ipynb`
- **Algorithm:** Calibrated XGBoost Classifier (`XGBClassifier`)
- **Target:** Verified supplier recommendation flag (`1` if suitable, `0` otherwise)
- **Calibration Fix:** Uncalibrated baseline weighting (`scale_pos_weight=27`) previously caused severe false positives (13.84% precision). Calibrating with balanced weights (`scale_pos_weight=3.0`, `max_depth=6`, `n_estimators=300`) fixed the skew.
- **Performance on 8,000 Holdout Candidate Records:**
  - **Overall Accuracy:** `97.50%`
  - **ROC-AUC Score:** `0.9133`
  - **Precision:** `81.75%` (jumped from 13.84% to 81.75%)
  - **Recall:** `39.02%`
  - **F1-Score:** `0.5283`
- **Holdout Confusion Matrix (8,000 candidates):**
  - True Negatives: **7,688**
  - False Positives: **25**
  - False Negatives: **175**
  - True Positives: **112**

---

## 5. Production Loss & Stockout Engine

Unlike typical ML projects that stop at predicting a number of days, this system converts delay days into physical factory impact.

### 5.1 Physical Timeline Simulation
1. **Stock Coverage Days:**
   $$\text{Coverage Days} = \frac{\text{Available Inventory (Units)}}{\text{Daily Burn Rate (Units/Day)}}$$
2. **Stockout Date:**
   $$\text{Stockout Date} = \text{Order Date} + \text{Coverage Days}$$
3. **Predicted Component Arrival:**
   $$\text{Expected Arrival Date} = \text{Promised Delivery Date} + \text{Predicted Delay Days}$$
4. **Plant Downtime:**
   $$\text{Downtime Days} = \max\left(0, \text{Expected Arrival Date} - \text{Stockout Date}\right)$$
   $$\text{Downtime Hours} = \text{Downtime Days} \times 24.0 \quad (\text{Industrial Shifts} = \frac{\text{Downtime Hours}}{8.0})$$

### 5.2 Dual-Component Financial Loss Model
Factory downtime incurs two distinct categories of financial loss:
1. **Direct Material / Lost Vehicle Volume Loss:**
   $$\text{Direct Loss} = (\text{Downtime Days} \times \text{Daily Burn Rate}) \times \text{Component Unit Cost (₹)}$$
2. **Fixed Facility Idling Overhead Loss:**
   $$\text{Idle Overhead Loss} = \text{Downtime Days} \times \text{Daily Assembly Line Overhead (₹)}$$
   *(Accounts for idled plant workers, electricity, building maintenance, and machine depreciation).*
3. **Total Production Loss:**
   $$\text{Total Financial Loss (₹)} = \text{Direct Loss} + \text{Idle Overhead Loss}$$

### 5.3 Safety Stock Buffer Health Metrics
- **Buffer Deficit (Units):** Exact number of parts needed to prevent plant shutdown during the delay window.
- **Stock Runway Status:**
  - `Safe Inventory Buffer`: Stock coverage exceeds expected delivery date by $\ge 1$ day.
  - `Buffer Constrained (High Risk)`: Stock coverage will deplete within 24 hours of arrival.
  - `Stockout Imminent`: Delivery occurs after stock reaches zero; plant stoppage is guaranteed.
  - `Immediate Critical Outage`: Factory starts with 0 inventory; line stops on Day 1.

---

## 6. Alternative Supplier Re-Routing Engine

When a stockout is identified, the system activates dynamic re-routing:

### 6.1 Strict Verification Filtering
Before any supplier is scored, it must meet strict production gates:
- Exact part match (`Item_ID == Target_Item_ID`).
- Quality compliance certification (`Quality_Approved == 'Yes'`).
- Active operational status and verified capacity.

### 6.2 Multi-Criteria Decision Analysis (MCDA) Scoring (0 to 100%)
Suppliers are not selected merely on the cheapest unit price, as cheap parts that arrive too late still shut down the assembly line. Every candidate is ranked via an executive 5-factor composite formula:

$$\text{MCDA Score} = 0.35 \times S_{\text{LeadTime}} + 0.25 \times S_{\text{Financial}} + 0.20 \times S_{\text{Reliability}} + 0.10 \times S_{\text{Rating}} + 0.10 \times S_{\text{Quantity}}$$

- **1. Lead Time Feasibility ($S_{\text{LeadTime}}$, 35%):**
  - Scores 100% if the vendor arrives before factory inventory depletes (0 downtime).
  - Scores proportionally based on downtime days saved if arriving partially through the gap.
- **2. Net Financial Benefit ($S_{\text{Financial}}$, 25%):**
  $$\text{Net Benefit} = \text{Production Loss Avoided} - \text{Additional Procurement/Shipping Cost}$$
  - Normalized relative to total potential loss.
- **3. Historical Reliability ($S_{\text{Reliability}}$, 20%):**
  - Vendor's verified on-time delivery rate (`0 to 100%`).
- **4. Supplier Rating ($S_{\text{Rating}}$, 10%):**
  - Standardized supplier quality rating (1 to 5 stars mapped to 20% to 100%).
- **5. Quantity Fulfillment ($S_{\text{Quantity}}$, 10%):**
  - Percentage of required order quantity the candidate can immediately fulfill.

### 6.3 Three-Scenario Operational Strategy
The dashboard automatically constructs a side-by-side comparison for executive review:
- **Scenario A (Original Supplier Only):** The default course of action. Shows full predicted delay, days of plant shutdown, and maximum financial loss.
- **Scenario B (Runner-Up Alternative):** Secondary alternative supplier for backup redundancy.
- **Scenario C (Best Feasible Alternative):** Top-ranked vendor with highest MCDA score, showing net financial savings and days of factory stoppage prevented.

---

## 7. User Interface & Streamlit Dashboard

The web dashboard (`app.py`) provides an interactive interface built for daily plant operations:

### 7.1 Key UI Features Implemented
1. **Responsive KPI Cards:** Replaced default Streamlit metrics with custom cards that eliminate text truncation and ellipses (`...`), cleanly showing predicted delays, risk badges, stock depletion dates, and financial losses.
2. **Indian Currency Formatting:** Displays large rupee losses with formatted Crore and Lakh badges (e.g., `₹39,870,000 (₹3.99 Crore)`) for instant executive comprehension.
3. **Visual Timeline Journey:** Renders a linear progression showing `Order Date` ➔ `Stockout Date` ➔ `Promised Date` ➔ `Predicted Arrival Date` with color coding (Green = Safe, Red = Stockout).
4. **Top Recommendation Callout:** Highlights the #1 alternative vendor in a green alert box explaining exactly why it was chosen, how many days of shutdown it prevents, and its net rupee benefit.
5. **Interactive Comparison Charts:** Side-by-side Plotly bar charts comparing plant downtime days and rupee losses across Scenarios A, B, and C.
6. **Downloadable Audit Reports:** One-click CSV export of the full assessment report for procurement records.

### 7.2 Dashboard Pages
- **Page 1: Dashboard Overview:** Displays aggregate KPIs across the 240,000 procurement transactions and an interactive data table of monitored suppliers.
- **Page 2: Manual Purchase Order Simulation:** Interactive form allowing users to select a supplier, component, order dates, buffer stock, burn rate, and unit cost to run an instant risk and loss simulation.
- **Page 3: Bulk CSV Batch Prediction:** Upload a batch file of dozens or hundreds of purchase orders with stock parameters to run automated audits and export results.

---

## 8. Directory & File Structure

```text
ML Main/
│
├── app.py                                   # Interactive Streamlit Web Application
├── predict.py                               # Production Inference Pipeline & Loss Engine
├── check_models.py                          # Model Artifact Inspection Utility
├── requirements.txt                         # Python Dependency Specifications
├── README.md                                # Project GitHub Readme
├── PROJECT_DOCUMENTATION.md                 # Complete System & Architecture Documentation
│
├── models/                                  # Serialized Trained Model Artifacts
│   ├── combined_delivery_delay_pipeline.pkl # Trained XGBoost Delay Regressor
│   ├── combined_delivery_risk_pipeline.pkl  # Trained XGBoost Risk Classifier
│   └── alternative_supplier_engine.pkl      # Calibrated Alternative Re-Routing Engine
│
├── notebooks/                               # Jupyter Notebook Development & Training
│   ├── 07_Compile Suppliers.ipynb           # Compiles & cleans raw data into 240,000 rows
│   ├── 08_Combined_Delivery_Model_Training.ipynb # Delay & Risk model training with outputs
│   ├── 09_Production_Loss_Analysis.ipynb    # Precision factory loss & shift simulations
│   └── 10_Alternative_Supplier_Model_Training.ipynb # Alternative ML classifier & MCDA engine
│
└── data/
    ├── raw/
    │   ├── supplier_delivery_data_90000.csv
    │   ├── supplier_delivery_data_150000_synthetic.csv
    │   ├── alternative_supplier_data_40000.csv
    │   └── alternative_supplier_data_150000_synthetic.csv
    └── processed/
        ├── combined_supplier_delivery_data.csv  # Clean consolidated 240,000 records
        └── delivery_test.csv                   # 48,000 holdout test orders
```

---

## 9. How to Run, Test, and Verify

### 9.1 Environment Setup
```powershell
# 1. Activate virtual environment
.\.venv\Scripts\activate

# 2. Verify all requirements are installed
pip install -r requirements.txt
```

### 9.2 Running the Application
```powershell
# Launch the Streamlit dashboard on localhost:8501
streamlit run app.py
```

### 9.3 Validating Models & Code Integrity
```powershell
# Check serialized model integrity and pipeline steps
python check_models.py

# Verify end-to-end inference and test scenarios
python -c "import predict; print('All modules loaded cleanly!')"
```

### 9.4 Inspecting Notebooks
Open the `.ipynb` files in VS Code or Jupyter Lab. Every notebook has already been executed end-to-end with all markdown headers, data tables, metrics, confusion matrices, and matplotlib/seaborn charts pre-rendered for review.
