"""Create a clean, isolated Playwright database from the migrated local schema."""

import shutil
import sqlite3
import sys
from pathlib import Path

source, destination = map(Path, sys.argv[1:])
if not source.is_file():
    raise SystemExit("Run the local Prisma migrations first; dev.db is missing.")
shutil.copy2(source, destination)
connection = sqlite3.connect(destination)
try:
    connection.execute("PRAGMA foreign_keys = OFF")
    tables = connection.execute(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' "
        "AND name != '_prisma_migrations'"
    ).fetchall()
    for (table,) in tables:
        connection.execute(f'DELETE FROM "{table.replace(chr(34), chr(34) * 2)}"')
    connection.commit()
finally:
    connection.close()
