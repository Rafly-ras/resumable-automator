# Resumable Automator

**AI Gatekeeper & Stateful Task Orchestrator**

`resumable-automator` adalah framework CLI berbasis Node.js & TypeScript yang dirancang untuk mengisolasi konteks AI saat melakukan pair programming secara sekuensial berdasarkan instruksi fase pada dokumentasi Markdown proyek Anda.

---

## ⚡ Fitur Utama

- **Universal Auto-Discovery**: Secara otomatis memindai seluruh file Markdown (`.md`) di dalam proyek tanpa hardcoding struktur direktori atau nama file khusus.
- **Smart Code-Block Sanitization**: Mengabaikan contoh sintaks di dalam blok kode (```) sehingga `README.md` atau panduan penggunaan tidak keliru dianggap sebagai tugas.
- **Strict Hard-Blocker Gatekeeper**: Mencegah transisi ke fase berikutnya (`npx automator next`) jika tugas pada fase aktif belum 100% tuntas.
- **State Persistence**: Menyimpan state aktif di `.automator/state.json`. Jika server mati atau crash, sistem akan langsung melanjutkannya tepat di tempat terakhir.
- **Fast-Forward Sync (`npx automator sync`)**: Otomatis melompati fase-fase yang sudah 100% selesai untuk proyek yang sudah berjalan pertengahan (seperti fase 4).

---

## 🚀 Perintah CLI

| Perintah | Deskripsi |
| :--- | :--- |
| `npx automator start` | Menghasilkan **Gatekeeper Lock System Prompt** untuk mengunci konteks AI pada fase aktif saat ini. |
| `npx automator status` | Menampilkan laporan progress, file sumber, dan daftar tugas pending pada fase aktif. |
| `npx automator next` | Memvalidasi kelengkapan fase aktif (100%) dan membuka gerbang ke fase berikutnya. |
| `npx automator sync` | Auto Fast-Forward: Otomatis melompati fase-fase yang sudah 100% selesai langsung ke fase aktif yang belum selesai. |

---

## 🛠️ Lisensi

MIT License © 2026
