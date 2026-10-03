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
async function getPhases() {
    return await orchestrator.loadPhasesFromProject(process.cwd());
}
async function getValidState() {
    let state = await stateManager.loadState();
    const phases = await getPhases();
    // Jika state index di luar jangkauan fase, validasi kembali ke batas valid
    if (state.currentPhaseIndex >= phases.length) {
        state.currentPhaseIndex = 0;
        await stateManager.saveState(state);
    }
    return { state, phases };
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
        const { state, phases } = await getValidState();
        if (state.currentPhaseIndex >= phases.length) {
            console.log('🎉 Selamat! Seluruh fase proyek telah selesai dieksekusi.');
            return;
        }
        const activePhase = phases[state.currentPhaseIndex];
        const prompt = gatekeeper.generateStrictPrompt(activePhase.title, activePhase.content);
        console.log('==================================================');
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
        const { state, phases } = await getValidState();
        if (state.currentPhaseIndex >= phases.length) {
            console.log('🎉 Seluruh fase (100%) telah selesai!');
            return;
        }
        const activePhase = phases[state.currentPhaseIndex];
        const validation = validator.validateContent(activePhase.content);
        console.log('📊 AUTOMATOR STATUS REPORT');
        console.log('--------------------------------------------------');
        console.log(`📌 Job ID          : ${state.jobId}`);
        console.log(`🎯 Fase Aktif      : ${activePhase.title} [Fase ${state.currentPhaseIndex + 1} dari ${phases.length}]`);
        console.log(`📁 File Source     : ${activePhase.filePath}`);
        console.log(`📈 Progress        : ${validation.progressPercentage}%`);
        console.log(`✅ Item Scope      : ${validation.totalTasks} Item`);
        if (validation.hasGfmCheckboxes && validation.pendingTasks.length > 0) {
            console.log('\n⏳ Checkbox Pending:');
            validation.pendingTasks.forEach((task, idx) => {
                console.log(`   ${idx + 1}. [ ] ${task}`);
            });
        }
        else {
            console.log('\n✨ Seluruh tugas/scope pada fase ini siap dieksekusi!');
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
    .description('Lanjutkan ke fase berikutnya (Hard Blocker jika checklist pending)')
    .action(async () => {
    try {
        const state = await stateManager.loadState();
        const phases = await getPhases();
        if (state.currentPhaseIndex >= phases.length - 1) {
            console.log('🎉 Ini adalah fase terakhir proyek.');
            return;
        }
        const activePhase = phases[state.currentPhaseIndex];
        const validation = validator.validateContent(activePhase.content);
        // Jika ada checklist GFM yang masih pending (- [ ]), blokir transisi
        if (validation.hasGfmCheckboxes && validation.progressPercentage < 100) {
            console.error('\n⛔ EXECUTION FAILED: Transisi Fase Ditolak!');
            console.error(`Progression saat ini: ${validation.progressPercentage}% (${validation.completedTasks}/${validation.totalTasks} tugas completed)`);
            console.error(`File Source: ${path.basename(activePhase.filePath)}`);
            console.error('\nTugas yang masih PENDING:');
            validation.pendingTasks.forEach((task, idx) => {
                console.error(` ❌ [ ] ${task}`);
            });
            console.error('\nSelesaikan seluruh tugas pending (- [ ]) sebelum melanjut ke fase berikutnya.\n');
            process.exit(1);
        }
        console.log(`\n✅ Phase [${activePhase.title}] (${path.basename(activePhase.filePath)}) disetujui.`);
        const nextState = await stateManager.advancePhase();
        const newActive = phases[nextState.currentPhaseIndex];
        console.log(`🔓 Gerbang menuju fase selanjutnya dibuka!`);
        console.log(`🎯 Fase Aktif Baru: ${newActive.title} [Fase ${nextState.currentPhaseIndex + 1} dari ${phases.length}]\n`);
    }
    catch (error) {
        console.error('❌ Error executing next:', error.message);
        process.exit(1);
    }
});
program
    .command('jump <target>')
    .alias('goto')
    .description('Pindah langsung ke fase tertentu (contoh: npx automator jump fase-5 atau npx automator jump 6)')
    .action(async (target) => {
    try {
        const phases = await getPhases();
        let targetIndex = -1;
        // 1. Cari berdasarkan pencocokan nama file (misal: "fase-5" atau "fase-4")
        const query = target.toLowerCase();
        targetIndex = phases.findIndex((p) => path.basename(p.filePath).toLowerCase().includes(query) ||
            p.title.toLowerCase().includes(query));
        // 2. Jika tidak cocok nama file, periksa apakah target berupa nomor angka
        if (targetIndex === -1 && /^\d+$/.test(target)) {
            const num = parseInt(target, 10);
            if (num >= 1 && num <= phases.length) {
                targetIndex = num - 1;
            }
            else if (num >= 0 && num < phases.length) {
                targetIndex = num;
            }
        }
        if (targetIndex === -1) {
            console.error(`❌ Fase "${target}" tidak ditemukan.`);
            console.log('\nDaftar Fase Tersedia:');
            phases.forEach((p, idx) => {
                console.log(`  ${idx + 1}. [${path.basename(p.filePath)}] ${p.title}`);
            });
            console.log('');
            process.exit(1);
        }
        const state = await stateManager.loadState();
        state.currentPhaseIndex = targetIndex;
        await stateManager.saveState(state);
        const active = phases[targetIndex];
        console.log(`\n🚀 Berhasil melompat ke Fase [${targetIndex + 1}/${phases.length}]: "${active.title}"`);
        console.log(`📁 File Source: ${path.basename(active.filePath)}\n`);
    }
    catch (error) {
        console.error('❌ Error jumping phase:', error.message);
        process.exit(1);
    }
});
program
    .command('reset')
    .description('Reset state automator kembali ke Fase 0 (Fase Pertama)')
    .action(async () => {
    try {
        const state = await stateManager.loadState();
        state.currentPhaseIndex = 0;
        await stateManager.saveState(state);
        const phases = await getPhases();
        console.log(`\n🔄 State automator berhasil di-reset ke Fase 1 dari ${phases.length}: "${phases[0].title}"\n`);
    }
    catch (error) {
        console.error('❌ Error resetting state:', error.message);
        process.exit(1);
    }
});
program.parse(process.argv);
