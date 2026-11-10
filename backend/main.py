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

# Mount static frontend build if it exists
DIST_DIR = BASE_DIR / "frontend" / "dist"
if DIST_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DIST_DIR), html=True), name="frontend")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
