"use client";

import { WaiterOrderTerminal } from "@/components/restaurant/pos/order-terminal";

export default function RestaurantPOSPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="res-title text-3xl">Terminal de Mesero</h1>
        <p className="text-slate-400">Toma de pedidos y comandas</p>
      </header>
      
      <WaiterOrderTerminal />
    </div>
  );
}
