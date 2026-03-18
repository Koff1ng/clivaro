"use client";

import { RestaurantTableMap } from "@/components/restaurant/ui/table-map";
import { useState, useEffect } from "react";

export default function RestaurantMapPage() {
  const [tables, setTables] = useState([]);

  useEffect(() => {
    // Fetch tables from API
    fetch('/api/restaurant/config')
      .then(res => res.json())
      .then(data => {
        if (data.zones && data.zones[0]) {
          setTables(data.zones[0].tables || []);
        }
      });
  }, []);

  return (
    <div className="flex flex-col gap-8">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="res-title text-4xl">Mapa de Salón</h1>
          <p className="text-slate-400">Gestión de mesas en tiempo real</p>
        </div>
        <div className="flex gap-4">
           {/* Actions like Add Table, etc. */}
        </div>
      </header>

      <div className="res-card">
        <RestaurantTableMap 
          tables={tables} 
          onTableClick={(table) => console.log("Table clicked:", table)} 
        />
      </div>
    </div>
  );
}
