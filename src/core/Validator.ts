import * as fs from 'fs';
import * as path from 'path';

export interface TaskValidationResult {
  totalTasks: number;
  completedTasks: number;
  progressPercentage: number;
  feProgress: number;
  beProgress: number;
  dbProgress: number;
  pendingTasks: string[];
}

export class CodebaseVerifier {
  private projectRoot: string;
  private fileCache: string[] | null = null;

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
   * Mengklasifikasikan layer arsitektur tugas (Frontend, Backend, atau Database/Integration)
   */
  getTaskLayer(taskText: string): 'FE' | 'BE' | 'DB' {
    const text = taskText.toLowerCase();

    if (/frontend|view|halaman|tampilan|blade|ui|form|popup|dropdown|layout|component/i.test(text)) {
      return 'FE';
    }

    if (/migration|tabel|table|database|seeder|route|routing|queue|job|failed_jobs|unique|constraint/i.test(text)) {
      return 'DB';
    }

    return 'BE';
  }

  /**
   * Memeriksa apakah komponen kode dari tugas tersebut (FE, BE, atau DB) ada di codebase
   */
  isTaskImplementedInCodebase(sectionTitle: string, taskText: string): boolean {
    const layer = this.getTaskLayer(taskText);
    const combined = `${sectionTitle} ${taskText}`.toLowerCase();
    const files = this.getAllProjectFiles();

    // 1. Ekstrak kata kunci entity utama (misal: "Kelas", "Enrollment", "Penilaian", "Semester", "Dosen", "Mahasiswa")
    const cleaned = combined
      .replace(/menu\s*\d+/gi, '')
      .replace(/[^\w\s]/gi, ' ')
      .trim();

    const stopWords = new Set([
      'menu', 'tahap', 'fondasi', 'dasar', 'lanjutan', 'lengkap', 'master', 'project',
      'seluruh', 'isi', 'trd', 'pada', 'dan', 'dengan', 'untuk', 'yang', 'dalam', 'fitur',
      'halaman', 'alur', 'proses', 'validasi', 'kriteria', 'penutupan', 'in', 'scope', 'out', 'tabel', 'model',
      'frontend', 'backend', 'routing', 'acceptance', 'criteria', 'relasi', 'crud', 'bulk', 'action'
    ]);

    const keywords = cleaned.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w.toLowerCase()));

    if (keywords.length === 0) {
      return false;
    }

    // 2. Periksa keberadaan file berdasarkan Layer Arsitektur
    for (const kw of keywords) {
      const kwLower = kw.toLowerCase();

      const match = files.some((filePath) => {
        const baseName = path.basename(filePath).toLowerCase();
        const relPath = path.relative(this.projectRoot, filePath).toLowerCase().replace(/\\/g, '/');

        if (!baseName.includes(kwLower)) {
          return false;
        }

        if (layer === 'FE') {
          // Frontend: Blade views, components, JS/CSS, HTML
          return relPath.includes('views') || relPath.includes('components') || baseName.endsWith('.blade.php') || baseName.endsWith('.html');
        } else if (layer === 'DB') {
          // Database & Routing: Migrations, seeders, routes/web.php
          return relPath.includes('migrations') || relPath.includes('seeders') || relPath.includes('routes');
        } else {
          // Backend: Controllers, Models, Services, Policies
          return relPath.includes('controllers') || relPath.includes('models') || relPath.includes('services') || baseName.endsWith('.php');
        }
      });

      if (match) {
        return true;
      }
    }

    // Fallback: Jika tidak menemukan spesifik per layer, cek keberadaan file entity secara umum
    return files.some((filePath) => {
      const baseName = path.basename(filePath).toLowerCase();
      return keywords.some((kw) => baseName.includes(kw.toLowerCase()));
    });
  }
}

export class Validator {
  private verifier: CodebaseVerifier;

  constructor(verifier: CodebaseVerifier = new CodebaseVerifier()) {
    this.verifier = verifier;
  }

  /**
   * Menganalisis konten Markdown fase dan memindai struktur kode proyek:
   * Menghitung progress terurai secara terstruktur:
   * - Frontend Progress (FE) %
   * - Backend Progress (BE) %
   * - Database & Integration Progress (DB) %
   * - Overall Phase Progress %
   */
  validateContent(content: string): TaskValidationResult {
    let totalTasks = 0;
    let completedTasks = 0;

    let totalFE = 0;
    let completedFE = 0;

    let totalBE = 0;
    let completedBE = 0;

    let totalDB = 0;
    let completedDB = 0;

    const pendingTasks: string[] = [];

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
            const layer = this.verifier.getTaskLayer(itemText);

            if (layer === 'FE') totalFE++;
            else if (layer === 'DB') totalDB++;
            else totalBE++;

            let isImplemented = false;

            // Cek apakah item ditandai manual [x]
            if (/^\[x\]/i.test(itemText) || /^\(x\)/i.test(itemText)) {
              isImplemented = true;
            } else {
              // Cek secara otomatis di dalam struktur codebase aktual
              isImplemented = this.verifier.isTaskImplementedInCodebase(currentSectionTitle, itemText);
            }

            if (isImplemented) {
              completedTasks++;
              if (layer === 'FE') completedFE++;
              else if (layer === 'DB') completedDB++;
              else completedBE++;
            } else {
              const cleanPendingText = itemText.replace(/^\[\s*\]\s*/, '');
              pendingTasks.push(cleanPendingText);
            }
          }
        }
      }
    }

    const progressPercentage =
      totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    const feProgress = totalFE > 0 ? Math.round((completedFE / totalFE) * 100) : 100;
    const beProgress = totalBE > 0 ? Math.round((completedBE / totalBE) * 100) : 100;
    const dbProgress = totalDB > 0 ? Math.round((completedDB / totalDB) * 100) : 100;

    return {
      totalTasks,
      completedTasks,
      progressPercentage,
      feProgress,
      beProgress,
      dbProgress,
      pendingTasks,
    };
  }
}
