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
exports.Validator = exports.CodebaseVerifier = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CodebaseVerifier {
    projectRoot;
    fileCache = null;
    constructor(projectRoot = process.cwd()) {
        this.projectRoot = projectRoot;
    }
    /**
     * Rekursif mengumpulkan seluruh file dalam codebase (mengabaikan node_modules, .git, vendor, dist, storage)
     */
    getAllProjectFiles(dir = this.projectRoot) {
        if (this.fileCache && dir === this.projectRoot) {
            return this.fileCache;
        }
        let results = [];
        const blacklist = new Set(['node_modules', 'vendor', '.git', 'dist', 'build', '.automator', 'storage', 'public']);
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!blacklist.has(entry.name) && !entry.name.startsWith('.')) {
                        results = results.concat(this.getAllProjectFiles(fullPath));
                    }
                }
                else if (entry.isFile()) {
                    results.push(fullPath);
                }
            }
        }
        catch {
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
    getTaskLayer(taskText) {
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
     * Memeriksa secara STRICT apakah komponen kode (FE, BE, atau DB) benar-benar ada di folder arsitektur yang sesuai
     */
    isTaskImplementedInCodebase(sectionTitle, taskText) {
        const layer = this.getTaskLayer(taskText);
        const combined = `${sectionTitle} ${taskText}`.toLowerCase();
        const files = this.getAllProjectFiles();
        // 1. Ekstrak kata kunci entity utama
        const cleaned = combined
            .replace(/menu\s*\d+/gi, '')
            .replace(/[^\w\s]/gi, ' ')
            .trim();
        const stopWords = new Set([
            'menu', 'tahap', 'fondasi', 'dasar', 'lanjutan', 'lengkap', 'master', 'project',
            'seluruh', 'isi', 'trd', 'pada', 'dan', 'dengan', 'untuk', 'yang', 'dalam', 'fitur',
            'halaman', 'alur', 'proses', 'validasi', 'kriteria', 'penutupan', 'in', 'scope', 'out', 'tabel', 'model',
            'frontend', 'backend', 'routing', 'acceptance', 'criteria', 'crud', 'bulk', 'action'
        ]);
        let keywords = cleaned.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
        // Jika kata kunci dari item spesifik terfilter oleh stopWords (seperti "relasi dasar"), gunakan entity dari sectionTitle
        if (keywords.length === 0 && sectionTitle) {
            const cleanedSection = sectionTitle
                .replace(/menu\s*\d+/gi, '')
                .replace(/[^\w\s]/gi, ' ')
                .trim();
            keywords = cleanedSection.split(/\s+/).filter((w) => w.length > 2 && !stopWords.has(w.toLowerCase()));
        }
        if (keywords.length === 0) {
            return false;
        }
        // 2. Strict Check per Layer (Tanpa Loose Fallback)
        for (const kw of keywords) {
            const kwLower = kw.toLowerCase();
            const match = files.some((filePath) => {
                const baseName = path.basename(filePath).toLowerCase();
                const relPath = path.relative(this.projectRoot, filePath).toLowerCase().replace(/\\/g, '/');
                if (!baseName.includes(kwLower) && !relPath.includes(kwLower)) {
                    return false;
                }
                if (layer === 'FE') {
                    // Strict FE Check: Harus berada di folder views / components / blade
                    return (relPath.includes('views') ||
                        relPath.includes('components') ||
                        baseName.endsWith('.blade.php') ||
                        baseName.endsWith('.vue') ||
                        baseName.endsWith('.jsx'));
                }
                else if (layer === 'DB') {
                    // Strict DB Check: Harus berada di folder migrations / seeders / routes
                    return (relPath.includes('migrations') ||
                        relPath.includes('seeders') ||
                        relPath.includes('routes'));
                }
                else {
                    // Strict BE Check: Harus berupa Controller, Model, Service, Request, Policy
                    return (relPath.includes('controllers') ||
                        relPath.includes('models') ||
                        relPath.includes('services') ||
                        relPath.includes('requests') ||
                        relPath.includes('policies'));
                }
            });
            if (match) {
                return true;
            }
        }
        return false;
    }
}
exports.CodebaseVerifier = CodebaseVerifier;
class Validator {
    verifier;
    constructor(verifier = new CodebaseVerifier()) {
        this.verifier = verifier;
    }
    /**
     * Menganalisis konten Markdown fase dan memindai secara STRICT struktur kode proyek:
     * Menghitung progress terurai secara terstruktur:
     * - Frontend Progress (FE) %
     * - Backend Progress (BE) %
     * - Database & Integration Progress (DB) %
     * - Overall Phase Progress %
     */
    validateContent(content) {
        let totalTasks = 0;
        let completedTasks = 0;
        let totalFE = 0;
        let completedFE = 0;
        let totalBE = 0;
        let completedBE = 0;
        let totalDB = 0;
        let completedDB = 0;
        const pendingTasks = [];
        const lines = content.split(/\r?\n/);
        let currentSectionTitle = '';
        let inScopeSection = false;
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith('#')) {
                const headingText = trimmed.replace(/^#+\s*/, '');
                if (/in\s*scope/i.test(trimmed) && !/out\s*of\s*scope/i.test(trimmed)) {
                    inScopeSection = true;
                }
                else {
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
                        if (layer === 'FE')
                            totalFE++;
                        else if (layer === 'DB')
                            totalDB++;
                        else
                            totalBE++;
                        let isImplemented = false;
                        // Cek apakah item ditandai manual [x]
                        if (/^\[x\]/i.test(itemText) || /^\(x\)/i.test(itemText)) {
                            isImplemented = true;
                        }
                        else {
                            // Cek secara STRICT di dalam folder layer codebase aktual
                            isImplemented = this.verifier.isTaskImplementedInCodebase(currentSectionTitle, itemText);
                        }
                        if (isImplemented) {
                            completedTasks++;
                            if (layer === 'FE')
                                completedFE++;
                            else if (layer === 'DB')
                                completedDB++;
                            else
                                completedBE++;
                        }
                        else {
                            const cleanPendingText = itemText.replace(/^\[\s*\]\s*/, '');
                            pendingTasks.push(cleanPendingText);
                        }
                    }
                }
            }
        }
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
        const feProgress = totalFE > 0 ? Math.round((completedFE / totalFE) * 100) : 0;
        const beProgress = totalBE > 0 ? Math.round((completedBE / totalBE) * 100) : 0;
        const dbProgress = totalDB > 0 ? Math.round((completedDB / totalDB) * 100) : 0;
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
exports.Validator = Validator;
