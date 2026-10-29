import { CandidateRegistration } from '@/app/lib/data';
import { CertificateListItem } from '@/app/lib/definitions';
import RegisterQr from '@/app/ui/certificates/register-qr';

function formatAmount(value: string | number | null) {
  return value === null ? 'Not recorded' : Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : 'Not recorded';
}

function examinationType(name: string): 'O/L' | 'A/L' | undefined {
  if (/ordinary|\bo\s*\/\s*l\b/i.test(name)) return 'O/L';
  if (/advanced|\ba\s*\/\s*l\b/i.test(name)) return 'A/L';
  return undefined;
}

function matchingCertificate(candidate: CandidateRegistration, certificates: CertificateListItem[]) {
  const type = examinationType(candidate.examination_name);
  return certificates.find((certificate) =>
    certificate.candidate_number === candidate.candidate_number
    && certificate.examination_year === candidate.examination_year
    && (!type || certificate.examination_type === type),
  );
}

function Detail({ label, value }: { label: string; value: string | number | null | undefined }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-800">{value || 'Not recorded'}</dd>
    </div>
  );
}

export default function CandidateRegistrations({
  candidates,
  certificates,
}: {
  candidates: CandidateRegistration[];
  certificates: CertificateListItem[];
}) {
  return (
    <section className="space-y-4 rounded-3xl bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Registered candidates</h2>
        <p className="mt-1 text-sm text-slate-500">
          {candidates.length} registration{candidates.length === 1 ? '' : 's'} shown. Expand a candidate to review their submitted details, subjects, payment, and consent.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm text-slate-700">
          <thead>
            <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-3">Candidate</th>
              <th className="px-3 py-3">Examination</th>
              <th className="px-3 py-3">Contact</th>
              <th className="px-3 py-3">Certificate</th>
              <th className="px-3 py-3">Registered</th>
              <th className="px-3 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {candidates.map((candidate) => {
              const certificate = matchingCertificate(candidate, certificates);
              return (
                <tr key={candidate.user_id} className="border-b align-top last:border-0">
                  <td className="px-3 py-4">
                    <p className="font-medium text-slate-900">{candidate.full_name}</p>
                    <p className="mt-1 font-mono text-xs">{candidate.candidate_number}</p>
                  </td>
                  <td className="px-3 py-4">
                    <p>{candidate.examination_name} ({candidate.examination_year})</p>
                    <p className="mt-1 text-xs capitalize text-slate-500">Session {candidate.examination_status}</p>
                  </td>
                  <td className="px-3 py-4">
                    <p>{candidate.email || candidate.phone_e164 || 'Not provided'}</p>
                    {candidate.email && candidate.phone_e164 && <p className="mt-1 text-xs">{candidate.phone_e164}</p>}
                  </td>
                  <td className="px-3 py-4">
                    {certificate ? (
                      <div className="space-y-2">
                        <span className={`inline-block rounded-full px-2 py-1 text-xs ${certificate.status === 'valid' ? 'bg-emerald-100 text-emerald-700' : certificate.status === 'revoked' ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                          {certificate.status === 'valid' ? 'Issued · valid' : certificate.status === 'revoked' ? 'Issued · revoked' : 'Issued · invalid'}
                        </span>
                        <p className="break-all font-mono text-xs">{certificate.serial}</p>
                        <RegisterQr id={certificate.id} serial={certificate.serial} />
                      </div>
                    ) : (
                      <span className="text-xs text-slate-500">Not issued</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-4">{formatDate(candidate.registered_at)}</td>
                  <td className="min-w-52 px-3 py-4">
                    <details>
                      <summary className="cursor-pointer font-semibold text-sky-700 hover:text-sky-900">
                        View registration
                      </summary>
                      <div className="mt-4 min-w-[min(48rem,80vw)] space-y-5 rounded-xl bg-slate-50 p-4">
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-slate-900">Candidate and examination</h3>
                          <dl className="grid gap-3 sm:grid-cols-3">
                            <Detail label="Full name" value={candidate.full_name} />
                            <Detail label="Date of birth" value={formatDate(candidate.date_of_birth)} />
                            <Detail label="Candidate number" value={candidate.candidate_number} />
                            <Detail label="Series" value={candidate.series} />
                            <Detail label="Sex" value={candidate.sex} />
                            <Detail label="Examination" value={`${candidate.examination_name} (${candidate.examination_year})`} />
                            <Detail label="Examination session status" value={candidate.examination_status} />
                            <Detail label="Certificate number entered" value={candidate.certificate_number} />
                            <Detail label="Date of issue entered" value={formatDate(candidate.date_of_issue)} />
                            <Detail label="School" value={candidate.school_name} />
                            <Detail label="Examination centre" value={`${candidate.centre_code} — ${candidate.centre_name}`} />
                            <Detail label="Centre number" value={candidate.centre_number} />
                          </dl>
                        </div>
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-slate-900">Account and contact</h3>
                          <dl className="grid gap-3 sm:grid-cols-3">
                            <Detail label="Email" value={candidate.email} />
                            <Detail label="Phone" value={candidate.phone_e164} />
                            <Detail label="Username" value={candidate.username} />
                            <Detail label="Account status" value={candidate.account_status} />
                            <Detail label="Registered on" value={formatDate(candidate.registered_at)} />
                          </dl>
                        </div>
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-slate-900">Selected subjects</h3>
                          {candidate.subjects.length ? (
                            <ul className="grid gap-2 sm:grid-cols-2">
                              {candidate.subjects.map((subject) => (
                                <li key={subject.code} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                                  <span className="font-medium">{subject.name}</span> <span className="text-slate-500">({subject.code}) · {formatAmount(subject.amount_paid)}</span>
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-sm text-slate-500">No subjects recorded.</p>}
                        </div>
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-slate-900">Payment</h3>
                          <dl className="grid gap-3 sm:grid-cols-3">
                            <Detail label="Payment status" value={candidate.payment_status} />
                            <Detail label="Payment method" value={candidate.payment_mode?.replaceAll('_', ' ')} />
                            <Detail label="Payment reference" value={candidate.payment_reference} />
                            <Detail label="Registration fee" value={formatAmount(candidate.registration_fee)} />
                            <Detail label="Franking fee" value={formatAmount(candidate.franking_fee)} />
                            <Detail label="Subjects total" value={formatAmount(candidate.subjects_total)} />
                            <Detail label="Total amount" value={formatAmount(candidate.total_amount)} />
                            <Detail label="Payment record date" value={formatDate(candidate.payment_created_at)} />
                          </dl>
                        </div>
                        <div>
                          <h3 className="mb-3 text-sm font-semibold text-slate-900">Terms and privacy consent</h3>
                          {candidate.consents.length ? (
                            <ul className="space-y-1 text-sm text-slate-700">
                              {candidate.consents.map((consent) => (
                                <li key={consent.consent_type}>
                                  {consent.consent_type === 'terms' ? 'Terms' : 'Privacy'} accepted · policy {consent.policy_version} · {formatDate(consent.accepted_at)}
                                </li>
                              ))}
                            </ul>
                          ) : <p className="text-sm text-slate-500">No consent records found.</p>}
                        </div>
                      </div>
                    </details>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!candidates.length && <p className="py-10 text-center text-slate-500">No candidate registrations found.</p>}
      </div>
    </section>
  );
}
