FROM neo4j:5.8-enterprise

USER root

RUN apt-get update && apt-get install -y dos2unix && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /var/lib/neo4j/dump

COPY ./certificates /var/lib/neo4j/certificates
COPY ./import.sh /var/lib/neo4j/import.sh
COPY ./neo4j_dump /var/lib/neo4j/dump

RUN chown -R neo4j:neo4j /var/lib/neo4j/dump \
    && chown neo4j:neo4j /var/lib/neo4j/import.sh

RUN dos2unix /var/lib/neo4j/import.sh \
    && chmod +x /var/lib/neo4j/import.sh

USER neo4j

RUN /var/lib/neo4j/import.sh

CMD ["neo4j"]
