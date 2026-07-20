import { NextResponse } from "next/server";
import { createServiceClient, isPublicSupabaseConfigured, isServerSupabaseReady } from "@/lib/server/supabaseServer";
import { demoPublicCertificates } from "@/lib/demoAchievements";
import type { PublicCertificate } from "@/lib/achievementClient";

const verificationHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, nofollow, noarchive",
};

const xmlEntities: Record<string, string> = {
  "<": "&lt;",
  ">": "&gt;",
  "&": "&amp;",
  "\"": "&quot;",
  "'": "&apos;",
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: verificationHeaders });
}

function xml(value: string) {
  return value.replace(/[<>&"']/g, (character) => xmlEntities[character] ?? character);
}

function wrap(value: string, maximum = 78) {
  const words = value.trim().split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maximum && current) {
      lines.push(current);
      current = word;
    } else current = next;
  }
  if (current) lines.push(current);
  return lines.slice(0, 3);
}

function certificateSvg(certificate: PublicCertificate) {
  const issued = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(certificate.issued_at));
  const evidenceLines = wrap(certificate.evidence_summary);
  const revoked = certificate.status === "revoked";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131" role="img" aria-label="Evidara achievement certificate">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#fbfcfe"/><stop offset="1" stop-color="#f1f6f7"/></linearGradient>
    <linearGradient id="seal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#18b7a0"/><stop offset="1" stop-color="#7456e8"/></linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0b1324" flood-opacity="0.12"/></filter>
  </defs>
  <rect width="1600" height="1131" fill="#e9eef3"/>
  <rect x="44" y="44" width="1512" height="1043" rx="24" fill="url(#paper)" filter="url(#shadow)"/>
  <rect x="66" y="66" width="1468" height="999" rx="18" fill="none" stroke="#0b1324" stroke-width="3"/>
  <rect x="83" y="83" width="1434" height="965" rx="13" fill="none" stroke="#18b7a0" stroke-width="1.5" opacity="0.75"/>
  <g transform="translate(132 118)">
    <rect width="72" height="72" rx="20" fill="#0b1324"/>
    <rect x="19" y="38" width="9" height="18" rx="4.5" fill="#18b7a0"/>
    <rect x="32" y="21" width="9" height="35" rx="4.5" fill="#8d76ef"/>
    <rect x="45" y="29" width="9" height="27" rx="4.5" fill="#f3ad5f"/>
    <text x="94" y="31" font-family="Arial, Helvetica, sans-serif" font-size="31" font-weight="800" fill="#0b1324">EVIDARA</text>
    <text x="94" y="56" font-family="Arial, Helvetica, sans-serif" font-size="12" font-weight="700" letter-spacing="2.3" fill="#697386">EVIDENCE-DRIVEN STUDENT DEVELOPMENT</text>
  </g>
  <text x="800" y="286" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="29" letter-spacing="8" fill="#697386">CERTIFICATE OF ACHIEVEMENT</text>
  <line x1="525" y1="318" x2="1075" y2="318" stroke="#18b7a0" stroke-width="3"/>
  <text x="800" y="390" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="19" fill="#697386">This evidence-backed recognition is presented to</text>
  <text x="800" y="480" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="64" font-weight="700" fill="#0b1324">${xml(certificate.student_name)}</text>
  <text x="800" y="526" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="#697386">of ${xml(certificate.organization_name)}</text>
  <text x="800" y="617" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="18" letter-spacing="3" font-weight="800" fill="#7456e8">${xml(certificate.achievement_title.toUpperCase())}</text>
  <text x="800" y="666" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="22" fill="#25324a">${xml(certificate.achievement_description)}</text>
  ${evidenceLines.map((line, index) => `<text x="800" y="${723 + index * 30}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="17" fill="#697386">${xml(line)}</text>`).join("\n  ")}
  <g transform="translate(800 850)">
    <circle r="74" fill="url(#seal)"/>
    <circle r="59" fill="none" stroke="#ffffff" stroke-width="2" stroke-dasharray="4 6" opacity="0.9"/>
    <path d="M-20 0l14 15 29-35" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
    <text y="42" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="10" font-weight="800" letter-spacing="1.6" fill="#fff">VERIFIED EVIDENCE</text>
  </g>
  <g font-family="Arial, Helvetica, sans-serif" fill="#697386" font-size="13">
    <text x="145" y="988">Issued: ${xml(issued)}</text>
    <text x="145" y="1015">Rule version: ${xml(certificate.rule_version)}</text>
    <text x="1455" y="988" text-anchor="end">Certificate: ${xml(certificate.certificate_number)}</text>
    <text x="1455" y="1015" text-anchor="end">Verify: /verify/certificate/${xml(certificate.verification_code)}/</text>
  </g>
  ${revoked ? `<g transform="rotate(-18 800 560)"><rect x="480" y="490" width="640" height="140" rx="18" fill="#fff" fill-opacity="0.78" stroke="#b42318" stroke-width="8"/><text x="800" y="580" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="82" font-weight="900" letter-spacing="12" fill="#b42318">REVOKED</text></g>` : ""}
</svg>`;
}

async function loadCertificate(code: string): Promise<PublicCertificate | null> {
  if (!isPublicSupabaseConfigured) return demoPublicCertificates[code] ?? null;
  if (!isServerSupabaseReady) {
    throw Object.assign(new Error("Evidara cloud is partially configured. Certificate verification requires the server service-role key."), { status: 503 });
  }
  const admin = createServiceClient();
  const { data, error } = await admin
    .from("achievement_certificates")
    .select("certificate_number,verification_code,student_name_snapshot,organization_name_snapshot,achievement_title_snapshot,achievement_description_snapshot,rule_version,evidence_summary,issued_at,status,revoked_at,revoked_reason")
    .eq("verification_code", code)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    certificate_number: data.certificate_number,
    verification_code: data.verification_code,
    student_name: data.student_name_snapshot,
    organization_name: data.organization_name_snapshot,
    achievement_title: data.achievement_title_snapshot,
    achievement_description: data.achievement_description_snapshot,
    rule_version: data.rule_version,
    evidence_summary: data.evidence_summary,
    issued_at: data.issued_at,
    status: data.status,
    revoked_at: data.revoked_at,
    revoked_reason: data.revoked_reason,
  } as PublicCertificate;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const code = (url.searchParams.get("code") ?? "").trim().toLowerCase();
    if (!code) return json({ error: "Certificate verification code is required." }, 400);
    const certificate = await loadCertificate(code);
    if (!certificate) return json({ error: "No Evidara certificate matches this verification code." }, 404);

    if (url.searchParams.get("format") === "svg") {
      return new NextResponse(certificateSvg(certificate), {
        status: 200,
        headers: {
          ...verificationHeaders,
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="${certificate.certificate_number}.svg"`,
        },
      });
    }

    return json({ certificate });
  } catch (error) {
    const value = error as { message?: string; status?: number };
    return json({ error: value.message ?? "Certificate verification failed." }, value.status ?? 500);
  }
}
