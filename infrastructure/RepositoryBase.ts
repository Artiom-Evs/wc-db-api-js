import { Pool } from 'mysql2/promise';

export default abstract class RepositoryBase {
    protected _pool: Pool;

    constructor(pool: Pool) {
        this._pool = pool;
    }
}
