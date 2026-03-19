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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNumberClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleSubmit = async () => {
    if (pin.length < 4) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/restaurant/waiters/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
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

  // Auto-submit when 4 digits are entered
  const onPinChange = (newPin: string) => {
    if (newPin.length === 4) {
      // We could auto-submit here, but usually an "OK" button is preferred in POS for clarity
    }
  };

  return (
    <div className="flex h-screen bg-[#0F172A] text-white">
      {/* Left: Branding & PIN Display */}
      <div className="flex-1 flex flex-col justify-center items-center p-12 bg-gradient-to-br from-[#0F172A] to-[#1E293B] border-r border-white/5">
        <div className="max-w-md text-center space-y-8">
          <div className="space-y-2">
            <h1 className="text-6xl font-black bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-red-600">
              COMANDERO
            </h1>
            <div className="h-1 w-24 bg-orange-500 mx-auto rounded-full" />
          </div>
          
          <p className="text-slate-400 text-xl font-medium">
            Ingrese su PIN de 4 dígitos para ingresar
          </p>
          
          <div className="pt-8 w-full max-w-sm mx-auto space-y-8">
            <div className="flex justify-center gap-4">
              {[...Array(4)].map((_, i) => (
                <div 
                  key={i}
                  className={cn(
                    "w-16 h-20 rounded-2xl border-2 flex items-center justify-center text-4xl font-bold transition-all duration-300",
                    pin.length > i 
                      ? "border-orange-500 bg-orange-500/20 text-orange-400 shadow-[0_0_20px_rgba(249,115,22,0.3)] scale-110" 
                      : "border-white/10 bg-white/5 text-slate-700"
                  )}
                >
                  {pin.length > i ? "•" : ""}
                </div>
              ))}
            </div>

            {error ? (
              <div className="bg-red-500/10 border border-red-500/20 py-3 px-4 rounded-xl animate-shake">
                <p className="text-red-400 font-bold">{error}</p>
              </div>
            ) : (
                <div className="h-[50px]" /> /* Spacer to keep layout stable */
            )}
          </div>
        </div>
      </div>

      {/* Right: Soft Restaurant Style PIN Pad */}
      <div className="w-[500px] bg-slate-900/40 backdrop-blur-3xl p-10 flex flex-col justify-center gap-8 border-l border-white/5">
        <div className="grid grid-cols-3 gap-5">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
            <button
              key={num}
              onClick={() => handleNumberClick(num)}
              className="h-24 rounded-3xl bg-white/5 border border-white/10 text-4xl font-black hover:bg-orange-500 hover:border-orange-400 transition-all active:scale-95 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]"
            >
              {num}
            </button>
          ))}
          <button
            onClick={handleDelete}
            className="h-24 rounded-3xl bg-red-500/10 border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all active:scale-95"
          >
            <Delete className="w-10 h-10" />
          </button>
          <button
            onClick={() => handleNumberClick("0")}
            className="h-24 rounded-3xl bg-white/5 border border-white/10 text-4xl font-black hover:bg-orange-500 hover:border-orange-400 transition-all active:scale-95 hover:shadow-[0_0_30px_rgba(249,115,22,0.4)]"
          >
            0
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || pin.length < 4}
            className="h-24 rounded-3xl bg-gradient-to-br from-orange-500 to-red-600 text-white text-3xl font-black shadow-xl shadow-orange-600/20 hover:from-orange-400 hover:to-red-500 disabled:opacity-30 disabled:grayscale transition-all active:scale-95"
          >
            OK
          </button>
        </div>

        <div className="mt-8 flex items-center justify-center gap-4 text-slate-500">
            <div className="h-px w-12 bg-slate-800" />
            <span className="text-xs font-black uppercase tracking-[0.3em] opacity-40">System Core v2.1</span>
            <div className="h-px w-12 bg-slate-800" />
        </div>
      </div>
    </div>
  );
}
