import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  DollarSign, 
  FileText, 
  Layers, 
  Upload, 
  Download, 
  ShieldAlert, 
  ShieldCheck,
  ChevronRight,
  TrendingDown,
  Building2
} from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState('single');
  const [meta, setMeta] = useState({
    suppliers: [],
    items: [],
    plants: [],
    total_records: 0
  });

  // Calculate default dates
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

  // Fetch metadata on mount
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
        console.warn('Metadata fetch warning:', err.message);
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
    link.setAttribute('download', 'sample_po_audit_template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper formatting functions
  const formatCurrency = (val) => {
    if (val === undefined || val === null) return '₹ 0';
    return `₹ ${Number(val).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
  };

  const formatNumber = (val, dec = 1) => {
    if (val === undefined || val === null) return '0';
    return Number(val).toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="brand-section">
          <div className="brand-badge">
            <Layers size={20} />
          </div>
          <div>
            <h1 className="brand-title">Supply Chain Risk & Delivery Intelligence</h1>
            <p className="brand-subtitle">Proactive delay modeling, plant downtime prevention & alternative supplier allocation</p>
          </div>
        </div>

        <div className="header-status">
          <span className="status-dot"></span>
          <span>XGBoost v14 Active (Depth-14)</span>
        </div>
      </header>

      {/* Navigation Segmented Tab */}
      <div className="view-nav">
        <button 
          className={`nav-tab ${activeTab === 'single' ? 'active' : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <FileText size={15} />
          Single Purchase Order
        </button>
        <button 
          className={`nav-tab ${activeTab === 'bulk' ? 'active' : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Upload size={15} />
          Batch CSV Audit
        </button>
      </div>

      {/* TAB 1: SINGLE PURCHASE ORDER ASSESSMENT */}
      {activeTab === 'single' && (
        <div>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <Clock size={16} />
                Order Parameters & Factory Operating Conditions
              </span>
              <span className="form-label-hint">All calculations run in real-time</span>
            </div>

            <form onSubmit={handleSingleSubmit}>
              <div className="form-grid">
                {/* Column 1: Order Details */}
                <div className="form-fieldset">
                  <div className="fieldset-title">Purchase Order Details</div>
                  
                  <div className="form-group">
                    <label className="form-label">
                      Purchase Order ID
                      <span className="form-label-hint">PO Reference</span>
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
                      Primary Supplier
                      <span className="form-label-hint">Contracted Vendor</span>
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
                        ['SUP-001', 'SUP-002', 'SUP-003', 'SUP-004', 'SUP-005', 'SUP-006', 'SUP-007', 'SUP-008'].map(s => (
                          <option key={s} value={s}>{s}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Part / Component ID
                      <span className="form-label-hint">Manufacturing Item</span>
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
                          { id: 'ELE04', name: 'Wiring Harness' },
                          { id: 'SUS05', name: 'Suspension Strut' }
                        ].map(item => (
                          <option key={item.id} value={item.id}>{item.id} - {item.name}</option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Order Quantity
                      <span className="form-label-hint">Units</span>
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

                {/* Column 2: Inventory & Line Context */}
                <div className="form-fieldset">
                  <div className="fieldset-title">Plant Inventory & Financial Context</div>

                  <div className="form-group">
                    <label className="form-label">
                      Available Buffer Stock
                      <span className="form-label-hint">Units in Warehouse</span>
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
                      Daily Factory Burn Rate
                      <span className="form-label-hint">Units Consumed / Day</span>
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
                      Component Unit Cost
                      <span className="form-label-hint">₹ / Unit</span>
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
                      Daily Plant Fixed Overhead
                      <span className="form-label-hint">₹ / Idle Day Loss</span>
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

                  <div style={{ marginTop: '14px', padding: '12px 14px', backgroundColor: 'var(--bg-input)', borderRadius: '5px', border: '1px solid var(--border-subtle)' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Baseline Buffer Runway</div>
                    <div style={{ fontSize: '14px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--text-main)', marginTop: '2px' }}>
                      {form.daily_production > 0 ? (form.available_stock / form.daily_production).toFixed(1) : 0} Days of Production Covered
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Button */}
              <div className="form-actions">
                <div className="form-stats-hint">
                  Continuous multi-variable inference via combined XGBoost regressor & classifier
                </div>
                <button type="submit" className="btn-primary" disabled={loading}>
                  {loading && <span className="spinner"></span>}
                  {loading ? 'Evaluating Risk...' : 'Run Risk Assessment'}
                  {!loading && <ChevronRight size={16} />}
                </button>
              </div>
            </form>
          </div>

          {error && (
            <div className="alert-box alert-danger">
              <AlertTriangle size={18} />
              <div><strong>Error:</strong> {error}</div>
            </div>
          )}

          {/* RESULTS PRESENTATION */}
          {result && (
            <div>
              {/* Primary Metric Strip */}
              <div className="metrics-row">
                {/* 1. Delay Prediction */}
                <div className="metric-card">
                  <div className="metric-label">Predicted Delivery Delay</div>
                  <div className={`metric-value ${result.prediction.predicted_delay_days > 0.5 ? 'text-danger' : 'text-success'}`}>
                    {result.prediction.predicted_delay_days > 0 
                      ? `+${result.prediction.predicted_delay_days.toFixed(1)} d` 
                      : '0.0 d'}
                  </div>
                  <div className="metric-sub">
                    Expected Arrival: <strong style={{ color: 'var(--text-main)' }}>{result.loss_analysis.Predicted_Arrival_Date || 'N/A'}</strong>
                  </div>
                </div>

                {/* 2. Delay Risk Tier */}
                <div className="metric-card">
                  <div className="metric-label">Delivery Risk Status</div>
                  <div style={{ marginTop: '4px', marginBottom: '8px' }}>
                    {result.prediction.risk_tier === 'High' && (
                      <span className="badge badge-high"><AlertTriangle size={12} /> High Delay Risk</span>
                    )}
                    {result.prediction.risk_tier === 'Medium' && (
                      <span className="badge badge-medium"><Clock size={12} /> Medium Delay Risk</span>
                    )}
                    {result.prediction.risk_tier === 'Low' && (
                      <span className="badge badge-low"><ShieldCheck size={12} /> On Schedule</span>
                    )}
                  </div>
                  <div className="metric-sub">
                    Delay Probability: <strong style={{ color: 'var(--text-main)' }}>{result.prediction.delay_probability.toFixed(1)}%</strong>
                  </div>
                </div>

                {/* 3. Stockout & Downtime Status */}
                <div className="metric-card">
                  <div className="metric-label">Plant Inventory Buffer</div>
                  <div className={`metric-value ${result.loss_analysis.Stockout_Risk ? 'text-danger' : 'text-success'}`}>
                    {result.loss_analysis.Stockout_Risk ? 'Stockout Risk' : 'Buffer Secure'}
                  </div>
                  <div className="metric-sub">
                    {result.loss_analysis.Stockout_Risk 
                      ? `Exhaustion on ${result.loss_analysis.Stockout_Date}` 
                      : `${result.loss_analysis.Stock_Coverage_Days} days of buffer stock`}
                  </div>
                </div>

                {/* 4. Financial Impact */}
                <div className="metric-card">
                  <div className="metric-label">Total Projected Financial Loss</div>
                  <div className={`metric-value ${result.loss_analysis.Total_Production_Loss > 0 ? 'text-danger' : 'text-main'}`}>
                    {formatCurrency(result.loss_analysis.Total_Production_Loss)}
                  </div>
                  <div className="metric-sub">
                    {result.loss_analysis.Production_Downtime_Hours > 0 
                      ? `${result.loss_analysis.Production_Downtime_Hours}h production line downtime` 
                      : 'Zero factory downtime projected'}
                  </div>
                </div>
              </div>

              {/* Status Alert Banner */}
              {result.loss_analysis.Stockout_Risk ? (
                <div className="alert-box alert-danger">
                  <ShieldAlert size={20} />
                  <div>
                    <strong>Critical Supply Chain Alert:</strong> Inventory exhaustion is projected on <strong>{result.loss_analysis.Stockout_Date}</strong>. 
                    Delivery will arrive <strong>{result.loss_analysis.Production_Downtime_Days} days late</strong> after stock is depleted, causing an estimated <strong>{result.loss_analysis.Production_Downtime_Hours} hours ({result.loss_analysis.Lost_Shifts_8h} shifts)</strong> of plant shutdown and <strong>{result.loss_analysis.Buffer_Deficit_Units} units</strong> of unmet production.
                  </div>
                </div>
              ) : (
                <div className="alert-box alert-safe">
                  <CheckCircle2 size={20} />
                  <div>
                    <strong>Operations Protected:</strong> Existing buffer stock ({result.loss_analysis.Stock_Coverage_Days} days) is sufficient to bridge the transit timeline until delivery arrival on <strong>{result.loss_analysis.Predicted_Arrival_Date}</strong>. No production disruption or downtime is projected.
                  </div>
                </div>
              )}

              {/* Operational & Financial Breakdown */}
              <div className="detail-grid">
                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-header">
                    <span className="panel-title">Production Line Downtime Impact</span>
                  </div>
                  <table className="data-table-compact">
                    <tbody>
                      <tr>
                        <td>Available Buffer Coverage</td>
                        <td>{result.loss_analysis.Stock_Coverage_Days} Days</td>
                      </tr>
                      <tr>
                        <td>Transit Timeline to Arrival</td>
                        <td>{result.loss_analysis.Days_Until_Delivery} Days</td>
                      </tr>
                      <tr>
                        <td>Uncovered Line Downtime</td>
                        <td className={result.loss_analysis.Production_Downtime_Days > 0 ? 'text-danger' : ''}>
                          {result.loss_analysis.Production_Downtime_Days} Days ({result.loss_analysis.Production_Downtime_Hours} hrs)
                        </td>
                      </tr>
                      <tr>
                        <td>Lost Operational Shifts (8h)</td>
                        <td>{result.loss_analysis.Lost_Shifts_8h} Shifts</td>
                      </tr>
                      <tr>
                        <td>Unmet Assembly Output</td>
                        <td>{result.loss_analysis.Lost_Production_Units} Units</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="panel" style={{ marginBottom: 0 }}>
                  <div className="panel-header">
                    <span className="panel-title">Financial Exposure Breakdown</span>
                  </div>
                  <table className="data-table-compact">
                    <tbody>
                      <tr>
                        <td>Daily Production Value</td>
                        <td>{formatCurrency(result.loss_analysis.Daily_Production_Loss)} / day</td>
                      </tr>
                      <tr>
                        <td>Direct Material Shortfall Loss</td>
                        <td>{formatCurrency(result.loss_analysis.Direct_Product_Loss)}</td>
                      </tr>
                      <tr>
                        <td>Fixed Overhead Incurred During Idle</td>
                        <td>{formatCurrency(result.loss_analysis.Fixed_Overhead_Loss)}</td>
                      </tr>
                      <tr style={{ borderBottom: 'none' }}>
                        <td style={{ fontWeight: 600, color: 'var(--text-main)', paddingTop: '14px' }}>Total Projected Line Loss</td>
                        <td style={{ fontWeight: 700, fontSize: '15px', color: result.loss_analysis.Total_Production_Loss > 0 ? 'var(--danger)' : 'var(--success)', paddingTop: '14px' }}>
                          {formatCurrency(result.loss_analysis.Total_Production_Loss)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Alternative Suppliers Table */}
              <div className="panel" style={{ marginTop: '24px' }}>
                <div className="panel-header">
                  <div>
                    <span className="panel-title">
                      <Building2 size={16} />
                      Verified Alternative Supplier Recommendations (MCDA Scored)
                    </span>
                    <p style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                      Ranked by multi-criteria decision analysis incorporating lead time velocity, stockout prevention, on-time history, and net financial benefit.
                    </p>
                  </div>
                </div>

                {result.alternatives && result.alternatives.length > 0 ? (
                  <div className="table-wrapper">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Candidate Supplier</th>
                          <th>MCDA Match</th>
                          <th>Lead Time</th>
                          <th>Available Qty</th>
                          <th>Unit Cost</th>
                          <th>Downtime Avoided</th>
                          <th>Net Benefit</th>
                          <th>Feasibility Assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.alternatives.map((alt, idx) => (
                          <tr key={alt.Raw_Supplier_ID || idx}>
                            <td className="mono-cell" style={{ fontWeight: 600 }}>#{idx + 1}</td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{alt['Supplier ID']}</div>
                              <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>Rating: {alt['Supplier Rating']}</div>
                            </td>
                            <td className="mono-cell">
                              <span style={{ fontWeight: 700, color: alt.Raw_MCDA_Score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                                {alt['Match Score']}
                              </span>
                            </td>
                            <td className="mono-cell">{alt['Lead Time']}</td>
                            <td className="mono-cell">{alt['Available Quantity']}</td>
                            <td className="mono-cell">₹ {Number(alt.Raw_Unit_Cost).toLocaleString('en-IN')}</td>
                            <td className="mono-cell">
                              <span className={alt.Downtime_Prevented_Days > 0 ? 'text-success' : 'text-dim'}>
                                {alt.Downtime_Prevented_Days > 0 ? `+${alt.Downtime_Prevented_Days} Days` : '0 d'}
                              </span>
                            </td>
                            <td className="mono-cell" style={{ fontWeight: 600, color: alt.Net_Benefit_INR > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                              {formatCurrency(alt.Net_Benefit_INR)}
                            </td>
                            <td style={{ fontSize: '12px' }}>
                              <span className={`badge ${alt.Arrives_Before_Stockout ? 'badge-safe' : (alt.Downtime_Prevented_Days > 0 ? 'badge-warning' : 'badge-danger')}`}>
                                {alt.Arrives_Before_Stockout ? 'Prevents Shutdown' : (alt.Downtime_Prevented_Days > 0 ? 'Shortens Downtime' : 'No Lead Benefit')}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    No alternative suppliers required: current order delivery poses zero stockout risk, or no approved secondary vendor is registered for item code <strong style={{ color: 'var(--text-main)' }}>{form.item_id}</strong>.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: BATCH CSV AUDIT */}
      {activeTab === 'bulk' && (
        <div>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">
                <Upload size={16} />
                Batch Purchase Order Risk Audit
              </span>
              <button type="button" onClick={downloadSampleCsv} className="btn-outline">
                <Download size={14} />
                Download Sample CSV Template
              </button>
            </div>

            <form onSubmit={handleBulkUpload}>
              <label className="upload-zone" style={{ display: 'block' }}>
                <input 
                  type="file" 
                  accept=".csv" 
                  style={{ display: 'none' }} 
                  onChange={(e) => setBulkFile(e.target.files[0])}
                />
                <Upload size={28} className="upload-icon" />
                <div className="upload-title">
                  {bulkFile ? bulkFile.name : 'Select or drop a CSV file with purchase orders'}
                </div>
                <div className="upload-sub">
                  Required columns: Supplier_ID, Item_ID, Order_Date, Promised_Date, Quantity_Ordered
                </div>
              </label>

              <div className="form-actions" style={{ marginTop: 0 }}>
                <div className="form-stats-hint">
                  Simultaneous regression & classification scoring across up to 10,000 purchase orders
                </div>
                <button type="submit" className="btn-primary" disabled={bulkLoading || !bulkFile}>
                  {bulkLoading && <span className="spinner"></span>}
                  {bulkLoading ? 'Processing Batch...' : 'Audit Batch Orders'}
                  {!bulkLoading && <ChevronRight size={16} />}
                </button>
              </div>
            </form>
          </div>

          {bulkError && (
            <div className="alert-box alert-danger">
              <AlertTriangle size={18} />
              <div><strong>Audit Error:</strong> {bulkError}</div>
            </div>
          )}

          {bulkResult && (
            <div>
              {/* Batch Summary Strip */}
              <div className="metrics-row">
                <div className="metric-card">
                  <div className="metric-label">Total Orders Audited</div>
                  <div className="metric-value">{bulkResult.summary.total_orders.toLocaleString()}</div>
                  <div className="metric-sub">Complete batch execution</div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Delayed Orders</div>
                  <div className="metric-value text-danger">
                    {bulkResult.summary.delayed_count.toLocaleString()}
                  </div>
                  <div className="metric-sub">
                    <strong>{bulkResult.summary.delayed_pct}%</strong> of total volume
                  </div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">High-Risk Orders</div>
                  <div className="metric-value text-warning">
                    {bulkResult.summary.high_risk_count.toLocaleString()}
                  </div>
                  <div className="metric-sub">Urgent intervention required</div>
                </div>

                <div className="metric-card">
                  <div className="metric-label">Average Delay</div>
                  <div className="metric-value">
                    {bulkResult.summary.average_delay_days.toFixed(1)} d
                  </div>
                  <div className="metric-sub">Mean across batch</div>
                </div>
              </div>

              {/* Audited Orders Table */}
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Audited Orders Breakdown (First 100 Entries)</span>
                  <span className="form-label-hint">Sorted by upload order</span>
                </div>

                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Purchase Order</th>
                        <th>Supplier</th>
                        <th>Item</th>
                        <th>Quantity</th>
                        <th>Predicted Delay</th>
                        <th>Delay Probability</th>
                        <th>Risk Classification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bulkResult.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="mono-cell" style={{ fontWeight: 600 }}>
                            {row.Purchase_Order_ID || `PO-${idx + 1}`}
                          </td>
                          <td className="mono-cell">{row.Supplier_ID}</td>
                          <td className="mono-cell">{row.Item_ID}</td>
                          <td className="mono-cell">{Number(row.Quantity_Ordered).toLocaleString()}</td>
                          <td className="mono-cell">
                            <span className={row.Predicted_Delay_Days > 0.5 ? 'text-danger' : 'text-success'} style={{ fontWeight: 600 }}>
                              {row.Predicted_Delay_Days > 0 ? `+${Number(row.Predicted_Delay_Days).toFixed(1)} d` : '0.0 d'}
                            </span>
                          </td>
                          <td className="mono-cell">
                            {Number(row.Delay_Probability).toFixed(1)}%
                          </td>
                          <td>
                            <span className={`badge ${row.Delivery_Risk === 'High' ? 'badge-high' : (row.Delivery_Risk === 'Medium' ? 'badge-medium' : 'badge-low')}`}>
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
          )}
        </div>
      )}
    </div>
  );
}
