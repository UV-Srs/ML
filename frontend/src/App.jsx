import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  FileText, 
  UploadCloud, 
  BarChart3, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Download, 
  ChevronRight, 
  Building2, 
  CheckCircle2, 
  Activity,
  Image as ImageIcon,
  Maximize2,
  X,
  Sliders,
  TrendingUp,
  Cpu,
  GitCompare,
  Database,
  Award,
  Zap
} from 'lucide-react';

const STATIC_REPORTS = [
  {
    id: "tolerance",
    title: "Tolerance Accuracy Curve (±1 to ±5 Days)",
    category: "Regression Analysis",
    filename: "04_tolerance_accuracy_curve.png",
    description: "Evaluates exact delivery error bounds: 54.56% of predictions arrive within ±1 day, 80.75% within ±2 days, and 90.20% within ±3 days of actual arrival."
  },
  {
    id: "actual_vs_pred",
    title: "Actual vs. Predicted Delay Days",
    category: "Regression Analysis",
    filename: "01_actual_vs_predicted_regression.png",
    description: "Scatter plot and 2D density contours across 48,000 chronological holdout test orders (MAE = 1.2912 Days, R² = 53.77% variance explained)."
  },
  {
    id: "residuals",
    title: "Residuals & Heteroscedasticity Analysis",
    category: "Regression Analysis",
    filename: "02_residuals_analysis.png",
    description: "Residual error distribution confirming zero-centered symmetry, low variance drift, and well-behaved error bounds across lead times."
  },
  {
    id: "qq_plot",
    title: "Q-Q Normal Probability Plot",
    category: "Regression Analysis",
    filename: "03_qq_plot_residuals.png",
    description: "Quantile-Quantile plot comparing empirical model residuals against standard theoretical normal quantiles."
  },
  {
    id: "roc_curve",
    title: "ROC-AUC Discrimination Curve",
    category: "Classification & Risk",
    filename: "06_roc_curve.png",
    description: "Receiver Operating Characteristic curve achieving 0.9301 ROC-AUC score on strict chronological out-of-time test data."
  },
  {
    id: "precision_recall",
    title: "Precision-Recall Curve (Threshold Calibrated)",
    category: "Classification & Risk",
    filename: "07_precision_recall_curve.png",
    description: "Precision-Recall curve demonstrating 85.28% precision and 73.06% delay recall at calibrated operational threshold (t = 0.38)."
  },
  {
    id: "confusion_matrix",
    title: "Calibrated Confusion Matrix",
    category: "Classification & Risk",
    filename: "05_confusion_matrix.png",
    description: "48,000-order holdout confusion matrix showing 10,318 delayed shipments successfully caught with minimal false positives."
  },
  {
    id: "probability_dist",
    title: "Probability Distribution Separation",
    category: "Classification & Risk",
    filename: "08_probability_distribution_separation.png",
    description: "Kernel density estimation showing distinct separation between on-time deliveries (<20% probability) and at-risk shipments (>70%)."
  },
  {
    id: "calibration_curve",
    title: "Reliability & Calibration Curve",
    category: "Classification & Risk",
    filename: "09_calibration_curve.png",
    description: "Empirical vs. predicted probability reliability diagram verifying that predicted probabilities reflect true real-world delay rates."
  },
  {
    id: "feature_importance",
    title: "Top-20 Feature Importances (Both Models)",
    category: "Feature Analysis",
    filename: "feature_importance_both_models.png",
    description: "Side-by-side feature attribution comparison for the Delivery Delay Regressor and Delivery Risk Classifier."
  },
  {
    id: "feature_fatigue",
    title: "Feature Fatigue & Cumulative Variance Curves",
    category: "Feature Analysis",
    filename: "feature_fatigue_curves_both_models.png",
    description: "Cumulative explanatory power curves demonstrating that the top 15 engineered features explain >85% of total predictive variance."
  },
  {
    id: "scaling_curves",
    title: "Incremental Data Scaling Curves",
    category: "Data Scaling",
    filename: "11_incremental_data_scaling_curves.png",
    description: "Model accuracy progression across incremental dataset sizes (10k -> 30k -> 50k -> 75k -> 100k -> 240k total records)."
  },
  {
    id: "correlation_heatmap",
    title: "Engineered Feature Correlation Heatmap",
    category: "Data Scaling",
    filename: "10_feature_correlation_heatmap.png",
    description: "Pearson correlation matrix across temporal dynamics, route transit velocities, and volume stress interaction ratios."
  }
];

export default function App() {
  const [activeNav, setActiveNav] = useState('single');
  const [modelSubTab, setModelSubTab] = useState('benchmarks');
  const [threshold, setThreshold] = useState(0.38);
  const [reportFilter, setReportFilter] = useState('All');
  const [selectedImage, setSelectedImage] = useState(null);

  const [meta, setMeta] = useState({
    suppliers: [],
    items: [],
    plants: [],
    total_records: 0
  });

  const todayStr = new Date().toISOString().split('T')[0];
  const defaultPromised = new Date();
  defaultPromised.setDate(defaultPromised.getDate() + 10);
  const defaultPromisedStr = defaultPromised.toISOString().split('T')[0];

  // Single PO Form State
  const [form, setForm] = useState({
    purchase_order_id: 'PO-88104',
    supplier_id: 'SUP-001',
    item_id: 'ENG01',
    quantity: 500,
    order_date: todayStr,
    promised_date: defaultPromisedStr,
    available_stock: 120,
    daily_production: 50,
    unit_cost: 4500,
    daily_fixed_overhead: 45000
  });

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Bulk Audit State
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkError, setBulkError] = useState(null);

  useEffect(() => {
    fetch('/api/meta')
      .then(res => {
        if (!res.ok) throw new Error('Failed to load metadata');
        return res.json();
      })
      .then(data => {
        setMeta(data);
        if (data.suppliers && data.suppliers.length > 0) {
          setForm(prev => ({
            ...prev,
            supplier_id: data.suppliers[0],
            item_id: data.items && data.items.length > 0 ? data.items[0].id : prev.item_id
          }));
        }
      })
      .catch(err => {
        console.warn('Metadata load note:', err.message);
      });
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setForm(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : Number(value)) : value
    }));
  };

  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch('/api/predict/single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Prediction failed');
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkUpload = async (e) => {
    e.preventDefault();
    if (!bulkFile) {
      setBulkError('Please select a CSV file first.');
      return;
    }

    setBulkLoading(true);
    setBulkError(null);
    setBulkResult(null);

    const formData = new FormData();
    formData.append('file', bulkFile);

    try {
      const res = await fetch('/api/predict/bulk', {
        method: 'POST',
        body: formData
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'Bulk processing failed');
      }
      setBulkResult(data);
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = 
`Purchase_Order_ID,Supplier_ID,Item_ID,Order_Date,Promised_Date,Quantity_Ordered,Unit_Cost,Shipping_Cost,Distance_KM,Supplier_History_Delivery_Rate,Order_Lead_Time_Days
PO-2001,SUP-001,ENG01,${todayStr},${defaultPromisedStr},600,4500,2800,450,91.2,10
PO-2002,SUP-002,BRK02,${todayStr},${defaultPromisedStr},350,1850,1500,320,68.4,10
PO-2003,SUP-003,TRN03,${todayStr},${defaultPromisedStr},150,12000,4200,780,88.0,10
PO-2004,SUP-004,ELE04,${todayStr},${defaultPromisedStr},900,650,1100,210,95.5,10
PO-2005,SUP-005,ENG01,${todayStr},${defaultPromisedStr},450,4700,3100,560,54.2,10`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'purchase_orders_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹ 0';
    return `₹ ${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const filteredReports = reportFilter === 'All' 
    ? STATIC_REPORTS 
    : STATIC_REPORTS.filter(r => r.category.toLowerCase().includes(reportFilter.toLowerCase()));

  return (
    <div className="dashboard-layout">
      {/* LEFT SIDEBAR */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand-icon">
            <Truck size={20} />
          </div>
          <div>
            <div className="sidebar-brand-title">SupplyChain Monitor</div>
            <div className="sidebar-brand-subtitle">Delivery & Downtime Risk</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="nav-section-title">Operations</div>
          <button 
            type="button"
            className={`nav-item ${activeNav === 'single' ? 'active' : ''}`}
            onClick={() => setActiveNav('single')}
          >
            <FileText size={16} className="nav-icon" />
            <span>Single PO Assessment</span>
          </button>

          <button 
            type="button"
            className={`nav-item ${activeNav === 'bulk' ? 'active' : ''}`}
            onClick={() => setActiveNav('bulk')}
          >
            <UploadCloud size={16} className="nav-icon" />
            <span>Batch CSV Audit</span>
          </button>

          <div className="nav-section-title" style={{ marginTop: '16px' }}>Diagnostics & Reports</div>
          <button 
            type="button"
            className={`nav-item ${activeNav === 'models' ? 'active' : ''}`}
            onClick={() => setActiveNav('models')}
          >
            <BarChart3 size={16} className="nav-icon" />
            <span>Model Performance</span>
          </button>

          <button 
            type="button"
            className={`nav-item ${activeNav === 'reports' ? 'active' : ''}`}
            onClick={() => setActiveNav('reports')}
          >
            <ImageIcon size={16} className="nav-icon" />
            <span>Diagnostic Reports</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="system-status-box">
            <span className="status-dot-pulse"></span>
            <div>
              <div className="status-text-title">XGBoost v14 Online</div>
              <div className="status-text-sub">93.0% ROC-AUC • Calibrated</div>
            </div>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="main-wrapper">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-breadcrumbs">
            <span>Plant Operations</span>
            <span>/</span>
            <span className="header-title-bold">
              {activeNav === 'single' && 'Purchase Order Delivery Risk Assessment'}
              {activeNav === 'bulk' && 'Batch Purchase Order Risk Audit'}
              {activeNav === 'models' && 'Model Performance & Benchmark Scorecards'}
              {activeNav === 'reports' && 'Machine Learning Diagnostic Reports & Figures'}
            </span>
          </div>

          <div className="header-right-meta">
            <div className="facility-badge">
              <Building2 size={14} />
              <span>Assembly Line 01 • Dynamic Buffer</span>
            </div>
          </div>
        </header>

        {/* Content Body */}
        <main className="content-body">
          {/* TAB 1: SINGLE PURCHASE ORDER */}
          {activeNav === 'single' && (
            <div>
              {/* Form Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon-container">
                      <Clock size={18} />
                    </div>
                    <div>
                      <div className="card-title">Order Details & Plant Buffer Conditions</div>
                      <div className="card-subtitle">Enter purchase order parameters to forecast delivery delay, stock exhaustion, and line downtime.</div>
                    </div>
                  </div>
                </div>

                <div className="card-body">
                  <form onSubmit={handleSingleSubmit}>
                    <div className="form-columns">
                      {/* Left: PO Details */}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          1. Purchase Order Specifications
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>PO Identifier</span>
                            <span className="form-hint">Internal Reference</span>
                          </label>
                          <input 
                            type="text" 
                            name="purchase_order_id" 
                            value={form.purchase_order_id} 
                            onChange={handleInputChange} 
                            className="form-input" 
                            required 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Primary Supplier</span>
                            <span className="form-hint">Contracted Vendor</span>
                          </label>
                          <select 
                            name="supplier_id" 
                            value={form.supplier_id} 
                            onChange={handleInputChange} 
                            className="form-select"
                          >
                            {meta.suppliers && meta.suppliers.length > 0 ? (
                              meta.suppliers.map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))
                            ) : (
                              ['SUP-001', 'SUP-002', 'SUP-003', 'SUP-004', 'SUP-005', 'SUP-006'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))
                            )}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Component Part ID</span>
                            <span className="form-hint">Item Catalog</span>
                          </label>
                          <select 
                            name="item_id" 
                            value={form.item_id} 
                            onChange={handleInputChange} 
                            className="form-select"
                          >
                            {meta.items && meta.items.length > 0 ? (
                              meta.items.map(item => (
                                <option key={item.id} value={item.id}>{item.label || `${item.id} - ${item.name}`}</option>
                              ))
                            ) : (
                              [
                                { id: 'ENG01', name: 'Engine Block' },
                                { id: 'BRK02', name: 'Brake Caliper' },
                                { id: 'TRN03', name: 'Transmission Unit' },
                                { id: 'ELE04', name: 'Wiring Harness' }
                              ].map(item => (
                                <option key={item.id} value={item.id}>{item.id} - {item.name}</option>
                              ))
                            )}
                          </select>
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Order Quantity</span>
                            <span className="form-hint">Units</span>
                          </label>
                          <input 
                            type="number" 
                            name="quantity" 
                            value={form.quantity} 
                            onChange={handleInputChange} 
                            min="1" 
                            className="form-input" 
                            required 
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                          <div className="form-group">
                            <label className="form-label">Order Date</label>
                            <input 
                              type="date" 
                              name="order_date" 
                              value={form.order_date} 
                              onChange={handleInputChange} 
                              className="form-input" 
                              required 
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Promised Date</label>
                            <input 
                              type="date" 
                              name="promised_date" 
                              value={form.promised_date} 
                              onChange={handleInputChange} 
                              className="form-input" 
                              required 
                            />
                          </div>
                        </div>
                      </div>

                      {/* Right: Plant Conditions */}
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '14px', borderBottom: '1px solid var(--border-light)', paddingBottom: '6px' }}>
                          2. Factory Inventory & Financial Baseline
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Available Buffer Stock</span>
                            <span className="form-hint">Warehouse Units on Hand</span>
                          </label>
                          <input 
                            type="number" 
                            name="available_stock" 
                            value={form.available_stock} 
                            onChange={handleInputChange} 
                            min="0" 
                            className="form-input" 
                            required 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Daily Production Burn Rate</span>
                            <span className="form-hint">Units Consumed / Day</span>
                          </label>
                          <input 
                            type="number" 
                            name="daily_production" 
                            value={form.daily_production} 
                            onChange={handleInputChange} 
                            min="1" 
                            className="form-input" 
                            required 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Component Unit Cost</span>
                            <span className="form-hint">₹ / Unit</span>
                          </label>
                          <input 
                            type="number" 
                            name="unit_cost" 
                            value={form.unit_cost} 
                            onChange={handleInputChange} 
                            min="1" 
                            className="form-input" 
                            required 
                          />
                        </div>

                        <div className="form-group">
                          <label className="form-label">
                            <span>Daily Idle Line Overhead</span>
                            <span className="form-hint">₹ / Day Facility Loss</span>
                          </label>
                          <input 
                            type="number" 
                            name="daily_fixed_overhead" 
                            value={form.daily_fixed_overhead} 
                            onChange={handleInputChange} 
                            min="0" 
                            className="form-input" 
                            required 
                          />
                        </div>

                        <div style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '12px 14px', marginTop: '10px' }}>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Warehouse Stock Runway</div>
                          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
                            {form.daily_production > 0 ? (form.available_stock / form.daily_production).toFixed(1) : 0} Days of Operations Covered
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Single Action Button */}
                    <div className="form-footer">
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Inference executes delay regression, risk classification, and physical inventory stockout timeline simulation.
                      </div>
                      <button type="submit" className="btn-primary" disabled={loading}>
                        {loading && <span className="loading-spinner"></span>}
                        {loading ? 'Evaluating Risk...' : 'Run Risk Assessment'}
                        {!loading && <ChevronRight size={16} />}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {error && (
                <div className="banner-alert banner-alert-danger">
                  <AlertTriangle size={18} />
                  <div><strong>Error:</strong> {error}</div>
                </div>
              )}

              {/* RESULTS PRESENTATION */}
              {result && (
                <div>
                  {/* KPI Bar */}
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-card-top">
                        <span className="kpi-title">Delivery Delay</span>
                        <div className="kpi-icon-pill" style={{ backgroundColor: result.prediction.predicted_delay_days > 0.5 ? 'var(--danger-bg)' : 'var(--success-bg)', color: result.prediction.predicted_delay_days > 0.5 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                          <Clock size={16} />
                        </div>
                      </div>
                      <div className="kpi-value" style={{ color: result.prediction.predicted_delay_days > 0.5 ? 'var(--danger-badge)' : 'var(--success-badge)' }}>
                        {result.prediction.predicted_delay_days > 0 ? `+${result.prediction.predicted_delay_days.toFixed(1)} Days` : '0.0 Days'}
                      </div>
                      <div className="kpi-subtitle">
                        Expected Arrival: <strong>{result.loss_analysis.Predicted_Arrival_Date || 'On Schedule'}</strong>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-card-top">
                        <span className="kpi-title">Risk Status</span>
                        <div className="kpi-icon-pill" style={{ backgroundColor: 'var(--blue-light)', color: 'var(--blue-primary)' }}>
                          <ShieldCheck size={16} />
                        </div>
                      </div>
                      <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                        {result.prediction.risk_tier === 'High' && (
                          <span className="badge badge-danger">High Delay Risk</span>
                        )}
                        {result.prediction.risk_tier === 'Medium' && (
                          <span className="badge badge-warning">Medium Delay Risk</span>
                        )}
                        {result.prediction.risk_tier === 'Low' && (
                          <span className="badge badge-success">On Schedule</span>
                        )}
                      </div>
                      <div className="kpi-subtitle">
                        Delay Probability: <strong>{result.prediction.delay_probability.toFixed(1)}%</strong>
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-card-top">
                        <span className="kpi-title">Buffer Status</span>
                        <div className="kpi-icon-pill" style={{ backgroundColor: result.loss_analysis.Stockout_Risk ? 'var(--danger-bg)' : 'var(--success-bg)', color: result.loss_analysis.Stockout_Risk ? 'var(--danger-text)' : 'var(--success-text)' }}>
                          <Activity size={16} />
                        </div>
                      </div>
                      <div className="kpi-value" style={{ color: result.loss_analysis.Stockout_Risk ? 'var(--danger-badge)' : 'var(--success-badge)' }}>
                        {result.loss_analysis.Stockout_Risk ? 'Stockout Risk' : 'Buffer Secure'}
                      </div>
                      <div className="kpi-subtitle">
                        {result.loss_analysis.Stockout_Risk 
                          ? `Depletion on ${result.loss_analysis.Stockout_Date}` 
                          : `${result.loss_analysis.Stock_Coverage_Days} days of buffer protection`}
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-card-top">
                        <span className="kpi-title">Projected Line Loss</span>
                        <div className="kpi-icon-pill" style={{ backgroundColor: 'var(--blue-light)', color: 'var(--blue-primary)' }}>
                          <DollarSign size={16} />
                        </div>
                      </div>
                      <div className="kpi-value" style={{ color: result.loss_analysis.Total_Production_Loss > 0 ? 'var(--danger-badge)' : 'var(--text-primary)' }}>
                        {formatCurrency(result.loss_analysis.Total_Production_Loss)}
                      </div>
                      <div className="kpi-subtitle">
                        {result.loss_analysis.Production_Downtime_Hours > 0 
                          ? `${result.loss_analysis.Production_Downtime_Hours} hrs assembly line idle` 
                          : 'Zero production shutdown'}
                      </div>
                    </div>
                  </div>

                  {/* Impact Alert */}
                  {result.loss_analysis.Stockout_Risk ? (
                    <div className="banner-alert banner-alert-danger">
                      <ShieldAlert size={20} />
                      <div>
                        <strong>Supply Chain Disruption Detected:</strong> Warehouse buffer will be fully exhausted on <strong>{result.loss_analysis.Stockout_Date}</strong>. 
                        The shipment arrives <strong>{result.loss_analysis.Production_Downtime_Days} days late</strong> after stockout, triggering <strong>{result.loss_analysis.Production_Downtime_Hours} hours ({result.loss_analysis.Lost_Shifts_8h} shifts)</strong> of line shutdown and <strong>{result.loss_analysis.Buffer_Deficit_Units} units</strong> of unmet assembly.
                      </div>
                    </div>
                  ) : (
                    <div className="banner-alert banner-alert-success">
                      <CheckCircle2 size={20} />
                      <div>
                        <strong>Production Protected:</strong> Current warehouse inventory ({result.loss_analysis.Stock_Coverage_Days} days runway) safely covers production until delivery arrives on <strong>{result.loss_analysis.Predicted_Arrival_Date}</strong>. No assembly shutdown or idle overhead is incurred.
                      </div>
                    </div>
                  )}

                  {/* Operational & Financial Details */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">Production Line Impact</div>
                      </div>
                      <div className="card-body" style={{ padding: 0 }}>
                        <table className="custom-table">
                          <tbody>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Available Buffer Coverage</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{result.loss_analysis.Stock_Coverage_Days} Days</td>
                            </tr>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Transit Timeline to Arrival</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{result.loss_analysis.Days_Until_Delivery} Days</td>
                            </tr>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Assembly Line Downtime</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: result.loss_analysis.Production_Downtime_Days > 0 ? 'var(--danger-badge)' : 'var(--text-primary)' }}>
                                {result.loss_analysis.Production_Downtime_Days} Days ({result.loss_analysis.Production_Downtime_Hours} hrs)
                              </td>
                            </tr>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Lost 8-Hour Operational Shifts</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{result.loss_analysis.Lost_Shifts_8h} Shifts</td>
                            </tr>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Unmet Component Demand</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{result.loss_analysis.Lost_Production_Units} Units</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="card" style={{ marginBottom: 0 }}>
                      <div className="card-header">
                        <div className="card-title">Financial Exposure Breakdown</div>
                      </div>
                      <div className="card-body" style={{ padding: 0 }}>
                        <table className="custom-table">
                          <tbody>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Daily Line Output Value</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(result.loss_analysis.Daily_Production_Loss)} / day</td>
                            </tr>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Direct Component Shortfall Loss</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(result.loss_analysis.Direct_Product_Loss)}</td>
                            </tr>
                            <tr>
                              <td style={{ color: 'var(--text-secondary)' }}>Fixed Idling Line Overhead</td>
                              <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(result.loss_analysis.Fixed_Overhead_Loss)}</td>
                            </tr>
                            <tr style={{ backgroundColor: '#fcfcfd' }}>
                              <td style={{ fontWeight: 700, color: 'var(--text-primary)', paddingTop: '16px' }}>Total Projected Financial Loss</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', color: result.loss_analysis.Total_Production_Loss > 0 ? 'var(--danger-badge)' : 'var(--success-badge)', paddingTop: '16px' }}>
                                {formatCurrency(result.loss_analysis.Total_Production_Loss)}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* Alternative Suppliers Table */}
                  <div className="card">
                    <div className="card-header">
                      <div>
                        <div className="card-title">Verified Alternative Supplier Recommendations</div>
                        <div className="card-subtitle">Substitute suppliers ranked by Multi-Criteria Decision Analysis (MCDA) incorporating lead time, stockout prevention, on-time reliability, and net savings.</div>
                      </div>
                    </div>

                    <div className="card-body" style={{ padding: 0 }}>
                      {result.alternatives && result.alternatives.length > 0 ? (
                        <div className="table-container">
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Rank</th>
                                <th>Candidate Vendor</th>
                                <th>MCDA Score</th>
                                <th>Lead Time</th>
                                <th>Available Stock</th>
                                <th>Unit Price</th>
                                <th>Downtime Prevented</th>
                                <th>Net Cost Savings</th>
                                <th>Operational Feasibility</th>
                              </tr>
                            </thead>
                            <tbody>
                              {result.alternatives.map((alt, idx) => (
                                <tr key={alt.Raw_Supplier_ID || idx}>
                                  <td style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>#{idx + 1}</td>
                                  <td>
                                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{alt['Supplier ID']}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Rating: {alt['Supplier Rating']}</div>
                                  </td>
                                  <td>
                                    <span className="badge badge-blue" style={{ fontWeight: 700 }}>
                                      {alt['Match Score']}
                                    </span>
                                  </td>
                                  <td>{alt['Lead Time']}</td>
                                  <td>{alt['Available Quantity']} Units</td>
                                  <td>₹ {Number(alt.Raw_Unit_Cost).toLocaleString('en-IN')}</td>
                                  <td>
                                    <span style={{ fontWeight: 600, color: alt.Downtime_Prevented_Days > 0 ? 'var(--success-badge)' : 'var(--text-muted)' }}>
                                      {alt.Downtime_Prevented_Days > 0 ? `+${alt.Downtime_Prevented_Days} Days` : '0 d'}
                                    </span>
                                  </td>
                                  <td style={{ fontWeight: 700, color: alt.Net_Benefit_INR > 0 ? 'var(--success-text)' : 'var(--text-secondary)' }}>
                                    {formatCurrency(alt.Net_Benefit_INR)}
                                  </td>
                                  <td>
                                    <span className={`badge ${alt.Arrives_Before_Stockout ? 'badge-success' : (alt.Downtime_Prevented_Days > 0 ? 'badge-warning' : 'badge-danger')}`}>
                                      {alt.Arrives_Before_Stockout ? 'Prevents Shutdown' : (alt.Downtime_Prevented_Days > 0 ? 'Shortens Downtime' : 'No Lead Benefit')}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                          No alternative suppliers needed: the order delivery creates no stockout threat, or no secondary vendor is registered for part code <strong>{form.item_id}</strong>.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BATCH CSV AUDIT */}
          {activeNav === 'bulk' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon-container">
                      <UploadCloud size={18} />
                    </div>
                    <div>
                      <div className="card-title">Batch Purchase Order Audit</div>
                      <div className="card-subtitle">Upload a CSV file containing multiple purchase orders to audit delivery risks and delay probabilities simultaneously.</div>
                    </div>
                  </div>

                  <button type="button" onClick={downloadSampleCsv} className="btn-secondary">
                    <Download size={14} />
                    Download Sample CSV Template
                  </button>
                </div>

                <div className="card-body">
                  <form onSubmit={handleBulkUpload}>
                    <label className="file-dropzone" style={{ display: 'block' }}>
                      <input 
                        type="file" 
                        accept=".csv" 
                        style={{ display: 'none' }} 
                        onChange={(e) => setBulkFile(e.target.files[0])}
                      />
                      <UploadCloud size={32} style={{ color: 'var(--blue-primary)', marginBottom: '10px' }} />
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                        {bulkFile ? bulkFile.name : 'Click to browse or drop purchase order CSV file here'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Required columns: Supplier_ID, Item_ID, Order_Date, Promised_Date, Quantity_Ordered
                      </div>
                    </label>

                    <div className="form-footer" style={{ marginTop: 0 }}>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Executes simultaneous XGBoost delay regression and risk classification across all rows.
                      </div>
                      <button type="submit" className="btn-primary" disabled={bulkLoading || !bulkFile}>
                        {bulkLoading && <span className="loading-spinner"></span>}
                        {bulkLoading ? 'Processing Batch...' : 'Audit Batch Orders'}
                        {!bulkLoading && <ChevronRight size={16} />}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {bulkError && (
                <div className="banner-alert banner-alert-danger">
                  <AlertTriangle size={18} />
                  <div><strong>Audit Error:</strong> {bulkError}</div>
                </div>
              )}

              {bulkResult && (
                <div>
                  <div className="kpi-grid">
                    <div className="kpi-card">
                      <div className="kpi-title">Total Orders Audited</div>
                      <div className="kpi-value">{bulkResult.summary.total_orders.toLocaleString()}</div>
                      <div className="kpi-subtitle">Complete batch volume</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-title">Delayed Orders</div>
                      <div className="kpi-value" style={{ color: 'var(--danger-badge)' }}>
                        {bulkResult.summary.delayed_count.toLocaleString()}
                      </div>
                      <div className="kpi-subtitle">
                        <strong>{bulkResult.summary.delayed_pct}%</strong> delayed rate
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-title">High-Risk Orders</div>
                      <div className="kpi-value" style={{ color: 'var(--warning-badge)' }}>
                        {bulkResult.summary.high_risk_count.toLocaleString()}
                      </div>
                      <div className="kpi-subtitle">Priority supplier intervention</div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-title">Average Delay</div>
                      <div className="kpi-value">
                        {bulkResult.summary.average_delay_days.toFixed(1)} Days
                      </div>
                      <div className="kpi-subtitle">Mean delay across batch</div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Audited Orders Breakdown (First 100 Rows)</div>
                    </div>
                    <div className="card-body" style={{ padding: 0 }}>
                      <div className="table-container">
                        <table className="custom-table">
                          <thead>
                            <tr>
                              <th>PO Reference</th>
                              <th>Supplier</th>
                              <th>Part Item</th>
                              <th>Quantity</th>
                              <th>Predicted Delay</th>
                              <th>Delay Probability</th>
                              <th>Risk Tier</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkResult.rows.map((row, idx) => (
                              <tr key={idx}>
                                <td style={{ fontWeight: 600 }}>{row.Purchase_Order_ID || `PO-${idx + 1}`}</td>
                                <td>{row.Supplier_ID}</td>
                                <td>{row.Item_ID}</td>
                                <td>{Number(row.Quantity_Ordered).toLocaleString()}</td>
                                <td>
                                  <span style={{ fontWeight: 600, color: row.Predicted_Delay_Days > 0.5 ? 'var(--danger-badge)' : 'var(--success-badge)' }}>
                                    {row.Predicted_Delay_Days > 0 ? `+${Number(row.Predicted_Delay_Days).toFixed(1)} d` : '0.0 d'}
                                  </span>
                                </td>
                                <td>{Number(row.Delay_Probability).toFixed(1)}%</td>
                                <td>
                                  <span className={`badge ${row.Delivery_Risk === 'High' ? 'badge-danger' : (row.Delivery_Risk === 'Medium' ? 'badge-warning' : 'badge-success')}`}>
                                    {row.Delivery_Risk} Risk
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: MODEL PERFORMANCE & METRICS */}
          {activeNav === 'models' && (
            <div>
              {/* Top High-Impact KPI Row */}
              <div className="kpi-grid">
                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span className="kpi-title">Classifier Accuracy</span>
                    <span className="delta-pill-pos">+12.6% vs Base</span>
                  </div>
                  <div className="kpi-value" style={{ color: 'var(--blue-primary)' }}>88.36%</div>
                  <div className="kpi-subtitle">Calibrated at threshold t = 0.38</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span className="kpi-title">ROC-AUC Score</span>
                    <span className="delta-pill-pos">+0.1310 Gain</span>
                  </div>
                  <div className="kpi-value" style={{ color: 'var(--success-badge)' }}>0.9301</div>
                  <div className="kpi-subtitle">High discriminatory power</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span className="kpi-title">Regressor MAE</span>
                    <span className="delta-pill-neg">-24.1% Error</span>
                  </div>
                  <div className="kpi-value">1.2912 d</div>
                  <div className="kpi-subtitle">Mean absolute delay error</div>
                </div>

                <div className="kpi-card">
                  <div className="kpi-card-top">
                    <span className="kpi-title">R² Variance Captured</span>
                    <span className="delta-pill-pos">+29.3% Jump</span>
                  </div>
                  <div className="kpi-value" style={{ color: 'var(--success-badge)' }}>53.77%</div>
                  <div className="kpi-subtitle">54% of delay variance explained</div>
                </div>
              </div>

              {/* Master Performance Card */}
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon-container">
                      <BarChart3 size={18} />
                    </div>
                    <div>
                      <div className="card-title">Production Model Verification & Diagnostic Center</div>
                      <div className="card-subtitle">Verified on 240,000 automotive transactions with chronological 80/20 train/test holdout.</div>
                    </div>
                  </div>

                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={() => setActiveNav('reports')}
                  >
                    <ImageIcon size={15} />
                    View All 13 Diagnostic Figures
                  </button>
                </div>

                <div className="card-body">
                  {/* Model Architecture Specs Chips */}
                  <div className="spec-chips-container">
                    <div className="spec-chip">
                      <Cpu size={14} style={{ color: 'var(--blue-primary)' }} />
                      <span>Architecture: <strong>XGBoost v14</strong></span>
                    </div>
                    <div className="spec-chip">
                      <Zap size={14} style={{ color: 'var(--warning-badge)' }} />
                      <span>Hyperparameters: <strong>500 Estimators • Depth 14 • lr 0.05</strong></span>
                    </div>
                    <div className="spec-chip">
                      <Database size={14} style={{ color: 'var(--success-badge)' }} />
                      <span>Training Corpus: <strong>240,000 Delivery POs + 150,000 Alt Suppliers</strong></span>
                    </div>
                    <div className="spec-chip">
                      <Award size={14} style={{ color: 'var(--blue-primary)' }} />
                      <span>Evaluation Protocol: <strong>Chronological 80/20 Holdout (No Leakage)</strong></span>
                    </div>
                  </div>

                  {/* Sub-tabs Navigation */}
                  <div className="model-tabs-bar">
                    <button 
                      type="button" 
                      className={`model-tab-btn ${modelSubTab === 'benchmarks' ? 'active' : ''}`}
                      onClick={() => setModelSubTab('benchmarks')}
                    >
                      <GitCompare size={15} />
                      Production Benchmarks vs Baseline
                    </button>
                    <button 
                      type="button" 
                      className={`model-tab-btn ${modelSubTab === 'scaling' ? 'active' : ''}`}
                      onClick={() => setModelSubTab('scaling')}
                    >
                      <TrendingUp size={15} />
                      Data Scaling Progression (10k → 240k)
                    </button>
                    <button 
                      type="button" 
                      className={`model-tab-btn ${modelSubTab === 'features' ? 'active' : ''}`}
                      onClick={() => setModelSubTab('features')}
                    >
                      <Layers size={15} />
                      Top Feature Drivers & Fatigue
                    </button>
                    <button 
                      type="button" 
                      className={`model-tab-btn ${modelSubTab === 'simulator' ? 'active' : ''}`}
                      onClick={() => setModelSubTab('simulator')}
                    >
                      <Sliders size={15} />
                      Decision Threshold Simulator
                    </button>
                  </div>

                  {/* SUBTAB 1: BENCHMARKS */}
                  {modelSubTab === 'benchmarks' && (
                    <div>
                      {/* Side-by-side Baseline vs Production Comparison Table */}
                      <div style={{ marginBottom: '24px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                          Side-by-Side Model Performance Progression
                        </div>
                        <div className="table-container" style={{ border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Evaluation Metric</th>
                                <th>Baseline Model</th>
                                <th>Previous Iteration</th>
                                <th>Current Production (v14)</th>
                                <th>Net Improvement vs Baseline</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Classifier Overall Accuracy</td>
                                <td>75.77%</td>
                                <td>82.10%</td>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>88.36%</td>
                                <td><span className="delta-pill-pos">+12.59% Gain</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Classifier ROC-AUC Score</td>
                                <td>0.7991</td>
                                <td>0.8585</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>0.9301</td>
                                <td><span className="delta-pill-pos">+0.1310 (High Discrimination)</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Delayed Class Recall (Sensitivity)</td>
                                <td>31.48%</td>
                                <td>57.06%</td>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>73.06%</td>
                                <td><span className="delta-pill-pos">+41.58% (Catches 10,318 delays)</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Delayed Class Precision</td>
                                <td>80.30%</td>
                                <td>76.11%</td>
                                <td style={{ fontWeight: 700 }}>85.28%</td>
                                <td><span className="delta-pill-pos">+4.98% High Precision</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Classifier F1-Score</td>
                                <td>0.7100</td>
                                <td>0.6522</td>
                                <td style={{ fontWeight: 700 }}>0.7870</td>
                                <td><span className="delta-pill-pos">+0.0770 Balanced Metric</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Regressor Mean Absolute Error (MAE)</td>
                                <td>1.70 Days</td>
                                <td>1.57 Days</td>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>1.2912 Days</td>
                                <td><span className="delta-pill-neg">-0.41d Error Reduction (-24.1%)</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Regressor Root Mean Squared Error (RMSE)</td>
                                <td>2.33 Days</td>
                                <td>2.17 Days</td>
                                <td style={{ fontWeight: 700 }}>1.8217 Days</td>
                                <td><span className="delta-pill-neg">-0.51d Error Reduction</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>R² Variance Explained</td>
                                <td>24.51%</td>
                                <td>34.57%</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>53.77%</td>
                                <td><span className="delta-pill-pos">+29.26% Jump (&gt;50% Captured)</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Tolerance (within ±1 Day)</td>
                                <td>42.34%</td>
                                <td>45.35%</td>
                                <td style={{ fontWeight: 700 }}>54.56%</td>
                                <td><span className="delta-pill-pos">+12.22% Boost</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Tolerance (within ±2 Days)</td>
                                <td>71.22%</td>
                                <td>74.16%</td>
                                <td style={{ fontWeight: 700 }}>80.75%</td>
                                <td><span className="delta-pill-pos">+9.53% (4 out of 5 orders)</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Tolerance (within ±3 Days)</td>
                                <td>84.89%</td>
                                <td>86.33%</td>
                                <td style={{ fontWeight: 700 }}>90.20%</td>
                                <td><span className="delta-pill-pos">+5.31% (9 out of 10 orders)</span></td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>Alternative Supplier Classification</td>
                                <td>79.40%</td>
                                <td>92.15%</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>99.96%</td>
                                <td><span className="delta-pill-pos">+20.56% Calibrated MCDA</span></td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Regressor & Classifier Detail Grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: '6px', padding: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                            Delivery Delay Regressor (`XGBRegressor`)
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Predicts fractional shipment delay in days beyond promised delivery date using 500 gradient-boosted decision trees.
                          </p>
                          <table className="custom-table">
                            <tbody>
                              <tr>
                                <td>MAE</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--blue-primary)' }}>1.2912 Days</td>
                              </tr>
                              <tr>
                                <td>RMSE</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>1.8217 Days</td>
                              </tr>
                              <tr>
                                <td>R² Score</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-badge)' }}>53.77%</td>
                              </tr>
                              <tr>
                                <td>Range-Normalized Accuracy</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>88.26%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        <div style={{ border: '1px solid var(--border-light)', borderRadius: '6px', padding: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '10px' }}>
                            Delivery Risk Classifier (`XGBClassifier`)
                          </div>
                          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                            Estimates calibrated probability of shipment delay and assigns operational risk tiers (Low / Medium / High).
                          </p>
                          <table className="custom-table">
                            <tbody>
                              <tr>
                                <td>Overall Accuracy</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--blue-primary)' }}>88.36%</td>
                              </tr>
                              <tr>
                                <td>ROC-AUC</td>
                                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success-badge)' }}>0.9301</td>
                              </tr>
                              <tr>
                                <td>Delayed Precision / Recall</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>85.28% / 73.06%</td>
                              </tr>
                              <tr>
                                <td>Calibrated F1 Score</td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>0.7870</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: DATA SCALING PROGRESSION */}
                  {modelSubTab === 'scaling' && (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Incremental Training Data Scaling Empirical Progression
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Performance readings measured across chronological data scaling studies (10k → 30k → 60k → 100k → Full 240k Supplier records).
                      </p>

                      {/* Regression Scaling Table */}
                      <div style={{ marginBottom: '22px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                          1. Supplier Delivery Delay Regressor Scaling
                        </div>
                        <div className="table-container" style={{ border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Data Partition</th>
                                <th>Training Size</th>
                                <th>Training Time (s)</th>
                                <th>MAE (Days)</th>
                                <th>RMSE (Days)</th>
                                <th>R² Variance (%)</th>
                                <th>Within ±1 Day</th>
                                <th>Within ±2 Days</th>
                                <th>Within ±3 Days</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ fontWeight: 600 }}>10k Batch</td>
                                <td>10,000</td>
                                <td>11.8s</td>
                                <td>1.8718 d</td>
                                <td>2.5476 d</td>
                                <td>9.57%</td>
                                <td>39.68%</td>
                                <td>66.34%</td>
                                <td>81.32%</td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>30k Batch</td>
                                <td>30,000</td>
                                <td>50.4s</td>
                                <td>1.7964 d</td>
                                <td>2.4427 d</td>
                                <td>16.87%</td>
                                <td>40.48%</td>
                                <td>67.54%</td>
                                <td>82.78%</td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>60k Batch</td>
                                <td>60,000</td>
                                <td>38.0s</td>
                                <td>1.7129 d</td>
                                <td>2.3346 d</td>
                                <td>24.07%</td>
                                <td>42.50%</td>
                                <td>70.43%</td>
                                <td>84.18%</td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>100k Batch</td>
                                <td>100,000</td>
                                <td>55.9s</td>
                                <td>1.5816 d</td>
                                <td>2.1817 d</td>
                                <td>33.69%</td>
                                <td>45.86%</td>
                                <td>73.62%</td>
                                <td>85.99%</td>
                              </tr>
                              <tr style={{ backgroundColor: 'var(--blue-light)' }}>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>Full Corpus (240k)</td>
                                <td style={{ fontWeight: 700 }}>192,000 Train</td>
                                <td>65.9s</td>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>1.2912 d</td>
                                <td style={{ fontWeight: 700 }}>1.8217 d</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>53.77%</td>
                                <td style={{ fontWeight: 700 }}>54.56%</td>
                                <td style={{ fontWeight: 700 }}>80.75%</td>
                                <td style={{ fontWeight: 700 }}>90.20%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Classifier Scaling Table */}
                      <div style={{ marginBottom: '22px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                          2. Supplier Delivery Risk Classifier Scaling
                        </div>
                        <div className="table-container" style={{ border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Data Partition</th>
                                <th>Training Size</th>
                                <th>Training Time (s)</th>
                                <th>Accuracy (%)</th>
                                <th>ROC-AUC Score</th>
                                <th>Precision (%)</th>
                                <th>Recall (%)</th>
                                <th>F1 Score</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td style={{ fontWeight: 600 }}>10k Batch</td>
                                <td>10,000</td>
                                <td>5.8s</td>
                                <td>69.69%</td>
                                <td>0.6767</td>
                                <td>47.86%</td>
                                <td>33.81%</td>
                                <td>0.3963</td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>30k Batch</td>
                                <td>30,000</td>
                                <td>19.6s</td>
                                <td>72.10%</td>
                                <td>0.7240</td>
                                <td>53.17%</td>
                                <td>43.28%</td>
                                <td>0.4772</td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>60k Batch</td>
                                <td>60,000</td>
                                <td>24.1s</td>
                                <td>75.74%</td>
                                <td>0.7769</td>
                                <td>60.74%</td>
                                <td>49.60%</td>
                                <td>0.5461</td>
                              </tr>
                              <tr>
                                <td style={{ fontWeight: 600 }}>100k Batch</td>
                                <td>100,000</td>
                                <td>27.0s</td>
                                <td>80.16%</td>
                                <td>0.8357</td>
                                <td>68.92%</td>
                                <td>59.34%</td>
                                <td>0.6377</td>
                              </tr>
                              <tr style={{ backgroundColor: 'var(--blue-light)' }}>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>Full Corpus (240k)</td>
                                <td style={{ fontWeight: 700 }}>192,000 Train</td>
                                <td>42.4s</td>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>88.36%</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>0.9301</td>
                                <td style={{ fontWeight: 700 }}>85.28%</td>
                                <td style={{ fontWeight: 700 }}>73.06%</td>
                                <td style={{ fontWeight: 700 }}>0.7870</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Alternative Supplier Scaling Table */}
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px' }}>
                          3. Alternative Supplier (150,000 Synthetic Records) Scaling
                        </div>
                        <div className="table-container" style={{ border: '1px solid var(--border-light)', borderRadius: '6px' }}>
                          <table className="custom-table">
                            <thead>
                              <tr>
                                <th>Training Subset</th>
                                <th>Training Rows</th>
                                <th>Fit Time (s)</th>
                                <th>Overall Accuracy</th>
                                <th>ROC-AUC Score</th>
                                <th>Precision (%)</th>
                                <th>Recall (%)</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td>10k Subset</td>
                                <td>10,000</td>
                                <td>0.51s</td>
                                <td>97.16%</td>
                                <td>0.9208</td>
                                <td>72.76%</td>
                                <td>34.44%</td>
                              </tr>
                              <tr>
                                <td>30k Subset</td>
                                <td>30,000</td>
                                <td>0.86s</td>
                                <td>97.43%</td>
                                <td>0.9473</td>
                                <td>77.02%</td>
                                <td>41.34%</td>
                              </tr>
                              <tr>
                                <td>50k Subset</td>
                                <td>50,000</td>
                                <td>1.21s</td>
                                <td>97.57%</td>
                                <td>0.9599</td>
                                <td>77.22%</td>
                                <td>46.50%</td>
                              </tr>
                              <tr>
                                <td>75k Subset</td>
                                <td>75,000</td>
                                <td>1.75s</td>
                                <td>97.63%</td>
                                <td>0.9716</td>
                                <td>78.16%</td>
                                <td>47.79%</td>
                              </tr>
                              <tr>
                                <td>100k Subset</td>
                                <td>100,000</td>
                                <td>2.08s</td>
                                <td>97.77%</td>
                                <td>0.9767</td>
                                <td>79.60%</td>
                                <td>51.75%</td>
                              </tr>
                              <tr style={{ backgroundColor: 'var(--blue-light)' }}>
                                <td style={{ fontWeight: 700, color: 'var(--blue-primary)' }}>Full Database (150k)</td>
                                <td style={{ fontWeight: 700 }}>120,000 Train</td>
                                <td>2.44s</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>99.96%</td>
                                <td style={{ fontWeight: 700, color: 'var(--success-badge)' }}>1.0000</td>
                                <td style={{ fontWeight: 700 }}>99.93%</td>
                                <td style={{ fontWeight: 700 }}>99.86%</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 3: FEATURE DRIVERS & FATIGUE */}
                  {modelSubTab === 'features' && (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Key Feature Importances & Predictive Variance Drivers
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                        Attribution weights derived from 500 gradient-boosted trees. Non-linear interactions between transit velocity, lead time deficit, and supplier track record dominate.
                      </p>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '22px' }}>
                        {/* Regressor Drivers */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: '6px', padding: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                            Top Delay Regressor Features
                          </div>
                          <div className="feat-list">
                            {[
                              { name: 'Transit Velocity (Distance / Lead Time)', pct: 18.4 },
                              { name: 'Supplier Historical Delivery Rate', pct: 16.2 },
                              { name: 'Lead Time Deficit (Promised vs Standard)', pct: 14.1 },
                              { name: 'Volume Stress (Quantity / Lead Time)', pct: 12.8 },
                              { name: 'Shipping Method & Mode Priority', pct: 10.5 },
                              { name: 'Cost Per KM & Distance Band', pct: 9.2 },
                              { name: 'Item Category & Maintenance Tier', pct: 7.6 },
                              { name: 'Weather Impact Flag & Seasonality', pct: 6.2 },
                              { name: 'Order Value & Cost Per Unit', pct: 5.0 }
                            ].map((f, i) => (
                              <div key={i} className="feat-row">
                                <span className="feat-name" title={f.name}>{f.name}</span>
                                <div className="feat-track">
                                  <div className="feat-fill" style={{ width: `${(f.pct / 18.4) * 100}%` }}></div>
                                </div>
                                <span className="feat-pct">{f.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Classifier Drivers */}
                        <div style={{ border: '1px solid var(--border-light)', borderRadius: '6px', padding: '16px' }}>
                          <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
                            Top Risk Classifier Features
                          </div>
                          <div className="feat-list">
                            {[
                              { name: 'Supplier Historical Delivery Rate', pct: 24.6 },
                              { name: 'Shipping Method (Sea vs Rail vs Air)', pct: 18.2 },
                              { name: 'Route Key (Supplier Region to Plant)', pct: 15.3 },
                              { name: 'Volume Stress & Order Quantity', pct: 13.7 },
                              { name: 'Component Category Hardware/Engine', pct: 11.4 },
                              { name: 'Mode Priority Multimodal Critical', pct: 9.5 },
                              { name: 'Lead Time Deficit Ratio', pct: 7.3 }
                            ].map((f, i) => (
                              <div key={i} className="feat-row">
                                <span className="feat-name" title={f.name}>{f.name}</span>
                                <div className="feat-track">
                                  <div className="feat-fill" style={{ width: `${(f.pct / 24.6) * 100}%`, backgroundColor: 'var(--success-badge)' }}></div>
                                </div>
                                <span className="feat-pct">{f.pct}%</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Feature Fatigue Insight */}
                      <div style={{ backgroundColor: 'var(--bg-subtle)', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '14px 18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <strong>Feature Fatigue Analysis:</strong> The cumulative explanatory variance curves confirm that the top 15 features explain &gt;85% of total predictive power. Moving from tree depth 6 to depth 14 allowed the gradient booster to capture 3-way interactions (e.g., <code>Lead_Time_Deficit × Transit_Velocity × Supplier_Risk</code>), boosting $R^2$ from 24.51% to 53.77% without data leakage.
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 4: THRESHOLD SIMULATOR */}
                  {modelSubTab === 'simulator' && (
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                        Interactive Operational Decision Threshold Simulator
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                        Tune the classification decision cutoff threshold (t) to balance Precision (avoiding false alarms) against Recall (catching all potential delays).
                      </p>

                      {/* Simulator Controls Card */}
                      <div className="threshold-slider-box">
                        <div className="slider-header">
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>
                              Decision Cutoff Threshold: <span style={{ color: 'var(--blue-primary)', fontFamily: 'var(--font-mono)' }}>t = {threshold.toFixed(2)}</span>
                            </span>
                            <span style={{ marginLeft: '12px', fontSize: '11px', color: threshold === 0.38 ? 'var(--success-text)' : 'var(--text-muted)' }}>
                              {threshold === 0.38 ? '★ Recommended Calibrated Baseline' : (threshold < 0.38 ? 'Aggressive (High Recall)' : 'Conservative (High Precision)')}
                            </span>
                          </div>

                          <button 
                            type="button" 
                            className="btn-secondary"
                            onClick={() => setThreshold(0.38)}
                          >
                            Reset to Optimal (0.38)
                          </button>
                        </div>

                        <input 
                          type="range" 
                          min="0.10" 
                          max="0.80" 
                          step="0.02" 
                          value={threshold} 
                          onChange={(e) => setThreshold(parseFloat(e.target.value))} 
                          className="slider-input-range"
                        />

                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                          <span>0.10 (Catch 98% Delays, High False Alarms)</span>
                          <span>0.38 (Calibrated Production Optimum)</span>
                          <span>0.80 (Zero False Alarms, Misses Delays)</span>
                        </div>
                      </div>

                      {/* Live Calculated Metrics Grid */}
                      {(() => {
                        const recallVal = Math.min(99.2, Math.max(8.0, Number((100 / (1 + Math.exp(6.5 * (threshold - 0.38)))).toFixed(1))));
                        const precVal = Math.min(98.8, Math.max(25.0, Number((100 / (1 + Math.exp(-8.0 * (threshold - 0.38)))).toFixed(1))));
                        const f1Val = Number(((2 * precVal * recallVal) / (precVal + recallVal || 1) / 100).toFixed(4));
                        const delaysCaught = Math.round(14123 * (recallVal / 100));
                        const falseAlarms = Math.max(50, Math.round(delaysCaught / (precVal / 100 || 1) - delaysCaught));

                        return (
                          <div className="kpi-grid">
                            <div className="kpi-card">
                              <div className="kpi-title">Simulated Recall</div>
                              <div className="kpi-value" style={{ color: 'var(--blue-primary)' }}>{recallVal}%</div>
                              <div className="kpi-subtitle"><strong>{delaysCaught.toLocaleString()}</strong> of 14,123 delays caught</div>
                            </div>

                            <div className="kpi-card">
                              <div className="kpi-title">Simulated Precision</div>
                              <div className="kpi-value" style={{ color: 'var(--success-badge)' }}>{precVal}%</div>
                              <div className="kpi-subtitle">Accuracy of delay alerts</div>
                            </div>

                            <div className="kpi-card">
                              <div className="kpi-title">Simulated F1-Score</div>
                              <div className="kpi-value">{f1Val}</div>
                              <div className="kpi-subtitle">Harmonic balance of alert utility</div>
                            </div>

                            <div className="kpi-card">
                              <div className="kpi-title">Projected False Alarms</div>
                              <div className="kpi-value" style={{ color: falseAlarms > 3000 ? 'var(--warning-badge)' : 'var(--text-primary)' }}>
                                {falseAlarms.toLocaleString()}
                              </div>
                              <div className="kpi-subtitle">Unnecessary expedited shipments</div>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Operational Advice */}
                      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-light)', borderRadius: '6px', padding: '16px' }}>
                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                          Why t = 0.38 is the Production Standard:
                        </div>
                        <p style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                          In automotive assembly lines, the financial penalty of a stockout shutdown (₹45,000/day overhead + lost units) is <strong>6.5× more costly</strong> than expediting a false alarm. Standard 0.50 cutoff thresholds miss over 42% of actual delayed orders. Calibrating to <strong>t = 0.38</strong> maximizes plant survival by catching <strong>73.06% of all true delays</strong> while maintaining an <strong>85.28% precision</strong> rate.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* MCDA Decision Engine Weights Card */}
                  <div style={{ marginTop: '24px', borderTop: '1px solid var(--border-light)', paddingTop: '18px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '6px' }}>
                      Alternative Supplier Multi-Criteria Decision Analysis (MCDA) Weighting Logic
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginTop: '12px' }}>
                      <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: '6px', padding: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--blue-primary)' }}>35%</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Lead Time Feasibility</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Prevents shutdown before stockout</div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: '6px', padding: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success-badge)' }}>25%</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Net Financial Benefit</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Loss avoided vs extra freight cost</div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: '6px', padding: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>20%</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>On-Time Reliability</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Historical shipment compliance</div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: '6px', padding: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>10%</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Supplier Rating</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>Quality score (1-5 stars)</div>
                      </div>

                      <div style={{ backgroundColor: 'var(--bg-subtle)', borderRadius: '6px', padding: '12px', border: '1px solid var(--border-light)' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-secondary)' }}>10%</div>
                        <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>Quantity Coverage</div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>% of required batch fulfilled</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: DIAGNOSTIC REPORTS & FIGURES */}
          {activeNav === 'reports' && (
            <div>
              <div className="card">
                <div className="card-header">
                  <div className="card-header-left">
                    <div className="card-icon-container">
                      <ImageIcon size={18} />
                    </div>
                    <div>
                      <div className="card-title">Machine Learning Diagnostic Reports & Figures</div>
                      <div className="card-subtitle">Generated figures from <code>reports/figures</code> evaluating regression residuals, ROC curves, calibration, and feature fatigue.</div>
                    </div>
                  </div>
                </div>

                <div className="card-body">
                  {/* Filter Pills */}
                  <div className="filter-bar">
                    {['All', 'Regression', 'Classification', 'Feature', 'Scaling'].map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        className={`filter-pill ${reportFilter === cat ? 'active' : ''}`}
                        onClick={() => setReportFilter(cat)}
                      >
                        {cat === 'All' ? `All Reports (${STATIC_REPORTS.length})` : cat}
                      </button>
                    ))}
                  </div>

                  {/* Reports Grid */}
                  <div className="reports-grid">
                    {filteredReports.map((report) => (
                      <div key={report.id} className="report-card">
                        <div 
                          className="report-img-wrapper"
                          onClick={() => setSelectedImage(report)}
                          title="Click to expand"
                        >
                          <img 
                            src={`/figures/${report.filename}`} 
                            alt={report.title}
                            onError={(e) => {
                              // Fallback to backend API static mount if needed
                              e.currentTarget.src = `/api/reports/figures/${report.filename}`;
                            }}
                          />
                          <div className="report-img-overlay">
                            <Maximize2 size={12} />
                            <span>Enlarge</span>
                          </div>
                        </div>

                        <div className="report-card-body">
                          <span className="report-category-badge">{report.category}</span>
                          <h4 className="report-card-title">{report.title}</h4>
                          <p className="report-card-description">{report.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* LIGHTBOX MODAL */}
      {selectedImage && (
        <div className="modal-backdrop" onClick={() => setSelectedImage(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <span className="badge badge-blue" style={{ marginBottom: '4px' }}>{selectedImage.category}</span>
                <div className="modal-title">{selectedImage.title}</div>
              </div>
              <button 
                type="button" 
                className="modal-close-btn"
                onClick={() => setSelectedImage(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              <img 
                src={`/figures/${selectedImage.filename}`} 
                alt={selectedImage.title}
                onError={(e) => {
                  e.currentTarget.src = `/api/reports/figures/${selectedImage.filename}`;
                }}
              />
              <div className="modal-caption">
                {selectedImage.description}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
