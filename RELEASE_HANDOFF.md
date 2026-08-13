# Release handoff — AI Chatbot・Ask AI GPT

Updated: 14 August 2026

## Completed

- App name, English Store listing, all-market availability, logo, screenshots, privacy URL, support email, and publisher details are configured.
- Main app Store ID: `9NX17RBKP4HJ`.
- Monthly add-on Store ID: `9NCL4LXGNBPF`, product ID `ai_chatbot_monthly`, USD 14.99/month, seven-day trial.
- Annual add-on Store ID: `9NCRCSC8WBX7`, product ID `ai_chatbot_annual`, USD 79.99/year.
- Free tier: five Fast-mode questions per day.
- Paid tiers: Fast and Advanced modes, image/document attachments, 1,000 messages per month.
- Partner Center submission is held for manual publishing after certification.
- Certification testing notes are saved; no credentials are required.
- Partner Center age ratings are complete: global 12+, ESRB Teen, Brazil 14, and Russia 18+.
- Privacy policy is live at <https://ai-chatbot-ask-ai-gpt-privacy.grauremihai439.chatgpt.site>.
- Desktop and API projects pass type-checking and production builds.
- Upgrade buttons open the correct Microsoft Store products.
- Windows x64 APPX build automation and a production API Dockerfile are included.

## Owner actions required before release

These steps require personal/legal/financial confirmation and cannot be completed safely on the owner's behalf:

1. Create or join a Microsoft Entra tenant. The current registration `AI for ChatGPT.429f00a9051f` is a legacy personal-account registration outside a directory, so Partner Center will not retain it for server-side Store entitlement access.
2. Select and fund an HTTPS hosting provider with a persistent volume or managed database and a secret manager.
3. Complete Microsoft Partner Center tax and payout profiles with the owner's real tax and banking details.
4. Review the final privacy policy and terms with qualified legal/tax advice for every market offered.

## Technical work after those actions

1. Store the OpenAI key, a 32+ character session secret, and the Entra client secret only in the hosting provider's secret manager.
2. Deploy the API over HTTPS and set the GitHub repository variable `API_BASE_URL` to that URL.
3. Complete native `Windows.Services.Store` purchase/collection integration and server-side entitlement verification.
4. Run the Windows workflow to build the x64 APPX, test it on Windows 10 and 11, and upload it to Partner Center.
5. Test free limits, monthly trial, renewal, cancellation, expiry, annual entitlement, attachments, and usage resets.
6. Submit for certification. Publishing will remain on manual hold until the owner selects **Publish now**.
