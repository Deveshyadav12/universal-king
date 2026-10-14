# Razorpay Setup Guide - HexaWave

**Version:** 1.0.0  
**Date:** 2026-10-13  
**Status:** Production-Ready Implementation Guide

---

## ⚠️ SECURITY NOTICE

**NEVER EXPOSE YOUR API KEYS IN:**
- GitHub repositories
- Chat conversations (like you just did)
- Email
- Public forums
- Any version control system

**The key `rzp_live_TfLWzKXUeAvF5o` that was exposed MUST be revoked immediately.**

---

## 📋 QUICK START

### Step 1: Revoke Exposed Key
1. Go to: https://dashboard.razorpay.com/#/app/settings/api-keys
2. **Delete** the exposed key `rzp_live_TfLWzKXUeAvF5o`
3. **Generate new keys**

### Step 2: Get New API Keys
1. In Razorpay Dashboard: Settings → API Keys
2. **Test Mode:** Generate test keys (rzp_test_...)
3. **Live Mode:** Generate live keys (rzp_live_...) - **ONLY after testing**

### Step 3: Configure Environment
**Edit `backend/.env` (DO NOT COMMIT THIS FILE):**

```bash
# ========== RAZORPAY CONFIGURATION ==========

# Test Keys (Use these first for development)
HEXAWAVE_RAZORPAY_KEY_ID=rzp_test_YOUR_TEST_KEY_ID
HEXAWAVE_RAZORPAY_KEY_SECRET=YOUR_TEST_KEY_SECRET

# Live Keys (Use only in production after testing)
# HEXAWAVE_RAZORPAY_KEY_ID=rzp_live_YOUR_NEW_LIVE_KEY
# HEXAWAVE_RAZORPAY_KEY_SECRET=YOUR_NEW_LIVE_KEY_SECRET

# Webhook Secret (Set in Razorpay Dashboard)
HEXAWAVE_RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# Enable live payments only after full testing
HEXAWAVE_RAZORPAY_LIVE_ENABLED=false

# Billing Storage (For in-memory fallback - migrate to PostgreSQL)
HEXAWAVE_BILLING_STORE=data/billing.json
```

### Step 4: Test with Test Keys
```bash
# Start backend
cd backend
npm run start:dev

# Test checkout (use test card: 4111 1111 1111 1111)
curl -X POST http://localhost:4000/api/billing/checkout/credits \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"packId":"basic","idempotencyKey":"test-123"}'
```

---

## 🔧 COMPLETE SETUP GUIDE

### Prerequisites
- [ ] Razorpay account created
- [ ] Business verified (for live mode)
- [ ] Domain configured in Razorpay
- [ ] Webhook URL configured

---

## 📝 DETAILED CONFIGURATION

### 1. Razorpay Dashboard Setup

#### A. Generate API Keys
1. Login to: https://dashboard.razorpay.com
2. Go to: Settings → API Keys
3. Click "Generate API Keys"
4. **For Development:** Use Test Mode (rzp_test_...)
5. **For Production:** Use Live Mode (rzp_live_...) after testing

#### B. Configure Webhooks
1. Go to: Settings → Webhooks
2. Click "Add Webhook"
3. **URL:** `https://yourdomain.com/api/billing/webhook`
4. **Events to Subscribe:**
   - `payment.captured`
   - `order.paid`
   - `subscription.activated`
   - `subscription.charged`
   - `subscription.cancelled`
   - `subscription.halted`
   - `refund.processed`
   - `refund.failed`
5. **Secret:** Set a strong secret (32+ characters)
6. Copy this secret to `HEXAWAVE_RAZORPAY_WEBHOOK_SECRET`

#### C. Test Webhook Locally
Use ngrok or similar for local testing:
```bash
# Install ngrok
npm install -g ngrok

# Start ngrok
ngrok http 4000

# Use ngrok URL in Razorpay webhook
# e.g., https://abc123.ngrok.io/api/billing/webhook
```

---

### 2. Configure HexaWave Backend

#### A. Environment Variables

**Required in `backend/.env`:**

```bash
# Razorpay Credentials
HEXAWAVE_RAZORPAY_KEY_ID=your_key_id
HEXAWAVE_RAZORPAY_KEY_SECRET=your_key_secret

# Webhook Verification
HEXAWAVE_RAZORPAY_WEBHOOK_SECRET=your_webhook_secret

# Live Mode (false for development, true for production)
HEXAWAVE_RAZORPAY_LIVE_ENABLED=false

# Billing Storage (In-memory - MIGRATE TO POSTGRESQL for production)
HEXAWAVE_BILLING_STORE=data/billing.json
```

**⚠️ IMPORTANT:**
- Use **test keys** for development
- Use **live keys** only in production
- Set `HEXAWAVE_RAZORPAY_LIVE_ENABLED=false` during development
- Only set to `true` after full testing

#### B. Verify Configuration

```bash
# Check billing configuration
curl -X GET http://localhost:4000/api/billing/admin/config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"

# Expected response:
{
  "checkoutEnabled": false,
  "softwareRequestAmountPaise": null,
  "creditsPerAiAction": 0,
  "plans": { ... },
  "creditPacks": [],
  "provider": {
    "credentialsConfigured": true,
    "webhookConfigured": true,
    "mode": "test",
    "livePaymentsEnabled": false
  }
}
```

---

### 3. Enable Checkout

#### A. Configure Plans (Admin)

```bash
# Enable checkout and configure plans
curl -X PUT http://localhost:4000/api/billing/admin/config \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "checkoutEnabled": true,
    "softwareRequestAmountPaise": 500000,
    "creditsPerAiAction": 10,
    "plans": {
      "pro": {
        "enabled": true,
        "amountPaise": 290000,
        "interval": "monthly",
        "razorpayPlanId": "plan_YOUR_PLAN_ID"
      }
    },
    "creditPacks": [
      {
        "id": "basic",
        "label": "100 Credits",
        "credits": 100,
        "amountPaise": 100000
      }
    ]
  }'
```

#### B. Create Razorpay Plans

1. Go to: Razorpay Dashboard → Settings → Plans
2. Create plans matching your configuration
3. Copy the `plan_ID` to use in HexaWave config

**Example Plan:**
- Plan ID: `plan_XXXXXXXXXXXXXX`
- Amount: ₹2900 (290000 paise)
- Interval: Monthly
- Currency: INR

---

### 4. Test Payments

#### A. Test Checkout Flow

```bash
# 1. Get user token
TOKEN=$(curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password"}' | jq -r '.token')

# 2. Create checkout
CHECKOUT=$(curl -X POST http://localhost:4000/api/billing/checkout/credits \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"packId":"basic","idempotencyKey":"test-'$(date +%s)'"}')

echo $CHECKOUT | jq .

# Expected response:
{
  "paymentIntentId": "...",
  "kind": "credits",
  "amountPaise": 100000,
  "currency": "INR",
  "keyId": "rzp_test_...",
  "orderId": "order_..."
}
```

#### B. Complete Payment (Test Mode)

1. Open Razorpay test checkout with the returned `orderId`
2. **Test Card:** `4111 1111 1111 1111`
3. **Expiry:** Any future date
4. **CVV:** Any 3 digits
5. **Name:** Any name

#### C. Verify Payment

```bash
# After successful payment
curl -X POST http://localhost:4000/api/billing/checkout/verify \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "paymentIntentId": "...",
    "razorpay_payment_id": "pay_...",
    "razorpay_order_id": "order_...",
    "razorpay_signature": "..."
  }'
```

---

## 💳 PAYMENT TYPES SUPPORTED

### 1. Subscription Payments
- Recurring billing
- Monthly/Yearly plans
- Automatic renewal
- Webhook-based activation

**API:** `POST /api/billing/checkout/subscription`
```json
{
  "planId": "pro",
  "idempotencyKey": "unique-key-123"
}
```

### 2. Credit Pack Payments
- One-time credit purchases
- Instant credit delivery
- For AI actions

**API:** `POST /api/billing/checkout/credits`
```json
{
  "packId": "basic",
  "idempotencyKey": "unique-key-123"
}
```

### 3. Software Request Payments
- One-time software request fee
- Linked to project creation
- Requires company account

**API:** `POST /api/billing/checkout/software-request`
```json
{
  "request": {
    "companyName": "My Company",
    "productName": "My App",
    "purpose": "Business automation",
    "languages": ["typescript", "python"]
  },
  "idempotencyKey": "unique-key-123"
}
```

---

## 🔄 WEBHOOK HANDLING

### Webhook Endpoint
**URL:** `POST /api/billing/webhook`

### Supported Events
- `payment.captured` - Payment successful
- `order.paid` - Order paid
- `subscription.activated` - Subscription started
- `subscription.charged` - Recurring charge
- `subscription.cancelled` - Subscription cancelled
- `subscription.halted` - Subscription paused
- `refund.processed` - Refund completed
- `refund.failed` - Refund failed

### Webhook Verification
The service automatically:
1. Verifies the signature using `HEXAWAVE_RAZORPAY_WEBHOOK_SECRET`
2. Prevents duplicate event processing
3. Updates payment status
4. Triggers fulfillment for software requests
5. Handles refunds

---

## 💰 CURRENCY & AMOUNTS

### Important Notes
- **All amounts are in PAISE** (1 INR = 100 paise)
- **Currency:** INR only
- **Minimum amount:** 100 paise (₹1)

### Conversion
| INR | Paise |
|-----|-------|
| ₹1 | 100 |
| ₹10 | 1000 |
| ₹100 | 10000 |
| ₹1000 | 100000 |

---

## 🔒 SECURITY BEST PRACTICES

### 1. Never Commit Keys
```bash
# .gitignore
backend/.env
ai/.env
.env
*.env
```

### 2. Use Environment Variables
```typescript
// ✅ GOOD
const keyId = process.env.HEXAWAVE_RAZORPAY_KEY_ID;

// ❌ BAD
const keyId = 'rzp_live_XXXXXX';
```

### 3. Enable in Production Only After Testing
```bash
# Development (test keys)
HEXAWAVE_RAZORPAY_LIVE_ENABLED=false

# Production (live keys, after testing)
HEXAWAVE_RAZORPAY_LIVE_ENABLED=true
```

### 4. Use HTTPS for Webhooks
- Razorpay requires HTTPS for webhooks
- Use ngrok for local development
- In production, use valid SSL certificate

### 5. Validate All Inputs
The existing service already validates:
- Idempotency keys
- Payment signatures
- Webhook signatures
- Plan configurations
- Amount ranges

---

## 📊 TESTING CHECKLIST

### Before Going Live

- [ ] Test keys work in development
- [ ] Webhook receives events correctly
- [ ] Payment verification works
- [ ] Signature validation works
- [ ] Duplicate payment prevention works
- [ ] Refund processing works
- [ ] Subscription lifecycle works
- [ ] Credit system works
- [ ] Software request fulfillment works
- [ ] All error cases handled

### Live Mode Checklist

- [ ] Live keys generated
- [ ] Webhook URL is HTTPS
- [ ] Business verified in Razorpay
- [ ] All plans created in Razorpay
- [ ] HEXAWAVE_RAZORPAY_LIVE_ENABLED=true
- [ ] Backup of test data
- [ ] Monitoring in place

---

## 🐛 TROUBLESHOOTING

### Common Issues

#### 1. Signature Verification Failed
**Cause:** Webhook secret mismatch
**Fix:** Verify `HEXAWAVE_RAZORPAY_WEBHOOK_SECRET` matches Razorpay dashboard

#### 2. Payment Not Captured
**Cause:** Test card not used
**Fix:** Use test card `4111 1111 1111 1111` in test mode

#### 3. Invalid Plan ID
**Cause:** Razorpay plan not created or ID mismatch
**Fix:** Create plan in Razorpay dashboard and update `razorpayPlanId`

#### 4. Checkout Disabled
**Cause:** `checkoutEnabled: false` in config
**Fix:** Update configuration via admin endpoint

#### 5. Live Payments Blocked
**Cause:** `HEXAWAVE_RAZORPAY_LIVE_ENABLED=false`
**Fix:** Set to `true` only after full testing

### Debugging

```bash
# Check billing configuration
curl -X GET http://localhost:4000/api/billing/admin/config \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check user account
curl -X GET http://localhost:4000/api/billing/account \
  -H "Authorization: Bearer YOUR_TOKEN"

# Check catalog
curl -X GET http://localhost:4000/api/billing/catalog
```

---

## 📚 API REFERENCE

### Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/billing/catalog` | Public catalog | Public |
| GET | `/api/billing/admin/config` | Admin configuration | Admin |
| PUT | `/api/billing/admin/config` | Update configuration | Admin |
| GET | `/api/billing/account` | User account details | User |
| POST | `/api/billing/checkout/subscription` | Create subscription checkout | User |
| POST | `/api/billing/checkout/credits` | Create credits checkout | User |
| POST | `/api/billing/checkout/software-request` | Create software request checkout | User |
| POST | `/api/billing/checkout/verify` | Verify payment | User |
| POST | `/api/billing/webhook` | Webhook endpoint | Public |

---

## 🎯 NEXT STEPS

### 1. Revoke Exposed Key (IMMEDIATE)
- Delete `rzp_live_TfLWzKXUeAvF5o` from Razorpay
- Generate new live keys

### 2. Configure Test Keys
- Set up test keys in `backend/.env`
- Test all payment flows

### 3. Migrate to PostgreSQL (For Production)
The current billing service uses JSON file storage. For production:
- Migrate to PostgreSQL tables
- Add proper tenant isolation
- Add indexes for performance

### 4. Enable in Production
- Switch to live keys
- Set `HEXAWAVE_RAZORPAY_LIVE_ENABLED=true`
- Monitor payments

---

## 📞 SUPPORT

### Razorpay Documentation
- https://razorpay.com/docs/api/
- https://razorpay.com/docs/payments/
- https://razorpay.com/docs/webhooks/

### HexaWave Billing
The existing `BillingService` already implements:
- ✅ Razorpay API integration
- ✅ Payment creation
- ✅ Webhook handling
- ✅ Signature verification
- ✅ Subscription management
- ✅ Credit system
- ✅ Software request payments
- ✅ Refund processing
- ✅ Idempotency key support

**What needs to be added:**
- [ ] PostgreSQL migration (for production)
- [ ] Tenant isolation (multi-tenant)
- [ ] Better error handling for edge cases
- [ ] Analytics and reporting

---

**Document Version:** 1.0.0  
**Last Updated:** 2026-10-13  
**Status:** Ready for Implementation

**⚠️ REMEMBER:** The exposed key `rzp_live_TfLWzKXUeAvF5o` must be revoked immediately!
