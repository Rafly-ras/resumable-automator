import { Command } from 'commander';
import * as path from 'path';
import * as fs from 'fs';
import { StateManager } from '../core/StateManager';
import { Orchestrator, VirtualPhase } from '../core/Orchestrator';
import { Validator } from '../core/Validator';
import { Gatekeeper } from '../core/Gatekeeper';

const DOCS_DIR = path.resolve(process.cwd(), './TRD');

const stateManager = new StateManager();
const orchestrator = new Orchestrator();
const validator = new Validator();
const gatekeeper = new Gatekeeper();

/**
 * Helper untuk memuat seluruh VirtualPhase dari folder ./TRD.
 */
async function getPhases(): Promise<VirtualPhase[]> {
  if (!fs.existsSync(DOCS_DIR)) {
    console.warn(`\n⚠️ Warning: Direktori '${DOCS_DIR}' tidak ditemukan.`);
    console.warn(`Silakan buat folder 'TRD' dan letakkan file Markdown proyek Anda di dalamnya.\n`);
    return [];
  }
  return await orchestrator.loadDirectory(DOCS_DIR);
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
      const state = await stateManager.loadState();
      const phases = await getPhases();

      if (phases.length === 0) {
        console.log('❌ Tidak ada fase markdown yang ditemukan.');
        return;
      }

      if (state.currentPhaseIndex >= phases.length) {
        console.log('🎉 Selamat! Seluruh fase proyek telah selesai dieksekusi.');
        return;
      }

      const activePhase = phases[state.currentPhaseIndex];
      const prompt = gatekeeper.generateStrictPrompt(
        activePhase.title,
        activePhase.content
      );

      console.log('\n==================================================');
      console.log(`🔒 GATEKEEPER LOCK - FASE AKTIF [${state.currentPhaseIndex + 1}/${phases.length}]`);
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
      const state = await stateManager.loadState();
      const phases = await getPhases();

      if (phases.length === 0) {
        console.log('❌ Tidak ada fase markdown yang ditemukan.');
        return;
      }

      if (state.currentPhaseIndex >= phases.length) {
        console.log('🎉 Seluruh fase (100%) telah selesai!');
        return;
      }

      const activePhase = phases[state.currentPhaseIndex];
      const validation = validator.validateContent(activePhase.content);

      console.log('\n📊 AUTOMATOR STATUS REPORT');
      console.log('--------------------------------------------------');
      console.log(`📌 Job ID          : ${state.jobId}`);
      console.log(`🎯 Fase Aktif      : ${activePhase.title} (Index: ${state.currentPhaseIndex})`);
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

      if (phases.length === 0) {
        console.log('❌ Tidak ada fase markdown yang ditemukan.');
        process.exit(1);
      }

      if (state.currentPhaseIndex >= phases.length) {
        console.log('🎉 Seluruh fase sudah selesai. Tidak ada fase selanjutnya.');
        return;
      }

      const activePhase = phases[state.currentPhaseIndex];
      const validation = validator.validateContent(activePhase.content);

      if (validation.progressPercentage < 100) {
        console.error('\n⛔ EXECUTION FAILED: Transisi Fase Ditolak!');
        console.error(`Progression saat ini: ${validation.progressPercentage}% (${validation.completedTasks}/${validation.totalTasks} tugas completed)`);
        console.error('\nTugas yang masih PENDING:');
        validation.pendingTasks.forEach((task, idx) => {
          console.error(` ❌ [ ] ${task}`);
        });
        console.error('\nSelesaikan seluruh tugas pending sebelum melanjut ke fase berikutnya.\n');
        process.exit(1);
      }

      console.log(`\n✅ Phase [${activePhase.title}] divalidasi sempurna (100%).`);
      const nextState = await stateManager.advancePhase();
      console.log(`🔓 Gerbang menuju fase selanjutnya (Index: ${nextState.currentPhaseIndex}) telah dibuka!\n`);
    } catch (error: any) {
      console.error('❌ Error executing next:', error.message);
      process.exit(1);
    }
  });

program.parse(process.argv);
