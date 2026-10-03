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

  // Kamus Pemetaan Bahasa & Istilah Teknis (Bahasa Indonesia <> English/Laravel Standard)
  private synonymMap: Record<string, string[]> = {
    pengaturan: ['setting', 'settings', 'config', 'configuration', 'option', 'options', 'pengaturan'],
    notifikasi: ['notification', 'notifications', 'notice', 'alert', 'queue', 'job', 'notifikasi'],
    pengguna: ['user', 'users', 'account', 'accounts', 'pengguna'],
    login: ['auth', 'login', 'authentication', 'session', 'masuk'],
    dashboard: ['dashboard', 'home', 'main', 'beranda'],
    tahunakademik: ['academicyear', 'schoolyear', 'tahunakademik', 'tahun_akademik', 'academic_year', 'tahun'],
    programstudi: ['studyprogram', 'prodi', 'programstudi', 'program_studi', 'department', 'dept'],
    tatausaha: ['tatausaha', 'tata_usaha', 'tu', 'staff', 'admin'],
    semester: ['semester', 'semesters', 'term'],
    dosen: ['lecturer', 'teacher', 'dosen', 'faculty'],
    mahasiswa: ['student', 'students', 'mahasiswa', 'mhs'],
    matakuliah: ['course', 'subject', 'matakuliah', 'mata_kuliah', 'matkul'],
    kelas: ['class', 'courseclass', 'kelas', 'room', 'classroom'],
    enrollment: ['enrollment', 'enroll', 'krs', 'registrasi', 'pendaftaran'],
    penilaian: ['grade', 'grading', 'score', 'assessment', 'nilai', 'penilaian'],
    nilai: ['grade', 'score', 'nilai', 'assessment'],
    rekapitulasi: ['report', 'summary', 'rekap', 'rekapitulasi', 'export'],
    monitoring: ['monitoring', 'monitor', 'track', 'tracking'],
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
   * Verifikasi apakah modul/entity utama ada di codebase (dengan pencocokan sinonim Indonesia-Inggris).
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

    // 2. Bersihkan teks dan ekstrak kata kunci
    const cleaned = combinedText
      .replace(/menu\s*\d+/gi, '')
      .replace(/[^\w\s]/gi, ' ')
      .trim();

    const stopWords = new Set([
      'menu', 'tahap', 'fondasi', 'dasar', 'lanjutan', 'lengkap', 'master', 'project',
      'seluruh', 'isi', 'trd', 'pada', 'dan', 'dengan', 'untuk', 'yang', 'dalam', 'fitur',
      'halaman', 'alur', 'proses', 'validasi', 'kriteria', 'penutupan', 'in', 'scope', 'out', 'tabel', 'model'
    ]);

    const keywords = cleaned
      .split(/\s+/)
      .filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

    if (keywords.length === 0) {
      return false;
    }

    // 3. Bangun daftar pencarian termasuk sinonim (Indonesia <> Inggris/Laravel)
    const targetTerms = new Set<string>();
    for (const kw of keywords) {
      targetTerms.add(kw.toLowerCase());
      if (this.synonymMap[kw.toLowerCase()]) {
        this.synonymMap[kw.toLowerCase()].forEach((syn) => targetTerms.add(syn));
      }
    }

    // 4. Cari apakah ada file di codebase yang cocok dengan term pencarian
    for (const term of targetTerms) {
      const match = files.some((filePath) => {
        const baseName = path.basename(filePath).toLowerCase();
        return baseName.includes(term);
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

    // 2. Jika tidak ada GFM Checkbox, periksa berdasarkan Modul & Codebase Verification (Synonym Matching)
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

              // Verifikasi entity modul utama (misal: "Pengaturan" -> Setting.php, "Notifikasi" -> Notification.php)
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
