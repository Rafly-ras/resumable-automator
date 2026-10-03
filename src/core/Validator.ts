export interface TaskValidationResult {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  pendingTasks: string[];
}

export class Validator {
  /**
   * Menganalisis konten Markdown fase secara bersih dan deterministik:
   * 1. Mengidentifikasi GFM Checkbox (- [x] untuk completed, - [ ] untuk pending)
   * 2. Jika dokumen berupa poin teks biasa di bawah "In Scope", mengeset tugas sebagai item fase.
   *    Dua-duanya berjalan tanpa hardcode kamus kata kunci agar 100% kompatibel di semua proyek.
   */
  validateContent(content: string): TaskValidationResult {
    let totalTasks = 0;
    let completedTasks = 0;
    const pendingTasks: string[] = [];

    // 1. GFM Checkboxes (- [x] / - [ ])
    const gfmRegex = /^\s*[-*+]\s*\[([ xX])\]\s*(.+)$/gm;
    let match: RegExpExecArray | null;

    while ((match = gfmRegex.exec(content)) !== null) {
      totalTasks++;
      const isChecked = match[1].toLowerCase() === 'x';
      const taskText = match[2].trim();

      if (isChecked) {
        completedTasks++;
      } else {
        pendingTasks.push(taskText);
      }
    }

    // 2. Jika tidak ada GFM Checkbox, baca poin-poin di bawah bagian "In Scope"
    if (totalTasks === 0) {
      const lines = content.split(/\r?\n/);
      let inScopeSection = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#')) {
          if (/in\s*scope/i.test(trimmed) && !/out\s*of\s*scope/i.test(trimmed)) {
            inScopeSection = true;
          } else if (/out\s*of\s*scope/i.test(trimmed) || /kriteria/i.test(trimmed)) {
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
              if (/^\[x\]/i.test(itemText) || /^\(x\)/i.test(itemText)) {
                completedTasks++;
              } else {
                pendingTasks.push(itemText);
              }
            }
          }
        }
      }
    }

    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    return {
      totalTasks,
      completedTasks,
      progressPercentage,
      pendingTasks,
    };
  }
}
