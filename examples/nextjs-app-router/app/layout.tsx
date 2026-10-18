import Link from "next/link";
import type { ReactNode } from "react";
import { Providers } from "./providers";

export const metadata = { title: "didban · Next.js App Router example" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <nav>
            <Link href="/">Home</Link> <Link href="/pricing">Pricing</Link>{" "}
            <Link href="/missing">Broken link</Link>
          </nav>
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
