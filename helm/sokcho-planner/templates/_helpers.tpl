{{- define "sokcho-planner.name" -}}sokcho-planner{{- end }}
{{- define "sokcho-planner.fullname" -}}{{ include "sokcho-planner.name" . }}{{- end }}
{{- define "sokcho-planner.labels" -}}
app.kubernetes.io/name: {{ include "sokcho-planner.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version | replace "+" "_" }}
{{- end }}
{{- define "sokcho-planner.selectorLabels" -}}
app.kubernetes.io/name: {{ include "sokcho-planner.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}
