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
    'notes.md',
]);
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
     * Memprioritaskan folder fase khusus (seperti docs/phases/ atau phases/)
     * agar file referensi TRD (seperti docs/trd/) tidak bercampur menjadi ratusan sub-fase.
     */
    prioritizePhaseFiles(filePaths, projectRoot) {
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
     * Membaca file Markdown fase. Setiap file di folder fase dianggap 1 VirtualPhase yang utuh.
     */
    async parseMarkdownFile(filePath) {
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const firstLine = rawContent.split(/\r?\n/)[0] || '';
        let title = path.basename(filePath, '.md');
        if (firstLine.startsWith('#')) {
            title = firstLine.replace(/^#+\s*/, '').trim();
        }
        return [
            {
                filePath,
                title,
                content: rawContent.trim(),
                headingLevel: 1,
            },
        ];
    }
    /**
     * Dedicated Phase Loader:
     * Memuat file fase asli secara tepat (misalnya 8 file di docs/phases/)
     * tanpa bercampur dengan ratusan file spesifikasi TRD.
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
