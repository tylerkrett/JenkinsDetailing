import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="bg-ink relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div className="relative flex flex-col items-start gap-6">
        <h1 className="font-display text-display-lg font-bold tracking-tight">Nothing parked here.</h1>
        <p className="text-bone/60">That address is not one of ours.</p>
        <Link
          href="/services"
          className="text-bone/80 decoration-accent/60 hover:text-bone hover:decoration-accent underline underline-offset-[6px] transition-colors duration-200"
        >
          See the services
        </Link>
        <Link
          href="/play"
          className="text-bone/60 decoration-accent/40 hover:text-bone hover:decoration-accent underline underline-offset-[6px] transition-colors duration-200"
        >
          Play Bucket Run instead
        </Link>
      </div>
    </main>
  );
}
