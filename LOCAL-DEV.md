# Signing in on a local dev server

## The problem

Sign-in from `http://localhost:3000` fails with:

```
Firebase: Error (auth/unauthorized-domain).
```

Email/password sign-in does not normally check the authorized-domains list —
that check is for OAuth popup and redirect flows. It applies here because this
project runs **Identity Platform**, which validates the request origin on
password sign-in too. (The project also carries a `recaptchaSiteKey`, and a
domain-bound reCAPTCHA token would produce the same symptom; which of the two
is responsible was never established, because the reCAPTCHA settings turned out
to be unreachable — see below. It does not change the fix.)

`localhost` is normally on the authorized-domains list by default. It is not
here, and it cannot be added: this is an **AI Studio Starter Tier** project, so
the list is provisioned and managed by AI Studio. Adding a domain fails from
both consoles — Firebase console → Authentication → Settings → Authorized
domains, and Google Cloud console → Identity Platform → Settings — with
*"Adding domain failed, please try again later."*

The deployed site is unaffected. Its hostnames are already on the list:

```
spatial-sound-mxjsq.firebaseapp.com                        Default
spatial-sound-mxjsq.web.app                                Default
ais-{dev,mob,pre,shared}-…asia-southeast1.run.app          Custom
smart-business-automation-hub-785323626323.…run.app        Custom
smart-business-automation-hub.ai.studio                    Custom
```

## What does not work: borrowing an authorized hostname

The obvious workaround is to point an already-authorized hostname at your own
machine — a line in `C:\Windows\System32\drivers\etc\hosts` — and browse to
that instead of localhost.

**It does not work, and the reason is worth knowing.** Every authorized domain
on that list is either under the `.app` TLD or under `firebaseapp.com`, and all
of them are on the **HSTS preload list** — `.app` is preloaded in its entirety.
Chrome forces HTTPS on a preloaded domain no matter what you type, and offers
no way to click through, so a plain-HTTP dev server on one of those hostnames
answers with `ERR_SSL_PROTOCOL_ERROR` and that is the end of it.

There is one further trap if you try it anyway: `spatial-sound-mxjsq.firebaseapp.com`
is this project's `authDomain`, the hostname Firebase Auth uses for OAuth
redirects. Pointing it at 127.0.0.1 breaks Google Sign-In. If you added hosts
entries while experimenting, remove them:

```powershell
# Administrator PowerShell
$h = "$env:SystemRoot\System32\drivers\etc\hosts"
(Get-Content $h) | Where-Object { $_ -notmatch 'spatial-sound-mxjsq' } | Set-Content $h
```

## What does not work: turning reCAPTCHA enforcement down

Firebase console → Authentication → Settings → **Fraud prevention → reCAPTCHA**
links out to the reCAPTCHA Enterprise console, and Starter Tier answers with
*"To access this service, upgrade your account."* So this route is closed too.

Worth recording honestly: reCAPTCHA may not even have been the cause. Identity
Platform validates the request origin on password sign-in in its own right, so
the domain check would likely have applied with reCAPTCHA turned all the way
off. The setting was never reachable, so this was never established.

## What works

### Local HTTPS with a trusted certificate

The domain check is satisfied by genuinely serving from a hostname Firebase
authorizes. Those hostnames are all HSTS-preloaded, so that means HTTPS with a
certificate this machine trusts — which [mkcert](https://github.com/FiloSottile/mkcert)
issues in about a minute by installing a local CA into the Windows certificate
store.

```powershell
choco install mkcert            # or: scoop install mkcert
mkcert -install                 # installs the local CA (prompts for elevation)
mkcert spatial-sound-mxjsq.web.app
```

That writes two files into the current folder:

```
spatial-sound-mxjsq.web.app-key.pem
spatial-sound-mxjsq.web.app.pem
```

Point the hostname at your machine — **Administrator PowerShell**:

```powershell
Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" -Value "`n127.0.0.1  spatial-sound-mxjsq.web.app"
```

Use `web.app`, not `firebaseapp.com` — the latter is this project's
`authDomain`, and redirecting it to 127.0.0.1 breaks Google Sign-In.

Then start the server with the two certificate paths set:

```powershell
$env:SSL_KEY_FILE  = "C:\Users\HP\certs\spatial-sound-mxjsq.web.app-key.pem"
$env:SSL_CERT_FILE = "C:\Users\HP\certs\spatial-sound-mxjsq.web.app.pem"
npm run dev
```

The boot line should read `listening on https://0.0.0.0:3000`. Open:

```
https://spatial-sound-mxjsq.web.app:3000
```

`server.ts` switches to an HTTPS listener only when both variables are set, so
`npm run dev` without them behaves exactly as before, and the Cloud Run
deployment is untouched.

One trade-off: HMR is disabled under HTTPS. Vite serves hot updates over a
plain-ws connection on a separate port, which an HTTPS page is not allowed to
open, so it is switched off rather than left to fail noisily. Refresh manually
after an edit.

### Or: move the project off Starter Tier

Upgrading to pay-as-you-go, or moving to a Firebase project you create yourself
instead of one AI Studio provisions, hands you the authorized-domains list.
Then `localhost` is one click and this entire page stops applying. The free
usage tiers still apply at prototype scale, so the practical cost is a card on
file and a billing budget alert — but it is a real decision, not a formality.

This is the root fix. Everything above is working around not having it.

## Before launch

- [ ] **Remove the hosts-file entry** for `spatial-sound-mxjsq.web.app` when
      you stop needing local HTTPS, and on any machine you hand the project to.
      A stale entry silently sends a real Firebase hostname to 127.0.0.1.
- [ ] Consider moving off AI Studio Starter Tier, or to a Firebase project you
      create yourself. The authorized-domains list would then be yours to
      edit, `localhost` would be one click, and none of this page would be
      necessary. The same lock applies to several other settings you will
      eventually want.
