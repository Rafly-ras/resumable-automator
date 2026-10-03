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
const path = __importStar(require("path"));
class Orchestrator {
    /**
     * Membaca direktori dan mengembalikan daftar file .md yang telah diurutkan dengan Natural Sort.
     */
    async getMarkdownFiles(dirPath) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        const mdFiles = entries
            .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
            .map((entry) => path.join(dirPath, entry.name));
        // Natural sort: phase-2.md muncul sebelum phase-10.md
        mdFiles.sort((a, b) => path.basename(a).localeCompare(path.basename(b), undefined, {
            numeric: true,
            sensitivity: 'base',
        }));
        return mdFiles;
    }
    /**
     * Membaca isi file Markdown dan memotongnya menjadi array VirtualPhase berdasarkan heading (## Phase, ### Tahap, ## Step).
     */
    async parseMarkdownFile(filePath) {
        const rawContent = await fs.readFile(filePath, 'utf-8');
        const lines = rawContent.split(/\r?\n/);
        const phases = [];
        const headingRegex = /^(#{2,3})\s+((?:Phase|Tahap|Step)\b.*)$/i;
        let currentTitle = null;
        let currentHeadingLevel = 2;
        let currentLines = [];
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
            }
            else {
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
    async loadDirectory(dirPath) {
        const files = await this.getMarkdownFiles(dirPath);
        const allPhases = [];
        for (const file of files) {
            const phases = await this.parseMarkdownFile(file);
            allPhases.push(...phases);
        }
        return allPhases;
    }
}
exports.Orchestrator = Orchestrator;
