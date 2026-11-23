{{- define "taxi-platform.hdfsUri" -}}
hdfs://{{ .Release.Name }}-namenode:8020
{{- end -}}

{{- define "taxi-platform.kafkaBootstrap" -}}
{{ .Release.Name }}-kafka:9092
{{- end -}}
