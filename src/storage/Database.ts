import Database from "better-sqlite3";
import { PONS_INDEXER_SCHEMA } from "./schema.js";

export class PonsDatabase {
  readonly sqlite: Database.Database;
  readonly filename: string;

  constructor(filename = ":memory:") {
    this.filename = filename;
    this.sqlite = new Database(filename);
    this.sqlite.exec(PONS_INDEXER_SCHEMA);
  }

  transaction<T>(fn: () => T): T {
    return this.sqlite.transaction(fn)();
  }

  close(): void {
    this.sqlite.close();
  }
}
