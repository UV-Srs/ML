import os
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt

# 1. Load both production pipelines
from ml.predict import load_models
delay_pipeline, risk_pipeline = load_models()

def clean_feature_name(name):
    """Clean sklearn ColumnTransformer output names for executive presentation."""
    name = name.replace("num__", "").replace("cat__", "")
    name = name.replace("_", " ")
    return name

def extract_importance(pipeline, model_name):
    """Extract and sort feature importances from an XGBoost pipeline."""
    preprocessor = pipeline.named_steps["preprocessor"]
    raw_feature_names = preprocessor.get_feature_names_out()
    clean_names = [clean_feature_name(f) for f in raw_feature_names]
    
    estimator = pipeline.named_steps[list(pipeline.named_steps.keys())[-1]]
    importances = estimator.feature_importances_
    
    df = pd.DataFrame({
        "Raw_Feature": raw_feature_names,
        "Feature": clean_names,
        "Importance": importances
    }).sort_values("Importance", ascending=False).reset_index(drop=True)
    
    df["Rank"] = df.index + 1
    df["Cumulative_Importance"] = df["Importance"].cumsum() / df["Importance"].sum() * 100.0
    return df

df_delay = extract_importance(delay_pipeline, "Delay Regressor")
df_risk = extract_importance(risk_pipeline, "Risk Classifier")

print("=== TOP 20 FEATURES: DELIVERY DELAY REGRESSOR ===")
print(df_delay[["Rank", "Feature", "Importance", "Cumulative_Importance"]].head(20).to_string(index=False))

print("\n=== TOP 20 FEATURES: DELIVERY RISK CLASSIFIER ===")
print(df_risk[["Rank", "Feature", "Importance", "Cumulative_Importance"]].head(20).to_string(index=False))

# ==============================================================================
# GRAPH 1: SIDE-BY-SIDE TOP 20 FEATURE IMPORTANCES
# ==============================================================================
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(18, 9))

# Top 20 for Delay Regressor
top20_delay = df_delay.head(20).sort_values("Importance", ascending=True)
ax1.barh(top20_delay["Feature"], top20_delay["Importance"], color="#1f77b4", edgecolor="#0e4b75", alpha=0.9)
ax1.set_title("Top 20 Features — Delivery Delay Regressor (Days)", fontsize=13, fontweight="bold", pad=12)
ax1.set_xlabel("XGBoost Importance (Gain)", fontsize=11, fontweight="bold")
ax1.grid(axis="x", linestyle="--", alpha=0.4)

# Top 20 for Risk Classifier
top20_risk = df_risk.head(20).sort_values("Importance", ascending=True)
ax2.barh(top20_risk["Feature"], top20_risk["Importance"], color="#d62728", edgecolor="#7a1415", alpha=0.9)
ax2.set_title("Top 20 Features — Delivery Risk Classifier (Probability)", fontsize=13, fontweight="bold", pad=12)
ax2.set_xlabel("XGBoost Importance (Gain)", fontsize=11, fontweight="bold")
ax2.grid(axis="x", linestyle="--", alpha=0.4)

plt.suptitle("Comparative Feature Importance Across Both Production Models", fontsize=15, fontweight="bold", y=0.98)
plt.tight_layout()
fig.savefig("reports/figures/feature_importance_both_models.png", dpi=300, bbox_inches="tight")
plt.close(fig)
print("\nSaved Top 20 bar chart to reports/figures/feature_importance_both_models.png")

# ==============================================================================
# GRAPH 2: FEATURE FATIGUE & CUMULATIVE DECAY CURVES (ELBOW / PARETO ANALYSIS)
# ==============================================================================
fig, (ax_fatigue, ax_cum) = plt.subplots(1, 2, figsize=(18, 7))

# 1. Feature Fatigue / Drop-off Curve (Importance Drop by Feature Rank)
ranks_to_plot = min(100, len(df_delay))
ax_fatigue.plot(df_delay["Rank"][:ranks_to_plot], df_delay["Importance"][:ranks_to_plot], 
                color="#1f77b4", linewidth=2.5, marker="o", markersize=4, label="Delay Regressor Importance")
ax_fatigue.plot(df_risk["Rank"][:ranks_to_plot], df_risk["Importance"][:ranks_to_plot], 
                color="#d62728", linewidth=2.5, marker="s", markersize=4, label="Risk Classifier Importance")
ax_fatigue.axvline(x=20, color="gray", linestyle=":", linewidth=1.5, label="Top 20 Feature Cutoff")
ax_fatigue.set_title("Feature Importance Decay (Fatigue Curve)", fontsize=13, fontweight="bold", pad=12)
ax_fatigue.set_xlabel("Feature Rank (Most to Least Important)", fontsize=11, fontweight="bold")
ax_fatigue.set_ylabel("Individual Feature Importance", fontsize=11, fontweight="bold")
ax_fatigue.set_xlim(1, ranks_to_plot)
ax_fatigue.grid(True, linestyle="--", alpha=0.4)
ax_fatigue.legend(fontsize=10)

# Annotate fatigue elbow
ax_fatigue.annotate("Fatigue Elbow\n(Diminishing Returns)", xy=(25, df_risk["Importance"].iloc[24]),
                    xytext=(35, df_risk["Importance"].iloc[5]),
                    arrowprops=dict(facecolor="black", shrink=0.08, width=1.5, headwidth=8),
                    fontsize=10, fontweight="bold")

# 2. Cumulative Importance / Pareto Saturation Curve
ax_cum.plot(df_delay["Rank"], df_delay["Cumulative_Importance"], 
            color="#1f77b4", linewidth=2.5, label="Delay Regressor Cumulative %")
ax_cum.plot(df_risk["Rank"], df_risk["Cumulative_Importance"], 
            color="#d62728", linewidth=2.5, label="Risk Classifier Cumulative %")
ax_cum.axhline(y=50, color="green", linestyle="--", linewidth=1.2, label="50% Total Predictive Power")
ax_cum.axhline(y=80, color="orange", linestyle="--", linewidth=1.2, label="80% Total Predictive Power (Pareto)")
ax_cum.axvline(x=20, color="gray", linestyle=":", linewidth=1.5)
ax_cum.set_title("Cumulative Predictive Power Saturation Curve", fontsize=13, fontweight="bold", pad=12)
ax_cum.set_xlabel("Number of Top Features Included", fontsize=11, fontweight="bold")
ax_cum.set_ylabel("Cumulative Variance Explained (%)", fontsize=11, fontweight="bold")
ax_cum.set_xlim(1, len(df_delay))
ax_cum.set_ylim(0, 105)
ax_cum.grid(True, linestyle="--", alpha=0.4)
ax_cum.legend(fontsize=10, loc="lower right")

plt.suptitle("Feature Fatigue & Predictive Saturation Analysis for Both Models", fontsize=15, fontweight="bold", y=1.00)
plt.tight_layout()
fig.savefig("reports/figures/feature_fatigue_curves_both_models.png", dpi=300, bbox_inches="tight")
plt.close(fig)
print("Saved Feature Fatigue curve to reports/figures/feature_fatigue_curves_both_models.png")

