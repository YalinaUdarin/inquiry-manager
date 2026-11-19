// Placeholder: the inquiry detail page is built in Phase 10.
export default async function InquiryDetailPage({ params }) {
  const { id } = await params;
  return (
    <div>
      <h1 className="text-xl font-semibold">Inquiry</h1>
      <p className="mt-2 font-mono text-sm text-slate-600">{id}</p>
    </div>
  );
}
