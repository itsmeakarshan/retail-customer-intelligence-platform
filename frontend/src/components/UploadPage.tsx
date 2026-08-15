import React, { useState, useRef } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Download,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Play,
  RefreshCw,
  Info,
  ShieldCheck,
  Package,
  PoundSterling,
  Award,
  Archive,
  Table,
  Palette,
  Check
} from 'lucide-react';
import {
  validateCSVUpload,
  processCSVUpload,
  getCSVTemplateURL,
  getExcelTemplateURL,
  getDownloadResultURL
} from '../services/api';
import type { CSVValidationReport, UploadSessionResults } from '../services/api';

type StepState = 'IDLE' | 'VALIDATING' | 'PREVIEW' | 'PROCESSING' | 'RESULTS' | 'ERROR';
type ExcelTheme = 'EMERALD' | 'OFFICE_BLUE' | 'DARK_SLATE' | 'ROYAL_PURPLE';

export const UploadPage: React.FC = () => {
  const [step, setStep] = useState<StepState>('IDLE');
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  void uploadedFileName;
  const [isDragOver, setIsDragOver] = useState(false);
  const [validationReport, setValidationReport] = useState<CSVValidationReport | null>(null);
  const [results, setResults] = useState<UploadSessionResults | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Theme & Tab State
  const [excelTheme, setExcelTheme] = useState<ExcelTheme>('EMERALD');
  const [templateTab, setTemplateTab] = useState<'DATA' | 'SCHEMA'>('DATA');

  // Theme Styling Properties
  const themeStyles = {
    EMERALD: {
      name: 'Classic Excel Emerald',
      headerBg: 'linear-gradient(135deg, #107C41, #0F5229)',
      headerText: '#FFFFFF',
      border: 'rgba(16, 124, 65, 0.35)',
      accent: '#107C41',
      badgeBg: 'rgba(16, 124, 65, 0.15)',
      badgeText: '#34D399',
      activeTabBg: '#107C41',
      topBarBg: '#0A3B1B'
    },
    OFFICE_BLUE: {
      name: 'Modern Office 365 Blue',
      headerBg: 'linear-gradient(135deg, #0078D4, #004578)',
      headerText: '#FFFFFF',
      border: 'rgba(0, 120, 212, 0.35)',
      accent: '#0078D4',
      badgeBg: 'rgba(0, 120, 212, 0.15)',
      badgeText: '#60A5FA',
      activeTabBg: '#0078D4',
      topBarBg: '#002038'
    },
    DARK_SLATE: {
      name: 'Dark Mode Slate',
      headerBg: 'linear-gradient(135deg, #334155, #1E293B)',
      headerText: '#F8FAFC',
      border: 'rgba(148, 163, 184, 0.25)',
      accent: '#818CF8',
      badgeBg: 'rgba(99, 102, 241, 0.15)',
      badgeText: '#A5B4FC',
      activeTabBg: '#475569',
      topBarBg: '#0F172A'
    },
    ROYAL_PURPLE: {
      name: 'Royal Purple Suite',
      headerBg: 'linear-gradient(135deg, #7C3AED, #4C1D95)',
      headerText: '#FFFFFF',
      border: 'rgba(124, 58, 237, 0.35)',
      accent: '#8B5CF6',
      badgeBg: 'rgba(124, 58, 237, 0.15)',
      badgeText: '#C084FC',
      activeTabBg: '#7C3AED',
      topBarBg: '#2E1065'
    }
  };

  const currentTheme = themeStyles[excelTheme];

  // Processing Progress Animation State
  const [progressStep, setProgressStep] = useState(0);
  const progressLabels = [
    "📂 Reading Dataset Spreadsheet...",
    "🔍 Validating Schema & Column Mappings...",
    "🧹 Cleaning Transactions & Filtering Null Customers...",
    "⚙️ Constructing 27 Behavioral Features...",
    "🧠 Executing Calibrated Churn & Value ML Models...",
    "📊 Calculating 30-Day Revenue Exposure Estimates...",
    "✅ Analysis Complete!"
  ];

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (file: File) => {
    const fname = file.name.toLowerCase();
    if (!fname.endsWith('.csv') && !fname.endsWith('.xlsx') && !fname.endsWith('.xls')) {
      setErrorMessage("Please upload a valid Excel spreadsheet (.xlsx) or CSV (.csv) file.");
      setStep('ERROR');
      return;
    }

    setUploadedFileName(file.name);
    setErrorMessage(null);
    setStep('VALIDATING');

    try {
      const report = await validateCSVUpload(file);
      setValidationReport(report);

      if (!report.is_valid) {
        setErrorMessage(report.error_message || "Dataset schema validation failed.");
        setStep('ERROR');
      } else {
        setStep('PREVIEW');
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to validate dataset spreadsheet.");
      setStep('ERROR');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleStartAnalysis = async () => {
    if (!validationReport?.session_id) return;
    setStep('PROCESSING');
    setProgressStep(0);

    const interval = setInterval(() => {
      setProgressStep((prev) => (prev < 5 ? prev + 1 : prev));
    }, 600);

    try {
      const res = await processCSVUpload(validationReport.session_id);
      clearInterval(interval);
      setProgressStep(6);

      setTimeout(() => {
        setResults(res);
        setStep('RESULTS');
      }, 500);
    } catch (err: any) {
      clearInterval(interval);
      setErrorMessage(err.message || "An error occurred during feature engineering or ML model inference.");
      setStep('ERROR');
    }
  };

  const handleReset = () => {
    setStep('IDLE');
    setUploadedFileName(null);
    setValidationReport(null);
    setResults(null);
    setErrorMessage(null);
    setProgressStep(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
      
      {/* Page Title & Main Banner */}
      <div className="glass-card" style={{ padding: '24px 28px', borderLeft: `4px solid ${currentTheme.accent}`, background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(18, 24, 38, 0.8))' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <FileSpreadsheet color={currentTheme.accent} size={28} />
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0, color: '#F8FAFC' }}>
                Excel &amp; CSV Data Intelligence Engine
              </h2>
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.92rem', margin: 0 }}>
              Upload customer transactions using Excel (<code style={{ color: currentTheme.badgeText }}>.xlsx</code>) or CSV (<code style={{ color: '#A5B4FC' }}>.csv</code>) for instant ML risk modeling, revenue forecasting, and customer grouping.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <a
              href={getExcelTemplateURL()}
              download="retail_transaction_template.xlsx"
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '0.88rem', textDecoration: 'none', background: currentTheme.headerBg, border: 'none', color: '#FFFFFF', boxShadow: `0 4px 14px ${currentTheme.border}` }}
            >
              <Download size={16} />
              📊 Download Excel Template (.xlsx)
            </a>

            <a
              href={getCSVTemplateURL()}
              download="retail_transaction_template.csv"
              className="btn-secondary"
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '0.85rem', textDecoration: 'none' }}
            >
              <Download size={15} />
              📄 CSV Template
            </a>
          </div>
        </div>
      </div>

      {/* BEAUTIFUL VISUAL REPRESENTATION OF THE EXCEL TEMPLATE IN-APP */}
      {step === 'IDLE' && (
        <div className="glass-card" style={{ padding: '0', borderRadius: '16px', border: `1px solid ${currentTheme.border}`, overflow: 'hidden', background: '#0B0F17', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}>
          
          {/* Excel Application Title & Toolbar Bar */}
          <div style={{ background: currentTheme.topBarBg, padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', flexWrap: 'wrap', gap: '12px' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ background: currentTheme.accent, color: '#FFF', padding: '5px 10px', borderRadius: '6px', fontWeight: 800, fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Table size={15} /> MICROSOFT EXCEL
              </div>
              <div>
                <span style={{ fontSize: '0.92rem', color: '#F8FAFC', fontWeight: 700, display: 'block' }}>
                  retail_transaction_template.xlsx — Saved
                </span>
                <span style={{ fontSize: '0.72rem', color: '#94A3B8' }}>
                  Interactive Web Preview (First 5 Sample Rows)
                </span>
              </div>
            </div>

            {/* Theme Selector Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#94A3B8', marginRight: '6px' }}>
                <Palette size={14} color={currentTheme.accent} />
                <span>Excel Theme:</span>
              </div>

              {(['EMERALD', 'OFFICE_BLUE', 'DARK_SLATE', 'ROYAL_PURPLE'] as ExcelTheme[]).map((thm) => (
                <button
                  key={thm}
                  onClick={() => setExcelTheme(thm)}
                  title={themeStyles[thm].name}
                  style={{
                    padding: '5px 10px',
                    borderRadius: '6px',
                    border: excelTheme === thm ? `2px solid ${themeStyles[thm].accent}` : '1px solid rgba(255,255,255,0.15)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    background: excelTheme === thm ? themeStyles[thm].activeTabBg : 'rgba(255,255,255,0.05)',
                    color: excelTheme === thm ? '#FFFFFF' : '#94A3B8',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s'
                  }}
                >
                  {excelTheme === thm && <Check size={12} />}
                  {thm === 'EMERALD' ? 'Emerald' : thm === 'OFFICE_BLUE' ? 'Blue' : thm === 'DARK_SLATE' ? 'Dark' : 'Purple'}
                </button>
              ))}
            </div>

          </div>

          {/* Excel Formula Bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(15, 23, 42, 0.95)', padding: '8px 16px', fontSize: '0.78rem', fontFamily: 'monospace', color: '#94A3B8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
            <span style={{ color: currentTheme.badgeText, fontWeight: 800 }}>fx</span>
            <span style={{ color: '#475569' }}>|</span>
            <span style={{ color: '#F8FAFC', fontWeight: 600 }}>
              {templateTab === 'DATA'
                ? '=SUMPRODUCT(Quantity * Price) | Row Range [1:6] (Showing First 5 Sample Rows)'
                : 'EXCEL_SCHEMA_RULES(Invoice, StockCode, Description, Quantity, InvoiceDate, Price, CustomerID, Country)'}
            </span>
          </div>

          {/* TAB CONTENT: SHEET 1 (FIRST 5 ROWS IN BEAUTIFUL EXCEL THEME) */}
          {templateTab === 'DATA' && (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                <thead>
                  {/* Excel Column Letters Header */}
                  <tr style={{ background: '#1E293B', color: '#94A3B8', textAlign: 'center', fontWeight: 600, fontSize: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <th style={{ padding: '6px', width: '42px', background: '#0F172A', borderRight: '1px solid rgba(255,255,255,0.1)' }}>#</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>A</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>B</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>C</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>D</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>E</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>F</th>
                    <th style={{ padding: '6px 12px', borderRight: '1px solid rgba(255,255,255,0.08)' }}>G</th>
                    <th style={{ padding: '6px 12px' }}>H</th>
                  </tr>

                  {/* Main Column Names Header (ROW 1) */}
                  <tr style={{ background: currentTheme.headerBg, color: currentTheme.headerText, fontWeight: 700, fontSize: '0.85rem' }}>
                    <td style={{ padding: '10px 8px', textAlign: 'center', background: '#1E293B', color: '#94A3B8', borderRight: '1px solid rgba(255,255,255,0.1)' }}>1</td>
                    <td style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Invoice <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>TEXT</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      StockCode <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>SKU</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Description <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>TEXT</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Quantity <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>INT</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      InvoiceDate <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>DATETIME</span>
                    </td>
                    <td style={{ padding: '10px 14px', textAlign: 'right', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      Price <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>CURRENCY (£)</span>
                    </td>
                    <td style={{ padding: '10px 14px', borderRight: '1px solid rgba(255,255,255,0.15)' }}>
                      CustomerID <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>ID</span>
                    </td>
                    <td style={{ padding: '10px 14px' }}>
                      Country <span style={{ fontSize: '0.65rem', opacity: 0.8, fontWeight: 400, display: 'block' }}>TEXT</span>
                    </td>
                  </tr>
                </thead>

                <tbody>
                  {/* FIRST 5 SAMPLE ROWS */}
                  {[
                    { row: 2, inv: "536365", sku: "85123A", desc: "WHITE HANGING HEART T-LIGHT HOLDER", qty: 6, date: "2011-01-05 08:26:00", price: "£2.55", cid: "17850", country: "United Kingdom" },
                    { row: 3, inv: "536365", sku: "71053", desc: "WHITE METAL LANTERN", qty: 6, date: "2011-01-05 08:26:00", price: "£3.39", cid: "17850", country: "United Kingdom" },
                    { row: 4, inv: "536365", sku: "84406B", desc: "CREAM CUPID HEARTS COAT HANGER", qty: 8, date: "2011-01-05 08:26:00", price: "£2.75", cid: "17850", country: "United Kingdom" },
                    { row: 5, inv: "536367", sku: "84879", desc: "ASSORTED COLOUR BIRD ORNAMENT", qty: 32, date: "2011-01-06 09:15:00", price: "£1.69", cid: "13047", country: "United Kingdom" },
                    { row: 6, inv: "536367", sku: "22745", desc: "POPPY'S PLAYHOUSE BEDROOM", qty: 6, date: "2011-01-06 09:15:00", price: "£2.10", cid: "13047", country: "United Kingdom" }
                  ].map((r, idx) => (
                    <tr key={idx} style={{ background: idx % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.25)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '10px 8px', textAlign: 'center', background: '#1E293B', color: '#64748B', fontWeight: 700, borderRight: '1px solid rgba(255,255,255,0.1)' }}>{r.row}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 600, color: '#F8FAFC', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{r.inv}</td>
                      <td style={{ padding: '10px 14px', color: currentTheme.badgeText, fontFamily: 'monospace', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{r.sku}</td>
                      <td style={{ padding: '10px 14px', color: '#CBD5E1', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{r.desc}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#34D399', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{r.qty}</td>
                      <td style={{ padding: '10px 14px', color: '#94A3B8', fontSize: '0.78rem', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{r.date}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontWeight: 700, color: '#F8FAFC', borderRight: '1px solid rgba(255,255,255,0.05)' }}>{r.price}</td>
                      <td style={{ padding: '10px 14px', fontWeight: 700, color: '#38BDF8', borderRight: '1px solid rgba(255,255,255,0.05)' }}>#{r.cid}</td>
                      <td style={{ padding: '10px 14px', color: '#CBD5E1' }}>{r.country}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* TAB CONTENT: SHEET 2 (SCHEMA & FORMAT RULES) */}
          {templateTab === 'SCHEMA' && (
            <div style={{ overflowX: 'auto', padding: '16px' }}>
              <table className="custom-table" style={{ fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th>Column Name</th>
                    <th>Required Data Type</th>
                    <th>Example Value</th>
                    <th>Validation Rules &amp; Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { col: "Invoice", type: "Text / String", ex: "536365 or C536379", rule: "Order invoice identifier. Prefix 'C' indicates return cancellation." },
                    { col: "StockCode", type: "Text / String", ex: "85123A", rule: "Unique product SKU. Used to compute customer product diversity." },
                    { col: "Description", type: "Text / String", ex: "WHITE HANGING HEART", rule: "Item product description." },
                    { col: "Quantity", type: "Integer", ex: "6 or -1", rule: "Units purchased (>0) or returned (<0)." },
                    { col: "InvoiceDate", type: "YYYY-MM-DD HH:MM:SS", ex: "2011-01-05 08:26:00", rule: "Purchase timestamp. Used for recency and velocity calculations." },
                    { col: "Price", type: "Decimal (£)", ex: "2.55", rule: "Unit price per product item in GBP (£). Must be > 0." },
                    { col: "CustomerID", type: "Integer / String", ex: "17850", rule: "Customer account identifier. Null Customer IDs are filtered out." },
                    { col: "Country", type: "Text / String", ex: "United Kingdom", rule: "Geographical market / customer primary country location." },
                    { col: "ExpiryWithinDays", type: "Integer (Optional)", ex: "15", rule: "Days until product expires (positive = in X days, 0 = today, negative = expired X days ago). Used for inventory waste risk analysis." }
                  ].map((s, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#F8FAFC' }}>{s.col}</td>
                      <td><span style={{ background: currentTheme.badgeBg, color: currentTheme.badgeText, padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600 }}>{s.type}</span></td>
                      <td style={{ fontFamily: 'monospace', color: '#38BDF8' }}>{s.ex}</td>
                      <td style={{ color: '#94A3B8' }}>{s.rule}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Excel Application Footer & Status Bar */}
          <div style={{ background: currentTheme.topBarBg, padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', fontSize: '0.76rem', color: '#94A3B8', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
            
            {/* Sheet Tabs Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <button
                onClick={() => setTemplateTab('DATA')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px 4px 0 0',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: templateTab === 'DATA' ? '#1E293B' : 'transparent',
                  color: templateTab === 'DATA' ? '#FFFFFF' : '#94A3B8',
                  borderTop: templateTab === 'DATA' ? `3px solid ${currentTheme.accent}` : 'none'
                }}
              >
                📊 Transactions (Top 5 Rows)
              </button>

              <button
                onClick={() => setTemplateTab('SCHEMA')}
                style={{
                  padding: '4px 12px',
                  borderRadius: '4px 4px 0 0',
                  border: 'none',
                  fontSize: '0.76rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: templateTab === 'SCHEMA' ? '#1E293B' : 'transparent',
                  color: templateTab === 'SCHEMA' ? '#FFFFFF' : '#94A3B8',
                  borderTop: templateTab === 'SCHEMA' ? `3px solid ${currentTheme.accent}` : 'none'
                }}
              >
                📋 Column Guidelines &amp; Rules
              </button>
            </div>

            {/* Excel Status Bar Summary */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.74rem' }}>
              <span>READY</span>
              <span>|</span>
              <span>Rows: 5 Selected</span>
              <span>|</span>
              <span>Average: £2.50</span>
              <span>|</span>
              <span>Count: 5</span>
              <span>|</span>
              <span style={{ color: '#F8FAFC', fontWeight: 700 }}>Sum: £12.48</span>
            </div>

          </div>

        </div>
      )}

      {/* STEP 1: IDLE / DRAG & DROP UPLOAD ZONE */}
      {step === 'IDLE' && (
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className="glass-card"
          style={{
            padding: '44px 32px',
            textAlign: 'center',
            border: isDragOver ? `2px dashed ${currentTheme.accent}` : '2px dashed rgba(255, 255, 255, 0.18)',
            background: isDragOver ? 'rgba(16, 185, 129, 0.08)' : 'rgba(15, 23, 42, 0.5)',
            borderRadius: '20px',
            transition: 'all 0.2s ease',
            cursor: 'pointer'
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            accept=".csv, .xlsx, .xls"
            onChange={(e) => e.target.files && e.target.files.length > 0 && handleFileSelect(e.target.files[0])}
            style={{ display: 'none' }}
          />

          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: currentTheme.badgeBg, border: `1px solid ${currentTheme.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto' }}>
            <UploadCloud color={currentTheme.accent} size={32} />
          </div>

          <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 8px 0', color: '#F8FAFC' }}>
            Drag &amp; Drop your Excel (.xlsx) or CSV (.csv) File Here
          </h3>
          
          <p style={{ color: '#94A3B8', fontSize: '0.88rem', maxWidth: '540px', margin: '0 auto 20px auto' }}>
            Supports Microsoft Excel spreadsheets (<code style={{ background: currentTheme.badgeBg, color: currentTheme.badgeText, padding: '2px 6px', borderRadius: '4px' }}>.xlsx</code>) and standard CSV files up to 50MB.
          </p>

          <button className="btn-primary" style={{ padding: '12px 28px', fontSize: '0.95rem', background: currentTheme.headerBg, border: 'none', boxShadow: `0 4px 14px ${currentTheme.border}` }}>
            Select Spreadsheet File &rarr;
          </button>
        </div>
      )}

      {/* STEP 2: VALIDATING SPINNER */}
      {step === 'VALIDATING' && (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <RefreshCw className="animate-spin" size={36} color={currentTheme.accent} style={{ margin: '0 auto 16px auto', display: 'block' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: '#F8FAFC', margin: '0 0 6px 0' }}>
            Validating Spreadsheet Schema &amp; Data Types...
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.88rem', margin: 0 }}>
            Parsing headers, column formats, missing Customer IDs, dates, and prices.
          </p>
        </div>
      )}

      {/* STEP 3: PREVIEW & DATA QUALITY REPORT */}
      {step === 'PREVIEW' && validationReport && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* File Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="glass-card metric-card">
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>File Information</div>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#F8FAFC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {validationReport.filename}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                Size: {validationReport.file_size_mb} MB ({validationReport.encoding})
              </div>
            </div>

            <div className="glass-card metric-card">
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>Total Transactions</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#818CF8' }}>
                {validationReport.total_rows?.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                Across {validationReport.total_columns} columns
              </div>
            </div>

            <div className="glass-card metric-card">
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>Unique Customers</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#10B981' }}>
                {validationReport.unique_customers?.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>
                {validationReport.unique_products?.toLocaleString()} unique SKUs
              </div>
            </div>

            <div className="glass-card metric-card">
              <div style={{ fontSize: '0.78rem', color: '#94A3B8', marginBottom: '4px' }}>Data Quality Score</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: validationReport.quality_score && validationReport.quality_score >= 80 ? '#34D399' : '#FDE047' }}>
                {validationReport.quality_score}/100
              </div>
              <div style={{ fontSize: '0.75rem', color: '#34D399', fontWeight: 600, marginTop: '4px' }}>
                {validationReport.health_status}
              </div>
            </div>
          </div>

          {/* Validation Checklist & Quality Warnings */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldCheck color="#34D399" size={20} /> Data Quality &amp; Schema Audit Checklist
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '14px' }}>
              <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem' }}>
                <div style={{ color: '#34D399', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={16} /> All 8 Required Columns Validated
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.78rem' }}>Invoice, StockCode, Description, Quantity, InvoiceDate, Price, CustomerID, Country</div>
              </div>

              <div style={{ background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem' }}>
                <div style={{ color: '#FDE047', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <AlertTriangle size={16} /> Data Preprocessing Actions Identified
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                  Filter {validationReport.null_customers} null Customer IDs ({validationReport.null_customers_pct}%). Process {validationReport.cancellation_rows} cancellation rows.
                </div>
              </div>

              <div style={{ background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', padding: '12px 16px', borderRadius: '10px', fontSize: '0.85rem' }}>
                <div style={{ color: '#A5B4FC', fontWeight: 700, marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Info size={16} /> Date Range &amp; Estimated Volume
                </div>
                <div style={{ color: '#94A3B8', fontSize: '0.78rem' }}>
                  {validationReport.date_range} | Estimated Volume: £{validationReport.estimated_gross_revenue?.toLocaleString()}
                </div>
              </div>
            </div>

            {/* 10-Row Sample Preview Table */}
            <div style={{ marginTop: '20px' }}>
              <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#F8FAFC', marginBottom: '10px' }}>
                First 10 Sample Rows (Uploaded Spreadsheet)
              </div>
              <div style={{ overflowX: 'auto', maxHeight: '250px' }}>
                <table className="custom-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>StockCode</th>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>InvoiceDate</th>
                      <th>Price</th>
                      <th>CustomerID</th>
                      <th>Country</th>
                    </tr>
                  </thead>
                  <tbody>
                    {validationReport.preview_rows?.map((row, idx) => (
                      <tr key={idx}>
                        <td>{row.Invoice}</td>
                        <td>{row.StockCode}</td>
                        <td>{row.Description}</td>
                        <td>{row.Quantity}</td>
                        <td>{row.InvoiceDate}</td>
                        <td>£{row.Price}</td>
                        <td>{row.CustomerID}</td>
                        <td>{row.Country}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Action Bar */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
              <button onClick={handleReset} className="btn-secondary" style={{ padding: '10px 20px', fontSize: '0.88rem' }}>
                Choose Another File
              </button>

              <button onClick={handleStartAnalysis} className="btn-primary" style={{ padding: '12px 28px', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px', background: currentTheme.headerBg, border: 'none' }}>
                <Play size={18} />
                🚀 Run Retail Analysis
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: ANIMATED PROCESSING INTERFACE */}
      {step === 'PROCESSING' && (
        <div className="glass-card" style={{ padding: '40px 32px', textAlign: 'center' }}>
          <RefreshCw className="animate-spin" size={42} color={currentTheme.accent} style={{ margin: '0 auto 20px auto', display: 'block' }} />
          
          <h3 style={{ fontSize: '1.3rem', fontWeight: 800, color: '#F8FAFC', marginBottom: '8px' }}>
            Processing Dataset Spreadsheet...
          </h3>
          
          <p style={{ color: currentTheme.badgeText, fontSize: '0.95rem', fontWeight: 600, marginBottom: '28px' }}>
            {progressLabels[progressStep]}
          </p>

          {/* Step Indicators */}
          <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '10px', textAlign: 'left' }}>
            {progressLabels.slice(0, 6).map((label, idx) => {
              const isDone = idx < progressStep;
              const isCurrent = idx === progressStep;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.88rem', padding: '8px 12px', borderRadius: '8px', background: isCurrent ? currentTheme.badgeBg : 'rgba(255,255,255,0.02)', color: isDone ? '#34D399' : isCurrent ? '#F8FAFC' : '#64748B' }}>
                  {isDone ? <CheckCircle size={18} color="#34D399" /> : isCurrent ? <RefreshCw className="animate-spin" size={18} color={currentTheme.accent} /> : <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #64748B' }} />}
                  <span style={{ fontWeight: isCurrent ? 700 : 400 }}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 5: RESULTS VIEW */}
      {step === 'RESULTS' && results && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Header Success Toast */}
          <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '12px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <CheckCircle size={24} color="#34D399" />
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: '#34D399' }}>
                  🎉 Analysis Complete!
                </h3>
                <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '2px 0 0 0' }}>
                  Successfully processed {results.total_rows.toLocaleString()} transactions across {results.unique_customers.toLocaleString()} customers.
                </p>
              </div>
            </div>

            <button onClick={handleReset} className="btn-secondary" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Upload New Spreadsheet
            </button>
          </div>

          {/* Results Download Toolbar (EXCEL PRIMARY) */}
          <div className="glass-card" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(15, 23, 42, 0.8))' }}>
            <div style={{ fontWeight: 800, fontSize: '1rem', color: '#F8FAFC', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Download size={20} color="#34D399" /> Download Analysis Spreadsheets &amp; Reports
            </div>
            <p style={{ color: '#94A3B8', fontSize: '0.85rem', margin: '0 0 16px 0' }}>
              Download multi-tab Excel workbooks or individual Excel spreadsheets (.xlsx) for comfortable editing and reporting.
            </p>
            
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
              {/* PRIMARY EXCEL WORKBOOK */}
              <a
                href={getDownloadResultURL(results.session_id, 'workbook_excel')}
                download="full_analysis_workbook.xlsx"
                className="btn-primary"
                style={{ fontSize: '0.88rem', padding: '10px 18px', textDecoration: 'none', background: currentTheme.headerBg, border: 'none', boxShadow: `0 4px 14px ${currentTheme.border}` }}
              >
                📊 Multi-Tab Excel Workbook (.xlsx)
              </a>

              <a
                href={getDownloadResultURL(results.session_id, 'predictions_excel')}
                download="customer_predictions.xlsx"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', textDecoration: 'none', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34D399' }}
              >
                📊 Predictions (Excel)
              </a>

              <a
                href={getDownloadResultURL(results.session_id, 'revenue_risk_excel')}
                download="revenue_risk_results.xlsx"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', textDecoration: 'none', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34D399' }}
              >
                📊 Revenue Risk (Excel)
              </a>

              <a
                href={getDownloadResultURL(results.session_id, 'segmentation_excel')}
                download="customer_segmentation.xlsx"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', textDecoration: 'none', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34D399' }}
              >
                📊 Customer Groups (Excel)
              </a>

              <a
                href={getDownloadResultURL(results.session_id, 'quality_report_excel')}
                download="data_quality_report.xlsx"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', textDecoration: 'none', borderColor: 'rgba(16, 185, 129, 0.4)', color: '#34D399' }}
              >
                📊 Quality Audit (Excel)
              </a>

              <a
                href={getDownloadResultURL(results.session_id, 'bundle')}
                download="results_bundle.zip"
                className="btn-secondary"
                style={{ fontSize: '0.82rem', padding: '8px 14px', textDecoration: 'none' }}
              >
                <Archive size={15} /> 📦 All Excel + CSV Files (ZIP)
              </a>
            </div>
          </div>

          {/* Executive Results KPI Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            <div className="glass-card metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Needs Attention</span>
                <AlertTriangle size={18} color="#EF4444" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>
                {results.high_risk_customers.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Accounts showing &gt;70% risk</div>
            </div>

            <div className="glass-card metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Company May Lose</span>
                  <span title="Estimated 30-day loss exposure (churn probability × 30-day estimated spend). Estimated business exposure, not a guaranteed loss." style={{ cursor: 'help' }}>
                    <Info size={13} color="#FCA5A5" />
                  </span>
                </div>
                <PoundSterling size={18} color="#EF4444" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#EF4444' }}>
                £{results.total_company_may_lose_30d.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#EF4444', fontWeight: 600, marginTop: '4px' }}>
                ↓ {results.loss_percentage_30d.toFixed(1)}% of estimated 30-day revenue
              </div>
            </div>

            <div className="glass-card metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Estimated Revenue — Next 30 Days</span>
                  <span title="Derived from ML model's 90-day forward prediction using an even daily run-rate assumption (predicted 90-day value ÷ 3)." style={{ cursor: 'help' }}>
                    <Info size={13} color="#34D399" />
                  </span>
                </div>
                <Award size={18} color="#34D399" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#34D399' }}>
                £{results.total_expected_30d_revenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Estimated 30-day sales portfolio</div>
            </div>

            <div className="glass-card metric-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <span style={{ fontSize: '0.82rem', color: '#94A3B8', fontWeight: 600 }}>Data Quality Score</span>
                <ShieldCheck size={18} color="#818CF8" />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#818CF8' }}>
                {results.quality_score}/100
              </div>
              <div style={{ fontSize: '0.75rem', color: '#64748B', marginTop: '4px' }}>Clean feature matrix created</div>
            </div>
          </div>

          {/* Customer Groups Breakdown */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
              Customer Groups Breakdown (Uploaded Data)
            </h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Customer Group</th>
                    <th>Accounts</th>
                    <th>Avg Inactivity</th>
                    <th>Total Spend</th>
                    <th>Avg Spend</th>
                    <th>Estimated 30d Revenue</th>
                    <th>Company May Lose (30d Est.)</th>
                  </tr>
                </thead>
                <tbody>
                  {results.segments_summary?.map((seg, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#F8FAFC' }}>{seg.segment_name}</td>
                      <td>{seg.customer_count}</td>
                      <td>{seg.avg_recency}d ago</td>
                      <td>£{seg.total_monetary?.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td>£{seg.avg_monetary?.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td>£{seg.expected_30d_revenue?.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td style={{ color: '#FCA5A5', fontWeight: 700 }}>
                        £{seg.company_may_lose_30d?.toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Top Exposure Accounts Table */}
          <div className="glass-card" style={{ padding: '24px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '16px' }}>
              Top 10 High Exposure Customer Accounts
            </h3>
            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Customer ID</th>
                    <th>Market</th>
                    <th>Inactivity</th>
                    <th>Gross Spend</th>
                    <th>Inactivity Likelihood</th>
                    <th>Est. Spend — Next 30 Days</th>
                    <th>Company May Lose (30d Est.)</th>
                    <th>Customer Group</th>
                  </tr>
                </thead>
                <tbody>
                  {results.top_exposure_accounts?.map((c, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 700, color: '#F8FAFC' }}>#{c.customer_id}</td>
                      <td>{c.country}</td>
                      <td>{c.recency}d ago</td>
                      <td>£{c.monetary?.toLocaleString()}</td>
                      <td>{(c.churn_probability * 100).toFixed(0)}% likely</td>
                      <td>£{c.expected_30d_revenue?.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td style={{ color: '#FCA5A5', fontWeight: 700 }}>£{c.company_may_lose_30d?.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td>
                      <td>{c.segment_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Expiry & Email Limitations Disclosures */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ padding: '16px', background: 'rgba(245, 158, 11, 0.08)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: '12px', fontSize: '0.84rem' }}>
              <div style={{ color: '#FDE047', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Package size={16} /> Expiry Analysis Unavailable
              </div>
              <div style={{ color: '#94A3B8' }}>{results.expiry_message}</div>
            </div>

            <div style={{ padding: '16px', background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', borderRadius: '12px', fontSize: '0.84rem' }}>
              <div style={{ color: '#A5B4FC', fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <ShieldCheck size={16} /> Contact &amp; Email Safety Guard
              </div>
              <div style={{ color: '#94A3B8' }}>
                Email testing remains restricted to your configured demo recipient. Emails are never delivered to customer addresses in uploaded files.
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ERROR DISPLAY STATE */}
      {step === 'ERROR' && (
        <div className="glass-card" style={{ padding: '32px', borderLeft: '4px solid #EF4444', textAlign: 'center' }}>
          <XCircle size={40} color="#EF4444" style={{ margin: '0 auto 12px auto', display: 'block' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: '#FCA5A5', margin: '0 0 8px 0' }}>
            Upload or Processing Error
          </h3>
          <p style={{ color: '#94A3B8', fontSize: '0.9rem', maxWidth: '600px', margin: '0 auto 20px auto' }}>
            {errorMessage || "An unexpected error occurred."}
          </p>
          <button onClick={handleReset} className="btn-primary" style={{ padding: '10px 24px' }}>
            Try Uploading Again
          </button>
        </div>
      )}

    </div>
  );
};
