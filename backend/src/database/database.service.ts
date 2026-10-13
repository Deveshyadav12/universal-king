import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool?: Pool;

  async onModuleInit(): Promise<void> {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is required to start the backend.');
    }

    this.pool = new Pool({
      connectionString,
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    this.pool.on('error', (error: Error) => {
      console.error('Unexpected PostgreSQL pool error.', error);
    });

    try {
      await this.pool.query('SELECT 1');
      const schemaPath = this.getSchemaPath();
      await this.pool.query(readFileSync(schemaPath, 'utf8'));
    } catch (error) {
      await this.pool.end();
      this.pool = undefined;
      throw new Error('Could not connect to or initialize PostgreSQL.', {
        cause: error,
      });
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool?.end();
  }

  query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[],
  ): Promise<QueryResult<Row>> {
    if (!this.pool) {
      throw new ServiceUnavailableException('PostgreSQL is not initialized.');
    }
    return this.pool.query<Row>(text, values as unknown[] | undefined);
  }

  async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    if (!this.pool) {
      throw new ServiceUnavailableException('PostgreSQL is not initialized.');
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await operation(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  private getSchemaPath(): string {
    const configured = process.env.HEXAWAVE_DATABASE_SCHEMA;
    const candidates = configured
      ? [resolve(configured)]
      : [
          resolve(process.cwd(), 'infrastructure/database/schema.sql'),
          resolve(process.cwd(), '../infrastructure/database/schema.sql'),
        ];
    const schemaPath = candidates.find((candidate) => existsSync(candidate));
    if (!schemaPath) {
      throw new Error(
        'PostgreSQL schema was not found. Set HEXAWAVE_DATABASE_SCHEMA or include infrastructure/database/schema.sql.',
      );
    }
    return schemaPath;
  }
}
