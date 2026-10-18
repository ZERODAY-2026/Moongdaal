"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="wrap">
      <section className="hero">
        <h1>Something went wrong</h1>
        <p>
          The page hit an unexpected problem. Your document stays on this
          device. You can try again, or reload the page.
        </p>
        <button className="btn" onClick={reset}>
          Try again
        </button>
      </section>
    </main>
  );
}