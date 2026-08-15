import React, { useState } from 'react';
import { X, UploadCloud, Download, Sparkles, CheckCircle2, AlertCircle } from 'lucide-react';
import { validateCSVUpload, processCSVUpload, getCSVTemplateURL } from '../services/api';

interface NewDashboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDashboardCreated: (dashboardId: string, dashboardName: string) => void;
}

export const NewDashboardModal: React.FC<NewDashboardModalProps> = ({
  isOpen,
  onClose,
  onDashboardCreated
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.name.endsWith('.csv') || droppedFile.name.endsWith('.xlsx') || droppedFile.name.endsWith('.xls')) {
        setFile(droppedFile);
        setError(null);
      } else {
        setError('Please select a valid CSV or Excel customer dataset file.');
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
    }
  };

  const handleCreateDashboard = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);

    try {
      // 1. Validate & Stage
      const valReport = await validateCSVUpload(file);
      if (!valReport.is_valid && valReport.missing_columns && valReport.missing_columns.length > 0) {
        throw new Error(`Dataset is missing required columns: ${valReport.missing_columns.join(', ')}`);
      }

      // 2. Process dataset
      const results = await processCSVUpload(valReport.session_id);
      
      // 3. Complete creation flow
      const dashName = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
      onDashboardCreated(results.session_id, dashName);
      onClose();
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Failed to create new dashboard from uploaded dataset.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 15, 23, 0.8)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px'
      }}
    >
      <div
        className="glass-card"
        style={{
          background: 'var(--bg-card, #1E293B)',
          border: '1px solid rgba(129, 140, 248, 0.3)',
          borderRadius: '16px',
          maxWidth: '540px',
          width: '100%',
          padding: '32px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}
      >
        <button
          onClick={onClose}
          disabled={isUploading}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            padding: '4px'
          }}
        >
          <X size={20} />
        </button>

        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, margin: '0 0 6px 0', color: 'var(--text-main)' }}>
            Create New Dashboard
          </h2>
          <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-muted)' }}>
            Upload your customer data file to create a new analytics dashboard.
          </p>
        </div>

        {error && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#FCA5A5', fontSize: '0.85rem' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          style={{
            border: '2px dashed rgba(99, 102, 241, 0.4)',
            borderRadius: '12px',
            padding: '36px 24px',
            textAlign: 'center',
            background: 'rgba(99, 102, 241, 0.04)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onClick={() => document.getElementById('new-dashboard-file-input')?.click()}
        >
          <input
            id="new-dashboard-file-input"
            type="file"
            accept=".csv, .xlsx, .xls"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />

          <div style={{ padding: '12px', borderRadius: '50%', background: 'rgba(99, 102, 241, 0.15)', color: '#818CF8' }}>
            <UploadCloud size={32} />
          </div>

          {file ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#10B981', fontWeight: 600, fontSize: '0.95rem' }}>
              <CheckCircle2 size={18} />
              <span>{file.name} ({(file.size / 1024).toFixed(1)} KB)</span>
            </div>
          ) : (
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: '1rem', fontWeight: 600, color: 'var(--text-main)' }}>
                Upload a file
              </p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Drag and drop your CSV or Excel file here, or click to browse
              </p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', paddingTop: '8px' }}>
          <a
            href={getCSVTemplateURL()}
            download="customer_intelligence_template.csv"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#818CF8',
              fontSize: '0.85rem',
              fontWeight: 600,
              textDecoration: 'none'
            }}
          >
            <Download size={15} />
            <span>Download Sample Template</span>
          </a>

          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={onClose}
              disabled={isUploading}
              style={{
                padding: '9px 16px',
                borderRadius: '8px',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: 'var(--text-muted)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer'
              }}
            >
              Cancel
            </button>

            <button
              onClick={handleCreateDashboard}
              disabled={!file || isUploading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 20px',
                borderRadius: '8px',
                background: (!file || isUploading) ? 'rgba(99, 102, 241, 0.4)' : 'linear-gradient(135deg, #6366F1, #4F46E5)',
                color: '#FFF',
                border: 'none',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: (!file || isUploading) ? 'not-allowed' : 'pointer',
                boxShadow: (!file || isUploading) ? 'none' : '0 2px 10px rgba(99, 102, 241, 0.4)'
              }}
            >
              {isUploading ? (
                <>
                  <Sparkles size={16} className="animate-spin" />
                  <span>Processing Dataset...</span>
                </>
              ) : (
                <span>Create Dashboard</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
