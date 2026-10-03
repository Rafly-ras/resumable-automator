import { Command } from 'commander';
import * as path from 'path';
import { StateManager, AutomatorState } from '../core/StateManager';
import { Orchestrator, VirtualPhase } from '../core/Orchestrator';
import { Validator } from '../core/Validator';
import { Gatekeeper } from '../core/Gatekeeper';

const stateManager = new StateManager();
const orchestrator = new Orchestrator();
const validator = new Validator();
const gatekeeper = new Gatekeeper();

async function getPhases(): Promise<VirtualPhase[]> {
  return await orchestrator.loadPhasesFromProject(process.cwd());
}

async function getValidState(): Promise<{ state: AutomatorState; phases: VirtualPhase[] }> {
  let state = await stateManager.loadState();
  const phases = await getPhases();

  // Jika state index di luar jangkauan fase, validasi kembali ke batas valid
  if (state.currentPhaseIndex >= phases.length) {
    state.currentPhaseIndex = 0;
    await stateManager.saveState(state);
  }

  return { state, phases };
}

const program = new Command();

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
      const prompt = gatekeeper.generateStrictPrompt(
        activePhase.title,
        activePhase.content
      );

      console.log('==================================================');
      console.log(`🔒 GATEKEEPER LOCK - FASE AKTIF [${state.currentPhaseIndex + 1}/${phases.length}]`);
      console.log(`📁 File Source: ${path.basename(activePhase.filePath)}`);
      console.log('==================================================\n');
      console.log(prompt);
      console.log('\n==================================================\n');
    } catch (error: any) {
      console.error('❌ Error executing start:', error.message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Cek status orchestrator dan struktur kodenya pada fase aktif')
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
      console.log('--------------------------------------------------');
      console.log(`🎨 Frontend Code (FE)  : ${validation.feProgress}%`);
      console.log(`⚙️ Backend Code (BE)   : ${validation.beProgress}%`);
      console.log(`🗄️ Database & Routes   : ${validation.dbProgress}%`);
      console.log('--------------------------------------------------');
      console.log(`📈 Progress Total      : ${validation.progressPercentage}%`);
      console.log(`✅ Tugas Selesai      : ${validation.completedTasks} / ${validation.totalTasks}`);

      if (validation.pendingTasks.length > 0) {
        console.log('\n⏳ Task Pending:');
        validation.pendingTasks.forEach((task, idx) => {
          console.log(`   ${idx + 1}. [ ] ${task}`);
        });
      } else {
        console.log('\n✨ Semua tugas pada fase ini telah diselesaikan!');
      }
      console.log('--------------------------------------------------\n');
    } catch (error: any) {
      console.error('❌ Error checking status:', error.message);
      process.exit(1);
    }
  });

program
  .command('next')
  .description('Lanjutkan ke fase berikutnya (Hard Blocker jika task pending)')
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

      // Blokir transisi jika masih ada tugas yang pending (progress < 100%)
      if (validation.progressPercentage < 100 && validation.pendingTasks.length > 0) {
        console.error('\n⛔ EXECUTION FAILED: Transisi Fase Ditolak!');
        console.error(`Progression Total: ${validation.progressPercentage}% (${validation.completedTasks}/${validation.totalTasks} tugas completed)`);
        console.error(`🎨 Frontend (FE): ${validation.feProgress}% | ⚙️ Backend (BE): ${validation.beProgress}% | 🗄️ Database: ${validation.dbProgress}%`);
        console.error(`File Source: ${path.basename(activePhase.filePath)}`);
        console.error('\nTugas yang masih PENDING:');
        validation.pendingTasks.forEach((task, idx) => {
          console.error(` ❌ [ ] ${task}`);
        });
        console.error('\nLengkapi kode backend/frontend/database yang pending sebelum melanjut ke fase berikutnya.\n');
        process.exit(1);
      }

      console.log(`\n✅ Phase [${activePhase.title}] (${path.basename(activePhase.filePath)}) disetujui.`);
      const nextState = await stateManager.advancePhase();
      const newActive = phases[nextState.currentPhaseIndex];
      console.log(`🔓 Gerbang menuju fase selanjutnya dibuka!`);
      console.log(`🎯 Fase Aktif Baru: ${newActive.title} [Fase ${nextState.currentPhaseIndex + 1} dari ${phases.length}]\n`);
    } catch (error: any) {
      console.error('❌ Error executing next:', error.message);
      process.exit(1);
    }
  });

program
  .command('jump <target>')
  .alias('goto')
  .description('Pindah langsung ke fase tertentu (contoh: npx automator jump fase-4 atau npx automator jump 5)')
  .action(async (target: string) => {
    try {
      const phases = await getPhases();
      let targetIndex = -1;

      // 1. Cari berdasarkan pencocokan nama file (misal: "fase-4" atau "fase-5")
      const query = target.toLowerCase();
      targetIndex = phases.findIndex(
        (p) =>
          path.basename(p.filePath).toLowerCase().includes(query) ||
          p.title.toLowerCase().includes(query)
      );

      // 2. Jika tidak cocok nama file, periksa apakah target berupa nomor angka
      if (targetIndex === -1 && /^\d+$/.test(target)) {
        const num = parseInt(target, 10);
        if (num >= 1 && num <= phases.length) {
          targetIndex = num - 1;
        } else if (num >= 0 && num < phases.length) {
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
    } catch (error: any) {
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
    } catch (error: any) {
      console.error('❌ Error resetting state:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
