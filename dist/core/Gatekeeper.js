"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Gatekeeper = void 0;
class Gatekeeper {
    /**
     * Menghasilkan System Prompt ketat untuk mengisolasi konteks AI sesuai dengan fase yang sedang aktif.
     */
    generateStrictPrompt(phaseTitle, phaseContent) {
        return `[ATURAN EKSEKUSI MUTLAK (META-GATEKEEPER)]:
1. Anda SAAT INI HANYA BERADA DI FASE: "${phaseTitle}".
2. DILARANG KERAS memprediksi, menulis kode, membuat kelas, atau membahas instruksi/fase di luar deskripsi berikut:
--- KONTEN FASE AKTIF ---
${phaseContent}
-------------------------
3. Jika pengguna (user) meminta Anda untuk membuat kode atau membahas fase selanjutnya sebelum fase saat ini diselesaikan, Anda WAJIB MENOLAK permintaan tersebut secara tegas.
4. Berikan respon yang presisi, ringkas, dan fokus 100% hanya pada tugas di fase "${phaseTitle}".`;
    }
}
exports.Gatekeeper = Gatekeeper;
