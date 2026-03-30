export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0b1020] text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-12">
        <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
        <p className="mt-2 text-sm text-slate-300">
          The page you’re looking for doesn’t exist, or you may not have access.
        </p>
        <div className="mt-6">
          <a
            href="/"
            className="inline-flex rounded-md bg-white/10 px-4 py-2 text-sm font-medium hover:bg-white/15"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

