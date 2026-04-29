from utility.logger import log
from dotenv import dotenv_values
import sqlite3

env= dotenv_values('.env') 


def connect_to_db(db_path: str = "ngx.sqlite"):
    """
        This connects to an SQLite DB.

        Args: 
            db_path: str
                Path to the SQLite database file.
        
        Returns:
            conn: sqlite3.Connection
                This is an already made connection which handles database interactions.
    """
    conn = None
    try:
        conn = sqlite3.connect(db_path)
        log('Connection Successful', 'db')
    except sqlite3.Error as e:
        log(f'Unable to connect to DB: {e}', 'error', 'db')

    return conn



def close_connection(conn):
    """
        This closes the connection to the DB.

        Args:
            conn: sqlite3.Connection
                This is an already made connection which handles database interactions.
    """
    if conn:
        conn.close()
        log('Connection Closed', 'db')
