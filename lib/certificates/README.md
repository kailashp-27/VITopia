VTOP's live TLS leaf certificate (inspected 28 October 2026) names Sectigo Public Server Authentication CA DV R36 as issuer but omits it from the handshake.

`sectigo-r36.pem` is the public CA intermediate downloaded from the leaf's CA Issuers AIA URL: http://crt.sectigo.com/SectigoPublicServerAuthenticationCADVR36.crt

SHA-256 fingerprint: `8C:54:C3:34:B6:6B:A4:E4:26:77:2A:F4:A3:F9:13:6C:19:A1:AE:C7:29:FD:B2:8C:53:5C:07:A5:A4:EF:22:E0`.

Expires 21 March 2036. The upstream connection still validates the certificate chain and hostname. No TLS validation bypass is used. Replace this intermediate and its fingerprint if VTOP changes issuers. No private keys are present.
