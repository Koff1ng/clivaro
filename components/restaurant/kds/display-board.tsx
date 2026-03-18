"use client";

import React, { useState, useEffect } from 'react';

interface KDSOrder {
  id: string;
  tableName: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    notes?: string;
    status: 'PENDING' | 'COOKING' | 'READY';
  }>;
  elapsedMinutes: number;
}

export const KitchenDisplayBoard: React.FC = () => {
  const [orders, setOrders] = useState<KDSOrder[]>([]);

  // Mock data for initial UI check
  useEffect(() => {
    setOrders([
      {
        id: '1',
        tableName: 'Mesa 4',
        elapsedMinutes: 8,
        items: [
          { id: '101', name: 'Hamburguesa Blue', quantity: 2, status: 'COOKING', notes: 'Sin cebolla' },
          { id: '102', name: 'Papas Fritas', quantity: 1, status: 'PENDING' }
        ]
      },
      {
        id: '2',
        tableName: 'Mesa 12',
        elapsedMinutes: 15,
        items: [
           { id: '201', name: 'Ceviche Mixto', quantity: 1, status: 'READY' }
        ]
      }
    ]);
  }, []);

  const getTimerColor = (mins: number) => {
    if (mins < 10) return 'var(--res-success)';
    if (mins < 20) return 'var(--res-warning)';
    return 'var(--res-danger)';
  };

  return (
    <div className="res-kds-grid" style={{ 
      display: 'grid', 
      gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', 
      gap: '1.5rem', 
      padding: '1.5rem' 
    }}>
      {orders.map(order => (
        <div key={order.id} className="res-card" style={{ 
          borderLeft: `6px solid ${getTimerColor(order.elapsedMinutes)}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '1.4rem' }}>{order.tableName}</h2>
            <div style={{ 
              backgroundColor: `${getTimerColor(order.elapsedMinutes)}22`, 
              color: getTimerColor(order.elapsedMinutes),
              padding: '0.4rem 0.8rem',
              borderRadius: '8px',
              fontWeight: 700
            }}>
              {order.elapsedMinutes} min
            </div>
          </div>

          {/* Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {order.items.map(item => (
              <div key={item.id} style={{ 
                padding: '0.8rem', 
                backgroundColor: 'rgba(255,255,255,0.03)', 
                borderRadius: '10px',
                opacity: item.status === 'READY' ? 0.5 : 1
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{item.quantity}x {item.name}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--res-primary)' }}>{item.status}</span>
                </div>
                {item.notes && <div style={{ fontSize: '0.8rem', color: 'var(--res-warning)', marginTop: '0.4rem' }}>i {item.notes}</div>}
              </div>
            ))}
          </div>

          {/* Actions */}
          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <button style={{
              padding: '0.8rem',
              borderRadius: '10px',
              border: '1px solid var(--res-border)',
              backgroundColor: 'transparent',
              color: '#fff',
              cursor: 'pointer'
            }}>Cantar</button>
            <button style={{
              padding: '0.8rem',
              borderRadius: '10px',
              border: 'none',
              backgroundColor: 'var(--res-success)',
              color: '#000',
              fontWeight: 700,
              cursor: 'pointer'
            }}>Entregar</button>
          </div>
        </div>
      ))}
    </div>
  );
};
