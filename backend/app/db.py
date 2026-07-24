import os

from neo4j import GraphDatabase


def _neo4j_credentials() -> tuple[str, str]:
    auth_value = os.getenv(
        "NEO4J_AUTH",
        "",
    ).strip()

    auth_user = ""
    auth_password = ""

    if "/" in auth_value:
        auth_user, auth_password = auth_value.split(
            "/",
            1,
        )

    user = (
            os.getenv("NEO4J_USER", "").strip()
            or auth_user
            or "neo4j"
    )

    password = (
            os.getenv("NEO4J_PASSWORD", "").strip()
            or auth_password
    )

    if not password:
        raise RuntimeError(
            "Neo4j credentials are missing. Set NEO4J_AUTH or "
            "NEO4J_USER and NEO4J_PASSWORD."
        )

    return user, password


NEO4J_URI = os.getenv(
    "NEO4J_URI",
    "bolt://artvis-db:7687",
)

NEO4J_USER, NEO4J_PASSWORD = _neo4j_credentials()


_driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(
        NEO4J_USER,
        NEO4J_PASSWORD,
    ),
)


def get_driver():
    return _driver


def verify_connectivity() -> None:
    _driver.verify_connectivity()


def close_driver() -> None:
    _driver.close()
