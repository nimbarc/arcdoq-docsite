---
area: orders
verified: 2031-03-04
---

# An order is placed and settled

What the system does from the moment a basket is submitted to the moment the
stock actually leaves, and what each step leaves behind. Conditional detail
links down to a rule rather than being restated here.

> **How do I** issue a refund against one of these? That is the guide:
> [Refund an order](../guides/refund-an-order.md).

---

## The basket is submitted

Availability is checked inside the same transaction that writes the order, so
two simultaneous submissions cannot both win the last unit.
→ [ORD-001](../rules/orders/lifecycle.md#ord-001)

## Stock is held, not taken

The order owns a hold rather than a deduction, and the deduction waits for
settlement. A hold that is never settled expires on its own, so an abandoned
basket does not strand inventory.
→ [ORD-002](../rules/orders/lifecycle.md#ord-002)

## The order settles, or it is cancelled

Cancelling releases the hold. Cancelling twice releases once — the second call
reports no change rather than erroring.
→ [ORD-003](../rules/orders/lifecycle.md#ord-003)

## A refund, if one comes, leaves the order settled

The refund is recorded against the order and the order's own state does not
move. Re-opening it would let a second settlement run.
→ [ORD-004](../rules/orders/lifecycle.md#ord-004)

---

## What can go wrong

| Symptom | Likely cause |
|---|---|
| Stock did not come back after a refund | Refunds do not release holds; cancellation does ([ORD-003](../rules/orders/lifecycle.md#ord-003)) |
| Cancelling twice reported nothing the second time | Working as designed ([ORD-003](../rules/orders/lifecycle.md#ord-003)) |
| An order settled against stock that was gone | The hold expired before settlement ([ORD-002](../rules/orders/lifecycle.md#ord-002)) |
