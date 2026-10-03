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
     * Verifikasi modul/entity utama di codebase berdasarkan nama modul atau teks tugas.
     */
    isModuleImplemented(moduleName) {
        const textLower = moduleName.toLowerCase();
        const files = this.getAllProjectFiles();
        // 1. Setup dasar framework
        if (textLower.includes('laravel') || textLower.includes('fondasi')) {
            const hasComposer = files.some((f) => path.basename(f) === 'composer.json' || path.basename(f) === 'package.json');
            const hasArtisan = files.some((f) => path.basename(f) === 'artisan');
            if (hasComposer || hasArtisan)
                return true;
        }
        // 2. Ekstrak nama entity utama (misal: "Menu 11 Tahun Akademik" -> "tahunakademik" / "tahun" / "akademik")
        const cleaned = moduleName.replace(/menu\s*\d+/gi, '').replace(/[^\w\s]/gi, '').trim();
        const words = cleaned.split(/\s+/).filter((w) => w.length > 2 && !['tahap', 'fondasi', 'dasar', 'lanjutan', 'lengkap'].includes(w.toLowerCase()));
        if (words.length === 0) {
            return false;
        }
        // Cari apakah file controller, model, migration, atau view yang berhubungan sudah ada
        for (const word of words) {
            const wLower = word.toLowerCase();
            const match = files.some((filePath) => {
                const baseName = path.basename(filePath).toLowerCase();
                return baseName.includes(wLower);
            });
            if (match)
                return true;
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
     * Menganalisis konten Markdown dan memverifikasi kodenya di dalam codebase:
     * 1. Jika ada GFM Checkbox (- [x] / - [ ]), gunakan checkbox tersebut.
     * 2. Jika berupa poin "- Item" di bawah "In Scope", periksa status modul utama pada codebase.
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
        // 2. Jika tidak ada GFM Checkbox, periksa berdasarkan Modul & Codebase Verification
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
                    }
                    else if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
                        currentSectionTitle = headingText;
                        inScopeSection = false;
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
                            // Verifikasi modul utama (misal: "Menu 10 Users", "Menu 8 Login", "Menu 18 Kelas")
                            const targetModule = currentSectionTitle || itemText;
                            const isImplemented = this.verifier.isModuleImplemented(targetModule);
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
