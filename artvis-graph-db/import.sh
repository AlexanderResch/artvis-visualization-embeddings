#!/bin/bash

# for neo4j v5 
neo4j-admin database load --from-path=/var/lib/neo4j/dump/ --overwrite-destination=true neo4j --verbose
neo4j-admin database migrate neo4j

# for neo4j v4
# neo4j-admin load --from=/var/lib/neo4j/dump/artvis.dump --database=neo4j --force
