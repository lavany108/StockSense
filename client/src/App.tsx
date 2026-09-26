import React from 'react';

export default function App() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <div className="max-w-xl rounded-xl border border-border bg-card p-8 shadow-2xl">
        <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
          Odoo Hackathon IMS
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
          StockSense Pro
        </h1>
        <p className="mt-3 text-muted-foreground">
          Modular Inventory Management System powered by double-entry stock moves, real-time WebSocket updates, and mobile barcode scanning.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-xs font-mono text-muted-foreground">
          <span>React 18</span>
          <span>•</span>
          <span>Vite</span>
          <span>•</span>
          <span>Tailwind</span>
          <span>•</span>
          <span>shadcn/ui</span>
        </div>
      </div>
    </div>
  );
}
