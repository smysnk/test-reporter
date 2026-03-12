#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=./lib/fleet-defaults.sh
source "${script_dir}/lib/fleet-defaults.sh"

usage() {
  cat <<USAGE
Usage:
  apply-fleet-gitrepo-ssh-secret.sh [options]

Options:
  --namespace <name>         Kubernetes namespace for GitRepo secret (default: GitRepo metadata namespace)
  --secret-name <name>       Secret name referenced by GitRepo clientSecretName (default: fleet/gitrepo.yml)
  --private-key <path>       Private key file path (default: auto-detect in ~/.ssh)
  --known-hosts <path>       known_hosts file path (default: ~/.ssh/known_hosts)
  --public-key <path>        Optional public key file path (stored as ssh-publickey)
  --no-known-hosts           Do not include known_hosts in the secret
  --kubeconfig <path>        Optional KUBECONFIG path
  --create-namespace         Create namespace if it does not exist
  --dry-run                  Render secret YAML and print to stdout only
  --help                     Show this help

Notes:
  - Secret type is kubernetes.io/ssh-auth.
  - Secret key names: ssh-privatekey, known_hosts, ssh-publickey.
  - Fleet GitRepo with SSH expects this secret in the same namespace as the GitRepo resource.
USAGE
}

NAMESPACE="$(gitrepo_namespace)"
SECRET_NAME="$(gitrepo_client_secret_name)"
PRIVATE_KEY=""
KNOWN_HOSTS="~/.ssh/known_hosts"
PUBLIC_KEY=""
INCLUDE_KNOWN_HOSTS="true"
KUBECONFIG_PATH=""
CREATE_NAMESPACE="false"
DRY_RUN="false"

expand_path() {
  local path_value="$1"

  if [[ "$path_value" == "~" ]]; then
    printf '%s\n' "$HOME"
    return
  fi

  if [[ "$path_value" == ~/* ]]; then
    printf '%s/%s\n' "$HOME" "${path_value#~/}"
    return
  fi

  printf '%s\n' "$path_value"
}

detect_private_key() {
  local ssh_dir="$HOME/.ssh"
  local candidate=""

  for candidate in "$ssh_dir/id_ed25519" "$ssh_dir/id_rsa" "$ssh_dir/id_ecdsa" "$ssh_dir/id_dsa"; do
    if [[ -f "$candidate" ]]; then
      printf '%s\n' "$candidate"
      return
    fi
  done

  candidate="$(find "$ssh_dir" -maxdepth 1 -type f -name 'id_*' ! -name '*.pub' ! -name '*known_hosts*' | head -n 1 || true)"
  printf '%s\n' "$candidate"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --namespace)
      NAMESPACE="${2:-}"
      shift 2
      ;;
    --secret-name)
      SECRET_NAME="${2:-}"
      shift 2
      ;;
    --private-key)
      PRIVATE_KEY="${2:-}"
      shift 2
      ;;
    --known-hosts)
      KNOWN_HOSTS="${2:-}"
      shift 2
      ;;
    --public-key)
      PUBLIC_KEY="${2:-}"
      shift 2
      ;;
    --no-known-hosts)
      INCLUDE_KNOWN_HOSTS="false"
      shift
      ;;
    --kubeconfig)
      KUBECONFIG_PATH="${2:-}"
      shift 2
      ;;
    --create-namespace)
      CREATE_NAMESPACE="true"
      shift
      ;;
    --dry-run)
      DRY_RUN="true"
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

if ! command -v kubectl >/dev/null 2>&1; then
  echo "Error: kubectl is required" >&2
  exit 1
fi

if [[ -n "$KUBECONFIG_PATH" ]]; then
  export KUBECONFIG="$KUBECONFIG_PATH"
fi

if [[ -n "$PRIVATE_KEY" ]]; then
  PRIVATE_KEY="$(expand_path "$PRIVATE_KEY")"
else
  PRIVATE_KEY="$(detect_private_key)"
fi

if [[ -z "$PRIVATE_KEY" ]]; then
  echo "Error: no SSH private key found. Use --private-key to specify one." >&2
  exit 1
fi

if [[ ! -f "$PRIVATE_KEY" ]]; then
  echo "Error: private key file not found: $PRIVATE_KEY" >&2
  exit 1
fi

if grep -q "ENCRYPTED" "$PRIVATE_KEY"; then
  echo "Warning: private key appears passphrase-protected; Fleet may not support passphrase-protected keys." >&2
fi

if [[ "$INCLUDE_KNOWN_HOSTS" == "true" ]]; then
  KNOWN_HOSTS="$(expand_path "$KNOWN_HOSTS")"
  if [[ ! -f "$KNOWN_HOSTS" ]]; then
    echo "Error: known_hosts file not found: $KNOWN_HOSTS" >&2
    echo "Hint: use --no-known-hosts to skip, or --known-hosts to specify a file." >&2
    exit 1
  fi
fi

if [[ -n "$PUBLIC_KEY" ]]; then
  PUBLIC_KEY="$(expand_path "$PUBLIC_KEY")"
  if [[ ! -f "$PUBLIC_KEY" ]]; then
    echo "Error: public key file not found: $PUBLIC_KEY" >&2
    exit 1
  fi
fi

if [[ "$CREATE_NAMESPACE" == "true" ]]; then
  kubectl get namespace "$NAMESPACE" >/dev/null 2>&1 || kubectl create namespace "$NAMESPACE"
fi

create_cmd=(
  kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME"
  --type=kubernetes.io/ssh-auth
  --from-file="ssh-privatekey=$PRIVATE_KEY"
)

if [[ "$INCLUDE_KNOWN_HOSTS" == "true" ]]; then
  create_cmd+=(--from-file="known_hosts=$KNOWN_HOSTS")
fi

if [[ -n "$PUBLIC_KEY" ]]; then
  create_cmd+=(--from-file="ssh-publickey=$PUBLIC_KEY")
fi

if [[ "$DRY_RUN" == "true" ]]; then
  "${create_cmd[@]}" --dry-run=client -o yaml
  exit 0
fi

"${create_cmd[@]}" --dry-run=client -o yaml | kubectl apply -f -

echo "Applied GitRepo SSH secret '$SECRET_NAME' in namespace '$NAMESPACE'"
echo "Private key source: $PRIVATE_KEY"
if [[ "$INCLUDE_KNOWN_HOSTS" == "true" ]]; then
  echo "known_hosts source: $KNOWN_HOSTS"
fi
