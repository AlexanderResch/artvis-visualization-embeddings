import os

from neo4j import (
    GraphDatabase
)


NEO4J_URI = os.getenv(
    "NEO4J_URI",
    "bolt://artvis-db:7687",
)

NEO4J_USER = os.getenv(
    "NEO4J_USER",
    "neo4j",
)

NEO4J_PASSWORD = os.getenv(
    "NEO4J_PASSWORD",
    "root1234",
)


_driver = GraphDatabase.driver(
    NEO4J_URI,

    auth=(
        NEO4J_USER,
        NEO4J_PASSWORD,
    ),
)


def get_driver():
    return _driver


def close_driver() -> None:
    _driver.close()