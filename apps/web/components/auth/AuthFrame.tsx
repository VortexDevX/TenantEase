import type { ReactNode } from "react";
import { Brand } from "@/components/shared/Brand";

export function AuthFrame({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="auth-frame">
      <aside className="auth-visual">
        <Brand href="/login" />
        <p>{caption}</p>
      </aside>
      <main className="auth-main">
        <div className="auth-form-area">
          <Brand href="/login" className="auth-mobile-brand" />
          {children}
        </div>
      </main>
    </div>
  );
}
