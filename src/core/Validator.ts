import * as fs from 'fs';
import * as path from 'path';

export interface TaskValidationResult {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  pendingTasks: string[];
}

export class CodebaseVerifier {
  private projectRoot: string;
  private fileCache: string[] | null = null;

  // Kamus modul utama ke nama file Controller/Model/Blade spesifik
  private strictModuleFilesMap: Record<string, string[]> = {
    'fondasi project': ['user.php', 'auth', 'login', 'dashboard'],
    'users': ['user.php', 'usercontroller.php', 'users'],
    'login': ['login', 'auth', 'session'],
    'dashboard': ['dashboard'],
    'tahun akademik': ['tahunakademik', 'academicyear', 'tahun_akademik'],
    'program studi': ['programstudi', 'prodi', 'studyprogram', 'program_studi'],
    'tata usaha': ['tatausaha', 'tu', 'staff'],
    'pengaturan': ['setting', 'settings', 'config', 'pengaturan'],
    'notifikasi': ['notification', 'notifications', 'notice'],
    'semester': ['semester', 'semesters'],
    'dosen': ['dosen', 'lecturer'],
    'mahasiswa': ['mahasiswa', 'student', 'students'],
    'mata kuliah': ['matakuliah', 'course', 'subject', 'matkul', 'mata_kuliah'],
    'kelas': ['kelas', 'courseclass', 'classroom'],
    'enrollment': ['enrollment', 'enroll', 'krs'],
    'penilaian': ['penilaian', 'nilaicontroller', 'penilaiancontroller', 'gradecontroller'],
    'input nilai': ['nilaicontroller', 'penilaiancontroller', 'gradecontroller', 'inputnilai'],
    'workflow nilai': ['workflow', 'verifikasinilai', 'reviewnilai'],
    'rekapitulasi': ['rekapitulasi', 'rekap', 'reportcontroller'],
    'log aktivitas': ['activitylog', 'logaktivitas', 'auditlog'],
  };

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Rekursif mengumpulkan seluruh file dalam codebase (mengabaikan node_modules, .git, vendor, dist, storage)
   */
  private getAllProjectFiles(dir: string = this.projectRoot): string[] {
    if (this.fileCache && dir === this.projectRoot) {
      return this.fileCache;
    }

    let results: string[] = [];
    const blacklist = new Set(['node_modules', 'vendor', '.git', 'dist', 'build', '.automator', 'storage', 'public']);

    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!blacklist.has(entry.name) && !entry.name.startsWith('.')) {
            results = results.concat(this.getAllProjectFiles(fullPath));
          }
        } else if (entry.isFile()) {
          results.push(fullPath);
        }
      }
    } catch {
      // return empty on error
    }

    if (dir === this.projectRoot) {
      this.fileCache = results;
    }

    return results;
  }

  /**
   * Verifikasi strictly berdasarkan modul Controller / Model / Migration utama.
   */
  isModuleImplemented(sectionTitle: string, itemText: string): boolean {
    const combinedText = `${sectionTitle} ${itemText}`.toLowerCase();
    const files = this.getAllProjectFiles();

    // 1. Setup dasar framework
    if (combinedText.includes('laravel') || combinedText.includes('fondasi project')) {
      const hasComposer = files.some((f) => path.basename(f) === 'composer.json' || path.basename(f) === 'package.json');
      const hasArtisan = files.some((f) => path.basename(f) === 'artisan');
      if (hasComposer || hasArtisan) return true;
    }

    // 2. Cari modul spesifik dari strict map
    let targetPatterns: string[] = [];
    for (const [moduleKey, patterns] of Object.entries(this.strictModuleFilesMap)) {
      if (combinedText.includes(moduleKey)) {
        targetPatterns = patterns;
        break;
      }
    }

    // Jika tidak ada pattern khusus yang cocok di map, ekstrak nama kata unik > 4 karakter (misal "Kelas", "Enrollment")
    if (targetPatterns.length === 0) {
      const cleaned = combinedText
        .replace(/menu\s*\d+/gi, '')
        .replace(/[^\w\s]/gi, ' ')
        .trim();

      const stopWords = new Set([
        'menu', 'tahap', 'fondasi', 'dasar', 'lanjutan', 'lengkap', 'master', 'project',
        'seluruh', 'isi', 'trd', 'pada', 'dan', 'dengan', 'untuk', 'yang', 'dalam', 'fitur',
        'halaman', 'alur', 'proses', 'validasi', 'kriteria', 'penutupan', 'in', 'scope', 'out', 'tabel', 'model',
        'pencarian', 'pagination', 'empty', 'state', 'routing', 'acceptance', 'criteria', 'dropdown', 'unread',
        'count', 'status', 'read', 'mark', 'redirect', 'ownership', 'scheduler', 'pembersihan', 'penghapusan'
      ]);

      const words = cleaned.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()));
      targetPatterns = words;
    }

    if (targetPatterns.length === 0) {
      return false;
    }

    // 3. Lakukan Strict Filename Check: Harus mencakup pattern sebagai Controller, Model, Migration, atau View spesifik
    for (const pattern of targetPatterns) {
      const pLower = pattern.toLowerCase();
      const match = files.some((filePath) => {
        const baseName = path.basename(filePath).toLowerCase();
        // Memastikan cocok dengan nama file controller, model, migration, atau view
        return baseName.includes(pLower) && (
          baseName.endsWith('.php') ||
          baseName.endsWith('.js') ||
          baseName.endsWith('.ts') ||
          baseName.endsWith('.blade.php')
        );
      });

      if (match) {
        return true;
      }
    }

    return false;
  }
}

export class Validator {
  private verifier: CodebaseVerifier;

  constructor(verifier: CodebaseVerifier = new CodebaseVerifier()) {
    this.verifier = verifier;
  }

  /**
   * Menganalisis konten Markdown dan memverifikasi kodenya di dalam codebase:
   * 1. Jika ada GFM Checkbox (- [x] / - [ ]), gunakan checkbox tersebut.
   * 2. Jika berupa poin "- Item" di bawah "In Scope", periksa status modul utama pada codebase.
   */
  validateContent(content: string): TaskValidationResult {
    let totalTasks = 0;
    let completedTasks = 0;
    const pendingTasks: string[] = [];

    // 1. Coba GFM Checkboxes dahulu (- [x] / - [ ])
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

    // 2. Jika tidak ada GFM Checkbox, periksa berdasarkan Modul & Codebase Verification
    if (totalTasks === 0) {
      const lines = content.split(/\r?\n/);
      let currentSectionTitle = '';
      let inScopeSection = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('#')) {
          const headingText = trimmed.replace(/^#+\s*/, '');
          if (/in\s*scope/i.test(trimmed) && !/out\s*of\s*scope/i.test(trimmed)) {
            inScopeSection = true;
          } else {
            currentSectionTitle = headingText;
            if (/out\s*of\s*scope/i.test(trimmed) || /kriteria/i.test(trimmed)) {
              inScopeSection = false;
            }
          }
          continue;
        }

        if (inScopeSection) {
          const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
          if (bulletMatch) {
            const itemText = bulletMatch[1].trim();
            if (itemText && !itemText.startsWith('**')) {
              totalTasks++;

              // Verifikasi Controller/Model spesifik untuk modul tersebut
              const isImplemented = this.verifier.isModuleImplemented(currentSectionTitle, itemText);

              if (isImplemented) {
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
