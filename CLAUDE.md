## Documentation rule (mandatory)
- PRODUCT_DOCUMENTATION.md is the source of truth for product state. Code wins on conflict.
- Before a significant change, read the relevant sections of PRODUCT_DOCUMENTATION.md.
- After any change affecting features, APIs, models, schema, env vars, dependencies, or security:
  update the affected sections, the Feature Status table, the Current Snapshot, and add a
  dated Change Log entry.
- Never mark a feature ✅ unless verified by running it or a passing test.
- Never open .env or copy secret values. Use <REDACTED>.
- "Unknown" is acceptable. Invented detail is not.
