# Shift check-in QR codes

OrgFlow supports three check-in link types:

1. **Assignment QR (admin)** – `/checkin?org={slug}&assignmentId={id}&auto=1`  
   Encodes a specific shift assignment. Any **org admin** can check in that row; the **assigned member** can check themselves in.

2. **Shift QR (member)** – `/checkin?org={slug}&shiftId={id}&auto=1`  
   The signed-in member must have **exactly one** assignment on that shift. If they have none or several, the UI/API returns a clear error.

3. **Manual / shared URL** – Omit `auto=1` to show a **“Check in now”** button instead of posting immediately (fewer accidental requests when pasting links).

## Absolute URLs for print

QR codes on posters should use a **full HTTPS URL** (e.g. `https://your-domain.com/checkin?...`), otherwise scans may not open your app.

- Set **`NEXT_PUBLIC_SITE_URL`** in production (e.g. `https://your-domain.com`) so generated QR values resolve correctly before the browser has a known origin.
- In the admin shift plan, QR values prefer `window.location.origin` when you are already on the site, and fall back to `NEXT_PUBLIC_SITE_URL`.
