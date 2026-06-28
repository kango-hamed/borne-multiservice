export default function FlowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-neutral-light">
      <main className="flex-1 flex flex-col overflow-y-auto pb-6">
        {children}
      </main>
    </div>
  );
}
