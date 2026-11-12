#!/bin/bash
set -e

neo4j-admin database load --from-path=/var/lib/neo4j/dump/ --overwrite-destination=true neo4j --verbose
neo4j-admin database migrate neo4j
