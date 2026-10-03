import * as fs from 'fs/promises';
import * as syncFs from 'fs';
import * as path from 'path';

export interface VirtualPhase {
  filePath: string;
  title: string;
  content: string;
  headingLevel: number;
}

// Directory blacklist (system & build folders)
const BLACKLIST_DIRS = new Set([
  'node_modules',
  'vendor',
  '.git',
  'storage',
  'public',
  'dist',
  'build',
  '.automator',
]);

// Ignored files (Git templates & metadata files that are not project phase tasks)
const IGNORED_FILE_NAMES = new Set([
  'pull_request_template.md',
  'issue_template.md',
  'contributing.md',
  'code_of_conduct.md',
  'agents.md',
  'license.md',
  'changelog.md',
  'security.md',
  'readme.md',
]);

// Known phase & task directory patterns to prioritize
const PHASE_DIR_PATTERNS = ['phases', 'trd', 'tasks', 'specs', 'roadmap', 'docs'];

function stripCodeBlocks(markdownContent: string): string {
  return markdownContent.replace(/(```|~~~)[[\s\S]*?\1/g, '');
}

export class Orchestrator {
  /**
   * Rekursif mencari semua file .md di direktori proyek, mengabaikan folder & file blacklist/template.
   */
  findMarkdownFilesRecursively(dirPath: string): string[] {
    let results: string[] = [];
    let entries: syncFs.Dirent[];

    try {
      entries = syncFs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return [];
    }

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const nameLower = entry.name.toLowerCase();

      if (entry.isDirectory()) {
        if (!BLACKLIST_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
          results = results.concat(this.findMarkdownFilesRecursively(fullPath));
        }
      } else if (entry.isFile()) {
        if (nameLower.endsWith('.md') && !IGNORED_FILE_NAMES.has(nameLower)) {
          results.push(fullPath);
        }
      }
    }

    results.sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );

    return results;
  }

  /**
   * Memprioritaskan file .md dari direktori fase (misalnya docs/phases/, TRD/, tasks/).
   */
  prioritizePhaseFiles(filePaths: string[], projectRoot: string): string[] {
    const phaseFiles: string[] = [];
    const otherFiles: string[] = [];

    for (const file of filePaths) {
      const relativePath = path.relative(projectRoot, file).toLowerCase().replace(/\\/g, '/');
      const isPhaseDir = PHASE_DIR_PATTERNS.some((pattern) => relativePath.includes(pattern));

      if (isPhaseDir) {
        phaseFiles.push(file);
      } else {
        otherFiles.push(file);
      }
    }

    return phaseFiles.length > 0 ? phaseFiles : otherFiles;
  }

  /**
   * Memotong dokumen Markdown menjadi VirtualPhase berdasarkan HEADING (# s/d ######).
   * Mendukung GFM Checkbox (- [ ] / - [x]) DAN List items (- Item).
   */
  async parseMarkdownFile(filePath: string): Promise<VirtualPhase[]> {
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const contentClean = stripCodeBlocks(rawContent);

    // Cek apakah ada tugas berupa GFM checklist ATAU list item (- / * / 1.)
    const hasTasksOrLists = /^\s*[-*+]\s*(\[[ xX]\]|.+)/m.test(contentClean);
    if (!hasTasksOrLists) {
      return [];
    }

    const lines = rawContent.split(/\r?\n/);
    const phases: VirtualPhase[] = [];
    const anyHeadingRegex = /^(#{1,6})\s+(.+)$/;

    let currentTitle: string | null = null;
    let currentHeadingLevel = 1;
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = line.match(anyHeadingRegex);
      if (match) {
        if (currentTitle !== null) {
          const content = currentLines.join('\n').trim();
          if (content.length > 0) {
            phases.push({
              filePath,
              title: currentTitle,
              content,
              headingLevel: currentHeadingLevel,
            });
          }
        }
        currentHeadingLevel = match[1].length;
        currentTitle = match[2].trim();
        currentLines = [line];
      } else {
        if (currentTitle !== null) {
          currentLines.push(line);
        } else {
          currentLines.push(line);
        }
      }
    }

    if (currentTitle !== null) {
      const content = currentLines.join('\n').trim();
      if (content.length > 0) {
        phases.push({
          filePath,
          title: currentTitle,
          content,
          headingLevel: currentHeadingLevel,
        });
      }
    }

    if (phases.length === 0 && rawContent.trim().length > 0) {
      phases.push({
        filePath,
        title: path.basename(filePath, '.md'),
        content: rawContent.trim(),
        headingLevel: 1,
      });
    }

    return phases.filter((p) => /^\s*[-*+]\s*(\[[ xX]\]|.+)/m.test(stripCodeBlocks(p.content)));
  }

  /**
   * Ekstrem Robustness Loader:
   * 1. Mencari seluruh file .md di proyek.
   * 2. Mengabaikan file metadata / template (PULL_REQUEST_TEMPLATE.md, AGENTS.md, README.md, dll).
   * 3. Memprioritaskan file dari folder fase (docs/phases, TRD, tasks, dll).
   * 4. Memuat fase secara terurut.
   */
  async loadPhasesFromProject(projectRoot: string = process.cwd()): Promise<VirtualPhase[]> {
    const rawFiles = this.findMarkdownFilesRecursively(projectRoot);
    const targetFiles = this.prioritizePhaseFiles(rawFiles, projectRoot);

    const allPhases: VirtualPhase[] = [];

    for (const file of targetFiles) {
      const phases = await this.parseMarkdownFile(file);
      if (phases.length > 0) {
        allPhases.push(...phases);
      }
    }

    if (allPhases.length === 0) {
      console.log('❌ Tidak ada file markdown fase/tugas yang ditemukan di dalam proyek.');
      process.exit(1);
    }

    return allPhases;
  }
}
