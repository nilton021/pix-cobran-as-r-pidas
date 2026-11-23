<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep the public homepage independent of account/payment queries; the operational dashboard lives under the authenticated subtree so sharing never reveals financial data.
- Maintain the router-derived sitemap with explicit staticData decisions on every route; exclude the authenticated subtree, login, payment links and APIs to protect private content.
- Keep credential configuration eligibility separate from payment availability in the provider catalogue; opening a credential form must not claim a bank connection has been verified.
- Keep card-present contracts, mock adapter, persistence and handlers in separate modules; this isolates the extension from existing Pix/v1 behavior.
- Gate card APIs on the server flag and card UI on its explicit browser mirror; fail closed before any card storage access so unapplied proposals cannot affect Pix.
- Keep unapproved card SQL in documented proposals outside managed migrations and the journal; promotion requires approval and the existing production migration pipeline.
- Use atomic account-serialized card creation, durable event leases and tenant-validation triggers; this prevents duplicate sessions and cross-account links without changing Pix helpers.
- Keep mock sessions tied only to inactive sandbox integrations and never mark their charges paid; simulated approvals must not masquerade as real receipts.
