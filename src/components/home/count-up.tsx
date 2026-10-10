"use client";

import { useEffect, useRef } from "react";

const NUMBER = /\d[\d,]*(?:\.\d+)?/;
const DURATION_MS = 1200;

/**
 * Counts the first number in a value up from zero when it scrolls into view, on the
 * out-quint ease. The server renders the final value, and it stays put under reduced
 * motion, without JavaScript, or when it is already on screen at load. Screen readers
 * only ever get the final value.
 */
export function CountUp({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    const match = NUMBER.exec(value);
    if (!el || !match || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (el.getBoundingClientRect().top < window.innerHeight) return;
    const raw = match[0];
    const target = Number(raw.replace(/,/g, ""));
    const decimals = raw.split(".")[1]?.length ?? 0;
    const format = new Intl.NumberFormat("en-GB", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
      useGrouping: raw.includes(","),
    });
    const show = (n: number) => {
      el.textContent = value.replace(raw, format.format(n));
    };
    show(0);
    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / DURATION_MS);
          show(target * (1 - Math.pow(1 - t, 5)));
          if (t < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      el.textContent = value;
    };
  }, [value]);

  return (
    <>
      <span className="sr-only">{value}</span>
      <span ref={ref} aria-hidden="true">
        {value}
      </span>
    </>
  );
}
