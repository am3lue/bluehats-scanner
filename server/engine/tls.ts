import tls from 'node:tls';
import type { Indicator, TlsInfo, TrustSignal } from '../types.js';

interface PeerCert {
  subject?: Record<string, string>;
  issuer?: Record<string, string>;
  valid_from?: string;
  valid_to?: string;
  fingerprint256?: string;
  subjectaltname?: string;
  serialNumber?: string;
}

function cName(value: unknown): string {
  if (value && typeof value === 'object' && 'CN' in value) return String((value as Record<string, string>).CN);
  return 'unknown';
}

function parseAltNames(subjectaltname?: string): string[] {
  if (!subjectaltname) return [];
  return subjectaltname
    .split(',')
    .map((part) => part.trim().replace(/^DNS:/, ''))
    .filter(Boolean);
}

export async function inspectTls(host: string, port = 443, timeoutMs = 4200): Promise<{
  info: TlsInfo;
  indicators: Indicator[];
  trustSignals: TrustSignal[];
  check: { status: 'ok' | 'warn' | 'fail' | 'skip'; detail: string };
}> {
  return new Promise((resolve) => {
    const indicators: Indicator[] = [];
    const trustSignals: TrustSignal[] = [];
    let settled = false;

    const finish = (info: TlsInfo, status: 'ok' | 'warn' | 'fail' | 'skip', detail: string) => {
      if (settled) return;
      settled = true;
      resolve({ info, indicators, trustSignals, check: { status, detail } });
    };

    let socket: tls.TLSSocket;
    try {
      socket = tls.connect({
        host,
        port,
        servername: host,
        rejectUnauthorized: false,
        timeout: timeoutMs,
      });
    } catch (error) {
      finish({ checked: false, skippedReason: String(error) }, 'skip', 'TLS handshake could not start');
      return;
    }

    socket.once('timeout', () => {
      socket.destroy();
      finish({ checked: false, skippedReason: 'TLS handshake timed out' }, 'skip', 'TLS handshake timed out');
    });

    socket.once('error', (error: Error) => {
      socket.destroy();
      finish({ checked: false, skippedReason: error.message }, 'warn', `TLS unavailable: ${error.message}`);
    });

    socket.once('secureConnect', () => {
      const cert = socket.getPeerCertificate(true) as PeerCert;
      const authorized = socket.authorized;
      const authorizationError = socket.authorizationError ? String(socket.authorizationError) : undefined;
      const issuedAt = cert.valid_from ? new Date(cert.valid_from) : undefined;
      const expiresAt = cert.valid_to ? new Date(cert.valid_to) : undefined;
      const now = Date.now();
      const ageDays = issuedAt ? Math.floor((now - issuedAt.getTime()) / 86_400_000) : undefined;
      const daysLeft = expiresAt ? Math.floor((expiresAt.getTime() - now) / 86_400_000) : undefined;
      const issuer = cName(cert.issuer);
      const subject = cName(cert.subject);
      const altNames = parseAltNames(cert.subjectaltname);
      const selfSigned = issuer === subject || issuer === 'unknown';
      const hostnameCheck = tls.checkServerIdentity(host, cert as unknown as tls.PeerCertificate);
      const hostnameMatch = !hostnameCheck;

      const info: TlsInfo = {
        checked: true,
        authorized,
        authorizationError,
        protocol: socket.getProtocol() ?? undefined,
        subject,
        issuer,
        issuedAt: issuedAt?.toISOString(),
        expiresAt: expiresAt?.toISOString(),
        ageDays,
        daysLeft,
        fingerprint: cert.fingerprint256,
        altNames,
        selfSigned,
        hostnameMatch,
      };

      const freeCa = /let'?s encrypt|zerossl|google trust|buypass|actalis/i.test(issuer);

      if (!authorized) {
        indicators.push({
          id: 'tls-untrusted',
          category: 'tls',
          title: selfSigned ? 'Self-signed TLS certificate' : 'TLS certificate is not trusted',
          severity: 'high',
          weight: 18,
          explanation: selfSigned
            ? 'The certificate is signed by the site itself, not a public certificate authority. Browsers warn about this, but a phishing page can still load for users who click through.'
            : `The certificate chain failed validation (${authorizationError ?? 'unknown reason'}). A brand's real sign-in page should present a valid certificate.`,
          evidence: `${issuer} → ${subject}`,
        });
      } else {
        trustSignals.push({
          id: 'tls-valid',
          title: 'Certificate chain is trusted',
          explanation: `A public certificate authority issued this certificate (${issuer}). Attackers can get free certificates too, so this is a small positive signal, not a guarantee.`,
          relief: 4,
          source: 'TLS',
        });
      }

      if (hostnameMatch === false) {
        indicators.push({
          id: 'tls-hostname-mismatch',
          category: 'tls',
          title: 'Certificate does not match this hostname',
          severity: 'high',
          weight: 18,
          explanation: `The certificate is valid for ${altNames.slice(0, 3).join(', ') || 'other names'}, not ${host}. That is a strong sign the page is being served from infrastructure that was not intended for it.`,
          evidence: altNames.slice(0, 5).join(', '),
        });
      }

      if (daysLeft !== undefined && daysLeft < 0) {
        indicators.push({
          id: 'tls-expired',
          category: 'tls',
          title: 'Certificate has expired',
          severity: 'medium',
          weight: 10,
          explanation:
            'The certificate expired. Some real sites misconfigure renewals, but expired certificates are also common on hastily assembled phishing hosts.',
          evidence: `expired ${Math.abs(daysLeft)} days ago`,
        });
      } else if (daysLeft !== undefined && daysLeft < 14) {
        indicators.push({
          id: 'tls-expiring',
          category: 'tls',
          title: 'Certificate expires very soon',
          severity: 'low',
          weight: 4,
          explanation: 'The certificate has less than two weeks left. Renewal is usually automatic for real services.',
          evidence: `${daysLeft} days left`,
        });
      }

      if (ageDays !== undefined && ageDays >= 0 && ageDays < 7) {
        indicators.push({
          id: 'tls-young',
          category: 'tls',
          title: 'Certificate was issued days ago',
          severity: 'medium',
          weight: 8,
          explanation:
            'A brand new certificate on a page that claims to be an established company is a common phishing pattern. Free certificates make this cheap for attackers.',
          evidence: `${ageDays} day${ageDays === 1 ? '' : 's'} old`,
        });
      }

      if (authorized && hostnameMatch && (ageDays ?? 0) > 90) {
        trustSignals.push({
          id: 'tls-established',
          title: 'Established, matching certificate',
          explanation: 'The certificate is valid, matches the hostname and has been in use for more than 90 days.',
          relief: 3,
          source: 'TLS',
        });
      }

      if (freeCa) {
        trustSignals.push({
          id: 'tls-free-ca',
          title: 'Free automated certificate authority',
          explanation: `${issuer} issues free certificates. That is normal for small sites, but it also lowers the cost of impersonation, so it is not counted as a strong trust signal.`,
          relief: 0,
          source: 'TLS',
        });
      }

      const status = !authorized || hostnameMatch === false ? 'fail' : 'ok';
      finish(info, status, authorized ? `${issuer} · ${daysLeft ?? '?'} days left${hostnameMatch ? '' : ' · hostname mismatch'}` : `Untrusted: ${authorizationError ?? 'chain error'}`);
      socket.end();
    });
  });
}
