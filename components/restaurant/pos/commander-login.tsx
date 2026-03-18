"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { User, Lock, Delete } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommanderPINLoginProps {
  onLogin: (waiterToken: string, waiterData: any) => void;
}

export function CommanderPINLogin({ onLogin }: CommanderPINLoginProps) {
  const [pin, setPin] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNumberClick = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (!pin || !code) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/waiters/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, pin }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "PIN incorrecto");

      onLogin(data.token, data.waiter);
    } catch (err: any) {
      setError(err.message);
      setPin("");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#0F172A] text-white">
      {/* Left: Branding & Waiter Selection Info */}
      <div className="flex-1 flex flex-col justify-center items-center p-12 bg-gradient-to-br from-[#0F172A] to-[#1E293B] border-r border-white/5">
        <div className="max-w-md text-center space-y-6">
          <h1 className="text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-sky-400 to-blue-600">
            COMANDERO PRO
          </h1>
          <p className="text-slate-400 text-lg">
            Ingrese su código de empleado y PIN para comenzar a tomar pedidos.
          </p>
          
          <div className="pt-8 w-full max-w-sm mx-auto space-y-4">
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5" />
              <Input 
                placeholder="CÓDIGO EMPLEADO" 
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="pl-12 h-14 bg-white/5 border-white/10 text-xl font-bold tracking-widest text-center"
              />
            </div>
            
            <div className="flex justify-center gap-2">
              {[...Array(6)].map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "w-12 h-12 rounded-lg border-2 flex items-center justify-center text-2xl font-bold transition-all",
                    pin.length > i ? "border-sky-500 bg-sky-500/20 text-sky-400" : "border-white/10 bg-white/5 text-slate-600"
                  )}
                >
                  {pin.length > i ? "•" : ""}
                </div>
              ))}
            </div>

            {error && (
              <p className="text-red-400 font-medium animate-shake">{error}</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Soft Restaurant Style PIN Pad */}
      <div className="w-[450px] bg-slate-900/50 backdrop-blur-xl p-8 flex flex-col justify-center gap-6">
        <div className="grid grid-cols-3 gap-4">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="h-24 rounded-2xl bg-white/5 border border-white/10 text-3xl font-bold hover:bg-sky-500 hover:border-sky-400 transition-all active:scale-95"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-24 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <Delete className="w-8 h-8" />
          </button>
          <button
            onClick={() => handleNumberClick("0")}
            className="h-24 rounded-2xl bg-white/5 border border-white/10 text-3xl font-bold hover:bg-sky-500 hover:border-sky-400 transition-all active:scale-95"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || pin.length === 0 || code.length === 0}
            className="h-24 rounded-2xl bg-green-500 text-white text-2xl font-bold shadow-lg shadow-green-500/20 hover:bg-green-600 disabled:opacity-50 disabled:grayscale transition-all active:scale-95"
          >
            OK
          </button>
        </div>

        <p className="text-center text-slate-500 text-sm mt-4 uppercase tracking-widest font-semibold italic">
          v2.0 Restaurant Integration
        </p>
      </div>
    </div>
  );
}
