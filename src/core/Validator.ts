export interface TaskValidationResult {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  pendingTasks: string[];
}

export class Validator {
  /**
   * Menganalisis konten Markdown dan mengekstrak tugas berdasarkan GFM Task List (- [ ] dan - [x]):
   * - [x] = Tugas selesai (Completed)
   * - [ ] = Tugas pending (Uncompleted)
   * Jika sebuah bagian hanya berisi bullet point teks deskriptif (tanpa kotak centang [ ] / [x]),
   * bagian tersebut dianggap informasi ruang lingkup (0 pending tasks) dan tidak memblokir auto-sync.
   */
  validateContent(content: string): TaskValidationResult {
    const gfmRegex = /^\s*[-*+]\s*\[([ xX])\]\s*(.+)$/gm;
    let totalTasks = 0;
    let completedTasks = 0;
    const pendingTasks: string[] = [];

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
