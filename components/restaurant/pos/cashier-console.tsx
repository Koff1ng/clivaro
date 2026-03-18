"use client";

import React, { useState, useEffect } from "react";
import { 
  CreditCard, 
  User, 
  MapPin, 
  Clock, 
  Zap, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  Receipt,
  Search
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface OpenSession {
  id: string;
  table: { name: string };
  waiter: { name: string };
  totalAmount: number;
  tipAmount: number;
  openedAt: string;
  orders: any[];
}

export const CashierBillingConsole: React.FC = () => {
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSessions(data);
    } catch (err: any) {
      toast(err.message, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000); // Polling every 30s
    return () => clearInterval(interval);
  }, []);

  const handleBill = async (sessionId: string) => {
    try {
      toast("Iniciando facturación electrónica...", "info");
      const res = await fetch(`/api/restaurant/sessions/${sessionId}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      toast("Factura emitida exitosamente en Alegra ✅", "success");
      fetchSessions();
    } catch (err: any) {
      toast(err.message, "error");
    }
  };

  if (loading) {
    return (
      <div className="h-96 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Cajero Restaurante</h1>
          <p className="text-muted-foreground">Monitoreo de cuentas abiertas y facturación rápida.</p>
        </div>
        <div className="bg-primary/10 border border-primary/20 px-4 py-2 rounded-lg">
          <p className="text-xs font-semibold text-primary uppercase tracking-wider">Sesiones Activas</p>
          <p className="text-2xl font-bold text-primary">{sessions.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {sessions.length === 0 ? (
          <div className="col-span-full py-20 text-center border-2 border-dashed rounded-2xl">
            <Receipt className="w-12 h-12 mx-auto text-muted-foreground opacity-20 mb-4" />
            <p className="text-xl font-medium text-muted-foreground">No hay cuentas abiertas en este momento.</p>
          </div>
        ) : (
          sessions.map((session) => (
            <Card key={session.id} className="overflow-hidden border-slate-200 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="bg-slate-50 border-b pb-4">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-xl">{session.table.name}</CardTitle>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <User className="w-3.5 h-3.5" />
                      {session.waiter.name}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    ABIERTA
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Subtotal</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(session.totalAmount)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-semibold text-amber-500 uppercase italic">Propina Sug.</p>
                    <p className="text-lg font-bold text-amber-500">+{formatCurrency(session.tipAmount)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {new Date(session.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div className="font-bold text-slate-700">
                    Total: {formatCurrency(session.totalAmount + session.tipAmount)}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-4 grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full">
                  <Search className="w-4 h-4 mr-2" />
                  Detalles
                </Button>
                <Button 
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-lg shadow-primary/20"
                  onClick={() => handleBill(session.id)}
                >
                  <Zap className="w-4 h-4 mr-2" />
                  Facturar
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
