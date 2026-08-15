# Project status

## Completed in the first MVP

- Electron/React Windows desktop interface
- TypeScript backend with server-side OpenAI integration
- Streaming assistant responses
- Conversation creation, history, and deletion
- Free plan with five questions per day in Fast mode
- Seven-day Microsoft Store monthly trial
- Monthly USD $14.99 and annual USD $79.99 plan metadata
- Subscriber access to Fast and Advanced modes
- Subscriber image/document uploads (5 MB), image analysis/editing, and document analysis/rewrite flows
- 1,000-message monthly limits and usage accounting for paid plans
- Signed development sessions
- In-app upgrade presentation
- Microsoft Store identity and subscription IDs for product `9NX17RBKP4HJ`
- English Store listing draft
- English Store listing saved in Partner Center with the free-tier screenshot and accurate plan limits
- A second current screenshot showing Free, Monthly, and Annual plans is uploaded to the English Store listing with an accessibility caption
- Main-app pricing and availability saved as free in all 240 Store markets
- Monthly and annual add-on listings corrected to advertise only implemented text-chat modes and limits
- IARC questionnaire and generated age ratings completed in Partner Center (global 12+, ESRB Teen, Brazil 14, Russia 18+)
- Final logo prepared as Windows ICO/PNG and Microsoft Store 1080, 300, 150, and 71 px assets
- Certification notes
- Final English Privacy Policy with publisher contact details; Terms of Use draft
- Partner Center Properties completed with the privacy policy and support email
- Public privacy page deployed at `https://ai-chatbot-ask-ai-gpt-privacy.grauremihai439.chatgpt.site`
- Privacy URL and support email saved; Properties is complete for the main app, monthly subscription, and annual subscription
- Submission publishing is held for manual release after certification
- Certification testing notes are saved in Partner Center
- Windows x64 build workflow added; APPX finalization must run on Windows because MakeAppx is unavailable on macOS
- Upgrade buttons now open the monthly and annual Microsoft Store product pages
- Production Docker image and mandatory production secret checks added
- TypeScript validation, production web build, API smoke test, and browser UI test

## External items still required

1. Complete Microsoft Partner Center tax and payout information.
2. Add OpenAI billing and create the production service-account key only after a deployment secret manager exists.
3. Select and create the production hosting account and database.
4. Create/join a Microsoft Entra tenant, then implement Microsoft Store purchase and entitlement verification. The legacy personal-account registration is outside a directory and Partner Center does not retain it.
5. Review the final logo assets and add optional poster/hero artwork if desired.
6. Add an optional dedicated public support website/domain before release if desired.
7. Replace the guest development session with production identity and account deletion/export flows.
8. Complete final legal review, age policy, and market/tax setup.
9. Run the Windows APPX/MSIX package build and Store certification tests on Windows.
10. Add and validate any future audio or web features before advertising them.

## Release risks to resolve

- The Store title is `AI Chatbot・Ask AI Anything`. The earlier title and the `GPT` keyword were rejected under Microsoft Store naming and search-term policies and must not be restored.
- A product that only reproduces another chatbot may fail Microsoft's distinct-value requirement. The release version should offer a clear differentiator such as Windows workflow actions, document workspace, specialist modes, or privacy controls.
- An individual Partner Center account may not be appropriate for a commercial subscription business. Confirm the final publisher/account type before submission.
- The saved IARC rating is 12+ globally and varies by market (including Teen in the United States and 18+ in Russia). Recheck the questionnaire whenever shipped capabilities change.
- "Does anything" cannot be represented as a literal product promise. Every shipped capability must be implemented, testable, accurately described, and covered by content safeguards.
- The annual price is a 56% discount from twelve monthly payments. Final usage caps must be validated against real OpenAI, hosting, tax, refund, support, and commerce costs before publishing the price.
