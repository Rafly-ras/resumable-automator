# resumable-automator 🚀

**AI Gatekeeper & Stateful Task Orchestrator** untuk proyek Node.js & TypeScript.

`resumable-automator` adalah perkakas CLI yang dirancang untuk mengisolasi konteks AI Coding Assistant (seperti ChatGPT, Claude, Gemini, dll) agar mengeksekusi instruksi proyek secara sekuensial (fase demi fase), mencatat status eksekusi (*stateful*), dan mencegah AI melompat ke fase selanjutnya sebelum seluruh tugas pada fase aktif diselesaikan (*Hard Blocker*).

---

## ⚡ Fitur Utama

- 🔒 **AI Gatekeeper Prompt Isolation**: Menghasilkan Strict System Prompt otomatis untuk mengunci AI agar hanya fokus pada fase aktif.
- 📋 **GFM Markdown Task Parser**: Mendeteksi GFM Task List (`- [ ]` dan `- [x]`) serta mengkalkulasi persentase keterselesaian tugas.
- 🗂️ **Auto-Chunking & Natural Sorting**: Membaca file Markdown di folder `./TRD` dan mengurutkannya secara alami (`phase-2.md` sebelum `phase-10.md`).
- 💾 **Stateful Execution**: Menyimpan progress eksekusi proyek di `.automator/state.json`.
- ⛔ **Hard Blocker Transition**: Perintah `next` secara otomatis menolak transisi ke fase berikutnya jika tugas pending belum 100% selesai.

---

## 📦 Instalasi & Setup

### 1. Di dalam Proyek Target (Paling Diabstraksikan)
Instal package ke dalam proyek Anda:
```bash
npm install resumable-automator
```
Atau jalankan langsung tanpa instalasi global menggunakan `npx`:
```bash
npx automator --help
```

---

### 2. Setup Lokal (Pengembangan Package)
Jika Anda meng-clone repositori ini untuk pengembangan lokal:
```bash
# Install dependensi
npm install

# Build TypeScript
npm run build

# Jalankan CLI secara lokal
npm start -- --help
# atau
node bin/automator.js --help
```

---

## 📂 Struktur Direktori Proyek Target

Agar `resumable-automator` dapat bekerja, buat folder bernama `TRD` di root direktori proyek Anda dan letakkan dokumentasi fase (.md) di dalamnya:

```text
proyek-anda/
├── TRD/
│   ├── 01-phase-1.md
│   ├── 02-phase-2.md
│   └── 03-phase-3.md
├── .automator/            <-- Dibuat otomatis untuk menyimpan state.json
│   └── state.json
├── package.json
└── README.md
```

---

## ✍️ Format Penulisan Markdown di `./TRD`

Gunakan heading seperti `## Phase`, `### Tahap`, atau `## Step`, lalu tambahkan GFM Checklists (`- [ ]` / `- [x]`):

```markdown
# Technical Requirements Document - Feature Authentication

## Phase 1: Setup Repository & Database Schema
- [x] Buat tabel users di database
- [ ] Buat skema Prisma/ORM

## Phase 2: Implementation Auth API
- [ ] Buat endpoint POST /api/login
- [ ] Buat endpoint POST /api/register
```

---

## 🖥️ Penggunaan CLI

### 1. `npx automator start`
Memuat fase aktif dan mencetak **Gatekeeper System Prompt**. Copy-paste prompt ini ke AI Anda untuk mengunci fokus eksekusinya.

```bash
npx automator start
```
**Contoh Output:**
```text
==================================================
🔒 GATEKEEPER LOCK - FASE AKTIF [1/2]
==================================================

[ATURAN EKSEKUSI MUTLAK (META-GATEKEEPER)]:
1. Anda SAAT INI HANYA BERADA DI FASE: "Phase 1: Setup Repository & Database Schema".
2. DILARANG KERAS memprediksi, menulis kode, atau membahas instruksi di luar deskripsi berikut:
...
```

---

### 2. `npx automator status`
Memeriksa status keterselesaian tugas pada fase aktif.

```bash
npx automator status
```
**Contoh Output:**
```text
📊 AUTOMATOR STATUS REPORT
--------------------------------------------------
📌 Job ID          : c00f1b22-99a1-4bd2-a168-69324b569b1a
🎯 Fase Aktif      : Phase 1: Setup Repository & Database Schema (Index: 0)
📁 File Source     : /path/to/project/TRD/01-phase-1.md
📈 Progress        : 50%
✅ Tugas Selesai   : 1 / 2

⏳ Task Pending:
   1. [ ] Buat skema Prisma/ORM
--------------------------------------------------
```

---

### 3. `npx automator next` (Hard Blocker)
Mencoba melanjutkan ke fase berikutnya. Jika masih ada task pending (`< 100%`), eksekusi akan diblokir dengan *error code 1*.

```bash
npx automator next
```

**Jika Tugas Belum 100% Selesai:**
```text
⛔ EXECUTION FAILED: Transisi Fase Ditolak!
Progression saat ini: 50% (1/2 tugas completed)

Tugas yang masih PENDING:
 ❌ [ ] Buat skema Prisma/ORM

Selesaikan seluruh tugas pending sebelum melanjut ke fase berikutnya.
```

**Jika Semua Tugas Sudah Centang (`- [x]`):**
```text
✅ Phase [Phase 1: Setup Repository & Database Schema] divalidasi sempurna (100%).
🔓 Gerbang menuju fase selanjutnya (Index: 1) telah dibuka!
```
