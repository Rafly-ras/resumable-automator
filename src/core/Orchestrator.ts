import * as fs from 'fs/promises';
import * as path from 'path';

export interface VirtualPhase {
  filePath: string;
  title: string;
  content: string;
  headingLevel: number;
}

export class Orchestrator {
  /**
   * Membaca direktori dan mengembalikan daftar file .md yang telah diurutkan dengan Natural Sort.
   */
  async getMarkdownFiles(dirPath: string): Promise<string[]> {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const mdFiles = entries
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => path.join(dirPath, entry.name));

    // Natural sort: phase-2.md muncul sebelum phase-10.md
    mdFiles.sort((a, b) =>
      path.basename(a).localeCompare(path.basename(b), undefined, {
        numeric: true,
        sensitivity: 'base',
      })
    );

    return mdFiles;
  }

  /**
   * Membaca isi file Markdown dan memotongnya menjadi array VirtualPhase berdasarkan heading (## Phase, ### Tahap, ## Step).
   */
  async parseMarkdownFile(filePath: string): Promise<VirtualPhase[]> {
    const rawContent = await fs.readFile(filePath, 'utf-8');
    const lines = rawContent.split(/\r?\n/);

    const phases: VirtualPhase[] = [];
    const headingRegex = /^(#{2,3})\s+((?:Phase|Tahap|Step)\b.*)$/i;

    let currentTitle: string | null = null;
    let currentHeadingLevel = 2;
    let currentLines: string[] = [];

    for (const line of lines) {
      const match = line.match(headingRegex);
      if (match) {
        if (currentTitle !== null) {
          phases.push({
            filePath,
            title: currentTitle,
            content: currentLines.join('\n').trim(),
            headingLevel: currentHeadingLevel,
          });
        }
        currentHeadingLevel = match[1].length;
        currentTitle = match[2].trim();
        currentLines = [line];
      } else {
        if (currentTitle !== null) {
          currentLines.push(line);
        }
      }
    }

    if (currentTitle !== null) {
      phases.push({
        filePath,
        title: currentTitle,
        content: currentLines.join('\n').trim(),
        headingLevel: currentHeadingLevel,
      });
    }

    // Jika file tidak memiliki heading Phase/Tahap/Step, anggap seluruh file sebagai 1 VirtualPhase
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
   * Membaca seluruh file Markdown di sebuah direktori dan mengembalikan seluruh VirtualPhase secara terurut.
   */
  async loadDirectory(dirPath: string): Promise<VirtualPhase[]> {
    const files = await this.getMarkdownFiles(dirPath);
    const allPhases: VirtualPhase[] = [];

    for (const file of files) {
      const phases = await this.parseMarkdownFile(file);
      allPhases.push(...phases);
    }

    return allPhases;
  }
}
