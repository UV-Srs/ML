import os
import joblib
import numpy as np
import pandas as pd
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")
DATA_DIR = os.path.join(BASE_DIR, "data")

DELAY_PIPELINE_PATH = os.path.join(MODEL_DIR, "combined_delivery_delay_pipeline.pkl")
RISK_PIPELINE_PATH = os.path.join(MODEL_DIR, "combined_delivery_risk_pipeline.pkl")
ALTERNATIVE_ENGINE_PATH = os.path.join(MODEL_DIR, "alternative_supplier_engine.pkl")

# Backwards compatibility aliases
REGRESSION_MODEL_PATH = DELAY_PIPELINE_PATH
CLASSIFICATION_MODEL_PATH = RISK_PIPELINE_PATH


def load_models():
    """Load trained delivery delay and risk classification pipelines."""
    if not os.path.exists(DELAY_PIPELINE_PATH):
        raise FileNotFoundError(f"Delay pipeline not found: {DELAY_PIPELINE_PATH}")
    if not os.path.exists(RISK_PIPELINE_PATH):
        raise FileNotFoundError(f"Risk pipeline not found: {RISK_PIPELINE_PATH}")

    delay_pipe = joblib.load(DELAY_PIPELINE_PATH)
    risk_pipe = joblib.load(RISK_PIPELINE_PATH)
    return delay_pipe, risk_pipe


def load_alternative_engine():
    """Load the alternative supplier recommendation engine and database."""
    if not os.path.exists(ALTERNATIVE_ENGINE_PATH):
        raise FileNotFoundError(f"Alternative supplier engine not found: {ALTERNATIVE_ENGINE_PATH}")
    return joblib.load(ALTERNATIVE_ENGINE_PATH)


def build_manual_order(
    purchase_order_id,
    supplier_id,
    item_id,
    quantity,
    order_date,
    promised_date,
    history
):
    """
    Build all model input features from user PO inputs by borrowing static
    profile features (shipping mode, tier, transporter, etc.) from history.
    """
    matched = history[
        (history["Supplier_ID"].astype(str) == str(supplier_id)) &
        (history["Item_ID"].astype(str) == str(item_id))
    ]
    if matched.empty:
        matched = history[history["Supplier_ID"].astype(str) == str(supplier_id)]
    if matched.empty:
        raise ValueError(f"No historical records found for supplier {supplier_id}.")

    template = matched.iloc[-1].copy()

    order_dt = pd.to_datetime(order_date)
    promised_dt = pd.to_datetime(promised_date)

    if promised_dt < order_dt:
        raise ValueError("Promised Date cannot be earlier than Order Date.")

    lead_time = (promised_dt - order_dt).days

    row = template.to_dict()
    row["Purchase_Order_ID"] = purchase_order_id
    row["Supplier_ID"] = supplier_id
    row["Item_ID"] = item_id
    row["Quantity_Ordered"] = quantity
    row["Order_Date"] = order_dt.strftime("%Y-%m-%d")
    row["Promised_Date"] = promised_dt.strftime("%Y-%m-%d")
    row["Expected_Delivery_Date"] = promised_dt.strftime("%Y-%m-%d")
    row["Order_Lead_Time_Days"] = lead_time
    row["Month_Ordered"] = order_dt.month
    row["Quarter_Ordered"] = f"Q{((order_dt.month - 1) // 3) + 1}"
    row["Year_Ordered"] = order_dt.year
    row["Order_Day"] = order_dt.day
    row["Order_Month"] = order_dt.month
    row["Order_Year"] = order_dt.year
    row["Order_DayOfWeek"] = order_dt.dayofweek
    row["Promised_Day"] = promised_dt.day
    row["Promised_Month"] = promised_dt.month
    row["Promised_Year"] = promised_dt.year
    row["Promised_DayOfWeek"] = promised_dt.dayofweek
    row["Calculated_Lead_Time"] = lead_time

    # Lookup Item_Name if available
    item_records = history[history["Item_ID"].astype(str) == str(item_id)]
    if not item_records.empty and "Item_Name" in history.columns:
        row["Item_Name"] = item_records.iloc[-1]["Item_Name"]

    # Exclude target and leakage columns
    leakage = [
        "Actual_Delay_Days",
        "Actual_Delivery_Date",
        "Actual_Delivery_Status",
        "Expected_Delay_Days",
        "Shipment_ID",
        "Is_Delayed"
    ]
    for col in leakage:
        row.pop(col, None)

    return pd.DataFrame([row])


def prepare_features(data):
    """Ensure temporal features and clean types exist on the DataFrame."""
    df = data.copy()
    df["Order_Date"] = pd.to_datetime(df["Order_Date"], errors="coerce")
    df["Promised_Date"] = pd.to_datetime(df["Promised_Date"], errors="coerce")

    if df["Order_Date"].isna().any():
        raise ValueError("Invalid Order Date encountered.")
    if df["Promised_Date"].isna().any():
        raise ValueError("Invalid Promised Date encountered.")

    df["Order_Day"] = df["Order_Date"].dt.day
    df["Order_Month"] = df["Order_Date"].dt.month
    df["Order_Year"] = df["Order_Date"].dt.year
    df["Order_DayOfWeek"] = df["Order_Date"].dt.dayofweek

    df["Promised_Day"] = df["Promised_Date"].dt.day
    df["Promised_Month"] = df["Promised_Date"].dt.month
    df["Promised_Year"] = df["Promised_Date"].dt.year
    df["Promised_DayOfWeek"] = df["Promised_Date"].dt.dayofweek

    df["Calculated_Lead_Time"] = (df["Promised_Date"] - df["Order_Date"]).dt.days

    drop_cols = [
        "Shipment_ID",
        "Purchase_Order_ID",
        "Actual_Delivery_Date",
        "Actual_Delivery_Status",
        "Expected_Delivery_Date",
        "Expected_Delay_Days",
        "Order_Date",
        "Promised_Date",
        "Actual_Delay_Days",
        "Is_Delayed"
    ]
    df = df.drop(columns=drop_cols, errors="ignore")
    return df


def predict_orders(data):
    """
    Predict delivery delay days and delivery risk probability for a DataFrame.
    """
    if not isinstance(data, pd.DataFrame):
        raise TypeError("Input must be a pandas DataFrame.")
    if data.empty:
        raise ValueError("No purchase order data was provided.")

    delay_pipe, risk_pipe = load_models()
    model_input = prepare_features(data)

    delay_preds = delay_pipe.predict(model_input)
    delay_preds = np.maximum(delay_preds, 0)

    risk_probs = risk_pipe.predict_proba(model_input)[:, 1]

    results = data.copy()
    results["Predicted_Delay_Days"] = np.round(delay_preds, 2)
    results["Delay_Probability"] = np.round(risk_probs * 100, 2)
    results["Delivery_Risk"] = pd.cut(
        results["Delay_Probability"],
        bins=[-0.01, 30.0, 60.0, 100.0],
        labels=["Low", "Medium", "High"]
    )
    return results


def calculate_production_loss(
    predicted_delay_days,
    available_stock,
    daily_production,
    unit_cost,
    order_date=None,
    promised_date=None
):
    """
    Computes stock coverage days, factory downtime, lost units, and financial loss in INR.
    Compares the expected delivery arrival date against the inventory stockout date.
    """
    delay = max(0.0, float(predicted_delay_days))
    stock = max(0.0, float(available_stock))
    cost = max(0.0, float(unit_cost))
    burn_rate = float(daily_production)

    if burn_rate <= 0:
        return {
            "Stock_Coverage_Days": float("inf"),
            "Production_Downtime_Days": 0.0,
            "Lost_Production_Units": 0.0,
            "Daily_Production_Loss": 0.0,
            "Total_Production_Loss": 0.0,
            "Stockout_Risk": False,
            "Stockout_Date": None,
            "Predicted_Arrival_Date": None,
            "Days_Until_Delivery": 0.0
        }

    stock_coverage_days = stock / burn_rate

    if order_date is not None and promised_date is not None:
        ord_dt = pd.to_datetime(order_date)
        prm_dt = pd.to_datetime(promised_date)
        expected_delivery_date = prm_dt + timedelta(days=delay)
        stockout_date = ord_dt + timedelta(days=stock_coverage_days)

        days_until_delivery = max(0.0, (expected_delivery_date - ord_dt).total_seconds() / 86400.0)
        downtime_days = max(0.0, days_until_delivery - stock_coverage_days)
        stockout_risk = expected_delivery_date > stockout_date
    else:
        downtime_days = max(0.0, delay - stock_coverage_days)
        stockout_risk = delay > stock_coverage_days
        stockout_date = None
        expected_delivery_date = None
        days_until_delivery = delay

    lost_units = downtime_days * burn_rate
    daily_loss = burn_rate * cost
    total_loss = lost_units * cost

    return {
        "Stock_Coverage_Days": round(stock_coverage_days, 2),
        "Production_Downtime_Days": round(downtime_days, 2),
        "Lost_Production_Units": round(lost_units, 2),
        "Daily_Production_Loss": round(daily_loss, 2),
        "Total_Production_Loss": round(total_loss, 2),
        "Stockout_Risk": stockout_risk,
        "Stockout_Date": stockout_date.strftime("%Y-%m-%d") if stockout_date else None,
        "Predicted_Arrival_Date": expected_delivery_date.strftime("%Y-%m-%d") if expected_delivery_date else None,
        "Days_Until_Delivery": round(days_until_delivery, 2)
    }


def find_alternative_suppliers(
    item_id,
    required_quantity,
    current_unit_cost,
    order_date,
    promised_date,
    predicted_delay_days,
    available_stock,
    daily_production,
    top_n=5
):
    """
    Ranks verified alternative suppliers using physical inventory timeline simulation:
    1. Exact Item compatibility.
    2. Ability to deliver before stockout.
    3. Available quantity.
    4. Delivery reliability and quality approval.
    5. Net financial benefit (loss avoided - extra procurement cost).
    """
    engine = load_alternative_engine()
    candidate_db = engine["candidate_db"]

    # Match Item_ID
    matches = candidate_db[candidate_db["Item_ID"] == str(item_id)].copy()
    if matches.empty:
        return pd.DataFrame()

    # Prioritize Quality_Approved == 'Yes'
    quality_matches = matches[matches["Quality_Approved"] == "Yes"].copy()
    if not quality_matches.empty:
        matches = quality_matches

    ord_dt = pd.to_datetime(order_date)
    prm_dt = pd.to_datetime(promised_date)
    delay = max(0.0, float(predicted_delay_days))
    expected_orig_delivery = prm_dt + timedelta(days=delay)

    burn_rate = max(1.0, float(daily_production))
    stock = max(0.0, float(available_stock))
    stock_coverage_days = stock / burn_rate
    stockout_date = ord_dt + timedelta(days=stock_coverage_days)

    days_until_orig_delivery = max(0.0, (expected_orig_delivery - ord_dt).total_seconds() / 86400.0)
    orig_downtime_days = max(0.0, days_until_orig_delivery - stock_coverage_days)

    req_qty = float(required_quantity)
    curr_cost = float(current_unit_cost)

    candidates = []
    for _, row in matches.iterrows():
        alt_lead_days = float(row["Lead_Time_Days"])
        alt_delivery_date = ord_dt + timedelta(days=alt_lead_days)
        alt_available_qty = float(row["Available_Quantity"])
        alt_unit_cost = float(row["Unit_Cost"])
        alt_shipping_cost = float(row.get("Shipping_Cost", 0.0))
        alt_packaging_cost = float(row.get("Packaging_Cost", 0.0))
        rating = float(row.get("Supplier_Rating", 3.0))
        on_time_rate = float(row.get("Supplier_On_Time_Rate", 85.0))
        quality = str(row.get("Quality_Approved", "Yes"))

        # Quantity constraints
        capacity = float(row.get("Supplier_Capacity", 999999.0))
        supplied_qty = min(req_qty, alt_available_qty, capacity)

        if alt_available_qty >= req_qty:
            qty_status = f"Full ({alt_available_qty:,.0f} Units)"
        else:
            qty_status = f"Partial ({alt_available_qty:,.0f} / {req_qty:,.0f} Units)"

        # Physical Timeline Simulation:
        if alt_lead_days >= days_until_orig_delivery:
            # Arrives after original delivery
            alt_downtime_days = orig_downtime_days
            downtime_prevented = 0.0
        else:
            # Unavoidable downtime between stockout and alternative arrival
            unavoidable_downtime = max(0.0, alt_lead_days - stock_coverage_days)

            # Days of stock supplied by alternative
            alt_coverage_days = supplied_qty / burn_rate
            covered_until_days = max(stock_coverage_days, alt_lead_days) + alt_coverage_days
            remaining_downtime = max(0.0, days_until_orig_delivery - max(alt_lead_days, covered_until_days))

            alt_downtime_days = min(orig_downtime_days, unavoidable_downtime + remaining_downtime)
            downtime_prevented = max(0.0, orig_downtime_days - alt_downtime_days)

        loss_avoided = downtime_prevented * burn_rate * curr_cost
        total_procurement_cost = (supplied_qty * alt_unit_cost) + alt_shipping_cost + alt_packaging_cost
        orig_procurement_cost = supplied_qty * curr_cost
        extra_cost = max(0.0, total_procurement_cost - orig_procurement_cost)
        net_benefit = loss_avoided - extra_cost

        arrives_before_stockout = alt_delivery_date <= stockout_date

        if arrives_before_stockout:
            feasibility = "Arrives Before Stockout (Prevents Shutdown)"
        elif downtime_prevented > 0:
            diff_days = max(1, (alt_delivery_date - stockout_date).days)
            feasibility = f"Arrives {diff_days}d after stockout, but shortens shutdown by {downtime_prevented:.1f}d"
        else:
            feasibility = "No Downtime Reduction (Arrives after original shipment)"

        candidates.append({
            "Supplier ID": row["Candidate_Supplier_ID"],
            "Item": f"{row['Item_ID']} - {row.get('Item_Name', '')}",
            "Available Quantity": f"{alt_available_qty:,.0f}",
            "Lead Time": f"{alt_lead_days:.0f} Days",
            "Quality": quality,
            "Supplier Rating": f"{rating:.2f} / 5.0",
            "Total Cost": f"₹{total_procurement_cost:,.2f}",
            "Raw_Supplier_ID": row["Candidate_Supplier_ID"],
            "Raw_Item_ID": row["Item_ID"],
            "Raw_Available_Qty": alt_available_qty,
            "Raw_Lead_Time": alt_lead_days,
            "Raw_Total_Cost": total_procurement_cost,
            "Raw_Unit_Cost": alt_unit_cost,
            "Raw_Rating": rating,
            "Raw_On_Time_Rate": on_time_rate,
            "Quantity_Status": qty_status,
            "Downtime_Prevented_Days": round(downtime_prevented, 2),
            "Loss_Avoided_INR": round(loss_avoided, 2),
            "Extra_Cost_INR": round(extra_cost, 2),
            "Net_Benefit_INR": round(net_benefit, 2),
            "Arrives_Before_Stockout": arrives_before_stockout,
            "Alt_Delivery_Date": alt_delivery_date.strftime("%Y-%m-%d"),
            "Alt_Downtime_Days": round(alt_downtime_days, 2),
            "Alt_Production_Loss": round(alt_downtime_days * burn_rate * curr_cost, 2),
            "Feasibility": feasibility,
            "Explanation": (
                f"Candidate {row['Candidate_Supplier_ID']} delivers in {alt_lead_days:.0f} days with "
                f"{on_time_rate:.1f}% on-time reliability and {rating:.2f} rating. "
                f"Supplies {qty_status}. {feasibility}. "
                f"Prevents {downtime_prevented:.1f} days downtime, avoiding ₹{loss_avoided:,.2f} in production loss "
                f"with net financial benefit of ₹{net_benefit:,.2f}."
            )
        })

    res_df = pd.DataFrame(candidates)
    if res_df.empty:
        return pd.DataFrame()

    # Prioritize:
    # 1. Arrives before stockout
    # 2. Maximum net financial benefit
    # 3. Maximum downtime prevented
    # 4. On-time delivery reliability
    # 5. Supplier rating
    # 6. Lowest total procurement cost
    res_df = res_df.sort_values(
        by=[
            "Arrives_Before_Stockout",
            "Net_Benefit_INR",
            "Downtime_Prevented_Days",
            "Raw_On_Time_Rate",
            "Raw_Rating",
            "Raw_Total_Cost"
        ],
        ascending=[False, False, False, False, False, True]
    ).reset_index(drop=True)

    res_df.index = res_df.index + 1
    res_df.index.name = "Rank"
    return res_df.head(top_n)


def compare_three_scenarios(
    order_date,
    promised_date,
    predicted_delay_days,
    available_stock,
    daily_production,
    unit_cost,
    best_alternative_row=None,
    runner_up_alternative_row=None
):
    """
    Constructs an explicit 3-scenario comparison:
    - Scenario A: Original Supplier Only
    - Scenario B: Alternative Supplier (e.g. Runner-up / Standard Alternative)
    - Scenario C: Best Feasible Alternative
    """
    loss_orig = calculate_production_loss(
        predicted_delay_days, available_stock, daily_production, unit_cost,
        order_date, promised_date
    )

    scenarios = []

    # Scenario A: Original Supplier Only
    scenarios.append({
        "Scenario": "Scenario A: Original Supplier Only",
        "Supplier": "Original Delayed Supplier",
        "Expected_Arrival_Date": loss_orig["Predicted_Arrival_Date"] or "N/A",
        "Production_Downtime_Days": loss_orig["Production_Downtime_Days"],
        "Lost_Production_Units": loss_orig["Lost_Production_Units"],
        "Estimated_Production_Loss_INR": loss_orig["Total_Production_Loss"],
        "Additional_Procurement_Cost_INR": 0.0,
        "Production_Loss_Avoided_INR": 0.0,
        "Net_Financial_Benefit_INR": -loss_orig["Total_Production_Loss"]
    })

    # Scenario B: Second Alternative / Benchmark
    alt_b = runner_up_alternative_row if runner_up_alternative_row is not None else best_alternative_row
    if alt_b is not None and not alt_b.empty:
        scenarios.append({
            "Scenario": f"Scenario B: Alternative Supplier ({alt_b['Supplier ID']})",
            "Supplier": alt_b["Supplier ID"],
            "Expected_Arrival_Date": alt_b["Alt_Delivery_Date"],
            "Production_Downtime_Days": alt_b["Alt_Downtime_Days"],
            "Lost_Production_Units": round(alt_b["Alt_Downtime_Days"] * daily_production, 2),
            "Estimated_Production_Loss_INR": alt_b["Alt_Production_Loss"],
            "Additional_Procurement_Cost_INR": alt_b["Extra_Cost_INR"],
            "Production_Loss_Avoided_INR": alt_b["Loss_Avoided_INR"],
            "Net_Financial_Benefit_INR": alt_b["Net_Benefit_INR"]
        })

    # Scenario C: Best Feasible Alternative
    if best_alternative_row is not None and not best_alternative_row.empty:
        scenarios.append({
            "Scenario": f"Scenario C: Best Feasible Alternative ({best_alternative_row['Supplier ID']})",
            "Supplier": best_alternative_row["Supplier ID"],
            "Expected_Arrival_Date": best_alternative_row["Alt_Delivery_Date"],
            "Production_Downtime_Days": best_alternative_row["Alt_Downtime_Days"],
            "Lost_Production_Units": round(best_alternative_row["Alt_Downtime_Days"] * daily_production, 2),
            "Estimated_Production_Loss_INR": best_alternative_row["Alt_Production_Loss"],
            "Additional_Procurement_Cost_INR": best_alternative_row["Extra_Cost_INR"],
            "Production_Loss_Avoided_INR": best_alternative_row["Loss_Avoided_INR"],
            "Net_Financial_Benefit_INR": best_alternative_row["Net_Benefit_INR"]
        })

    return pd.DataFrame(scenarios)
