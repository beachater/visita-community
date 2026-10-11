# Visita tier status

As of 12 October 2026. A tier says *when* something is built (confirmed 28 September 2026).

## Tier 1: built, not yet signed off

All nine tasks are implemented, plus hosted Supabase, Google sign-in and both Workers deployed. That is ahead of the planned 6 November finish.

Still open before Tier 1 is signed off:

- Live Google sign-in on the deployed links.
- The physical-phone checklist.
- Real scans on iOS Safari and a mid-range Android.
- Deploying the newer work: the consumer restyle, the admin sidebar and the two dev fixes are committed but not live.

## Tier 2: after Tier 1, aimed at launch

| Feature | What it means | Can it start now? |
|---|---|---|
| Amenity verification | Visitors confirm a venue's amenities (wifi, outlets and so on). No points yet. | Yes |
| Menu photo capture | The owner photographs the menu; OCR plus a free-tier AI turns it into menu items. Typing items by hand still works. | Yes |
| Billing (manual) | An admin records payments against a venue; the owner sees their status. No in-app payments. | Mostly. Prices wait on the business model (due 6 November). |
| Offline support | Pages a visitor has already seen still work without signal. | Yes |
| Admin demand queue | Admins see which unscanned cafes visitors keep asking for (from the demand button). | Yes |
| Google Places fallback | Search also shows cafes not yet on Visita. | No. Needs project-head approval, an API key and billing (by 20 November). |
| Marketing pages | Home page sections, For Cafes (pricing), About, Contact, FAQ. These routes are placeholders today. | Partly. Pricing waits on the business model. |

Good candidates to start now on the owner/admin side: the admin demand queue, amenity verification and the admin side of manual billing.

## Tier 3: after launch

Waits on cafe-owner and interview decisions:

- Points, awards, badges, check-ins, referral codes, vouchers and boosted listings, community page.
- Monthly report, monthly user recap, fraud monitoring, subscription and churn view, audit log.

## Timeline

| Phase | Dates |
|---|---|
| Tier 1 build | 28 Sep – 6 Nov |
| Checkpoint A: visitor flow | Fri 23 Oct |
| Checkpoint B: owner and admin | Fri 6 Nov |
| Stakeholder testing | 9 – 20 Nov |
| Fix round 1, with Tier 2 alongside | 23 Nov – 4 Dec |
| Visual design pass (final UI/UX and branding) | 23 Nov – 4 Dec |
| Public beta | 7 – 18 Dec |
| Fix round 2 and launch prep | 21 – 28 Dec |
| **Launch** | **Tue 29 Dec 2026** |
