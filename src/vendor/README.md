# VTOP image model

`vtop-model.json` contains only the numeric `weights` (528 × 32) and `biases` (32) extracted from the MIT-licensed [VTOP-Captcha-Solver](https://github.com/levyashvin/VTOP-Captcha-Solver) userscript. Copyright © 2025 Yuva Yashvin. The upstream project credits ViBoot / VITrendz for the original logic and training data.

Source URL: https://raw.githubusercontent.com/levyashvin/VTOP-Captcha-Solver/main/VTOP%20Captcha%20Solver%20Script.js

Source inspected 28 October 2026. SHA-256 of inspected source: `2ba40d79d72c981b00f7678d8e8724bd1c04372c52547f3ea5da7e9c5649a41a`.

The third-party userscript was **not executed**. Its syntax tree was parsed, and only arrays of numeric literals were extracted. Vtopia implements its own bounded inference and confidence checks in `src/captcha-reader.js`, using the upstream fixed image windows and character alphabet. The full MIT notice is in `VTOP-SOLVER-LICENSE.txt`.

This model targets VTOP's 200 × 40 colored text image layout. It does not handle Google reCAPTCHA, and its confidence scores are not a guarantee of accuracy. Low-confidence results pause for a manual check; failed logins are not retried automatically.
