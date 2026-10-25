# ICF Backend — MongoDB Atlas + Render

1. Create a MongoDB Atlas database named `ChildCrowdfunding` and a database user with access only to this database.
2. In Atlas Network Access, allow the Render service to connect. Prefer a restricted IP/network policy when practical; do not expose database credentials publicly.
3. Push this project to your GitHub repository.
4. Create a Render Web Service with build command `npm install` and start command `npm start`.
5. Add environment variables in Render: `NODE_ENV=production`, `MONGODB_URI` (Atlas connection string), `JWT_SECRET` (long random secret), `CORS_ORIGIN` (your frontend origin), and optionally `UPLOAD_DIR=./uploads`, `MAX_UPLOAD_MB=10`.
6. Do not add demo accounts or sample patient/case/donation data. The API starts with empty collections and creates records only through API operations.
7. Check `/api/health` after deployment. The root endpoint `/` also returns service status.

## Important
- Donations are currently recorded as application records only. No payment gateway is integrated, so the API must not be treated as proof of a completed financial transfer.
- Authority self-registration is disabled. Provision authority accounts through a secure administrator workflow before production use.
- Uploads on ephemeral hosting may not persist across deployments; use durable object storage for medical documents in production.


## Direct UPI payments
- Hospital case registration accepts a hospital UPI ID and/or an image of its UPI QR code.
- Donors can open a UPI payment intent on supported devices or scan the displayed QR code. The money transfers directly to the account associated with that UPI ID/QR, subject to the donor's UPI app and bank.
- This is not a payment-gateway integration. The API deliberately does not mark a donation as paid or increase fundraising totals based only on a button click. Automatic confirmation requires a payment provider/bank integration and verified server-side webhook.
- Only upload a genuine QR code belonging to the hospital. QR images are stored as data URLs in the case document; keep them under 700 KB.


## Direct UPI payment review workflow (manual verification)

- The hospital enters its UPI ID and/or uploads its genuine QR code during case registration. These values are stored with that case document in MongoDB.
- The donor pays directly to the hospital using a UPI app, then submits the UPI transaction reference/UTR in the frontend.
- `POST /api/donations` creates a `Pending Verification` record only. It does not increase `raised_amount`.
- An authenticated hospital account that owns the case, or an authenticated health authority account, can review the submitted reference through `GET /api/donations/case/:caseId`, then use `POST /api/donations/:id/verify` or `POST /api/donations/:id/reject`.
- Verify the transaction against the hospital's bank/UPI records before approving. Only the verify endpoint increases the case's `raised_amount`; a donor-provided reference alone is not proof of payment.
- This workflow is manual and does not establish an automatic bank connection or guarantee that a transaction reference is genuine.
