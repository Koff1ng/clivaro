"use client";

import React, { useState, useEffect } from 'react';

interface Table {
  id: string;
  name: string;
  status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' | 'CLEANING';
  x: number;
  y: number;
}

interface TableMapProps {
  tables: Table[];
  onTableClick: (table: Table) => void;
  isEditMode?: boolean;
}

export const RestaurantTableMap: React.FC<TableMapProps> = ({ tables, onTableClick, isEditMode = false }) => {
  const getTableColor = (status: string) => {
    switch (status) {
      case 'AVAILABLE': return 'var(--res-success)';
      case 'OCCUPIED': return 'var(--res-primary)';
      case 'RESERVED': return 'var(--res-info)';
      case 'CLEANING': return 'var(--res-danger)';
      default: return 'var(--res-border)';
    }
  };

  return (
    <div className="res-map-container" style={{ 
      position: 'relative', 
      width: '100%', 
      height: '600px', 
      background: 'rgba(15, 23, 42, 0.5)', 
      borderRadius: '2rem',
      overflow: 'hidden',
      border: '1px solid var(--res-border)',
      boxShadow: 'inset 0 0 50px rgba(0,0,0,0.5)'
    }}>
      {/* Grid Background Effect */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(var(--res-border) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
        opacity: 0.1
      }} />

      {tables.map(table => (
        <div 
          key={table.id}
          onClick={() => onTableClick(table)}
          className="res-animate-in"
          style={{
            position: 'absolute',
            left: `${table.x}px`,
            top: `${table.y}px`,
            width: '80px',
            height: '80px',
            cursor: 'pointer',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.3s var(--res-ease)',
            zIndex: 10
          }}
        >
          {/* Table Shape */}
          <div style={{
            width: '60px',
            height: '60px',
            backgroundColor: 'var(--res-surface)',
            border: `3px solid ${getTableColor(table.status)}`,
            borderRadius: '16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 15px ${getTableColor(table.status)}33`,
            transition: 'all 0.3s ease'
          }}>
            <span style={{ fontWeight: 700, fontSize: '1.2rem' }}>{table.name}</span>
          </div>
          
          {/* Status Label */}
          <span style={{ 
            fontSize: '0.7rem', 
            marginTop: '8px', 
            color: 'var(--res-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '1px'
          }}>
            {table.status.toLowerCase()}
          </span>
          
          <style jsx>{`
            div:hover div {
              transform: scale(1.1);
              box-shadow: 0 0 25px ${getTableColor(table.status)}66;
              background: var(--res-surface-hover);
            }
          `}</style>
        </div>
      ))}
    </div>
  );
};
