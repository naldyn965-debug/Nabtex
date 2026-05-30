# 🛒 Nabtex — Agricultural Marketplace Module

## دليل النشر والإعداد | Deployment & Setup Guide

-----

## 📁 الملفات المُضافة | Files Added

```
Project-99-main/
├── index.html              ← modified (marketplace injected)
├── firestore.rules         ← NEW: Firestore security rules
├── firestore.indexes.json  ← NEW: Composite indexes for fast queries
├── storage.rules           ← NEW: Storage security rules
└── MARKETPLACE_SETUP.md    ← this file
```

-----

## 🔥 Firebase Console Setup

### 1. Deploy Firestore Rules

In Firebase Console → Firestore → Rules, paste contents of `firestore.rules`
**OR** via CLI:

```bash
firebase deploy --only firestore:rules
```

### 2. Deploy Firestore Indexes

```bash
firebase deploy --only firestore:indexes
```

> ⚠️ Indexes take 2–5 minutes to build. The app works immediately but
> complex filtered queries may fail until indexes are ready.

### 3. Deploy Storage Rules

Firebase Console → Storage → Rules, paste `storage.rules`
**OR:**

```bash
firebase deploy --only storage
```

### 4. Enable Firebase Storage

If not already enabled:

- Firebase Console → Storage → Get Started → Production mode
- Choose a storage region (e.g., `europe-west1` or `us-central1`)

-----

## 🗄️ Firestore Collections Created

|Collection                 |Purpose                            |
|---------------------------|-----------------------------------|
|`marketplace_products`     |All product listings               |
|`marketplace_orders`       |Buyer → Seller order requests      |
|`marketplace_reviews`      |Star ratings + text reviews        |
|`marketplace_notifications`|Real-time alerts (orders, products)|


> These are **100% independent** from existing Nabtex collections.
> No existing collection is touched.

-----

## 🧩 Product Document Schema

```js
marketplace_products/{auto-id} {
  title:        string,          // "طماطم عسكلاني"
  category:     string,          // "خضروات"
  description:  string,
  price:        number,          // in EGP
  unit:         string,          // "كيلو" | "طن" | ...
  stock:        number,
  status:       string,          // "active" | "sold" | "inactive"
  governorate:  string,          // Egyptian governorate
  area:         string,          // sub-area / village
  phone:        string,
  whatsapp:     string,
  images:       string[],        // Firebase Storage download URLs
  ownerId:      string,          // Firebase Auth UID
  sellerName:   string,
  trusted:      boolean,         // manual verification badge
  avgRating:    number,          // 0–5, auto-calculated
  reviewCount:  number,
  views:        number,          // incremented on detail open
  createdAt:    Timestamp,
  updatedAt:    Timestamp
}
```

-----

## 📦 Order Document Schema

```js
marketplace_orders/{auto-id} {
  productId:  string,
  buyerId:    string,
  sellerId:   string,
  buyerName:  string,
  quantity:   number,
  notes:      string,
  status:     string,    // "pending" | "accepted" | "rejected"
  createdAt:  Timestamp,
  updatedAt:  Timestamp
}
```

-----

## ⭐ Review Document Schema

```js
marketplace_reviews/{auto-id} {
  productId:  string,
  sellerId:   string,
  userId:     string,
  userName:   string,
  rating:     number,    // 1–5
  text:       string,
  createdAt:  Timestamp
}
```

-----

## 🔔 Notification Document Schema

```js
marketplace_notifications/{auto-id} {
  userId:     string,    // recipient UID
  type:       string,    // "new_order" | "new_product" | "price_update" | "review"
  message:    string,
  productId:  string,
  read:       boolean,
  createdAt:  Timestamp
}
```

-----

## 🔧 Optional: Mark a Seller as Trusted

In Firebase Console → Firestore → `marketplace_products`:

- Find the product document
- Set `trusted: true`

Or via Admin SDK:

```js
await admin.firestore()
  .collection('marketplace_products')
  .doc(PRODUCT_ID)
  .update({ trusted: true });
```

-----

## 🚀 Features Included

|Feature                               |Status|
|--------------------------------------|------|
|Product grid with lazy loading        |✅     |
|Search (partial match, multi-field)   |✅     |
|Filter by category, governorate, price|✅     |
|Sort by newest / price / rating       |✅     |
|Active filter chips UI                |✅     |
|Add product form with image upload    |✅     |
|Firebase Storage multi-image upload   |✅     |
|Product detail page with gallery      |✅     |
|WhatsApp contact button               |✅     |
|Call button                           |✅     |
|Order request system (MVP)            |✅     |
|Star rating + reviews                 |✅     |
|Seller dashboard (My Products)        |✅     |
|Edit / Delete / Mark Sold             |✅     |
|Seller stats (views, orders, counts)  |✅     |
|Order management (accept/reject)      |✅     |
|Real-time notifications               |✅     |
|Notification badge counter            |✅     |
|Trusted seller badge                  |✅     |
|Skeleton loading screens              |✅     |
|Pagination (load more)                |✅     |
|Mobile responsive                     |✅     |
|RTL Arabic UI                         |✅     |
|Dark mode compatible                  |✅     |
|Existing farm system untouched        |✅     |

-----

## 🛡️ Architecture Notes

- The entire marketplace is wrapped in a **single IIFE** (`(function(){ ... })()`)
  so it shares **zero global variables** with the farm system.
- The only shared resources are: `auth`, `db`, `storage` (Firebase SDK globals
  already initialized by the existing app), and `showPage()` (the SPA router).
- All new Firestore collections use the prefix `marketplace_` to avoid any
  future naming collision.
- The `window.MKT` public API is the only global export from the module.

-----

## 📈 Scaling Notes

- Firestore compound indexes cover all 4 main filter combinations.
- Client-side search (text partial match) is intentional for MVP —
  for scale, integrate **Algolia** or **Typesense** and replace `_loadProducts`.
- Image uploads go to `marketplace/{userId}/{timestamp}_{filename}` —
  add a Cloud Function to generate thumbnails for performance at scale.
- For geo-proximity sorting at scale, store a `geohash` field and use
  **GeoFirestore** or a Cloud Function endpoint.