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
const commander_1 = require("commander");
const path = __importStar(require("path"));
const StateManager_1 = require("../core/StateManager");
const Orchestrator_1 = require("../core/Orchestrator");
const Validator_1 = require("../core/Validator");
const Gatekeeper_1 = require("../core/Gatekeeper");
const stateManager = new StateManager_1.StateManager();
const orchestrator = new Orchestrator_1.Orchestrator();
const validator = new Validator_1.Validator();
const gatekeeper = new Gatekeeper_1.Gatekeeper();
/**
 * Helper untuk memuat seluruh VirtualPhase secara otomatis dari proyek.
 */
async function getPhases() {
    return await orchestrator.loadPhasesFromProject(process.cwd());
}
const program = new commander_1.Command();
program
    .name('automator')
    .description('AI Gatekeeper & Stateful Task Orchestrator')
    .version('1.0.0');
program
    .command('start')
    .description('Mulai eksekusi task/workflow fase aktif')
    .action(async () => {
    try {
        const state = await stateManager.loadState();
        const phases = await getPhases();
        if (state.currentPhaseIndex >= phases.length) {
            console.log('🎉 Selamat! Seluruh fase proyek telah selesai dieksekusi.');
            return;
        }
        const activePhase = phases[state.currentPhaseIndex];
        const prompt = gatekeeper.generateStrictPrompt(activePhase.title, activePhase.content);
        console.log('\n==================================================');
        console.log(`🔒 GATEKEEPER LOCK - FASE AKTIF [${state.currentPhaseIndex + 1}/${phases.length}]`);
        console.log(`📁 File Source: ${path.basename(activePhase.filePath)}`);
        console.log('==================================================\n');
        console.log(prompt);
        console.log('\n==================================================\n');
    }
    catch (error) {
        console.error('❌ Error executing start:', error.message);
        process.exit(1);
    }
});
program
    .command('status')
    .description('Cek status orchestrator dan tugas fase aktif')
    .action(async () => {
    try {
        const state = await stateManager.loadState();
        const phases = await getPhases();
        if (state.currentPhaseIndex >= phases.length) {
            console.log('🎉 Seluruh fase (100%) telah selesai!');
            return;
        }
        const activePhase = phases[state.currentPhaseIndex];
        const validation = validator.validateContent(activePhase.content);
        console.log('\n📊 AUTOMATOR STATUS REPORT');
        console.log('--------------------------------------------------');
        console.log(`📌 Job ID          : ${state.jobId}`);
        console.log(`🎯 Fase Aktif      : ${activePhase.title} [Fase ${state.currentPhaseIndex + 1} dari ${phases.length}]`);
        console.log(`📁 File Source     : ${activePhase.filePath}`);
        console.log(`📈 Progress        : ${validation.progressPercentage}%`);
        console.log(`✅ Tugas Selesai   : ${validation.completedTasks} / ${validation.totalTasks}`);
        if (validation.pendingTasks.length > 0) {
            console.log('\n⏳ Task Pending:');
            validation.pendingTasks.forEach((task, idx) => {
                console.log(`   ${idx + 1}. [ ] ${task}`);
            });
        }
        else {
            console.log('\n✨ Semua tugas pada fase ini telah diselesaikan!');
        }
        console.log('--------------------------------------------------\n');
    }
    catch (error) {
        console.error('❌ Error checking status:', error.message);
        process.exit(1);
    }
});
program
    .command('next')
    .description('Lanjutkan ke fase berikutnya (Hard Blocker)')
    .action(async () => {
    try {
        const state = await stateManager.loadState();
        const phases = await getPhases();
        if (state.currentPhaseIndex >= phases.length) {
            console.log('🎉 Seluruh fase sudah selesai. Tidak ada fase selanjutnya.');
            return;
        }
        const activePhase = phases[state.currentPhaseIndex];
        const validation = validator.validateContent(activePhase.content);
        if (validation.progressPercentage < 100) {
            console.error('\n⛔ EXECUTION FAILED: Transisi Fase Ditolak!');
            console.error(`Progression saat ini: ${validation.progressPercentage}% (${validation.completedTasks}/${validation.totalTasks} tugas completed)`);
            console.error(`File Source: ${path.basename(activePhase.filePath)}`);
            console.error('\nTugas yang masih PENDING:');
            validation.pendingTasks.forEach((task, idx) => {
                console.error(` ❌ [ ] ${task}`);
            });
            console.error('\nSelesaikan seluruh tugas pending sebelum melanjut ke fase berikutnya.\n');
            process.exit(1);
        }
        console.log(`\n✅ Phase [${activePhase.title}] (${path.basename(activePhase.filePath)}) divalidasi sempurna (100%).`);
        const nextState = await stateManager.advancePhase();
        console.log(`🔓 Gerbang menuju fase selanjutnya (Index: ${nextState.currentPhaseIndex}) telah dibuka!\n`);
    }
    catch (error) {
        console.error('❌ Error executing next:', error.message);
        process.exit(1);
    }
});
program.parse(process.argv);
