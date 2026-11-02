> **DRAFT — not published, not legal advice; review before use.**
> Every `[BRACKETED]` item must be filled in or removed before this is published.

# Quran Tracker — Privacy Policy

**Last updated:** [DATE]

This policy explains what personal data Quran Tracker ("the app", "we") collects, why,
who receives it, how long it is kept, and what you can do about it.

**Who is responsible:** [OPERATOR NAME / LEGAL ENTITY], [POSTAL ADDRESS OR COUNTRY].
**Contact:** [CONTACT EMAIL].

## 1. Summary

- You can read the mushaf without an account. An account is needed to save progress.
- We store what you give us — your name, email, password (hashed), your memorization
  progress, your plan settings, and the notes, highlights, drawings, bookmarks and
  to-dos you create — so the app can work.
- We do not sell your data, show ads, or use analytics or tracking cookies.
- The optional assistant (chat) is answered by Groq. It receives a summary of your plan
  and the messages you write — **not** your name, email or account id.
- To show Quran pages, audio and tafsir, your browser connects directly to several
  Quran content services, which see your IP address.
- You can delete your account at any time; this deletes all your data from our
  database.

## 2. What we collect and why

| Data | Why | Legal basis [REVIEW FOR YOUR JURISDICTION] |
|---|---|---|
| **Account:** name, email address, password (stored only as a bcrypt hash) | To create your account and let you sign in | Contract (providing the service) |
| **Plan settings:** daily goal, review intensity, rest days, pause, start page and direction, review counts, interface language | To build your daily plan | Contract |
| **Progress:** which pages and verses you have memorized, when you memorized and last reviewed each page, review counts, your streak and the date you were last active | To schedule new pages and reviews and show your progress | Contract |
| **Your content:** verse notes, highlights, "hard" flags, text notes, drawings on pages, bookmarks and their labels, to-dos | To save what you create in the reader and dashboard | Contract |
| **Leaderboard (optional):** a display name you choose, shown with your page count and streak to other signed-in users | Only if you opt in | Consent (you can leave at any time) |
| **Assistant messages (optional):** what you type into the chat | To answer you (see section 4) | Contract / consent by using it |
| **Password reset (when enabled):** a one-time token, stored only as a hash, valid 30 minutes | To let you reset a forgotten password | Contract |
| **Technical data:** IP address, browser type, requested address, time | Delivered with every request; used by our hosts for security and operations | Legitimate interest (running and securing the service) |

We do not ask for your date of birth, location, phone number, or any payment data.
Records also carry the usual creation and update times.

## 3. Who receives data (processors and third parties)

We use these services to run the app. Each receives only what is described.

| Service | Purpose | What it receives | Location |
|---|---|---|---|
| **Vercel** | Hosts the website (pages, code, fonts, search index) | Your IP address, browser type and the addresses you request | [REGION — e.g. US/EU] |
| **Render** | Hosts our server (API) | Every request to our server, including your account data and messages in transit, your IP address and browser type | [REGION] |
| **MongoDB Atlas** (MongoDB, Inc.) | Our database | Everything listed in section 2 except technical data | [REGION] |
| **Groq, Inc.** | Answers the assistant (chat) | See section 4. Groq sees our server, not your IP address | United States |
| **Quran Foundation** (api.quran.com) | Mushaf page data | Your IP address, browser type, our site's address, and which page you open | [REGION — provider's] |
| **Islamic Network** (api.alquran.cloud, cdn.islamic.network) | Daily verse, some tafsir, recitation audio | Your IP address, browser type, our site's address, and which verse, tafsir or reciter you request | [REGION — provider's] |
| **EveryAyah** (everyayah.com) | Recitation audio | Your IP address, browser type, our site's address, which reciter and verse | [REGION — provider's] |
| **jsDelivr** (cdn.jsdelivr.net) | Tafsir texts | Your IP address, browser type, our site's address, which tafsir and verse | [REGION — provider's] |
| **Hefz Moyaser** (hefzmoyaser.net) | Aysar at-Tafasir | Your IP address, browser type, our site's address, which verse | [REGION — provider's] |

The services in the last five rows are contacted **directly by your browser** when you
use the reader, audio or tafsir, so they see your IP address. They do not receive your
name, email or account data; our site sends them only its own address (not the page
you are on) as the referrer.

Fonts are served from our own website; no font service (such as Google Fonts) is
contacted. We use GitHub to store our source code and run automated tests; it receives
no user data. We use no analytics, advertising or error-tracking service.
[IF AN EMAIL PROVIDER IS ADDED FOR PASSWORD RESET: name it here, with: your email
address and the reset message.]

We may disclose data if the law requires it. We do not sell or rent personal data.

## 4. The assistant (chat) and Groq

The assistant is optional. Nothing is sent to Groq unless you write a message.

**When you send a message, Groq receives:**
- fixed instructions and a guide to the app (the same for everyone);
- a summary of your plan: your daily goal, review intensity, interface language, how
  many pages you have memorized and have left, your streak (a number), whether today
  is a rest day, and today's new and review page numbers;
- your recent messages in this chat (up to the last few exchanges), **exactly as you
  typed them**.

**Groq does not receive:** your name, email address, account id, leaderboard display
name, password, IP address, or the dates of your activity.

Please do not type personal details (or anyone else's) into the chat: whatever you
write is sent to Groq as written. Chat conversations are not stored on our server.
They live only in the open browser tab: closing the chat panel just hides it, and the
conversation is cleared when you reload or close the page, sign out, or switch accounts.

Groq processes the request in the United States. Under its terms, Groq does not use
this data to train models. [CHOOSE ONE: "We have enabled Groq's Zero Data Retention,
so Groq does not keep it." / "Groq may keep it for up to 30 days for abuse monitoring."]

Answers from the assistant may be wrong. See the Terms of Use.

## 5. Cookies and storage on your device

We **do not use cookies** and do not track you across sites.

The app stores some items in your browser's local storage:
- **your session** (a sign-in token, valid for up to 30 days), the last mushaf page you
  read and your recently read pages — removed when you sign out or delete your account;
- **settings of this device** — theme, language, reciter, playback speed, tafsir choice,
  reader layout, keyboard shortcut setting, which first-run tips you have seen, the
  timer, the to-do list you keep while signed out, and today's daily verse. These stay
  on the device after you sign out; you can remove them by clearing this site's data
  in your browser.

These items never leave your device except the sign-in token, which is sent to our
server to identify you.

## 6. How long we keep data

- **Account data, progress and your content:** for as long as your account exists.
- **When you delete your account:** all your records are deleted from our live database
  immediately — account, progress, notes, highlights, drawings, bookmarks and to-dos.
- **Backups:** copies in database backups are deleted when those backups expire,
  within [BACKUP RETENTION PERIOD].
- **Server and hosting logs** (requests, errors): kept by Render and Vercel for
  [LOG RETENTION PERIOD]. Our logs do not contain chat messages.
- **Password-reset tokens:** expire after 30 minutes and are replaced by any newer one.
- **Short-term counters** used to prevent abuse (sign-in attempts, message limits):
  kept in memory for up to one day, never in the database.
- **Groq:** see section 4.

## 7. Your rights

Depending on where you live (for example under the GDPR or UK GDPR), you may have the
right to access, correct, delete, restrict or object to the processing of your data,
to data portability, and to withdraw consent.

What you can do in the app today:
- **See** your profile, progress, notes, bookmarks and to-dos.
- **Correct** your name, plan and settings in Settings, and your progress in the
  progress editor.
- **Delete** your account and all its data in Settings → Delete account, or reset your
  progress only.
- **Withdraw** from the leaderboard at any time, and stop using the assistant.

There is **no self-service data export** yet. To request a copy of your data, or for
any other request, write to [CONTACT EMAIL]. We will answer within [RESPONSE PERIOD,
e.g. one month].

You may also complain to your data protection authority [ADD AUTHORITY IF RELEVANT].

## 8. Security

Passwords are stored only as bcrypt hashes. Connections use HTTPS. Sign-in attempts and
requests are rate-limited. Sign-in sessions end when you change or reset your password.
No system is perfectly secure; if you think your account was misused, contact us.

## 9. Children

[DECIDE THE AGE POLICY, e.g.: "The app is not directed at children under [MINIMUM AGE].
If you are under [MINIMUM AGE], use the app only with the permission and supervision of
a parent or guardian, who should create the account." Add any parental-consent process
your jurisdiction requires.] Children should not type personal details into the chat.

## 10. International transfers

Our providers process data in [REGIONS]; Groq processes chat requests in the United
States. Where data leaves your country, we rely on the providers' safeguards, such as
the Standard Contractual Clauses in their data processing terms [CONFIRM FOR EACH
PROVIDER].

## 11. Changes to this policy

We will update this page when our practices change and change the "Last updated" date.
For significant changes we will tell you in the app [OR BY EMAIL, once email exists]
before they take effect.

## 12. Contact

Questions or requests about privacy: [CONTACT EMAIL].
