"use client";

import React, { useState, useEffect } from "react";
import { User, Clock, Zap, Loader2, Receipt, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatCurrency } from "@/lib/utils";

interface AccountLine {
  id: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  notes?: string | null;
  status: string;
}

interface OpenSession {
  id: string;
  tableNumber: string;
  zoneName: string;
  waiterName: string;
  status: string;
  openedAt: string;
  elapsedMinutes: number;
  itemsCount: number;
  subtotal: number;
  total: number;
  tipAmount: number;
  lines: AccountLine[];
}

export const CashierBillingConsole: React.FC = () => {
  const [sessions, setSessions] = useState<OpenSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<OpenSession | null>(null);
  const { toast } = useToast();

  const fetchSessions = async () => {
    try {
      const res = await fetch("/api/pos/cashier/open-accounts");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudieron cargar las cuentas abiertas");
      setSessions(Array.isArray(data.accounts) ? data.accounts : []);
    } catch (err: any) {
      toast(err.message || "Error al cargar cuentas", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    const interval = setInterval(fetchSessions, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleBill = async (sessionId: string) => {
    try {
      toast("Iniciando cierre y facturación...", "info");
      const res = await fetch(`/api/restaurant/sessions/${sessionId}/close`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo cerrar la sesión");

      toast("Cuenta cerrada y factura emitida correctamente", "success");
      setSelectedSession(null);
      await fetchSessions();
    } catch (err: any) {
      toast(err.message || "Error al facturar", "error");
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
                    <CardTitle className="text-xl">{session.tableNumber}</CardTitle>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                      <User className="w-3.5 h-3.5" />
                      {session.waiterName}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">Zona: {session.zoneName}</div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-200">
                    {session.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-end">
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-slate-400 uppercase">Subtotal</p>
                    <p className="text-2xl font-bold text-slate-900">{formatCurrency(session.subtotal)}</p>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs font-semibold text-amber-500 uppercase italic">Propina</p>
                    <p className="text-lg font-bold text-amber-500">+{formatCurrency(session.tipAmount)}</p>
                  </div>
                </div>

                <div className="pt-4 border-t flex justify-between items-center text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    {new Date(session.openedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </div>
                  <div className="font-bold text-slate-700">
                    Total: {formatCurrency(session.total + session.tipAmount)}
                  </div>
                </div>
              </CardContent>
              <CardFooter className="bg-slate-50 border-t p-4 grid grid-cols-2 gap-3">
                <Button variant="outline" className="w-full" onClick={() => setSelectedSession(session)}>
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

      <Dialog open={!!selectedSession} onOpenChange={(open) => !open && setSelectedSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Detalle de cuenta {selectedSession?.tableNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto">
            {selectedSession?.lines?.length ? (
              selectedSession.lines.map((line) => (
                <div key={line.id} className="border rounded-md p-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{line.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {line.quantity} x {formatCurrency(line.unitPrice)}
                    </p>
                    {line.notes ? <p className="text-xs mt-1 text-amber-600">Nota: {line.notes}</p> : null}
                  </div>
                  <div className="text-right">
                    <Badge variant="outline">{line.status}</Badge>
                    <p className="font-semibold mt-1">{formatCurrency(line.quantity * line.unitPrice)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No hay líneas en la cuenta.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
