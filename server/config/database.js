const mysql = require('mysql')

console.log(process.env.HOST, process.env.MYSQL_PASSWORD)
const db = mysql.createConnection({
    host: process.env.HOST,
    user: 'root',
    password: process.env.MYSQL_PASSWORD,
    database: 'chat_db',
    port: 3306
})

module.exports = db