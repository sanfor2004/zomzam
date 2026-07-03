# Outreach Providers

This file condenses the previous deep-search notes for bulk SMS and email outreach. Treat it as a planning baseline, not a final purchasing decision.

## Use Case

Send outreach to roughly 4,000-5,000 contacts across:

- Egypt
- United States
- Europe

Channels:

- Email campaigns.
- SMS campaigns.
- Future CRM/outreach integrations.

## Practical Recommendation

Use different tools by region/channel rather than forcing one provider to do everything.

Suggested split:

- Global email: Brevo or a comparable email-first provider.
- US/EU SMS API: Plivo or a comparable CPaaS with transparent pricing.
- Egypt SMS: local/regional provider such as VictoryLink or CEQUENS, because sender ID registration and delivery rules are region-specific.

## Provider Notes

### Brevo

Best fit:

- Global email campaigns.
- Simple list management.
- Email templates and deliverability tooling.

Watch:

- SMS pricing and availability by country may not be ideal.
- Verify compliance and sender requirements before use.

### Plivo

Best fit:

- Developer-friendly SMS API.
- US/EU SMS cost control.

Watch:

- Egypt delivery may be harder or more expensive through international CPaaS.
- Sender ID and local telecom requirements can affect deliverability.

### VictoryLink

Best fit:

- Egypt SMS.
- Local sender ID/telecom knowledge.

Watch:

- API quality and developer experience should be tested.
- Pricing and setup may require direct sales conversation.

### CEQUENS

Best fit:

- Middle East enterprise messaging.
- Regional compliance and sender identity support.

Watch:

- May be more enterprise-oriented than needed for early experiments.
- Confirm minimums and onboarding friction.

## Egypt SMS Warning

Egypt often requires sender ID registration and local compliance steps. International APIs may appear to support Egypt but still produce poor delivery, blocked sender IDs, or higher effective costs.

Before committing:

1. Ask whether sender ID registration is required.
2. Ask expected approval time.
3. Ask deliverability by carrier.
4. Ask whether promotional traffic is allowed.
5. Ask for exact price per delivered SMS.
6. Test a small batch before scaling.

## Decision Matrix

| Need | Best direction |
| --- | --- |
| Newsletter and cold email sequences | Email-first provider such as Brevo |
| US/EU transactional or outreach SMS | API-first provider such as Plivo |
| Egypt SMS at scale | Local/regional provider such as VictoryLink or CEQUENS |
| One unified dashboard | Possible later, but do not sacrifice deliverability |

## Compliance Notes

Bulk outreach must respect:

- Consent and unsubscribe rules.
- Regional anti-spam law.
- Message sender identity requirements.
- Email domain warmup and authentication.
- SMS promotional traffic restrictions.

Do not integrate a provider until legal/compliance rules are verified for the target market.
