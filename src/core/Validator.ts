export interface TaskValidationResult {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  pendingTasks: string[];
  hasGfmCheckboxes: boolean;
}

export class Validator {
  /**
   * Menganalisis konten Markdown fase:
   * 1. Jika ada GFM Checkboxes (- [x] / - [ ]), hitung persentase secara persis.
   * 2. Jika hanya berisi poin scope biasa (- Item), anggap scope siap dieksekusi (100%)
   *    agar tidak membuat pengguna bingung dengan angka false 0%.
   */
  validateContent(content: string): TaskValidationResult {
    let totalTasks = 0;
    let completedTasks = 0;
    const pendingTasks: string[] = [];

    // 1. Cek keberadaan GFM Checkboxes (- [x] / - [ ])
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

    const hasGfmCheckboxes = totalTasks > 0;

    // 2. Jika tidak ada GFM Checkbox, baca poin-poin di bawah bagian "In Scope"
    if (!hasGfmCheckboxes) {
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

    // Jika dokumen berupa poin scope biasa tanpa checkbox (- [ ]), anggap 100% disetujui / siap dieksekusi
    const progressPercentage = hasGfmCheckboxes
      ? Math.round((completedTasks / totalTasks) * 100)
      : 100;

    return {
      totalTasks,
      completedTasks: hasGfmCheckboxes ? completedTasks : totalTasks,
      progressPercentage,
      pendingTasks: hasGfmCheckboxes ? pendingTasks : [],
      hasGfmCheckboxes,
    };
  }
}
