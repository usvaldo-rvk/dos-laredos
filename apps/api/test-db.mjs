import pg from 'pg'

const { Client } = pg

const client = new Client({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'postgres',
  database: 'dos_laredos'
})

try {
  console.log('Conectando a PostgreSQL...')
  await client.connect()
  console.log('Conexión exitosa!')

  const res = await client.query('SELECT NOW()')
  console.log('Hora del servidor:', res.rows[0].now)

  await client.end()
} catch (err) {
  console.error('Error de conexión:', err.message)
}
