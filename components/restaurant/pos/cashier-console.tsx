"use client";

import React, { useState, useEffect } from 'react';

interface OpenAccount {
  id: string;
  tableName: string;
  waiterName: string;
  total: number;
  tip: number;
  openedAt: string;
}

export const CashierBillingConsole: React.FC = () => {
  const [accounts, setAccounts] = useState<OpenAccount[]>([]);

  useEffect(() => {
    setAccounts([
      { id: '1', tableName: 'Mesa 4', waiterName: 'Carlos R.', total: 125000, tip: 12500, openedAt: '2026-03-18 16:30' },
      { id: '2', tableName: 'Mesa 8', waiterName: 'Ana M.', total: 45000, tip: 4500, openedAt: '2026-03-18 17:15' }
    ]);
  }, []);

  return (
    <div className="res-cashier-layout" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 className="res-title" style={{ fontSize: '2.5rem' }}>Cuentas Abiertas</h1>
        <div className="res-card" style={{ padding: '0.8rem 1.5rem', border: '1px solid var(--res-success)' }}>
          <span style={{ color: 'var(--res-text-muted)' }}>Venta Total Hoy: </span>
          <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--res-success)' }}>$1,240,000</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>
        {accounts.map(acc => (
          <div key={acc.id} className="res-card" style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <h2 style={{ margin: 0 }}>{acc.tableName}</h2>
                <span style={{ fontSize: '0.8rem', color: 'var(--res-text-muted)' }}>Atiende: {acc.waiterName}</span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ color: 'var(--res-primary)', fontSize: '1.5rem', fontWeight: 700 }}>${(acc.total + acc.tip).toLocaleString()}</div>
                <div style={{ fontSize: '0.7rem', opacity: 0.5 }}>{acc.openedAt}</div>
              </div>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Consumo:</span>
                    <span>${acc.total.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--res-warning)' }}>
                    <span>Propina Sugerida:</span>
                    <span>${acc.tip.toLocaleString()}</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
              <button style={{
                padding: '1rem',
                borderRadius: '12px',
                border: '1px solid var(--res-border)',
                backgroundColor: 'transparent',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer'
              }}>Detalles</button>
              
              <button style={{
                padding: '1rem',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: 'var(--res-primary)',
                color: '#000',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}>
                <span style={{ fontSize: '1.2rem' }}>⚡</span>
                Facturar con Alegra
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
