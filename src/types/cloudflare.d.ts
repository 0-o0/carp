interface CloudflareEnv {
  DB?: D1Database;
  carp?: D1Database;
  SUPER_ADMIN_USERNAME: string;
  SUPER_ADMIN_PASSWORD: string;
  DEFAULT_ADMIN_PASSWORD: string;
  DEFAULT_USE_COUNT: string;
  JWT_SECRET: string;
}

declare global {
  interface D1Database {
    prepare(query: string): D1PreparedStatement;
    dump(): Promise<ArrayBuffer>;
    batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
    exec(query: string): Promise<D1ExecResult>;
  }

  interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    first<T = unknown>(colName?: string): Promise<T | null>;
    run(): Promise<D1Result>;
    all<T = unknown>(): Promise<D1Result<T>>;
    raw<T = unknown>(): Promise<T[]>;
  }

  interface D1Result<T = unknown> {
    results?: T[];
    success: boolean;
    error?: string;
    meta: object;
  }

  interface D1ExecResult {
    count: number;
    duration: number;
  }
}

export type { CloudflareEnv };
