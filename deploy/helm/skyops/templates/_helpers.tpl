{{/*
Expand the name of the chart.
*/}}
{{- define "skyops.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
We truncate at 63 chars because some Kubernetes name fields are limited to this (by the DNS naming spec).
If release name contains chart name it will be used as a full name.
*/}}
{{- define "skyops.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "skyops.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels for Control Plane
*/}}
{{- define "skyops.labels" -}}
helm.sh/chart: {{ include "skyops.chart" . }}
{{ include "skyops.selectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: skyops
{{- end }}

{{/*
Selector labels for Control Plane
*/}}
{{- define "skyops.selectorLabels" -}}
app.kubernetes.io/name: {{ include "skyops.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: control-plane
{{- end }}

{{/*
Name of the Control Plane ServiceAccount
*/}}
{{- define "skyops.serviceAccountName" -}}
{{- if .Values.serviceAccount.create }}
{{- default (include "skyops.fullname" .) .Values.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.serviceAccount.name }}
{{- end }}
{{- end }}

{{/*
Name of the Secret
*/}}
{{- define "skyops.secretName" -}}
{{- if .Values.secrets.existingSecret }}
{{- .Values.secrets.existingSecret }}
{{- else }}
{{- printf "%s-secrets" (include "skyops.fullname" .) }}
{{- end }}
{{- end }}

{{/*
PostgreSQL Fullname
*/}}
{{- define "skyops.postgresqlFullname" -}}
{{- printf "%s-postgresql" (include "skyops.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
PostgreSQL Labels
*/}}
{{- define "skyops.postgresqlLabels" -}}
helm.sh/chart: {{ include "skyops.chart" . }}
{{ include "skyops.postgresqlSelectorLabels" . }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: skyops
{{- end }}

{{/*
PostgreSQL Selector Labels
*/}}
{{- define "skyops.postgresqlSelectorLabels" -}}
app.kubernetes.io/name: {{ include "skyops.name" . }}-postgresql
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Agent Fullname
*/}}
{{- define "skyops.agentFullname" -}}
{{- printf "%s-agent" (include "skyops.fullname" .) | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Agent Labels
*/}}
{{- define "skyops.agentLabels" -}}
helm.sh/chart: {{ include "skyops.chart" . }}
{{ include "skyops.agentSelectorLabels" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
app.kubernetes.io/part-of: skyops
{{- end }}

{{/*
Agent Selector Labels
*/}}
{{- define "skyops.agentSelectorLabels" -}}
app.kubernetes.io/name: {{ include "skyops.name" . }}-agent
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: agent
{{- end }}

{{/*
Agent ServiceAccount Name
*/}}
{{- define "skyops.agentServiceAccountName" -}}
{{- if .Values.agent.serviceAccount.create }}
{{- default (printf "%s-sa" (include "skyops.agentFullname" .)) .Values.agent.serviceAccount.name }}
{{- else }}
{{- default "default" .Values.agent.serviceAccount.name }}
{{- end }}
{{- end }}
