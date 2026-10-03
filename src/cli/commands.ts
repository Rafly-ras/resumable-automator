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

/**
 * Helper untuk memuat seluruh VirtualPhase secara otomatis dari proyek.
 */
async function getPhases(): Promise<VirtualPhase[]> {
  return await orchestrator.loadPhasesFromProject(process.cwd());
}

/**
 * Helper Auto-Sync:
 * Otomatis melompati (Fast-Forward) fase-fase yang 100% selesai
 * sehingga CLI mendarat pada fase aktif yang memerlukan pengerjaan.
 */
async function ensureAutoSyncedState(): Promise<{ state: AutomatorState; phases: VirtualPhase[] }> {
  let state = await stateManager.loadState();
  const phases = await getPhases();

  let skippedCount = 0;

  while (state.currentPhaseIndex < phases.length - 1) {
    const activePhase = phases[state.currentPhaseIndex];
    const validation = validator.validateContent(activePhase.content);

    // Jika fase saat ini 100% selesai dan tidak ada pending tasks, auto advance
    if (validation.progressPercentage === 100 && validation.pendingTasks.length === 0) {
      state = await stateManager.advancePhase();
      skippedCount++;
    } else {
      break;
    }
  }

  if (skippedCount > 0) {
    console.log(`⚡ [Auto-Sync] Otomatis melompati ${skippedCount} fase yang telah 100% selesai.\n`);
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
  .description('Mulai eksekusi task/workflow fase aktif (dengan Auto-Sync)')
  .action(async () => {
    try {
      const { state, phases } = await ensureAutoSyncedState();

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
  .description('Cek status orchestrator dan tugas fase aktif')
  .action(async () => {
    try {
      const { state, phases } = await ensureAutoSyncedState();

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
      console.log(`✅ Tugas Selesai   : ${validation.completedTasks} / ${validation.totalTasks}`);

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

      if (validation.progressPercentage < 100 && validation.pendingTasks.length > 0) {
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

      console.log(`\n✅ Phase [${activePhase.title}] (${path.basename(activePhase.filePath)}) divalidasi.`);
      const nextState = await stateManager.advancePhase();
      console.log(`🔓 Gerbang menuju fase selanjutnya (Index: ${nextState.currentPhaseIndex}) telah dibuka!\n`);
    } catch (error: any) {
      console.error('❌ Error executing next:', error.message);
      process.exit(1);
    }
  });

program
  .command('jump <target>')
  .alias('goto')
  .description('Pindah langsung ke fase tertentu (contoh: npx automator jump 4 atau npx automator jump fase-4)')
  .action(async (target: string) => {
    try {
      const phases = await getPhases();
      let targetIndex = -1;

      if (/^\d+$/.test(target)) {
        const num = parseInt(target, 10);
        if (num >= 1 && num <= phases.length) {
          targetIndex = num - 1;
        } else if (num >= 0 && num < phases.length) {
          targetIndex = num;
        }
      } else {
        const query = target.toLowerCase();
        targetIndex = phases.findIndex(
          (p) =>
            p.title.toLowerCase().includes(query) ||
            path.basename(p.filePath).toLowerCase().includes(query)
        );
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

program.parse(process.argv);
