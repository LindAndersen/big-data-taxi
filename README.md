# Deploy using helm

```console
helm upgrade --install taxi-platform deploy/helm/taxi-platform --set spark.rbac.create=false

kubectl -n bd-gr-02 exec taxi-platform-namenode-0 -- /opt/hadoop/bin/hdfs dfs -fs hdfs://taxi-platform-namenode:8020 -ls /

kubectl -n bd-gr-02 exec taxi-platform-kafka-0 -- \
  /opt/kafka/bin/kafka-topics.sh --bootstrap-server taxi-platform-kafka:9092 --list

kubectl -n bd-gr-02 exec taxi-platform-postgresql-0 -- \
  sh -c 'PGPASSWORD="$POSTGRES_PASSWORD" psql -h taxi-platform-postgresql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;"'

```
