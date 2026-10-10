import Link from "next/link";

import { Button } from "~/components/ui/button";
import { Eyebrow } from "~/components/ui/section-header";

export default function NotFound() {
  return (
    <main id="main" className="bg-ink relative flex min-h-dvh items-center justify-center overflow-hidden px-6">
      <div className="relative flex flex-col items-start gap-6">
        <Eyebrow>Page not found</Eyebrow>
        <h1 className="font-display text-display-lg font-bold tracking-tight">Nothing parked here.</h1>
        <p className="text-bone/60">That address is not one of ours.</p>
        <div className="flex flex-wrap gap-3">
          <Button href="/">Back to the home page</Button>
          <Button href="/services" variant="outline">
            See the services
          </Button>
        </div>
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
