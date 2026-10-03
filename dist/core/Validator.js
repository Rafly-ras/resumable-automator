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
     * Verifikasi apakah sebuah tugas pada Markdown sudah ter-implementasi di dalam codebase aktual.
     */
    isTaskImplemented(taskText) {
        const textLower = taskText.toLowerCase();
        const files = this.getAllProjectFiles();
        // 1. Cek inisialisasi framework / setup dasar
        if (textLower.includes('inisialisasi') || textLower.includes('setup') || textLower.includes('laravel')) {
            const hasComposer = files.some((f) => path.basename(f) === 'composer.json' || path.basename(f) === 'package.json');
            const hasArtisan = files.some((f) => path.basename(f) === 'artisan');
            if (hasComposer || hasArtisan)
                return true;
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
            if (match)
                matchCount++;
        }
        // Jika setidaknya 40% kata kunci ditemukan di codebase file, anggap ter-implementasi
        return matchCount > 0 && matchCount >= Math.ceil(keywords.length * 0.4);
    }
}
exports.CodebaseVerifier = CodebaseVerifier;
class Validator {
    verifier;
    constructor(verifier = new CodebaseVerifier()) {
        this.verifier = verifier;
    }
    /**
     * Menganalisis konten Markdown dan memverifikasi kodenya di dalam codebase:
     * 1. Jika ada GFM Checkbox (- [x] / - [ ]), gunakan checkbox tersebut.
     * 2. Jika berupa poin "- Item" di bawah "In Scope", lakukan pemindaian codebase aktual
     *    untuk menentukan apakah item tersebut sudah diimplementasikan atau masih pending.
     */
    validateContent(content) {
        let totalTasks = 0;
        let completedTasks = 0;
        const pendingTasks = [];
        // 1. Coba GFM Checkboxes dahulu (- [x] / - [ ])
        const gfmRegex = /^\s*[-*+]\s*\[([ xX])\]\s*(.+)$/gm;
        let match;
        while ((match = gfmRegex.exec(content)) !== null) {
            totalTasks++;
            const isChecked = match[1].toLowerCase() === 'x';
            const taskText = match[2].trim();
            if (isChecked) {
                completedTasks++;
            }
            else {
                pendingTasks.push(taskText);
            }
        }
        // 2. Jika tidak ada GFM Checkbox, periksa poin-poin di bawah bagian "In Scope" dengan CodebaseVerifier
        if (totalTasks === 0) {
            const lines = content.split(/\r?\n/);
            let inScopeSection = false;
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed.startsWith('#')) {
                    if (/in\s*scope/i.test(trimmed) && !/out\s*of\s*scope/i.test(trimmed)) {
                        inScopeSection = true;
                    }
                    else {
                        inScopeSection = false;
                    }
                    continue;
                }
                if (inScopeSection) {
                    const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
                    if (bulletMatch) {
                        const itemText = bulletMatch[1].trim();
                        if (itemText && !itemText.startsWith('**')) {
                            totalTasks++;
                            // Verifikasi apakah file/fitur ini sudah diimplementasikan di codebase
                            const isImplemented = this.verifier.isTaskImplemented(itemText);
                            if (isImplemented) {
                                completedTasks++;
                            }
                            else {
                                pendingTasks.push(itemText);
                            }
                        }
                    }
                }
            }
        }
        const progressPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;
        return {
            totalTasks,
            completedTasks,
            progressPercentage,
            pendingTasks,
        };
    }
}
exports.Validator = Validator;
