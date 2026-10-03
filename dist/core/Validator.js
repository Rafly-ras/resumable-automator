"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Validator = void 0;
class Validator {
    /**
     * Menganalisis konten Markdown fase secara presisi:
     * Setiap poin di bawah "In Scope" dianggap sebagai tugas aktif yang wajib diselesaikan.
     * - Poin berawalan - [x] atau (x) dianggap COMPLETED (selesai).
     * - Poin berawalan - [ ] atau poin biasa (-) dianggap PENDING (belum selesai).
     */
    validateContent(content) {
        let totalTasks = 0;
        let completedTasks = 0;
        const pendingTasks = [];
        const lines = content.split(/\r?\n/);
        let inScopeSection = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                if (/in\s*scope/i.test(trimmed) && !/out\s*of\s*scope/i.test(trimmed)) {
                    inScopeSection = true;
                }
                else if (/out\s*of\s*scope/i.test(trimmed) || /kriteria/i.test(trimmed)) {
                    inScopeSection = false;
                }
                continue;
            }
            if (inScopeSection) {
                const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
                if (bulletMatch) {
                    const itemText = bulletMatch[1].trim();
                    if (itemText && !itemText.startsWith('**')) {
                        totalTasks++;
                        // Cek apakah item ditandai [x] atau (x)
                        if (/^\[x\]/i.test(itemText) || /^\(x\)/i.test(itemText)) {
                            completedTasks++;
                        }
                        else {
                            // Hapus prefix [ ] jika ada agar tampilan bersih
                            const cleanPendingText = itemText.replace(/^\[\s*\]\s*/, '');
                            pendingTasks.push(cleanPendingText);
                        }
                    }
                }
            }
        }
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        return {
            totalTasks,
            completedTasks,
            progressPercentage,
            pendingTasks,
        };
    }
}
exports.Validator = Validator;
