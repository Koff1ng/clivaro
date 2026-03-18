"use client";

import { KitchenDisplayBoard } from "@/components/restaurant/kds/display-board";

export default function RestaurantKDSPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="px-6">
        <h1 className="res-title text-4xl">Monitor de Cocina (KDS)</h1>
        <p className="text-slate-400">Control de producción y tiempos</p>
      </header>
      
      <KitchenDisplayBoard />
    </div>
  );
}
