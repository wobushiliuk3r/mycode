import fs from 'fs';
import path from 'path';

export interface KVStore {
  get(key: string): Promise<string | null>;
  put(key: string, value: string): Promise<void>;
}

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');
const KV_FILE = path.join(DATA_DIR, 'kv.json');

class FileKV implements KVStore {
  private data: Record<string, string> = {};

  constructor() {
    try {
      if (fs.existsSync(KV_FILE)) {
        this.data = JSON.parse(fs.readFileSync(KV_FILE, 'utf-8'));
      }
    } catch {
      this.data = {};
    }
  }

  private save(): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(KV_FILE, JSON.stringify(this.data), 'utf-8');
  }

  async get(key: string): Promise<string | null> {
    return this.data[key] ?? null;
  }

  async put(key: string, value: string): Promise<void> {
    this.data[key] = value;
    this.save();
  }
}

export const kv: KVStore = new FileKV();
