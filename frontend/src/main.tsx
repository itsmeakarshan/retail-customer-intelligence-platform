import { Component, StrictMode } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0B0F17',
          color: '#F8FAFC',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif'
        }}>
          <div className="glass-card" style={{ padding: '40px', maxWidth: '500px', borderRadius: '16px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
            <h2 style={{ color: '#EF4444', marginBottom: '12px', fontSize: '1.4rem' }}>Application Error Encountered</h2>
            <p style={{ color: '#94A3B8', fontSize: '0.9rem', marginBottom: '20px' }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering the dashboard.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: '10px 24px',
                background: 'linear-gradient(135deg, #6366F1, #4F46E5)',
                color: '#FFFFFF',
                border: 'none',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
