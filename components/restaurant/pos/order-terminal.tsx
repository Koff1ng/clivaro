"use client";

import React, { useState } from 'react';

interface Product {
  id: string;
  name: string;
  price: number;
  category: string;
  image?: string;
}

interface OrderItem extends Product {
  quantity: number;
  notes?: string;
}

export const WaiterOrderTerminal: React.FC = () => {
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [activeCategory, setActiveCategory] = useState('Entradas');

  const categories = ['Entradas', 'Platos Fuertes', 'Bebidas', 'Postres', 'Licores'];

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  return (
    <div className="res-pos-wrapper" style={{ display: 'grid', gridTemplateColumns: '1fr 350px', gap: '1.5rem', height: 'calc(100vh - 100px)' }}>
      {/* Menu Side */}
      <div className="res-menu-section" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Category Tabs */}
        <div className="res-tabs-row" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
          {categories.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                padding: '0.8rem 1.5rem',
                borderRadius: '12px',
                border: 'none',
                backgroundColor: activeCategory === cat ? 'var(--res-primary)' : 'var(--res-surface)',
                color: activeCategory === cat ? '#000' : '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s',
                whiteSpace: 'nowrap'
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="res-product-grid" style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', 
          gap: '1rem',
          overflowY: 'auto'
        }}>
          {[1,2,3,4,5,6].map(n => (
            <div 
              key={n} 
              className="res-card" 
              onClick={() => addToCart({ id: String(n), name: `Plato Ejm ${n}`, price: 25000, category: activeCategory })}
              style={{ padding: '0.8rem', textAlign: 'center' }}
            >
              <div style={{ height: '100px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', marginBottom: '0.8rem' }} />
              <div style={{ fontWeight: 600, marginBottom: '0.4rem' }}>Plato Gourmet {n}</div>
              <div style={{ color: 'var(--res-primary)', fontSize: '1.1rem', fontWeight: 700 }}>$25,000</div>
            </div>
          ))}
        </div>
      </div>

      {/* Cart Summary */}
      <div className="res-cart-sidebar res-card" style={{ display: 'flex', flexDirection: 'column' }}>
        <h3 className="res-title" style={{ fontSize: '1.5rem', marginBottom: '1.5rem' }}>Nueva Comanda</h3>
        
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {cart.length === 0 && (
            <div style={{ textAlign: 'center', opacity: 0.3, marginTop: '2rem' }}>Selecciona platos para empezar</div>
          )}
          {cart.map(item => (
            <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 500 }}>{item.name}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--res-text-muted)' }}>x{item.quantity}</div>
              </div>
              <div style={{ fontWeight: 600 }}>${(item.price * item.quantity).toLocaleString()}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid var(--res-border)', paddingTop: '1.5rem', marginTop: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <span style={{ color: 'var(--res-text-muted)' }}>Subtotal</span>
            <span>${total.toLocaleString()}</span>
          </div>
          <button style={{
            width: '100%',
            padding: '1.2rem',
            borderRadius: '16px',
            border: 'none',
            backgroundColor: 'var(--res-primary)',
            color: '#000',
            fontWeight: 700,
            fontSize: '1.1rem',
            cursor: 'pointer',
            boxShadow: '0 4px 15px var(--res-primary-glow)'
          }}>
            Enviar a Cocina
          </button>
        </div>
      </div>
    </div>
  );
};
