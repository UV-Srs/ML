import os
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import (
    roc_curve, auc, precision_recall_curve, average_precision_score,
    confusion_matrix, mean_absolute_error, mean_squared_error, r2_score
)
from sklearn.calibration import calibration_curve
import scipy.stats as stats

# Setup directories and visual styles
os.makedirs("reports/figures", exist_ok=True)
plt.style.use("seaborn-v0_8-whitegrid" if "seaborn-v0_8-whitegrid" in plt.style.available else "default")
plt.rcParams.update({"font.size": 10, "figure.autolayout": True})

print("1. Loading Models and Holdout Test Data...")
from predict import prepare_features

delay_pipeline = joblib.load("models/combined_delivery_delay_pipeline.pkl")
risk_pipeline = joblib.load("models/combined_delivery_risk_pipeline.pkl")

# Load holdout test data (last 20% chronological split of combined dataset)
df = pd.read_csv("data/processed/combined_supplier_delivery_data.csv")
df["Order_Date"] = pd.to_datetime(df["Order_Date"])
df = df.sort_values("Order_Date").reset_index(drop=True)

split_index = int(len(df) * 0.8)
test_df = df.iloc[split_index:].copy().reset_index(drop=True)

# Prepare inference features and targets
X_test = prepare_features(test_df)
y_reg_true = test_df["Actual_Delay_Days"].values
y_clf_true = (y_reg_true > 0).astype(int)

# Inference predictions
y_reg_pred = np.maximum(delay_pipeline.predict(X_test), 0)
y_clf_prob = risk_pipeline.predict_proba(X_test)[:, 1]
CALIBRATED_THRESH = 0.38
y_clf_pred = (y_clf_prob >= CALIBRATED_THRESH).astype(int)

print(f"Loaded {len(test_df):,} test orders. Generating all ML graphs...")

# ==============================================================================
# 1. ACTUAL VS PREDICTED DELAY (REGRESSION PARITY PLOT)
# ==============================================================================
plt.figure(figsize=(8, 6))
# Sample 5,000 points for clear scatter visualization without overplotting
idx = np.random.RandomState(42).choice(len(y_reg_true), size=min(5000, len(y_reg_true)), replace=False)
plt.scatter(y_reg_true[idx], y_reg_pred[idx], alpha=0.25, color="#1f77b4", edgecolors="none", s=25, label="Holdout Orders")
max_val = max(y_reg_true.max(), y_reg_pred.max())
plt.plot([0, max_val], [0, max_val], color="crimson", linestyle="--", linewidth=2, label="Ideal Perfect Fit (45°)")
plt.fill_between([0, max_val], [0-1, max_val-1], [0+1, max_val+1], color="green", alpha=0.15, label="±1 Day Buffer Band")
plt.xlabel("Actual Delay (Days)", fontsize=11, fontweight="bold")
plt.ylabel("Predicted Delay (Days)", fontsize=11, fontweight="bold")
plt.title(f"Actual vs. Predicted Delay Days (MAE: {mean_absolute_error(y_reg_true, y_reg_pred):.2f}d, R²: {r2_score(y_reg_true, y_reg_pred)*100:.1f}%)", fontsize=12, fontweight="bold")
plt.legend(loc="upper left")
plt.tight_layout()
plt.savefig("reports/figures/01_actual_vs_predicted_regression.png", dpi=300)
plt.close()

# ==============================================================================
# 2. RESIDUALS PLOT (HOMOSCEDASTICITY & ERROR RESIDUAL DISTRIBUTION)
# ==============================================================================
residuals = y_reg_true - y_reg_pred
fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(14, 5))

# Residuals vs Predicted
ax1.scatter(y_reg_pred[idx], residuals[idx], alpha=0.3, color="#2ca02c", s=20)
ax1.axhline(0, color="crimson", linestyle="--", linewidth=2)
ax1.set_xlabel("Predicted Delay (Days)", fontsize=11, fontweight="bold")
ax1.set_ylabel("Residual (Actual - Predicted)", fontsize=11, fontweight="bold")
ax1.set_title("Residuals vs. Fitted Values", fontsize=12, fontweight="bold")

# Residual Distribution Histogram + KDE
sns.histplot(residuals, bins=40, kde=True, color="#2ca02c", ax=ax2)
ax2.axvline(0, color="crimson", linestyle="--", linewidth=1.5)
ax2.set_xlabel("Residual Error (Days)", fontsize=11, fontweight="bold")
ax2.set_ylabel("Order Count", fontsize=11, fontweight="bold")
ax2.set_title("Distribution of Prediction Residuals", fontsize=12, fontweight="bold")

plt.tight_layout()
plt.savefig("reports/figures/02_residuals_analysis.png", dpi=300)
plt.close()

# ==============================================================================
# 3. NORMAL Q-Q PLOT (RESIDUAL NORMALITY CHECK)
# ==============================================================================
plt.figure(figsize=(7, 6))
stats.probplot(residuals, dist="norm", plot=plt)
plt.title("Normal Q-Q Plot of Delay Residuals", fontsize=12, fontweight="bold")
plt.xlabel("Theoretical Quantiles", fontsize=11, fontweight="bold")
plt.ylabel("Sample Quantiles", fontsize=11, fontweight="bold")
plt.tight_layout()
plt.savefig("reports/figures/03_qq_plot_residuals.png", dpi=300)
plt.close()

# ==============================================================================
# 4. TOLERANCE ACCURACY BANDS (CUMULATIVE ERROR CDF)
# ==============================================================================
abs_errors = np.abs(residuals)
tolerances = np.linspace(0, 5, 100)
cumulative_acc = [(abs_errors <= t).mean() * 100 for t in tolerances]

plt.figure(figsize=(8, 5))
plt.plot(tolerances, cumulative_acc, color="#9467bd", linewidth=2.5, label="Cumulative Accuracy (%)")
plt.axvline(1.0, color="#d62728", linestyle=":", linewidth=1.5, label=f"±1 Day: {(abs_errors <= 1.0).mean()*100:.1f}%")
plt.axvline(2.0, color="#ff7f0e", linestyle=":", linewidth=1.5, label=f"±2 Days: {(abs_errors <= 2.0).mean()*100:.1f}%")
plt.axvline(3.0, color="#2ca02c", linestyle=":", linewidth=1.5, label=f"±3 Days: {(abs_errors <= 3.0).mean()*100:.1f}%")
plt.xlabel("Error Margin / Tolerance Threshold (Days)", fontsize=11, fontweight="bold")
plt.ylabel("Shipments Within Tolerance (%)", fontsize=11, fontweight="bold")
plt.title("Tolerance Accuracy Curve (Delivery Window Reliability)", fontsize=12, fontweight="bold")
plt.ylim(0, 102)
plt.legend(loc="lower right")
plt.tight_layout()
plt.savefig("reports/figures/04_tolerance_accuracy_curve.png", dpi=300)
plt.close()

# ==============================================================================
# 5. CONFUSION MATRIX HEATMAP (CALIBRATED CUTOFF t=0.38)
# ==============================================================================
cm = confusion_matrix(y_clf_true, y_clf_pred)
plt.figure(figsize=(7, 6))
sns.heatmap(cm, annot=True, fmt=",d", cmap="Blues", cbar=False,
            xticklabels=["Predicted: On-Time", "Predicted: Delayed"],
            yticklabels=["True: On-Time", "True: Delayed"],
            annot_kws={"size": 13, "weight": "bold"})
plt.title(f"Confusion Matrix (Calibrated Threshold t={CALIBRATED_THRESH})\nOverall Accuracy: {(y_clf_true == y_clf_pred).mean()*100:.2f}%", fontsize=12, fontweight="bold", pad=12)
plt.ylabel("Actual Label", fontsize=11, fontweight="bold")
plt.xlabel("Predicted Label", fontsize=11, fontweight="bold")
plt.tight_layout()
plt.savefig("reports/figures/05_confusion_matrix.png", dpi=300)
plt.close()

# ==============================================================================
# 6. ROC CURVE (RECEIVER OPERATING CHARACTERISTIC)
# ==============================================================================
fpr, tpr, roc_thresh = roc_curve(y_clf_true, y_clf_prob)
roc_score = auc(fpr, tpr)

plt.figure(figsize=(8, 6))
plt.plot(fpr, tpr, color="#ff7f0e", linewidth=2.5, label=f"XGBoost Classifier (AUC = {roc_score:.4f})")
plt.plot([0, 1], [0, 1], color="navy", linestyle="--", linewidth=1.5, label="Random Guess (AUC = 0.50)")
# Mark calibrated threshold location
closest_idx = np.argmin(np.abs(roc_thresh - CALIBRATED_THRESH))
plt.plot(fpr[closest_idx], tpr[closest_idx], marker="o", markersize=8, color="red", label=f"Calibrated Cutoff (t={CALIBRATED_THRESH})")
plt.xlabel("False Positive Rate (1 - Specificity)", fontsize=11, fontweight="bold")
plt.ylabel("True Positive Rate (Sensitivity / Recall)", fontsize=11, fontweight="bold")
plt.title("ROC Curve — Delivery Risk Classification", fontsize=12, fontweight="bold")
plt.legend(loc="lower right")
plt.tight_layout()
plt.savefig("reports/figures/06_roc_curve.png", dpi=300)
plt.close()

# ==============================================================================
# 7. PRECISION-RECALL (PR) CURVE
# ==============================================================================
prec, rec, pr_thresh = precision_recall_curve(y_clf_true, y_clf_prob)
ap_score = average_precision_score(y_clf_true, y_clf_prob)

plt.figure(figsize=(8, 6))
plt.plot(rec, prec, color="#d62728", linewidth=2.5, label=f"Precision-Recall Curve (AP = {ap_score:.4f})")
no_skill = y_clf_true.mean()
plt.plot([0, 1], [no_skill, no_skill], linestyle="--", color="gray", label=f"Class Prevalence ({no_skill*100:.1f}%)")
plt.xlabel("Recall (Delay Capture Rate)", fontsize=11, fontweight="bold")
plt.ylabel("Precision (Accuracy of Delayed Alerts)", fontsize=11, fontweight="bold")
plt.title("Precision-Recall Curve — Imbalanced Risk Detection", fontsize=12, fontweight="bold")
plt.legend(loc="upper right")
plt.tight_layout()
plt.savefig("reports/figures/07_precision_recall_curve.png", dpi=300)
plt.close()

# ==============================================================================
# 8. PREDICTION PROBABILITY DISTRIBUTION BY CLASS (SEPARATION DENSITY)
# ==============================================================================
plt.figure(figsize=(9, 5))
sns.kdeplot(y_clf_prob[y_clf_true == 0], fill=True, color="#1f77b4", label="Actual On-Time Shipments", alpha=0.4, linewidth=2)
sns.kdeplot(y_clf_prob[y_clf_true == 1], fill=True, color="#d62728", label="Actual Delayed Shipments", alpha=0.4, linewidth=2)
plt.axvline(CALIBRATED_THRESH, color="black", linestyle="--", linewidth=2, label=f"Decision Boundary (t={CALIBRATED_THRESH})")
plt.xlabel("Predicted Delay Probability", fontsize=11, fontweight="bold")
plt.ylabel("Density", fontsize=11, fontweight="bold")
plt.title("Class Probability Separation (Discriminative Power)", fontsize=12, fontweight="bold")
plt.xlim(0, 1)
plt.legend()
plt.tight_layout()
plt.savefig("reports/figures/08_probability_distribution_separation.png", dpi=300)
plt.close()

# ==============================================================================
# 9. PROBABILITY CALIBRATION CURVE (RELIABILITY DIAGRAM)
# ==============================================================================
fraction_of_positives, mean_predicted_value = calibration_curve(y_clf_true, y_clf_prob, n_bins=10, strategy="uniform")

plt.figure(figsize=(8, 6))
plt.plot(mean_predicted_value, fraction_of_positives, "s-", color="#2ca02c", linewidth=2, label="Risk Classifier")
plt.plot([0, 1], [0, 1], "k--", label="Perfect Calibration (Ideal)")
plt.xlabel("Mean Predicted Probability", fontsize=11, fontweight="bold")
plt.ylabel("Empirical Fraction of Delays (True Frequency)", fontsize=11, fontweight="bold")
plt.title("Calibration Curve (Reliability Diagram)", fontsize=12, fontweight="bold")
plt.legend(loc="lower right")
plt.tight_layout()
plt.savefig("reports/figures/09_calibration_curve.png", dpi=300)
plt.close()

# ==============================================================================
# 10. CORRELATION HEATMAP OF SUPPLY CHAIN PHYSICS FEATURES
# ==============================================================================
corr_features = [
    "Actual_Delay_Days", "Quantity_Ordered", "Unit_Cost", "Distance_KM",
    "Calculated_Lead_Time", "Transit_Velocity", "Volume_Stress",
    "Lead_Time_Deficit", "Supplier_History_Delivery_Rate"
]
corr_features = [f for f in corr_features if f in test_df.columns or f in X_test.columns]
corr_df = pd.concat([test_df[["Actual_Delay_Days"]], X_test], axis=1)[corr_features]

plt.figure(figsize=(10, 8))
corr_mat = corr_df.corr()
sns.heatmap(corr_mat, annot=True, fmt=".2f", cmap="coolwarm", vmin=-1, vmax=1, linewidths=0.5)
plt.title("Correlation Matrix of Supply Chain Physics Features", fontsize=12, fontweight="bold", pad=12)
plt.tight_layout()
plt.savefig("reports/figures/10_feature_correlation_heatmap.png", dpi=300)
plt.close()

# ==============================================================================
# 11. INCREMENTAL DATA SCALING LEARNING CURVES
# ==============================================================================
scaling_csv_path = "data/processed/scaling_study_supplier_regression.csv"
if os.path.exists(scaling_csv_path):
    df_scale_reg = pd.read_csv("data/processed/scaling_study_supplier_regression.csv")
    df_scale_clf = pd.read_csv("data/processed/scaling_study_supplier_classifier.csv")

    fig, (ax_r, ax_c) = plt.subplots(1, 2, figsize=(16, 5))
    # Regression Scaling
    ax_r.plot(df_scale_reg["Size_Label"], df_scale_reg["MAE"], marker="o", color="#1f77b4", linewidth=2.5, label="MAE (Days)")
    ax_r.plot(df_scale_reg["Size_Label"], df_scale_reg["RMSE"], marker="s", color="#d62728", linewidth=2.5, label="RMSE (Days)")
    ax_r.set_title("Delay Regressor: Error Drop vs Data Scaling", fontsize=12, fontweight="bold")
    ax_r.set_xlabel("Training Dataset Size", fontsize=11, fontweight="bold")
    ax_r.set_ylabel("Error in Days", fontsize=11, fontweight="bold")
    ax_r.legend()
    ax_r.grid(True, linestyle="--", alpha=0.4)

    # Classification Scaling
    ax_c.plot(df_scale_clf["Size_Label"], df_scale_clf["Accuracy_%"], marker="o", color="#ff7f0e", linewidth=2.5, label="Accuracy (%)")
    ax_c.plot(df_scale_clf["Size_Label"], df_scale_clf["ROC_AUC"]*100, marker="d", color="#2ca02c", linewidth=2.5, label="ROC-AUC (x100)")
    ax_c.plot(df_scale_clf["Size_Label"], df_scale_clf["Recall_%"], marker="^", color="#9467bd", linewidth=2.5, label="Recall (%)")
    ax_c.set_title("Risk Classifier: Accuracy & Recall vs Data Scaling", fontsize=12, fontweight="bold")
    ax_c.set_xlabel("Training Dataset Size", fontsize=11, fontweight="bold")
    ax_c.set_ylabel("Score (%)", fontsize=11, fontweight="bold")
    ax_c.legend()
    ax_c.grid(True, linestyle="--", alpha=0.4)

    plt.tight_layout()
    plt.savefig("reports/figures/11_incremental_data_scaling_curves.png", dpi=300)
    plt.close()

print("\nAll 11 essential ML graphs generated and saved to reports/figures/ successfully!")

