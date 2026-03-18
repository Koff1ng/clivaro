"use client";

import { useState, useEffect } from "react";
import { CommanderPINLogin } from "@/components/restaurant/pos/commander-login";
import { POSScreen } from "@/components/pos/pos-screen";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function CommanderPage() {
  const { data: session, status } = useSession();
  const [waiter, setWaiter] = useState<{ token: string; data: any } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  if (status === "loading") return <div className="h-screen bg-[#0F172A] flex items-center justify-center text-white">Iniciando Comandero...</div>;

  const handleLogin = (token: string, data: any) => {
    setWaiter({ token, data });
  };

  if (!waiter) {
    return <CommanderPINLogin onLogin={handleLogin} />;
  }

  // After login, show the POS interface in commander mode
  return (
    <div className="h-screen bg-background">
      <POSScreen mode="commander" waiterData={waiter.data} />
    </div>
  );
}
