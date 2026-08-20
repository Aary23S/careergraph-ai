import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { createReadStream } from 'fs';
import { env } from '../config/env.js';

export class LocalFileStorage {
  constructor(basePath = env.resumeStoragePath) {
    this.basePath = path.resolve(basePath);
  }

  async ensureBasePath() {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async save(file) {
    await this.ensureBasePath();
    const extension = path.extname(file.originalname);
    const key = `${crypto.randomUUID()}${extension}`;
    const fullPath = path.join(this.basePath, key);
    await fs.writeFile(fullPath, file.buffer);

    return {
      key,
      path: fullPath,
    };
  }

  async replace(key, file) {
    await this.delete(key);
    return this.save(file);
  }

  async delete(key) {
    try {
      await fs.unlink(path.join(this.basePath, key));
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  createReadStream(key) {
    return createReadStream(path.join(this.basePath, key));
  }
}

export const fileStorage = new LocalFileStorage();
