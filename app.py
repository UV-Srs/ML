import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path
from datetime import timedelta

import predict

# =====================================================
# CONFIGURATION
# =====================================================

st.set_page_config(
    page_title="Supplier Delivery Prediction & Loss Prevention System",
    page_icon="🚚",
    layout="wide"
)

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"
DATA_DIR = BASE_DIR / "data"

DELAY_PIPELINE_PATH = MODEL_DIR / "combined_delivery_delay_pipeline.pkl"
RISK_PIPELINE_PATH = MODEL_DIR / "combined_delivery_risk_pipeline.pkl"
ALTERNATIVE_ENGINE_PATH = MODEL_DIR / "alternative_supplier_engine.pkl"
HISTORY_PATH = DATA_DIR / "processed" / "combined_supplier_delivery_data.csv"


# =====================================================
# LOAD MODELS AND DATA (CACHED, NO RETRAINING)
# =====================================================

@st.cache_resource
def load_cached_pipelines():
    return predict.load_models()


@st.cache_resource
def load_cached_alt_engine():
    return predict.load_alternative_engine()


@st.cache_data
def load_history():
    return pd.read_csv(HISTORY_PATH)


try:
    delay_pipeline, risk_pipeline = load_cached_pipelines()
    alt_engine = load_cached_alt_engine()
    history = load_history()
except Exception as e:
    st.error(f"Error loading system artifacts: {e}")
    st.info("Ensure that Notebooks 08, 09, and 10 have been executed to produce the required pipeline files.")
    st.stop()


# =====================================================
# FORMATTING HELPERS
# =====================================================

def format_delay(delay_days):
    delay_days = max(float(delay_days), 0.0)
    if delay_days == 0:
        return "On Time"
    total_hours = delay_days * 24.0
    if total_hours < 24.0:
        return f"{total_hours:.1f} Hours Late"
    return f"{delay_days:.2f} Days Late"


def get_risk_badge(risk_level):
    if risk_level == "High":
        return "🔴 High Risk"
    elif risk_level == "Medium":
        return "🟡 Medium Risk"
    return "🟢 Low Risk"


# =====================================================
# SIDEBAR NAVIGATION
# =====================================================

st.sidebar.title("🚚 Delivery & Loss Prevention")
st.sidebar.markdown("**AI Supply Chain Intelligence**")

page = st.sidebar.radio(
    "Navigation",
    [
        "Dashboard Overview",
        "Manual Purchase Order",
        "Bulk CSV Prediction"
    ]
)

st.sidebar.divider()
st.sidebar.info(
    "💡 **Intelligent Prevention Engine:**\n\n"
    "• Predicts shipment delays with XGBoost\n"
    "• Calculates inventory buffer coverage\n"
    "• Detects factory stockouts in advance\n"
    "• Recommends optimal alternative suppliers to avoid production downtime"
)


# =====================================================
# PAGE 1: DASHBOARD OVERVIEW
# =====================================================

if page == "Dashboard Overview":
    st.title("🚚 Supplier Delivery & Production Loss Prevention System")
    st.caption("Purchase Order Risk Management | Delay Prediction | Production Loss Avoidance")

    st.header("Executive Overview")
    col1, col2, col3, col4 = st.columns(4)

    total_orders = len(history)
    unique_suppliers = history["Supplier_ID"].nunique()
    unique_items = history["Item_ID"].nunique()
    avg_delay = history["Actual_Delay_Days"].mean()

    col1.metric("Historical Delivery Records", f"{total_orders:,}")
    col2.metric("Catalog Automotive Items", f"{unique_items}")
    col3.metric("Monitored Suppliers", f"{unique_suppliers}")
    col4.metric("Average Historical Delay", f"{avg_delay:.2f} Days")

    st.divider()

    st.subheader("Historical Delivery Performance Database")
    display_cols = [
        "Shipment_ID",
        "Purchase_Order_ID",
        "Supplier_ID",
        "Item_ID",
        "Item_Name",
        "Quantity_Ordered",
        "Order_Date",
        "Promised_Date",
        "Actual_Delay_Days",
        "Actual_Delivery_Status"
    ]
    st.dataframe(history[display_cols].head(100), width="stretch")
    st.caption(f"Showing first 100 of {len(history):,} historical procurement transactions.")


# =====================================================
# PAGE 2: MANUAL PURCHASE ORDER SIMULATION
# =====================================================

elif page == "Manual Purchase Order":
    st.title("📝 Purchase Order Risk & Loss Prevention Simulator")
    st.write(
        "Enter a purchase order along with current factory inventory parameters to evaluate "
        "delivery delay, predict stockout risks, and trigger automatic alternative supplier mitigation."
    )

    supplier_list = sorted(history["Supplier_ID"].dropna().unique().tolist())
    item_catalog = (
        history[["Item_ID", "Item_Name"]]
        .drop_duplicates()
        .sort_values("Item_ID")
    )
    item_dict = {
        f"{row.Item_ID} - {row.Item_Name}": row.Item_ID
        for row in item_catalog.itertuples()
    }

    with st.form("manual_po_form"):
        st.subheader("1. Purchase Order Information")
        c1, c2, c3 = st.columns(3)
        with c1:
            po_id = st.text_input("Purchase Order ID", value="PO-99201")
            supplier_id = st.selectbox("Original Supplier", supplier_list)
        with c2:
            selected_item_str = st.selectbox("Component / Part", list(item_dict.keys()))
            quantity = st.number_input("Order Quantity (Units)", min_value=1, value=500, step=50)
        with c3:
            order_date = st.date_input("Order Date")
            promised_date = st.date_input("Promised Delivery Date")

        st.subheader("2. Factory Assembly Line & Inventory Context")
        ic1, ic2, ic3 = st.columns(3)
        with ic1:
            available_stock = st.number_input(
                "Available Inventory Buffer (Units)",
                min_value=0,
                value=100,
                step=10,
                help="Units currently in factory warehouse stock."
            )
        with ic2:
            daily_production = st.number_input(
                "Daily Production Burn Rate (Units/Day)",
                min_value=1,
                value=50,
                step=5,
                help="Number of units consumed daily by assembly lines."
            )
        with ic3:
            unit_cost = st.number_input(
                "Component Unit Price (₹)",
                min_value=1.0,
                value=4500.0,
                step=100.0,
                help="Price per unit used for financial loss computation."
            )

        submit_btn = st.form_submit_button("🔍 Run Prediction & Stockout Analysis", width="stretch")

    if submit_btn:
        if not po_id.strip():
            st.error("Please enter a valid Purchase Order ID.")
        elif promised_date < order_date:
            st.error("Promised Delivery Date cannot be earlier than Order Date.")
        elif daily_production <= 0:
            st.error("Daily Production Burn Rate must be greater than zero.")
        else:
            item_id = item_dict[selected_item_str]

            try:
                # 1. Build manual feature row
                input_df = predict.build_manual_order(
                    purchase_order_id=po_id,
                    supplier_id=supplier_id,
                    item_id=item_id,
                    quantity=quantity,
                    order_date=order_date,
                    promised_date=promised_date,
                    history=history
                )

                # 2. Predict delay and risk
                pred_df = predict.predict_orders(input_df)
                predicted_delay = float(pred_df["Predicted_Delay_Days"].iloc[0])
                delay_probability = float(pred_df["Delay_Probability"].iloc[0])
                risk_tier = str(pred_df["Delivery_Risk"].iloc[0])

                # 3. Calculate stock coverage and production loss
                loss_info = predict.calculate_production_loss(
                    predicted_delay_days=predicted_delay,
                    available_stock=available_stock,
                    daily_production=daily_production,
                    unit_cost=unit_cost,
                    order_date=order_date,
                    promised_date=promised_date
                )

                original_lead_time = (promised_date - order_date).days

                st.divider()

                # SECTION: PREDICTION RESULTS
                st.header("📊 Delivery & Operational Impact Assessment")

                delay_str = format_delay(predicted_delay)
                delay_color = "#ef4444" if predicted_delay > 0 else "#22c55e"

                risk_colors = {
                    "High": "#ef4444",
                    "Medium": "#f59e0b",
                    "Low": "#22c55e"
                }
                risk_color = risk_colors.get(risk_tier, "#3b82f6")

                stockout_color = "#ef4444" if loss_info["Stockout_Risk"] else "#22c55e"
                loss_color = "#ef4444" if loss_info["Total_Production_Loss"] > 0 else "#22c55e"

                # 4 Modern Responsive KPI Cards
                card_cols = st.columns(4)

                # Card 1: Delivery Delay
                with card_cols[0]:
                    st.markdown(
                        f"""
                        <div style="background: var(--secondary-background-color, #f8fafc); border: 1px solid rgba(128, 128, 128, 0.2); border-left: 4px solid {delay_color}; border-radius: 8px; padding: 14px 16px; min-height: 110px;">
                            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                ⏱️ Predicted Delay
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: {delay_color}; margin: 6px 0 4px 0; line-height: 1.2;">
                                {delay_str}
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                                Arrival: <strong>{loss_info['Predicted_Arrival_Date'] or 'N/A'}</strong>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

                # Card 2: Risk Tier & Probability
                with card_cols[1]:
                    st.markdown(
                        f"""
                        <div style="background: var(--secondary-background-color, #f8fafc); border: 1px solid rgba(128, 128, 128, 0.2); border-left: 4px solid {risk_color}; border-radius: 8px; padding: 14px 16px; min-height: 110px;">
                            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                🎯 Delivery Risk Tier
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: {risk_color}; margin: 6px 0 4px 0; line-height: 1.2;">
                                {get_risk_badge(risk_tier)}
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                                Delay Probability: <strong>{delay_probability:.1f}%</strong>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

                # Card 3: Stock Buffer Coverage
                with card_cols[2]:
                    st.markdown(
                        f"""
                        <div style="background: var(--secondary-background-color, #f8fafc); border: 1px solid rgba(128, 128, 128, 0.2); border-left: 4px solid {stockout_color}; border-radius: 8px; padding: 14px 16px; min-height: 110px;">
                            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                📦 Stock Coverage
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: var(--text-color, #0f172a); margin: 6px 0 4px 0; line-height: 1.2;">
                                {loss_info['Stock_Coverage_Days']:.1f} Days
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                                Depletes: <strong>{loss_info['Stockout_Date'] or 'N/A'}</strong>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

                # Card 4: Factory Downtime & Financial Loss
                with card_cols[3]:
                    st.markdown(
                        f"""
                        <div style="background: var(--secondary-background-color, #f8fafc); border: 1px solid rgba(128, 128, 128, 0.2); border-left: 4px solid {loss_color}; border-radius: 8px; padding: 14px 16px; min-height: 110px;">
                            <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">
                                🏭 Potential Production Loss
                            </div>
                            <div style="font-size: 20px; font-weight: 700; color: {loss_color}; margin: 6px 0 4px 0; line-height: 1.2;">
                                ₹{loss_info['Total_Production_Loss']:,.2f}
                            </div>
                            <div style="font-size: 12px; color: #64748b;">
                                Plant Downtime: <strong>{loss_info['Production_Downtime_Days']:.1f} Days</strong>
                            </div>
                        </div>
                        """,
                        unsafe_allow_html=True
                    )

                # Timeline Journey Strip
                st.markdown(
                    f"""
                    <div style="background: var(--secondary-background-color, #f8fafc); border: 1px solid rgba(128, 128, 128, 0.2); border-radius: 8px; padding: 12px 18px; margin-top: 14px; margin-bottom: 6px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: center; gap: 12px; font-size: 13px;">
                        <div>📅 <strong>Order Date:</strong> {order_date}</div>
                        <div style="color: #94a3b8; font-weight: bold;">➔</div>
                        <div>📦 <strong>Stock Depletion:</strong> <span style="color: {stockout_color}; font-weight: bold;">{loss_info['Stockout_Date'] or 'N/A'}</span> ({loss_info['Stock_Coverage_Days']:.1f}d buffer)</div>
                        <div style="color: #94a3b8; font-weight: bold;">➔</div>
                        <div>🤝 <strong>Promised Delivery:</strong> {promised_date}</div>
                        <div style="color: #94a3b8; font-weight: bold;">➔</div>
                        <div>🚚 <strong>Predicted Arrival:</strong> <span style="color: {delay_color}; font-weight: bold;">{loss_info['Predicted_Arrival_Date'] or 'N/A'}</span></div>
                    </div>
                    """,
                    unsafe_allow_html=True
                )

                # SECTION: STOCKOUT DETECTION & ALTERNATIVE SUPPLIER RECOMMENDATIONS
                st.divider()
                st.header("Alternative Supplier Recommendations")

                if not loss_info["Stockout_Risk"]:
                    st.success("No alternative supplier required at this time.")
                    st.info(
                        f"**Stock Coverage Analysis:**\n\n"
                        f"• Available Warehouse Stock: **{available_stock:,.0f} units**\n"
                        f"• Daily Production Burn Rate: **{daily_production:,.0f} units/day**\n"
                        f"• Inventory Buffer Coverage: **{loss_info['Stock_Coverage_Days']:.1f} days** (depletes on **{loss_info['Stockout_Date']}**)\n"
                        f"• Expected Shipment Arrival: **{loss_info['Predicted_Arrival_Date']}**\n\n"
                        f"Warehouse stock buffer will cover factory demand until the shipment arrives with no production interruption."
                    )
                else:
                    # 1. Why an alternative is required
                    days_over = max(0.0, loss_info["Production_Downtime_Days"])
                    st.error(
                        f"⚠️ **Why an alternative is required:**\n\n"
                        f"The original supplier's shipment is predicted to arrive on **{loss_info['Predicted_Arrival_Date']}** "
                        f"(including **{predicted_delay:.2f} days** delay), but factory inventory will completely stock out on **{loss_info['Stockout_Date']}** "
                        f"(coverage: **{loss_info['Stock_Coverage_Days']:.1f} days**).\n\n"
                        f"• **Expected Factory Downtime:** {loss_info['Production_Downtime_Days']:.1f} Days\n"
                        f"• **Lost Production Units:** {loss_info['Lost_Production_Units']:,.0f} Units\n"
                        f"• **Potential Production Loss:** ₹{loss_info['Total_Production_Loss']:,.2f}\n\n"
                        f"Because the original delivery occurs **{days_over:.1f} days after stockout**, "
                        f"alternative supplier recommendations have been triggered automatically to prevent assembly line shutdown."
                    )

                    # 2. Find alternative suppliers
                    alt_table = predict.find_alternative_suppliers(
                        item_id=item_id,
                        required_quantity=quantity,
                        current_unit_cost=unit_cost,
                        order_date=order_date,
                        promised_date=promised_date,
                        predicted_delay_days=predicted_delay,
                        available_stock=available_stock,
                        daily_production=daily_production,
                        top_n=5
                    )

                    if alt_table.empty:
                        st.warning("No verified alternative supplier available.")
                        st.info("No verified, quality-approved alternative supplier was found in the catalog for this component. Immediate procurement escalation is advised.")
                    else:
                        top_alt = alt_table.iloc[0]
                        runner_up_alt = alt_table.iloc[1] if len(alt_table) > 1 else None

                        # 3. Best recommendation and reason
                        st.subheader("⭐ Best Recommendation & Reason")
                        st.markdown(
                            f"""
                            <div style="background-color: #f0fdf4; border: 2px solid #22c55e; border-radius: 8px; padding: 18px; margin-bottom: 20px;">
                                <h3 style="color: #15803d; margin-top: 0;">Top Pick: Candidate {top_alt['Supplier ID']} ({top_alt['Item']})</h3>
                                <p style="font-size: 15px; color: #166534; line-height: 1.5;">{top_alt['Explanation']}</p>
                                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-top: 12px; font-size: 14px; color: #14532d;">
                                    <div>⏱️ Lead Time: <strong>{top_alt['Lead Time']}</strong></div>
                                    <div>📦 Available Qty: <strong>{top_alt['Available Quantity']} Units</strong> ({top_alt['Quantity_Status']})</div>
                                    <div>⭐ Supplier Rating: <strong>{top_alt['Supplier Rating']}</strong></div>
                                    <div>🛡️ Downtime Prevented: <strong>{top_alt['Downtime_Prevented_Days']:.1f} Days</strong></div>
                                    <div>💵 Loss Avoided: <strong>₹{top_alt['Loss_Avoided_INR']:,.2f}</strong></div>
                                    <div>📈 Net Financial Benefit: <strong>₹{top_alt['Net_Benefit_INR']:,.2f}</strong></div>
                                </div>
                            </div>
                            """,
                            unsafe_allow_html=True
                        )

                        # 4. Supplier comparison table
                        st.subheader("Recommended Suppliers Comparison Table")
                        required_headers = [
                            "Supplier ID",
                            "Item",
                            "Available Quantity",
                            "Lead Time",
                            "Quality",
                            "Supplier Rating",
                            "Total Cost"
                        ]
                        st.dataframe(alt_table[required_headers], width="stretch")

                        # Detailed Operational & Financial Impact
                        with st.expander("🔍 View Operational & Financial Impact Details"):
                            detail_cols = [
                                "Supplier ID",
                                "Quantity_Status",
                                "Downtime_Prevented_Days",
                                "Loss_Avoided_INR",
                                "Extra_Cost_INR",
                                "Net_Benefit_INR",
                                "Feasibility"
                            ]
                            detail_df = alt_table[detail_cols].rename(columns={
                                "Quantity_Status": "Quantity Fulfillment",
                                "Downtime_Prevented_Days": "Downtime Prevented (Days)",
                                "Loss_Avoided_INR": "Loss Avoided (₹)",
                                "Extra_Cost_INR": "Additional Cost (₹)",
                                "Net_Benefit_INR": "Net Financial Benefit (₹)",
                                "Feasibility": "Operational Feasibility"
                            })
                            st.dataframe(detail_df, width="stretch")

                        # 5. Original versus alternative scenario comparison
                        st.divider()
                        st.subheader("📊 Original vs Alternative Scenario Comparison")
                        st.write(
                            "Simulating plant operations across three distinct procurement strategies: "
                            "**Scenario A** (Original Supplier Only), **Scenario B** (Alternative Supplier), and **Scenario C** (Best Feasible Alternative)."
                        )

                        scenarios_df = predict.compare_three_scenarios(
                            order_date=order_date,
                            promised_date=promised_date,
                            predicted_delay_days=predicted_delay,
                            available_stock=available_stock,
                            daily_production=daily_production,
                            unit_cost=unit_cost,
                            best_alternative_row=top_alt,
                            runner_up_alternative_row=runner_up_alt
                        )

                        # Format table for clean display
                        display_scenarios = pd.DataFrame({
                            "Scenario": scenarios_df["Scenario"],
                            "Supplier": scenarios_df["Supplier"],
                            "Expected Arrival Date": scenarios_df["Expected_Arrival_Date"],
                            "Production Downtime": scenarios_df["Production_Downtime_Days"].apply(lambda x: f"{x:.1f} Days"),
                            "Lost Production Units": scenarios_df["Lost_Production_Units"].apply(lambda x: f"{x:,.0f} Units"),
                            "Estimated Production Loss": scenarios_df["Estimated_Production_Loss_INR"].apply(lambda x: f"₹{x:,.2f}"),
                            "Additional Procurement Cost": scenarios_df["Additional_Procurement_Cost_INR"].apply(lambda x: f"₹{x:,.2f}"),
                            "Production Loss Avoided": scenarios_df["Production_Loss_Avoided_INR"].apply(lambda x: f"₹{x:,.2f}"),
                            "Net Financial Benefit": scenarios_df["Net_Financial_Benefit_INR"].apply(lambda x: f"₹{x:,.2f}")
                        })
                        st.dataframe(display_scenarios, width="stretch")

                        # Plotly Comparison Visualizations
                        chart_c1, chart_c2 = st.columns(2)
                        palette = ["#ef4444", "#f59e0b", "#22c55e"]
                        color_map = {row["Scenario"]: palette[i % len(palette)] for i, row in scenarios_df.iterrows()}

                        with chart_c1:
                            fig_down = px.bar(
                                scenarios_df,
                                x="Scenario",
                                y="Production_Downtime_Days",
                                color="Scenario",
                                color_discrete_map=color_map,
                                title="Expected Factory Downtime (Days)",
                                labels={"Production_Downtime_Days": "Downtime (Days)"}
                            )
                            fig_down.update_layout(showlegend=False)
                            st.plotly_chart(fig_down, width="stretch")

                        with chart_c2:
                            fig_loss = px.bar(
                                scenarios_df,
                                x="Scenario",
                                y="Estimated_Production_Loss_INR",
                                color="Scenario",
                                color_discrete_map=color_map,
                                title="Estimated Production Loss (₹)",
                                labels={"Estimated_Production_Loss_INR": "Production Loss (₹)"}
                            )
                            fig_loss.update_layout(showlegend=False)
                            st.plotly_chart(fig_loss, width="stretch")

                # Export Prediction Report
                st.divider()
                export_data = pred_df.copy()
                for k, v in loss_info.items():
                    export_data[k] = v
                export_data["Unit_Cost"] = unit_cost
                export_data["Daily_Production"] = daily_production
                export_data["Available_Stock"] = available_stock

                csv_bytes = export_data.to_csv(index=False).encode("utf-8")
                st.download_button(
                    label="📥 Download Comprehensive Assessment Report (CSV)",
                    data=csv_bytes,
                    file_name=f"Assessment_{po_id}.csv",
                    mime="text/csv",
                    width="stretch"
                )

            except Exception as e:
                st.error(f"Prediction process encountered an error: {e}")


# =====================================================
# PAGE 3: BULK CSV PREDICTION
# =====================================================

elif page == "Bulk CSV Prediction":
    st.title("📂 Bulk Purchase Order Prediction & Stockout Audit")
    st.write(
        "Upload a batch CSV file containing purchase order records along with production "
        "and inventory context (`Available_Stock`, `Daily_Production_Requirement`, `Unit_Cost`)."
    )

    uploaded_file = st.file_uploader("Upload Purchase Order Batch CSV", type=["csv"])

    if uploaded_file is not None:
        try:
            batch_df = pd.read_csv(uploaded_file)
            st.write(f"Loaded **{len(batch_df):,}** purchase order records.")

            req_cols = ["Available_Stock", "Daily_Production_Requirement", "Unit_Cost"]
            missing_cols = [c for c in req_cols if c not in batch_df.columns]

            if missing_cols:
                st.error(f"Uploaded CSV is missing mandatory inventory columns: {', '.join(missing_cols)}")
            else:
                st.dataframe(batch_df.head(5), width="stretch")

                if st.button("🚀 Process Bulk Predictions", width="stretch"):
                    with st.spinner("Processing batch predictions with trained XGBoost pipelines..."):
                        preds = predict.predict_orders(batch_df)

                        preds["Available_Stock"] = pd.to_numeric(preds["Available_Stock"], errors="coerce").fillna(0)
                        preds["Daily_Production_Requirement"] = pd.to_numeric(preds["Daily_Production_Requirement"], errors="coerce").fillna(1)
                        preds["Unit_Cost"] = pd.to_numeric(preds["Unit_Cost"], errors="coerce").fillna(0)

                        for idx, row in preds.iterrows():
                            ord_d = row["Order_Date"] if "Order_Date" in preds.columns else None
                            prm_d = row["Promised_Date"] if "Promised_Date" in preds.columns else None
                            l_info = predict.calculate_production_loss(
                                predicted_delay_days=row["Predicted_Delay_Days"],
                                available_stock=row["Available_Stock"],
                                daily_production=row["Daily_Production_Requirement"],
                                unit_cost=row["Unit_Cost"],
                                order_date=ord_d,
                                promised_date=prm_d
                            )
                            preds.loc[idx, "Stock_Coverage_Days"] = l_info["Stock_Coverage_Days"]
                            preds.loc[idx, "Production_Downtime_Days"] = l_info["Production_Downtime_Days"]
                            preds.loc[idx, "Total_Production_Loss"] = l_info["Total_Production_Loss"]
                            preds.loc[idx, "Stockout_Risk"] = l_info["Stockout_Risk"]

                        st.success("Batch processing completed successfully!")

                        # Metrics summary
                        c1, c2, c3 = st.columns(3)
                        total_stockouts = preds["Stockout_Risk"].sum()
                        total_batch_loss = preds["Total_Production_Loss"].sum()
                        c1.metric("Total Orders Evaluated", f"{len(preds):,}")
                        c2.metric("Orders with Stockout Risk", f"{total_stockouts:,} ({total_stockouts/len(preds)*100:.1f}%)")
                        c3.metric("Total Potential Financial Loss", f"₹{total_batch_loss:,.2f}")

                        st.subheader("Results Preview")
                        st.dataframe(preds.head(20), width="stretch")

                        # Plot distribution
                        fig_risk = px.histogram(
                            preds,
                            x="Delivery_Risk",
                            color="Delivery_Risk",
                            title="Delivery Risk Distribution",
                            color_discrete_map={"Low": "#22c55e", "Medium": "#f59e0b", "High": "#ef4444"}
                        )
                        st.plotly_chart(fig_risk, width="stretch")

                        csv_out = preds.to_csv(index=False).encode("utf-8")
                        st.download_button(
                            "📥 Download Batch Predictions & Loss Report",
                            data=csv_out,
                            file_name="Bulk_Delivery_Loss_Report.csv",
                            mime="text/csv",
                            width="stretch"
                        )

        except Exception as e:
            st.error(f"Error processing CSV: {e}")

# =====================================================
# FOOTER
# =====================================================

st.divider()
st.caption(
    "Supplier Delivery Prediction & Loss Prevention System | "
    "Trained with XGBoost Pipelines & Alternative Recommendation Engine"
)
