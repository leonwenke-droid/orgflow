import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="mx-auto max-w-lg p-10 text-center">
      <div className="mb-4 text-4xl">404</div>
      <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Page not found</h1>
      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
        The page you requested does not exist.
      </p>
      <Link href="/" className="btn-secondary mt-4 inline-flex">
        Go to home
      </Link>
    </div>
  );
}

