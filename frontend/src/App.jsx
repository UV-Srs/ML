import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  FileText, 
  UploadCloud, 
  ShieldCheck, 
  ShieldAlert, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Download, 
  ChevronRight, 
  Building2, 
  CheckCircle2, 
  Activity
} from 'lucide-react';

export default function App() {
  const [activeNav, setActiveNav] = useState('single');

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
  const [selectedBulkRow, setSelectedBulkRow] = useState(null);

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
      if (data.rows && data.rows.length > 0) {
        const topRow = data.rows.find(r => r.Delivery_Risk === 'High' || (r.loss_analysis && r.loss_analysis.Stockout_Risk) || r.Has_Alternative) || data.rows[0];
        setSelectedBulkRow(topRow);
      }
    } catch (err) {
      setBulkError(err.message);
    } finally {
      setBulkLoading(false);
    }
  };

  const downloadSampleCsv = () => {
    const csvContent = 
`Purchase_Order_ID,Supplier_ID,Item_ID,Order_Date,Promised_Date,Quantity_Ordered,Unit_Cost,Shipping_Cost,Distance_KM,Shipping_Method,Supplier_History_Delivery_Rate,Order_Lead_Time_Days
PO-2001,SUP-001,ENG01,${todayStr},${defaultPromisedStr},600,4500,2800,450,Road,91.2,10
PO-2002,SUP-002,BRK01,${todayStr},${defaultPromisedStr},350,1850,1500,320,Rail,68.4,8
PO-2003,SUP-003,GEAR01,${todayStr},${defaultPromisedStr},150,12000,4200,780,Sea,88.0,15
PO-2004,SUP-004,ECU01,${todayStr},${defaultPromisedStr},900,650,1100,210,Air,95.5,5
PO-2005,SUP-005,SUSP01,${todayStr},${defaultPromisedStr},450,4700,3100,560,Road,54.2,12`;

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'purchase_orders_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportAuditedCsv = () => {
    if (!bulkResult || !bulkResult.rows || bulkResult.rows.length === 0) return;

    const headers = [
      'Purchase_Order_ID',
      'Supplier_ID',
      'Item_ID',
      'Quantity_Ordered',
      'Predicted_Delay_Days',
      'Delay_Probability_Pct',
      'Delivery_Risk',
      'Best_Alternative_Supplier',
      'Alternative_Match_Score',
      'Alternative_Lead_Time',
      'Alternative_Feasibility'
    ];

    const rows = bulkResult.rows.map(r => [
      r.Purchase_Order_ID || '',
      r.Supplier_ID || '',
      r.Item_ID || '',
      r.Quantity_Ordered || 0,
      r.Predicted_Delay_Days || 0,
      r.Delay_Probability || 0,
      r.Delivery_Risk || '',
      `"${r.Best_Alternative_Supplier || 'None'}"`,
      r.Alternative_Match_Score || '-',
      r.Alternative_Lead_Time || '-',
      `"${r.Alternative_Feasibility || 'On Track'}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'audited_orders_with_alternatives.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹ 0';
    return `₹ ${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

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
                  {/* BATCH HIGH RISK WARNING BANNER */}
                  {(bulkResult.summary.high_risk_count > 0 || bulkResult.summary.delayed_count > 0) && (
                    <div className="banner-alert banner-alert-danger" style={{ marginBottom: '20px' }}>
                      <ShieldAlert size={22} style={{ flexShrink: 0 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '4px' }}>
                          Critical Supply Chain Disruption Warning: Buffer Exhaustion Detected Across Batch
                        </div>
                        <div>
                          <strong>{bulkResult.summary.high_risk_count} High-Risk Orders</strong> identified ({bulkResult.summary.stockout_risk_count || 0} orders cause physical warehouse stockout). 
                          Cumulative factory exposure: <strong>{bulkResult.summary.total_downtime_hours || 0} hours</strong> of assembly shutdown and <strong>{formatCurrency(bulkResult.summary.total_financial_loss)}</strong> in total production loss across your facility. Click any order row below to inspect individual plant impact and alternative vendors.
                        </div>
                      </div>
                    </div>
                  )}

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
                      <div className="kpi-title">Assembly Line Downtime</div>
                      <div className="kpi-value" style={{ color: bulkResult.summary.total_downtime_hours > 0 ? 'var(--danger-badge)' : 'var(--text-primary)' }}>
                        {bulkResult.summary.total_downtime_hours || 0} hrs
                      </div>
                      <div className="kpi-subtitle">
                        {bulkResult.summary.stockout_risk_count || 0} parts causing stockout
                      </div>
                    </div>

                    <div className="kpi-card">
                      <div className="kpi-title">Total Projected Line Loss</div>
                      <div className="kpi-value" style={{ color: bulkResult.summary.total_financial_loss > 0 ? 'var(--danger-badge)' : 'var(--text-primary)' }}>
                        {formatCurrency(bulkResult.summary.total_financial_loss)}
                      </div>
                      <div className="kpi-subtitle">Cumulative facility financial exposure</div>
                    </div>
                  </div>

                  <div className="card">
                    <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div className="card-title">Audited Purchase Orders Breakdown</div>
                        <div className="card-subtitle">Showing predicted delays, risk tiers, and recommended substitute suppliers for at-risk orders. Click any row to inspect deep disruption diagnostics.</div>
                      </div>
                      <button type="button" onClick={exportAuditedCsv} className="btn-secondary" style={{ padding: '6px 12px', fontSize: '13px' }}>
                        <Download size={14} />
                        Export Audited CSV
                      </button>
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
                              <th>Risk Tier</th>
                              <th>Alternative Supplier Recommendation</th>
                              <th>Action</th>
                            </tr>
                          </thead>
                          <tbody>
                            {bulkResult.rows.map((row, idx) => {
                              const isSelected = selectedBulkRow?.Purchase_Order_ID === row.Purchase_Order_ID;
                              return (
                                <tr 
                                  key={idx} 
                                  onClick={() => setSelectedBulkRow(row)} 
                                  style={{ cursor: 'pointer', backgroundColor: isSelected ? '#eff6ff' : 'transparent', transition: 'background-color 0.15s ease' }}
                                >
                                  <td style={{ fontWeight: 600 }}>{row.Purchase_Order_ID || `PO-${idx + 1}`}</td>
                                  <td>{row.Supplier_ID}</td>
                                  <td>{row.Item_ID}</td>
                                  <td>{Number(row.Quantity_Ordered).toLocaleString()}</td>
                                  <td>
                                    <span style={{ fontWeight: 600, color: row.Predicted_Delay_Days > 0.5 ? 'var(--danger-badge)' : 'var(--success-badge)' }}>
                                      {row.Predicted_Delay_Days > 0 ? `+${Number(row.Predicted_Delay_Days).toFixed(1)} d` : '0.0 d'}
                                    </span>
                                  </td>
                                  <td>
                                    <span className={`badge ${row.Delivery_Risk === 'High' ? 'badge-danger' : (row.Delivery_Risk === 'Medium' ? 'badge-warning' : 'badge-success')}`}>
                                      {row.Delivery_Risk} Risk
                                    </span>
                                  </td>
                                  <td>
                                    {row.Has_Alternative ? (
                                      <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <strong style={{ color: 'var(--text-primary)' }}>{row.Best_Alternative_Supplier}</strong>
                                          <span className="badge badge-blue" style={{ fontSize: '10px', padding: '1px 5px' }}>{row.Alternative_Match_Score}</span>
                                        </div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                          Lead: {row.Alternative_Lead_Time} • <span style={{ color: row.Alternative_Feasibility === 'Prevents Shutdown' ? 'var(--success-text)' : 'var(--warning-text)', fontWeight: 600 }}>{row.Alternative_Feasibility}</span>
                                        </div>
                                      </div>
                                    ) : (
                                      <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                                        {row.Predicted_Delay_Days > 0.5 ? 'No Alt Registered' : 'On Track (None Needed)'}
                                      </span>
                                    )}
                                  </td>
                                  <td>
                                    <button 
                                      type="button" 
                                      className="btn-secondary" 
                                      style={{ padding: '3px 8px', fontSize: '11px', whiteSpace: 'nowrap', backgroundColor: isSelected ? 'var(--blue-primary)' : '', color: isSelected ? '#ffffff' : '' }}
                                      onClick={(e) => { e.stopPropagation(); setSelectedBulkRow(row); }}
                                    >
                                      {isSelected ? 'Viewing' : 'Inspect'}
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>

                  {/* DEEP ASSESSMENT DETAILS FOR SELECTED BATCH PO (IDENTICAL TO SINGLE PO ASSESSMENT) */}
                  {selectedBulkRow && selectedBulkRow.loss_analysis && (
                    <div style={{ marginTop: '28px', borderTop: '2px dashed var(--border-color)', paddingTop: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertTriangle size={18} style={{ color: selectedBulkRow.loss_analysis.Stockout_Risk ? 'var(--danger-badge)' : 'var(--blue-primary)' }} />
                            <span>Detailed Production Disruption Assessment:</span>
                            <span style={{ color: 'var(--blue-primary)' }}>{selectedBulkRow.Purchase_Order_ID}</span>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>({selectedBulkRow.Item_ID} from {selectedBulkRow.Supplier_ID})</span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Physical warehouse inventory simulation and financial impact analysis for selected order.
                          </div>
                        </div>

                        <span className={`badge ${selectedBulkRow.Delivery_Risk === 'High' ? 'badge-danger' : (selectedBulkRow.Delivery_Risk === 'Medium' ? 'badge-warning' : 'badge-success')}`} style={{ fontSize: '12px', padding: '4px 10px' }}>
                          {selectedBulkRow.Delivery_Risk} Risk • {selectedBulkRow.Delay_Probability}% Prob
                        </span>
                      </div>

                      {/* Specific PO Warning Alert */}
                      {selectedBulkRow.loss_analysis.Stockout_Risk ? (
                        <div className="banner-alert banner-alert-danger" style={{ marginBottom: '20px' }}>
                          <ShieldAlert size={20} />
                          <div>
                            <strong>Supply Chain Disruption Detected:</strong> Warehouse buffer will be fully exhausted on <strong>{selectedBulkRow.loss_analysis.Stockout_Date}</strong>. 
                            The shipment arrives <strong>{selectedBulkRow.loss_analysis.Production_Downtime_Days} days late</strong> after stockout, triggering <strong>{selectedBulkRow.loss_analysis.Production_Downtime_Hours} hours ({selectedBulkRow.loss_analysis.Lost_Shifts_8h} shifts)</strong> of line shutdown and <strong>{selectedBulkRow.loss_analysis.Buffer_Deficit_Units} units</strong> of unmet assembly demand.
                          </div>
                        </div>
                      ) : (
                        <div className="banner-alert banner-alert-success" style={{ marginBottom: '20px' }}>
                          <CheckCircle2 size={20} />
                          <div>
                            <strong>Production Protected:</strong> Current warehouse inventory ({selectedBulkRow.loss_analysis.Stock_Coverage_Days} days runway) safely covers production until delivery arrives on <strong>{selectedBulkRow.loss_analysis.Predicted_Arrival_Date}</strong>. No assembly shutdown or idle overhead is incurred.
                          </div>
                        </div>
                      )}

                      {/* 4 PO KPI Cards */}
                      <div className="kpi-grid">
                        <div className="kpi-card">
                          <div className="kpi-card-top">
                            <span className="kpi-title">Delivery Delay</span>
                            <div className="kpi-icon-pill" style={{ backgroundColor: selectedBulkRow.Predicted_Delay_Days > 0.5 ? 'var(--danger-bg)' : 'var(--success-bg)', color: selectedBulkRow.Predicted_Delay_Days > 0.5 ? 'var(--danger-text)' : 'var(--success-text)' }}>
                              <Clock size={16} />
                            </div>
                          </div>
                          <div className="kpi-value" style={{ color: selectedBulkRow.Predicted_Delay_Days > 0.5 ? 'var(--danger-badge)' : 'var(--success-badge)' }}>
                            {selectedBulkRow.Predicted_Delay_Days > 0 ? `+${Number(selectedBulkRow.Predicted_Delay_Days).toFixed(1)} Days` : '0.0 Days'}
                          </div>
                          <div className="kpi-subtitle">
                            Expected Arrival: <strong>{selectedBulkRow.loss_analysis.Predicted_Arrival_Date || 'On Schedule'}</strong>
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
                            <span className={`badge ${selectedBulkRow.Delivery_Risk === 'High' ? 'badge-danger' : (selectedBulkRow.Delivery_Risk === 'Medium' ? 'badge-warning' : 'badge-success')}`}>
                              {selectedBulkRow.Delivery_Risk} Risk
                            </span>
                          </div>
                          <div className="kpi-subtitle">
                            Delay Probability: <strong>{Number(selectedBulkRow.Delay_Probability).toFixed(1)}%</strong>
                          </div>
                        </div>

                        <div className="kpi-card">
                          <div className="kpi-card-top">
                            <span className="kpi-title">Buffer Status</span>
                            <div className="kpi-icon-pill" style={{ backgroundColor: selectedBulkRow.loss_analysis.Stockout_Risk ? 'var(--danger-bg)' : 'var(--success-bg)', color: selectedBulkRow.loss_analysis.Stockout_Risk ? 'var(--danger-text)' : 'var(--success-text)' }}>
                              <Activity size={16} />
                            </div>
                          </div>
                          <div className="kpi-value" style={{ color: selectedBulkRow.loss_analysis.Stockout_Risk ? 'var(--danger-badge)' : 'var(--success-badge)' }}>
                            {selectedBulkRow.loss_analysis.Stockout_Risk ? 'Stockout Risk' : 'Buffer Secure'}
                          </div>
                          <div className="kpi-subtitle">
                            {selectedBulkRow.loss_analysis.Stockout_Risk 
                              ? `Depletion on ${selectedBulkRow.loss_analysis.Stockout_Date}` 
                              : `${selectedBulkRow.loss_analysis.Stock_Coverage_Days} days buffer runway`}
                          </div>
                        </div>

                        <div className="kpi-card">
                          <div className="kpi-card-top">
                            <span className="kpi-title">Projected Line Loss</span>
                            <div className="kpi-icon-pill" style={{ backgroundColor: 'var(--blue-light)', color: 'var(--blue-primary)' }}>
                              <DollarSign size={16} />
                            </div>
                          </div>
                          <div className="kpi-value" style={{ color: selectedBulkRow.loss_analysis.Total_Production_Loss > 0 ? 'var(--danger-badge)' : 'var(--text-primary)' }}>
                            {formatCurrency(selectedBulkRow.loss_analysis.Total_Production_Loss)}
                          </div>
                          <div className="kpi-subtitle">
                            {selectedBulkRow.loss_analysis.Production_Downtime_Hours > 0 
                              ? `${selectedBulkRow.loss_analysis.Production_Downtime_Hours} hrs assembly line idle` 
                              : 'Zero production shutdown'}
                          </div>
                        </div>
                      </div>

                      {/* Operational & Financial Tables for Selected PO */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                        <div className="card" style={{ marginBottom: 0 }}>
                          <div className="card-header">
                            <div className="card-title">Production Line Impact ({selectedBulkRow.Purchase_Order_ID})</div>
                          </div>
                          <div className="card-body" style={{ padding: 0 }}>
                            <table className="custom-table">
                              <tbody>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Available Buffer Coverage</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{selectedBulkRow.loss_analysis.Stock_Coverage_Days} Days</td>
                                </tr>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Transit Timeline to Arrival</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{selectedBulkRow.loss_analysis.Days_Until_Delivery} Days</td>
                                </tr>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Assembly Line Downtime</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: selectedBulkRow.loss_analysis.Production_Downtime_Days > 0 ? 'var(--danger-badge)' : 'var(--text-primary)' }}>
                                    {selectedBulkRow.loss_analysis.Production_Downtime_Days} Days ({selectedBulkRow.loss_analysis.Production_Downtime_Hours} hrs)
                                  </td>
                                </tr>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Lost 8-Hour Operational Shifts</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{selectedBulkRow.loss_analysis.Lost_Shifts_8h} Shifts</td>
                                </tr>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Unmet Component Demand</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{selectedBulkRow.loss_analysis.Lost_Production_Units} Units</td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div className="card" style={{ marginBottom: 0 }}>
                          <div className="card-header">
                            <div className="card-title">Financial Exposure Breakdown ({selectedBulkRow.Purchase_Order_ID})</div>
                          </div>
                          <div className="card-body" style={{ padding: 0 }}>
                            <table className="custom-table">
                              <tbody>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Daily Line Output Value</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(selectedBulkRow.loss_analysis.Daily_Production_Loss)} / day</td>
                                </tr>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Direct Component Shortfall Loss</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(selectedBulkRow.loss_analysis.Direct_Product_Loss)}</td>
                                </tr>
                                <tr>
                                  <td style={{ color: 'var(--text-secondary)' }}>Fixed Idling Line Overhead</td>
                                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(selectedBulkRow.loss_analysis.Fixed_Overhead_Loss)}</td>
                                </tr>
                                <tr style={{ backgroundColor: '#fcfcfd' }}>
                                  <td style={{ fontWeight: 700, color: 'var(--text-primary)', paddingTop: '16px' }}>Total Projected Financial Loss</td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '15px', color: selectedBulkRow.loss_analysis.Total_Production_Loss > 0 ? 'var(--danger-badge)' : 'var(--success-badge)', paddingTop: '16px' }}>
                                    {formatCurrency(selectedBulkRow.loss_analysis.Total_Production_Loss)}
                                  </td>
                                </tr>
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Verified Alternative Supplier Recommendations for Selected PO */}
                      <div className="card">
                        <div className="card-header">
                          <div>
                            <div className="card-title">Verified Alternative Supplier Recommendations for {selectedBulkRow.Purchase_Order_ID}</div>
                            <div className="card-subtitle">Substitute suppliers ranked by Multi-Criteria Decision Analysis (MCDA) for part {selectedBulkRow.Item_ID}.</div>
                          </div>
                        </div>

                        <div className="card-body" style={{ padding: 0 }}>
                          {selectedBulkRow.alternatives && selectedBulkRow.alternatives.length > 0 ? (
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
                                  {selectedBulkRow.alternatives.map((alt, idx) => (
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
                              No alternative suppliers needed: delivery creates no stockout threat, or no secondary vendor is registered for part code <strong>{selectedBulkRow.Item_ID}</strong>.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
