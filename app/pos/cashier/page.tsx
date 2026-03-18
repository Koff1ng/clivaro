"use client";

import { CashierBillingConsole } from "@/components/restaurant/pos/cashier-console";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";
import { useEffect } from "react";

export default function RestaurantCashierPage() {
  const { status } = useSession();

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  if (status === "loading") return <div className="p-8">Cargando consola de cajero...</div>;

  return (
    <div className="min-h-screen bg-slate-50/50">
      <CashierBillingConsole />
    </div>
  );
}
