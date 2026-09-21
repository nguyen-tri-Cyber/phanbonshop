#!/bin/sh
set -eu

# MySQL's official entrypoint creates MYSQL_USER before executing this file.
# Create the database-per-service schemas and grant that configured runtime user
# access without hard-coding a development-only username.
for database in auth_db product_db order_db inventory_db customer_db content_db; do
  mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" <<SQL
CREATE DATABASE IF NOT EXISTS \`${database}\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${MYSQL_USER}'@'%';
SQL
done

mysql --protocol=socket -uroot -p"${MYSQL_ROOT_PASSWORD}" -e 'FLUSH PRIVILEGES;'
