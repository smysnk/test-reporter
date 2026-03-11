{{- define "test-station.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "test-station.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "test-station.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "test-station.labels" -}}
app.kubernetes.io/name: {{ include "test-station.name" . }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "test-station.selectorLabels" -}}
app.kubernetes.io/name: {{ include "test-station.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "test-station.serverName" -}}
{{- printf "%s-server" (include "test-station.fullname" .) -}}
{{- end -}}

{{- define "test-station.webName" -}}
{{- printf "%s-web" (include "test-station.fullname" .) -}}
{{- end -}}

{{- define "test-station.serverConfigMapName" -}}
{{- if .Values.server.existingConfigMap -}}
{{- .Values.server.existingConfigMap -}}
{{- else -}}
{{- printf "%s-env" (include "test-station.serverName" .) -}}
{{- end -}}
{{- end -}}

{{- define "test-station.serverSecretName" -}}
{{- if .Values.server.existingSecret -}}
{{- .Values.server.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" (include "test-station.serverName" .) -}}
{{- end -}}
{{- end -}}

{{- define "test-station.webConfigMapName" -}}
{{- if .Values.web.existingConfigMap -}}
{{- .Values.web.existingConfigMap -}}
{{- else -}}
{{- printf "%s-env" (include "test-station.webName" .) -}}
{{- end -}}
{{- end -}}

{{- define "test-station.webSecretName" -}}
{{- if .Values.web.existingSecret -}}
{{- .Values.web.existingSecret -}}
{{- else -}}
{{- printf "%s-secret" (include "test-station.webName" .) -}}
{{- end -}}
{{- end -}}

{{- define "test-station.image" -}}
{{- printf "%s:%s" .Values.image.repository .Values.image.tag -}}
{{- end -}}
