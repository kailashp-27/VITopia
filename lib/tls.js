import { readFileSync } from "node:fs";
import { rootCertificates } from "node:tls";
import { X509Certificate } from "node:crypto";
import { Agent, fetch } from "undici";
// Public intermediate from Sectigo's distribution endpoint. VTOP omits this
// certificate from its handshake. Verification and hostname checks stay on.
const intermediate = readFileSync(
  new URL("./certificates/sectigo-r36.pem", import.meta.url),
  "utf8",
);
const certificate = new X509Certificate(intermediate);
if (
  certificate.fingerprint256 !==
  "8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0"
)
  throw new Error("Unexpected VTOP intermediate certificate");
const dispatcher = new Agent({
  connect: {
    ca: [...rootCertificates, intermediate],
    rejectUnauthorized: true,
  },
  headersTimeout: 20000,
  bodyTimeout: 20000,
});
export const vtopFetch = (url, options) =>
  fetch(url, { ...options, dispatcher });
