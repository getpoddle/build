export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <button
          onClick={() => window.history.back()}
          className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
          Back
        </button>

        {/* Header */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-10 mb-6">
          <div className="mb-6">
            <span className="inline-block bg-blue-50 text-blue-700 text-xs font-semibold tracking-wide uppercase px-3 py-1 rounded-full mb-4">Legal</span>
            <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 mb-2 tracking-tight">Privacy Policy</h1>
            <p className="text-slate-500 text-sm">
              Last Updated: <strong>9 October 2026</strong> &nbsp;·&nbsp; Effective Date: <strong>9 October 2026</strong>
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 text-sm text-blue-800 leading-relaxed">
            <strong>Summary:</strong> Poddle is an AI-powered decision governance platform. We collect only what we need to run the platform, we never sell your data, and we give you control to access, correct, or delete your personal information. Questions? Email us at <a href="mailto:legal@poddleme.com" className="underline font-medium">legal@poddleme.com</a>.
          </div>
        </div>

        <div className="space-y-6">

          {/* 1. Who We Are */}
          <Section id="who-we-are" title="1. Who We Are">
            <p>
              Poddle ("Poddle", "we", "us", "our") is an AI-powered decision governance platform that helps individuals and organizations analyze consequential decisions, evaluate supporting evidence, document reasoning, and maintain decision records. The platform includes a Seven-Agent War Room, Evidence IDs and verification, Decision Trail records, Decision Snapshots, workspace collaboration, and AI-powered decision analysis.
            </p>
            <p className="mt-3">
              For the purposes of the EU General Data Protection Regulation (2016/679) ("GDPR") and applicable national data-protection laws, Poddle's role depends on the processing activity:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>As a data controller:</strong> For processing activities where Poddle determines the purposes and means of processing — including account registration, account administration, billing, customer communications, platform security, and product analytics.</li>
              <li><strong>As a data processor:</strong> Where business customers determine the purposes and means of processing personal information submitted to organizational workspaces — including organizational decision records, supporting evidence, uploaded documents, workspace conversations, Decision Trail records, and Decision Snapshots. In these cases, the business customer that owns the workspace is the data controller and Poddle acts as a processor on their behalf.</li>
            </ul>
            <p className="mt-3">
              The actual role for a given activity depends on the applicable agreement and the nature of the data. Poddle is operated by Poddle, Inc., a Delaware corporation.
            </p>
            <ContactBlock />
          </Section>

          {/* 2. Information We Collect */}
          <Section id="data-we-collect" title="2. Information We Collect">
            <p>
              We process information that you provide directly, information generated through your use of the platform, and certain technical information collected automatically. Organizational users control the business information they choose to submit, subject to applicable agreements with their organization.
            </p>

            <SubHeading>2.1 Information you provide directly</SubHeading>
            <Table rows={[
              ["Account registration", "Email address, password (stored as a bcrypt hash — we never see the plaintext)"],
              ["Profile information", "Display name, username, profile picture, bio, location (city/country only), LinkedIn URL"],
              ["Organization and workspace information", "Workspace name, description, member list, organizational structure"],
              ["Decision questions and descriptions", "The strategic questions, decision topics, and context you submit for analysis"],
              ["Evidence and supporting documents", "Assumptions, reported facts, evidence submissions, source references, supporting documents and references you upload"],
              ["War Room inputs", "Decision signals, risks, scenarios, and other inputs submitted to War Room sessions"],
              ["Workspace messages", "Team chat messages, AI chat conversations, and collaboration content within workspaces"],
              ["Payment information", "Billing name, last-four card digits, and subscription status (full card details are processed exclusively by Stripe — we never store raw card data)"],
              ["Contact form submissions", "Name, email, and message body when you contact us via the Contact page"],
              ["Invite codes and referrals", "Your unique referral code and codes you share or receive"],
            ]} />

            <SubHeading>2.2 Information generated through use of the platform</SubHeading>
            <Table rows={[
              ["AI-generated analysis", "War Room recommendations, agent responses, syntheses, challenge replies, and other AI-generated content produced in response to your inputs"],
              ["Evidence verification records", "Verification status, authorized evidence reviewer identity, verification timestamps, verification history, and evidence revisions"],
              ["Evidence IDs and versioning", "Evidence classification, source references, historical evidence versions, and provenance metadata"],
              ["Decision Trail events", "Records of decision-related activities including decision events, user actions, and timestamps"],
              ["Decision snapshots", "Point-in-time captures of decision state for historical comparison and governance"],
              ["Decision ownership records", "Records identifying users who approved, owned, or contributed to decisions"],
              ["War Room conversations", "Full conversation transcripts and agent interactions from War Room sessions"],
            ]} />

            <SubHeading>2.3 Information collected automatically</SubHeading>
            <Table rows={[
              ["Usage analytics", "Pages visited, features clicked, session duration, navigation paths (collected via PostHog — EU-hosted)"],
              ["Error and performance data", "Browser errors, crash reports, and performance traces (collected via Sentry)"],
              ["Device and browser signals", "Browser type and version, operating system, approximate time zone, screen resolution"],
              ["Authentication tokens", "JWTs and session tokens managed by Supabase Auth"],
              ["IP address", "Captured transiently for rate-limiting and fraud detection; not stored long-term in user profiles"],
            ]} />

            <SubHeading>2.4 Information we do NOT collect</SubHeading>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Full card numbers or CVV codes (handled entirely by Stripe)</li>
              <li>Government-issued ID documents (unless you submit them voluntarily for verification)</li>
              <li>Precise geolocation (we collect only the city/country you choose to enter)</li>
            </ul>
            <p className="mt-3">
              Poddle is not designed to process sensitive special-category personal data (health records, religious beliefs, political opinions, racial origin, biometric data, or other categories protected under GDPR Article 9). If you inadvertently submit such data, contact us and we will delete it.
            </p>
          </Section>

          {/* 3. How Information Is Used */}
          <Section id="how-we-use" title="3. How We Use Your Information">
            <p>We process your information for the following purposes:</p>
            <Table rows={[
              ["Service delivery", "Authenticating your account; rendering your feed, profile, and workspace; delivering notifications; providing AI-powered decision analysis"],
              ["Evidence and verification", "Generating and maintaining Evidence IDs; recording evidence verification; preserving evidence version history; managing authorized evidence reviewers"],
              ["Decision governance", "Maintaining Decision Trail records; creating Decision Snapshots; recording decision ownership and approvals; supporting accountability and traceability"],
              ["AI-powered analysis", "Evaluating assumptions and evidence; generating War Room recommendations and agent responses; producing decision syntheses and reports"],
              ["Workspace collaboration", "Supporting private workspace access, team chat, file sharing, and collaborative decision-making among authorized members"],
              ["Account security", "Rate-limiting, abuse detection, bot prevention, admin moderation, preventing unauthorized access"],
              ["Customer support", "Responding to support requests, investigating issues, and resolving disputes"],
              ["Subscriptions and billing", "Processing subscription payments, managing billing portals, handling checkout sessions"],
              ["Platform reliability", "Error tracking, performance monitoring, and product analytics to improve platform stability"],
              ["Legal compliance", "Responding to valid legal requests; enforcing our Terms of Service; retaining financial records as required by law"],
            ]} />
            <p className="mt-3">
              We do not use your personal data to train AI models. AI-generated outputs are produced by sending your content to external AI providers as described in Section 4.
            </p>
          </Section>

          {/* 4. AI Processing and Third Parties */}
          <Section id="ai-processing" title="4. AI Processing and External Providers">
            <p>
              Poddle uses external AI service providers, including <strong>OpenAI</strong>, to provide AI-powered functionality. Depending on the feature used, information transmitted for processing may include:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li>Decision questions and descriptions</li>
              <li>Assumptions and reported facts</li>
              <li>War Room conversation history and context</li>
              <li>Workspace decision content and team chat messages</li>
              <li>Relevant contextual information (such as workspace topic, stated goals, expertise level)</li>
              <li>Audio submitted for transcription (processed by OpenAI's Whisper API)</li>
            </ul>
            <p className="mt-3">
              Only information required for the relevant operation should be transmitted. Our AI-related features include:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>Seven-Agent War Room:</strong> Your decision inputs, signals, risks, and conversation history are sent to OpenAI to generate multi-agent analysis and recommendations. The full conversation transcript is transmitted for context.</li>
              <li><strong>Workspace AI chat:</strong> Your messages and workspace context are sent to OpenAI under your explicit request. Outputs are stored in your workspace.</li>
              <li><strong>Workspace synthesis:</strong> Workspace messages, decision content, and War Room session data are sent to OpenAI to generate decision syntheses and reports.</li>
              <li><strong>Audio transcription:</strong> Audio inputs are forwarded to OpenAI Whisper for transcription. The text transcript is stored for the purpose for which you submitted it.</li>
              <li><strong>AI agents and discussions:</strong> AI agents generate posts, responses, and analyses by processing platform content as context.</li>
            </ul>
            <p className="mt-4">
              External processing is subject to applicable provider agreements, privacy terms, and configurations. Poddle's own data retention is separate from retention by external processors. We do not claim zero retention by OpenAI, and we do not represent that customer data is never used for AI model training unless verified against the applicable API terms and settings. OpenAI's API terms and data handling practices are governed by their published policies and any applicable enterprise agreement.
            </p>
            <p className="mt-3">
              AI requests and responses are not logged with personal information in our application logs. API keys are managed server-side and are never exposed to client-side code.
            </p>
            <p className="mt-3">
              <strong>Important:</strong> Data sent to external AI providers is subject to those providers' own retention and processing policies. Poddle cannot guarantee deletion of data held by external processors after it has been transmitted. Organizations requiring specific data processing agreements with AI providers should contact us to discuss available options.
            </p>
          </Section>

          {/* 5. Organizational Data Security */}
          <Section id="security" title="5. Organizational Data Security">
            <p>
              Poddle implements technical and organizational safeguards designed to protect customer information. These measures include:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>Authenticated account access:</strong> All access requires authentication through Supabase Auth with email and password credentials.</li>
              <li><strong>Workspace membership controls:</strong> Access to private workspace information is restricted according to authentication, workspace membership, and applicable permissions. Workspace owners and admins manage membership and roles.</li>
              <li><strong>Role-based permissions:</strong> Workspace roles (owner, admin, member) determine what actions a user can perform within a workspace.</li>
              <li><strong>Database Row Level Security (RLS):</strong> PostgreSQL RLS policies enforce workspace isolation at the database level for private workspaces. Users can only access data in workspaces they belong to. These policies have been verified through authenticated database testing.</li>
              <li><strong>Server-side authorization:</strong> Edge functions verify user identity from JWT tokens and check workspace membership before accessing or modifying data.</li>
              <li><strong>Restricted administrative operations:</strong> Admin functions verify admin status through the database and cannot be executed by non-admin users. Privileged RPC functions raise authorization errors for unauthorized callers.</li>
              <li><strong>Protected storage access:</strong> File storage policies enforce that users can only upload, download, modify, or delete files in their own designated storage folders.</li>
              <li><strong>Server-side API credential management:</strong> API keys for external services (OpenAI, Stripe, Resend) are stored as server-side environment variables and are never exposed to client-side code.</li>
              <li><strong>Encryption in transit:</strong> Data is transmitted over TLS during transmission.</li>
              <li><strong>Encryption at rest:</strong> Database volumes are encrypted by Supabase infrastructure.</li>
              <li><strong>Password hashing:</strong> Passwords are stored as bcrypt hashes with per-user salts. We cannot read your password.</li>
              <li><strong>Rate limiting:</strong> API and authentication endpoints are rate-limited to prevent brute-force attacks.</li>
            </ul>
            <p className="mt-4">
              Access to private workspace information is restricted according to authentication, workspace membership, and applicable permissions. A user who is not a member of a private workspace cannot read, modify, or delete that workspace's decision claims, evidence, verification history, evidence versions, decision events, or decision snapshots. This has been verified through authenticated database testing using simulated user sessions.
            </p>
            <p className="mt-3">
              Information intentionally made public or shared may be accessible to other users according to the relevant visibility settings. Some workspaces may be intentionally public or shared. Public workspaces are visible to authenticated users and, in certain configurations, to anonymous visitors. Workspace owners choose whether their workspace is public or private. The security controls described above apply to private workspace data.
            </p>
            <p className="mt-3">
              <strong>No internet-based service can guarantee absolute security.</strong> Despite our safeguards, no system is completely secure. We regularly review and improve our security posture. In the event of a personal data breach that poses a risk to your rights and freedoms, we will notify the relevant supervisory authority and affected individuals as required by applicable law.
            </p>
          </Section>

          {/* 6. Evidence IDs and Verification */}
          <Section id="evidence-ids" title="6. Evidence IDs and Verification">
            <p>
              Poddle processes and maintains evidence-related information to support decision governance. This includes:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>Evidence classification:</strong> Each piece of evidence is classified (e.g., assumption, reported fact, verified fact) to distinguish its type and strength.</li>
              <li><strong>Source references:</strong> Evidence may include source references and supporting documentation links provided by the user.</li>
              <li><strong>Supporting documentation:</strong> Users may upload supporting documents to substantiate evidence claims.</li>
              <li><strong>Verification status:</strong> Evidence may be marked as unverified, under review, or verified based on actions by authorized evidence reviewers.</li>
              <li><strong>Authorized evidence reviewers:</strong> Workspace admins and owners can designate evidence reviewers who are authorized to perform verification actions.</li>
              <li><strong>Verification timestamps:</strong> Each verification action is recorded with a timestamp.</li>
              <li><strong>Verification history:</strong> A complete history of verification actions is maintained, including who performed each action and when.</li>
              <li><strong>Evidence revisions:</strong> Historical versions of evidence are preserved when evidence is modified, enabling comparison and audit.</li>
            </ul>
            <p className="mt-4">
              Evidence verification records may identify the user who performed a verification action. Verification history is protected by database policies that prevent unauthorized modification — only workspace members can read verification history, and direct INSERT, UPDATE, and DELETE operations are denied at the database policy level for all users.
            </p>
            <p className="mt-3">
              <strong>Important:</strong> A "Human Verified" designation represents a recorded human verification action within the platform. It does not constitute an independent guarantee that the underlying information is accurate, complete, or truthful. Users should independently evaluate the reliability of evidence regardless of its verification status.
            </p>
          </Section>

          {/* 7. Decision Trail and Historical Records */}
          <Section id="decision-trail" title="7. Decision Trail and Historical Records">
            <p>
              Poddle maintains records of decision-related activities to support accountability, traceability, collaboration, historical comparison, and decision governance. These records may include:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li>Decision events (creation, modification, resolution)</li>
              <li>Evidence revisions and version history</li>
              <li>Verification history and reviewer actions</li>
              <li>Decision snapshots capturing point-in-time decision state</li>
              <li>User actions and timestamps</li>
              <li>Decision ownership information (who approved or owns a decision)</li>
            </ul>
            <p className="mt-3">
              Historical records are retained as part of the decision governance service. Decision snapshots and verification history are protected by database policies that deny direct modification (INSERT, UPDATE, DELETE) for all users, ensuring that historical records cannot be altered through standard database operations.
            </p>
            <p className="mt-3">
              We do not describe these records as absolutely immutable or tamper-proof. While database policies prevent modification through normal application access, database administrators with elevated privileges could theoretically alter records. Organizations with specific audit trail requirements should discuss available options with us.
            </p>
            <p className="mt-3">
              Retention and deletion of historical records is handled in accordance with Section 9 (Data Retention and Deletion). When a workspace is deleted, associated decision records are removed through cascading database relationships.
            </p>
          </Section>

          {/* 8. Data Storage */}
          <Section id="data-storage" title="8. Data Storage">
            <p>
              Poddle uses <strong>Supabase</strong> infrastructure for application data storage and authentication. Supabase provides:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>PostgreSQL database storage:</strong> All application data, including user profiles, workspace content, decision records, evidence, and AI-generated outputs, is stored in a PostgreSQL database with Row Level Security enabled on all tables.</li>
              <li><strong>Workspace access controls:</strong> Database-level RLS policies enforce that users can only access data within workspaces they are members of.</li>
              <li><strong>File storage:</strong> User-uploaded files (profile pictures, supporting documents, post attachments) are stored in Supabase Storage buckets with access policies that restrict operations to the file owner.</li>
              <li><strong>Authentication services:</strong> User authentication, session management, and JWT issuance are handled by Supabase Auth.</li>
              <li><strong>Application security controls:</strong> SECURITY DEFINER functions with pinned search paths, restricted execution grants, and deny-by-default policies on sensitive tables.</li>
            </ul>
            <p className="mt-3">
              The primary database is hosted by Supabase on AWS in Central EU (Frankfurt), region <code className="text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">eu-central-1</code>, Germany. All application data — including user profiles, workspace content, decision records, and AI-generated outputs — is stored in this region.
            </p>
            <p className="mt-3">
              This database hosting location is distinct from the processing locations of external service providers, some of whom operate in the United States. See Section 10 (International Data Processing) and Section 12 (Service Providers) for details on where each provider processes data.
            </p>
          </Section>

          {/* 9. Data Retention and Deletion */}
          <Section id="retention" title="9. Data Retention and Deletion">
            <SubHeading>9.1 Account deletion process</SubHeading>
            <p>
              You may request account deletion from your profile settings at any time. When you submit a deletion request:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li>Your account is immediately deactivated and you are signed out.</li>
              <li>A <strong>7-day grace period</strong> begins. During this period, your data remains in the database but your account is inaccessible.</li>
              <li>If you sign in during the 7-day grace period, your deletion request is cancelled and your account is fully restored.</li>
              <li>After 7 days, a scheduled cleanup process permanently deletes your account and associated data.</li>
            </ul>
            <p className="mt-3">
              The permanent deletion cascades across all user-related tables, including profiles, workspace memberships, workspace messages, posts, comments, notifications, Stripe customer records, AI usage records, conversation memory, and authentication entries.
            </p>
            <p className="mt-3">
              <strong>Important:</strong> Deleting your individual account does not automatically delete every organizational record associated with you. The following distinctions apply:
            </p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>Individual account information</strong> (profile, credentials, personal preferences) is deleted.</li>
              <li><strong>Organizational information</strong> within workspaces owned by others is controlled by the workspace owner, not by your individual account deletion.</li>
              <li><strong>Shared workspace records</strong> — including your contributions to decision events, evidence claims, and decision trails in workspaces owned by others — may be retained as part of those workspaces' governance records. Your messages in shared workspaces are deleted, but references to your contributions in audit trails and decision history may persist.</li>
              <li><strong>Decision snapshots and evidence records</strong> in workspaces you own are removed when the workspace is deleted. In workspaces owned by others, these records are retained by the workspace owner.</li>
              <li><strong>Pseudonymized benchmark data</strong> (decision benchmarks keyed by a hashed identifier) is structured so that it cannot be attributed back to you after deletion, but the records themselves may persist in aggregate form.</li>
              <li><strong>Database backups</strong> may contain deleted data for up to 30 days before being purged.</li>
              <li><strong>External AI provider records</strong> are subject to those providers' own retention practices and cannot be guaranteed to be deleted immediately.</li>
            </ul>

            <SubHeading>9.2 What is deleted immediately</SubHeading>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Account access and authentication credentials</li>
              <li>Profile information and preferences</li>
              <li>Workspace memberships</li>
              <li>AI conversation memory and usage records</li>
            </ul>

            <SubHeading>9.3 What is deleted through cascading relationships</SubHeading>
            <ul className="list-disc ml-6 space-y-1 text-slate-700">
              <li>Workspace messages and team chat contributions</li>
              <li>Posts, comments, and content created by the user</li>
              <li>Notifications associated with the user</li>
              <li>Stripe customer and subscription records</li>
              <li>Workspace content owned solely by the deleted user</li>
            </ul>

            <SubHeading>9.4 What may be retained</SubHeading>
            <ul className="list-disc ml-6 space-y-2 text-slate-700">
              <li><strong>Database backups:</strong> Deleted data may remain temporarily in database backups for up to 30 days before being purged.</li>
              <li><strong>Financial records:</strong> Billing and tax records may be retained for up to 7 years to meet legal and tax obligations.</li>
              <li><strong>Shared organizational records:</strong> If you contributed to a workspace owned by another user or organization, your contributions to that workspace may be retained by the workspace owner. Deleting your account does not necessarily delete content you submitted to workspaces owned by others.</li>
              <li><strong>Decision trail and audit records:</strong> Decision events, evidence claims, and decision snapshots in workspaces owned by others are retained as part of those workspaces' governance records. Your messages in shared workspaces are deleted, but references to your contributions in audit trails may persist.</li>
              <li><strong>Pseudonymized benchmark data:</strong> Decision benchmark contributions stored under a hashed identifier may persist in aggregate, non-attributable form.</li>
              <li><strong>External provider records:</strong> Data previously transmitted to external AI providers (OpenAI) is subject to those providers' own retention practices. Poddle cannot guarantee immediate deletion of data held by external processors.</li>
              <li><strong>Legal holds:</strong> Certain records may be retained where legally required or otherwise permitted.</li>
            </ul>

            <SubHeading>9.5 Workspace deletion</SubHeading>
            <p>
              When a workspace is deleted by its owner, all associated data — including decision claims, evidence, verification history, evidence versions, decision events, decision snapshots, messages, and synthesis outputs — is removed through cascading database relationships. Workspace deletion requires owner or admin authorization.
            </p>

            <SubHeading>9.6 Other retention periods</SubHeading>
            <Table rows={[
              ["Error logs (Sentry)", "Rolling 90-day retention"],
              ["Analytics events (PostHog)", "Rolling 12-month retention"],
              ["Email logs (Resend)", "Rolling 30-day retention"],
              ["Database backups", "Retained for up to 30 days, then securely deleted"],
              ["Contact form messages", "Retained for 2 years or until resolved"],
              ["Account deletion grace period", "7 days from deletion request"],
            ]} />
          </Section>

          {/* 10. International Data Processing */}
          <Section id="international" title="10. International Data Processing">
            <p>
              Poddle serves users internationally. Your primary application data is stored in the European Union — our Supabase database is hosted in Frankfurt, Germany (AWS <code className="text-[13px] bg-slate-100 px-1.5 py-0.5 rounded">eu-central-1</code>). However, certain external service providers process data in other jurisdictions, including the United States. In particular, OpenAI (AI content generation, War Room analysis, workspace synthesis, and audio transcription) processes data in the United States, and Stripe (payment processing) and Sentry (error tracking) also operate in the United States. The full list of service providers and their processing locations is in Section 12.
            </p>
            <p className="mt-3">
              Where personal data is transferred outside the European Economic Area (EEA), we rely on appropriate transfer safeguards where available.
            </p>
            <p className="mt-3">
              You may request information about applicable transfer safeguards by emailing <a href="mailto:legal@poddleme.com" className="text-blue-600 hover:underline">legal@poddleme.com</a>.
            </p>
          </Section>

          {/* 11. Your Privacy Rights */}
          <Section id="your-rights" title="11. Your Privacy Rights">
            <p>
              Depending on your jurisdiction, you may have the following rights regarding your personal data. To exercise any right, email <a href="mailto:legal@poddleme.com" className="text-blue-600 hover:underline font-medium">legal@poddleme.com</a>.
            </p>

            <div className="mt-5 grid grid-cols-1 gap-3">
              {[
                ["Access", "Receive a copy of the personal data we hold about you and information about how we process it."],
                ["Correction", "Ask us to correct inaccurate or incomplete data. You can also update most profile data directly in settings."],
                ["Deletion", "Request deletion of your personal data. You can initiate account deletion directly from your profile settings, subject to the 7-day grace period described in Section 9."],
                ["Objection", "Object to processing based on legitimate interests. We will cease processing unless we can demonstrate compelling legitimate grounds."],
                ["Restriction", "Ask us to restrict processing while we verify a dispute about accuracy or while an objection is pending."],
                ["Data portability", "Receive your data in a structured, machine-readable format where technically feasible and where the right applies."],
                ["Withdraw consent", "Where processing is based on consent, you may withdraw it at any time without affecting the lawfulness of prior processing."],
                ["Lodge a complaint", "File a complaint with your local supervisory authority. We would appreciate the chance to address your concerns first."],
              ].map(([right, desc]) => (
                <div key={right} className="flex gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{right}</p>
                    <p className="text-slate-600 text-sm mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <p className="mt-4">
              <strong>Individual vs. organizational information:</strong> These rights apply to your personal data as an individual. Organizational information — such as workspace content, decision records, and evidence submitted within a workspace — is controlled by the business customer that owns the workspace. Requests to access, modify, or delete organizational information should be directed to the workspace owner or administrator. Poddle will cooperate with both individuals and organizations to fulfill applicable requests.
            </p>
            <p className="mt-3 text-sm text-slate-500">
              We do not charge a fee for exercising your rights. We may ask you to verify your identity before processing a request. Response times depend on applicable law in your jurisdiction.
            </p>
          </Section>

          {/* 12. Service Providers */}
          <Section id="service-providers" title="12. Service Providers">
            <p>
              We share data with the following service providers who process data on our behalf. These providers have access to customer information only as necessary to deliver their services:
            </p>
            <Table headers={["Provider", "Purpose", "Data Processed", "Location"]} rows={[
              ["Supabase", "Database, authentication, file storage, real-time subscriptions", "All application data and content", "EU (Frankfurt, Germany — AWS eu-central-1)"],
              ["OpenAI", "AI content generation, War Room analysis, workspace synthesis, audio transcription", "Decision content, conversation history, workspace context, audio inputs", "United States"],
              ["Stripe", "Payment processing, subscription management, billing portal", "Billing details, subscription status, payment metadata", "United States"],
              ["PostHog", "Product analytics", "Usage events, anonymised identifiers", "European Union (Frankfurt)"],
              ["Sentry", "Error tracking, performance monitoring", "Error payloads, stack traces, session data", "United States"],
              ["Resend", "Transactional email delivery", "Recipient email address, email content", "United States"],
            ]} />
            <p className="mt-4">
              We do not sell, rent, or trade your personal data to any third party for marketing purposes. Service providers process data only as necessary to deliver their services under applicable agreements.
            </p>

            <SubHeading>Other disclosures</SubHeading>
            <ul className="list-disc ml-6 space-y-2 text-slate-700">
              <li><strong>Legal requirements:</strong> We may disclose data if required by law, court order, or a binding request from a competent authority. Where legally permitted, we will notify you before complying.</li>
              <li><strong>Business transfers:</strong> If Poddle is involved in a merger, acquisition, or asset sale, personal data may be transferred to the acquiring entity under the same privacy commitments. We will provide notice.</li>
              <li><strong>Safety:</strong> We may disclose data to prevent imminent physical harm or threat to life.</li>
            </ul>
          </Section>

          {/* 13. Children and Sensitive Information */}
          <Section id="children" title="13. Children and Sensitive Information">
            <p>
              Poddle is not intended for, and does not knowingly collect data from, individuals under the age of <strong>16</strong> (or the minimum digital consent age in your jurisdiction). If you believe we have inadvertently collected data from a child, contact us immediately at <a href="mailto:legal@poddleme.com" className="text-blue-600 hover:underline">legal@poddleme.com</a> and we will delete it promptly.
            </p>
            <p className="mt-3">
              Poddle is not designed to process sensitive personal information, including medical records, children's information, or sensitive special-category data as defined by GDPR Article 9. The platform is a business decision governance tool, not a healthcare or sensitive-data processing system. If your organization requires processing of regulated data types, contact us to discuss whether appropriate safeguards and contractual arrangements can be established.
            </p>
          </Section>

          {/* 14. Legal Basis (GDPR) */}
          <Section id="legal-basis" title="14. Legal Basis for Processing (GDPR Article 6)">
            <p>We rely on the following lawful bases:</p>
            <Table rows={[
              ["Contract (Art. 6(1)(b))", "Creating and managing your account; providing core platform features including AI analysis, War Room, and workspace collaboration; processing subscription payments"],
              ["Legitimate Interests (Art. 6(1)(f))", "Security monitoring, fraud prevention, error tracking, product analytics, referral attribution. We have assessed that our interests do not override your fundamental rights."],
              ["Legal Obligation (Art. 6(1)(c))", "Retaining financial records as required by law; responding to lawful data requests from authorities"],
              ["Consent (Art. 6(1)(a))", "Sending marketing emails (where required by local law); setting non-essential cookies. You may withdraw consent at any time without affecting prior processing."],
            ]} />
            <p className="mt-3 text-sm text-slate-500">
              Where we process data based on legitimate interests, you have the right to object (see Section 11). We will carry out a balancing test and cease processing unless we can demonstrate compelling legitimate grounds.
            </p>
          </Section>

          {/* 15. California Residents */}
          <Section id="california" title="15. California Residents (CCPA / CPRA)">
            <p>If you are a California resident, you have the following rights under the California Consumer Privacy Act and California Privacy Rights Act:</p>
            <ul className="list-disc ml-6 space-y-2 text-slate-700 mt-3">
              <li><strong>Know:</strong> Request disclosure of the categories and specific pieces of personal information we have collected about you</li>
              <li><strong>Delete:</strong> Request deletion of personal information (subject to certain exceptions)</li>
              <li><strong>Correct:</strong> Request correction of inaccurate personal information</li>
              <li><strong>Opt-out of sale / sharing:</strong> We do not sell or share personal information for cross-context behavioural advertising</li>
              <li><strong>Limit use of sensitive personal information:</strong> We do not process sensitive personal information beyond what is necessary to provide our services</li>
              <li><strong>Non-discrimination:</strong> We will not discriminate against you for exercising your CCPA/CPRA rights</li>
            </ul>
            <p className="mt-3">To submit a CCPA/CPRA request, email <a href="mailto:legal@poddleme.com" className="text-blue-600 hover:underline">legal@poddleme.com</a>.</p>
          </Section>

          {/* 16. AI-Specific Disclosures */}
          <Section id="ai-specific" title="16. AI-Specific Disclosures">
            <ul className="list-disc ml-6 space-y-3 text-slate-700">
              <li><strong>No automated profiling for legal effects:</strong> We do not use automated decision-making to make decisions with legal or similarly significant effects on you (GDPR Art. 22). AI agents generate analysis and recommendations, but humans make the final decisions.</li>
              <li><strong>Data minimization:</strong> We transmit information required for each AI operation. System prompts contain agent persona definitions and do not include personal information such as email addresses, user IDs, or passwords. User-authored content — including workspace messages, decision questions, uploaded document text, and self-described context (goals, industry) — is transmitted to generate relevant AI responses.</li>
              <li><strong>Model training:</strong> We do not use your personal data to train AI models. Whether external AI providers retain or use transmitted data for their own purposes is governed by their published API terms and any applicable enterprise agreements. We do not claim that OpenAI retains no data, that OpenAI always trains on customer information, or that OpenAI never trains on customer information. <span className="text-slate-500">[The specific retention and training configuration for your OpenAI account should be confirmed operationally against current API terms and settings.]</span></li>
              <li><strong>Conversation memory:</strong> AI conversation memory is stored in our database. Conversation history is retrieved from our database and included as context for subsequent AI calls. This memory is stored in our database, not with external providers — though conversation history is transmitted to external providers as part of each AI request.</li>
              <li><strong>Feedback signals:</strong> When you provide feedback on AI agent responses (thumbs up/down), that feedback signal is used to improve the quality of AI outputs on the platform.</li>
            </ul>
          </Section>

          {/* 17. Cookies */}
          <Section id="cookies" title="17. Cookies and Similar Technologies">
            <Table headers={["Cookie / Technology", "Type", "Purpose"]} rows={[
              ["supabase-auth-token", "Strictly necessary", "Maintains your authenticated session"],
              ["PostHog analytics", "Analytics", "Tracks anonymised product usage to improve the platform"],
              ["Sentry session replay", "Analytics / Error monitoring", "Captures anonymised error context to fix bugs"],
            ]} />
            <p className="mt-3">We do not use advertising or tracking cookies. You can control or delete cookies through your browser settings. Disabling strictly necessary cookies will prevent you from logging in.</p>
          </Section>

          {/* 18. Changes */}
          <Section id="changes" title="18. Changes to This Policy">
            <p>
              We may update this Privacy Policy to reflect changes in our practices, technology, or legal requirements. For material changes, we will notify you by email and by posting a prominent notice on the platform at least <strong>14 days</strong> before the change takes effect. Minor updates (grammar, clarifications) will be reflected in the "Last Updated" date above.
            </p>
            <p className="mt-3">Your continued use of the platform after the effective date constitutes acceptance of the revised policy.</p>
          </Section>

          {/* 19. Contact */}
          <Section id="contact" title="19. Privacy Contact">
            <p>For any privacy questions, rights requests, or data-protection concerns:</p>
            <div className="mt-4 bg-slate-50 rounded-xl border border-slate-100 p-5">
              <p className="font-semibold text-slate-900">Poddle, Inc.</p>
              <p className="text-slate-700 mt-1">Email: <a href="mailto:legal@poddleme.com" className="text-blue-600 hover:underline font-medium">legal@poddleme.com</a></p>
              <p className="text-slate-500 text-sm mt-2">We aim to respond to all requests within 5 business days and to resolve them within 30 days.</p>
            </div>
            <p className="mt-4 text-sm text-slate-600">
              If you are not satisfied with our response, you have the right to lodge a complaint with your local supervisory authority. For UK residents: <a href="https://ico.org.uk" className="text-blue-600 hover:underline">ico.org.uk</a>. For EU residents, find your authority at <a href="https://edpb.europa.eu/about-edpb/about-edpb/members_en" className="text-blue-600 hover:underline">edpb.europa.eu</a>.
            </p>
          </Section>

        </div>
      </div>
    </div>
  );
}

/* ── Shared layout helpers ── */

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 sm:p-8">
      <h2 className="text-lg sm:text-xl font-bold text-slate-900 mb-4 sm:mb-5 pb-3 border-b border-slate-100">{title}</h2>
      <div className="text-slate-700 leading-relaxed text-[14px] sm:text-[15px]">{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-900 mt-6 mb-3">{children}</h3>;
}

function ContactBlock() {
  return (
    <div className="mt-4 flex flex-col gap-1 text-sm text-slate-600">
      <span><strong>Email:</strong> <a href="mailto:legal@poddleme.com" className="text-blue-600 hover:underline">legal@poddleme.com</a></span>
    </div>
  );
}

function Table({
  rows,
  headers,
}: {
  rows: [string, string, string?, string?][];
  headers?: [string, string, string?, string?];
}) {
  const cols = headers ? headers.filter(Boolean).length : rows[0].filter(Boolean).length;
  const headerLabels = headers ? headers.filter(Boolean) as string[] : null;

  return (
    <>
      {/* Desktop table */}
      <div className="hidden sm:block overflow-x-auto mt-4 rounded-xl border border-slate-200">
        <table className="w-full text-sm">
          {headerLabels && (
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {headerLabels.map((h) => (
                  <th key={h} className="text-left px-4 py-3 font-semibold text-slate-700">{h}</th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                {row.slice(0, cols).map((cell, ci) => (
                  <td key={ci} className="px-4 py-3 text-slate-700 align-top border-b border-slate-100 last:border-b-0">
                    {ci === 0 ? <strong className="text-slate-900">{cell}</strong> : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile stacked cards */}
      <div className="sm:hidden mt-4 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
            {row.slice(0, cols).map((cell, ci) => (
              <div key={ci}>
                {headerLabels && ci > 0 && (
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-0.5">{headerLabels[ci]}</p>
                )}
                <p className={ci === 0 ? 'font-semibold text-slate-900 text-sm' : 'text-slate-700 text-sm'}>
                  {cell}
                </p>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
