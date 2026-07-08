export default function Subprocessors() {
  const rows = [
    {
      name: 'Supabase',
      purpose: 'Database hosting, backend infrastructure, and authentication',
      location: 'United States (AWS us-east-1, North Virginia)',
    },
    {
      name: 'Stripe',
      purpose: 'Payment processing',
      location: 'United States',
    },
    {
      name: 'PostHog',
      purpose: 'Product analytics',
      location: 'European Union (EU Cloud)',
    },
    {
      name: 'OpenAI',
      purpose: 'AI language model inference powering War Room agents and synthesis',
      location: 'United States',
    },
    {
      name: 'Sentry',
      purpose: 'Error monitoring and session replay',
      location: 'United States (default)',
    },
    {
      name: 'Resend',
      purpose: 'Transactional email delivery',
      location: 'United States (default)',
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-12">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-10 mb-6">
          <div className="mb-6">
            <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full mb-4">Legal</span>
            <h1 className="text-4xl font-bold text-slate-900 mb-2 tracking-tight">Sub-processors</h1>
            <p className="text-slate-500 text-sm">Last Updated: <strong>8 July 2026</strong></p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800 leading-relaxed">
            Poddle uses a limited number of trusted third-party sub-processors to help us deliver our services. This page lists the sub-processors that may process customer data on our behalf, in accordance with our{' '}
            <a href="#privacy" className="underline font-medium">Privacy Policy</a> and Data Processing practices.
          </div>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Sub-processor</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Purpose</th>
                  <th className="text-left px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider w-1/4">Location</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="px-6 py-4 text-slate-600 leading-relaxed">{row.purpose}</td>
                    <td className="px-6 py-4 text-slate-500">{row.location}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Closing */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8">
          <p className="text-slate-600 text-sm leading-relaxed">
            We regularly review our sub-processors to ensure they meet appropriate standards of security and data protection. If we add or change a sub-processor, we will update this page. If you have questions about our use of sub-processors, contact us at{' '}
            <a href="mailto:support@poddleme.com" className="text-blue-600 hover:text-blue-700 font-medium transition-colors">
              support@poddleme.com
            </a>.
          </p>
        </div>
      </div>
    </div>
  );
}
