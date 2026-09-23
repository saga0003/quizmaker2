# V19.2 reviewed import

This patch was prepared from the independent September 2026 product assessment and the supplied V19.2 candidate archive, but it intentionally does **not** copy that archive wholesale.

Imported now:
- demo-build credential-gate bypass when Supabase is not configured;
- rebuilt institution registration page using the current design system and the existing `create_school` RPC;
- public legal/contact shell cleanup (no internal setup banner or placeholder phone); 
- dark-section heading colour inheritance fix;
- stale login copy and mobile demo-button layout fix;
- client-side free trial route and corrected LaTeX escapes;
- public sitemap/landing links for the trial and registration;
- small parser/auth cleanups from the reviewed candidate.

Held back deliberately:
- **Privileged MFA hard enforcement.** Production privileged accounts currently have no enrolled TOTP factor, so applying the supplied enforcement migration would create a real lockout risk. Enrolment must be completed before enforcement is switched on.
- **Refund implementation from the candidate archive.** The supplied code advertised partial refunds but treated any partial refund as a fully refunded order and revoked all entitlements. That implementation is unsafe for real money and must be corrected before deployment.
- **Mass dead-code deletion.** The candidate build passed, but deleting thousands of lines is not required to repair the buyer-visible launch defects. It should be done as a separate cleanup change with its own regression pass.
- **Broad lint/package pruning.** Deferred so this launch-surface fix stays narrow and easy to roll back.

Public business details are environment-overridable. The public UI never exposes an internal "setup required" banner; `legalDetailsConfigured` remains available as an internal readiness signal.
