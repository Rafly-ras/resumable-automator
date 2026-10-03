"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Orchestrator = void 0;
const fs = __importStar(require("fs/promises"));
const syncFs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
function stripCodeBlocks(markdownContent) {
    return markdownContent.replace(/(```|~~~)[[\s\S]*?\1/g, '');
}
class Orchestrator {
    /**
     * Rekursif mencari semua file .md di direktori proyek, mengabaikan folder & file blacklist/template.
     */
    findMarkdownFilesRecursively(dirPath) {
        let results = [];
        let entries;
        try {
            entries = syncFs.readdirSync(dirPath, { withFileTypes: true });
        }
        catch {
            return [];
        }
        for (const entry of entries) {
            const fullPath = path.join(dirPath, entry.name);
            const nameLower = entry.name.toLowerCase();
            if (entry.isDirectory()) {
                if (!BLACKLIST_DIRS.has(entry.name) && !entry.name.startsWith('.')) {
                    results = results.concat(this.findMarkdownFilesRecursively(fullPath));
                }
            }
            else if (entry.isFile()) {
                if (nameLower.endsWith('.md') && !IGNORED_FILE_NAMES.has(nameLower)) {
                    results.push(fullPath);
                }
            }
        }
        results.sort((a, b) => a.localeCompare(b, undefined, {
            numeric: true,
            sensitivity: 'base',
        }));
        return results;
    }
    /**
     * Memprioritaskan file .md dari direktori fase (misalnya docs/phases/, TRD/, tasks/).
     */
    prioritizePhaseFiles(filePaths, projectRoot) {
        const phaseFiles = [];
        const otherFiles = [];
        for (const file of filePaths) {
            const relativePath = path.relative(projectRoot, file).toLowerCase().replace(/\\/g, '/');
            const isPhaseDir = PHASE_DIR_PATTERNS.some((pattern) => relativePath.includes(pattern));
            if (isPhaseDir) {
                phaseFiles.push(file);
            }
            else {
                otherFiles.push(file);
            }
        }
        return phaseFiles.length > 0 ? phaseFiles : otherFiles;
    }
    /**
     * Memotong dokumen Markdown menjadi VirtualPhase berdasarkan HEADING (# s/d ######).
     * Mendukung GFM Checkbox (- [ ] / - [x]) DAN List items (- Item).
     */
    async parseMarkdownFile(filePath) {
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const contentClean = stripCodeBlocks(rawContent);
        // Cek apakah ada tugas berupa GFM checklist ATAU list item (- / * / 1.)
        const hasTasksOrLists = /^\s*[-*+]\s*(\[[ xX]\]|.+)/m.test(contentClean);
        if (!hasTasksOrLists) {
            return [];
        }
        const lines = rawContent.split(/\r?\n/);
        const phases = [];
        const anyHeadingRegex = /^(#{1,6})\s+(.+)$/;
        let currentTitle = null;
        let currentHeadingLevel = 1;
        let currentLines = [];
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
            }
            else {
                if (currentTitle !== null) {
                    currentLines.push(line);
                }
                else {
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
    async loadPhasesFromProject(projectRoot = process.cwd()) {
        const rawFiles = this.findMarkdownFilesRecursively(projectRoot);
        const targetFiles = this.prioritizePhaseFiles(rawFiles, projectRoot);
        const allPhases = [];
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
exports.Orchestrator = Orchestrator;
