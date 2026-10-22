import { Link } from 'react-router-dom';

// Shown for any URL no route matches, instead of React Router's bare
// "Unexpected Application Error" screen.
export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#fffcf7] text-[#2a190f]">
      <header className="border-b border-[#e9dfd2]">
        <div className="mx-auto flex max-w-6xl items-center px-6 py-5 md:px-10">
          <Link to="/" className="text-xl font-bold tracking-tight text-[#2a190f]">
            UniLogs<span className="text-[#a36d43]">.</span>
          </Link>
        </div>
      </header>

      <section className="flex flex-1 items-center px-6 py-16 md:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <p className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-[#a36d43]">
            Error 404
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight md:text-6xl">
            This page isn&apos;t in the logbook.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-[#725b49] md:text-lg md:leading-8">
            The link may be mistyped, or the page may have moved. Check the address, or head back to
            somewhere familiar.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              to="/"
              className="rounded-xl bg-[#1c0d06] px-5 py-3 text-sm font-medium text-[#f5ebe0] transition-opacity hover:opacity-90"
            >
              Back to home
            </Link>
            <Link
              to="/dashboard"
              className="rounded-xl border border-[#e9dfd2] px-5 py-3 text-sm font-medium text-[#2a190f] transition hover:bg-[#f7f0e6]"
            >
              Go to dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#e9dfd2] px-6 py-6 md:px-10">
        <div className="mx-auto max-w-6xl text-xs text-[#96775e]">
          © 2026 UniLogs · Code of Duty
        </div>
      </footer>
    </main>
  );
}
