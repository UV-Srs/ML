import os
import sys
from pathlib import Path
from datetime import datetime, date
from typing import Optional, List
import pandas as pd
import numpy as np

# Add project root to sys.path
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from ml import predict
except ImportError:
    import predict

app = FastAPI(
    title="Supply Chain Delivery Delay & Production Loss API",
    description="Proactive ML intelligence for delivery delay prediction, plant downtime modeling, and alternative supplier mitigation.",
    version="2.0.0"
)

# CORS setup for Vite frontend (localhost:5173 and standard localhost ports)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory cached artifacts
HISTORY_PATH = BASE_DIR / "data" / "processed" / "combined_supplier_delivery_data.csv"
META_CACHE_PATH = BASE_DIR / "data" / "processed" / "meta_cache.json"
TEMPLATES_PATH = BASE_DIR / "data" / "processed" / "supplier_templates.csv"

_history_df = None
_meta_cache = None

def get_metadata_cache():
    global _meta_cache
    if _meta_cache is None:
        if META_CACHE_PATH.exists():
            import json
            with open(META_CACHE_PATH, "r", encoding="utf-8") as f:
                _meta_cache = json.load(f)
        else:
            _, _meta_cache = get_history()
    return _meta_cache

def get_templates():
    global _history_df
    if _history_df is None:
        if TEMPLATES_PATH.exists():
            _history_df = pd.read_csv(TEMPLATES_PATH)
        elif HISTORY_PATH.exists():
            _history_df = pd.read_csv(HISTORY_PATH)
        else:
            raise FileNotFoundError("Neither supplier templates nor history dataset found.")
    return _history_df

def get_history():
    global _history_df, _meta_cache
    if _history_df is None:
        if not HISTORY_PATH.exists():
            return get_templates(), get_metadata_cache()
        _history_df = pd.read_csv(HISTORY_PATH)
        
        # Build cached metadata
        suppliers = sorted(_history_df["Supplier_ID"].dropna().unique().tolist())
        items_df = _history_df[["Item_ID", "Item_Name"]].dropna().drop_duplicates().sort_values("Item_ID")
        items = [
            {"id": str(row.Item_ID), "name": str(row.Item_Name), "label": f"{row.Item_ID} - {row.Item_Name}"}
            for row in items_df.itertuples()
        ]
        plants = sorted(_history_df["Destination_Plant"].dropna().unique().tolist()) if "Destination_Plant" in _history_df.columns else []
        _meta_cache = {
            "suppliers": suppliers,
            "items": items,
            "plants": plants,
            "total_records": len(_history_df)
        }
    return _history_df, _meta_cache

@app.on_event("startup")
def startup_event():
    # Fast warmup
    get_metadata_cache()
    get_templates()
    predict.load_models()
    predict.load_alternative_engine()

class SinglePORequest(BaseModel):
    purchase_order_id: str = Field(default="PO-99201", description="Purchase Order Identifier")
    supplier_id: str = Field(default="SUP-001", description="Supplier ID")
    item_id: str = Field(default="ENG01", description="Part / Component Item ID")
    quantity: int = Field(default=500, ge=1, description="Order quantity in units")
    order_date: str = Field(default_factory=lambda: datetime.now().strftime("%Y-%m-%d"))
    promised_date: str = Field(default_factory=lambda: (datetime.now() + pd.Timedelta(days=10)).strftime("%Y-%m-%d"))
    available_stock: float = Field(default=100.0, ge=0.0, description="Factory available buffer stock (units)")
    daily_production: float = Field(default=50.0, ge=1.0, description="Factory daily burn rate (units/day)")
    unit_cost: float = Field(default=4500.0, ge=1.0, description="Component unit cost in INR")
    daily_fixed_overhead: float = Field(default=50000.0, ge=0.0, description="Daily facility line overhead in INR")

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "models_loaded": True,
        "engine": "XGBoost v14 (Optimized Depth-14)",
        "service": "Production Delivery Risk & Loss Prevention API"
    }

@app.get("/api/meta")
def get_metadata():
    return get_metadata_cache()

@app.post("/api/predict/single")
def predict_single_order(req: SinglePORequest):
    history_df = get_templates()
    
    try:
        # Build features from history
        row_df = predict.build_manual_order(
            purchase_order_id=req.purchase_order_id,
            supplier_id=req.supplier_id,
            item_id=req.item_id,
            quantity=req.quantity,
            order_date=req.order_date,
            promised_date=req.promised_date,
            history=history_df
        )
        
        # Run regression & classification
        pred_df = predict.predict_orders(row_df)
        
        predicted_delay = float(pred_df["Predicted_Delay_Days"].iloc[0])
        delay_prob = float(pred_df["Delay_Probability"].iloc[0])
        risk_tier = str(pred_df["Delivery_Risk"].iloc[0])
        
        # Calculate production downtime & financial loss
        loss_info = predict.calculate_production_loss(
            predicted_delay_days=predicted_delay,
            available_stock=req.available_stock,
            daily_production=req.daily_production,
            unit_cost=req.unit_cost,
            order_date=req.order_date,
            promised_date=req.promised_date,
            daily_fixed_overhead=req.daily_fixed_overhead
        )
        
        # Find alternative suppliers if downtime or stockout risk exists
        alternatives = []
        alt_df = predict.find_alternative_suppliers(
            item_id=req.item_id,
            required_quantity=req.quantity,
            current_unit_cost=req.unit_cost,
            order_date=req.order_date,
            promised_date=req.promised_date,
            predicted_delay_days=predicted_delay,
            available_stock=req.available_stock,
            daily_production=req.daily_production,
            top_n=5
        )
        if not alt_df.empty:
            alternatives = alt_df.to_dict(orient="records")
            
        return {
            "success": True,
            "order": {
                "po_id": req.purchase_order_id,
                "supplier_id": req.supplier_id,
                "item_id": req.item_id,
                "quantity": req.quantity,
                "order_date": req.order_date,
                "promised_date": req.promised_date,
                "unit_cost": req.unit_cost
            },
            "prediction": {
                "predicted_delay_days": predicted_delay,
                "delay_probability": delay_prob,
                "risk_tier": risk_tier,
                "is_delayed": predicted_delay > 0.5 or delay_prob >= 38.0
            },
            "loss_analysis": loss_info,
            "alternatives": alternatives
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/predict/bulk")
async def audit_bulk_orders(file: UploadFile = File(...)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a CSV.")
    
    try:
        uploaded_df = pd.read_csv(file.file)
        
        # Check required columns
        required_cols = ["Supplier_ID", "Item_ID", "Order_Date", "Promised_Date", "Quantity_Ordered"]
        missing = [c for c in required_cols if c not in uploaded_df.columns]
        if missing:
            raise HTTPException(status_code=400, detail=f"Missing required columns in CSV: {missing}")
        
        # Auto-enrich missing static profile columns from historical templates
        templates = get_templates()
        static_cols = [c for c in templates.columns if c not in required_cols and c in templates.columns]
        missing_static = [c for c in static_cols if c not in uploaded_df.columns]
        
        if missing_static:
            cols_to_pull = ["Supplier_ID", "Item_ID"] + [c for c in missing_static if c not in ["Supplier_ID", "Item_ID"]]
            enriched = pd.merge(uploaded_df, templates[cols_to_pull].drop_duplicates(["Supplier_ID", "Item_ID"]), on=["Supplier_ID", "Item_ID"], how="left")
            
            # Fallback for any unmatched pairs using Supplier_ID alone
            unmatched = enriched[missing_static[0]].isna()
            if unmatched.any():
                sup_defaults = templates.groupby("Supplier_ID")[missing_static].first().reset_index()
                filled_unmatched = pd.merge(enriched[unmatched].drop(columns=missing_static), sup_defaults, on="Supplier_ID", how="left")
                enriched = pd.concat([enriched[~unmatched], filled_unmatched], ignore_index=True)
            
            # Impute any remaining NaNs with column medians/modes
            numeric_defaults = templates.median(numeric_only=True)
            enriched = enriched.fillna(numeric_defaults)
            uploaded_df = enriched

        preds = predict.predict_orders(uploaded_df)
        
        total_orders = len(preds)
        delayed_orders = int((preds["Predicted_Delay_Days"] > 0.5).sum())
        high_risk_orders = int((preds["Delivery_Risk"] == "High").sum())
        avg_delay = float(preds["Predicted_Delay_Days"].mean())
        
        # Top 100 rows preview
        preview_cols = [
            "Purchase_Order_ID" if "Purchase_Order_ID" in preds.columns else "Supplier_ID",
            "Supplier_ID", "Item_ID", "Quantity_Ordered",
            "Predicted_Delay_Days", "Delay_Probability", "Delivery_Risk"
        ]
        available_preview_cols = [c for c in preview_cols if c in preds.columns]
        
        return {
            "success": True,
            "summary": {
                "total_orders": total_orders,
                "delayed_count": delayed_orders,
                "delayed_pct": round((delayed_orders / max(total_orders, 1)) * 100, 1),
                "high_risk_count": high_risk_orders,
                "average_delay_days": round(avg_delay, 2)
            },
            "rows": preds[available_preview_cols].head(100).to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bulk audit error: {str(e)}")

# Mount reports/figures static directory
FIGURES_DIR = BASE_DIR / "reports" / "figures"
if FIGURES_DIR.exists():
    app.mount("/api/reports/figures", StaticFiles(directory=str(FIGURES_DIR)), name="report_figures")

@app.get("/api/reports/list")
def list_reports():
    return [
        {
            "id": "tolerance",
            "title": "Tolerance Accuracy Curve (±1 to ±5 Days)",
            "category": "Regression Analysis",
            "filename": "04_tolerance_accuracy_curve.png",
            "description": "Tolerance curve showing 54.56% within ±1 day, 80.75% within ±2 days, and 90.20% within ±3 days."
        },
        {
            "id": "actual_vs_pred",
            "title": "Actual vs. Predicted Delay Regression",
            "category": "Regression Analysis",
            "filename": "01_actual_vs_predicted_regression.png",
            "description": "Scatter plot and density contours of actual vs. predicted delay days across 48,000 holdout test orders (MAE = 1.29d, R² = 53.77%)."
        },
        {
            "id": "residuals",
            "title": "Residuals & Heteroscedasticity Analysis",
            "category": "Regression Analysis",
            "filename": "02_residuals_analysis.png",
            "description": "Distribution of prediction residuals showing zero-centered symmetry and variance consistency."
        },
        {
            "id": "qq_plot",
            "title": "Q-Q Normal Probability Plot of Residuals",
            "category": "Regression Analysis",
            "filename": "03_qq_plot_residuals.png",
            "description": "Quantile-Quantile plot comparing model residual distribution against standard normal theoretical quantiles."
        },
        {
            "id": "roc_curve",
            "title": "ROC-AUC Discrimination Curve",
            "category": "Classification & Risk",
            "filename": "06_roc_curve.png",
            "description": "Receiver Operating Characteristic curve achieving 0.9301 ROC-AUC area on chronological test data."
        },
        {
            "id": "precision_recall",
            "title": "Precision-Recall Curve (Calibrated t = 0.38)",
            "category": "Classification & Risk",
            "filename": "07_precision_recall_curve.png",
            "description": "Precision-Recall tradeoff demonstrating 85.28% precision and 73.06% delay recall at operational decision threshold."
        },
        {
            "id": "confusion_matrix",
            "title": "Calibrated Confusion Matrix",
            "category": "Classification & Risk",
            "filename": "05_confusion_matrix.png",
            "description": "48,000-order confusion matrix showing 10,318 delayed shipments successfully caught by the risk pipeline."
        },
        {
            "id": "probability_dist",
            "title": "Probability Distribution Separation",
            "category": "Classification & Risk",
            "filename": "08_probability_distribution_separation.png",
            "description": "Separation density plot between on-time and delayed shipments confirming distinct probability peaks."
        },
        {
            "id": "calibration_curve",
            "title": "Reliability & Calibration Curve",
            "category": "Classification & Risk",
            "filename": "09_calibration_curve.png",
            "description": "Empirical vs. predicted probability reliability diagram proving calibrated risk scores."
        },
        {
            "id": "feature_importance",
            "title": "Top-20 Feature Importances (Both Models)",
            "category": "Feature Analysis",
            "filename": "feature_importance_both_models.png",
            "description": "Side-by-side executive feature ranking for Delivery Delay Regressor vs. Risk Classifier."
        },
        {
            "id": "feature_fatigue",
            "title": "Feature Fatigue & Cumulative Explanatory Power",
            "category": "Feature Analysis",
            "filename": "feature_fatigue_curves_both_models.png",
            "description": "Cumulative variance curve showing top 15 features contribute >85% of total predictive power."
        },
        {
            "id": "scaling_curves",
            "title": "Incremental Training Data Scaling Curves",
            "category": "Data Scaling",
            "filename": "11_incremental_data_scaling_curves.png",
            "description": "Accuracy progression across incremental dataset sizes (10k -> 30k -> 50k -> 75k -> 100k -> 240k)."
        },
        {
            "id": "correlation_heatmap",
            "title": "Engineered Feature Correlation Heatmap",
            "category": "Data Scaling",
            "filename": "10_feature_correlation_heatmap.png",
            "description": "Pearson correlation matrix across temporal, route velocity, and volume stress features."
        }
    ]

# Mount static frontend build if it exists
DIST_DIR = BASE_DIR / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    app_target = "backend.main:app" if Path("backend").exists() else "main:app"
    uvicorn.run(app_target, host="0.0.0.0", port=8000, reload=True)
