export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  // Wrapper used to scope the marketing CSS so it doesn't affect the app UI.
  return (
    <div className="marketing w-screen relative left-1/2 -translate-x-1/2">
      {children}
    </div>
  );
}

