import Link from "next/link";

export function BrandMark({ size = 30 }: { size?: number }) {
  return (
    <span className="brand-mark" style={{ width: size, height: size }} aria-hidden="true">
      <span className="brand-bar brand-bar-a" />
      <span className="brand-bar brand-bar-b" />
      <span className="brand-bar brand-bar-c" />
      <span className="brand-dot" />
    </span>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/" className="brand" aria-label="Cadence home">
      <BrandMark />
      <span className="brand-type">
        <span className="brand-name">Cadence</span>
        {!compact ? <span className="brand-sub">English, in context</span> : null}
      </span>
    </Link>
  );
}
