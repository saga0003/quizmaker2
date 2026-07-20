import { readFile } from "node:fs/promises";
import path from "node:path";
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

let cachedApprovedLogo: string | null | undefined;

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

async function approvedLogoDataUri() {
  if (cachedApprovedLogo !== undefined) return cachedApprovedLogo;
  try {
    const logo = await readFile(path.join(process.cwd(), "public", "brand", "evidara-logo-light.png"));
    cachedApprovedLogo = `data:image/png;base64,${logo.toString("base64")}`;
  } catch {
    cachedApprovedLogo = null;
  }
  return cachedApprovedLogo;
}

function certificateSvg(certificate: PublicCertificate, approvedLogo: string | null) {
  const issued = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(certificate.issued_at));
  const evidenceLines = wrap(certificate.evidence_summary);
  const revoked = certificate.status === "revoked";
  const logoHref = approvedLogo ?? "/brand/evidara-logo-light.png";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1131" viewBox="0 0 1600 1131" role="img" aria-label="Evidara achievement certificate">
  <defs>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#14232B" flood-opacity="0.08"/></filter>
  </defs>
  <rect width="1600" height="1131" fill="#DCE9E7"/>
  <rect x="44" y="44" width="1512" height="1043" rx="22" fill="#F7F9F7" filter="url(#shadow)"/>
  <rect x="66" y="66" width="1468" height="999" rx="17" fill="none" stroke="#0E5A5A" stroke-width="4"/>
  <rect x="84" y="84" width="1432" height="963" rx="12" fill="none" stroke="#DCE9E7" stroke-width="2"/>

  <path d="M1260 104 A260 260 0 0 1 1510 354" fill="none" stroke="#DCE9E7" stroke-width="12" opacity="0.72"/>
  <path d="M1298 104 A220 220 0 0 1 1510 316" fill="none" stroke="#0E5A5A" stroke-width="2" opacity="0.25"/>
  <circle cx="1438" cy="202" r="8" fill="#F2B84B"/>
  <path d="M90 920 C300 830 470 985 650 930" fill="none" stroke="#DCE9E7" stroke-width="10" opacity="0.66"/>
  <circle cx="238" cy="884" r="6" fill="#F2B84B"/>

  <image href="${logoHref}" x="118" y="104" width="400" height="148" preserveAspectRatio="xMinYMid meet"/>
  <g font-family="Inter, Arial, Helvetica, sans-serif" text-anchor="end">
    <text x="1450" y="146" font-size="14" font-weight="700" letter-spacing="2.2" fill="#44545C">EVIDENCE-BACKED RECOGNITION</text>
    <text x="1450" y="176" font-size="13" fill="#6B7980">Private · Verifiable · Rule ${xml(certificate.rule_version)}</text>
  </g>

  <text x="800" y="322" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="30" font-weight="700" letter-spacing="7" fill="#44545C">CERTIFICATE OF ACHIEVEMENT</text>
  <line x1="584" y1="353" x2="1016" y2="353" stroke="#F2B84B" stroke-width="5" stroke-linecap="round"/>
  <text x="800" y="414" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="19" fill="#6B7980">This evidence-backed recognition is presented to</text>
  <text x="800" y="500" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="62" font-weight="800" fill="#14232B">${xml(certificate.student_name)}</text>
  <text x="800" y="548" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="18" fill="#44545C">of ${xml(certificate.organization_name)}</text>
  <text x="800" y="635" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="19" letter-spacing="3" font-weight="800" fill="#0E5A5A">${xml(certificate.achievement_title.toUpperCase())}</text>
  <text x="800" y="684" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="22" fill="#14232B">${xml(certificate.achievement_description)}</text>
  ${evidenceLines.map((line, index) => `<text x="800" y="${738 + index * 30}" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="17" fill="#44545C">${xml(line)}</text>`).join("\n  ")}

  <g transform="translate(800 884)">
    <circle r="70" fill="#0E5A5A"/>
    <circle r="55" fill="none" stroke="#DCE9E7" stroke-width="2" stroke-dasharray="4 6"/>
    <path d="M-18 12 L-2 -28 L18 12 L0 2 Z" fill="#F7F9F7"/>
    <circle cx="18" cy="-20" r="7" fill="#F2B84B"/>
    <text y="45" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="10" font-weight="800" letter-spacing="1.4" fill="#F7F9F7">VERIFIED EVIDENCE</text>
  </g>

  <g font-family="Inter, Arial, Helvetica, sans-serif" fill="#44545C" font-size="13">
    <text x="132" y="988">Issued: ${xml(issued)}</text>
    <text x="132" y="1015">Rule version: ${xml(certificate.rule_version)}</text>
    <text x="1468" y="988" text-anchor="end">Certificate: ${xml(certificate.certificate_number)}</text>
    <text x="1468" y="1015" text-anchor="end">Verify: /verify/certificate/${xml(certificate.verification_code)}/</text>
  </g>
  <text x="800" y="1044" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="11" fill="#6B7980">This certificate recognises the cited evidence only. It is not a prediction, permanent label or guarantee of a future result.</text>

  ${revoked ? `<g transform="rotate(-18 800 560)"><rect x="480" y="490" width="640" height="140" rx="18" fill="#F7F9F7" fill-opacity="0.9" stroke="#B54747" stroke-width="8"/><text x="800" y="580" text-anchor="middle" font-family="Inter, Arial, Helvetica, sans-serif" font-size="82" font-weight="900" letter-spacing="12" fill="#B54747">REVOKED</text></g>` : ""}
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
      const approvedLogo = await approvedLogoDataUri();
      return new NextResponse(certificateSvg(certificate, approvedLogo), {
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
