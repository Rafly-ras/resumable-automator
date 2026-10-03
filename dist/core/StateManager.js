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
exports.StateManager = void 0;
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class StateManager {
    stateDirPath;
    stateFilePath;
    constructor(projectDir = process.cwd()) {
        this.stateDirPath = path.join(projectDir, '.automator');
        this.stateFilePath = path.join(this.stateDirPath, 'state.json');
    }
    /**
     * Memastikan folder .automator sudah ada.
     */
    async ensureDir() {
        await fs.mkdir(this.stateDirPath, { recursive: true });
    }
    /**
     * Menghasilkan state awal (default).
     */
    getDefaultState() {
        return {
            jobId: (0, crypto_1.randomUUID)(),
            currentPhaseIndex: 0,
            isLocked: false,
            lastUpdated: new Date().toISOString(),
        };
    }
    /**
     * Membaca file state.json. Jika tidak ada, membuat folder & file baru dengan state default.
     */
    async loadState() {
        await this.ensureDir();
        try {
            const rawData = await fs.readFile(this.stateFilePath, 'utf-8');
            return JSON.parse(rawData);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                const defaultState = this.getDefaultState();
                await this.saveState(defaultState);
                return defaultState;
            }
            throw error;
        }
    }
    /**
     * Menyimpan AutomatorState ke file .automator/state.json.
     */
    async saveState(state) {
        await this.ensureDir();
        state.lastUpdated = new Date().toISOString();
        await fs.writeFile(this.stateFilePath, JSON.stringify(state, null, 2), 'utf-8');
    }
    /**
     * Menaikkan currentPhaseIndex sebesar 1 dan menyimpannya.
     */
    async advancePhase() {
        const currentState = await this.loadState();
        currentState.currentPhaseIndex += 1;
        await this.saveState(currentState);
        return currentState;
    }
}
exports.StateManager = StateManager;
