export interface TaskValidationResult {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  pendingTasks: string[];
}

export class Validator {
  /**
   * Menganalisis konten Markdown dan mengekstrak tugas:
   * 1. GFM Checkbox (- [ ] dan - [x])
   * 2. Bullet list items (- Item, * Item) jika tidak ada GFM checkbox
   */
  validateContent(content: string): TaskValidationResult {
    const gfmRegex = /^\s*[-*+]\s*\[([ xX])\]\s*(.+)$/gm;
    let totalTasks = 0;
    let completedTasks = 0;
    const pendingTasks: string[] = [];

    let match: RegExpExecArray | null;

    // 1. Coba GFM Checkboxes dahulu
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

    // 2. Jika tidak ada GFM Checkbox, ambil list item bullet (- Item, * Item)
    if (totalTasks === 0) {
      const bulletRegex = /^\s*[-*+]\s+(?!\s*\[)(.+)$/gm;
      while ((match = bulletRegex.exec(content)) !== null) {
        const itemText = match[1].trim();
        // Abaikan header atau meta baris sejenis **Tujuan** atau **Dependency**
        if (
          itemText &&
          !itemText.startsWith('#') &&
          !itemText.startsWith('**Tujuan') &&
          !itemText.startsWith('**Dependency') &&
          !itemText.startsWith('**Referensi')
        ) {
          totalTasks++;
          pendingTasks.push(itemText);
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
