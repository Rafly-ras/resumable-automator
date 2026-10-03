import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'crypto';

export interface AutomatorState {
  jobId: string;
  currentPhaseIndex: number;
  isLocked: boolean;
  lastUpdated: string;
}

export class StateManager {
  private stateDirPath: string;
  private stateFilePath: string;

  constructor(projectDir: string = process.cwd()) {
    this.stateDirPath = path.join(projectDir, '.automator');
    this.stateFilePath = path.join(this.stateDirPath, 'state.json');
  }

  /**
   * Memastikan folder .automator sudah ada.
   */
  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.stateDirPath, { recursive: true });
  }

  /**
   * Menghasilkan state awal (default).
   */
  private getDefaultState(): AutomatorState {
    return {
      jobId: randomUUID(),
      currentPhaseIndex: 0,
      isLocked: false,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Membaca file state.json. Jika tidak ada, membuat folder & file baru dengan state default.
   */
  async loadState(): Promise<AutomatorState> {
    await this.ensureDir();
    try {
      const rawData = await fs.readFile(this.stateFilePath, 'utf-8');
      return JSON.parse(rawData) as AutomatorState;
    } catch (error: any) {
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
  async saveState(state: AutomatorState): Promise<void> {
    await this.ensureDir();
    state.lastUpdated = new Date().toISOString();
    await fs.writeFile(
      this.stateFilePath,
      JSON.stringify(state, null, 2),
      'utf-8'
    );
  }

  /**
   * Menaikkan currentPhaseIndex sebesar 1 dan menyimpannya.
   */
  async advancePhase(): Promise<AutomatorState> {
    const currentState = await this.loadState();
    currentState.currentPhaseIndex += 1;
    await this.saveState(currentState);
    return currentState;
  }
}
