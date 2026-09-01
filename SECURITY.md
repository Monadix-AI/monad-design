# Security Policy

## Supported versions

Monad Design is currently pre-release. Security fixes are applied to the latest
commit on `main`; older commits and locally modified builds are not supported.

## Reporting a vulnerability

Please do not open a public issue for a suspected vulnerability.

Use GitHub's **Security → Report a vulnerability** flow when it is available.
If private vulnerability reporting is unavailable, contact a maintainer through
a verified private project channel before sharing technical details.

Include the affected commit, operating system, reproduction steps, impact, and
any suggested mitigation. Remove project source, screenshots, and other private
data from the report.

The maintainers will acknowledge the report, assess scope, coordinate a fix,
and credit reporters who want attribution. Disclosure timing will be agreed
with the reporter after a fix or mitigation is available.

## Security boundary

Monad Design controls local iOS Simulators, reads explicitly selected project
metadata, and can exchange runtime evidence with a local coding agent. Core's
LAN API has no request authentication; the pairing code only establishes a
connection through a credential-free handshake and is not a security boundary. Use Core only on a trusted network,
treat annotated screenshots and files under `.monaddesign/` as sensitive local
data, and review source changes before accepting them.
