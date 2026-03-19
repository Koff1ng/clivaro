"use client";

import { useState, useEffect } from "react";
import { CommanderPINLogin } from "@/components/restaurant/pos/commander-login";
import { CommanderView } from "@/components/restaurant/pos/commander-view";
import { useSession } from "next-auth/react";
import { redirect } from "next/navigation";

export default function CommanderPage() {
  const { status } = useSession();
  const [waiter, setWaiter] = useState<{ token: string; data: any } | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") {
      redirect("/login");
    }
  }, [status]);

  if (status === "loading") {
    return (
      <div
        style={{
          height: "100vh",
          background: "#2C1A0E",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#F5C518",
          fontSize: 20,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        Iniciando Comandero...
      </div>
    );
  }

  const handleLogin = (token: string, data: any) => {
    setWaiter({ token, data });
  };

  const handleExit = () => {
    setWaiter(null);
  };

  if (!waiter) {
    return <CommanderPINLogin onLogin={handleLogin} />;
  }

  return (
    <CommanderView
      waiterToken={waiter.token}
      waiterData={waiter.data}
      onExit={handleExit}
    />
  );
}
