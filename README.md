# Resumable Automator

**AI Gatekeeper & Stateful Task Orchestrator**

`resumable-automator` adalah framework CLI berbasis Node.js & TypeScript yang dirancang untuk mengisolasi konteks AI saat melakukan *pair programming* secara sekuensial berdasarkan instruksi fase pada dokumentasi Markdown proyek Anda.

---

## ⚡ Fitur Utama

- **Codebase Structure Analyzer (Real-time FE/BE/DB Tracking)**: Memindai struktur kode fisik proyek (`views/`, `controllers/`, `models/`, `migrations/`, `routes/`) dan menyajikan persentase kelengkapan Frontend (FE), Backend (BE), dan Database (DB) secara terurai dan real-time.
- **Strict Hard-Blocker Gatekeeper**: Mencegah transisi ke fase berikutnya (`npx automator next`) jika tugas pada fase aktif belum 100% tuntas di kodingan fisik.
- **Universal Auto-Discovery**: Secara otomatis memindai seluruh file Markdown (`.md`) di dalam proyek tanpa hardcoding struktur direktori atau nama file khusus.
- **Smart Code-Block Sanitization**: Mengabaikan contoh sintaks di dalam blok kode (```) sehingga `README.md` atau panduan penggunaan tidak keliru dianggap sebagai tugas.
- **State Persistence**: Menyimpan state aktif di `.automator/state.json`. Jika server mati atau crash, sistem akan langsung melanjutkannya tepat di tempat terakhir.
- **Instant Jump & Manual Navigation**: Memungkinkan navigasi fleksibel ke fase mana saja kapan pun Anda membutuhkannya.

---

## 💻 Cara Instalasi (Windows / Linux / macOS)

Tidak perlu clone repository! Cukup jalankan perintah instalasi berikut di terminal Anda:

### Instalasi Global (Rekomendasi)
```bash
npm install -g github:Rafly-ras/resumable-automator
```

### Instalasi Lokal per Proyek
```bash
npm install github:Rafly-ras/resumable-automator
```

---

## 🚀 Perintah CLI

| Perintah | Deskripsi |
| :--- | :--- |
| `automator start` / `npx automator start` | Menghasilkan **Gatekeeper Lock System Prompt** untuk mengunci konteks AI pada fase aktif saat ini. |
| `automator status` / `npx automator status` | Menampilkan laporan progress terurai (FE %, BE %, DB %) dan daftar tugas pending pada fase aktif. |
| `automator next` / `npx automator next` | Memvalidasi kelengkapan fase aktif (100%) dan membuka gerbang ke fase berikutnya (**Hard Blocker** jika ada pending). |
| `automator jump <fase>` / `npx automator jump <fase>` | Melompat langsung ke fase tertentu (contoh: `automator jump fase-4` atau `automator jump 5`). |
| `automator reset` / `npx automator reset` | Mengembalikan posisi state ke Fase 1 (Fase Pertama). |
| `automator sync` / `npx automator sync` | Auto Fast-Forward: Otomatis melompati fase-fase yang sudah 100% selesai langsung ke fase aktif yang belum selesai. |

---

## 📝 Rekomendasi `.gitignore` Proyek

Tambahkan baris berikut pada file `.gitignore` proyek Anda agar file state lokal tidak ikut ter-commit ke Git:

```text
.automator/
```

---

## 🛠️ Lisensi

MIT License © 2026
