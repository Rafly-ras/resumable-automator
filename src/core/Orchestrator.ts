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
  'notes.md',
]);

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
   * Memprioritaskan folder fase khusus (seperti docs/phases/ atau phases/)
   * agar file referensi TRD (seperti docs/trd/) tidak bercampur menjadi ratusan sub-fase.
   */
  prioritizePhaseFiles(filePaths: string[], projectRoot: string): string[] {
    const dedicatedPhaseFiles = filePaths.filter((file) => {
      const rel = path.relative(projectRoot, file).toLowerCase().replace(/\\/g, '/');
      return rel.includes('docs/phases/') || rel.includes('/phases/') || rel.startsWith('phases/');
    });

    if (dedicatedPhaseFiles.length > 0) {
      return dedicatedPhaseFiles;
    }

    const trdFiles = filePaths.filter((file) => {
      const rel = path.relative(projectRoot, file).toLowerCase().replace(/\\/g, '/');
      return rel.includes('docs/trd/') || rel.includes('/trd/') || rel.startsWith('trd/');
    });

    if (trdFiles.length > 0) {
      return trdFiles;
    }

    return filePaths;
  }

  /**
   * Memotong dokumen Markdown menjadi VirtualPhase berdasarkan HEADING (# s/d ######).
   * Hanya memotong pada level Heading 1 atau 2 (# atau ##) untuk fase utama agar tidak terlalu terfragmentasi.
   */
  async parseMarkdownFile(filePath: string): Promise<VirtualPhase[]> {
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const lines = rawContent.split(/\r?\n/);
    const phases: VirtualPhase[] = [];

    // Hanya potong pada Heading level 1 & 2 (# Phase N atau ## Title)
    const phaseHeadingRegex = /^(#{1,2})\s+(.+)$/;

    let currentTitle: string | null = null;
    let currentHeadingLevel = 1;
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = line.match(phaseHeadingRegex);
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

    return phases;
  }

  /**
   * Dedicated Phase Loader:
   * Memuat file fase asli (misalnya 8 file di docs/phases/) tanpa bercampur dengan file referensi spesifikasi TRD.
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
