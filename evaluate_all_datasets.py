import joblib
import pandas as pd
import numpy as np
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score,
    accuracy_score, roc_auc_score, precision_score, recall_score, f1_score, confusion_matrix
)
from predict import prepare_features

print("1. Loading Models...")
delay_pipe = joblib.load("models/combined_delivery_delay_pipeline.pkl")
risk_pipe = joblib.load("models/combined_delivery_risk_pipeline.pkl")
alt_engine = joblib.load("models/alternative_supplier_engine.pkl")
alt_model = alt_engine["model_pipeline"]

def evaluate_supplier_data(df, label):
    df_eval = df.copy()
    y_reg = df_eval["Actual_Delay_Days"].values
    y_clf = (y_reg > 0).astype(int)
    
    X_eval = prepare_features(df_eval)
    
    pred_delays = np.maximum(delay_pipe.predict(X_eval), 0)
    probs = risk_pipe.predict_proba(X_eval)[:, 1]
    preds_cal = (probs >= 0.38).astype(int)
    
    mae = mean_absolute_error(y_reg, pred_delays)
    rmse = np.sqrt(mean_squared_error(y_reg, pred_delays))
    r2 = r2_score(y_reg, pred_delays)
    
    diff = np.abs(pred_delays - y_reg)
    w1 = (diff <= 1.0).mean() * 100.0
    w2 = (diff <= 2.0).mean() * 100.0
    w3 = (diff <= 3.0).mean() * 100.0
    
    acc = accuracy_score(y_clf, preds_cal)
    roc = roc_auc_score(y_clf, probs)
    prec = precision_score(y_clf, preds_cal)
    rec = recall_score(y_clf, preds_cal)
    f1 = f1_score(y_clf, preds_cal)
    
    cm = confusion_matrix(y_clf, preds_cal)
    
    return {
        "Dataset": label,
        "Total_Rows": len(df),
        "Reg_MAE_Days": round(mae, 4),
        "Reg_RMSE_Days": round(rmse, 4),
        "Reg_R2_%": round(r2 * 100, 2),
        "Within_1d_%": round(w1, 2),
        "Within_2d_%": round(w2, 2),
        "Within_3d_%": round(w3, 2),
        "Clf_Accuracy_%": round(acc * 100, 2),
        "Clf_ROC_AUC": round(roc, 4),
        "Clf_Precision_%": round(prec * 100, 2),
        "Clf_Recall_%": round(rec * 100, 2),
        "Clf_F1": round(f1, 4),
        "TN": cm[0, 0], "FP": cm[0, 1], "FN": cm[1, 0], "TP": cm[1, 1]
    }

print("\n2. Evaluating Supplier Datasets...")
# 1. 240k Combined Holdout (48,000 test records)
df_comb = pd.read_csv("data/processed/combined_supplier_delivery_data.csv")
df_comb["Order_Date"] = pd.to_datetime(df_comb["Order_Date"])
df_comb = df_comb.sort_values("Order_Date").reset_index(drop=True)
split_idx = int(len(df_comb) * 0.8)
test_comb = df_comb.iloc[split_idx:].copy().reset_index(drop=True)

res_holdout = evaluate_supplier_data(test_comb, "Combined 240k (48k Holdout Test Set)")

# 2. 90k Raw Dataset
df_90k = pd.read_csv("data/raw/supplier_delivery_data_90000.csv")
res_90k = evaluate_supplier_data(df_90k, "90k Raw Historical Delivery Data")

# 3. 150k Raw Dataset (Test portion: last 20%)
df_150k = pd.read_csv("data/raw/supplier_delivery_data_150000_synthetic.csv")
df_150k["Order_Date"] = pd.to_datetime(df_150k["Order_Date"])
df_150k = df_150k.sort_values("Order_Date").reset_index(drop=True)
test_150k = df_150k.iloc[int(len(df_150k)*0.8):].copy().reset_index(drop=True)
res_150k = evaluate_supplier_data(test_150k, "150k Synthetic Delivery (30k Holdout)")

df_supp_eval = pd.DataFrame([res_holdout, res_90k, res_150k])
print(df_supp_eval.to_string(index=False))

print("\n3. Evaluating Alternative Supplier Datasets...")

def evaluate_alt_data(df, label, test_slice=None):
    df_eval = df.copy()
    df_eval["Unit_Cost_Delta"] = df_eval["Unit_Cost"] - df_eval["Current_Unit_Cost"]
    df_eval["Cost_Ratio"] = df_eval["Unit_Cost"] / np.maximum(df_eval["Current_Unit_Cost"], 1.0)
    df_eval["Quantity_Sufficiency"] = df_eval["Available_Quantity"] / np.maximum(df_eval["Required_Quantity"], 1.0)
    df_eval["Reliability_Index"] = (0.7 * df_eval["Supplier_On_Time_Rate"]) + (0.3 * df_eval["Supplier_Rating"] * 20.0)
    df_eval["Target"] = (df_eval["Alternative_Recommended"] == "Yes").astype(int)
    
    feature_cols = [
        "Required_Quantity", "Current_Unit_Cost", "Available_Quantity", "Unit_Cost",
        "Shipping_Cost", "Packaging_Cost", "Supplier_Delay_Rate", "Supplier_On_Time_Rate",
        "Lead_Time_Days", "Supplier_Rating", "Unit_Cost_Delta", "Cost_Ratio",
        "Quantity_Sufficiency", "Reliability_Index", "Quality_Approved",
        "Shipping_Method", "Supplier_Region"
    ]
    
    if test_slice is not None:
        df_eval = df_eval.iloc[test_slice].copy()
    
    X = df_eval[feature_cols].copy()
    y = df_eval["Target"].copy()
    
    preds = alt_model.predict(X)
    probs = alt_model.predict_proba(X)[:, 1]
    
    acc = accuracy_score(y, preds)
    roc = roc_auc_score(y, probs)
    prec = precision_score(y, preds)
    rec = recall_score(y, preds)
    f1 = f1_score(y, preds)
    cm = confusion_matrix(y, preds)
    
    return {
        "Dataset": label,
        "Total_Rows": len(df_eval),
        "Accuracy_%": round(acc * 100, 2),
        "ROC_AUC": round(roc, 4),
        "Precision_%": round(prec * 100, 2),
        "Recall_%": round(rec * 100, 2),
        "F1_Score": round(f1, 4),
        "True_Neg": cm[0, 0], "False_Pos": cm[0, 1],
        "False_Neg": cm[1, 0], "True_Pos": cm[1, 1]
    }

# 1. 40k Catalog Holdout (8,000 holdout records)
df_alt_40k = pd.read_csv("data/raw/alternative_supplier_data_40000.csv")
res_alt_40k = evaluate_alt_data(df_alt_40k, "40k Alternative Catalog (8,000 Holdout Test)", range(32000, 40000))

# 2. 150k Synthetic Holdout (30,000 holdout records)
df_alt_150k = pd.read_csv("data/raw/alternative_supplier_data_150000_synthetic.csv")
res_alt_150k = evaluate_alt_data(df_alt_150k, "150k Synthetic Candidates (30,000 Holdout)", range(120000, 150000))

df_alt_eval = pd.DataFrame([res_alt_40k, res_alt_150k])
print(df_alt_eval.to_string(index=False))

df_supp_eval.to_csv("data/processed/full_accuracy_report_suppliers.csv", index=False)
df_alt_eval.to_csv("data/processed/full_accuracy_report_alternatives.csv", index=False)
print("\nAccuracy reports saved successfully!")

