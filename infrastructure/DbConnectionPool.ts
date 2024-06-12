import mysql from 'mysql2/promise';

const host = process.env.WP_DB_HOST;
const database = process.env.WP_DB_NAME;
const user = process.env.WP_DB_USER;
const password = process.env.WP_DB_PASSWORD;
const port = 3306;

if (!host)
    throw new Error(`"WP_DB_HOST" environment variable should be defined.`);
if (!database)
    throw new Error(`"WP_DB_NAME" environment variable should be defined.`);
if (!user)
    throw new Error(`"WP_DB_USER" environment variable should be defined.`);
if (password === null || password === null)
    throw new Error(`"WP_DB_PASSWORD" environment variable should be defined.`);

const pool = mysql.createPool({
  host,
  port,
  database,
  user,
  password,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

export default pool;
