---
area: orders
topic: lifecycle
status: in-stage
verified: 2031-03-04
sources:
  - repo: core
    path: Meridian.Business/Services/OrderService.cs
---

# Orders — lifecycle

How an order moves from placed to settled, and what each transition is allowed
to touch.

> **Statuses on this page are computed, not asserted.** Do not hand-edit a
> `**Status:**` field; it will be overwritten.
>
> **Two rules moved this release.** ORD-003 and ORD-004 changed on staging.

---

## Placing and cancelling

<a id="ord-001"></a>
### ORD-001 — An order cannot be placed against unavailable stock

**Status:** implemented · **Test:** `core:Place_Rejects_WhenStockUnavailable` · **Source:** `core:Meridian.Business/Services/OrderService.cs#PlaceAsync`

Availability is checked inside the same transaction that writes the order, so
two simultaneous placements cannot both succeed against one unit.

<a id="ord-002"></a>
### ORD-002 — Placing an order holds stock rather than deducting it

**Status:** implemented · **Source:** `core:Meridian.Business/Services/OrderService.cs#PlaceAsync` — the deduction happens at settlement, not at placement

A hold expires on its own if the order is never settled, so an abandoned basket
does not strand inventory. *(No test asserts this; it is the absence of a
deduction call.)*

<a id="ord-003"></a>
### ORD-003 — A cancelled order releases its stock hold

**Status:** in-stage · **Test:** `core:Cancel_ReleasesHold`, `core:Cancel_IsIdempotent` · **Source:** `core:Meridian.Business/Services/OrderService.cs#CancelAsync`

Cancelling twice releases once. The second call reports no change rather than
erroring.

---

## Refunds

<a id="ord-004"></a>
### ORD-004 — A refund never re-opens a settled order

**Status:** in-stage · **Test:** `core:Refund_LeavesOrderSettled` · **Source:** `core:Meridian.Business/Services/RefundService.cs#IssueAsync`

The order stays settled and the refund is recorded against it. Re-opening would
let a second settlement run, which is what [ORD-001](#ord-001) exists to prevent.
