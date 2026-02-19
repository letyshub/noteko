import { useState } from 'react';
import { cn } from '@renderer/lib/utils';

export function App() {
  const [pongResult, setPongResult] = useState<string | null>(null);

  const handlePing = async () => {
    const response = await window.electronAPI.ping();
    setPongResult(response);
  };

  return (
    <main className={cn('flex min-h-screen items-center justify-center', 'bg-background text-foreground')}>
      <div className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Hello Noteko</h1>
        <p className="mt-2 text-muted-foreground">
          React 19 + Tailwind CSS v4 + shadcn/ui
        </p>
        <button
          type="button"
          className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          onClick={handlePing}
        >
          Ping Main Process
        </button>
        {pongResult !== null && (
          <p className="mt-2 text-sm text-muted-foreground">
            Response: {pongResult}
          </p>
        )}
      </div>
    </main>
  );
}
