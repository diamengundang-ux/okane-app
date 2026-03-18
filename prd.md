# PRD — Okane: Kakeibo Budgeting App

## TL;DR
Okane adalah aplikasi budgeting berbasis metode Jepang **Kakeibo** yang membantu pengguna mengelola keuangan secara sadar melalui pencatatan, budgeting, dan refleksi rutin. Aplikasi ini mobile-first, minimalis, dan menggunakan login Google untuk onboarding cepat.

---

## Problem Statement
Banyak pengguna:
- Tidak sadar kemana uang mereka habis
- Tidak punya sistem refleksi keuangan
- Merasa aplikasi budgeting terlalu kompleks

### Opportunity
Menggabungkan:
- Filosofi Kakeibo (mindful spending)
- UI modern & minimalis
- Habit-forming experience

---

## Goals

### Business Goals
- 50K MAU dalam 6 bulan
- Retention > 40% (monthly)
- Conversion premium > 5%

### User Goals
- Melihat kondisi keuangan dengan jelas
- Mengontrol pengeluaran
- Mencapai tujuan finansial

### Non-Goals (MVP)
- Tidak ada integrasi bank API
- Tidak fokus investasi
- Tidak multi-currency

---

## Target User
- Gen Z & Milenial (18–35)
- First-jobbers / pekerja muda
- Pengguna yang ingin mulai mengatur keuangan

---

## Core Features (MVP)

1. Google Authentication
2. Dashboard keuangan
3. Transaction tracking (income & expense)
4. Budgeting (Kakeibo categories)
5. Reflection (mingguan/bulanan)
6. Goals sederhana

---

## User Stories

- User dapat login dengan Google
- User dapat mencatat transaksi <10 detik
- User dapat melihat sisa uang bulan ini
- User dapat set budget per kategori
- User dapat melakukan refleksi keuangan
- User dapat membuat goal finansial

---

## User Flow

### 1. Authentication
- User klik "Login with Google"
- OAuth success
- System:
  - Create user in DB (if not exist)
  - Redirect ke dashboard

---

### 2. Dashboard

#### Components:
- Total balance bulan ini
- Income summary
- Expense summary
- Remaining budget
- Quick action (+ tambah transaksi)

---

### 3. Add Transaction

#### Input:
- Amount
- Type (Income / Expense)
- Category
- Note (optional)

#### Behavior:
- Save instantly
- Update dashboard realtime

---

### 4. Budgeting (Kakeibo)

#### Categories:
- Needs
- Wants
- Culture
- Unexpected

#### Features:
- Set monthly budget
- Track usage per category
- Highlight over-budget

---

### 5. Reflection (Core Differentiator)

#### Frequency:
- Weekly / Monthly

#### Questions:
- Berapa uang tersisa?
- Apa yang bisa diperbaiki?
- Apa yang harus dikurangi?

#### Output:
- User journaling text
- Saved in database

---

### 6. Goals

#### Example:
- "Beli laptop"
- "Dana darurat"

#### Features:
- Target amount
- Current progress
- Progress bar

---

## UX Principles

- Mobile-first design
- Minimal UI (focus angka, bukan teks)
- Fast input (<10 detik per transaksi)
- No clutter
- Dark/light mode

---

## Success Metrics

- Daily Active Users (DAU)
- Transactions per user/week
- Retention Day 7 & Day 30
- Budget adherence rate
- Reflection completion rate

---

## Technical Architecture

### Frontend
- Next.js (App Router)
- Tailwind CSS
- Mobile responsive (PWA ready)

### Backend
- Node.js (Express / NestJS)
- REST API

### Authentication
- Google OAuth (Firebase Auth / Auth0)

### Database
- PostgreSQL
- Prisma ORM

### Deployment
- Frontend: Vercel
- Backend: Railway / Supabase

---

## Database Schema

### Users
- id (UUID)
- email
- name
- created_at

### Transactions
- id
- user_id (FK)
- amount
- type (income/expense)
- category
- note
- created_at

### Budgets
- id
- user_id (FK)
- category
- limit

### Reflections
- id
- user_id (FK)
- content
- created_at

### Goals
- id
- user_id (FK)
- title
- target_amount
- current_amount
- created_at

---

## API Endpoints (Draft)

### Auth
- POST /auth/google

### Users
- GET /user/profile

### Transactions
- GET /transactions
- POST /transactions
- DELETE /transactions/:id

### Budgets
- GET /budgets
- POST /budgets

### Reflections
- GET /reflections
- POST /reflections

### Goals
- GET /goals
- POST /goals

---

## Milestones

### Phase 1 (2–4 weeks)
- Google Auth
- Dashboard basic
- CRUD transaksi

### Phase 2 (3–5 weeks)
- Budgeting system
- Categories
- Summary analytics

### Phase 3 (2–3 weeks)
- Reflection feature
- Goals tracking

### Phase 4 (Future)
- AI financial insights
- Bank integration
- Native mobile app

---

## Narrative (Vision)

Okane membantu pengguna bukan hanya mencatat uang, tetapi memahami kebiasaan finansial mereka.

Dari:
> “Uang saya habis entah kemana”

Menjadi:
> “Saya tahu kemana uang saya pergi, dan saya mengontrolnya”

---

## Risks & Considerations

- User churn jika tidak ada habit trigger
- Input manual bisa terasa berat
- Kompetitor budgeting app cukup banyak

---

## Recommended Enhancements

- Daily reminder notification
- Spending insights otomatis
- Gamification (streak)
- Smart categorization

---

## MVP Focus (Critical)

Jika harus memilih, fokus utama:
> Reflection + Awareness loop

Karena ini adalah pembeda utama dari aplikasi budgeting lain.

---