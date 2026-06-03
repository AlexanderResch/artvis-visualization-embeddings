FROM neo4j:5.8-enterprise

# Stay root for setup
USER root

# Install dos2unix for line ending conversion
RUN apt-get update && apt-get install -y dos2unix && rm -rf /var/lib/apt/lists/*

# Create dump directory
RUN mkdir -p /var/lib/neo4j/dump

# Copy over all necessary files
COPY ./certificates /var/lib/neo4j/certificates
COPY ./import.sh /var/lib/neo4j/import.sh
# COPY ./plugins /var/lib/neo4j/plugins
COPY ./neo4j_dump /var/lib/neo4j/dump

# Fix ownership only on directories/files we added, not Neo4j system dirs
# RUN chown -R neo4j:neo4j /var/lib/neo4j/plugins \
    ## &&
RUN chown -R neo4j:neo4j /var/lib/neo4j/dump \
    && chown neo4j:neo4j /var/lib/neo4j/import.sh

# Convert line endings and make script executable
RUN dos2unix /var/lib/neo4j/import.sh \
    && chmod +x /var/lib/neo4j/import.sh

# Switch to neo4j for running scripts and DB runtime
USER neo4j

# Run import script as neo4j
RUN /var/lib/neo4j/import.sh

# Default command
CMD ["neo4j"]
