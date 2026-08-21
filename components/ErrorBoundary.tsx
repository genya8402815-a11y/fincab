'use client';

import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; section?: string; }
interface State { hasError: boolean; }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', this.props.section, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: 60, gap: 16, textAlign: 'center',
        }}>
          <div style={{ fontSize: 40 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>
            Что-то пошло не так
          </div>
          {this.props.section && (
            <div style={{ fontSize: 13, color: '#8892a4' }}>
              Ошибка в разделе «{this.props.section}»
            </div>
          )}
          <button
            onClick={() => this.setState({ hasError: false })}
            style={{
              marginTop: 8, padding: '10px 24px', borderRadius: 10,
              border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 600,
              background: '#6c8ef7', color: '#fff',
            }}
          >
            Попробовать снова
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
