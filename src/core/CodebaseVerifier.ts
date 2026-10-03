import * as fs from 'fs';
import * as path from 'path';

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
   * Verifikasi apakah sebuah tugas pada Markdown sudah ter-implementasi di dalam codebase aktual.
   */
  isTaskImplemented(taskText: string): boolean {
    const textLower = taskText.toLowerCase();
    const files = this.getAllProjectFiles();

    // 1. Cek inisialisasi framework / setup dasar
    if (textLower.includes('inisialisasi') || textLower.includes('setup') || textLower.includes('laravel')) {
      const hasComposer = files.some((f) => path.basename(f) === 'composer.json' || path.basename(f) === 'package.json');
      const hasArtisan = files.some((f) => path.basename(f) === 'artisan');
      if (hasComposer || hasArtisan) return true;
    }

    // 2. Ekstrak kata kunci penting dari teks tugas
    const words = taskText.replace(/[^\w\s]/gi, '').split(/\s+/);
    const stopWords = new Set([
      'menu', 'tahap', 'sesuai', 'dasar', 'seluruh', 'isi', 'trd', 'pada', 'dan', 'dengan',
      'untuk', 'yang', 'dalam', 'fitur', 'halaman', 'alur', 'proses', 'validasi', 'kriteria', 'penutupan'
    ]);
    const keywords = words.filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));

    if (keywords.length === 0) {
      return false;
    }

    // 3. Cari kata kunci pada nama-nama file di codebase
    let matchCount = 0;
    for (const keyword of keywords) {
      const kwLower = keyword.toLowerCase();
      const match = files.some((filePath) => {
        const baseName = path.basename(filePath).toLowerCase();
        return baseName.includes(kwLower);
      });
      if (match) matchCount++;
    }

    // Jika setidaknya 40% kata kunci ditemukan di codebase file, anggap ter-implementasi
    return matchCount > 0 && matchCount >= Math.ceil(keywords.length * 0.4);
  }
}
