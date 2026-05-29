export default function PrivacyPolicy() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-sm p-8">
        <h1 className="text-3xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-1">Last Updated: April 10, 2026</p>
        <p className="text-sm text-slate-500 mb-8">Effective Date: January 1, 2026</p>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">Introduction</h2>
          <p className="text-slate-700 leading-relaxed">
            Welcome to Poddle. We respect your privacy and are committed to protecting your personal data. This privacy policy explains how we collect, use, store, and protect your information when you use our platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">1. Information We Collect</h2>

          <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">1.1 Information You Provide</h3>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Account Information:</strong> Email address, full name, username, password (encrypted)</li>
            <li><strong>Profile Information:</strong> Bio, location, country, profile picture, skills, interests</li>
            <li><strong>Content You Create:</strong> Posts, comments, assumptions, forecasts, risks, scenarios, decision threads, challenges, messages</li>
            <li><strong>Verification Information:</strong> When you request verification, we collect additional information to verify your identity</li>
          </ul>

          <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">1.2 Information We Collect Automatically</h3>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Usage Data:</strong> How you interact with our platform, features you use, pages you visit</li>
            <li><strong>Device Information:</strong> Browser type, operating system, device identifiers</li>
            <li><strong>Analytics Data:</strong> Insight scores, contribution metrics, engagement patterns</li>
          </ul>

          <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">1.3 Information from Third Parties</h3>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Analytics Providers:</strong> Aggregated, anonymized usage data from tools like Google Analytics to understand platform performance</li>
            <li><strong>Referrals:</strong> If you joined via a referral link, we receive the referrer's identifier to attribute the referral</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">2. How We Use Your Information</h2>
          <p className="text-slate-700 leading-relaxed mb-3">We use your information to:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Provide Services:</strong> Create and manage your account, enable core features</li>
            <li><strong>Personalization:</strong> Customize your experience, show relevant content</li>
            <li><strong>Communication:</strong> Send notifications about activity on your content, system updates</li>
            <li><strong>Security:</strong> Protect against fraud, abuse, and security threats</li>
            <li><strong>Analytics:</strong> Understand usage patterns and improve our platform</li>
            <li><strong>Verification:</strong> Process verification requests for eligible users</li>
            <li><strong>Community Features:</strong> Enable decision rooms, messaging, following, and collaboration</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">3. Legal Basis for Processing (GDPR)</h2>
          <p className="text-slate-700 leading-relaxed mb-3">We process your personal data based on:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Consent:</strong> You provide explicit consent for specific processing activities</li>
            <li><strong>Contract:</strong> Processing necessary to provide services you requested</li>
            <li><strong>Legitimate Interests:</strong> Improving our services, preventing fraud, ensuring security</li>
            <li><strong>Legal Obligations:</strong> Complying with applicable laws and regulations</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">4. Data Sharing and Disclosure</h2>

          <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">4.1 Public Information</h3>
          <p className="text-slate-700 leading-relaxed mb-3">The following information is public by default:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li>Your display name, username, profile picture</li>
            <li>Public posts, comments, and assumptions</li>
            <li>Public decision room memberships</li>
            <li>Verification badge status</li>
            <li>Insight score and leaderboard position</li>
          </ul>

          <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">4.2 Private Information</h3>
          <p className="text-slate-700 leading-relaxed mb-3">The following remains private:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li>Your email address (unless you choose to display it)</li>
            <li>Private messages and conversations</li>
            <li>Private decision room content (visible only to decision room members)</li>
            <li>Your exact location (only city/country shown if you choose)</li>
          </ul>

          <h3 className="text-xl font-semibold text-slate-800 mb-3 mt-6">4.3 Third-Party Sharing</h3>
          <p className="text-slate-700 leading-relaxed mb-3">We do not sell your personal data. We may share information with:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Service Providers:</strong> Cloud hosting (Supabase), analytics tools</li>
            <li><strong>Legal Requirements:</strong> When required by law, court order, or government request</li>
            <li><strong>Business Transfers:</strong> In case of merger, acquisition, or asset sale</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">5. Data Storage and Security</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Storage Location:</strong> Your data is stored securely on Supabase servers</li>
            <li><strong>Encryption:</strong> Passwords are encrypted using industry-standard methods</li>
            <li><strong>Access Controls:</strong> Row-level security policies restrict data access</li>
            <li><strong>File Storage:</strong> Profile pictures and attachments are stored securely with access controls</li>
            <li><strong>Retention:</strong> We retain your data as long as your account is active</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">6. Your Rights</h2>
          <p className="text-slate-700 leading-relaxed mb-3">You have the right to:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Access:</strong> Request a copy of your personal data</li>
            <li><strong>Rectification:</strong> Correct inaccurate or incomplete data</li>
            <li><strong>Erasure:</strong> Request deletion of your data ("right to be forgotten")</li>
            <li><strong>Portability:</strong> Receive your data in a machine-readable format</li>
            <li><strong>Restriction:</strong> Request limited processing of your data</li>
            <li><strong>Objection:</strong> Object to processing based on legitimate interests</li>
            <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
          </ul>
          <p className="text-slate-700 leading-relaxed mt-4">
            To exercise these rights, contact us at <a href="mailto:privacy@poddle.co" className="text-blue-600 hover:underline">privacy@poddle.co</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">7. Data Retention</h2>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li><strong>Active Accounts:</strong> Data retained while your account is active</li>
            <li><strong>Deleted Accounts:</strong> Data deleted within 30 days of account deletion</li>
            <li><strong>Legal Requirements:</strong> Some data may be retained longer for legal compliance</li>
            <li><strong>Backups:</strong> Data in backups deleted according to our backup retention schedule</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">8. Children's Privacy</h2>
          <p className="text-slate-700 leading-relaxed">
            Poddle is not intended for users under 13 years of age. We do not knowingly collect information from children under 13. If you believe we have collected information from a child under 13, contact us immediately.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">9. International Data Transfers</h2>
          <p className="text-slate-700 leading-relaxed">
            Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place to protect your data in accordance with this privacy policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">10. Cookies and Tracking</h2>
          <p className="text-slate-700 leading-relaxed mb-3">We use essential cookies to:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li>Maintain your session and keep you logged in</li>
            <li>Remember your preferences</li>
            <li>Analyze usage patterns (anonymized)</li>
          </ul>
          <p className="text-slate-700 leading-relaxed mt-4">
            You can control cookies through your browser settings.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">11. Changes to This Policy</h2>
          <p className="text-slate-700 leading-relaxed">
            We may update this privacy policy from time to time. We will notify you of significant changes by email or through a prominent notice on our platform. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">12. Contact Us</h2>
          <p className="text-slate-700 leading-relaxed mb-3">For privacy-related questions or concerns:</p>
          <p className="text-slate-700 leading-relaxed">
            <strong>Email:</strong> <a href="mailto:privacy@poddle.co" className="text-blue-600 hover:underline">privacy@poddle.co</a>
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">13. GDPR-Specific Rights (EU Users)</h2>
          <p className="text-slate-700 leading-relaxed mb-3">If you are in the European Union, you have additional rights under GDPR:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li>Right to lodge a complaint with a supervisory authority</li>
            <li>Right to data portability in a structured format</li>
            <li>Right to object to automated decision-making</li>
            <li>Right to be informed about data breaches</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">14. CCPA-Specific Rights (California Users)</h2>
          <p className="text-slate-700 leading-relaxed mb-3">If you are a California resident, you have rights under CCPA:</p>
          <ul className="list-disc list-inside space-y-2 text-slate-700 ml-4">
            <li>Right to know what personal information is collected</li>
            <li>Right to know if personal information is sold or disclosed</li>
            <li>Right to opt-out of the sale of personal information (we do not sell data)</li>
            <li>Right to deletion</li>
            <li>Right to non-discrimination for exercising CCPA rights</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-2xl font-semibold text-slate-900 mb-4">15. Data Protection Officer</h2>
          <p className="text-slate-700 leading-relaxed">
            For data protection inquiries: <a href="mailto:dpo@poddle.co" className="text-blue-600 hover:underline">dpo@poddle.co</a>
          </p>
        </section>
      </div>
    </div>
  );
}
