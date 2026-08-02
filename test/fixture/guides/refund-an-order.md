---
title: Refund an order
audience: internal
verified: never
walked-by-agent: 2031-03-04
walked-in: staging — meridian-staging.example.com (v4.2.0), read-only
route: /orders/:orderId/refund
---

# Refund an order

> **`verified: never` — still.** No human has walked this. On 2031-03-04 an agent
> walked it read-only on staging. Each claim below says which it is:
>
> | | |
> |---|---|
> | ✅ | seen rendering in the browser |
> | 📄 | read from source, silent about what renders |
>
> Staging holds no settled orders, so anything that only appears after
> settlement could not be seen. Those claims are 📄.

Issue a full or partial refund against a settled order.

**You need:** the Orders role. **Where:** an order's detail page, at
`/orders/{orderId}/refund`. ✅

## Find the order

1. Open **Orders**. ✅
2. Type into **Search orders…** ✅ (on the Archived tab: **Search archived…** ✅)

The table has four columns, in this order: **Order**, **Placed**, **Total**,
**Status**. 📄

## Issue the refund

1. Press **Refund**. ✅ A panel opens **inline beneath the order summary** — it is
   not a modal. ✅
2. Fill in **Amount** (placeholder: **0.00**). ✅
3. Press **Issue refund**. ✅ It stays disabled until the amount is valid. ✅

An amount above the order total is rejected with **Enter an amount at or below
the order total.** ✅

On success: **Refund issued** — *"{amount} returned to the original payment
method."* 📄

The order stays settled.
→ [ORD-004](../rules/orders/lifecycle.md#ord-004)

## If it doesn't work

| What you see | Why |
|---|---|
| Refund button missing | The order is not settled yet ([ORD-002](../rules/orders/lifecycle.md#ord-002)) |
| Stock did not come back | Refunds do not release holds; cancellation does ([ORD-003](../rules/orders/lifecycle.md#ord-003)) |

All 📄.

## What a human still has to check

Everything marked 📄 is code-accurate and unobserved. Wording is 📄 from source.
