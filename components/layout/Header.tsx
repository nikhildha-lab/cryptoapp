"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EngineStatusBadge } from "@/components/dashboard/EngineStatusBadge";
import { FearAndGreedIndex } from "@/components/dashboard/FearAndGreedIndex";

const NAV_LINKS = [
  { href: "/", label: "Cockpit" },
  { href: "/terminal", label: "Terminal" },
  { href: "/strategies", label: "Strategy Lab" },
  { href: "/performance", label: "Performance" },
  { href: "/deploy", label: "Deploy" },
  { href: "/logs", label: "Logs" },
  { href: "/settings", label: "Settings" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2 font-black text-2xl text-primary tracking-tighter">
            <span>🚀 CryptoAlgo</span>
          </Link>
          <nav className="flex items-center gap-8 text-base font-medium">
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`transition-colors hover:text-primary ${isActive
                    ? "text-primary font-bold decoration-primary decoration-2 underline-offset-4"
                    : "text-muted-foreground"
                    }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <FearAndGreedIndex compact={true} />
          <EngineStatusBadge />
          <Avatar className="h-8 w-8">
            <AvatarImage src="/avatar.png" alt="User" />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </div>
      </div>
    </header>
  );
}
