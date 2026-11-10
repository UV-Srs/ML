import os
import joblib
import numpy as np
import pandas as pd
from datetime import timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR = os.path.join(BASE_DIR, "models")

DELAY_PIPELINE_PATH = os.path.join(MODEL_DIR, "combined_delivery_delay_pipeline.pkl")
RISK_PIPELINE_PATH = os.path.join(MODEL_DIR, "combined_delivery_risk_pipeline.pkl")
ALTERNATIVE_ENGINE_PATH = os.path.join(MODEL_DIR, "alternative_supplier_engine.pkl")

_DELAY_PIPE = None
_RISK_PIPE = None
_ALT_ENGINE = None


def load_models():
    """Load and cache trained delivery delay and risk classification pipelines."""
    global _DELAY_PIPE, _RISK_PIPE
    if _DELAY_PIPE is None or _RISK_PIPE is None:
        if not os.path.exists(DELAY_PIPELINE_PATH):
            raise FileNotFoundError(f"Delay pipeline not found: {DELAY_PIPELINE_PATH}")
        if not os.path.exists(RISK_PIPELINE_PATH):
            raise FileNotFoundError(f"Risk pipeline not found: {RISK_PIPELINE_PATH}")
        _DELAY_PIPE = joblib.load(DELAY_PIPELINE_PATH)
        _RISK_PIPE = joblib.load(RISK_PIPELINE_PATH)
    return _DELAY_PIPE, _RISK_PIPE


def load_alternative_engine():
    """Load and cache the alternative supplier recommendation engine and database."""
    global _ALT_ENGINE
    if _ALT_ENGINE is None:
        if not os.path.exists(ALTERNATIVE_ENGINE_PATH):
            raise FileNotFoundError(f"Alternative supplier engine not found: {ALTERNATIVE_ENGINE_PATH}")
        _ALT_ENGINE = joblib.load(ALTERNATIVE_ENGINE_PATH)
    return _ALT_ENGINE


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

    # Supply chain physics & interaction ratios
    risk_ratio = np.maximum(0.0, 100.0 - df["Supplier_History_Delivery_Rate"]) / 100.0
    df["Transit_Velocity"] = df["Distance_KM"] / (df["Calculated_Lead_Time"] + 1.0)
    df["Volume_Stress"] = df["Quantity_Ordered"] / (df["Calculated_Lead_Time"] + 1.0)
    df["Cost_Per_KM"] = df["Shipping_Cost"] / (df["Distance_KM"] + 1.0)
    df["Lead_Time_Deficit"] = df["Calculated_Lead_Time"] - df["Order_Lead_Time_Days"]
    df["Lead_Time_Ratio"] = df["Calculated_Lead_Time"] / (df["Order_Lead_Time_Days"] + 1.0)
    df["Order_Value"] = df["Quantity_Ordered"] * df["Unit_Cost"]
    df["Cost_Per_Unit"] = df["Shipping_Cost"] / (df["Quantity_Ordered"] + 1.0)
    df["Distance_Risk_Product"] = df["Distance_KM"] * risk_ratio
    df["Supplier_Risk_Velocity"] = (100.0 - df["Supplier_History_Delivery_Rate"]) * df["Transit_Velocity"]
    df["Deficit_Risk_Product"] = df["Lead_Time_Deficit"] * risk_ratio

    # Route and Logistics Composites
    s_reg = df["Supplier_Region"].astype(str) if "Supplier_Region" in df.columns else ""
    d_plant = df["Destination_Plant"].astype(str) if "Destination_Plant" in df.columns else ""
    df["Route_Key"] = s_reg + "_" + d_plant

    s_meth = df["Shipping_Method"].astype(str) if "Shipping_Method" in df.columns else ""
    s_prio = df["Shipment_Priority"].astype(str) if "Shipment_Priority" in df.columns else ""
    df["Mode_Priority"] = s_meth + "_" + s_prio

    df["Is_Month_End_Rush"] = (df["Order_Day"] >= 25).astype(int)
    df["Is_Quarter_End_Rush"] = ((df["Order_Month"].isin([3, 6, 9, 12])) & (df["Order_Day"] >= 22)).astype(int)
    df["Is_Weekend_Order"] = df["Order_DayOfWeek"].isin([5, 6]).astype(int)
    df["Is_Weekend_Promised"] = df["Promised_DayOfWeek"].isin([5, 6]).astype(int)
    df["Month_Sin"] = np.sin(2 * np.pi * df["Order_Month"] / 12.0)
    df["Month_Cos"] = np.cos(2 * np.pi * df["Order_Month"] / 12.0)

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
    promised_date=None,
    daily_fixed_overhead=0.0
):
    """
    Computes stock coverage days, factory downtime, lost units, and dual-component
    financial loss in INR with fractional-day and hourly resolution.
    Compares the expected delivery arrival date against the inventory stockout date.
    """
    delay = max(0.0, float(predicted_delay_days))
    stock = max(0.0, float(available_stock))
    cost = max(0.0, float(unit_cost))
    burn_rate = float(daily_production)
    overhead = max(0.0, float(daily_fixed_overhead))

    if burn_rate <= 0:
        return {
            "Stock_Coverage_Days": float("inf"),
            "Production_Downtime_Days": 0.0,
            "Production_Downtime_Hours": 0.0,
            "Lost_Shifts_8h": 0.0,
            "Lost_Production_Units": 0.0,
            "Daily_Production_Loss": 0.0,
            "Direct_Product_Loss": 0.0,
            "Fixed_Overhead_Loss": 0.0,
            "Total_Production_Loss": 0.0,
            "Buffer_Deficit_Units": 0.0,
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

    downtime_hours = downtime_days * 24.0
    lost_shifts = round(downtime_hours / 8.0, 1)
    lost_units = downtime_days * burn_rate
    daily_loss = burn_rate * cost
    direct_product_loss = lost_units * cost
    fixed_overhead_loss = downtime_days * overhead
    total_loss = direct_product_loss + fixed_overhead_loss
    buffer_deficit_units = max(0.0, downtime_days * burn_rate)

    return {
        "Stock_Coverage_Days": round(stock_coverage_days, 2),
        "Production_Downtime_Days": round(downtime_days, 2),
        "Production_Downtime_Hours": round(downtime_hours, 1),
        "Lost_Shifts_8h": lost_shifts,
        "Lost_Production_Units": round(lost_units, 2),
        "Daily_Production_Loss": round(daily_loss, 2),
        "Direct_Product_Loss": round(direct_product_loss, 2),
        "Fixed_Overhead_Loss": round(fixed_overhead_loss, 2),
        "Total_Production_Loss": round(total_loss, 2),
        "Buffer_Deficit_Units": round(buffer_deficit_units, 1),
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
    Ranks verified alternative suppliers using physical inventory timeline simulation
    and Multi-Criteria Decision Analysis (MCDA) match scoring (0-100%):
    1. Exact Item compatibility & Quality approval.
    2. Ability to deliver before stockout (Downtime prevention).
    3. Available quantity coverage.
    4. Delivery reliability and quality rating.
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
    loss_without_alt = orig_downtime_days * burn_rate * float(current_unit_cost)

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

        capacity = float(row.get("Supplier_Capacity", 999999.0))
        supplied_qty = min(req_qty, alt_available_qty, capacity)

        if alt_available_qty >= req_qty:
            qty_status = f"Full ({alt_available_qty:,.0f} Units)"
        else:
            qty_status = f"Partial ({alt_available_qty:,.0f} / {req_qty:,.0f} Units)"

        qty_coverage_factor = min(1.0, alt_available_qty / req_qty) if req_qty > 0 else 1.0

        # Physical Timeline Simulation:
        if alt_lead_days >= days_until_orig_delivery:
            alt_downtime_days = orig_downtime_days
            downtime_prevented = 0.0
        else:
            unavoidable_downtime = max(0.0, alt_lead_days - stock_coverage_days)
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
            lead_score = 100.0
        elif downtime_prevented > 0:
            diff_days = max(1, (alt_delivery_date - stockout_date).days)
            feasibility = f"Arrives {diff_days}d after stockout, but shortens shutdown by {downtime_prevented:.1f}d"
            lead_score = max(20.0, min(95.0, (downtime_prevented / max(orig_downtime_days, 0.1)) * 100.0))
        else:
            feasibility = "No Downtime Reduction (Arrives after original shipment)"
            lead_score = 10.0

        # MCDA 5-factor scoring (0-100%):
        fin_ratio = net_benefit / max(loss_without_alt, 1.0) if loss_without_alt > 0 else 1.0
        financial_score = max(0.0, min(100.0, fin_ratio * 100.0))
        reliability_score = max(0.0, min(100.0, on_time_rate))
        rating_score = max(0.0, min(100.0, rating * 20.0))
        qty_score = min(100.0, qty_coverage_factor * 100.0)

        mcda_score = (
            0.35 * lead_score +
            0.25 * financial_score +
            0.20 * reliability_score +
            0.10 * rating_score +
            0.10 * qty_score
        )

        candidates.append({
            "Supplier ID": row["Candidate_Supplier_ID"],
            "Item": f"{row['Item_ID']} - {row.get('Item_Name', '')}",
            "Match Score": f"{mcda_score:.1f}%",
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
            "Raw_MCDA_Score": round(mcda_score, 1),
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
                f"Candidate {row['Candidate_Supplier_ID']} achieves {mcda_score:.1f}% MCDA suitability score, "
                f"delivering in {alt_lead_days:.0f} days with {on_time_rate:.1f}% on-time reliability and {rating:.2f} rating. "
                f"Supplies {qty_status}. {feasibility}. "
                f"Prevents {downtime_prevented:.1f} days downtime, avoiding ₹{loss_avoided:,.2f} in production loss "
                f"with net financial benefit of ₹{net_benefit:,.2f}."
            )
        })

    res_df = pd.DataFrame(candidates)
    if res_df.empty:
        return pd.DataFrame()

    res_df = res_df.sort_values(
        by=[
            "Arrives_Before_Stockout",
            "Raw_MCDA_Score",
            "Net_Benefit_INR",
            "Downtime_Prevented_Days",
            "Raw_On_Time_Rate",
            "Raw_Rating"
        ],
        ascending=[False, False, False, False, False, False]
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
        "Production_Downtime_Hours": loss_orig["Production_Downtime_Hours"],
        "Lost_Production_Units": loss_orig["Lost_Production_Units"],
        "Estimated_Production_Loss_INR": loss_orig["Total_Production_Loss"],
        "Additional_Procurement_Cost_INR": 0.0,
        "Production_Loss_Avoided_INR": 0.0,
        "Net_Financial_Benefit_INR": -loss_orig["Total_Production_Loss"]
    })

    # Scenario B: Second Alternative / Benchmark
    alt_b = runner_up_alternative_row if runner_up_alternative_row is not None else best_alternative_row
    if alt_b is not None and not alt_b.empty:
        down_b = alt_b["Alt_Downtime_Days"]
        scenarios.append({
            "Scenario": f"Scenario B: Alternative Supplier ({alt_b['Supplier ID']})",
            "Supplier": alt_b["Supplier ID"],
            "Expected_Arrival_Date": alt_b["Alt_Delivery_Date"],
            "Production_Downtime_Days": down_b,
            "Production_Downtime_Hours": round(down_b * 24.0, 1),
            "Lost_Production_Units": round(down_b * daily_production, 2),
            "Estimated_Production_Loss_INR": alt_b["Alt_Production_Loss"],
            "Additional_Procurement_Cost_INR": alt_b["Extra_Cost_INR"],
            "Production_Loss_Avoided_INR": alt_b["Loss_Avoided_INR"],
            "Net_Financial_Benefit_INR": alt_b["Net_Benefit_INR"]
        })

    # Scenario C: Best Feasible Alternative
    if best_alternative_row is not None and not best_alternative_row.empty:
        down_c = best_alternative_row["Alt_Downtime_Days"]
        scenarios.append({
            "Scenario": f"Scenario C: Best Feasible Alternative ({best_alternative_row['Supplier ID']})",
            "Supplier": best_alternative_row["Supplier ID"],
            "Expected_Arrival_Date": best_alternative_row["Alt_Delivery_Date"],
            "Production_Downtime_Days": down_c,
            "Production_Downtime_Hours": round(down_c * 24.0, 1),
            "Lost_Production_Units": round(down_c * daily_production, 2),
            "Estimated_Production_Loss_INR": best_alternative_row["Alt_Production_Loss"],
            "Additional_Procurement_Cost_INR": best_alternative_row["Extra_Cost_INR"],
            "Production_Loss_Avoided_INR": best_alternative_row["Loss_Avoided_INR"],
            "Net_Financial_Benefit_INR": best_alternative_row["Net_Benefit_INR"]
        })

    return pd.DataFrame(scenarios)
