const {onRequest} = require('firebase-functions/v2/https');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getAuth} = require('firebase-admin/auth');

exports.commentReact = onRequest(async (req, res) => {
  if (req.method !== 'POST') { res.status(405).send('Method Not Allowed'); return; }

  const {commentId, prev, next} = req.body || {};
  const valid = [null, 'likes', 'dislikes'];
  if (!commentId || !valid.includes(prev) || !valid.includes(next) || prev === next) {
    res.status(400).json({ok: false, error: 'Invalid request'}); return;
  }

  const updates = {};
  if (prev === 'likes')    updates.likes    = FieldValue.increment(-1);
  if (prev === 'dislikes') updates.dislikes = FieldValue.increment(-1);
  if (next === 'likes')    updates.likes    = FieldValue.increment(1);
  if (next === 'dislikes') updates.dislikes = FieldValue.increment(1);

  try {
    await getFirestore().collection('article_comments').doc(commentId).update(updates);
    res.status(200).json({ok: true});
  } catch (e) {
    console.error('commentReact error:', e);
    res.status(500).json({ok: false, error: e.message});
  }
});

// ── Magic link email ──────────────────────────────────────────────────────────
// Generates a Firebase Auth sign-in link and sends a branded HTML email.
// Called instead of client-side sendSignInLinkToEmail so we control the email.
exports.sendMagicLinkEmail = onRequest(
  {region: 'europe-west1', secrets: ['GMAIL_APP_PASSWORD'], cors: false},
  async (req, res) => {
    if (req.method !== 'POST') { res.status(405).json({error: 'Method not allowed'}); return; }

    const email = (req.body?.email ?? '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({error: 'Invalid email address'}); return;
    }

    // handleCodeInApp / android / iOS omitted: Firebase Dynamic Links were shut down
    // Aug 2025. We open the app ourselves via the btcchub.vercel.app intermediary,
    // so we just need a plain action URL the native SDK's signInWithEmailLink accepts.
    const actionCodeSettings = {
      url: 'https://btcchub-af77a.firebaseapp.com',
    };

    let link;
    try {
      link = await getAuth().generateSignInWithEmailLink(email, actionCodeSettings);
    } catch (e) {
      console.error('sendMagicLinkEmail generateLink error:', e);
      res.status(500).json({error: e.code || 'Failed to generate link'}); return;
    }

    // Use the Firebase action URL directly as the button href.
    // btcchub-af77a.firebaseapp.com has a verified App Link (Firebase serves assetlinks.json
    // automatically), so Gmail's Chrome Custom Tab will intercept and open the app.
    const deepLink = link;

    const html = `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<style>
:root { color-scheme: light only; supported-color-schemes: light only; }
@media (prefers-color-scheme: dark) {
  .email-body { background:#f0f0f5 !important; }
  .card-header { background:#020255 !important; }
  .card-body { background:#ffffff !important; color:#444444 !important; }
  .stripe { background:#FEBD02 !important; }
  .btn td { background:#FEBD02 !important; }
  .btn a { color:#080912 !important; }
  h2 { color:#080912 !important; }
  .body-text { color:#444444 !important; }
}
</style>
</head>
<body style="margin:0;padding:0;background:#f0f0f5;">
<div class="email-body" style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background:#f0f0f5;margin:0;padding:24px 12px;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;">
  <tr>
    <td class="card-header" style="background:#020255;padding:32px 40px;text-align:center;border-radius:12px 12px 0 0;">
      <img src="https://btcchub-af77a.firebaseapp.com/logo.png" width="200" alt="BTCC Hub" style="display:block;margin:0 auto;" />
    </td>
  </tr>
  <tr><td class="stripe" style="background:#FEBD02;height:4px;font-size:1px;line-height:1px;">&nbsp;</td></tr>
  <tr>
    <td class="card-body" style="background:#ffffff;padding:40px 40px 32px;border-radius:0 0 12px 12px;">
      <h2 style="color:#080912;font-size:20px;font-weight:700;margin:0 0 12px 0;">Sign in to BTCC Hub</h2>
      <p class="body-text" style="color:#444444;font-size:15px;line-height:1.6;margin:0 0 32px 0;">
        Tap the button below to sign in. This link expires in 1 hour and can only be used once - no password needed.
      </p>
      <table class="btn" cellpadding="0" cellspacing="0" style="margin:0 0 32px 0;">
        <tr>
          <td style="background:#FEBD02;border-radius:8px;">
            <a href="${deepLink}" style="display:inline-block;padding:14px 36px;color:#080912;font-size:15px;font-weight:700;text-decoration:none;letter-spacing:0.3px;">Sign in to BTCC Hub &rarr;</a>
          </td>
        </tr>
      </table>
      <p style="color:#999999;font-size:12px;line-height:1.5;margin:0 0 8px 0;">
        If you didn't request this, you can safely ignore this email.
      </p>
      <p style="color:#bbbbbb;font-size:11px;line-height:1.5;margin:0;word-break:break-all;">
        Link not working? Copy and paste into your browser:<br/>
        <a class="fallback-link" href="${link}" style="color:#020255;">${link}</a>
      </p>
    </td>
  </tr>
  <tr>
    <td style="padding:20px 0;text-align:center;">
      <p style="color:#aaaaaa;font-size:11px;margin:0;">BTCC Hub &middot; Not affiliated with the official BTCC</p>
    </td>
  </tr>
</table>
</div>
</body>
</html>`;

    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {user: 'btcchub@gmail.com', pass: process.env.GMAIL_APP_PASSWORD},
      });
      await transporter.sendMail({
        from: '"BTCC Hub" <btcchub@gmail.com>',
        to: email,
        subject: 'Sign in to BTCC Hub',
        html,
      });
      res.status(200).json({ok: true});
    } catch (e) {
      console.error('sendMagicLinkEmail send error:', e);
      res.status(500).json({error: 'Failed to send email'});
    }
  },
);
